package br.com.rodogarcia.cms.backend.service.content;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

/**
 * Acrescenta somente metadados físicos persistidos pelo pipeline de uploads.
 * Campos homônimos recebidos no conteúdo nunca são confiados; variantes
 * legadas sem dimensões comprovadas permanecem fora do DTO público.
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

    public PublicMediaCatalog(
        JsonFileStore store,
        StoragePaths paths,
        ContentMediaValidator mediaValidator
    ) {
        this.store = store;
        this.paths = paths;
        this.mediaValidator = mediaValidator;
    }

    public void enrich(JsonNode root) {
        Map<String, ImageMetadata> catalog = catalog();
        visit(root, catalog);
    }

    private Map<String, ImageMetadata> catalog() {
        Map<String, ImageMetadata> result = new HashMap<>();
        for (JsonNode value : store.readArray(paths.mediaLibrary())) {
            if (!value.isObject()) continue;
            ObjectNode record = (ObjectNode) value;
            String mediaType = record.path("mediaType").asString();
            if (!mediaType.isEmpty() && !mediaType.equals("image")) continue;
            String url = knownImage(firstPresent(record, "url", "optimizedUrl"));
            if (url.isEmpty()) continue;
            ImageMetadata metadata = new ImageMetadata(
                positiveDimension(record.get("optimizedWidth")),
                positiveDimension(record.get("optimizedHeight")),
                knownImage(record.get("thumbnailUrl")),
                positiveDimension(record.get("thumbnailWidth")),
                positiveDimension(record.get("thumbnailHeight")),
                knownImage(record.get("mediumUrl")),
                positiveDimension(record.get("mediumWidth")),
                positiveDimension(record.get("mediumHeight")),
                knownImage(record.get("largeUrl")),
                positiveDimension(record.get("largeWidth")),
                positiveDimension(record.get("largeHeight"))
            );
            result.put(url, metadata);
            String optimizedUrl = knownImage(record.get("optimizedUrl"));
            if (!optimizedUrl.isEmpty()) result.put(optimizedUrl, metadata);
        }
        return result;
    }

    private void visit(JsonNode value, Map<String, ImageMetadata> catalog) {
        if (value == null) return;
        if (value.isArray()) {
            for (JsonNode item : (ArrayNode) value) visit(item, catalog);
            return;
        }
        if (!value.isObject()) return;
        ObjectNode object = (ObjectNode) value;
        if (object.has("src")) enrichObject(object, catalog);
        object.properties().forEach(entry -> visit(entry.getValue(), catalog));
    }

    private void enrichObject(ObjectNode target, Map<String, ImageMetadata> catalog) {
        PUBLIC_DERIVATIVE_FIELDS.forEach(target::remove);
        String desktopSrc = mediaValidator.normalize(target.get("desktopSrc"));
        String src = desktopSrc.isEmpty()
            ? mediaValidator.normalize(target.get("src"))
            : desktopSrc;
        ImageMetadata metadata = catalog.get(src);
        if (metadata == null) return;
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

    private String knownImage(JsonNode value) {
        String normalized = mediaValidator.normalize(value);
        return !normalized.isEmpty() && mediaValidator.isKnownImage(normalized) ? normalized : "";
    }

    private static JsonNode firstPresent(ObjectNode value, String... fields) {
        for (String field : fields) {
            JsonNode candidate = value.get(field);
            if (candidate != null && !candidate.isNull() && !candidate.asString().isEmpty()) {
                return candidate;
            }
        }
        return StringNode.valueOf("");
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
