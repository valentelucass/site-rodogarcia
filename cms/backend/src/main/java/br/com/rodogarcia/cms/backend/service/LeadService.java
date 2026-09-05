package br.com.rodogarcia.cms.backend.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.repository.JsonCollections;
import br.com.rodogarcia.cms.backend.utils.Ids;
import br.com.rodogarcia.cms.backend.utils.IsoTime;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.JsonNodeFactory;

@Service
public class LeadService {

    private final JsonCollections collections;
    private final StoragePaths paths;
    private final TrackingService tracking;
    private final Clock clock;

    public LeadService(
        JsonCollections collections,
        StoragePaths paths,
        TrackingService tracking,
        Clock clock
    ) {
        this.collections = collections;
        this.paths = paths;
        this.tracking = tracking;
        this.clock = clock;
    }

    public ObjectNode create(
        String id,
        HttpServletRequest request,
        String source,
        JsonNode pagePath,
        JsonNode name,
        JsonNode email,
        JsonNode phone,
        JsonNode company,
        JsonNode sessionId,
        JsonNode metadata
    ) {
        long now = clock.millis();
        ObjectNode lead = JsonNodeFactory.instance.objectNode();
        lead.put("id", Sanitizers.text(id, 100).isEmpty() ? Ids.generate("lead") : Sanitizers.text(id, 100));
        lead.put("createdAt", IsoTime.format(now));
        lead.put("updatedAt", IsoTime.format(now));
        lead.put("source", Sanitizers.text(source, 60));
        String normalizedPath = TrackingService.sanitizePath(pagePath);
        lead.put("pagePath", normalizedPath.isEmpty() ? "/" : normalizedPath);
        lead.put("name", Sanitizers.text(name, 100));
        lead.put("email", Sanitizers.email(email));
        lead.put("phone", Sanitizers.text(phone, 30));
        lead.put("company", Sanitizers.text(company, 140));
        lead.put("sessionId", Sanitizers.text(sessionId, 100));
        lead.put("device", device(request));
        lead.put("status", "new");
        Map<String, String> safeMetadata = Sanitizers.metadata(metadata);
        if (!safeMetadata.isEmpty()) {
            ObjectNode metadataNode = lead.putObject("metadata");
            safeMetadata.forEach(metadataNode::put);
        }

        ObjectNode saved = lead.deepCopy();
        collections.mutate(paths.leads(), leads -> {
            leads.add(saved);
            return null;
        });
        ObjectNode event = JsonNodeFactory.instance.objectNode();
        event.put("event", "lead_created");
        event.put("page", saved.path("pagePath").asString());
        event.put("source", saved.path("source").asString());
        event.put("sessionId", saved.path("sessionId").asString());
        event.put("device", saved.path("device").asString());
        ObjectNode eventMetadata = event.putObject("metadata");
        eventMetadata.put("leadId", saved.path("id").asString());
        eventMetadata.put("hasEmail", String.valueOf(!saved.path("email").asString().isEmpty()));
        tracking.record(event, request);
        return saved;
    }

    public Map<String, Object> listUnified(Map<String, String> filters) {
        String query = Sanitizers.text(filters.get("q"), 120).toLowerCase(Locale.ROOT);
        String source = Sanitizers.text(filters.get("source"), 60).toLowerCase(Locale.ROOT);
        String status = Sanitizers.text(filters.get("status"), 40).toLowerCase(Locale.ROOT);
        long from = AuditService.parseDate(filters.get("from"));
        long to = AuditService.parseDate(filters.get("to"));
        int page = Math.max(1, AuditService.parseNumber(filters.get("page"), 1));
        String rawSize = filters.containsKey("pageSize") ? filters.get("pageSize") : filters.get("limit");
        int pageSize = AuditService.clamp(AuditService.parseNumber(rawSize, 50), 1, 100);

        List<ObjectNode> candidates = new ArrayList<>();
        addNormalized(candidates, collections.read(paths.leads()), "cms", null);
        addNormalized(candidates, collections.read(paths.popupLeads()), "exit-intent-popup", null);
        addNormalized(candidates, collections.read(paths.contacts()), "contact-form", "contact-form");
        addNormalized(candidates, collections.read(paths.quotes()), "quote-form", "quote-form");

        Map<String, ObjectNode> unique = new LinkedHashMap<>();
        for (ObjectNode lead : candidates) unique.putIfAbsent(identity(lead), lead);
        List<ObjectNode> result = unique.values().stream().filter(lead -> {
            long createdAt = AuditService.parseDate(lead.path("createdAt").asString());
            String haystack = String.join(" ",
                lead.path("name").asString(), lead.path("email").asString(),
                lead.path("phone").asString(), lead.path("company").asString(),
                lead.path("pagePath").asString(), lead.path("source").asString()
            ).toLowerCase(Locale.ROOT);
            if (!query.isEmpty() && !haystack.contains(query)) return false;
            if (!source.isEmpty() && !lead.path("source").asString().toLowerCase(Locale.ROOT).contains(source)) return false;
            if (!status.isEmpty() && !lead.path("status").asString().toLowerCase(Locale.ROOT).equals(status)) return false;
            if (createdAt != Long.MIN_VALUE && from != Long.MIN_VALUE && createdAt < from) return false;
            return createdAt == Long.MIN_VALUE || to == Long.MIN_VALUE || createdAt <= to;
        }).sorted(Comparator.comparing(
            lead -> lead.path("createdAt").asString(), Comparator.reverseOrder()
        )).toList();
        Map<String, Integer> sourceTotals = new LinkedHashMap<>();
        result.forEach(lead -> sourceTotals.merge(
            lead.path("source").asString().isEmpty() ? "sem-origem" : lead.path("source").asString(),
            1,
            Integer::sum
        ));
        long requestedStart = Math.max(0L, ((long) page - 1L) * pageSize);
        int start = (int) Math.min(result.size(), requestedStart);
        int end = Math.min(result.size(), start + pageSize);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("leads", result.subList(start, end));
        response.put("total", result.size());
        response.put("sourceTotals", sourceTotals);
        response.put("page", page);
        response.put("pageSize", pageSize);
        return response;
    }

