package br.com.rodogarcia.landingbuilder.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import br.com.rodogarcia.landingbuilder.exception.ApiException;
import br.com.rodogarcia.landingbuilder.repository.LandingMediaRepository;
import br.com.rodogarcia.landingbuilder.repository.LandingRepository;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/** Regras do contrato campaign-v1; controllers apenas traduzem HTTP para este serviço. */
@Service
public final class CampaignService {

    private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final Pattern MEDIA_URL = Pattern.compile("^/landing-media/media_[A-Za-z0-9-]{36}$");
    private static final Pattern PREVIEW_TOKEN = Pattern.compile("^[A-Za-z0-9_-]{43}$");
    private static final Pattern GA4 = Pattern.compile("^G-[A-Z0-9]{4,}$", Pattern.CASE_INSENSITIVE);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration PREVIEW_TTL = Duration.ofDays(7);
    private static final int MAX_REVISIONS = 20;
    private static final Set<String> RESERVED_SLUGS = Set.of(
        "admin", "api", "auth", "developer", "health", "preview", "public", "uploads", "landing-assets", "_next",
        "central-ajuda", "coletas", "cotacao", "fale-conosco", "imprensa", "melhoria-continua", "para-empresas",
        "privacidade", "servicos", "sobre", "sua-voz", "termos-de-uso", "trabalhe-conosco", "inicio", "home",
        "institucional", "empresa", "quem-somos", "transportes", "nossos-servicos", "contato", "contact", "quote",
        "orcamento", "coleta", "solicitar-coleta", "careers", "vagas", "ajuda", "help", "faq", "press", "midia",
        "empresas", "b2b", "termos", "politica", "politica-de-privacidade", "canal-de-denuncias", "rastrear-encomenda"
    );

    private final ObjectMapper mapper;
    private final LandingRepository landingRepository;
    private final LandingMediaRepository mediaRepository;
    private final ObjectNode defaults;

    public CampaignService(
        ObjectMapper mapper,
        LandingRepository landingRepository,
        LandingMediaRepository mediaRepository
    ) {
        this.mapper = mapper;
        this.landingRepository = landingRepository;
        this.mediaRepository = mediaRepository;
        defaults = loadDefaults(mapper);
    }

    public synchronized ArrayNode listInternal() {
        List<ObjectNode> ordered = nodes(normalizedLandings());
        ordered.sort(Comparator.comparing(CampaignService::updatedAt).reversed());
        ArrayNode result = mapper.createArrayNode();
        ordered.forEach(landing -> result.add(toInternal(landing)));
        return result;
    }

    public synchronized ArrayNode listPublishedIndex() {
        List<ObjectNode> ordered = nodes(normalizedLandings());
        ordered.stream()
            .filter(landing -> "published".equals(text(landing, "status")) && landing.path("seo").path("index").asBoolean(true))
            .sorted(Comparator.comparing(landing -> text(landing, "slug")))
            .forEach(landing -> {
                // The consumer gets only the fields needed by the sitemap.
            });
        ArrayNode result = mapper.createArrayNode();
        ordered.stream()
            .filter(landing -> "published".equals(text(landing, "status")) && landing.path("seo").path("index").asBoolean(true))
            .sorted(Comparator.comparing(landing -> text(landing, "slug")))
            .forEach(landing -> result.add(mapper.createObjectNode()
                .put("slug", text(landing, "slug"))
                .put("updatedAt", updatedAt(landing))));
        return result;
    }

    public synchronized ObjectNode getPublished(String rawSlug) {
        String slug = normalizeSlug(rawSlug);
        for (ObjectNode landing : nodes(normalizedLandings())) {
            if (slug.equals(text(landing, "slug")) && "published".equals(text(landing, "status"))) {
                return toPublic(landing);
            }
        }
        throw new ApiException("Landing page não publicada.", 404);
    }

    public synchronized ObjectNode getPreview(String token) {
        for (ObjectNode landing : nodes(normalizedLandings())) {
            if (tokenMatches(text(landing, "previewToken"), token)
                && previewIsActive(landing, Instant.now())) return toPublic(landing);
        }
        throw new ApiException("Prévia não encontrada.", 404);
    }

    public synchronized ObjectNode create(JsonNode input) {
        ObjectNode content = normalizeInput(input, true);
        ArrayNode landings = normalizedLandings();
        assertSlugAvailable(text(content, "slug"), null, landings);
        String now = Instant.now().toString();
        ObjectNode created = content.deepCopy();
        created.put("id", "landing_" + UUID.randomUUID());
        created.put("previewToken", createPreviewToken());
        created.put("previewExpiresAt", Instant.now().plus(PREVIEW_TTL).toString());
        created.put("status", "draft");
        created.put("createdAt", now);
        created.put("updatedAt", now);
        landings.add(created);
        landingRepository.writeLandings(landings);
        return toInternal(created);
    }

    public synchronized ObjectNode update(String id, JsonNode input) {
        ObjectNode content = normalizeInput(input, true);
        ArrayNode landings = normalizedLandings();
        int index = findLanding(landings, id);
        if (index < 0) throw new ApiException("Landing page não encontrada.", 404);
        assertSlugAvailable(text(content, "slug"), id, landings);
        ObjectNode previous = (ObjectNode) landings.get(index);
        ObjectNode updated = content.deepCopy();
        copyMetadata(previous, updated);
        addRevision(updated, previous, "update");
        updated.put("updatedAt", Instant.now().toString());
        landings.set(index, updated);
        landingRepository.writeLandings(landings);
        return toInternal(updated);
    }

