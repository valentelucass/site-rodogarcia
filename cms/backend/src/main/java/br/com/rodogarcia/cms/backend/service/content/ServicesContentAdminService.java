package br.com.rodogarcia.cms.backend.service.content;

import java.util.Set;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.model.content.ContentKeys;
import br.com.rodogarcia.cms.backend.model.content.MediaPresentation;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public final class ServicesContentAdminService {
    private static final Set<String> IMAGE_POSITIONS = Set.of(
        "object-top", "object-bottom", "object-left", "object-right", "object-[50%_45%]"
    );

    private final JsonMapper mapper;
    private final ContentMediaValidator mediaValidator;

    public ServicesContentAdminService(JsonMapper mapper, ContentMediaValidator mediaValidator) {
        this.mapper = mapper;
        this.mediaValidator = mediaValidator;
    }

    public ObjectNode normalize(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        result.set("modules", modules(source.get("modules")));
        result.set("finalCta", finalCta(source.get("finalCta")));
        result.set("faq", faq(source.get("faq")));
        return result;
    }

    public ObjectNode replaceSection(JsonNode currentValue, String section, JsonNode payloadValue) {
        if (!ContentKeys.SERVICES_SECTIONS.contains(section)) {
            throw new ApiException(404, "Seção da página Serviços não encontrada.");
        }
        ObjectNode current = normalize(currentValue);
        ObjectNode payload = ContentJson.object(payloadValue);
        switch (section) {
            case "modules" -> current.set("modules", modules(payload.get("modules")));
            case "finalCta" -> current.set("finalCta", finalCta(payload));
            case "faq" -> current.set("faq", faq(payload));
            default -> throw new ApiException(404, "Seção da página Serviços não encontrada.");
        }
        validate(section, current);
        return current;
    }

    private ArrayNode modules(JsonNode value) {
        ArrayNode result = mapper.createArrayNode();
        int index = 0;
        for (JsonNode raw : ContentJson.array(value)) {
            ObjectNode source = ContentJson.object(raw);
            ObjectNode rawImage = ContentJson.object(source.get("image"));
            ObjectNode image = mapper.createObjectNode();
            JsonNode srcInput = rawImage.has("src") ? rawImage.get("src") : source.get("imageSrc");
            image.put("src", mediaValidator.image(srcInput, "Serviços: imagem"));
            image.put("alt", firstText(rawImage, 160, "alt", source, "imageAlt"));
            String position = ContentJson.text(rawImage.get("position"), 60);
            image.put("position", IMAGE_POSITIONS.contains(position) ? position : "");
            image.set("presentation", MediaPresentation.normalize(
                mapper, rawImage.get("presentation"), false, image.path("position").asString()
            ));

            ObjectNode item = mapper.createObjectNode();
            item.put("id", textOr(source.get("id"), 80, "services-module-" + (index + 1)));
            item.put("order", ++index);
            item.set("image", image);
            item.put("eyebrow", ContentJson.text(source.get("eyebrow"), 80));
            item.put("title", ContentJson.text(source.get("title"), 180));
            item.put("description", ContentJson.text(source.get("description"), 260));
            ArrayNode details = mapper.createArrayNode();
            ArrayNode rawDetails = ContentJson.array(source.get("details"));
            for (int detailIndex = 0; detailIndex < 3; detailIndex++) {
                String detail = "";
                if (detailIndex < rawDetails.size()) {
                    JsonNode rawDetail = rawDetails.get(detailIndex);
                    if (rawDetail.isObject()) {
                        ObjectNode record = ContentJson.object(rawDetail);
                        detail = firstText(record, 120, "value", record, "text");
                        if (detail.isEmpty()) detail = ContentJson.text(record.get("label"), 120);
                    } else {
                        detail = ContentJson.text(rawDetail, 120);
                    }
                }
                details.add(detail);
            }
            item.set("details", details);
            item.put("ctaLabel", ContentJson.text(source.get("ctaLabel"), 40));
            item.put("ctaUrl", ContentJson.url(source.get("ctaUrl")));
            result.add(item);
        }
        return result;
    }

    private ObjectNode finalCta(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        result.put("quoteUrl", ContentJson.url(source.get("quoteUrl")));
        result.put("trackingUrl", ContentJson.url(source.get("trackingUrl")));
        return result;
    }

    private ObjectNode faq(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ObjectNode result = mapper.createObjectNode();
        result.put("title", ContentJson.text(source.get("title"), 120));
        ArrayNode items = mapper.createArrayNode();
        int index = 0;
        for (JsonNode raw : ContentJson.array(source.get("items"))) {
            ObjectNode input = ContentJson.object(raw);
            ObjectNode item = mapper.createObjectNode();
            item.put("id", textOr(input.get("id"), 80, "services-faq-" + (index + 1)));
            item.put("order", ++index);
            item.put("question", ContentJson.text(input.get("question"), 180));
            item.put("answer", ContentJson.text(input.get("answer"), 320));
            items.add(item);
        }
        result.set("items", items);
        return result;
    }

    private void validate(String section, ObjectNode page) {
        if (section.equals("modules")) {
            ArrayNode modules = ContentJson.array(page.get("modules"));
            if (modules.size() != 3) throw new ApiException(422, "Serviços: a seção de módulos deve ter exatamente 3 cards.");
            for (JsonNode raw : modules) {
                ObjectNode module = ContentJson.object(raw);
                String prefix = "Modulo " + module.path("order").asInt();
                ObjectNode image = ContentJson.object(module.get("image"));
                if (!hasText(image, "src") || !hasText(image, "alt")) {
                    throw new ApiException(422, prefix + ": imagem e texto alternativo são obrigatórios.");
                }
                if (!hasText(module, "eyebrow") || !hasText(module, "title") || !hasText(module, "description")
                    || !hasText(module, "ctaLabel") || !hasText(module, "ctaUrl")) {
                    throw new ApiException(422, prefix + ": tag, título, descrição, texto do botão e link são obrigatórios.");
                }
                ArrayNode details = ContentJson.array(module.get("details"));
                if (details.size() != 3 || hasBlank(details)) {
                    throw new ApiException(422, prefix + ": informe exatamente 3 tópicos.");
                }
            }
            return;
        }
        if (section.equals("finalCta")) {
            ObjectNode cta = ContentJson.object(page.get("finalCta"));
            if (!hasText(cta, "quoteUrl") || !hasText(cta, "trackingUrl")) {
                throw new ApiException(422, "CTA final: os links de cotação e rastreio são obrigatórios.");
            }
            return;
        }
        ObjectNode faq = ContentJson.object(page.get("faq"));
        if (!hasText(faq, "title")) throw new ApiException(422, "FAQ: título principal obrigatório.");
        ArrayNode items = ContentJson.array(faq.get("items"));
        if (items.size() != 5) throw new ApiException(422, "FAQ: a lista deve manter exatamente 5 perguntas.");
        for (JsonNode raw : items) {
            ObjectNode item = ContentJson.object(raw);
            if (!hasText(item, "question") || !hasText(item, "answer")) {
                throw new ApiException(422, "FAQ: pergunta e resposta são obrigatórias em todos os itens.");
            }
        }
    }

    private static boolean hasBlank(ArrayNode value) {
        for (JsonNode item : value) if (ContentJson.text(item, 120).isEmpty()) return true;
        return false;
    }

    private static boolean hasText(ObjectNode value, String key) {
        return !ContentJson.text(value.get(key), 2000).isEmpty();
    }

    private static String textOr(JsonNode value, int limit, String fallback) {
        String text = ContentJson.text(value, limit);
        return text.isEmpty() ? fallback : text;
    }

    private static String firstText(ObjectNode first, int limit, String firstKey, ObjectNode second, String secondKey) {
        String value = ContentJson.text(first.get(firstKey), limit);
        return value.isEmpty() ? ContentJson.text(second.get(secondKey), limit) : value;
    }
}
