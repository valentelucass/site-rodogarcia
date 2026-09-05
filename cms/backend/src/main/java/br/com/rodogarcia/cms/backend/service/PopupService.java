package br.com.rodogarcia.cms.backend.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.MediaPresentation;
import br.com.rodogarcia.cms.backend.repository.JsonCollections;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import br.com.rodogarcia.cms.backend.security.ClientIpResolver;
import br.com.rodogarcia.cms.backend.service.content.ContentMediaValidator;
import br.com.rodogarcia.cms.backend.utils.Ids;
import br.com.rodogarcia.cms.backend.utils.IsoTime;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

@Service
public class PopupService {

    private static final List<String> EVENT_NAMES = List.of(
        "popup_shown", "popup_closed", "popup_submitted", "popup_ignored"
    );
    private static final Set<String> EVENTS = Set.copyOf(EVENT_NAMES);
    private static final String LANDING_B2B_SOURCE = "landing-b2b-form";

    private final JsonFileStore store;
    private final JsonCollections collections;
    private final StoragePaths paths;
    private final ContentMediaValidator media;
    private final RateLimitService rateLimits;
    private final ClientIpResolver clientIpResolver;
    private final LeadService leads;
    private final TrackingService tracking;
    private final AuditService audit;
    private final Clock clock;

    public PopupService(
        JsonFileStore store,
        JsonCollections collections,
        StoragePaths paths,
        ContentMediaValidator media,
        RateLimitService rateLimits,
        ClientIpResolver clientIpResolver,
        LeadService leads,
        TrackingService tracking,
        AuditService audit,
        Clock clock
    ) {
        this.store = store;
        this.collections = collections;
        this.paths = paths;
        this.media = media;
        this.rateLimits = rateLimits;
        this.clientIpResolver = clientIpResolver;
        this.leads = leads;
        this.tracking = tracking;
        this.audit = audit;
        this.clock = clock;
    }

    public ObjectNode readConfig() {
        ObjectNode defaults = defaults();
        JsonNode raw = store.read(paths.popupConfig(), JsonNodeFactory.instance.objectNode());
        ObjectNode merged = merge(defaults, raw.isObject() ? (ObjectNode) raw : JsonNodeFactory.instance.objectNode());
        ObjectNode normalized = normalizeConfig(merged, false);
        if (!normalized.path("enableName").asBoolean()
            && !normalized.path("enableEmail").asBoolean()
            && !normalized.path("enablePhone").asBoolean()) {
            normalized.put("enableEmail", true);
        }
        return normalized;
    }

    public ObjectNode updateConfig(JsonNode body, HttpServletRequest request) {
        ObjectNode incoming = body != null && body.isObject()
            ? (ObjectNode) body : JsonNodeFactory.instance.objectNode();
        ObjectNode normalized = store.withWriteLock(List.of(paths.popupConfig()), () -> {
            ObjectNode current = readConfig();
            ObjectNode merged = merge(current, incoming);
            ObjectNode updated = normalizeConfig(merged, true);
            if (!updated.path("enableName").asBoolean()
                && !updated.path("enableEmail").asBoolean()
                && !updated.path("enablePhone").asBoolean()) {
                throw new ApiException(422, "Ative ao menos um campo de contato no popup.");
            }
            store.write(paths.popupConfig(), updated);
            return updated;
        });
        audit.record(request, "popup.update", "exit-popup", Map.of(
            "enabled", String.valueOf(normalized.path("enabled").asBoolean())
        ));
        return normalized;
    }

