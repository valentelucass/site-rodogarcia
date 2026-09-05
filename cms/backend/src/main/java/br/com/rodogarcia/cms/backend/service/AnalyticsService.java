package br.com.rodogarcia.cms.backend.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import br.com.rodogarcia.cms.backend.security.ClientIpResolver;
import br.com.rodogarcia.cms.backend.utils.IsoTime;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public class AnalyticsService {

    private static final Set<String> ALLOWED_EVENTS = Set.of(
        "click", "scroll", "form_submit", "form_start", "form_success", "form_fail",
        "download", "outbound_link", "cta_click", "popup_open", "popup_shown",
        "popup_submit", "page_view", "session_start", "session_end", "time_on_page"
    );
    private static final Pattern GA4_ID = Pattern.compile("^(?:G|GT|AW)-[A-Z0-9]{4,}$");
    private static final Pattern CLARITY_ID = Pattern.compile("^[A-Za-z0-9]{6,80}$");

    private final JsonFileStore store;
    private final StoragePaths paths;
    private final TrackingService tracking;
    private final RateLimitService rateLimits;
    private final ClientIpResolver clientIpResolver;
    private final Clock clock;

    public AnalyticsService(
        JsonFileStore store,
        StoragePaths paths,
        TrackingService tracking,
        RateLimitService rateLimits,
        ClientIpResolver clientIpResolver,
        Clock clock
    ) {
        this.store = store;
        this.paths = paths;
        this.tracking = tracking;
        this.rateLimits = rateLimits;
        this.clientIpResolver = clientIpResolver;
        this.clock = clock;
    }

    public ObjectNode readConfig() {
        JsonNode raw = store.read(paths.analyticsConfig(), store.mapper().createObjectNode());
        try {
            return normalizeStoredProviders(parseConfig(raw));
        } catch (ApiException ignored) {
            return store.mapper().createObjectNode();
        }
    }

    public ObjectNode readPublicConfig() {
        ObjectNode config = readConfig();
        ObjectNode result = store.mapper().createObjectNode();
        result.set("tracking", config.path("tracking").isObject()
            ? config.path("tracking").deepCopy() : store.mapper().createObjectNode());
        ObjectNode providers = result.putObject("providers");
        JsonNode ga4 = config.path("providers").path("ga4");
        ObjectNode publicGa4 = providers.putObject("ga4");
        boolean ga4Enabled = ga4.path("enabled").asBoolean(false)
            && !ga4.path("measurementId").asString().isEmpty();
        publicGa4.put("enabled", ga4Enabled);
        publicGa4.put("measurementId", ga4Enabled ? ga4.path("measurementId").asString() : "");
        JsonNode clarity = config.path("providers").path("clarity");
        ObjectNode publicClarity = providers.putObject("clarity");
        boolean clarityEnabled = clarity.path("enabled").asBoolean(false)
            && !clarity.path("projectId").asString().isEmpty();
        publicClarity.put("enabled", clarityEnabled);
        publicClarity.put("projectId", clarityEnabled ? clarity.path("projectId").asString() : "");
        return result;
    }

    public ObjectNode updateConfig(JsonNode body) {
        JsonNode input = body == null || body.isNull()
            ? store.mapper().createObjectNode() : body;
        ObjectNode incoming = parseConfig(input);
        return store.withWriteLock(List.of(paths.analyticsConfig()), () -> {
            ObjectNode merged = deepMerge(readConfig(), incoming);
            ObjectNode parsed = parseConfig(merged);
            validateEnabledProviders(parsed);
            store.write(paths.analyticsConfig(), parsed);
            return parsed;
        });
    }

    public void createEvent(JsonNode body, HttpServletRequest request) {
        String ip = clientIpResolver.resolve(request);
        var state = rateLimits.state("analytics", ip, RateLimitService.ANALYTICS);
        if (state.count() >= RateLimitService.ANALYTICS.maxAttempts()) {
            throw new ApiException(429, "Limite de eventos excedido.");
        }
        JsonNode eventValue = body.get("type");
        if (eventValue == null || eventValue.isNull()) eventValue = body.get("event");
        String event = Sanitizers.text(eventValue, 40).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EVENTS.contains(event)) throw new ApiException(422, "Tipo de evento invalido.");
        rateLimits.require(
            "analytics", ip, RateLimitService.ANALYTICS,
            "Limite de eventos excedido."
        );
        ObjectNode input = body.isObject()
            ? ((ObjectNode) body).deepCopy() : store.mapper().createObjectNode();
        input.put("event", event);
        String source = Sanitizers.text(body.get("source"), 80);
        input.put("source", source.isEmpty() ? "site" : source);
        tracking.record(input, request);
    }

    public Map<String, Object> stats(double days) {
        double requestedDays = Double.isNaN(days) || days == 0d ? 30d : days;
        double safeDays = Math.max(1d, Math.min(365d, requestedDays));
        long now = clock.millis();
        long from = (long) (now - safeDays * 24d * 60d * 60d * 1_000d);
        List<ObjectNode> events = normalizedEvents(from);
        Map<String, Integer> eventCounts = new LinkedHashMap<>();
        Map<String, List<ObjectNode>> bySession = new LinkedHashMap<>();
        Map<String, Integer> pageCounts = new LinkedHashMap<>();
        Map<String, Integer> clickCounts = new LinkedHashMap<>();
        List<Double> scrollValues = new ArrayList<>();
        int successfulForms = 0;

        for (ObjectNode event : events) {
            String name = event.path("event").asString();
            eventCounts.merge(name, 1, Integer::sum);
            String sessionId = event.path("sessionId").asString();
            String sessionKey = sessionId.isEmpty() ? "anonymous-" + event.path("id").asString() : sessionId;
            bySession.computeIfAbsent(sessionKey, ignored -> new ArrayList<>()).add(event);
            if (name.equals("page_view")) pageCounts.merge(event.path("page").asString(), 1, Integer::sum);
            if (name.equals("form_success")
                && !Sanitizers.text(event.get("element"), 120).equals("exit-intent-popup")) successfulForms++;
            if (name.equals("scroll")) {
                Double value = finiteNumber(event.get("value"));
                if (value != null && value >= 0 && value <= 100) scrollValues.add(value);
            }
            if (name.equals("click") || name.equals("cta_click")) {
                String area = Sanitizers.text(event.get("element"), 80);
                if (area.isEmpty()) area = Sanitizers.text(event.get("value"), 80);
                if (area.isEmpty()) area = Sanitizers.text(event.get("page"), 80);
                clickCounts.merge(area.isEmpty() ? "Sem identificacao" : area, 1, Integer::sum);
            }
        }

        int sessions = bySession.size();
        long bounced = bySession.values().stream().filter(items ->
            items.stream().filter(item -> item.path("event").asString().equals("page_view")).count() <= 1
        ).count();
        double averageDuration = average(bySession.values().stream()
            .map(this::sessionDuration).map(Long::doubleValue).toList()) / 1_000d;
        List<Map<String, Object>> topPages = topCounts(pageCounts, "path", "page", "views", 8);
        int popupSubmissions = count(eventCounts, "popup_submit") + count(eventCounts, "popup_submitted");
        int popupOpen = count(eventCounts, "popup_open") + count(eventCounts, "popup_shown");
        int downloads = count(eventCounts, "download");
        int totalConversions = successfulForms + downloads + popupSubmissions;

        Map<String, Object> conversions = new LinkedHashMap<>();
        conversions.put("forms", successfulForms);
        conversions.put("downloads", downloads);
        conversions.put("popupSubmissions", popupSubmissions);
        conversions.put("leads", count(eventCounts, "lead_created"));
        conversions.put("popupOpen", popupOpen);
        conversions.put("total", totalConversions);
        conversions.put("conversionRate", jsonNumber(
            sessions > 0 ? totalConversions * 100d / sessions : 0d));

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("visitors", sessions);
        metrics.put("sessions", sessions);
        metrics.put("bounceRate", jsonNumber(sessions > 0 ? bounced * 100d / sessions : 0d));
        metrics.put("avgTimeSeconds", jsonNumber(averageDuration));
        metrics.put("averageSessionDuration", jsonNumber(averageDuration));
        metrics.put("pageViews", count(eventCounts, "page_view"));

        Map<String, Object> heatmap = new LinkedHashMap<>();
        heatmap.put("avgScrollPercent", jsonNumber(average(scrollValues)));
        heatmap.put("topClickAreas", topCounts(clickCounts, "area", null, "total", 8));
        List<Map<String, Object>> recent = events.stream().limit(80).map(event -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", event.path("id").asString());
            item.put("event", event.path("event").asString());
            item.put("type", event.path("type").asString());
            item.put("page", event.path("page").asString());
            item.put("sessionId", event.path("sessionId").asString());
            item.put("timestamp", event.path("timestamp").asLong());
            item.put("createdAt", IsoTime.format(event.path("timestamp").asLong()));
            return item;
        }).toList();
        Map<String, Object> innerStats = new LinkedHashMap<>();
        innerStats.put("generatedAt", IsoTime.format(now));
        innerStats.put("metrics", metrics);
        innerStats.put("heatmap", heatmap);
        innerStats.put("eventCounts", eventCounts);
        innerStats.put("conversions", conversions);
        innerStats.put("totalConversions", totalConversions);
        innerStats.put("eventsTable", recent);
        Map<String, Object> window = new LinkedHashMap<>();
        window.put("days", jsonNumber(safeDays));
        window.put("from", IsoTime.format(from));
        window.put("to", IsoTime.format(now));
        innerStats.put("window", window);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalPageViews", count(eventCounts, "page_view"));
        result.put("uniqueSessions", sessions);
        result.put("topPages", topPages);
        result.put("recentEvents", recent);
        result.put("stats", innerStats);
        return result;
    }

    private List<ObjectNode> normalizedEvents(long from) {
        List<ObjectNode> events = new ArrayList<>();
        int index = 0;
        for (JsonNode stored : store.readArray(paths.trackingEvents())) {
            index++;
            if (!stored.isObject()) continue;
            ObjectNode event = ((ObjectNode) stored).deepCopy();
            event.remove("userId");
            JsonNode eventName = nullish(event.get("event"), event.get("type"));
            String name = jsString(eventName);
            long timestamp = eventTime(event);
            if (timestamp < from) continue;
            event.put("id", jsStringOr(event.get("id"), "analytics-" + index));
            event.put("event", name);
            event.put("type", name);
            String page = TrackingService.sanitizePath(event.get("page"));
            event.put("page", page.isEmpty() ? "/" : page);
            event.put("sessionId", Sanitizers.text(event.get("sessionId"), 64));
            event.put("timestamp", timestamp);
            events.add(event);
        }
        events.sort(Comparator.comparingLong(
            (ObjectNode item) -> item.path("timestamp").asLong()).reversed());
        return events;
    }

    private long eventTime(JsonNode event) {
        JsonNode timestamp = event.get("timestamp");
        if (timestamp != null && timestamp.isNumber() && Double.isFinite(timestamp.doubleValue())) {
            return timestamp.asLong();
        }
        long parsed = AuditService.parseDate(timestamp == null ? "" : timestamp.asString());
        if (parsed != Long.MIN_VALUE) return parsed;
        parsed = AuditService.parseDate(event.path("createdAt").asString());
        return parsed == Long.MIN_VALUE ? 0 : parsed;
    }

    private long sessionDuration(List<ObjectNode> events) {
        if (events.size() < 2) return 0;
        long min = Long.MAX_VALUE;
        long max = Long.MIN_VALUE;
        for (ObjectNode event : events) {
            long time = event.path("timestamp").asLong();
            min = Math.min(min, time);
            max = Math.max(max, time);
        }
        return max - min;
    }

    private ObjectNode parseConfig(JsonNode input) {
        if (input == null || !input.isObject()) invalidConfig();
        ObjectNode result = store.mapper().createObjectNode();
        copyString(input, result, "siteUrl", 240);
        if (input.has("consent")) result.set("consent", parseConsent(input.get("consent")));
        if (input.has("tracking")) result.set("tracking", parseTracking(input.get("tracking")));
        if (input.has("providers")) result.set("providers", parseProviders(input.get("providers")));
        if (input.has("seo")) result.set("seo", parseSeo(input.get("seo")));
        return result;
    }

    private ObjectNode parseConsent(JsonNode input) {
        requireObject(input);
        ObjectNode result = store.mapper().createObjectNode();
        copyBoolean(input, result, "bannerEnabled");
        copyInteger(input, result, "version", 1, 999);
        if (input.has("categories")) {
            JsonNode categories = input.get("categories");
            requireObject(categories);
            ObjectNode parsed = store.mapper().createObjectNode();
            copyBoolean(categories, parsed, "analytics");
            copyBoolean(categories, parsed, "marketing");
            copyBoolean(categories, parsed, "performance");
            result.set("categories", parsed);
        }
        return result;
    }

    private ObjectNode parseTracking(JsonNode input) {
        requireObject(input);
        ObjectNode result = store.mapper().createObjectNode();
        copyBoolean(input, result, "enabled");
        copyInteger(input, result, "heartbeatSeconds", 10, 600);
        if (input.has("scrollMilestones")) {
            JsonNode values = input.get("scrollMilestones");
            if (!values.isArray() || values.size() > 8) invalidConfig();
            ArrayNode parsed = result.putArray("scrollMilestones");
            for (JsonNode value : values) {
                if (!isInteger(value, 1, 100)) invalidConfig();
                parsed.add(value.intValue());
            }
        }
        return result;
    }

    private ObjectNode parseProviders(JsonNode input) {
        requireObject(input);
        ObjectNode result = store.mapper().createObjectNode();
        if (input.has("ga4")) result.set("ga4", parseProvider(input.get("ga4"), "measurementId", 40));
        if (input.has("clarity")) result.set("clarity", parseProvider(input.get("clarity"), "projectId", 80));
        if (input.has("sentry")) result.set("sentry", parseProvider(input.get("sentry"), "dsn", 400));
        return result;
    }

    private ObjectNode parseProvider(JsonNode input, String idField, int limit) {
        requireObject(input);
        ObjectNode result = store.mapper().createObjectNode();
        copyBoolean(input, result, "enabled");
        copyString(input, result, idField, limit);
        return result;
    }

    private ObjectNode parseSeo(JsonNode input) {
        requireObject(input);
        ObjectNode result = store.mapper().createObjectNode();
        copyBoolean(input, result, "enableSearchConsole");
        copyString(input, result, "propertyUrl", 240);
        copyString(input, result, "sitemapUrl", 240);
        return result;
    }

    private ObjectNode normalizeStoredProviders(ObjectNode config) {
        JsonNode providers = config.get("providers");
        if (providers == null || !providers.isObject()) return config;
        JsonNode ga4 = providers.get("ga4");
        if (ga4 != null && ga4.isObject()) {
            ObjectNode object = (ObjectNode) ga4;
            String id = Sanitizers.text(object.get("measurementId"), 40).toUpperCase(Locale.ROOT);
            object.put("measurementId", id);
            object.put("enabled", object.path("enabled").asBoolean(false) && GA4_ID.matcher(id).matches());
        }
        JsonNode clarity = providers.get("clarity");
        if (clarity != null && clarity.isObject()) {
            ObjectNode object = (ObjectNode) clarity;
            String id = Sanitizers.text(object.get("projectId"), 80);
            object.put("projectId", id);
            object.put("enabled", object.path("enabled").asBoolean(false) && CLARITY_ID.matcher(id).matches());
        }
        return config;
    }

    private void validateEnabledProviders(ObjectNode config) {
        JsonNode ga4 = config.path("providers").path("ga4");
        if (ga4.isObject()) {
            String id = Sanitizers.text(ga4.get("measurementId"), 40).toUpperCase(Locale.ROOT);
            ((ObjectNode) ga4).put("measurementId", id);
            if (ga4.path("enabled").asBoolean(false) && !GA4_ID.matcher(id).matches()) {
                throw new ApiException(422, "Informe um Measurement ID GA4 válido antes de habilitar o provedor.");
            }
        }
        JsonNode clarity = config.path("providers").path("clarity");
        if (clarity.isObject()) {
            String id = Sanitizers.text(clarity.get("projectId"), 80);
            ((ObjectNode) clarity).put("projectId", id);
            if (clarity.path("enabled").asBoolean(false) && !CLARITY_ID.matcher(id).matches()) {
                throw new ApiException(422, "Informe um Project ID Microsoft Clarity válido antes de habilitar o provedor.");
            }
        }
    }

    private ObjectNode deepMerge(ObjectNode current, ObjectNode incoming) {
        ObjectNode result = current.deepCopy();
        incoming.properties().forEach(entry -> {
            JsonNode existing = result.get(entry.getKey());
            JsonNode value = entry.getValue();
            if (existing != null && existing.isObject() && value.isObject()) {
                result.set(entry.getKey(), deepMerge((ObjectNode) existing, (ObjectNode) value));
            } else {
                result.set(entry.getKey(), value.deepCopy());
            }
        });
        return result;
    }

    private static void copyBoolean(JsonNode source, ObjectNode target, String name) {
        if (!source.has(name)) return;
        if (!source.get(name).isBoolean()) invalidConfig();
        target.put(name, source.get(name).asBoolean());
    }

    private static void copyInteger(JsonNode source, ObjectNode target, String name, int min, int max) {
        if (!source.has(name)) return;
        if (!isInteger(source.get(name), min, max)) invalidConfig();
        target.put(name, source.get(name).intValue());
    }

    private static void copyString(JsonNode source, ObjectNode target, String name, int limit) {
        if (!source.has(name)) return;
        JsonNode value = source.get(name);
        if (!value.isString() || value.asString().length() > limit) invalidConfig();
        target.put(name, value.asString());
    }

    private static boolean isInteger(JsonNode value, int min, int max) {
        return value != null && value.isNumber() && value.doubleValue() == Math.rint(value.doubleValue())
            && value.doubleValue() >= min && value.doubleValue() <= max;
    }

    private static void requireObject(JsonNode input) {
        if (input == null || !input.isObject()) invalidConfig();
    }

    private static void invalidConfig() {
        throw new ApiException(422, "Configuracao de analytics invalida.");
    }

    private static Double finiteNumber(JsonNode value) {
        if (value == null) return null;
        double parsed;
        if (value.isNull()) parsed = 0d;
        else if (value.isNumber()) parsed = value.doubleValue();
        else if (value.isBoolean()) parsed = value.asBoolean() ? 1d : 0d;
        else if (value.isString()) parsed = AuditService.jsNumber(value.asString());
        else if (value.isArray()) parsed = arrayNumber(value);
        else parsed = Double.NaN;
        return Double.isFinite(parsed) ? parsed : null;
    }

    private static double average(List<Double> values) {
        return values.isEmpty() ? 0d : values.stream().mapToDouble(Double::doubleValue).average().orElse(0d);
    }

    private static int count(Map<String, Integer> counts, String key) {
        return counts.getOrDefault(key, 0);
    }

    private static JsonNode nullish(JsonNode value, JsonNode fallback) {
        return value == null || value.isNull() ? fallback : value;
    }

    private static String jsStringOr(JsonNode value, String fallback) {
        return value == null || value.isNull() ? fallback : jsString(value);
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

    private static double arrayNumber(JsonNode value) {
        if (value.isEmpty()) return 0d;
        if (value.size() != 1) return Double.NaN;
        return AuditService.jsNumber(jsString(value.get(0)));
    }

    private static Number jsonNumber(double value) {
        if (value == Math.rint(value) && Math.abs(value) <= Long.MAX_VALUE) {
            return Long.valueOf((long) value);
        }
        return Double.valueOf(value);
    }

    private static List<Map<String, Object>> topCounts(
        Map<String, Integer> counts,
        String firstKey,
        String duplicateKey,
        String valueKey,
        int limit
    ) {
        return counts.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .limit(limit)
            .map(entry -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put(firstKey, entry.getKey());
                if (duplicateKey != null) item.put(duplicateKey, entry.getKey());
                item.put(valueKey, entry.getValue());
                return item;
            }).toList();
    }
}
