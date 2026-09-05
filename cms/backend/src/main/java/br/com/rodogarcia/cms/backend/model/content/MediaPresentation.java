package br.com.rodogarcia.cms.backend.model.content;

import java.util.Map;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Normaliza a apresentação de um arquivo dentro de um quadro de conteúdo.
 * O valor não é uma edição do arquivo da biblioteca: cada chamada produz dados
 * que serão persistidos no próprio local em que a mídia aparece.
 */
public final class MediaPresentation {
    public static final double MIN_FOCAL_POINT = 0D;
    public static final double MAX_FOCAL_POINT = 100D;
    public static final double MAX_VIDEO_TIME_SECONDS = 86_400D;

    private static final Map<String, Point> LEGACY_POSITIONS = Map.of(
        "object-top", new Point(50D, 0D),
        "object-bottom", new Point(50D, 100D),
        "object-left", new Point(0D, 50D),
        "object-right", new Point(100D, 50D),
        "object-[50%_45%]", new Point(50D, 45D)
    );
    private static final Point CENTER = new Point(50D, 50D);

    private MediaPresentation() {
    }

    public static ObjectNode normalize(
        ObjectMapper mapper,
        JsonNode rawValue,
        boolean video,
        String legacyPosition
    ) {
        ObjectNode source = ContentJson.object(rawValue);
        ObjectNode result = mapper.createObjectNode();
        ObjectNode desktop = placement(
            mapper,
            source.get("desktop"),
            video,
            pointFromLegacyPosition(legacyPosition),
            null
        );
        result.set("desktop", desktop);

        JsonNode mobile = source.get("mobile");
        if (mobile != null && mobile.isObject()) {
            result.set("mobile", placement(mapper, mobile, video, CENTER, desktop));
        }
        return result;
    }

    public static Point pointFromLegacyPosition(String value) {
        return LEGACY_POSITIONS.getOrDefault(value == null ? "" : value, CENTER);
    }

    private static ObjectNode placement(
        ObjectMapper mapper,
        JsonNode rawValue,
        boolean video,
        Point defaultPoint,
        ObjectNode inherited
    ) {
        ObjectNode source = ContentJson.object(rawValue);
        ObjectNode result = mapper.createObjectNode();
        Point fallback = inherited == null ? defaultPoint : focalPoint(inherited.get("focalPoint"), defaultPoint);
        result.set("focalPoint", focalPointNode(mapper, source.get("focalPoint"), fallback));
        if (!video) return result;

        JsonNode rawPlayback = source.get("playback");
        if (rawPlayback != null && rawPlayback.isObject()) {
            double inheritedStart = inherited == null ? 0D : playbackStart(inherited.get("playback"));
            result.set("playback", playback(mapper, rawPlayback, inheritedStart));
        } else if (inherited != null && inherited.path("playback").isObject()) {
            result.set("playback", inherited.path("playback").deepCopy());
        } else {
            result.set("playback", playback(mapper, null, 0D));
        }
        return result;
    }

    private static ObjectNode focalPointNode(ObjectMapper mapper, JsonNode rawValue, Point fallback) {
        Point value = focalPoint(rawValue, fallback);
        ObjectNode result = mapper.createObjectNode();
        putNumber(result, "x", value.x());
        putNumber(result, "y", value.y());
        return result;
    }

    private static Point focalPoint(JsonNode rawValue, Point fallback) {
        ObjectNode source = ContentJson.object(rawValue);
        return new Point(
            bounded(source.get("x"), fallback.x(), MIN_FOCAL_POINT, MAX_FOCAL_POINT),
            bounded(source.get("y"), fallback.y(), MIN_FOCAL_POINT, MAX_FOCAL_POINT)
        );
    }

    private static ObjectNode playback(ObjectMapper mapper, JsonNode rawValue, double fallbackStart) {
        ObjectNode source = ContentJson.object(rawValue);
        ObjectNode result = mapper.createObjectNode();
        putNumber(result, "startSeconds", bounded(source.get("startSeconds"), fallbackStart, 0D, MAX_VIDEO_TIME_SECONDS));
        Double duration = positiveBounded(source.get("durationSeconds"));
        if (duration != null) putNumber(result, "durationSeconds", duration);
        return result;
    }

    private static double playbackStart(JsonNode rawValue) {
        return bounded(ContentJson.object(rawValue).get("startSeconds"), 0D, 0D, MAX_VIDEO_TIME_SECONDS);
    }

    private static double bounded(JsonNode rawValue, double fallback, double minimum, double maximum) {
        if (rawValue == null || !rawValue.isNumber()) return fallback;
        double value = rawValue.doubleValue();
        return Double.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
    }

    private static Double positiveBounded(JsonNode rawValue) {
        if (rawValue == null || !rawValue.isNumber()) return null;
        double value = rawValue.doubleValue();
        return Double.isFinite(value) && value > 0D && value <= MAX_VIDEO_TIME_SECONDS ? value : null;
    }

    private static void putNumber(ObjectNode target, String field, double value) {
        if (value == Math.rint(value)) target.put(field, (int) value);
        else target.put(field, value);
    }

    public record Point(double x, double y) {
    }
}
