package br.com.rodogarcia.cms.backend.service.content;

import java.time.Clock;
import java.util.List;
import java.util.Map;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.model.content.ContentTime;
import br.com.rodogarcia.cms.backend.repository.content.SeoRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public final class SeoService {
    private static final String DESCRIPTION =
        "Rodogarcia Transportes: soluções logísticas nacionais com segurança, previsibilidade e rastreabilidade.";
    private static final String OG_IMAGE = "/foto5.webp";
    private static final List<Route> ROUTES = List.of(
        new Route("/", "Home", "Rodogarcia Transportes | Logística com previsibilidade nacional"),
        new Route("/servicos", "Serviços", "Serviços | Rodogarcia Transportes"),
        new Route("/sobre", "Sobre", "Sobre a Rodogarcia"),
        new Route("/para-empresas", "Para Empresas", "Para Empresas | Rodogarcia Transportes"),
        new Route("/cotacao", "Cotação", "Cotação | Rodogarcia Transportes"),
        new Route("/fale-conosco", "Contato", "Contato | Rodogarcia Transportes"),
        new Route("/central-ajuda", "Central de ajuda", "Central de ajuda | Rodogarcia Transportes"),
        new Route("/imprensa", "Imprensa", "Imprensa | Rodogarcia Transportes"),
        new Route("/trabalhe-conosco", "Carreiras", "Carreiras | Rodogarcia Transportes"),
        new Route("/termos-de-uso", "Termos", "Termos de uso | Rodogarcia Transportes"),
        new Route("/privacidade", "Privacidade", "Privacidade | Rodogarcia Transportes"),
        new Route("/sua-voz", "Sua Voz", "Sua Voz | Rodogarcia Transportes")
    );

    private final JsonMapper mapper;
    private final SeoRepository repository;
    private final ContentMediaValidator mediaValidator;
    private final Clock clock;
    private final ObjectProvider<ContentAuditTrail> auditTrail;

    @Autowired
    public SeoService(
        JsonMapper mapper,
        SeoRepository repository,
        ContentMediaValidator mediaValidator,
        ObjectProvider<ContentAuditTrail> auditTrail
    ) {
        this(mapper, repository, mediaValidator, auditTrail, Clock.systemUTC());
    }

    SeoService(
        JsonMapper mapper,
        SeoRepository repository,
        ContentMediaValidator mediaValidator,
        ObjectProvider<ContentAuditTrail> auditTrail,
        Clock clock
    ) {
        this.mapper = mapper;
        this.repository = repository;
        this.mediaValidator = mediaValidator;
        this.auditTrail = auditTrail;
        this.clock = clock;
    }

    public ObjectNode readSettings() {
        ObjectNode raw = repository.read(defaultSettings());
        ArrayNode rawPages = ContentJson.array(raw.get("pages"));
        ObjectNode byPath = mapper.createObjectNode();
        for (JsonNode page : rawPages) {
            if (page.isObject()) byPath.set(page.path("path").asString(), page);
        }
        ArrayNode pages = mapper.createArrayNode();
        for (Route route : ROUTES) {
            ObjectNode fallback = defaultPage(route);
            pages.add(normalizePage(byPath.get(route.path()), fallback, false));
        }
        ObjectNode result = mapper.createObjectNode();
        result.set("pages", pages);
        if (raw.has("updatedAt")) result.set("updatedAt", raw.get("updatedAt").deepCopy());
        return result;
    }

    public ObjectNode publicPage(JsonNode rawPath) {
        String path = ContentJson.path(rawPath);
        if (path.isEmpty()) path = "/";
        for (JsonNode page : ContentJson.array(readSettings().get("pages"))) {
            if (path.equals(page.path("path").asString())) return (ObjectNode) page.deepCopy();
        }
        return null;
    }

    public ObjectNode update(HttpServletRequest request, JsonNode bodyValue) {
        ObjectNode body = ContentJson.object(bodyValue);
        String path = ContentJson.path(body.get("path"));
        if (path.isEmpty()) throw new ApiException(422, "Rota SEO invalida.");
        if (ROUTES.stream().noneMatch(route -> route.path().equals(path))) {
            throw new ApiException(422, "A rota SEO não pertence ao conjunto público editável.");
        }
        if (body.has("canonical") && canonical(body.get("canonical"), "").isEmpty()) {
            throw new ApiException(422, "Canonical deve ser um caminho interno ou URL HTTP(S) válida.");
        }
        if (body.has("title") && ContentJson.text(body.get("title"), 90).isEmpty()) {
            throw new ApiException(422, "Título SEO é obrigatório.");
        }
        if (body.has("description") && ContentJson.text(body.get("description"), 180).isEmpty()) {
            throw new ApiException(422, "Descrição SEO é obrigatória.");
        }
        ObjectNode next = repository.update(defaultSettings(), ignored -> {
            ObjectNode settings = readSettings();
            ArrayNode pages = ContentJson.array(settings.get("pages"));
            ObjectNode current = null;
            int index = -1;
            for (int currentIndex = 0; currentIndex < pages.size(); currentIndex++) {
                if (path.equals(pages.get(currentIndex).path("path").asString())) {
                    current = ContentJson.object(pages.get(currentIndex));
                    index = currentIndex;
                    break;
                }
            }
            ObjectNode merged = current == null ? mapper.createObjectNode() : current.deepCopy();
            body.properties().forEach(entry -> merged.set(entry.getKey(), entry.getValue().deepCopy()));
            merged.put("updatedAt", ContentTime.now(clock));
            ObjectNode normalized = normalizePage(merged, current, true);
            if (normalized.path("title").asString().length() < 8) {
                throw new ApiException(422, "Título SEO muito curto.");
            }
            if (normalized.path("description").asString().length() < 40) {
                throw new ApiException(422, "Descrição SEO muito curta.");
            }
            if (index >= 0) pages.set(index, normalized); else pages.add(normalized);
            ObjectNode result = mapper.createObjectNode();
            result.set("pages", pages);
            result.put("updatedAt", ContentTime.now(clock));
            return result;
        });
        ObjectNode updatedPage = null;
        for (JsonNode page : ContentJson.array(next.get("pages"))) {
            if (path.equals(page.path("path").asString())) updatedPage = ContentJson.object(page);
        }
        ContentAuditTrail audit = auditTrail.getIfAvailable();
        if (audit != null) audit.record(
            request,
            "seo.update",
            path,
            Map.of("title", updatedPage == null ? "" : updatedPage.path("title").asString(),
                "index", updatedPage == null ? "true" : String.valueOf(updatedPage.path("index").asBoolean(true)))
        );
        return next;
    }

    private ObjectNode normalizePage(JsonNode value, ObjectNode fallbackValue, boolean strictMedia) {
        ObjectNode input = ContentJson.object(value);
        ObjectNode fallback = fallbackValue == null ? mapper.createObjectNode() : fallbackValue;
        String path = ContentJson.path(input.get("path"));
        if (path.isEmpty()) path = fallback.path("path").asString("/");
        String title = ContentJson.text(input.get("title"), 90);
        if (title.isEmpty()) title = fallback.path("title").asString("Rodogarcia Transportes");
        String description = ContentJson.text(input.get("description"), 180);
        if (description.isEmpty()) description = fallback.path("description").asString(DESCRIPTION);
        String canonical = canonical(input.get("canonical"), path);
        ObjectNode result = mapper.createObjectNode();
        result.put("path", path);
        String label = ContentJson.text(input.get("label"), 80);
        result.put("label", label.isEmpty() ? fallback.path("label").asString(path) : label);
        result.put("title", title);
        result.put("description", description);
        result.put("metaTags", ContentJson.multiline(input.get("metaTags"), 1000));
        result.put("index", input.has("index") && input.get("index").isBoolean()
            ? input.get("index").booleanValue() : fallback.path("index").asBoolean(true));
        result.put("follow", input.has("follow") && input.get("follow").isBoolean()
            ? input.get("follow").booleanValue() : fallback.path("follow").asBoolean(true));
        result.put("canonical", canonical);
        result.put("slug", path.equals("/") ? "/" : path.substring(1));
        String ogTitle = ContentJson.text(input.get("ogTitle"), 95);
        result.put("ogTitle", ogTitle.isEmpty() ? title : ogTitle);
        String ogDescription = ContentJson.text(input.get("ogDescription"), 220);
        result.put("ogDescription", ogDescription.isEmpty() ? description : ogDescription);
        result.put("ogImage", normalizeImage(input.get("ogImage"), fallback.path("ogImage").asString(OG_IMAGE), strictMedia));
        if (input.has("updatedAt")) result.set("updatedAt", input.get("updatedAt").deepCopy());
        return result;
    }

    private String normalizeImage(JsonNode value, String fallback, boolean strict) {
        try {
            String image = mediaValidator.image(value, "SEO: imagem social");
            return image.isEmpty() ? fallback : image;
        } catch (ApiException exception) {
            if (strict) throw exception;
            return fallback;
        }
    }

    private String canonical(JsonNode value, String fallback) {
        String canonical = ContentJson.url(value);
        return canonical.startsWith("/") || canonical.matches("(?i)^https?://.*") ? canonical : fallback;
    }

    private ObjectNode defaultSettings() {
        ObjectNode result = mapper.createObjectNode();
        ArrayNode pages = result.putArray("pages");
        ROUTES.forEach(route -> pages.add(defaultPage(route)));
        result.put("updatedAt", ContentTime.now(clock));
        return result;
    }

    private ObjectNode defaultPage(Route route) {
        ObjectNode page = mapper.createObjectNode();
        page.put("path", route.path());
        page.put("label", route.label());
        page.put("title", route.title());
        page.put("description", DESCRIPTION);
        page.put("metaTags", "");
        page.put("index", true);
        page.put("follow", true);
        page.put("canonical", route.path());
        page.put("slug", route.path().equals("/") ? "/" : route.path().substring(1));
        page.put("ogTitle", route.title());
        page.put("ogDescription", DESCRIPTION);
        page.put("ogImage", OG_IMAGE);
        return page;
    }

    private record Route(String path, String label, String title) {
    }
}