    public synchronized ObjectNode setStatus(String id, String status) {
        if (!Set.of("published", "unpublished").contains(status)) {
            throw new ApiException("Landing page não encontrada.", 404);
        }
        ArrayNode landings = normalizedLandings();
        int index = findLanding(landings, id);
        if (index < 0) throw new ApiException("Landing page não encontrada.", 404);
        ObjectNode current = (ObjectNode) landings.get(index);
        if ("published".equals(status)) {
            assertSlugAvailable(text(current, "slug"), id, landings);
            assertReadyToPublish(current);
        }
        ObjectNode updated = current.deepCopy();
        String now = Instant.now().toString();
        addRevision(updated, current, status);
        updated.put("status", status);
        updated.remove("scheduledPublishAt");
        updated.remove("scheduledUnpublishAt");
        updated.put("updatedAt", now);
        if ("published".equals(status)) updated.put("publishedAt", now);
        landings.set(index, updated);
        landingRepository.writeLandings(landings);
        return toInternal(updated);
    }

    public synchronized ObjectNode provisionPreview(String id, boolean rotate) {
        ArrayNode landings = normalizedLandings();
        int index = findLanding(landings, id);
        if (index < 0) throw new ApiException("Landing page não encontrada.", 404);
        ObjectNode current = (ObjectNode) landings.get(index);
        String token = text(current, "previewToken");
        ObjectNode updated = current.deepCopy();
        if (rotate) {
            token = createPreviewToken();
            updated.put("previewToken", token);
        }
        String expiresAt = Instant.now().plus(PREVIEW_TTL).toString();
        updated.put("previewExpiresAt", expiresAt);
        updated.put("updatedAt", Instant.now().toString());
        landings.set(index, updated);
        landingRepository.writeLandings(landings);
        return mapper.createObjectNode().put("previewPath", "/preview/" + token).put("expiresAt", expiresAt);
    }

    public synchronized ObjectNode duplicate(String id) {
        ArrayNode landings = normalizedLandings();
        int index = findLanding(landings, id);
        if (index < 0) throw new ApiException("Landing page não encontrada.", 404);
        ObjectNode source = (ObjectNode) landings.get(index);
        ObjectNode copy = normalizeInput(source, false);
        String now = Instant.now().toString();
        copy.put("id", "landing_" + UUID.randomUUID());
        copy.put("name", duplicateName(text(source, "name")));
        copy.put("slug", availableDuplicateSlug(text(source, "slug"), landings));
        copy.put("status", "draft");
        copy.put("previewToken", createPreviewToken());
        copy.put("previewExpiresAt", Instant.now().plus(PREVIEW_TTL).toString());
        copy.put("createdAt", now);
        copy.put("updatedAt", now);
        copy.remove("publishedAt");
        copy.remove("scheduledPublishAt");
        copy.remove("scheduledUnpublishAt");
        copy.putArray("revisions");
        landings.add(copy);
        landingRepository.writeLandings(landings);
        return toInternal(copy);
    }

    public synchronized ObjectNode archive(String id) {
        ArrayNode landings = normalizedLandings();
        int index = findLanding(landings, id);
        if (index < 0) throw new ApiException("Landing page não encontrada.", 404);
        ObjectNode current = (ObjectNode) landings.get(index);
        ObjectNode updated = current.deepCopy();
        addRevision(updated, current, "archive");
        updated.put("status", "archived");
        updated.remove("scheduledPublishAt");
        updated.remove("scheduledUnpublishAt");
        updated.put("updatedAt", Instant.now().toString());
        landings.set(index, updated);
        landingRepository.writeLandings(landings);
        return toInternal(updated);
    }

    public synchronized void delete(String id) {
        ArrayNode landings = normalizedLandings();
        int index = findLanding(landings, id);
        if (index < 0) throw new ApiException("Landing page não encontrada.", 404);
        if (!"archived".equals(text((ObjectNode) landings.get(index), "status"))) {
            throw new ApiException("Arquive a landing antes de excluí-la.", 409);
        }
        landings.remove(index);
        landingRepository.writeLandings(landings);
    }

    public synchronized ObjectNode schedule(String id, JsonNode input) {
        if (!(input instanceof ObjectNode body)) throw new ApiException("Programação inválida.", 422);
        if (body.size() == 0 || body.size() > 2 || body.properties().stream()
            .anyMatch(entry -> !Set.of("publishAt", "unpublishAt").contains(entry.getKey()))) {
            throw new ApiException("Programação inválida.", 422);
        }
        ArrayNode landings = normalizedLandings();
        int index = findLanding(landings, id);
        if (index < 0) throw new ApiException("Landing page não encontrada.", 404);
        ObjectNode current = (ObjectNode) landings.get(index);
        if ("archived".equals(text(current, "status"))) throw new ApiException("Restaure a landing antes de programá-la.", 409);
        Instant now = Instant.now();
        Instant publishAt = scheduledInstant(body, "publishAt");
        Instant unpublishAt = scheduledInstant(body, "unpublishAt");
        if (publishAt != null && !publishAt.isAfter(now)) throw new ApiException("A publicação programada deve estar no futuro.", 422);
        if (unpublishAt != null && !unpublishAt.isAfter(now)) throw new ApiException("A despublicação programada deve estar no futuro.", 422);
        if (publishAt != null && unpublishAt != null && !unpublishAt.isAfter(publishAt)) {
            throw new ApiException("A despublicação deve ocorrer depois da publicação.", 422);
        }
        ObjectNode updated = current.deepCopy();
        addRevision(updated, current, "schedule");
        setScheduledInstant(updated, "scheduledPublishAt", publishAt);
        setScheduledInstant(updated, "scheduledUnpublishAt", unpublishAt);
        updated.put("updatedAt", now.toString());
        landings.set(index, updated);
        landingRepository.writeLandings(landings);
        return toInternal(updated);
    }