    public ObjectNode createLead(JsonNode body, HttpServletRequest request) {
        String ip = clientIpResolver.resolve(request);
        var state = rateLimits.state("lead", ip, RateLimitService.LEAD);
        if (state.count() >= RateLimitService.LEAD.maxAttempts()) {
            throw new ApiException(429, "Limite de envios atingido. Tente novamente mais tarde.");
        }
        requireObject(body);
        String source = valueOr(Sanitizers.text(body.get("source"), 40), "exit-intent-popup");
        String name = Sanitizers.text(body.get("name"), 80);
        String email = Sanitizers.email(body.get("email"));
        String phone = Sanitizers.text(body.get("phone"), 20);
        String cnpj = Sanitizers.digits(body.get("cnpj"), 14);
        boolean landing = source.equals(LANDING_B2B_SOURCE);
        if (name.isEmpty() && email.isEmpty() && phone.isEmpty()) {
            throw new ApiException(422, "Informe ao menos um dado de contato.");
        }
        if (landing && (name.isEmpty() || email.isEmpty()
            || phone.replaceAll("\\D", "").length() < 10 || cnpj.isEmpty()
            || !strictTrue(body.get("privacyAccepted")))) {
            throw new ApiException(
                422,
                "Informe nome, e-mail, telefone, CNPJ e aceite a Política de Privacidade."
            );
        }
        if (landing && cnpj.length() != 14) {
            throw new ApiException(422, "Informe um CNPJ com 14 dígitos.");
        }
        return store.withWriteLock(List.of(
            paths.rateLimits(), paths.leads(), paths.trackingEvents(), paths.popupLeads()
        ), () -> {
            long now = clock.millis();
            for (JsonNode existing : collections.read(paths.popupLeads())) {
                if (!email.isEmpty() && email.equals(existing.path("email").asString())) {
                    long createdAt = AuditService.parseDate(existing.path("createdAt").asString());
                    if (createdAt != Long.MIN_VALUE && now - createdAt < 10 * 60_000L) {
                        throw new ApiException(
                            409,
                            "Este e-mail acabou de enviar um cadastro. Aguarde alguns minutos."
                        );
                    }
                }
            }
            rateLimits.require(
                "lead", ip, RateLimitService.LEAD,
                "Limite de envios atingido. Tente novamente mais tarde."
            );
            ObjectNode metadata = JsonNodeFactory.instance.objectNode();
            if (landing) {
                metadata.put("origin", valueOr(Sanitizers.text(body.get("origin"), 80), "campaign-v1"));
                metadata.put("cnpj", cnpj);
                putSafe(metadata, "companyLocation", Sanitizers.text(body.get("companyLocation"), 140));
                putSafe(metadata, "warehouseLocation", Sanitizers.text(body.get("warehouseLocation"), 140));
                putSafe(metadata, "notes", Sanitizers.text(body.get("notes"), 180));
                metadata.put("privacyAccepted", "true");
                putSafe(metadata, "utmSource", Sanitizers.text(body.get("utmSource"), 120));
                putSafe(metadata, "utmMedium", Sanitizers.text(body.get("utmMedium"), 120));
                putSafe(metadata, "utmCampaign", Sanitizers.text(body.get("utmCampaign"), 120));
            } else {
                putSafe(metadata, "origin", Sanitizers.text(body.get("origin"), 80));
            }
            ObjectNode lead = leads.create(
                null, request, source, body.get("pagePath"),
                JsonNodeFactory.instance.stringNode(name), JsonNodeFactory.instance.stringNode(email),
                JsonNodeFactory.instance.stringNode(phone), null, body.get("sessionId"), metadata
            );
            collections.mutate(paths.popupLeads(), values -> {
                values.add(lead.deepCopy());
                return null;
            });
            return lead;
        });
    }

    public List<JsonNode> listLeads() {
        List<JsonNode> result = new ArrayList<>();
        collections.read(paths.popupLeads()).forEach(item -> result.add(item.deepCopy()));
        result.sort(Comparator.comparing(
            item -> item.path("createdAt").asString(), Comparator.reverseOrder()
        ));
        return result;
    }