    private void addNormalized(
        List<ObjectNode> target,
        Iterable<JsonNode> source,
        String fallback,
        String forcedSource
    ) {
        for (JsonNode item : source) {
            if (!item.isObject()) continue;
            ObjectNode input = ((ObjectNode) item).deepCopy();
            if (forcedSource != null) input.put("source", forcedSource);
            target.add(normalizeLegacy(input, fallback));
        }
    }

    private ObjectNode normalizeLegacy(ObjectNode input, String fallback) {
        String createdAt = nullishString(input.get("createdAt"), IsoTime.format(clock.millis()));
        ObjectNode lead = JsonNodeFactory.instance.objectNode();
        lead.put("id", nullishString(input.get("id"), Ids.generate("lead")));
        lead.put("createdAt", createdAt);
        lead.put("updatedAt", nullishString(input.get("updatedAt"), createdAt));
        lead.put("source", valueOr(Sanitizers.text(input.get("source"), 60), fallback));
        String page = TrackingService.sanitizePath(
            input.has("pagePath") ? input.get("pagePath") : input.get("page"));
        lead.put("pagePath", valueOr(page, "/"));
        lead.put("name", Sanitizers.text(input.get("name"), 100));
        lead.put("email", Sanitizers.email(input.get("email")));
        lead.put("phone", Sanitizers.text(input.get("phone"), 30));
        lead.put("company", Sanitizers.text(input.get("company"), 140));
        lead.put("sessionId", Sanitizers.text(input.get("sessionId"), 100));
        lead.put("device", Sanitizers.text(input.get("device"), 40));
        lead.put("status", valueOr(Sanitizers.text(input.get("status"), 40), "new"));
        if (input.path("metadata").isObject()) lead.set("metadata", input.path("metadata").deepCopy());
        return lead;
    }

    private static String identity(ObjectNode lead) {
        String source = lead.path("source").asString();
        JsonNode metadata = lead.path("metadata");
        String sourceRecordId = source.equals("contact-form")
            ? Sanitizers.text(metadata.get("contactId"), 100)
            : source.equals("quote-form") ? Sanitizers.text(metadata.get("quoteId"), 100) : "";
        String id = lead.path("id").asString();
        String rawSourceId = source.equals("contact-form") && id.startsWith("contact_")
            || source.equals("quote-form") && id.startsWith("quote_") ? id : "";
        String sourceIdentity = valueOr(sourceRecordId, rawSourceId);
        if (!sourceIdentity.isEmpty()) return source + ":" + sourceIdentity;
        if ((source.equals("contact-form") || source.equals("quote-form"))
            && (!lead.path("email").asString().isEmpty() || !lead.path("phone").asString().isEmpty())) {
            String contact = valueOr(lead.path("email").asString(), lead.path("phone").asString());
            String created = lead.path("createdAt").asString();
            return source + ":" + contact + ":" + created.substring(0, Math.min(19, created.length()));
        }
        return id;
    }

    private static String device(HttpServletRequest request) {
        String userAgent = request == null ? "" : String.valueOf(request.getHeader("User-Agent"));
        if (userAgent.equals("null")) userAgent = "";
        if (userAgent.matches("(?i).*(tablet|ipad).*")) return "tablet";
        if (userAgent.matches("(?i).*(mobile|android|iphone).*")) return "mobile";
        return userAgent.isEmpty() ? "" : "desktop";
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.isEmpty() ? fallback : value;
    }

    private static String nullishString(JsonNode value, String fallback) {
        if (value == null || value.isNull() || value.isMissingNode()) return fallback;
        if (value.isObject()) return "[object Object]";
        if (value.isArray()) {
            List<String> items = new ArrayList<>();
            value.forEach(item -> items.add(item.isNull() ? "" : nullishString(item, "")));
            return String.join(",", items);
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