    public synchronized ArrayNode revisions(String id) {
        ArrayNode landings = normalizedLandings();
        int index = findLanding(landings, id);
        if (index < 0) throw new ApiException("Landing page não encontrada.", 404);
        ArrayNode result = mapper.createArrayNode();
        JsonNode stored = landings.get(index).path("revisions");
        if (!stored.isArray()) return result;
        for (JsonNode revision : stored) {
            if (!(revision instanceof ObjectNode item)) continue;
            result.add(mapper.createObjectNode()
                .put("id", text(item, "id"))
                .put("operation", text(item, "operation"))
                .put("createdAt", text(item, "createdAt")));
        }
        return result;
    }

    public synchronized ObjectNode rollback(String id, String revisionId) {
        ArrayNode landings = normalizedLandings();
        int index = findLanding(landings, id);
        if (index < 0) throw new ApiException("Landing page não encontrada.", 404);
        ObjectNode current = (ObjectNode) landings.get(index);
        ObjectNode snapshot = revisionSnapshot(current, revisionId);
        if (snapshot == null) throw new ApiException("Revisão não encontrada.", 404);
        ObjectNode restored = normalizeInput(snapshot, false);
        copyMetadata(current, restored);
        addRevision(restored, current, "rollback");
        restored.put("updatedAt", Instant.now().toString());
        landings.set(index, restored);
        landingRepository.writeLandings(landings);
        return toInternal(restored);
    }

    public synchronized boolean isMediaReferenced(String url) {
        for (ObjectNode landing : nodes(normalizedLandings())) {
            if (containsString(landing, url)) return true;
        }
        for (JsonNode media : mediaRepository.readMedia()) {
            if (url.equals(media.path("poster").asText())
                && isMediaReferenced(media.path("url").asText())) return true;
        }
        return false;
    }

    private ArrayNode normalizedLandings() {
        ArrayNode stored = landingRepository.readLandings();
        ArrayNode normalized = mapper.createArrayNode();
        boolean changed = false;
        for (JsonNode value : stored) {
            if (!(value instanceof ObjectNode landing)) {
                changed = true;
                continue;
            }
            ObjectNode item = normalizeStored(landing);
            if (applyScheduledTransitions(item, Instant.now())) changed = true;
            normalized.add(item);
            if (!item.equals(landing)) changed = true;
        }
        if (changed) landingRepository.writeLandings(normalized);
        return normalized;
    }

    private ObjectNode normalizeStored(ObjectNode stored) {
        ObjectNode normalized;
        try {
            normalized = normalizeInput(stored, false);
        } catch (ApiException ignored) {
            normalized = defaults.deepCopy();
            copyIfText(stored, normalized, "name", 120);
            copyIfText(stored, normalized, "slug", 80);
            normalizeSeo(normalized, stored.path("seo"));
        }
        String id = text(stored, "id");
        normalized.put("id", id.isBlank() ? "landing_" + UUID.randomUUID() : id);
        normalized.put("status", validStatus(text(stored, "status")));
        normalized.put("createdAt", validTimestamp(text(stored, "createdAt")) ? text(stored, "createdAt") : Instant.now().toString());
        normalized.put("updatedAt", validTimestamp(text(stored, "updatedAt")) ? text(stored, "updatedAt") : Instant.now().toString());
        if (validTimestamp(text(stored, "publishedAt"))) normalized.put("publishedAt", text(stored, "publishedAt"));
        String token = text(stored, "previewToken");
        normalized.put("previewToken", PREVIEW_TOKEN.matcher(token).matches() ? token : createPreviewToken());
        String previewExpiresAt = text(stored, "previewExpiresAt");
        normalized.put("previewExpiresAt", validTimestamp(previewExpiresAt)
            ? previewExpiresAt : Instant.now().plus(PREVIEW_TTL).toString());
        copyTimestamp(stored, normalized, "scheduledPublishAt");
        copyTimestamp(stored, normalized, "scheduledUnpublishAt");
        normalized.set("revisions", normalizeRevisions(stored.path("revisions")));
        return normalized;
    }

    private ObjectNode normalizeInput(JsonNode input, boolean requireCore) {
        if (!(input instanceof ObjectNode source)) throw invalidLanding();
        ObjectNode result = defaults.deepCopy();
        result.put("name", "");
        result.put("slug", "");
        result.set("theme", mapper.createObjectNode()
            .put("primaryColor", "#111111")
            .put("secondaryColor", "#2a2a2a")
            .put("backgroundColor", "#ffffff")
            .put("textColor", "#171717")
            .put("font", "system"));
        result.set("analytics", mapper.createObjectNode()
            .put("ga4MeasurementId", ""));
        String template = optionalText(source, "template", 40, "campaign-v1");
        if (!"campaign-v1".equals(template)) throw invalidLanding();
        result.put("template", template);
        copyIfText(source, result, "name", 120);
        if (source.has("slug")) result.put("slug", normalizeSlug(requireText(source, "slug", 80)));
        validateSlug(text(result, "slug"));
        normalizeTheme(result, section(source, "theme"));
        normalizeAnalytics(result, section(source, "analytics"));
        normalizeHero(result, section(source, "hero"));
        normalizeSeo(result, source.get("seo"));
        normalizeLowerSection(result, section(source, "lowerSection"));
        normalizeBenefits(result, section(source, "benefits"));
        normalizeStory(result, section(source, "story"));
        normalizeMetrics(result, section(source, "metrics"));
        normalizeShowcase(result, section(source, "showcase"));
        normalizeTestimonial(result, section(source, "testimonial"));
        normalizeFaq(result, section(source, "faq"));
        normalizeFinalCta(result, section(source, "finalCta"));
        normalizeFooter(result, section(source, "footer"));
        if (requireCore && (text(result, "name").isBlank()
            || text((ObjectNode) result.get("hero"), "title").isBlank()
            || text((ObjectNode) result.get("lowerSection"), "title").isBlank())) {
            throw new ApiException("Informe o nome, o título do Hero e o título da seção inferior.", 422);
        }
        return result;
    }

