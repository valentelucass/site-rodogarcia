package br.com.rodogarcia.cms.backend.service.content;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import br.com.rodogarcia.cms.backend.service.MediaMetadataReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Acrescenta somente metadados físicos persistidos ou confirmados nos arquivos
 * internos. Campos homônimos recebidos no conteúdo nunca são confiados.
 */
@Component
public final class PublicMediaCatalog {
    private static final Set<String> PUBLIC_DERIVATIVE_FIELDS = Set.of(
        "width", "height", "optimizedWidth", "optimizedHeight",
        "thumbnailUrl", "thumbnailWidth", "thumbnailHeight",
        "mediumUrl", "mediumWidth", "mediumHeight",
        "largeUrl", "largeWidth", "largeHeight"
    );
    private final JsonFileStore store;
    private final StoragePaths paths;
    private final ContentMediaValidator mediaValidator;
    private final Path uploadsRoot;
    private final Path publicRoot;
    private final MediaMetadataReader metadataReader;

    @Autowired
    public PublicMediaCatalog(
        JsonFileStore store,
        StoragePaths paths,
        ContentMediaValidator mediaValidator,
        CmsProperties properties,
        MediaMetadataReader metadataReader
    ) {
        this.store = store;
        this.paths = paths;
        this.mediaValidator = mediaValidator;
        this.uploadsRoot = properties.uploadsDir().toAbsolutePath().normalize();
        this.publicRoot = properties.frontendPublicDir().toAbsolutePath().normalize();
        this.metadataReader = metadataReader;
    }

    public void enrich(JsonNode root) {
        EnrichmentContext context = new EnrichmentContext();
        Map<String, ImageMetadata> catalog = catalog(context);
        visit(root, catalog, context);
    }

    private Map<String, ImageMetadata> catalog(EnrichmentContext context) {
        Map<String, ImageMetadata> result = new HashMap<>();
        for (JsonNode value : store.readArray(paths.mediaLibrary())) {
            if (!value.isObject()) continue;
            ObjectNode record = (ObjectNode) value;
            String mediaType = record.path("mediaType").asString();
            if (!mediaType.isEmpty() && !mediaType.equals("image")) continue;
            String url = knownImage(record.get("url"), context);
            String optimizedUrl = knownImage(record.get("optimizedUrl"), context);
            if (!optimizedUrl.isEmpty()) {
                result.put(optimizedUrl, metadata(record, optimizedUrl, true, context));
            }
            if (!url.isEmpty() && !url.equals(optimizedUrl)) {
                result.put(url, metadata(record, url, optimizedUrl.isEmpty(), context));
            }
        }
        return result;
    }

    private ImageMetadata metadata(
        ObjectNode record,
        String source,
        boolean optimizedSource,
        EnrichmentContext context
    ) {
        DimensionPair sourceDimensions = dimensions(
            record,
            optimizedSource ? "optimizedWidth" : "width",
            optimizedSource ? "optimizedHeight" : "height",
            source,
            context
        );
        String thumbnailUrl = knownImage(record.get("thumbnailUrl"), context);
        DimensionPair thumbnailDimensions = dimensions(
            record, "thumbnailWidth", "thumbnailHeight", thumbnailUrl, context
        );
        String mediumUrl = knownImage(record.get("mediumUrl"), context);
        DimensionPair mediumDimensions = dimensions(
            record, "mediumWidth", "mediumHeight", mediumUrl, context
        );
        String largeUrl = knownImage(record.get("largeUrl"), context);
        DimensionPair largeDimensions = dimensions(
            record, "largeWidth", "largeHeight", largeUrl, context
        );
        return new ImageMetadata(
            sourceDimensions.width(),
            sourceDimensions.height(),
            thumbnailUrl,
            thumbnailDimensions.width(),
            thumbnailDimensions.height(),
            mediumUrl,
            mediumDimensions.width(),
            mediumDimensions.height(),
            largeUrl,
            largeDimensions.width(),
            largeDimensions.height()
        );
    }

    private void visit(
        JsonNode value,
        Map<String, ImageMetadata> catalog,
        EnrichmentContext context
    ) {
        if (value == null) return;
        if (value.isArray()) {
            for (JsonNode item : (ArrayNode) value) visit(item, catalog, context);
            return;
        }
        if (!value.isObject()) return;
        ObjectNode object = (ObjectNode) value;
        if (object.has("src")) enrichObject(object, catalog, context);
        object.properties().forEach(entry -> visit(entry.getValue(), catalog, context));
    }

