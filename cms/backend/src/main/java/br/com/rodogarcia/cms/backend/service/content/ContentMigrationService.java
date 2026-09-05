package br.com.rodogarcia.cms.backend.service.content;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import br.com.rodogarcia.cms.backend.model.content.ContentDefaults;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.model.content.ContentKeys;
import br.com.rodogarcia.cms.backend.model.content.ContentMediaPresentations;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public final class ContentMigrationService {
    private static final List<String> CONTENT_KEYS = List.of(
        "heroSlides", "dnaSlides", "vagas", "feedbacks", "units",
        "aboutPage", "businessPage", "contactPage", "careersPage", "quotePage",
        "collectionsPage", "headerNavigation", "footerLinks", "homePage", "servicesPage",
        "improvementsPage"
    );
    private static final Map<String, String> UNIT_EMAILS = Map.ofEntries(
        Map.entry("unit-matriz", "comercial.agu@rodogarcia.com.br"),
        Map.entry("unit-agudos", "comercial.agu@rodogarcia.com.br"),
        Map.entry("unit-campinas", "comercial.cpq@rodogarcia.com.br"),
        Map.entry("unit-osasco", "comercial.sp03@rodogarcia.com.br"),
        Map.entry("unit-castro", "comercial.cwb3@rodogarcia.com.br"),
        Map.entry("unit-curitiba", "comercial.cwb2@rodogarcia.com.br"),
        Map.entry("unit-rio", "comercial.rj2@rodogarcia.com.br"),
        Map.entry("unit-hamburgo", "comercial.cwb3@rodogarcia.com.br"),
        Map.entry("unit-recife", "comercial.rec@rodogarcia.com.br")
    );
    private static final String[] LEGACY_CONTEXTS = {
        "Distribuição e abastecimento",
        "Logística industrial e rastreabilidade",
        "Supply chain e entregas nacionais",
        "Transporte e distribuição regional",
        "Atendimento logístico e agendamento",
        "Operações de distribuição",
        "Coleta, entrega e acompanhamento",
        "Distribuição B2B",
        "Logística e previsibilidade operacional"
    };

    private final JsonMapper mapper;
    private final StructuredContentSanitizer sanitizer;

    public ContentMigrationService(JsonMapper mapper, StructuredContentSanitizer sanitizer) {
        this.mapper = mapper;
        this.sanitizer = sanitizer;
    }

    public MigrationResult migrate(JsonNode rawValue, JsonNode siteTextsValue, JsonNode mediaSlotsValue) {
        ObjectNode raw = ContentJson.object(rawValue);
        ObjectNode content = raw.deepCopy();
        ObjectNode defaults = ContentDefaults.content(mapper);
        boolean persist = false;

        for (String key : new String[] {"heroSlides", "dnaSlides", "vagas", "feedbacks", "units"}) {
            if (!content.has(key) || !content.get(key).isArray()) content.set(key, mapper.createArrayNode());
        }

        boolean hasHome = content.has("homePage") && content.get("homePage").isObject();
        ObjectNode sourceHome = hasHome
            ? ContentJson.object(content.get("homePage")) : ContentDefaults.home(mapper);
        if (!hasHome) persist = true;
        ObjectNode home = ContentDefaults.home(mapper);
        sourceHome.properties().forEach(entry -> home.set(entry.getKey(), entry.getValue().deepCopy()));
        if (!sourceHome.has("regionalPresence") || !sourceHome.get("regionalPresence").isObject()
            || !sourceHome.get("regionalPresence").path("units").isArray()) {
            ObjectNode presence = mapper.createObjectNode();
            ArrayNode legacyUnits = mapper.createArrayNode();
            int index = 0;
            for (JsonNode value : sanitizer.sortByOrder(content.get("units"))) {
                ObjectNode unit = ContentJson.object(value);
                ObjectNode migrated = mapper.createObjectNode();
                String id = stringOr(unit, "id", "home-unit-" + (++index));
                migrated.put("id", id);
                migrated.put("order", ContentJson.integer(unit.get("order"), index));
                migrated.put("name", firstText(unit, 120, "name", "nome"));
                migrated.put("state", firstText(unit, 2, "state", "estado").toUpperCase());
                migrated.put("description", firstText(unit, 220, "description", "descricao", "type", "tipo"));
                migrated.put("linkedUnitId", firstText(unit, 80, "id"));
                migrated.put("address", firstText(unit, 220, "address", "endereco"));
                migrated.put("phone", firstText(unit, 60, "phone", "telefone"));
                migrated.put("email", ContentJson.email(unit.get("email")));
                migrated.put("additionalEmail", ContentJson.email(unit.get("additionalEmail")));
                migrated.put("buttonLabel", "Falar com esta unidade");
                String contact = firstUrl(unit, "contactUrl", "linkContato");
                migrated.put("contactUrl", contact.isEmpty() ? "/fale-conosco" : contact);
                migrated.put("active", bothNotFalse(unit, "active", "ativo"));
                legacyUnits.add(migrated);
            }
            presence.set("units", legacyUnits);
            home.set("regionalPresence", presence);
            persist = true;
        }
        if (!sourceHome.has("trackingCta") || !sourceHome.get("trackingCta").isObject()) {
            home.set("trackingCta", defaults.path("homePage").path("trackingCta").deepCopy());
            persist = true;
        }
        if (!sourceHome.has("quickActions") || !sourceHome.get("quickActions").isArray()) {
            home.set("quickActions", defaults.path("homePage").path("quickActions").deepCopy());
            persist = true;
        }
        if (needsSocialProof(home.get("socialProof"), content.get("feedbacks"))) {
            home.set("socialProof", migrateSocialProof(home.get("socialProof"), content.get("feedbacks")));
            persist = true;
        }
        content.set("homePage", home);

        if (!content.has("servicesPage") || !content.get("servicesPage").isObject()) {
            content.set("servicesPage", defaults.get("servicesPage").deepCopy());
        }

        ObjectNode unitsResult = backfillUnits(content, home);
        persist |= unitsResult.path("changed").asBoolean(false);

        ObjectNode siteTexts = ContentJson.object(siteTextsValue);
        ObjectNode mediaSlots = ContentJson.object(mediaSlotsValue);
        for (String pageKey : ContentKeys.PAGE_KEYS) {
            String property = ContentKeys.PAGE_PROPERTIES.get(pageKey);
            JsonNode existing = content.get(property);
            if (existing == null || !existing.isObject()) {
                if (!pageKey.equals("improvements")) persist = true;
                content.set(property, legacyPage(pageKey, content, siteTexts, mediaSlots));
            } else {
                content.set(property, sanitizer.page(pageKey, existing));
            }
        }

        if (!content.has("footerLinks") || !content.get("footerLinks").isObject()) persist = true;
        content.set("footerLinks", sanitizer.footer(content.get("footerLinks")));
        if (!content.has("headerNavigation") || !content.get("headerNavigation").isObject()) persist = true;
        content.set("headerNavigation", sanitizer.navigation(content.get("headerNavigation")));
        persist |= ContentMediaPresentations.normalizeContent(content, mapper);

        ObjectNode normalized = mapper.createObjectNode();
        for (String key : CONTENT_KEYS) {
            if (content.has(key)) normalized.set(key, content.get(key).deepCopy());
        }
        return new MigrationResult(normalized, persist);
    }

    private ObjectNode legacyPage(
        String pageKey,
        ObjectNode content,
        ObjectNode siteTexts,
        ObjectNode mediaSlots
    ) {
        ObjectNode page = ContentDefaults.page(mapper, pageKey);
        if (pageKey.equals("about")) {
            ObjectNode hero = ContentJson.object(page.get("hero"));
            setNonEmpty(hero, "title", ContentJson.text(siteTexts.get("aboutHeroTitle"), 320));
            setNonEmpty(hero, "description", ContentJson.text(siteTexts.get("aboutHeroSubtitle"), 320));
            ObjectNode media = ContentJson.object(hero.get("media"));
            String mediaSlot = sanitizer.internalImageOrEmpty(mediaSlots.get("about.hero"));
            String legacyImage = ContentJson.text(siteTexts.get("aboutHeroImage"), 600);
            setNonEmpty(media, "src", mediaSlot.isEmpty() ? legacyImage : mediaSlot);
            hero.set("media", media);
            page.set("hero", hero);
        } else if (pageKey.equals("contact")) {
            migrateLegacyContact(page, siteTexts);
        } else if (pageKey.equals("careers")) {
            ObjectNode culture = ContentJson.object(page.get("cultureImage"));
            setNonEmpty(culture, "src", ContentJson.text(mediaSlots.get("careers.culture"), 600));
            page.set("cultureImage", culture);
        } else if (pageKey.equals("quote")) {
            for (JsonNode channel : ContentJson.array(page.get("otherChannels"))) {
                if (channel.isObject()) ((ObjectNode) channel).remove(java.util.List.of("createdAt", "updatedAt"));
            }
        }
        return sanitizer.page(pageKey, page);
    }

    private void migrateLegacyContact(ObjectNode page, ObjectNode siteTexts) {
        String phone = fallback(siteTexts, "contactPhoneNumber", "0800 591 4557");
        String hours = fallback(siteTexts, "contactPhoneHours", page.path("info").path("hours").asText());
        String email = fallback(siteTexts, "contactEmailAddress", "gerente.financeiro@rodogarcia.com.br");
        String whatsapp = ContentJson.url(siteTexts.get("contactWhatsappUrl"));
        if (whatsapp.isEmpty()) whatsapp = "https://wa.me/5511993139536";
        ArrayNode channels = (ArrayNode) page.path("mainChannels");
        if (channels.size() >= 3) {
            ContentJson.object(channels.get(0).path("button")).put("url", phoneHref(phone));
            ContentJson.object(channels.get(1).path("button")).put("url", mailto(email));
            ContentJson.object(channels.get(2).path("button")).put("url", whatsapp);
        }
        ObjectNode info = ContentJson.object(page.get("info"));
        ArrayNode items = ContentJson.array(info.get("items"));
        if (items.size() >= 4) {
            ContentJson.object(items.get(0)).put("title", phone).put("description", hours);
            ContentJson.object(items.get(1)).put("title", email)
                .put("description", fallback(siteTexts, "contactEmailResponse", items.get(1).path("description").asText()));
            ContentJson.object(items.get(2)).put("title", fallback(siteTexts, "contactWhatsappLabel", items.get(2).path("title").asText()))
                .put("description", whatsapp);
            String line = fallback(siteTexts, "contactAddressLine", "Rua Pedro Carmine Deo, 156, Agudos - SP");
            String zip = fallback(siteTexts, "contactAddressZip", "17123-210");
            String country = fallback(siteTexts, "contactAddressCountry", "Brasil");
            ContentJson.object(items.get(3)).put("title", line).put("description", "CEP " + zip + " - " + country);
            info.put("address", line + ", CEP " + zip + " - " + country);
            info.put("hours", hours);
        }
        ObjectNode finalCta = ContentJson.object(page.get("finalCta"));
        ArrayNode buttons = ContentJson.array(finalCta.get("buttons"));
        if (!buttons.isEmpty()) {
            ObjectNode first = ContentJson.object(buttons.get(0));
            first.put("label", fallback(siteTexts, "contactCtaLabel", first.path("label").asText()));
            String url = ContentJson.url(siteTexts.get("contactCtaUrl"));
            if (!url.isEmpty()) first.put("url", url);
        }
    }

    private ObjectNode backfillUnits(ObjectNode content, ObjectNode home) {
        boolean changed = false;
        Map<String, String> resolved = new HashMap<>();
        ArrayNode units = ContentJson.array(content.get("units"));
        for (JsonNode value : units) {
            ObjectNode unit = ContentJson.object(value);
            String id = ContentJson.text(unit.get("id"), 80);
            String email = ContentJson.email(unit.get("additionalEmail"));
            if (email.isEmpty()) email = UNIT_EMAILS.getOrDefault(id, "");
            if (!email.isEmpty()) {
                resolved.put(id, email);
                if (!email.equals(unit.path("additionalEmail").asText())) {
                    unit.put("additionalEmail", email);
                    changed = true;
                }
            }
            if (id.equals("unit-matriz")) {
                if (ContentJson.text(unit.get("quoteCnpj"), 20).isEmpty()) {
                    unit.put("quoteCnpj", "60960473000162");
                    changed = true;
                }
                if (ContentJson.text(unit.get("genericPostalCode"), 20).isEmpty()) {
                    unit.put("genericPostalCode", "17123210");
                    changed = true;
                }
            }
        }
        ArrayNode regional = ContentJson.array(home.path("regionalPresence").path("units"));
        for (JsonNode value : regional) {
            ObjectNode unit = ContentJson.object(value);
            String id = ContentJson.text(unit.get("id"), 80);
            String linked = ContentJson.text(unit.get("linkedUnitId"), 80);
            String email = ContentJson.email(unit.get("additionalEmail"));
            if (email.isEmpty()) email = resolved.getOrDefault(linked.isEmpty() ? id : linked, "");
            if (email.isEmpty()) email = UNIT_EMAILS.getOrDefault(linked.isEmpty() ? id : linked, "");
            if (!email.isEmpty() && !email.equals(unit.path("additionalEmail").asText())) {
                unit.put("additionalEmail", email);
                changed = true;
            }
        }
        ObjectNode result = mapper.createObjectNode();
        result.put("changed", changed);
        return result;
    }

    private boolean needsSocialProof(JsonNode socialValue, JsonNode legacyValue) {
        ObjectNode social = ContentJson.object(socialValue);
        ArrayNode current = ContentJson.array(social.get("feedbacks"));
        boolean configured = !ContentJson.text(social.get("title"), 160).isEmpty() && !current.isEmpty();
        if (configured) {
            for (JsonNode item : current) {
                if (ContentJson.text(item.get("name"), 80).isEmpty()
                    || ContentJson.text(item.get("role"), 80).isEmpty()
                    || ContentJson.text(item.get("context"), 120).isEmpty()
                    || ContentJson.text(item.get("testimonial"), 800).isEmpty()) return true;
            }
            return false;
        }
        return !ContentJson.array(legacyValue).isEmpty() || !current.isEmpty();
    }

    private ObjectNode migrateSocialProof(JsonNode socialValue, JsonNode legacyValue) {
        ObjectNode social = ContentJson.object(socialValue);
        ArrayNode source = !ContentJson.array(legacyValue).isEmpty()
            ? sanitizer.sortByOrder(legacyValue)
            : sanitizer.sortByOrder(social.get("feedbacks"));
        ObjectNode result = mapper.createObjectNode();
        String title = ContentJson.text(social.get("title"), 160);
        result.put("title", title.isEmpty()
            ? "Experiências em logística, transporte e distribuição."
            : title);
        ArrayNode feedbacks = result.putArray("feedbacks");
        int index = 0;
        for (JsonNode value : source) {
            ObjectNode legacy = ContentJson.object(value);
            ObjectNode feedback = mapper.createObjectNode();
            feedback.put("id", firstText(legacy, 80, "id").isEmpty() ? "home-feedback-" + (index + 1) : firstText(legacy, 80, "id"));
            feedback.put("order", ContentJson.integer(legacy.get("order"), index + 1));
            String name = firstText(legacy, 80, "name", "nome");
            feedback.put("name", name.isEmpty() ? "Cliente " + (index + 1) : name);
            String role = firstText(legacy, 80, "role");
            feedback.put("role", role.isEmpty() ? "Profissional de logística" : role);
            String context = firstText(legacy, 120, "highlight", "resultadoTexto");
            feedback.put("context", context.isEmpty() ? LEGACY_CONTEXTS[index % LEGACY_CONTEXTS.length] : context);
            String testimonial = firstText(legacy, 800, "testimonial", "comment", "texto");
            feedback.put("testimonial", testimonial.isEmpty()
                ? "A operação ganhou mais previsibilidade, acompanhamento e agilidade nas tratativas."
                : testimonial);
            feedback.put("photo", "");
            feedback.put("rating", Math.min(5, Math.max(1, roundedNumber(firstExisting(legacy, "rating", "nota"), 5))));
            feedback.put("active", bothNotFalse(legacy, "active", "ativo"));
            feedbacks.add(feedback);
            index++;
        }
        return result;
    }

    private static JsonNode firstExisting(ObjectNode value, String... keys) {
        for (String key : keys) if (value.has(key)) return value.get(key);
        return null;
    }

    private static String firstText(ObjectNode value, int maxLength, String... keys) {
        for (String key : keys) {
            String text = ContentJson.text(value.get(key), maxLength);
            if (!text.isEmpty()) return text;
        }
        return "";
    }

    private static String firstUrl(ObjectNode value, String... keys) {
        for (String key : keys) {
            String url = ContentJson.url(value.get(key));
            if (!url.isEmpty()) return url;
        }
        return "";
    }

    private static String stringOr(ObjectNode value, String key, String fallback) {
        String result = ContentJson.text(value.get(key), 80);
        return result.isEmpty() ? fallback : result;
    }

    private static boolean bothNotFalse(ObjectNode value, String... keys) {
        for (String key : keys) {
            if (value.has(key) && value.get(key).isBoolean() && !value.get(key).booleanValue()) return false;
        }
        return true;
    }

    private static int roundedNumber(JsonNode value, int fallback) {
        if (value == null) return fallback;
        try {
            double number = value.isNumber() ? value.doubleValue() : Double.parseDouble(value.asText());
            return Double.isFinite(number) ? (int) Math.round(number) : fallback;
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static void setNonEmpty(ObjectNode value, String key, String candidate) {
        if (!candidate.isEmpty()) value.put(key, candidate);
    }

    private static String fallback(ObjectNode value, String key, String fallback) {
        String candidate = ContentJson.text(value.get(key), 320);
        return candidate.isEmpty() ? fallback : candidate;
    }

    private static String phoneHref(String display) {
        String digits = display.replaceAll("\\D", "");
        if (digits.isEmpty()) return "tel:08005914557";
        return digits.startsWith("55") ? "tel:+" + digits : "tel:+55" + digits;
    }

    private static String mailto(String address) {
        String email = address.length() <= 120 ? address : address.substring(0, 120);
        return email.contains("@") ? "mailto:" + email : "mailto:gerente.financeiro@rodogarcia.com.br";
    }

    public record MigrationResult(ObjectNode content, boolean shouldPersist) {
    }
}