    private void normalizeSeo(ObjectNode result, JsonNode raw) {
        ObjectNode source = objectOrEmpty(raw);
        ObjectNode seo = result.putObject("seo");
        String heroTitle = text((ObjectNode) result.get("hero"), "title");
        String heroDescription = text((ObjectNode) result.get("hero"), "description");
        String title = source.has("title") ? requireText(source, "title", 70) : "";
        String description = source.has("description") ? requireText(source, "description", 160) : "";
        seo.put("title", title.isBlank() ? truncate(heroTitle, 70) : title);
        seo.put("description", description.isBlank() ? truncate(heroDescription, 160) : description);
        seo.put("index", optionalBoolean(source, "index", true));
    }

    private void normalizeTheme(ObjectNode result, ObjectNode source) {
        ObjectNode theme = (ObjectNode) result.get("theme");
        for (String field : List.of("primaryColor", "secondaryColor", "backgroundColor", "textColor")) {
            if (!source.has(field)) continue;
            String color = requireText(source, field, 7);
            if (!COLOR.matcher(color).matches()) throw invalidLanding();
            theme.put(field, color);
        }
        if (source.has("font")) {
            String font = requireText(source, "font", 30);
            if (!Set.of("system", "space-grotesk", "plus-jakarta").contains(font)) throw invalidLanding();
            theme.put("font", font);
        }
    }

    private void normalizeAnalytics(ObjectNode result, ObjectNode source) {
        ObjectNode analytics = (ObjectNode) result.get("analytics");
        validateOptionalIdentifier(source, analytics, "ga4MeasurementId", 80, GA4);
    }

    private void normalizeHero(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("hero");
        copyTextFields(target, source, new String[] { "phone", "email", "logo", "backgroundImage", "eyebrow", "title", "description", "ctaLabel", "ctaUrl" },
            new int[] { 40, 160, 300, 300, 80, 180, 700, 70, 400 });
        validateImageMedia(target, "logo");
        validateImageMedia(target, "backgroundImage");
        normalizePresentation(target, source, "backgroundPresentation", "backgroundImage");
        validateUrl(target, "ctaUrl");
        if (source.has("highlights")) target.set("highlights", normalizeItems(source.get("highlights"), 1, 4,
            new String[] { "title", "description" }, new int[] { 80, 220 }, false));
    }

    private void normalizeLowerSection(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("lowerSection");
        copyVisible(target, source);
        copyTextFields(target, source, new String[] { "title", "description", "formTitle", "formDescription", "submitLabel", "ctaLabel", "ctaUrl" },
            new int[] { 180, 900, 180, 400, 70, 70, 400 });
        for (String field : List.of("mapBaseColor", "mapBranchColor", "mapBorderColor")) {
            if (!source.has(field)) continue;
            String color = requireText(source, field, 7);
            if (!COLOR.matcher(color).matches()) throw invalidLanding();
            target.put(field, color);
        }
        validateUrl(target, "ctaUrl");
    }

    private void normalizeBenefits(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("benefits");
        copyVisible(target, source);
        copyTextFields(target, source, new String[] { "eyebrow", "title", "description" }, new int[] { 80, 180, 700 });
        if (source.has("items")) target.set("items", normalizeItems(source.get("items"), 1, 6,
            new String[] { "title", "description" }, new int[] { 80, 220 }, false));
    }

    private void normalizeStory(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("story");
        copyVisible(target, source);
        copyTextFields(target, source, new String[] { "eyebrow", "title", "description", "image", "ctaLabel", "ctaUrl" },
            new int[] { 80, 180, 900, 300, 70, 400 });
        validateMedia(target, "image");
        normalizePresentation(target, source, "imagePresentation", "image");
        validateUrl(target, "ctaUrl");
        if (source.has("items")) target.set("items", normalizeItems(source.get("items"), 1, 4,
            new String[] { "title", "description" }, new int[] { 100, 320 }, false));
    }

    private void normalizeMetrics(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("metrics");
        copyVisible(target, source);
        copyTextFields(target, source, new String[] { "eyebrow", "title" }, new int[] { 80, 180 });
        if (source.has("items")) target.set("items", normalizeItems(source.get("items"), 1, 4,
            new String[] { "value", "label", "description" }, new int[] { 40, 120, 320 }, false));
    }

    private void normalizeShowcase(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("showcase");
        copyVisible(target, source);
        copyTextFields(target, source, new String[] { "eyebrow", "title", "description", "backgroundImage", "ctaLabel", "ctaUrl" },
            new int[] { 80, 180, 700, 300, 70, 400 });
        validateImageMedia(target, "backgroundImage");
        normalizePresentation(target, source, "backgroundPresentation", "backgroundImage");
        validateUrl(target, "ctaUrl");
        if (source.has("items")) target.set("items", normalizeItems(source.get("items"), 1, 3,
            new String[] { "title", "description" }, new int[] { 100, 320 }, false));
    }

    private void normalizeTestimonial(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("testimonial");
        copyVisible(target, source);
        copyTextFields(target, source, new String[] { "eyebrow", "title", "description", "quote", "author", "role" },
            new int[] { 80, 180, 900, 900, 100, 120 });
        JsonNode items = source.get("items");
        if ((items == null || !items.isArray() || items.isEmpty()) && legacyFeedbackProvided(source)) {
            ArrayNode legacy = mapper.createArrayNode();
            ObjectNode item = legacy.addObject();
            item.put("name", text(target, "author"));
            item.put("detail", text(target, "role"));
            item.put("quote", text(target, "quote"));
            item.put("rating", 5);
            items = legacy;
        }
        if (items != null) target.set("items", normalizeFeedbacks(items));
    }