    public ObjectNode createEvent(JsonNode body, HttpServletRequest request) {
        String ip = clientIpResolver.resolve(request);
        var state = rateLimits.state("popupEvent", ip, RateLimitService.POPUP_EVENT);
        if (state.count() >= RateLimitService.POPUP_EVENT.maxAttempts()) {
            throw new ApiException(429, "Muitos eventos enviados em pouco tempo.");
        }
        if (body == null) {
            // O handler Node acessa `req.body.event` diretamente quando não houve body.
            throw new NullPointerException("request body");
        }
        JsonNode input = body.isObject()
            ? body : JsonNodeFactory.instance.objectNode();
        String name = Sanitizers.text(input.get("event"), 40).toLowerCase(java.util.Locale.ROOT);
        if (!EVENTS.contains(name)) throw new ApiException(422, "Evento invalido para o popup.");
        rateLimits.require(
            "popupEvent", ip, RateLimitService.POPUP_EVENT,
            "Muitos eventos enviados em pouco tempo."
        );
        ObjectNode entry = JsonNodeFactory.instance.objectNode();
        entry.put("id", Ids.generate("popup_event"));
        entry.put("createdAt", IsoTime.format(clock.millis()));
        entry.put("event", name);
        JsonNode pageValue = input.get("pagePath");
        if (pageValue == null || pageValue.isNull()) pageValue = input.get("page");
        entry.put("pagePath", TrackingService.sanitizePath(pageValue));
        entry.put("source", Sanitizers.text(input.get("source"), 40));
        entry.put("mobile", strictTrue(input.get("mobile")));
        entry.put("sessionId", Sanitizers.text(input.get("sessionId"), 80));
        Map<String, String> metadata = metadata(input.get("metadata"), 8, 40, 120);
        if (!metadata.isEmpty()) {
            ObjectNode metadataNode = entry.putObject("metadata");
            metadata.forEach(metadataNode::put);
        }
        collections.mutate(paths.popupEvents(), values -> {
            values.add(entry.deepCopy());
            return null;
        });
        ObjectNode trackingEvent = JsonNodeFactory.instance.objectNode();
        trackingEvent.put("event", name);
        trackingEvent.put("page", entry.path("pagePath").asString());
        trackingEvent.put("source", valueOr(entry.path("source").asString(), "exit-intent-popup"));
        trackingEvent.put("sessionId", entry.path("sessionId").asString());
        trackingEvent.put("device", entry.path("mobile").asBoolean() ? "mobile" : "desktop");
        if (entry.has("metadata")) trackingEvent.set("metadata", entry.get("metadata").deepCopy());
        tracking.record(trackingEvent, request);
        return entry;
    }

    public Map<String, Object> events(double days) {
        List<JsonNode> events = new ArrayList<>();
        collections.read(paths.popupEvents()).forEach(value -> events.add(value.deepCopy()));
        events.sort((left, right) -> compareDates(
            left.path("createdAt").asString(), right.path("createdAt").asString()));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("events", events.stream().limit(200).toList());
        response.put("analytics", summarize(events, days));
        return response;
    }

    private Map<String, Object> summarize(List<JsonNode> events, double days) {
        double requestedDays = Double.isNaN(days) || days == 0d ? 30d : days;
        double safeDays = Math.max(1d, Math.min(120d, requestedDays));
        long now = clock.millis();
        long from = (long) (now - safeDays * 86_400_000d);
        long last7From = now - 7 * 86_400_000L;
        Map<String, Integer> totals = new LinkedHashMap<>();
        EVENT_NAMES.forEach(event -> totals.put(event, 0));
        Map<String, Integer> pages = new LinkedHashMap<>();
        int last7Events = 0;
        int last7Shown = 0;
        int last7Submitted = 0;
        for (JsonNode event : events) {
            long time = date(event.path("createdAt").asString());
            String name = event.path("event").asString();
            if (time >= last7From) {
                last7Events++;
                if (name.equals("popup_shown")) last7Shown++;
                if (name.equals("popup_submitted")) last7Submitted++;
            }
            if (time < from) continue;
            if (totals.containsKey(name)) totals.merge(name, 1, Integer::sum);
            pages.merge(valueOr(event.path("pagePath").asString(), "/"), 1, Integer::sum);
        }
        int shown = totals.get("popup_shown");
        int submitted = totals.get("popup_submitted");
        List<Map<String, Object>> topPages = pages.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .limit(8)
            .map(entry -> {
                Map<String, Object> value = new LinkedHashMap<>();
                value.put("pagePath", entry.getKey());
                value.put("total", entry.getValue());
                return value;
            })
            .toList();
        Map<String, Object> last7Days = new LinkedHashMap<>();
        last7Days.put("events", last7Events);
        last7Days.put("shown", last7Shown);
        last7Days.put("submitted", last7Submitted);
        Map<String, Object> window = new LinkedHashMap<>();
        window.put("days", jsonNumber(safeDays));
        window.put("from", IsoTime.format(from));
        window.put("to", IsoTime.format(now));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("totals", totals);
        response.put("conversionRate", jsonNumber(shown > 0 ? submitted * 100.0 / shown : 0.0));
        response.put("topPages", topPages);
        response.put("last7Days", last7Days);
        response.put("window", window);
        return response;
    }