    private void enrichObject(
        ObjectNode target,
        Map<String, ImageMetadata> catalog,
        EnrichmentContext context
    ) {
        PUBLIC_DERIVATIVE_FIELDS.forEach(target::remove);
        String desktopSrc = mediaValidator.normalize(target.get("desktopSrc"));
        JsonNode sourceValue = desktopSrc.isEmpty() ? target.get("src") : target.get("desktopSrc");
        String src = knownImage(sourceValue, context);
        if (src.isEmpty()) return;
        ImageMetadata metadata = catalog.get(src);
        if (metadata == null) {
            context.dimensions(src).ifPresent(dimensions -> putDimensions(
                target,
                "width",
                "height",
                dimensions.width(),
                dimensions.height()
            ));
            return;
        }
        putDimensions(target, "width", "height", metadata.width(), metadata.height());
        putDerivative(
            target,
            "thumbnail",
            metadata.thumbnailUrl(),
            metadata.thumbnailWidth(),
            metadata.thumbnailHeight()
        );
        putDerivative(
            target, "medium", metadata.mediumUrl(), metadata.mediumWidth(), metadata.mediumHeight()
        );
        putDerivative(
            target, "large", metadata.largeUrl(), metadata.largeWidth(), metadata.largeHeight()
        );
    }

    private void putDerivative(ObjectNode target, String name, String url, int width, int height) {
        if (url.isEmpty() || width <= 0 || height <= 0) return;
        target.put(name + "Url", url);
        target.put(name + "Width", width);
        target.put(name + "Height", height);
    }

    private String knownImage(JsonNode value, EnrichmentContext context) {
        if (!safeInternalPath(value)) return "";
        String normalized = mediaValidator.normalize(value);
        return !normalized.isEmpty()
            && mediaValidator.isKnownImage(normalized)
            && context.file(normalized).isPresent()
                ? normalized
                : "";
    }

    private DimensionPair dimensions(
        ObjectNode record,
        String widthField,
        String heightField,
        String url,
        EnrichmentContext context
    ) {
        int width = positiveDimension(record.get(widthField));
        int height = positiveDimension(record.get(heightField));
        if (width > 0 && height > 0) return new DimensionPair(width, height);
        return context.dimensions(url)
            .map(value -> new DimensionPair(value.width(), value.height()))
            .orElse(DimensionPair.EMPTY);
    }

    private static boolean safeInternalPath(JsonNode value) {
        String raw = ContentJson.text(value, 600);
        if (raw.isEmpty()
            || !raw.startsWith("/")
            || raw.startsWith("//")
            || raw.indexOf('\\') >= 0
            || raw.indexOf('?') >= 0
            || raw.indexOf('#') >= 0
            || raw.indexOf('%') >= 0
            || ContentJson.hasScheme(raw)) {
            return false;
        }
        for (String segment : raw.split("/+")) {
            if (segment.equals(".") || segment.equals("..")) return false;
        }
        return true;
    }

    private static int positiveDimension(JsonNode value) {
        if (value == null || !value.isIntegralNumber()) return 0;
        int dimension = value.asInt();
        return dimension > 0 && dimension <= 100_000 ? dimension : 0;
    }

    private static void putDimensions(
        ObjectNode target,
        String widthField,
        String heightField,
        int width,
        int height
    ) {
        if (width <= 0 || height <= 0) return;
        target.put(widthField, width);
        target.put(heightField, height);
    }

    private Optional<Path> safeFile(String url) {
        if (url == null || url.isEmpty()) return Optional.empty();
        Path root = url.startsWith("/uploads/") ? uploadsRoot : publicRoot;
        String relative = url.startsWith("/uploads/")
            ? url.substring("/uploads/".length())
            : url.substring(1);
        if (relative.isEmpty()) return Optional.empty();
        try {
            Path resolved = root.resolve(relative).toAbsolutePath().normalize();
            if (!resolved.startsWith(root)
                || resolved.equals(root)
                || !Files.isRegularFile(resolved, LinkOption.NOFOLLOW_LINKS)) {
                return Optional.empty();
            }
            Path realRoot = root.toRealPath();
            Path realFile = resolved.toRealPath();
            return realFile.startsWith(realRoot) && !realFile.equals(realRoot)
                ? Optional.of(realFile)
                : Optional.empty();
        } catch (IOException | RuntimeException ignored) {
            return Optional.empty();
        }
    }

    private final class EnrichmentContext {
        private final Map<String, Optional<Path>> files = new HashMap<>();
        private final Map<String, Optional<MediaMetadataReader.Dimensions>> dimensions = new HashMap<>();

        Optional<Path> file(String url) {
            return files.computeIfAbsent(url, PublicMediaCatalog.this::safeFile);
        }

        Optional<MediaMetadataReader.Dimensions> dimensions(String url) {
            if (url == null || url.isEmpty()) return Optional.empty();
            return dimensions.computeIfAbsent(
                url,
                key -> file(key).flatMap(metadataReader::image)
            );
        }
    }

    private record DimensionPair(int width, int height) {
        private static final DimensionPair EMPTY = new DimensionPair(0, 0);
    }

    private record ImageMetadata(
        int width,
        int height,
        String thumbnailUrl,
        int thumbnailWidth,
        int thumbnailHeight,
        String mediumUrl,
        int mediumWidth,
        int mediumHeight,
        String largeUrl,
        int largeWidth,
        int largeHeight
    ) {
    }
}