    private void normalizeFaq(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("faq");
        copyVisible(target, source);
        copyTextFields(target, source, new String[] { "eyebrow", "title" }, new int[] { 80, 180 });
        if (source.has("items")) target.set("items", normalizeItems(source.get("items"), 1, 8,
            new String[] { "question", "answer" }, new int[] { 180, 900 }, false));
    }

    private void normalizeFinalCta(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("finalCta");
        copyVisible(target, source);
        copyTextFields(target, source, new String[] { "eyebrow", "title", "description", "backgroundImage", "ctaLabel", "ctaUrl" },
            new int[] { 80, 180, 700, 300, 70, 400 });
        validateImageMedia(target, "backgroundImage");
        normalizePresentation(target, source, "backgroundPresentation", "backgroundImage");
        validateUrl(target, "ctaUrl");
    }

    private void normalizeFooter(ObjectNode result, ObjectNode source) {
        ObjectNode target = (ObjectNode) result.get("footer");
        copyTextFields(target, source, new String[] { "brand", "description", "phone", "email", "legalText" },
            new int[] { 120, 400, 40, 160, 240 });
    }

    private ArrayNode normalizeItems(JsonNode value, int minimum, int maximum, String[] fields, int[] limits, boolean unused) {
        if (!(value instanceof ArrayNode array) || array.size() < minimum || array.size() > maximum) throw invalidLanding();
        ArrayNode result = mapper.createArrayNode();
        for (JsonNode item : array) {
            if (!(item instanceof ObjectNode source)) throw invalidLanding();
            ObjectNode target = result.addObject();
            for (int index = 0; index < fields.length; index++) {
                String field = fields[index];
                target.put(field, source.has(field) ? requireText(source, field, limits[index]) : "");
            }
        }
        return result;
    }

    private ArrayNode normalizeFeedbacks(JsonNode value) {
        if (!(value instanceof ArrayNode array) || array.isEmpty() || array.size() > 6) throw invalidLanding();
        ArrayNode result = mapper.createArrayNode();
        for (JsonNode item : array) {
            if (!(item instanceof ObjectNode source)) throw invalidLanding();
            ObjectNode target = result.addObject();
            target.put("name", source.has("name") ? requireText(source, "name", 100) : "");
            target.put("detail", source.has("detail") ? requireText(source, "detail", 120) : "");
            target.put("quote", source.has("quote") ? requireText(source, "quote", 900) : "");
            int rating = source.has("rating") ? source.path("rating").asInt(Integer.MIN_VALUE) : 5;
            if (!source.path("rating").isMissingNode() && (!source.path("rating").isIntegralNumber() || rating < 1 || rating > 5)) {
                throw invalidLanding();
            }
            target.put("rating", rating);
        }
        return result;
    }

    private void copyMetadata(ObjectNode source, ObjectNode target) {
        target.put("id", text(source, "id"));
        target.put("status", validStatus(text(source, "status")));
        target.put("createdAt", text(source, "createdAt"));
        target.put("previewToken", text(source, "previewToken"));
        target.put("previewExpiresAt", text(source, "previewExpiresAt"));
        if (validTimestamp(text(source, "publishedAt"))) target.put("publishedAt", text(source, "publishedAt"));
        copyTimestamp(source, target, "scheduledPublishAt");
        copyTimestamp(source, target, "scheduledUnpublishAt");
    }

    private ObjectNode toInternal(ObjectNode landing) {
        ObjectNode result = landing.deepCopy();
        result.remove("previewToken");
        JsonNode revisions = result.remove("revisions");
        result.put("revisionCount", revisions != null && revisions.isArray() ? revisions.size() : 0);
        return result;
    }

    private ObjectNode toPublic(ObjectNode landing) {
        ObjectNode result = mapper.createObjectNode();
        copyPublicField(landing, result, "template");
        copyPublicField(landing, result, "name");
        copyPublicField(landing, result, "slug");
        copyPublicField(landing, result, "seo");
        copyPublicField(landing, result, "theme");
        ObjectNode analytics = result.putObject("analytics");
        analytics.put("ga4MeasurementId", landing.path("analytics").path("ga4MeasurementId").asText(""));
        for (String section : List.of("hero", "lowerSection", "benefits", "story", "metrics", "showcase", "testimonial", "faq", "finalCta", "footer")) {
            copyPublicField(landing, result, section);
        }
        if (result.path("testimonial") instanceof ObjectNode testimonial) {
            testimonial.remove(List.of("quote", "author", "role"));
        }
        sanitizePublicMedia(result.path("hero"), "logo");
        sanitizePublicMedia(result.path("hero"), "backgroundImage");
        sanitizePublicMedia(result.path("story"), "image");
        sanitizePublicMedia(result.path("showcase"), "backgroundImage");
        sanitizePublicMedia(result.path("finalCta"), "backgroundImage");
        ObjectNode media = result.putObject("media");
        for (String url : referencedMediaUrls(result)) {
            ObjectNode record = mediaRecord(url);
            if (record == null) continue;
            ObjectNode descriptor = media.putObject(url);
            descriptor.put("kind", text(record, "kind"));
            descriptor.put("alt", text(record, "alt"));
            String poster = text(record, "poster");
            descriptor.put("poster", mediaRecord(poster) != null ? poster : "");
        }
        return result;
    }

    private void sanitizePublicMedia(JsonNode section, String field) {
        if (!(section instanceof ObjectNode target)) return;
        String url = target.path(field).asText("");
        if (!mediaExists(url)) target.put(field, "");
    }

    private void copyPublicField(ObjectNode source, ObjectNode target, String field) {
        JsonNode value = source.get(field);
        if (value != null) target.set(field, value.deepCopy());
    }

    private void assertSlugAvailable(String slug, String currentId, ArrayNode landings) {
        if (RESERVED_SLUGS.contains(slug)) throw new ApiException("Esta rota é reservada pelo site institucional.", 422);
        for (ObjectNode landing : nodes(landings)) {
            if (slug.equals(text(landing, "slug")) && !text(landing, "id").equals(currentId)) {
                throw new ApiException("Já existe uma landing page com esta rota.", 422);
            }
        }
    }

