package br.com.rodogarcia.cms.backend.service.content;

import java.util.Set;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentDefaults;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.model.content.ContentKeys;
import br.com.rodogarcia.cms.backend.model.content.MediaPresentation;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public final class HomeContentAdminService {
    private static final Set<String> MODES = Set.of("media-only", "text-media", "text-media-buttons");
    private static final Set<String> QUICK_TYPES = Set.of("link", "external", "download", "modal");
    private static final Set<String> QUICK_ICONS = Set.of(
        "FilePdf", "Calculator", "MagnifyingGlass", "Truck", "MapPin", "WhatsappLogo",
        "Phone", "Envelope", "ChatCircleDots", "Headset", "Package", "Handshake",
        "FileText", "ArrowSquareOut"
    );
    private static final Set<String> UFS = Set.of(
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
        "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
    );

    private final JsonMapper mapper;
    private final ContentMediaValidator mediaValidator;

    public HomeContentAdminService(JsonMapper mapper, ContentMediaValidator mediaValidator) {
        this.mapper = mapper;
        this.mediaValidator = mediaValidator;
    }

    public ObjectNode normalize(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = emptyHome();
        result.set("hero", hero(source.get("hero")));
        result.set("section1", section1(source.get("section1")));
        result.set("section2", section2(source.get("section2")));
        result.set("section3", section3(source.get("section3")));
        result.set("regionalPresence", regionalPresence(source.get("regionalPresence")));
        result.set("trackingCta", trackingCta(source.get("trackingCta")));
        result.set("socialProof", socialProof(source.get("socialProof")));
        result.set("quickActions", quickActions(source.get("quickActions")));
        return result;
    }

    public ObjectNode replaceSection(JsonNode currentValue, String section, JsonNode payloadValue) {
        if (!ContentKeys.HOME_SECTIONS.contains(section)) {
            throw new ApiException(404, "Seção da Home não encontrada.");
        }
        ObjectNode current = normalize(currentValue);
        ObjectNode payload = ContentJson.object(payloadValue);
        switch (section) {
            case "hero" -> current.set("hero", hero(payload));
            case "section1" -> current.set("section1", section1(payload));
            case "section2" -> current.set("section2", section2(payload));
            case "section3" -> current.set("section3", section3(payload));
            case "regionalPresence" -> current.set("regionalPresence", regionalPresence(payload));
            case "trackingCta" -> current.set("trackingCta", trackingCta(payload));
            case "socialProof" -> current.set("socialProof", socialProof(payload));
            case "quickActions" -> current.set(
                "quickActions",
                payload.has("quickActions") && payload.get("quickActions").isArray()
                    ? quickActions(payload.get("quickActions"))
                    : mapper.createArrayNode()
            );
            default -> throw new ApiException(404, "Seção da Home não encontrada.");
        }
        validate(section, current);
        return current;
    }

    private ObjectNode emptyHome() {
        ObjectNode result = mapper.createObjectNode();
        ObjectNode hero = mapper.createObjectNode();
        hero.set("slides", mapper.createArrayNode());
        result.set("hero", hero);
        ObjectNode section1 = mapper.createObjectNode();
        section1.put("title", "");
        section1.put("ctaLabel", "");
        section1.put("ctaUrl", "");
        section1.set("items", mapper.createArrayNode());
        result.set("section1", section1);
        ObjectNode section2 = mapper.createObjectNode();
        section2.put("title", "");
        section2.set("items", mapper.createArrayNode());
        result.set("section2", section2);
        ObjectNode section3 = mapper.createObjectNode();
        section3.put("badge", "");
        section3.put("title", "");
        section3.put("description", "");
        section3.put("ctaLabel", "");
        section3.put("ctaUrl", "");
        section3.set("cards", mapper.createArrayNode());
        result.set("section3", section3);
        ObjectNode presence = mapper.createObjectNode();
        presence.set("units", mapper.createArrayNode());
        result.set("regionalPresence", presence);
        result.set("trackingCta", defaultTracking());
        ObjectNode social = mapper.createObjectNode();
        social.put("title", "");
        social.set("feedbacks", mapper.createArrayNode());
        result.set("socialProof", social);
        result.set("quickActions", ContentDefaults.home(mapper).path("quickActions").deepCopy());
        return result;
    }

    private ObjectNode hero(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ArrayNode resultItems = mapper.createArrayNode();
        int count = 0;
        for (JsonNode raw : ContentJson.array(source.get("slides"))) {
            if (count == 20) break;
            ObjectNode input = ContentJson.object(raw);
            ObjectNode item = mapper.createObjectNode();
            item.put("id", textOrId(input.get("id"), "home_hero"));
            item.put("order", ++count);
            item.put("title", ContentJson.text(input.get("title"), 120));
            item.put("description", ContentJson.text(input.get("description"), 420));
            item.set("media", media(input.get("media")));
            item.put("active", ContentJson.strictBoolean(input.get("active"), true));
            String mode = ContentJson.text(input.get("mode"), 40);
            item.put("mode", MODES.contains(mode) ? mode : "text-media-buttons");
            item.set("buttons", mode.equals("media-only") || mode.equals("text-media")
                ? mapper.createArrayNode() : buttons(input.get("buttons")));
            resultItems.add(item);
        }
        ObjectNode result = mapper.createObjectNode();
        result.set("slides", resultItems);
        return result;
    }

    private ObjectNode section1(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        result.put("title", ContentJson.text(source.get("title"), 140));
        result.put("ctaLabel", ContentJson.text(source.get("ctaLabel"), 40));
        result.put("ctaUrl", ContentJson.url(source.get("ctaUrl")));
        ArrayNode items = mapper.createArrayNode();
        int index = 0;
        for (JsonNode raw : ContentJson.array(source.get("items"))) {
            ObjectNode input = ContentJson.object(raw);
            ObjectNode item = mapper.createObjectNode();
            item.put("id", textOr(input.get("id"), 80, "section1-" + (index + 1)));
            item.put("order", ++index);
            item.put("title", ContentJson.text(input.get("title"), 60));
            item.put("description", ContentJson.text(input.get("description"), 180));
            item.set("media", media(input.get("media")));
            items.add(item);
        }
        result.set("items", items);
        return result;
    }

    private ObjectNode section2(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        result.put("title", ContentJson.text(source.get("title"), 160));
        ArrayNode items = mapper.createArrayNode();
        int index = 0;
        for (JsonNode raw : ContentJson.array(source.get("items"))) {
            ObjectNode input = ContentJson.object(raw);
            ObjectNode item = mapper.createObjectNode();
            item.put("id", textOr(input.get("id"), 80, "section2-" + (index + 1)));
            item.put("order", ++index);
            item.put("title", ContentJson.text(input.get("title"), 120));
            item.put("description", ContentJson.text(input.get("description"), 260));
            item.set("media", media(input.get("media")));
            item.put("active", ContentJson.strictBoolean(input.get("active"), true));
            items.add(item);
        }
        result.set("items", items);
        return result;
    }

    private ObjectNode section3(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        result.put("badge", ContentJson.text(source.get("badge"), 60));
        result.put("title", ContentJson.text(source.get("title"), 180));
        result.put("description", ContentJson.text(source.get("description"), 420));
        result.put("ctaLabel", ContentJson.text(source.get("ctaLabel"), 40));
        result.put("ctaUrl", ContentJson.url(source.get("ctaUrl")));
        ArrayNode cards = mapper.createArrayNode();
        int index = 0;
        for (JsonNode raw : ContentJson.array(source.get("cards"))) {
            ObjectNode input = ContentJson.object(raw);
            ObjectNode item = mapper.createObjectNode();
            item.put("id", textOr(input.get("id"), 80, "section3-card-" + (index + 1)));
            item.put("order", ++index);
            item.set("media", media(input.get("media")));
            item.put("badge", ContentJson.text(input.get("badge"), 60));
            item.put("title", ContentJson.text(input.get("title"), 80));
            item.put("description", ContentJson.text(input.get("description"), 320));
            item.put("ctaLabel", ContentJson.text(input.get("ctaLabel"), 40));
            item.put("ctaUrl", ContentJson.url(input.get("ctaUrl")));
            cards.add(item);
        }
        result.set("cards", cards);
        return result;
    }

    private ObjectNode regionalPresence(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ArrayNode units = mapper.createArrayNode();
        int index = 0;
        for (JsonNode raw : ContentJson.array(source.get("units"))) {
            if (index == 24) break;
            ObjectNode input = ContentJson.object(raw);
            ObjectNode unit = mapper.createObjectNode();
            unit.put("id", textOrId(input.get("id"), "home_unit"));
            unit.put("order", ++index);
            unit.put("name", ContentJson.text(input.get("name"), 90));
            unit.put("state", uf(input.get("state")));
            unit.put("description", ContentJson.text(input.get("description"), 220));
            unit.put("linkedUnitId", ContentJson.text(input.get("linkedUnitId"), 80));
            unit.put("address", ContentJson.text(input.get("address"), 220));
            unit.put("phone", ContentJson.text(input.get("phone"), 60));
            unit.put("email", ContentJson.email(input.get("email")));
            unit.put("additionalEmail", ContentJson.email(input.get("additionalEmail")));
            String buttonLabel = ContentJson.text(input.get("buttonLabel"), 40);
            unit.put("buttonLabel", buttonLabel.isEmpty() ? "Falar com esta unidade" : buttonLabel);
            unit.put("contactUrl", ContentJson.url(input.get("contactUrl")));
            unit.put("active", ContentJson.strictBoolean(input.get("active"), true));
            units.add(unit);
        }
        ObjectNode result = mapper.createObjectNode();
        result.set("units", units);
        return result;
    }

    private ObjectNode trackingCta(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ArrayNode fallback = (ArrayNode) defaultTracking().get("buttons");
        ArrayNode sourceButtons = ContentJson.array(source.get("buttons"));
        ArrayNode buttons = mapper.createArrayNode();
        for (int index = 0; index < 2; index++) {
            ObjectNode defaultButton = ContentJson.object(fallback.get(index));
            if (index >= sourceButtons.size()) {
                buttons.add(defaultButton.deepCopy());
                continue;
            }
            ObjectNode input = ContentJson.object(sourceButtons.get(index));
            ObjectNode button = mapper.createObjectNode();
            button.put("label", textOr(input.get("label"), 40, defaultButton.path("label").asString()));
            String url = ContentJson.url(input.get("url"));
            button.put("url", url.isEmpty() ? defaultButton.path("url").asString() : url);
            button.put("enabled", ContentJson.strictBoolean(input.get("enabled"), true));
            String color = ContentJson.hex(input.get("color"));
            button.put("color", color.isEmpty() ? defaultButton.path("color").asString("#1d4ed8") : color);
            button.put("variant", "outline".equals(ContentJson.text(input.get("variant"), 20)) ? "outline" : "solid");
            buttons.add(button);
        }
        ObjectNode result = mapper.createObjectNode();
        result.set("buttons", buttons);
        return result;
    }

    private ObjectNode socialProof(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        result.put("title", ContentJson.text(source.get("title"), 160));
        ArrayNode feedbacks = mapper.createArrayNode();
        int index = 0;
        for (JsonNode raw : ContentJson.array(source.get("feedbacks"))) {
            ObjectNode input = ContentJson.object(raw);
            ObjectNode feedback = mapper.createObjectNode();
            feedback.put("id", textOrId(input.get("id"), "home_feedback"));
            feedback.put("order", ++index);
            feedback.put("name", ContentJson.text(input.get("name"), 80));
            feedback.put("role", ContentJson.text(input.get("role"), 80));
            feedback.put("context", ContentJson.text(input.get("context"), 120));
            feedback.put("testimonial", ContentJson.text(input.get("testimonial"), 800));
            feedback.put("photo", mediaValidator.image(input.get("photo"), "Prova social: foto"));
            double rawRating = input.has("rating") && input.get("rating").isNumber()
                ? input.get("rating").doubleValue() : 5;
            feedback.put("rating", Math.max(1, Math.min(5, (int) Math.round(rawRating))));
            feedback.put("active", ContentJson.strictBoolean(input.get("active"), true));
            feedbacks.add(feedback);
        }
        result.set("feedbacks", feedbacks);
        return result;
    }

    private ArrayNode quickActions(JsonNode value) {
        ArrayNode result = mapper.createArrayNode();
        int index = 0;
        for (JsonNode raw : ContentJson.array(value)) {
            if (index == 12) break;
            ObjectNode input = ContentJson.object(raw);
            ObjectNode action = mapper.createObjectNode();
            action.put("id", textOrId(input.get("id"), "quick_action"));
            action.put("order", ++index);
            action.put("label", ContentJson.text(input.get("label"), 40));
            String type = ContentJson.text(input.get("type"), 20);
            type = QUICK_TYPES.contains(type) ? type : "link";
            String href = ContentJson.url(input.get("href"));
            action.put("href", type.equals("modal") && !href.startsWith("#") ? "" : href);
            action.put("icon", ContentJson.text(input.get("icon"), 40));
            action.put("type", type);
            action.put("enabled", ContentJson.strictBoolean(input.get("enabled"), true));
            action.put("downloadFile", ContentJson.url(input.get("downloadFile")));
            result.add(action);
        }
        return result;
    }

    private ArrayNode buttons(JsonNode value) {
        ArrayNode result = mapper.createArrayNode();
        int index = 0;
        for (JsonNode raw : ContentJson.array(value)) {
            if (index++ == 2) break;
            ObjectNode input = ContentJson.object(raw);
            ObjectNode button = mapper.createObjectNode();
            button.put("label", ContentJson.text(input.get("label"), 40));
            button.put("url", ContentJson.url(input.get("url")));
            button.put("enabled", ContentJson.strictBoolean(input.get("enabled"), true));
            button.put("color", ContentJson.hex(input.get("color")));
            button.put("variant", "outline".equals(ContentJson.text(input.get("variant"), 20)) ? "outline" : "solid");
            result.add(button);
        }
        return result;
    }

    private ObjectNode media(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        String explicitType = ContentJson.text(source.get("type"), 20);
        String src = switch (explicitType) {
            case "video" -> mediaValidator.video(source.get("src"), "Mídia: vídeo");
            case "image" -> mediaValidator.image(source.get("src"), "Mídia: imagem");
            default -> mediaValidator.media(source.get("src"), "Mídia");
        };
        boolean video = explicitType.equals("video") || (!explicitType.equals("image") && src.matches("(?i).*\\.(mp4|webm|ogg)$"));
        ObjectNode result = mapper.createObjectNode();
        result.put("type", video ? "video" : "image");
        result.put("src", src);
        result.put("alt", ContentJson.text(source.get("alt"), 140));
        result.put("poster", mediaValidator.image(source.get("poster"), "Mídia: poster"));
        result.put("desktopSrc", video
            ? mediaValidator.video(source.get("desktopSrc"), "Mídia: vídeo desktop")
            : mediaValidator.image(source.get("desktopSrc"), "Mídia: imagem desktop"));
        result.put("mobileSrc", video
            ? mediaValidator.video(source.get("mobileSrc"), "Mídia: vídeo mobile")
            : mediaValidator.image(source.get("mobileSrc"), "Mídia: imagem mobile"));
        result.set("presentation", MediaPresentation.normalize(
            mapper, source.get("presentation"), video, ""
        ));
        return result;
    }

    private ObjectNode defaultTracking() {
        ObjectNode result = mapper.createObjectNode();
        ArrayNode buttons = result.putArray("buttons");
        buttons.addObject().put("label", "Rastrear agora")
            .put("url", "https://rodogarcia.eslcloud.com.br/recipient_tracking")
            .put("enabled", true).put("color", "#1d4ed8").put("variant", "solid");
        buttons.addObject().put("label", "Como consultar").put("url", "/central-ajuda")
            .put("enabled", true).put("color", "#ffffff").put("variant", "outline");
        return result;
    }

    private void validate(String section, ObjectNode home) {
        switch (section) {
            case "hero" -> validateHero(ContentJson.object(home.get("hero")));
            case "section1" -> validateSection1(ContentJson.object(home.get("section1")));
            case "section2" -> validateSection2(ContentJson.object(home.get("section2")));
            case "section3" -> validateSection3(ContentJson.object(home.get("section3")));
            case "regionalPresence" -> validateRegional(ContentJson.object(home.get("regionalPresence")));
            case "trackingCta" -> validateTracking(ContentJson.object(home.get("trackingCta")));
            case "socialProof" -> validateSocial(ContentJson.object(home.get("socialProof")));
            case "quickActions" -> validateQuick(ContentJson.array(home.get("quickActions")));
            default -> throw new ApiException(404, "Seção da Home não encontrada.");
        }
    }

    private void validateHero(ObjectNode hero) {
        for (JsonNode raw : ContentJson.array(hero.get("slides"))) {
            ObjectNode slide = ContentJson.object(raw);
            String prefix = "Hero " + slide.path("order").asInt();
            validateMedia(ContentJson.object(slide.get("media")), prefix);
            String mode = slide.path("mode").asString();
            if (!mode.equals("media-only") && (!hasText(slide, "title") || !hasText(slide, "description"))) {
                throw new ApiException(422, prefix + ": título e descrição são obrigatórios neste modo.");
            }
            if (mode.equals("text-media-buttons")) {
                boolean hasEnabled = false;
                for (JsonNode rawButton : ContentJson.array(slide.get("buttons"))) {
                    ObjectNode button = ContentJson.object(rawButton);
                    if (button.path("enabled").asBoolean(false) && hasText(button, "label") && hasText(button, "url")) {
                        hasEnabled = true;
                    }
                }
                if (!hasEnabled) throw new ApiException(422, prefix + ": informe ao menos um botão ativo com texto e link.");
            }
        }
    }

    private void validateSection1(ObjectNode section) {
        if (!hasText(section, "title") || !hasText(section, "ctaLabel") || !hasText(section, "ctaUrl")) {
            throw new ApiException(422, "Seção 1: título, texto do botão e link são obrigatórios.");
        }
        ArrayNode items = ContentJson.array(section.get("items"));
        if (items.size() != 3) throw new ApiException(422, "Seção 1 deve ter exatamente 3 itens.");
        for (JsonNode raw : items) {
            ObjectNode item = ContentJson.object(raw);
            if (!hasText(item, "title") || !hasText(item, "description")) {
                throw new ApiException(422, "Seção 1: título e descrição dos 3 itens são obrigatórios.");
            }
            if (wordCount(item.path("title").asString()) > 5) {
                throw new ApiException(422, "Seção 1: cada título deve ter no máximo 5 palavras.");
            }
            validateMedia(ContentJson.object(item.get("media")), "Seção 1 item " + item.path("order").asInt());
        }
    }

    private void validateSection2(ObjectNode section) {
        if (!hasText(section, "title")) throw new ApiException(422, "Seção 2: título principal obrigatório.");
        ArrayNode items = ContentJson.array(section.get("items"));
        if (items.size() > 5) throw new ApiException(422, "Seção 2 permite no máximo 5 itens.");
        for (JsonNode raw : items) {
            ObjectNode item = ContentJson.object(raw);
            if (!hasText(item, "title") || !hasText(item, "description")) {
                throw new ApiException(422, "Seção 2: título e descrição de cada item são obrigatórios.");
            }
            validateMedia(ContentJson.object(item.get("media")), "Seção 2 item " + item.path("order").asInt());
        }
    }

    private void validateSection3(ObjectNode section) {
        if (!hasText(section, "badge") || !hasText(section, "title") || !hasText(section, "description")
            || !hasText(section, "ctaLabel") || !hasText(section, "ctaUrl")) {
            throw new ApiException(422, "Seção 3: badge, título, descrição, botão e link são obrigatórios.");
        }
        ArrayNode cards = ContentJson.array(section.get("cards"));
        if (cards.size() < 3) throw new ApiException(422, "Seção 3 deve ter pelo menos 3 cards.");
        for (JsonNode raw : cards) {
            ObjectNode card = ContentJson.object(raw);
            if (!hasText(card, "badge") || !hasText(card, "title") || !hasText(card, "description")
                || !hasText(card, "ctaLabel") || !hasText(card, "ctaUrl")) {
                throw new ApiException(422, "Seção 3: todos os campos dos cards são obrigatórios.");
            }
            if (wordCount(card.path("title").asString()) > 2) {
                throw new ApiException(422, "Seção 3: título de cada card deve ter no máximo 2 palavras.");
            }
            validateMedia(ContentJson.object(card.get("media")), "Seção 3 card " + card.path("order").asInt());
        }
    }

    private void validateRegional(ObjectNode section) {
        for (JsonNode raw : ContentJson.array(section.get("units"))) {
            ObjectNode unit = ContentJson.object(raw);
            if (!unit.path("active").asBoolean(true)) continue;
            if (!hasText(unit, "name") || !hasText(unit, "state") || !hasText(unit, "description")
                || !hasText(unit, "address") || !hasText(unit, "contactUrl") || !hasText(unit, "additionalEmail")) {
                throw new ApiException(422, "Presença Regional: nome, UF, descrição, endereço, e-mail adicional e link do botão são obrigatórios em unidades ativas.");
            }
            if (!UFS.contains(unit.path("state").asString())) {
                throw new ApiException(422, "Presença Regional: selecione uma UF válida.");
            }
        }
    }

    private void validateTracking(ObjectNode section) {
        ArrayNode buttons = ContentJson.array(section.get("buttons"));
        if (buttons.size() != 2) throw new ApiException(422, "Rastreio: informe os dois botões.");
        for (JsonNode raw : buttons) {
            ObjectNode button = ContentJson.object(raw);
            if (button.path("enabled").asBoolean(true) && (!hasText(button, "label") || !hasText(button, "url"))) {
                throw new ApiException(422, "Rastreio: texto e link dos botões ativos são obrigatórios.");
            }
        }
    }

    private void validateSocial(ObjectNode section) {
        if (!hasText(section, "title")) throw new ApiException(422, "Prova Social: título principal obrigatório.");
        for (JsonNode raw : ContentJson.array(section.get("feedbacks"))) {
            ObjectNode item = ContentJson.object(raw);
            if (!hasText(item, "name") || !hasText(item, "role") || !hasText(item, "context") || !hasText(item, "testimonial")) {
                throw new ApiException(422, "Prova Social: nome, cargo, contexto da operação e depoimento são obrigatórios.");
            }
        }
    }

    private void validateQuick(ArrayNode actions) {
        int index = 0;
        for (JsonNode raw : actions) {
            ObjectNode action = ContentJson.object(raw);
            String prefix = "Atalho " + (++index);
            if (!hasText(action, "label") || !QUICK_ICONS.contains(action.path("icon").asString())) {
                throw new ApiException(422, prefix + ": texto e ícone válido são obrigatórios.");
            }
            if (!action.path("enabled").asBoolean(true)) continue;
            String type = action.path("type").asString("link");
            String target = type.equals("download")
                ? textOr(action.get("downloadFile"), 600, action.path("href").asString())
                : action.path("href").asString();
            if (target.isEmpty()) throw new ApiException(422, prefix + ": informe um destino ou desative o atalho.");
            if (type.equals("modal") && !target.startsWith("#")) throw new ApiException(422, prefix + ": ações de âncora devem usar um destino iniciado por #.");
            if (type.equals("external") && !target.matches("(?i)^(?:https?:|mailto:|tel:).*$")) throw new ApiException(422, prefix + ": links externos devem usar HTTP(S), mailto: ou tel:.");
            if (type.equals("link") && !target.startsWith("/")) throw new ApiException(422, prefix + ": links internos devem começar com /.");
        }
    }

    private void validateMedia(ObjectNode media, String label) {
        if (!hasText(media, "src")) throw new ApiException(422, label + ": mídia obrigatória.");
        if (media.path("type").asString().equals("video") && !media.path("src").asString().matches("(?i).*\\.(mp4|webm|ogg)$")) {
            throw new ApiException(422, label + ": vídeo deve usar MP4, WebM ou Ogg.");
        }
        if (media.path("type").asString().equals("video")) validateVideoPlayback(media, label);
    }

    private void validateVideoPlayback(ObjectNode media, String label) {
        ObjectNode presentation = ContentJson.object(media.get("presentation"));
        ObjectNode desktop = ContentJson.object(presentation.get("desktop"));
        String desktopSource = firstNonEmpty(media.path("desktopSrc").asString(), media.path("src").asString());
        validatePlayback(desktop, desktopSource, label + " (desktop)");

        String mobileSource = firstNonEmpty(media.path("mobileSrc").asString(), desktopSource);
        ObjectNode mobile = presentation.path("mobile").isObject()
            ? ContentJson.object(presentation.get("mobile")) : desktop;
        validatePlayback(mobile, mobileSource, label + " (celular)");
    }

    private void validatePlayback(ObjectNode placement, String source, String label) {
        ObjectNode playback = ContentJson.object(placement.get("playback"));
        double start = playback.path("startSeconds").asDouble(0D);
        boolean hasDuration = playback.has("durationSeconds") && playback.path("durationSeconds").isNumber();
        if (start <= 0D && !hasDuration) return;

        var duration = mediaValidator.videoDuration(source);
        if (duration.isEmpty()) {
            throw new ApiException(422, label + ": não foi possível confirmar a duração deste vídeo para salvar o trecho.");
        }
        double total = duration.getAsDouble();
        if (start >= total) {
            throw new ApiException(422, label + ": o início do trecho precisa ficar antes do fim do vídeo.");
        }
        if (hasDuration && start + playback.path("durationSeconds").asDouble() > total + 0.05D) {
            throw new ApiException(422, label + ": o fim do trecho ultrapassa a duração do vídeo.");
        }
    }

    private static String firstNonEmpty(String primary, String fallback) {
        return primary == null || primary.isBlank() ? fallback : primary;
    }

    private static boolean hasText(ObjectNode value, String key) {
        return !ContentJson.text(value.get(key), 2000).isEmpty();
    }

    private static int wordCount(String value) {
        return value.isBlank() ? 0 : value.trim().split("\\s+").length;
    }

    private static String uf(JsonNode value) {
        String raw = ContentJson.text(value, 2).toUpperCase().replaceAll("[^A-Z]", "");
        return UFS.contains(raw) ? raw : "";
    }

    private static String textOr(JsonNode value, int limit, String fallback) {
        String text = ContentJson.text(value, limit);
        return text.isEmpty() ? fallback : text;
    }

    private static String textOrId(JsonNode value, String prefix) {
        String id = ContentJson.text(value, 80);
        return id.isEmpty() ? ContentJson.newId(prefix) : id;
    }
}
