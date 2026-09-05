package br.com.rodogarcia.cms.backend.service.content;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.model.content.ContentKeys;
import br.com.rodogarcia.cms.backend.repository.content.ContentRepository;
import br.com.rodogarcia.cms.backend.repository.content.SiteTextsRepository;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@Service
public final class CmsContentService {
    private final JsonMapper mapper;
    private final ContentRepository contentRepository;
    private final SiteTextsRepository siteTextsRepository;
    private final HomeContentAdminService home;
    private final ServicesContentAdminService services;
    private final StructuredContentSanitizer sanitizer;
    private final ContentValidators validators;
    private final ContentMediaValidator mediaValidator;

    public CmsContentService(
        JsonMapper mapper,
        ContentRepository contentRepository,
        SiteTextsRepository siteTextsRepository,
        HomeContentAdminService home,
        ServicesContentAdminService services,
        StructuredContentSanitizer sanitizer,
        ContentValidators validators,
        ContentMediaValidator mediaValidator
    ) {
        this.mapper = mapper;
        this.contentRepository = contentRepository;
        this.siteTextsRepository = siteTextsRepository;
        this.home = home;
        this.services = services;
        this.sanitizer = sanitizer;
        this.validators = validators;
        this.mediaValidator = mediaValidator;
    }

    public ObjectNode content() {
        return contentRepository.read();
    }

    public ObjectNode home() {
        return home.normalize(contentRepository.read().get("homePage"));
    }

    public ObjectNode services() {
        return services.normalize(contentRepository.read().get("servicesPage"));
    }

    public ObjectNode page(String pageKey) {
        requirePage(pageKey);
        ObjectNode content = contentRepository.read();
        return sanitizer.page(pageKey, content.get(ContentKeys.PAGE_PROPERTIES.get(pageKey)));
    }

    public ObjectNode footer() {
        return sanitizer.footer(contentRepository.read().get("footerLinks"));
    }

    public ObjectNode navigation() {
        return sanitizer.navigation(contentRepository.read().get("headerNavigation"));
    }

    public ObjectNode siteTexts() {
        return siteTextsRepository.read();
    }

    public ObjectNode updateHome(String section, JsonNode body) {
        ObjectNode updated = contentRepository.update(content -> {
            content.set("homePage", home.replaceSection(content.get("homePage"), section, body));
            return content;
        });
        return home.normalize(updated.get("homePage"));
    }

    public ObjectNode updateServices(String section, JsonNode body) {
        ObjectNode updated = contentRepository.update(content -> {
            content.set("servicesPage", services.replaceSection(content.get("servicesPage"), section, body));
            return content;
        });
        return services.normalize(updated.get("servicesPage"));
    }

    public ObjectNode updatePage(String pageKey, String sectionKey, JsonNode bodyValue) {
        requirePage(pageKey);
        if (!ContentKeys.PAGE_SECTIONS.get(pageKey).contains(sectionKey)) {
            throw new ApiException(404, "Seção administrativa não encontrada.");
        }
        ObjectNode body = ContentJson.object(bodyValue);
        validators.page(pageKey, sectionKey, body);
        validateImageReferences(body);
        String property = ContentKeys.PAGE_PROPERTIES.get(pageKey);
        ObjectNode updated = contentRepository.update(content -> {
            ObjectNode current = sanitizer.page(pageKey, content.get(property));
            ObjectNode nextInput = current.deepCopy();
            applyPageSection(nextInput, pageKey, sectionKey, body);
            ObjectNode next = sanitizer.page(pageKey, nextInput);
            if (next == null) throw new ApiException(404, "Seção administrativa não encontrada.");
            content.set(property, next);
            return content;
        });
        return sanitizer.page(pageKey, updated.get(property));
    }

    public ObjectNode updateFooter(String sectionKey, JsonNode bodyValue) {
        if (!ContentKeys.FOOTER_SECTIONS.contains(sectionKey)) {
            throw new ApiException(404, "Seção FOOTER LINKS não encontrada.");
        }
        ObjectNode body = ContentJson.object(bodyValue);
        validators.footer(sectionKey, body);
        ObjectNode updated = contentRepository.update(content -> {
            ObjectNode current = sanitizer.footer(content.get("footerLinks"));
            current.set(sectionKey, body.deepCopy());
            content.set("footerLinks", sanitizer.footer(current));
            return content;
        });
        return sanitizer.footer(updated.get("footerLinks"));
    }

    public ObjectNode updateNavigation(JsonNode bodyValue) {
        ObjectNode body = ContentJson.object(bodyValue);
        validators.navigation(body);
        ObjectNode updated = contentRepository.update(content -> {
            content.set("headerNavigation", sanitizer.navigation(body));
            return content;
        });
        return sanitizer.navigation(updated.get("headerNavigation"));
    }

    public ObjectNode updateSiteTexts(JsonNode bodyValue) {
        ObjectNode body = ContentJson.object(bodyValue);
        return siteTextsRepository.update(current -> {
            body.properties().forEach(entry -> current.put(
                entry.getKey(),
                ContentJson.text(entry.getValue(), 500)
            ));
            return current;
        });
    }

    private void applyPageSection(
        ObjectNode page,
        String pageKey,
        String sectionKey,
        ObjectNode body
    ) {
        if (pageKey.equals("contact") && sectionKey.equals("hero")) {
            page.set("heroWhatsappButton", body.has("heroWhatsappButton")
                ? body.get("heroWhatsappButton").deepCopy() : body.deepCopy());
            return;
        }
        if ((pageKey.equals("contact") && sectionKey.equals("mainChannels"))
            || (pageKey.equals("careers") && sectionKey.equals("jobs"))
            || (pageKey.equals("quote") && (sectionKey.equals("directChannels") || sectionKey.equals("otherChannels")))) {
            page.set(sectionKey, body.has(sectionKey)
                ? body.get(sectionKey).deepCopy() : mapper.createArrayNode());
            return;
        }
        page.set(sectionKey, body.deepCopy());
    }

    private void validateImageReferences(JsonNode value) {
        if (value == null || value.isNull()) return;
        if (value.isArray()) {
            value.forEach(this::validateImageReferences);
            return;
        }
        if (!value.isObject()) return;
        if (value.has("alt") && !value.has("src")) {
            JsonNode mediaAlias = value.has("image") ? value.get("image") : value.get("url");
            if (mediaAlias != null && mediaAlias.isValueNode()) {
                mediaValidator.image(mediaAlias, "Conteúdo: imagem");
            }
        }
        value.properties().forEach(entry -> {
            String key = entry.getKey();
            JsonNode child = entry.getValue();
            if (child != null && child.isValueNode()
                && (key.equals("src") || key.equals("imageSrc") || key.equals("image")
                    || key.equals("photo") || key.equals("ogImage"))) {
                mediaValidator.image(child, "Conteúdo: imagem");
            } else {
                validateImageReferences(child);
            }
        });
    }

    private static void requirePage(String pageKey) {
        if (!ContentKeys.PAGE_KEYS.contains(pageKey)) {
            throw new ApiException(404, "Página administrativa não encontrada.");
        }
    }
}