    private int findLanding(ArrayNode landings, String id) {
        for (int index = 0; index < landings.size(); index++) {
            if (landings.get(index) instanceof ObjectNode landing && text(landing, "id").equals(id)) return index;
        }
        return -1;
    }

    private boolean mediaExists(String url) {
        return mediaRecord(url) != null;
    }

    private ObjectNode mediaRecord(String url) {
        if (url == null || url.isBlank() || !MEDIA_URL.matcher(url).matches()) return null;
        for (JsonNode record : mediaRepository.readMedia()) {
            if (url.equals(record.path("url").asText()) && record instanceof ObjectNode object) return object;
        }
        return null;
    }

    private void validateMedia(ObjectNode target, String field) {
        String url = text(target, field);
        if (url.isBlank()) return;
        if (!MEDIA_URL.matcher(url).matches() || mediaRecord(url) == null) {
            throw new ApiException("Selecione uma mídia própria válida da biblioteca da campanha.", 422);
        }
    }

    private void validateImageMedia(ObjectNode target, String field) {
        validateMedia(target, field);
        String url = text(target, field);
        if (!url.isBlank() && !"image".equals(text(mediaRecord(url), "kind"))) {
            throw new ApiException("Esta área aceita somente imagens da biblioteca da campanha.", 422);
        }
    }

    /** Mantém o enquadramento como dado público mínimo, sem aceitar campos livres. */
    private void normalizePresentation(ObjectNode target, ObjectNode source, String field, String mediaField) {
        if (!source.has(field)) {
            target.remove(field);
            return;
        }
        if (!(source.get(field) instanceof ObjectNode input)) throw invalidLanding();
        if (input.size() > 2 || input.properties().stream().anyMatch(entry -> !Set.of("desktop", "mobile").contains(entry.getKey()))) throw invalidLanding();
        boolean video = "video".equals(text(mediaRecord(text(target, mediaField)), "kind"));
        ObjectNode result = mapper.createObjectNode();
        result.set("desktop", normalizePlacement(input.path("desktop"), video));
        if (input.has("mobile")) result.set("mobile", normalizePlacement(input.path("mobile"), video));
        validateVideoPlaybackDuration(result, mediaRecord(text(target, mediaField)));
        target.set(field, result);
    }

    private static void validateVideoPlaybackDuration(ObjectNode presentation, ObjectNode media) {
        if (media == null || !"video".equals(text(media, "kind"))) return;
        double physicalDuration = media.path("durationSeconds").asDouble(-1);
        for (String viewport : List.of("desktop", "mobile")) {
            JsonNode playback = presentation.path(viewport).path("playback");
            if (playback.isMissingNode()) continue;
            if (!Double.isFinite(physicalDuration) || physicalDuration <= 0) {
                throw new ApiException("Não foi possível confirmar a duração física deste vídeo para salvar o trecho.", 422);
            }
            double start = playback.path("startSeconds").asDouble();
            double selectedDuration = playback.has("durationSeconds") ? playback.path("durationSeconds").asDouble() : physicalDuration - start;
            if (start >= physicalDuration || start + selectedDuration > physicalDuration + 0.05) {
                throw new ApiException("O trecho selecionado ultrapassa a duração física do vídeo.", 422);
            }
        }
    }

    private ObjectNode normalizePlacement(JsonNode input, boolean video) {
        if (!(input instanceof ObjectNode placement) || !(placement.path("focalPoint") instanceof ObjectNode focal)) {
            throw invalidLanding();
        }
        ObjectNode result = mapper.createObjectNode();
        ObjectNode normalizedFocal = result.putObject("focalPoint");
        normalizedFocal.put("x", normalizedPercent(focal.get("x")));
        normalizedFocal.put("y", normalizedPercent(focal.get("y")));
        if (placement.has("playback")) {
            if (!video) throw invalidLanding();
            JsonNode rawPlayback = placement.get("playback");
            if (!(rawPlayback instanceof ObjectNode playback)) throw invalidLanding();
            double start = normalizedSeconds(playback.get("startSeconds"), true);
            ObjectNode normalizedPlayback = result.putObject("playback");
            normalizedPlayback.put("startSeconds", start);
            if (playback.has("durationSeconds")) normalizedPlayback.put("durationSeconds", normalizedSeconds(playback.get("durationSeconds"), false));
        }
        if (placement.size() > (placement.has("playback") ? 2 : 1)) throw invalidLanding();
        return result;
    }

    private static double normalizedPercent(JsonNode value) {
        if (value == null || !value.isNumber() || !Double.isFinite(value.asDouble()) || value.asDouble() < 0 || value.asDouble() > 100) throw invalidLanding();
        return value.asDouble();
    }

    private static double normalizedSeconds(JsonNode value, boolean permitsZero) {
        if (value == null || !value.isNumber() || !Double.isFinite(value.asDouble()) || value.asDouble() < (permitsZero ? 0 : 0.1) || value.asDouble() > 86_400) throw invalidLanding();
        return value.asDouble();
    }

    private static void validateUrl(ObjectNode target, String field) {
        String value = text(target, field);
        if (value.isBlank()) return;
        if (!(value.matches("^/(?!/).*") || value.matches("^(https:|mailto:|tel:).*$"))) throw invalidLanding();
    }

    private static void validateSlug(String slug) {
        if (slug.length() < 2 || slug.length() > 80 || !SLUG.matcher(slug).matches()) throw invalidLanding();
    }

