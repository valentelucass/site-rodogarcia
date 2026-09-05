package br.com.rodogarcia.cms.backend.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.repository.JsonCollections;
import br.com.rodogarcia.cms.backend.security.ClientIpResolver;
import br.com.rodogarcia.cms.backend.utils.Ids;
import br.com.rodogarcia.cms.backend.utils.IsoTime;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

@Service
public class TrackingService {

    private static final Set<String> ALLOWED_EVENTS = Set.of(
        "click", "scroll", "form_submit", "form_start", "form_success", "form_fail",
        "download", "outbound_link", "cta_click", "popup_open", "popup_shown",
        "popup_submit", "popup_submitted", "popup_closed", "popup_ignored", "page_view",
        "session_start", "session_end", "time_on_page", "cookie_accept", "cookie_reject",
        "cookie_preferences", "lead_created"
    );

    private final JsonCollections collections;
    private final StoragePaths paths;
    private final RateLimitService rateLimits;
    private final ClientIpResolver clientIpResolver;
    private final Clock clock;

    public TrackingService(
        JsonCollections collections,
        StoragePaths paths,
        RateLimitService rateLimits,
        ClientIpResolver clientIpResolver,
        Clock clock
    ) {
        this.collections = collections;
        this.paths = paths;
        this.rateLimits = rateLimits;
        this.clientIpResolver = clientIpResolver;
        this.clock = clock;
    }

    public ObjectNode createPublic(JsonNode body, HttpServletRequest request) {
        rateLimits.require(
            "tracking",
            clientIpResolver.resolve(request),
            RateLimitService.ANALYTICS,
            "Limite de eventos excedido."
        );
        JsonNode input = body == null ? JsonNodeFactory.instance.objectNode() : body;
        return record(input, request);
    }

    public ObjectNode record(JsonNode input, HttpServletRequest request) {
        String event = Sanitizers.text(field(input, "event"), 60).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EVENTS.contains(event)) throw new ApiException(422, "Tipo de evento invalido.");
        long now = clock.millis();
        ObjectNode entry = collections.read(paths.trackingEvents()).objectNode();
        entry.put("id", Ids.generate("tracking"));
        entry.put("event", event);
        entry.put("type", event);
        String page = sanitizePath(nullishField(input, "page", "pagePath"));
        entry.put("page", page.isEmpty() ? "/" : page);
        entry.put("source", Sanitizers.text(field(input, "source"), 80));
        entry.put("sessionId", Sanitizers.text(field(input, "sessionId"), 80));
        entry.put("element", Sanitizers.text(field(input, "element"), 120));
        entry.put("value", Sanitizers.text(field(input, "value"), 180));
        entry.put("category", Sanitizers.text(field(input, "category"), 60));
        entry.put("consent", Sanitizers.text(field(input, "consent"), 60));
        entry.put("device", Sanitizers.text(field(input, "device"), 60));
        Map<String, String> metadata = metadata(field(input, "metadata"), 12, 60, 180);
        if (!metadata.isEmpty()) {
            ObjectNode metadataNode = entry.putObject("metadata");
            metadata.forEach(metadataNode::put);
        }
        entry.put("userAgent", request == null ? "" : Sanitizers.text(request.getHeader("User-Agent"), 240));
        entry.put("ip", request == null ? "" : Sanitizers.maskIp(clientIpResolver.resolve(request)));
        entry.put("timestamp", now);
        entry.put("createdAt", IsoTime.format(now));

