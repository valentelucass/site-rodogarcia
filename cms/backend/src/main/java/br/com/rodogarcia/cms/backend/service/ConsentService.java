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
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import br.com.rodogarcia.cms.backend.security.ClientIpResolver;
import br.com.rodogarcia.cms.backend.utils.Ids;
import br.com.rodogarcia.cms.backend.utils.IsoTime;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public class ConsentService {

    private static final Set<String> DECISIONS = Set.of(
        "accepted", "rejected", "custom", "partial", "revoked"
    );
    private static final Map<String, Integer> TEXT_LIMITS = textLimits();

    private final JsonFileStore store;
    private final StoragePaths paths;
    private final ClientIpResolver clientIpResolver;
    private final AuditService audit;
    private final Clock clock;

    public ConsentService(
        JsonFileStore store,
        StoragePaths paths,
        ClientIpResolver clientIpResolver,
        AuditService audit,
        Clock clock
    ) {
        this.store = store;
        this.paths = paths;
        this.clientIpResolver = clientIpResolver;
        this.audit = audit;
        this.clock = clock;
    }

    public ObjectNode readSettings() {
        JsonNode raw = store.read(paths.consentSettings(), defaultSettings());
        if (!raw.isObject()) raw = defaultSettings();
        ObjectNode defaults = defaultSettings();
        ObjectNode normalized = store.mapper().createObjectNode();
        normalized.put("enabled", booleanOr(raw.get("enabled"), true));
        normalized.put("version", clamp(jsRound(numberOr(raw.get("version"), 1)), 1, 999));
        for (Map.Entry<String, Integer> entry : TEXT_LIMITS.entrySet()) {
            String value = Sanitizers.text(raw.get(entry.getKey()), entry.getValue());
            normalized.put(entry.getKey(), value.isEmpty()
                ? defaults.path(entry.getKey()).asString() : value);
        }
        normalized.put("style", "floating");
        JsonNode behavior = raw.path("behavior");
        ObjectNode normalizedBehavior = normalized.putObject("behavior");
        normalizedBehavior.put("requireExplicitChoice", booleanOr(
            behavior.get("requireExplicitChoice"), true));
        normalizedBehavior.put("blockAnalyticsUntilConsent", true);
        normalizedBehavior.put("reopenOnVersionChange", booleanOr(
            behavior.get("reopenOnVersionChange"), true));
        JsonNode desktop = raw.path("desktop");
        ObjectNode normalizedDesktop = normalized.putObject("desktop");
        normalizedDesktop.put("position", "bottom-center");
        normalizedDesktop.put("compact", booleanOr(desktop.get("compact"), true));
        JsonNode mobile = raw.path("mobile");
        String position = Sanitizers.text(mobile.get("position"), 40);
        ObjectNode normalizedMobile = normalized.putObject("mobile");
        normalizedMobile.put("position", Set.of("bottom-sheet", "center-modal").contains(position)
            ? position : "bottom-sheet");
        normalizedMobile.put("compact", booleanOr(mobile.get("compact"), false));
        normalized.set("categories", normalizeCategories(raw.get("categories")));
        return normalized;
    }

    public ObjectNode updateSettings(JsonNode body, HttpServletRequest request) {
        JsonNode input = body != null && body.isObject()
            ? body : store.mapper().createObjectNode();
        validateUpdate(input);
        ObjectNode next = store.withWriteLock(List.of(paths.consentSettings()), () -> {
            ObjectNode current = readSettings();
            ObjectNode updated = current.deepCopy();
            updated.put("enabled", booleanOr(input.get("enabled"), current.path("enabled").asBoolean()));
            updated.put("version", clamp(jsRound(numberOr(
                input.get("version"), current.path("version").asDouble())), 1, 999));
            for (Map.Entry<String, Integer> entry : TEXT_LIMITS.entrySet()) {
                String value = Sanitizers.text(input.get(entry.getKey()), entry.getValue());
                if (!value.isEmpty()) updated.put(entry.getKey(), value);
            }
            updated.put("style", "floating");
            JsonNode behavior = input.path("behavior");
            ObjectNode nextBehavior = updated.withObject("behavior");
            nextBehavior.put("requireExplicitChoice", booleanOr(
                behavior.get("requireExplicitChoice"), nextBehavior.path("requireExplicitChoice").asBoolean()));
            nextBehavior.put("blockAnalyticsUntilConsent", true);
            nextBehavior.put("reopenOnVersionChange", booleanOr(
                behavior.get("reopenOnVersionChange"), nextBehavior.path("reopenOnVersionChange").asBoolean()));
            updated.withObject("desktop").put("position", "bottom-center");
            JsonNode mobile = input.path("mobile");
            ObjectNode nextMobile = updated.withObject("mobile");
            String position = Sanitizers.text(mobile.get("position"), 40);
            if (Set.of("bottom-sheet", "center-modal").contains(position)) {
                nextMobile.put("position", position);
            }
            nextMobile.put("compact", booleanOr(
                mobile.get("compact"), nextMobile.path("compact").asBoolean()));
            if (input.path("categories").isArray()) {
                updated.set("categories", normalizeCategories(input.get("categories")));
            }
            updated.put("updatedAt", IsoTime.format(clock.millis()));
            store.write(paths.consentSettings(), updated);
            return updated;
        });
        audit.record(request, "consent.update", "cookies", Map.of(
            "version", String.valueOf(next.path("version").asInt()),
            "enabled", String.valueOf(next.path("enabled").asBoolean())
        ));
        return next;
    }

    public ObjectNode record(JsonNode body, HttpServletRequest request) {
        JsonNode input = body != null && body.isObject()
            ? body : store.mapper().createObjectNode();
        String decision = Sanitizers.text(input.get("decision"), 40).toLowerCase(Locale.ROOT);
        if (!DECISIONS.contains(decision)) decision = "custom";
        ObjectNode settings = readSettings();
        ObjectNode categories = resolveCategories(settings, decision, input.get("categories"));
        String userAgent = Sanitizers.text(request.getHeader("User-Agent"), 300);
        ObjectNode entry = store.mapper().createObjectNode();
        entry.put("id", Ids.generate("cookie_consent"));
        entry.put("createdAt", IsoTime.format(clock.millis()));
        entry.put("updatedAt", IsoTime.format(clock.millis()));
        entry.put("decision", decision);
        entry.put("status", decision);
        entry.put("type", decision);
        entry.put("version", settings.path("version").asInt());
        entry.put("consentTextVersion", settings.path("version").asString());
        entry.set("categories", categories);
        entry.put("sessionId", Sanitizers.text(input.get("sessionId"), 100));
        entry.put("userAgent", userAgent);
        String device = Sanitizers.text(input.get("device"), 40);
        entry.put("device", device.isEmpty() ? deviceFromUserAgent(userAgent) : device);
        entry.put("approximateLocation", strictTrue(input.get("locationAllowed"))
            ? Sanitizers.text(input.get("approximateLocation"), 120) : "");
        entry.put("ipMasked", Sanitizers.maskIp(clientIpResolver.resolve(request)));
        entry.set("scriptsLoaded", stringArray(input.get("scriptsLoaded"), 12));
        entry.set("scriptsFailed", stringArray(input.get("scriptsFailed"), 12));
        ObjectNode log = store.mapper().createObjectNode();
        log.put("at", IsoTime.format(clock.millis()));
        log.put("action", decision.equals("revoked") ? "consent.revoked" : "consent.saved");
        log.put("version", settings.path("version").asString());
        entry.putArray("logs").add(log);
        store.withWriteLock(List.of(paths.cookieConsents()), () -> {
            ArrayNode values = store.readArray(paths.cookieConsents());
            values.add(entry.deepCopy());
            while (values.size() > 50_000) values.remove(0);
            store.write(paths.cookieConsents(), values);
        });
        return entry;
    }

    public Map<String, Object> list(Map<String, String> filters) {
        String status = Sanitizers.text(first(filters, "status", "decision"), 40)
            .toLowerCase(Locale.ROOT);
        String device = Sanitizers.text(filters.get("device"), 40).toLowerCase(Locale.ROOT);
        long from = AuditService.parseDate(filters.get("from"));
        long to = AuditService.parseDate(filters.get("to"));
        int page = Math.max(1, AuditService.parseNumber(filters.get("page"), 1));
        int pageSize = clamp(AuditService.parseNumber(
            first(filters, "pageSize", "limit"), 50), 1, 250);
        List<JsonNode> filtered = new ArrayList<>();
        for (JsonNode entry : store.readArray(paths.cookieConsents())) {
            long createdAt = AuditService.parseDate(entry.path("createdAt").asString());
            String itemStatus = entry.has("status")
                ? entry.path("status").asString() : entry.path("decision").asString();
            if (!status.isEmpty() && !itemStatus.toLowerCase(Locale.ROOT).equals(status)) continue;
            if (!device.isEmpty() && !entry.path("device").asString().toLowerCase(Locale.ROOT).equals(device)) continue;
            if (createdAt != Long.MIN_VALUE && from != Long.MIN_VALUE && createdAt < from) continue;
            if (createdAt != Long.MIN_VALUE && to != Long.MIN_VALUE && createdAt > to) continue;
            filtered.add(entry.deepCopy());
        }
        filtered.sort(Comparator.comparing(
            item -> item.path("createdAt").asString(), Comparator.reverseOrder()));
        long requestedStart = Math.max(0L, ((long) page - 1L) * pageSize);
        int start = (int) Math.min(filtered.size(), requestedStart);
        int end = Math.min(filtered.size(), start + pageSize);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("consents", filtered.subList(start, end));
        result.put("total", filtered.size());
        result.put("page", page);
        result.put("pageSize", pageSize);
        return result;
    }

    private void validateUpdate(JsonNode body) {
        for (Map.Entry<String, Integer> entry : TEXT_LIMITS.entrySet()) {
            if (body.has(entry.getKey()) && Sanitizers.text(body.get(entry.getKey()), entry.getValue()).isEmpty()) {
                throw new ApiException(422, "Consentimento: " + entry.getKey() + " é obrigatório.");
            }
        }
        if (body.has("version")) {
            JsonNode value = body.get("version");
            if (!value.isNumber() || value.doubleValue() != Math.rint(value.doubleValue())
                || value.doubleValue() < 1 || value.doubleValue() > 999) {
                throw new ApiException(422, "Consentimento: informe uma versão inteira entre 1 e 999.");
            }
        }
        if (!body.path("categories").isArray()) return;
        Set<String> keys = new java.util.HashSet<>();
        int index = 0;
        for (JsonNode candidate : body.path("categories")) {
            index++;
            if (!candidate.isObject()) {
                throw new ApiException(422, "Consentimento: categoria " + index + " inválida.");
            }
            String key = Sanitizers.text(candidate.get("key"), 40).toLowerCase(Locale.ROOT);
            if (key.isEmpty() || !keys.add(key)) {
                throw new ApiException(422, "Consentimento: as chaves das categorias devem ser únicas e preenchidas.");
            }
            if (Sanitizers.text(candidate.get("label"), 80).isEmpty()
                || Sanitizers.text(candidate.get("description"), 240).isEmpty()) {
                throw new ApiException(422, "Consentimento: nome e descrição são obrigatórios na categoria " + index + ".");
            }
        }
    }

    private ArrayNode normalizeCategories(JsonNode input) {
        JsonNode source = input != null && input.isArray()
            ? input : defaultSettings().path("categories");
        LinkedHashMap<String, ObjectNode> values = new LinkedHashMap<>();
        for (JsonNode candidate : source) {
            if (!candidate.isObject()) continue;
            ObjectNode normalized = normalizeCategory(candidate);
            values.putIfAbsent(normalized.path("key").asString(), normalized);
        }
        if (!values.containsKey("necessary")) {
            values.put("necessary", normalizeCategory(defaultSettings().path("categories").get(0)));
        }
        ArrayNode result = store.mapper().createArrayNode();
        result.add(values.get("necessary"));
        values.entrySet().stream()
            .filter(item -> !item.getKey().equals("necessary"))
            .limit(7)
            .forEach(item -> result.add(item.getValue()));
        return result;
    }

    private ObjectNode normalizeCategory(JsonNode input) {
        String key = Sanitizers.text(input.get("key"), 40).toLowerCase(Locale.ROOT);
        if (key.isEmpty()) key = "custom";
        ObjectNode category = store.mapper().createObjectNode();
        category.put("key", key);
        String label = Sanitizers.text(input.get("label"), 80);
        category.put("label", label.isEmpty() ? (key.isEmpty() ? "Categoria" : key) : label);
        category.put("description", Sanitizers.text(input.get("description"), 240));
        boolean required = key.equals("necessary");
        category.put("required", required);
        category.put("enabledByDefault", required);
        return category;
    }

    private ObjectNode resolveCategories(ObjectNode settings, String decision, JsonNode input) {
        Map<String, Boolean> requested = booleanMap(input);
        ObjectNode result = store.mapper().createObjectNode();
        for (JsonNode category : settings.path("categories")) {
            String key = category.path("key").asString();
            boolean enabled = category.path("required").asBoolean()
                || decision.equals("accepted")
                || (!(decision.equals("rejected") || decision.equals("revoked"))
                    && Boolean.TRUE.equals(requested.get(key)));
            result.put(key, enabled);
        }
        return result;
    }

    private Map<String, Boolean> booleanMap(JsonNode input) {
        if (input == null || !input.isObject()) return Map.of();
        Map<String, Boolean> result = new LinkedHashMap<>();
        input.properties().stream().limit(12).forEach(item -> {
            String key = Sanitizers.text(item.getKey(), 40).toLowerCase(Locale.ROOT);
            if (!key.isEmpty()) result.put(key, item.getValue().isBoolean() && item.getValue().asBoolean());
        });
        return result;
    }

    private ArrayNode stringArray(JsonNode input, int maxItems) {
        ArrayNode result = store.mapper().createArrayNode();
        if (input == null || !input.isArray()) return result;
        int count = 0;
        for (JsonNode value : input) {
            if (count++ >= maxItems) break;
            String text = Sanitizers.text(value, 120);
            if (!text.isEmpty()) result.add(text);
        }
        return result;
    }

    private ObjectNode defaultSettings() {
        ObjectNode value = store.mapper().createObjectNode();
        value.put("enabled", true);
        value.put("version", 1);
        value.put("title", "Usamos cookies para melhorar sua experiencia");
        value.put("description", "Utilizamos cookies necessários e, com sua permissão, cookies de analytics e marketing para melhorar o site.");
        value.put("acceptAllLabel", "Aceitar todos");
        value.put("rejectLabel", "Recusar opcionais");
        value.put("preferencesLabel", "Preferencias");
        value.put("saveLabel", "Salvar preferencias");
        value.put("style", "floating");
        ObjectNode behavior = value.putObject("behavior");
        behavior.put("requireExplicitChoice", true);
        behavior.put("blockAnalyticsUntilConsent", true);
        behavior.put("reopenOnVersionChange", true);
        value.putObject("desktop").put("position", "bottom-center").put("compact", true);
        value.putObject("mobile").put("position", "bottom-sheet").put("compact", false);
        ArrayNode categories = value.putArray("categories");
        addCategory(categories, "necessary", "Necessarios", "Essenciais para segurança, login e funcionamento do site.", true);
        addCategory(categories, "analytics", "Analytics", "Ajudam a entender visitas, páginas acessadas e desempenho.", false);
        addCategory(categories, "marketing", "Marketing", "Permitem medir campanhas e acoes comerciais.", false);
        return value;
    }

    private void addCategory(ArrayNode categories, String key, String label, String description, boolean required) {
        ObjectNode category = categories.addObject();
        category.put("key", key);
        category.put("label", label);
        category.put("description", description);
        category.put("required", required);
        category.put("enabledByDefault", required);
    }

    private static boolean booleanOr(JsonNode value, boolean fallback) {
        return value != null && value.isBoolean() ? value.asBoolean() : fallback;
    }

    private static double numberOr(JsonNode value, double fallback) {
        double parsed = jsNumber(value);
        return Double.isNaN(parsed) || parsed == 0d ? fallback : parsed;
    }

    private static int jsRound(double value) {
        return (int) Math.floor(value + 0.5d);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static double jsNumber(JsonNode value) {
        if (value == null || value.isNull()) return 0d;
        if (value.isNumber()) return value.doubleValue();
        if (value.isBoolean()) return value.asBoolean() ? 1d : 0d;
        if (value.isObject()) return Double.NaN;
        if (value.isArray()) {
            if (value.isEmpty()) return 0d;
            if (value.size() != 1) return Double.NaN;
            JsonNode item = value.get(0);
            if (item == null || item.isNull()) return 0d;
            if (item.isString() || item.isNumber()) return AuditService.jsNumber(item.asString());
            return Double.NaN;
        }
        return AuditService.jsNumber(value.asString());
    }

    private static String first(Map<String, String> values, String primary, String fallback) {
        return values.containsKey(primary) ? values.get(primary) : values.get(fallback);
    }

    private static String deviceFromUserAgent(String userAgent) {
        String value = userAgent.toLowerCase(Locale.ROOT);
        if (value.contains("ipad") || value.contains("tablet")) return "tablet";
        if (value.contains("mobile") || value.contains("android") || value.contains("iphone")) return "mobile";
        return value.isEmpty() ? "" : "desktop";
    }

    private static boolean strictTrue(JsonNode value) {
        return value != null && value.isBoolean() && value.asBoolean();
    }

    private static Map<String, Integer> textLimits() {
        Map<String, Integer> values = new LinkedHashMap<>();
        values.put("title", 120);
        values.put("description", 400);
        values.put("acceptAllLabel", 60);
        values.put("rejectLabel", 60);
        values.put("preferencesLabel", 60);
        values.put("saveLabel", 60);
        return java.util.Collections.unmodifiableMap(values);
    }
}