    private ObjectNode normalizeConfig(ObjectNode input, boolean strictMedia) {
        ObjectNode defaults = defaults();
        ObjectNode desktop = input.path("desktop").isObject() ? (ObjectNode) input.path("desktop") : JsonNodeFactory.instance.objectNode();
        ObjectNode mobileConfig = input.path("mobile").isObject() ? (ObjectNode) input.path("mobile") : JsonNodeFactory.instance.objectNode();
        ObjectNode result = JsonNodeFactory.instance.objectNode();
        result.put("enabled", bool(input.get("enabled"), true));
        result.put("title", textOr(input.get("title"), 120, defaults.path("title").asString()));
        result.put("description", textOr(input.get("description"), 280, defaults.path("description").asString()));
        result.put("enableName", bool(input.get("enableName"), true));
        result.put("enableEmail", bool(input.get("enableEmail"), true));
        result.put("enablePhone", bool(input.get("enablePhone"), true));
        result.put("buttonText", textOr(input.get("buttonText"), 60, defaults.path("buttonText").asString()));
        result.put("closeText", textOr(input.get("closeText"), 40, defaults.path("closeText").asString()));
        result.put("successMessage", textOr(input.get("successMessage"), 280, defaults.path("successMessage").asString()));
        result.put("badgeText", textOr(input.get("badgeText"), 60, defaults.path("badgeText").asString()));
        String image = image(input.get("image"), "Popup: imagem padrão", strictMedia);
        result.put("image", image);
        putImagePresentation(result, input.get("imagePresentation"), image);
        putNumber(result, "delaySeconds", number(input.get("delaySeconds"), 10, 0, 120));
        putNumber(result, "cooldownHours", number(input.get("cooldownHours"), 24, 0, 720));
        result.put("maxShowsPerSession", Math.round(number(input.get("maxShowsPerSession"), 1, 1, 10)));
        result.put("mobileScrollTrigger", bool(input.get("mobileScrollTrigger"), true));
        result.put("mobileBackButtonTrigger", bool(input.get("mobileBackButtonTrigger"), true));
        ObjectNode outputDesktop = result.putObject("desktop");
        outputDesktop.put("title", textOr(desktop.get("title"), 120, textOr(input.get("title"), 120, defaults.path("desktop").path("title").asString())));
        outputDesktop.put("description", textOr(desktop.get("description"), 280, textOr(input.get("description"), 280, defaults.path("desktop").path("description").asString())));
        String desktopImage = image(desktop.get("image"), "Popup: imagem desktop", strictMedia);
        outputDesktop.put("image", desktopImage);
        putImagePresentation(outputDesktop, desktop.get("imagePresentation"), desktopImage);
        ObjectNode outputMobile = result.putObject("mobile");
        outputMobile.put("title", textOr(mobileConfig.get("title"), 120, textOr(input.get("title"), 120, defaults.path("mobile").path("title").asString())));
        outputMobile.put("description", textOr(mobileConfig.get("description"), 280, textOr(input.get("description"), 280, defaults.path("mobile").path("description").asString())));
        String mobileImage = image(mobileConfig.get("image"), "Popup: imagem mobile", strictMedia);
        outputMobile.put("image", mobileImage);
        putImagePresentation(outputMobile, mobileConfig.get("imagePresentation"), mobileImage);
        outputMobile.put("sheetTitle", textOr(mobileConfig.get("sheetTitle"), 80, defaults.path("mobile").path("sheetTitle").asString()));
        return result;
    }

    private String image(JsonNode value, String label, boolean strict) {
        if (strict) return media.image(value, label);
        try {
            return media.image(value, label);
        } catch (ApiException ignored) {
            return "";
        }
    }

    /**
     * O enquadramento pertence ao uso da imagem no popup e só é aceito quando
     * a respectiva imagem interna também foi validada. O popup não recebe vídeo.
     */
    private void putImagePresentation(ObjectNode target, JsonNode rawPresentation, String image) {
        if (image.isEmpty()) return;
        target.set("imagePresentation", MediaPresentation.normalize(
            store.mapper(), rawPresentation, false, ""
        ));
    }