        ObjectNode saved = entry.deepCopy();
        collections.mutate(paths.trackingEvents(), events -> {
            events.add(saved);
            while (events.size() > 25_000) events.remove(0);
            return null;
        });
        return saved;
    }

    public List<ObjectNode> list(Map<String, String> filters) {
        int limit = AuditService.parseSliceLimit(filters.get("limit"), 180, 1, 1_000);
        return filtered(filters).stream().limit(limit).toList();
    }

    public Map<String, Object> summary(Map<String, String> filters) {
        List<ObjectNode> events = filtered(filters);
        Map<String, Integer> byType = new LinkedHashMap<>();
        Map<String, Integer> byPage = new LinkedHashMap<>();
        for (ObjectNode event : events) {
            byType.merge(event.path("event").asString(), 1, Integer::sum);
            byPage.merge(event.path("page").asString(), 1, Integer::sum);
        }
        List<Map<String, Object>> topPages = byPage.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .limit(10)
            .map(item -> {
                Map<String, Object> value = new LinkedHashMap<>();
                value.put("page", item.getKey());
                value.put("total", item.getValue());
                return value;
            })
            .toList();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("total", events.size());
        response.put("byType", byType);
        response.put("topPages", topPages);
        response.put("recentEvents", events.stream().limit(120).toList());
        return response;
    }

    public boolean isAllowedEvent(String event) {
        return ALLOWED_EVENTS.contains(event);
    }

    private List<ObjectNode> filtered(Map<String, String> filters) {
        String eventFilter = Sanitizers.text(
            filters.containsKey("event") ? filters.get("event") : filters.get("type"), 60
        ).toLowerCase(Locale.ROOT);
        String pageFilter = sanitizePath(
            filters.get("page") == null ? null : JsonNodeFactory.instance.stringNode(filters.get("page")));
        String sourceFilter = Sanitizers.text(filters.get("source"), 80).toLowerCase(Locale.ROOT);
        long from = AuditService.parseDate(filters.get("from"));
        long to = AuditService.parseDate(filters.get("to"));
        List<ObjectNode> result = new ArrayList<>();
        for (JsonNode stored : collections.read(paths.trackingEvents())) {
            if (!stored.isObject()) continue;
            ObjectNode event = ((ObjectNode) stored).deepCopy();
            event.remove("userId");
            String normalizedEvent = Sanitizers.text(
                nullishField(event, "event", "type"), 60
            ).toLowerCase(Locale.ROOT);
            long timestamp = eventTime(event);
            event.put("event", normalizedEvent);
            event.put("type", Sanitizers.text(
                nullishField(event, "type", "event"), 60
            ).toLowerCase(Locale.ROOT));
            String page = sanitizePath(nullishField(event, "page", "pagePath"));
            event.put("page", page.isEmpty() ? "/" : page);
            event.put("source", Sanitizers.text(event.path("source"), 80));
            event.put("sessionId", Sanitizers.text(event.path("sessionId"), 80));
            event.put("timestamp", timestamp);
            event.put("createdAt", IsoTime.format(timestamp));
            if (!eventFilter.isEmpty() && !normalizedEvent.equals(eventFilter)) continue;
            if (!pageFilter.isEmpty() && !event.path("page").asString().equals(pageFilter)) continue;
            if (!sourceFilter.isEmpty()
                && !event.path("source").asString().toLowerCase(Locale.ROOT).contains(sourceFilter)) continue;
            if (from != Long.MIN_VALUE && timestamp < from) continue;
            if (to != Long.MIN_VALUE && timestamp > to) continue;
            result.add(event);
        }
        result.sort(Comparator.comparingLong(
            (ObjectNode item) -> item.path("timestamp").asLong()).reversed());
        return result;
    }

    private long eventTime(JsonNode event) {
        if (event.path("timestamp").isNumber()) return event.path("timestamp").asLong();
        long parsed = AuditService.parseDate(event.path("timestamp").asString());
        if (parsed != Long.MIN_VALUE) return parsed;
        parsed = AuditService.parseDate(event.path("createdAt").asString());
        return parsed == Long.MIN_VALUE ? clock.millis() : parsed;
    }

    private static JsonNode field(JsonNode input, String name) {
        return input != null && input.isObject() ? input.get(name) : null;
    }

    private static JsonNode nullishField(JsonNode input, String primary, String fallback) {
        JsonNode value = field(input, primary);
        return value == null || value.isNull() ? field(input, fallback) : value;
    }

    /** Reproduz {@code path.posix.normalize} usado pelo sanitizador Node, inclusive barra final. */
    static String sanitizePath(JsonNode value) {
        String raw = Sanitizers.text(value, 400);
        if (raw.isEmpty() || !raw.startsWith("/") || raw.startsWith("//")) return "";
        String replaced = raw.replace('\\', '/');
        boolean trailingSlash = replaced.endsWith("/");
        java.util.ArrayDeque<String> segments = new java.util.ArrayDeque<>();
        for (String segment : replaced.split("/", -1)) {
            if (segment.isEmpty() || segment.equals(".")) continue;
            if (segment.equals("..")) {
                if (!segments.isEmpty()) segments.removeLast();
            } else {
                segments.addLast(segment);
            }
        }
        String normalized = "/" + String.join("/", segments);
        if (trailingSlash && !segments.isEmpty()) normalized += "/";
        return normalized.contains("..") ? "" : normalized;
    }

    private static Map<String, String> metadata(
        JsonNode input,
        int maxEntries,
        int keyMaxLength,
        int valueMaxLength
    ) {
        if (input == null || !input.isObject()) return Map.of();
        Map<String, String> result = new LinkedHashMap<>();
        input.properties().stream().limit(maxEntries).forEach(item -> {
            String key = Sanitizers.text(item.getKey(), keyMaxLength);
            String value = Sanitizers.text(jsString(item.getValue()), valueMaxLength);
            if (!key.isEmpty() && !value.isEmpty()) result.put(key, value);
        });
        return result;
    }

    private static String jsString(JsonNode value) {
        if (value == null || value.isNull()) return "";
        if (value.isObject()) return "[object Object]";
        if (value.isArray()) {
            List<String> values = new ArrayList<>();
            value.forEach(item -> values.add(jsString(item)));
            return String.join(",", values);
        }
        if (value.isBoolean()) return String.valueOf(value.asBoolean());
        if (value.isNumber()) {
            double numeric = value.doubleValue();
            if (Double.isFinite(numeric) && numeric == Math.rint(numeric)
                && Math.abs(numeric) < 1e21) return String.valueOf((long) numeric);
        }
        return value.asString();
    }
}