    private static String normalizeSlug(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String validStatus(String value) {
        return Set.of("draft", "published", "unpublished", "archived").contains(value) ? value : "draft";
    }

    private static boolean previewIsActive(ObjectNode landing, Instant now) {
        String expiresAt = text(landing, "previewExpiresAt");
        try {
            return Instant.parse(expiresAt).isAfter(now);
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private static Instant scheduledInstant(ObjectNode body, String field) {
        if (!body.has(field) || body.path(field).isNull()) return null;
        if (!body.path(field).isTextual()) throw new ApiException("Programação inválida.", 422);
        try {
            return Instant.parse(body.path(field).asText());
        } catch (RuntimeException ignored) {
            throw new ApiException("Programação inválida.", 422);
        }
    }

    private static void setScheduledInstant(ObjectNode target, String field, Instant value) {
        if (value == null) target.remove(field);
        else target.put(field, value.toString());
    }

    private static void copyTimestamp(ObjectNode source, ObjectNode target, String field) {
        if (validTimestamp(text(source, field))) target.put(field, text(source, field));
    }

    private boolean applyScheduledTransitions(ObjectNode landing, Instant now) {
        if ("archived".equals(text(landing, "status"))) return false;
        boolean changed = false;
        String scheduledPublish = text(landing, "scheduledPublishAt");
        if (validTimestamp(scheduledPublish) && !Instant.parse(scheduledPublish).isAfter(now)
            && !"published".equals(text(landing, "status"))) {
            assertReadyToPublish(landing);
            landing.put("status", "published");
            landing.put("publishedAt", now.toString());
            landing.remove("scheduledPublishAt");
            changed = true;
        }
        String scheduledUnpublish = text(landing, "scheduledUnpublishAt");
        if (validTimestamp(scheduledUnpublish) && !Instant.parse(scheduledUnpublish).isAfter(now)
            && "published".equals(text(landing, "status"))) {
            landing.put("status", "unpublished");
            landing.remove("scheduledUnpublishAt");
            changed = true;
        }
        if (changed) landing.put("updatedAt", now.toString());
        return changed;
    }

    private ArrayNode normalizeRevisions(JsonNode source) {
        ArrayNode result = mapper.createArrayNode();
        if (!source.isArray()) return result;
        for (JsonNode value : source) {
            if (!(value instanceof ObjectNode revision) || result.size() >= MAX_REVISIONS) continue;
            String id = text(revision, "id");
            String operation = text(revision, "operation");
            String createdAt = text(revision, "createdAt");
            if (id.isBlank() || operation.isBlank() || !validTimestamp(createdAt)
                || !(revision.path("snapshot") instanceof ObjectNode snapshot)) continue;
            ObjectNode normalized = mapper.createObjectNode()
                .put("id", id)
                .put("operation", operation)
                .put("createdAt", createdAt);
            normalized.set("snapshot", snapshot.deepCopy());
            result.add(normalized);
        }
        return result;
    }

    private void addRevision(ObjectNode target, ObjectNode previous, String operation) {
        ArrayNode revisions = mapper.createArrayNode();
        ObjectNode revision = revisions.addObject();
        revision.put("id", "revision_" + UUID.randomUUID());
        revision.put("operation", operation);
        revision.put("createdAt", Instant.now().toString());
        revision.set("snapshot", revisionSnapshot(previous));
        JsonNode previousRevisions = previous.path("revisions");
        if (previousRevisions.isArray()) {
            for (JsonNode item : previousRevisions) {
                if (revisions.size() >= MAX_REVISIONS) break;
                revisions.add(item.deepCopy());
            }
        }
        target.set("revisions", revisions);
    }

    private static ObjectNode revisionSnapshot(ObjectNode source) {
        ObjectNode snapshot = source.deepCopy();
        snapshot.remove(List.of("id", "status", "createdAt", "updatedAt", "publishedAt", "previewToken", "previewExpiresAt", "scheduledPublishAt", "scheduledUnpublishAt", "revisions"));
        return snapshot;
    }

    private static ObjectNode revisionSnapshot(ObjectNode landing, String revisionId) {
        JsonNode revisions = landing.path("revisions");
        if (!revisions.isArray()) return null;
        for (JsonNode revision : revisions) {
            if (revisionId.equals(text(revision instanceof ObjectNode item ? item : null, "id"))
                && revision.path("snapshot") instanceof ObjectNode snapshot) return snapshot.deepCopy();
        }
        return null;
    }

    private String availableDuplicateSlug(String sourceSlug, ArrayNode landings) {
        String base = sourceSlug + "-copia";
        if (base.length() > 80) base = base.substring(0, 80).replaceAll("-+$", "");
        for (int index = 1; index < 10_000; index++) {
            String suffix = index == 1 ? "" : "-" + index;
            int limit = 80 - suffix.length();
            String candidate = base.length() <= limit ? base : base.substring(0, limit).replaceAll("-+$", "");
            candidate += suffix;
            try {
                assertSlugAvailable(candidate, null, landings);
                return candidate;
            } catch (ApiException ignored) {
                // Continua até encontrar uma rota livre sem expor a lista de campanhas.
            }
        }
        throw new ApiException("Não foi possível gerar uma rota para a cópia.", 422);
    }

    private static String duplicateName(String name) {
        String suffix = " (cópia)";
        return name.length() + suffix.length() <= 120 ? name + suffix : truncate(name, 120 - suffix.length()) + suffix;
    }

    private void assertReadyToPublish(ObjectNode landing) {
        ObjectNode seo = landing.path("seo") instanceof ObjectNode value ? value : mapper.createObjectNode();
        String title = text(seo, "title");
        String description = text(seo, "description");
        if (title.length() < 20 || description.length() < 50) {
            throw new ApiException("Preencha um título SEO com ao menos 20 caracteres e uma descrição SEO com ao menos 50 antes de publicar.", 422);
        }
        ObjectNode hero = (ObjectNode) landing.path("hero");
        boolean heroLabel = !text(hero, "ctaLabel").isBlank();
        boolean heroUrl = !text(hero, "ctaUrl").isBlank();
        if (heroLabel != heroUrl) throw new ApiException("O CTA principal precisa ter texto e destino antes da publicação.", 422);
        ObjectNode lower = (ObjectNode) landing.path("lowerSection");
        if (lower.path("visible").asBoolean(true)
            && (text(lower, "formTitle").isBlank() || text(lower, "submitLabel").isBlank())) {
            throw new ApiException("A seção de conversão precisa de título e texto do botão antes da publicação.", 422);
        }
        if (containsPlaceholder(title) || containsPlaceholder(description)
            || containsPlaceholder(text(hero, "title")) || containsPlaceholder(text(hero, "description"))) {
            throw new ApiException("Substitua os textos de orientação do template antes de publicar.", 422);
        }
    }

    private static boolean containsPlaceholder(String value) {
        String normalized = value.toLowerCase(Locale.ROOT);
        return normalized.contains("inclua aqui") || normalized.contains("descreva ")
            || normalized.contains("apresente ") || normalized.contains("sua empresa")
            || normalized.contains("nova campanha");
    }

    private List<String> referencedMediaUrls(ObjectNode landing) {
        List<String> result = new ArrayList<>();
        for (String value : List.of(
            landing.path("hero").path("logo").asText(""),
            landing.path("hero").path("backgroundImage").asText(""),
            landing.path("story").path("image").asText(""),
            landing.path("showcase").path("backgroundImage").asText(""),
            landing.path("finalCta").path("backgroundImage").asText("")
        )) if (!value.isBlank() && !result.contains(value)) result.add(value);
        return result;
    }

    private static boolean validTimestamp(String value) {
        try {
            Instant.parse(value);
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private static String createPreviewToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static boolean tokenMatches(String stored, String received) {
        if (!PREVIEW_TOKEN.matcher(stored).matches() || received == null || !PREVIEW_TOKEN.matcher(received).matches()) return false;
        return MessageDigest.isEqual(stored.getBytes(StandardCharsets.UTF_8), received.getBytes(StandardCharsets.UTF_8));
    }

    private static ObjectNode loadDefaults(ObjectMapper mapper) {
        try (InputStream stream = CampaignService.class.getResourceAsStream("/campaign-v1-default.json")) {
            JsonNode value = mapper.readTree(stream);
            if (value instanceof ObjectNode object) return object;
        } catch (IOException | NullPointerException ignored) {
            // The application cannot safely serve or mutate an unknown template.
        }
        throw new IllegalStateException("Contrato campaign-v1 indisponível.");
    }

    private static ObjectNode section(ObjectNode source, String field) {
        JsonNode value = source.get(field);
        if (value == null || value.isNull()) return source.objectNode();
        if (value instanceof ObjectNode object) return object;
        throw invalidLanding();
    }

    private static ObjectNode objectOrEmpty(JsonNode value) {
        if (value == null || value.isNull()) return new ObjectMapper().createObjectNode();
        if (value instanceof ObjectNode object) return object;
        throw invalidLanding();
    }

    private static String requireText(ObjectNode source, String field, int maximum) {
        JsonNode value = source.get(field);
        if (value == null || !value.isTextual()) throw invalidLanding();
        String text = value.asText().trim();
        if (text.length() > maximum) throw invalidLanding();
        return text;
    }

    private static String optionalText(ObjectNode source, String field, int maximum, String fallback) {
        return source.has(field) ? requireText(source, field, maximum) : fallback;
    }

    private static void copyIfText(ObjectNode source, ObjectNode target, String field, int maximum) {
        if (source.has(field)) target.put(field, requireText(source, field, maximum));
    }

    private static void copyTextFields(ObjectNode target, ObjectNode source, String[] fields, int[] limits) {
        for (int index = 0; index < fields.length; index++) copyIfText(source, target, fields[index], limits[index]);
    }

    private static void copyVisible(ObjectNode target, ObjectNode source) {
        if (!source.has("visible")) return;
        if (!source.path("visible").isBoolean()) throw invalidLanding();
        target.put("visible", source.path("visible").asBoolean());
    }

    private static boolean optionalBoolean(ObjectNode source, String field, boolean fallback) {
        if (!source.has(field)) return fallback;
        if (!source.path(field).isBoolean()) throw invalidLanding();
        return source.path(field).asBoolean();
    }

    private static void validateOptionalIdentifier(ObjectNode source, ObjectNode target, String field, int maximum, Pattern pattern) {
        if (!source.has(field)) return;
        String value = requireText(source, field, maximum);
        if (!value.isBlank() && !pattern.matcher(value).matches()) throw invalidLanding();
        target.put(field, value);
    }

    private static boolean legacyFeedbackProvided(ObjectNode source) {
        return !text(source, "quote").isBlank() || !text(source, "author").isBlank() || !text(source, "role").isBlank();
    }

    private static boolean containsString(JsonNode value, String expected) {
        if (value.isTextual()) return expected.equals(value.asText());
        if (value.isArray()) {
            for (JsonNode child : value) if (containsString(child, expected)) return true;
        }
        if (value.isObject()) {
            for (var entry : value.properties()) if (containsString(entry.getValue(), expected)) return true;
        }
        return false;
    }

    private static List<ObjectNode> nodes(ArrayNode array) {
        List<ObjectNode> result = new ArrayList<>();
        for (JsonNode value : array) if (value instanceof ObjectNode object) result.add(object);
        return result;
    }

    private static String text(JsonNode value, String field) {
        return value == null ? "" : value.path(field).asText("");
    }

    private static String updatedAt(ObjectNode value) {
        return text(value, "updatedAt");
    }

    private static String truncate(String value, int maximum) {
        return value.length() <= maximum ? value : value.substring(0, maximum);
    }

    private static ApiException invalidLanding() {
        return new ApiException("Revise os campos da landing page.", 422);
    }
}
