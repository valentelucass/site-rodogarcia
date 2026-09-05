package br.com.rodogarcia.cms.backend.service.content;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.model.content.ContentKeys;
import br.com.rodogarcia.cms.backend.model.content.MediaPresentation;
import br.com.rodogarcia.cms.backend.repository.content.ContentRepository;
import br.com.rodogarcia.cms.backend.repository.content.MediaSlotsRepository;
import br.com.rodogarcia.cms.backend.repository.content.SiteTextsRepository;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public final class PublicContentService {
    private static final Set<String> QUICK_ACTION_TYPES = Set.of("link", "external", "download", "modal");

    private final JsonMapper mapper;
    private final ContentRepository contentRepository;
    private final SiteTextsRepository siteTextsRepository;
    private final MediaSlotsRepository mediaSlotsRepository;
    private final ContentMediaValidator mediaValidator;
    private final StructuredContentSanitizer sanitizer;

    public PublicContentService(
        JsonMapper mapper,
        ContentRepository contentRepository,
        SiteTextsRepository siteTextsRepository,
        MediaSlotsRepository mediaSlotsRepository,
        ContentMediaValidator mediaValidator,
        StructuredContentSanitizer sanitizer
    ) {
        this.mapper = mapper;
        this.contentRepository = contentRepository;
        this.siteTextsRepository = siteTextsRepository;
        this.mediaSlotsRepository = mediaSlotsRepository;
        this.mediaValidator = mediaValidator;
        this.sanitizer = sanitizer;
    }

    public ObjectNode publicContent() {
        ObjectNode content = contentRepository.read();
        ObjectNode result = mapper.createObjectNode();
        result.set("homePage", publicHome(content.get("homePage")));
        result.set("servicesPage", publicServices(content.get("servicesPage")));
        for (String pageKey : ContentKeys.PAGE_KEYS) {
            result.set(ContentKeys.PAGE_PROPERTIES.get(pageKey), sanitizer.page(pageKey, content.get(ContentKeys.PAGE_PROPERTIES.get(pageKey))));
        }
        result.set("footerLinks", sanitizer.footer(content.get("footerLinks")));
        result.set("headerNavigation", sanitizer.navigation(content.get("headerNavigation")));
        result.set("units", publicUnits(content.get("units")));
        result.set("siteTexts", siteTextsRepository.read());
        return result;
    }

    public ObjectNode publicMediaSlots() {
        ObjectNode response = mapper.createObjectNode();
        response.set("slots", mediaSlotsRepository.read());
        return response;
    }

    public ObjectNode publicHome(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = emptyHome();

        ObjectNode rawHero = ContentJson.object(source.get("hero"));
        ArrayNode slides = mapper.createArrayNode();
        int slideIndex = 0;
        for (JsonNode itemValue : ordered(rawHero.get("slides"))) {
            ObjectNode item = ContentJson.object(itemValue);
            if (item.has("active") && item.get("active").isBoolean() && !item.get("active").booleanValue()) continue;
            int currentSlideIndex = ++slideIndex;
            String mode = switch (ContentJson.text(item.get("mode"), 40)) {
                case "media-only" -> "media-only";
                case "text-media" -> "text-media";
                default -> "text-media-buttons";
            };
            ObjectNode media = publicHomeMedia(item.get("media"));
            String title = ContentJson.text(item.get("title"), 120);
            String description = ContentJson.text(item.get("description"), 420);
            if (ContentJson.text(media.get("src"), 600).isEmpty()) continue;
            if (!mode.equals("media-only") && (title.isEmpty() || description.isEmpty())) continue;
            ObjectNode slide = mapper.createObjectNode();
            slide.put("id", id(item, "home-hero-" + currentSlideIndex));
            slide.put("order", ContentJson.integer(item.get("order"), currentSlideIndex));
            slide.put("title", title);
            slide.put("description", description);
            slide.set("media", media);
            slide.put("active", true);
            slide.put("mode", mode);
            slide.set("buttons", mode.equals("text-media-buttons") ? publicButtons(item.get("buttons"), 2, true) : mapper.createArrayNode());
            slides.add(slide);
        }
        ContentJson.object(result.get("hero")).set("slides", slides);

        ObjectNode section1 = ContentJson.object(source.get("section1"));
        ArrayNode section1Items = mapper.createArrayNode();
        int section1Considered = 0;
        for (JsonNode itemValue : ordered(section1.get("items"))) {
            if (section1Considered++ == 3) break;
            int currentItemIndex = section1Considered;
            ObjectNode item = ContentJson.object(itemValue);
            ObjectNode media = publicHomeMedia(item.get("media"));
            String title = ContentJson.text(item.get("title"), 60);
            String description = ContentJson.text(item.get("description"), 180);
            if (title.isEmpty() || description.isEmpty() || ContentJson.text(media.get("src"), 600).isEmpty()) continue;
            ObjectNode output = mapper.createObjectNode();
            output.put("id", id(item, "home-section1-" + currentItemIndex));
            output.put("order", ContentJson.integer(item.get("order"), currentItemIndex));
            output.put("title", title);
            output.put("description", description);
            output.set("media", media);
            section1Items.add(output);
        }
        String section1Title = ContentJson.text(section1.get("title"), 140);
        String section1Label = ContentJson.text(section1.get("ctaLabel"), 40);
        String section1Url = ContentJson.url(section1.get("ctaUrl"));
        if (!section1Title.isEmpty() && !section1Label.isEmpty() && !section1Url.isEmpty() && section1Items.size() == 3) {
            ObjectNode output = mapper.createObjectNode();
            output.put("title", section1Title);
            output.put("ctaLabel", section1Label);
            output.put("ctaUrl", section1Url);
            output.set("items", section1Items);
            result.set("section1", output);
        }

        ObjectNode section2 = ContentJson.object(source.get("section2"));
        ArrayNode section2Items = mapper.createArrayNode();
        int section2Considered = 0;
        for (JsonNode itemValue : ordered(section2.get("items"))) {
            ObjectNode item = ContentJson.object(itemValue);
            if (item.has("active") && item.get("active").isBoolean() && !item.get("active").booleanValue()) continue;
            if (section2Considered++ == 5) break;
            int currentItemIndex = section2Considered;
            ObjectNode media = publicHomeMedia(item.get("media"));
            String title = ContentJson.text(item.get("title"), 120);
            String description = ContentJson.text(item.get("description"), 260);
            if (title.isEmpty() || description.isEmpty() || ContentJson.text(media.get("src"), 600).isEmpty()) continue;
            ObjectNode output = mapper.createObjectNode();
            output.put("id", id(item, "home-section2-" + currentItemIndex));
            output.put("order", ContentJson.integer(item.get("order"), currentItemIndex));
            output.put("title", title);
            output.put("description", description);
            output.set("media", media);
            output.put("active", true);
            section2Items.add(output);
        }
        String section2Title = ContentJson.text(section2.get("title"), 160);
        if (!section2Title.isEmpty() && !section2Items.isEmpty()) {
            ObjectNode output = mapper.createObjectNode();
            output.put("title", section2Title);
            output.set("items", section2Items);
            result.set("section2", output);
        }

        ObjectNode section3 = ContentJson.object(source.get("section3"));
        ArrayNode cards = mapper.createArrayNode();
        int cardIndex = 0;
        for (JsonNode itemValue : ordered(section3.get("cards"))) {
            ObjectNode item = ContentJson.object(itemValue);
            ObjectNode media = publicHomeMedia(item.get("media"));
            ObjectNode output = mapper.createObjectNode();
            output.put("id", id(item, "home-section3-" + (++cardIndex)));
            output.put("order", ContentJson.integer(item.get("order"), cardIndex));
            output.set("media", media);
            output.put("badge", ContentJson.text(item.get("badge"), 60));
            output.put("title", ContentJson.text(item.get("title"), 80));
            output.put("description", ContentJson.text(item.get("description"), 320));
            output.put("ctaLabel", ContentJson.text(item.get("ctaLabel"), 40));
            output.put("ctaUrl", ContentJson.url(item.get("ctaUrl")));
            if (!required(output, "badge", "title", "description", "ctaLabel", "ctaUrl")
                || ContentJson.text(media.get("src"), 600).isEmpty()) continue;
            cards.add(output);
        }
        ObjectNode section3Output = mapper.createObjectNode();
        section3Output.put("badge", ContentJson.text(section3.get("badge"), 60));
        section3Output.put("title", ContentJson.text(section3.get("title"), 180));
        section3Output.put("description", ContentJson.text(section3.get("description"), 420));
        section3Output.put("ctaLabel", ContentJson.text(section3.get("ctaLabel"), 40));
        section3Output.put("ctaUrl", ContentJson.url(section3.get("ctaUrl")));
        section3Output.set("cards", cards);
        if (required(section3Output, "badge", "title", "description", "ctaLabel", "ctaUrl") && cards.size() >= 3) {
            result.set("section3", section3Output);
        }

        result.set("regionalPresence", publicRegionalPresence(source.get("regionalPresence")));
        result.set("trackingCta", publicTracking(source.get("trackingCta")));
        result.set("socialProof", publicSocialProof(source.get("socialProof")));
        result.set("quickActions", publicQuickActions(source.get("quickActions")));
        return result;
    }

    public ObjectNode publicServices(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        ArrayNode modules = mapper.createArrayNode();
        int index = 0;
        for (JsonNode itemValue : ordered(source.get("modules"))) {
            ObjectNode item = ContentJson.object(itemValue);
            ObjectNode image = ContentJson.object(item.get("image"));
            ObjectNode output = mapper.createObjectNode();
            output.put("id", id(item, "services-module-" + (++index)));
            output.put("order", ContentJson.integer(item.get("order"), index));
            ObjectNode publicImage = mapper.createObjectNode();
            publicImage.put("src", publicMedia(firstNonNull(image.get("src"), item.get("imageSrc")), "Mídia do conteúdo"));
            publicImage.put("alt", ContentJson.text(firstNonNull(image.get("alt"), item.get("imageAlt")), 160));
            publicImage.put("position", ContentJson.text(image.get("position"), 60));
            publicImage.set("presentation", MediaPresentation.normalize(
                mapper, image.get("presentation"), false, publicImage.path("position").asText()
            ));
            output.set("image", publicImage);
            output.put("eyebrow", ContentJson.text(item.get("eyebrow"), 80));
            output.put("title", ContentJson.text(item.get("title"), 180));
            output.put("description", ContentJson.text(item.get("description"), 260));
            ArrayNode details = mapper.createArrayNode();
            for (JsonNode detail : ContentJson.array(item.get("details"))) {
                if (details.size() == 3) break;
                String text = detail.isObject()
                    ? nullishText(ContentJson.object(detail), 120, "value", "text", "label")
                    : ContentJson.text(detail, 120);
                details.add(text);
            }
            output.set("details", details);
            output.put("ctaLabel", ContentJson.text(item.get("ctaLabel"), 40));
            output.put("ctaUrl", ContentJson.url(item.get("ctaUrl")));
            if (required(output, "eyebrow", "title", "description", "ctaLabel", "ctaUrl")
                && required(publicImage, "src", "alt") && details.size() == 3 && allText(details)) modules.add(output);
        }
        result.set("modules", modules.size() == 3 ? modules : mapper.createArrayNode());
        ObjectNode finalCta = ContentJson.object(source.get("finalCta"));
        ObjectNode finalOutput = mapper.createObjectNode();
        finalOutput.put("quoteUrl", ContentJson.url(finalCta.get("quoteUrl")));
        finalOutput.put("trackingUrl", ContentJson.url(finalCta.get("trackingUrl")));
        result.set("finalCta", finalOutput);
        ObjectNode faq = ContentJson.object(source.get("faq"));
        ObjectNode faqOutput = mapper.createObjectNode();
        faqOutput.put("title", ContentJson.text(faq.get("title"), 120));
        ArrayNode faqItems = mapper.createArrayNode();
        int faqIndex = 0;
        for (JsonNode itemValue : ordered(faq.get("items"))) {
            int currentFaqIndex = ++faqIndex;
            ObjectNode item = ContentJson.object(itemValue);
            String question = ContentJson.text(item.get("question"), 180);
            String answer = ContentJson.text(item.get("answer"), 320);
            if (question.isEmpty() || answer.isEmpty()) continue;
            ObjectNode output = mapper.createObjectNode();
            output.put("id", id(item, "services-faq-" + currentFaqIndex));
            output.put("order", ContentJson.integer(item.get("order"), currentFaqIndex));
            output.put("question", question);
            output.put("answer", answer);
            faqItems.add(output);
        }
        if (faqOutput.path("title").asText().isEmpty() || faqItems.isEmpty()) {
            faqOutput.put("title", "");
            faqItems.removeAll();
        }
        faqOutput.set("items", faqItems);
        result.set("faq", faqOutput);
        return result;
    }

    private ArrayNode publicUnits(JsonNode value) {
        ArrayNode units = mapper.createArrayNode();
        for (JsonNode itemValue : ordered(value)) {
            ObjectNode item = ContentJson.object(itemValue);
            if (falseBoolean(item, "active") || falseBoolean(item, "ativo")) continue;
            ObjectNode output = mapper.createObjectNode();
            output.put("id", nullableString(item.get("id")));
            output.put("name", nullishText(item, 120, "name", "nome"));
            output.put("type", nullishText(item, 40, "type", "tipo"));
            output.put("state", nullishText(item, 2, "state", "estado").toLowerCase(Locale.ROOT));
            output.put("city", nullishText(item, 80, "city", "cidade"));
            output.put("address", nullishText(item, 220, "address", "endereco"));
            output.put("phone", nullishText(item, 60, "phone", "telefone"));
            output.put("email", ContentJson.text(item.get("email"), 160));
            output.put("additionalEmail", ContentJson.text(item.get("additionalEmail"), 160));
            output.put("contactUrl", nullishUrl(item, "contactUrl", "linkContato"));
            output.put("description", nullishText(item, 220, "description", "descricao"));
            output.put("logisticsInfo", nullishText(item, 260, "logisticsInfo", "infoLogistica"));
            output.put("isDefault", truthy(firstNonNull(item.get("isDefault"), item.get("matriz"))));
            if (required(output, "id", "name", "state", "address")) units.add(output);
        }
        return units;
    }

    private ObjectNode publicHomeMedia(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        String src = publicMedia(source.get("src"), "Mídia do conteúdo");
        String explicit = ContentJson.text(source.get("type"), 20);
        String type = explicit.equals("video") || src.matches("(?i).*\\.(mp4|webm|ogg)$") ? "video" : "image";
        ObjectNode result = mapper.createObjectNode();
        result.put("type", type);
        result.put("src", src);
        result.put("alt", ContentJson.text(source.get("alt"), 140));
        result.put("poster", publicMedia(source.get("poster"), "Mídia do conteúdo"));
        result.put("desktopSrc", publicMedia(source.get("desktopSrc"), "Mídia do conteúdo"));
        result.put("mobileSrc", publicMedia(source.get("mobileSrc"), "Mídia do conteúdo"));
        result.set("presentation", MediaPresentation.normalize(
            mapper, source.get("presentation"), type.equals("video"), ""
        ));
        return result;
    }

    private ObjectNode publicRegionalPresence(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        ArrayNode units = mapper.createArrayNode();
        int index = 0;
        int considered = 0;
        for (JsonNode itemValue : ordered(source.get("units"))) {
            ObjectNode item = ContentJson.object(itemValue);
            if (falseBoolean(item, "active")) continue;
            if (considered++ == 24) break;
            ObjectNode output = mapper.createObjectNode();
            output.put("id", id(item, "home-regional-unit-" + (++index)));
            output.put("order", ContentJson.integer(item.get("order"), index));
            output.put("name", ContentJson.text(item.get("name"), 90));
            output.put("state", ContentJson.text(item.get("state"), 2).toUpperCase(Locale.ROOT));
            output.put("description", ContentJson.text(item.get("description"), 220));
            output.put("linkedUnitId", ContentJson.text(item.get("linkedUnitId"), 80));
            output.put("address", ContentJson.text(item.get("address"), 220));
            output.put("phone", ContentJson.text(item.get("phone"), 60));
            output.put("email", ContentJson.text(item.get("email"), 120));
            output.put("additionalEmail", ContentJson.text(item.get("additionalEmail"), 120));
            String label = ContentJson.text(item.get("buttonLabel"), 40);
            output.put("buttonLabel", label.isEmpty() ? "Falar com esta unidade" : label);
            output.put("contactUrl", ContentJson.url(item.get("contactUrl")));
            output.put("active", true);
            if (required(output, "name", "state", "description", "address", "contactUrl")) units.add(output);
        }
        result.set("units", units);
        return result;
    }

    private ObjectNode publicTracking(JsonNode value) {
        ObjectNode result = mapper.createObjectNode();
        ArrayNode fallback = ContentJson.array(emptyHome().path("trackingCta").path("buttons"));
        ArrayNode raw = ContentJson.array(ContentJson.object(value).get("buttons"));
        ArrayNode buttons = mapper.createArrayNode();
        for (int index = 0; index < 2; index++) {
            ObjectNode input = index < raw.size() ? ContentJson.object(raw.get(index)) : mapper.createObjectNode();
            ObjectNode defaultButton = ContentJson.object(fallback.get(index));
            ObjectNode button = mapper.createObjectNode();
            button.put("label", fallbackText(input, defaultButton, "label", 40));
            String url = ContentJson.url(input.get("url"));
            button.put("url", url.isEmpty() ? defaultButton.path("url").asText() : url);
            button.put("enabled", !input.has("enabled") || input.path("enabled").asBoolean());
            String color = ContentJson.hex(input.get("color"));
            button.put("color", color.isEmpty() ? defaultButton.path("color").asText() : color);
            JsonNode variant = firstNonNull(input.get("variant"), defaultButton.get("variant"));
            button.put("variant", variant != null && variant.isTextual() && "outline".equals(variant.asText())
                ? "outline" : "solid");
            buttons.add(button);
        }
        result.set("buttons", buttons);
        return result;
    }

    private ObjectNode publicSocialProof(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        String title = ContentJson.text(source.get("title"), 160);
        ArrayNode feedbacks = mapper.createArrayNode();
        int index = 0;
        for (JsonNode itemValue : ordered(source.get("feedbacks"))) {
            ObjectNode item = ContentJson.object(itemValue);
            if (falseBoolean(item, "active")) continue;
            ObjectNode output = mapper.createObjectNode();
            output.put("id", id(item, "home-feedback-" + (++index)));
            output.put("order", ContentJson.integer(item.get("order"), index));
            output.put("name", ContentJson.text(item.get("name"), 80));
            output.put("role", ContentJson.text(item.get("role"), 80));
            output.put("context", ContentJson.text(item.get("context"), 120));
            output.put("testimonial", ContentJson.text(item.get("testimonial"), 800));
            output.put("photo", publicMedia(item.get("photo"), "Mídia do conteúdo"));
            output.put("rating", Math.min(5, Math.max(1, ContentJson.integer(item.get("rating"), 5))));
            output.put("active", true);
            if (required(output, "name", "role", "context", "testimonial")) feedbacks.add(output);
        }
        if (!title.isEmpty() && !feedbacks.isEmpty()) {
            result.put("title", title);
            result.set("feedbacks", feedbacks);
        } else {
            result.put("title", "");
            result.set("feedbacks", mapper.createArrayNode());
        }
        return result;
    }

    private ArrayNode publicQuickActions(JsonNode value) {
        ArrayNode result = mapper.createArrayNode();
        int index = 0;
        for (JsonNode itemValue : ordered(value)) {
            if (result.size() == 12) break;
            ObjectNode item = ContentJson.object(itemValue);
            if (falseBoolean(item, "enabled")) continue;
            ObjectNode output = mapper.createObjectNode();
            output.put("id", id(item, "quick-action-" + (++index)));
            output.put("order", ContentJson.integer(item.get("order"), index));
            output.put("label", ContentJson.text(item.get("label"), 40));
            output.put("href", ContentJson.url(item.get("href")));
            output.put("icon", ContentJson.text(item.get("icon"), 40));
            String type = ContentJson.text(item.get("type"), 20);
            output.put("type", QUICK_ACTION_TYPES.contains(type) ? type : "link");
            output.put("enabled", true);
            output.put("downloadFile", ContentJson.url(item.get("downloadFile")));
            result.add(output);
        }
        return result;
    }

    private ArrayNode publicButtons(JsonNode value, int limit, boolean onlyEnabled) {
        ArrayNode result = mapper.createArrayNode();
        int count = 0;
        for (JsonNode itemValue : ContentJson.array(value)) {
            if (count++ == limit) break;
            ObjectNode item = ContentJson.object(itemValue);
            boolean enabled = item.path("enabled").asBoolean(false);
            String label = ContentJson.text(item.get("label"), 40);
            String url = ContentJson.url(item.get("url"));
            if (onlyEnabled && (!enabled || label.isEmpty() || url.isEmpty())) continue;
            ObjectNode output = mapper.createObjectNode();
            output.put("label", label);
            output.put("url", url);
            output.put("enabled", enabled);
            output.put("color", ContentJson.hex(item.get("color")));
            output.put("variant", "outline".equals(ContentJson.text(item.get("variant"), 20)) ? "outline" : "solid");
            result.add(output);
        }
        return result;
    }

    private ObjectNode emptyHome() {
        ObjectNode result = mapper.createObjectNode();
        result.set("hero", mapper.createObjectNode().set("slides", mapper.createArrayNode()));
        ObjectNode section1 = mapper.createObjectNode();
        section1.put("title", "").put("ctaLabel", "").put("ctaUrl", "").set("items", mapper.createArrayNode());
        result.set("section1", section1);
        ObjectNode section2 = mapper.createObjectNode();
        section2.put("title", "").set("items", mapper.createArrayNode());
        result.set("section2", section2);
        ObjectNode section3 = mapper.createObjectNode();
        section3.put("badge", "").put("title", "").put("description", "").put("ctaLabel", "").put("ctaUrl", "").set("cards", mapper.createArrayNode());
        result.set("section3", section3);
        result.set("regionalPresence", mapper.createObjectNode().set("units", mapper.createArrayNode()));
        ObjectNode tracking = mapper.createObjectNode();
        ArrayNode buttons = tracking.putArray("buttons");
        buttons.addObject().put("label", "Rastrear agora").put("url", "https://rodogarcia.eslcloud.com.br/recipient_tracking")
            .put("enabled", true).put("color", "#1d4ed8").put("variant", "solid");
        buttons.addObject().put("label", "Como consultar").put("url", "/central-ajuda")
            .put("enabled", true).put("color", "#ffffff").put("variant", "outline");
        result.set("trackingCta", tracking);
        ObjectNode social = mapper.createObjectNode();
        social.put("title", "").set("feedbacks", mapper.createArrayNode());
        result.set("socialProof", social);
        return result;
    }

    private List<JsonNode> ordered(JsonNode value) {
        List<JsonNode> result = new ArrayList<>();
        ContentJson.array(value).forEach(result::add);
        result.removeIf(item -> !item.isObject());
        result.sort(Comparator.comparingLong(item -> ContentJson.order(item.get("order"), 0)));
        return result;
    }

    private String publicMedia(JsonNode value, String label) {
        String normalized = mediaValidator.media(value, label);
        return normalized.startsWith("/public/") ? normalized.substring("/public".length()) : normalized;
    }

    private static String id(ObjectNode item, String fallback) {
        String value = ContentJson.text(item.get("id"), 200);
        return value.isEmpty() ? fallback : value;
    }

    private static boolean required(ObjectNode value, String... fields) {
        for (String field : fields) if (ContentJson.text(value.get(field), 2000).isEmpty()) return false;
        return true;
    }

    private static boolean allText(ArrayNode value) {
        for (JsonNode item : value) if (ContentJson.text(item, 1000).isEmpty()) return false;
        return true;
    }

    private static boolean falseBoolean(ObjectNode value, String key) {
        return value.has(key) && value.get(key).isBoolean() && !value.get(key).booleanValue();
    }

    private static JsonNode firstNonNull(JsonNode... values) {
        for (JsonNode value : values) {
            if (value != null && !value.isNull()) return value;
        }
        return null;
    }

    private static String nullishText(ObjectNode value, int maxLength, String... keys) {
        for (String key : keys) {
            JsonNode candidate = value.get(key);
            if (candidate != null && !candidate.isNull()) return ContentJson.text(candidate, maxLength);
        }
        return "";
    }

    private static String nullishUrl(ObjectNode value, String... keys) {
        for (String key : keys) {
            JsonNode candidate = value.get(key);
            if (candidate != null && !candidate.isNull()) return ContentJson.url(candidate);
        }
        return "";
    }

    private static String nullableString(JsonNode value) {
        return value == null || value.isNull() ? "" : value.asText();
    }

    private static boolean truthy(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) return false;
        if (value.isBoolean()) return value.booleanValue();
        if (value.isNumber()) return value.doubleValue() != 0 && !Double.isNaN(value.doubleValue());
        if (value.isTextual()) return !value.asText().isEmpty();
        return true;
    }

    private static String fallbackText(ObjectNode value, ObjectNode fallback, String key, int maxLength) {
        String candidate = ContentJson.text(value.get(key), maxLength);
        return candidate.isEmpty() ? ContentJson.text(fallback.get(key), maxLength) : candidate;
    }
}