    private static ObjectNode merge(ObjectNode current, ObjectNode incoming) {
        ObjectNode merged = current.deepCopy();
        incoming.properties().forEach(entry -> {
            if (entry.getKey().equals("desktop") || entry.getKey().equals("mobile")) {
                if (entry.getValue().isObject() && merged.path(entry.getKey()).isObject()) {
                    ObjectNode nested = ((ObjectNode) merged.path(entry.getKey())).deepCopy();
                    entry.getValue().properties().forEach(item ->
                        nested.set(item.getKey(), item.getValue().deepCopy()));
                    merged.set(entry.getKey(), nested);
                }
            } else {
                merged.set(entry.getKey(), entry.getValue().deepCopy());
            }
        });
        return merged;
    }

    private static ObjectNode defaults() {
        ObjectNode value = JsonNodeFactory.instance.objectNode();
        value.put("enabled", true);
        value.put("title", "Antes de sair...");
        value.put("description", "Quer receber nosso conteúdo gratuito antes de ir?");
        value.put("enableName", true);
        value.put("enableEmail", true);
        value.put("enablePhone", true);
        value.put("buttonText", "Receber conteúdo");
        value.put("closeText", "Fechar");
        value.put("successMessage", "Recebemos seus dados. Em breve entraremos em contato.");
        value.put("badgeText", "Oferta especial");
        value.put("image", "");
        value.put("delaySeconds", 10);
        value.put("cooldownHours", 24);
        value.put("maxShowsPerSession", 1);
        value.put("mobileScrollTrigger", true);
        value.put("mobileBackButtonTrigger", true);
        ObjectNode desktop = value.putObject("desktop");
        desktop.put("title", "Antes de sair...");
        desktop.put("description", "Receba uma proposta personalizada para sua operação logística.");
        desktop.put("image", "");
        ObjectNode mobile = value.putObject("mobile");
        mobile.put("title", "Antes de sair...");
        mobile.put("description", "Receba atendimento pelo celular em poucos segundos.");
        mobile.put("image", "");
        mobile.put("sheetTitle", "Fale com a Rodogarcia");
        return value;
    }

    private static boolean bool(JsonNode value, boolean fallback) {
        return value != null && value.isBoolean() ? value.asBoolean() : fallback;
    }

    private static double number(JsonNode value, double fallback, double min, double max) {
        if (value == null || value.isNull() || value.isString() && value.asString().isEmpty()) {
            return fallback;
        }
        double parsed = jsNumber(value);
        return Double.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
    }

    private static long date(String value) {
        long parsed = AuditService.parseDate(value);
        return parsed == Long.MIN_VALUE ? Long.MIN_VALUE : parsed;
    }

    private static int compareDates(String left, String right) {
        long leftTime = date(left);
        long rightTime = date(right);
        if (leftTime == Long.MIN_VALUE || rightTime == Long.MIN_VALUE) return 0;
        return Long.compare(rightTime, leftTime);
    }

    private static String textOr(JsonNode value, int max, String fallback) {
        return valueOr(Sanitizers.text(value, max), fallback);
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.isEmpty() ? fallback : value;
    }

    private static void putSafe(ObjectNode node, String key, String value) {
        if (!value.isEmpty()) node.put(key, value);
    }

    private static boolean strictTrue(JsonNode value) {
        return value != null && value.isBoolean() && value.asBoolean();
    }

    private static void putNumber(ObjectNode node, String key, double value) {
        if (value == Math.rint(value) && Math.abs(value) <= Long.MAX_VALUE) {
            node.put(key, (long) value);
        } else {
            node.put(key, value);
        }
    }

    private static Number jsonNumber(double value) {
        if (value == Math.rint(value) && Math.abs(value) <= Long.MAX_VALUE) {
            return Long.valueOf((long) value);
        }
        return Double.valueOf(value);
    }

    private static double jsNumber(JsonNode value) {
        if (value == null || value.isNull()) return 0d;
        if (value.isNumber()) return value.doubleValue();
        if (value.isBoolean()) return value.asBoolean() ? 1d : 0d;
        if (value.isObject()) return Double.NaN;
        if (value.isArray()) {
            if (value.isEmpty()) return 0d;
            if (value.size() != 1) return Double.NaN;
            return AuditService.jsNumber(jsString(value.get(0)));
        }
        return AuditService.jsNumber(value.asString());
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

    private static void requireObject(JsonNode body) {
        if (body == null || !body.isObject()) throw new ApiException(422, "Envie um objeto JSON válido.");
    }
}
