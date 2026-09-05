package br.com.rodogarcia.cms.backend.service.content;

import java.util.Locale;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.Set;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.StringNode;

public final class TestContentMediaValidator implements ContentMediaValidator {
    private static final Set<String> IMAGES = Set.of("png", "jpg", "jpeg", "webp", "gif", "svg", "avif");
    private static final Set<String> VIDEOS = Set.of("mp4", "webm", "ogg");
    private final Map<String, Double> videoDurations;

    public TestContentMediaValidator() {
        this(Map.of());
    }

    public TestContentMediaValidator(Map<String, Double> videoDurations) {
        this.videoDurations = Map.copyOf(videoDurations);
    }

    @Override
    public String image(JsonNode value, String label) {
        return media(value, label, IMAGES);
    }

    @Override
    public String video(JsonNode value, String label) {
        return media(value, label, VIDEOS);
    }

    @Override
    public String media(JsonNode value, String label) {
        String result = normalize(value);
        if (result.isEmpty() && !ContentJson.text(value, 600).isEmpty()) {
            throw new ApiException(422, label + ": use somente arquivos internos da biblioteca de mídia.");
        }
        return result;
    }

    @Override
    public String normalize(JsonNode value) {
        String raw = ContentJson.text(value, 600);
        if (raw.isEmpty() || ContentJson.hasScheme(raw)) return "";
        if (raw.startsWith("/public/")) raw = raw.substring("/public".length());
        return ContentJson.path(StringNode.valueOf(raw));
    }

    @Override
    public boolean isKnownImage(String value) {
        return !normalize(StringNode.valueOf(value)).isEmpty() && IMAGES.contains(extension(value));
    }

    @Override
    public OptionalDouble videoDuration(String value) {
        Double duration = videoDurations.get(normalize(StringNode.valueOf(value)));
        return duration != null && Double.isFinite(duration) && duration > 0
            ? OptionalDouble.of(duration) : OptionalDouble.empty();
    }

    private String media(JsonNode value, String label, Set<String> types) {
        String result = media(value, label);
        if (!result.isEmpty() && !types.contains(extension(result))) {
            throw new ApiException(422, label + ": tipo de arquivo incompatível com o campo.");
        }
        return result;
    }

    private static String extension(String value) {
        int index = value.lastIndexOf('.');
        return index < 0 ? "" : value.substring(index + 1).toLowerCase(Locale.ROOT);
    }
}
