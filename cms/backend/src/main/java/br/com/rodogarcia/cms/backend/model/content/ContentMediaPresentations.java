package br.com.rodogarcia.cms.backend.model.content;

import java.util.Locale;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/** Applies the per-placement media schema to every canonical content location. */
public final class ContentMediaPresentations {
    private ContentMediaPresentations() {
    }

    public static boolean normalizeContent(ObjectNode content, ObjectMapper mapper) {
        boolean changed = normalizeHome(content, mapper);
        changed |= normalizeServices(content, mapper);
        changed |= normalizePageMedia(content, mapper);
        return changed;
    }

    private static boolean normalizeHome(ObjectNode content, ObjectMapper mapper) {
        ObjectNode home = ContentJson.object(content.get("homePage"));
        boolean changed = false;
        changed |= normalizeMediaRecords(ContentJson.array(home.path("hero").get("slides")), mapper);
        changed |= normalizeMediaRecords(ContentJson.array(home.path("section1").get("items")), mapper);
        changed |= normalizeMediaRecords(ContentJson.array(home.path("section2").get("items")), mapper);
        changed |= normalizeMediaRecords(ContentJson.array(home.path("section3").get("cards")), mapper);
        return changed;
    }

    private static boolean normalizeServices(ObjectNode content, ObjectMapper mapper) {
        ObjectNode services = ContentJson.object(content.get("servicesPage"));
        boolean changed = false;
        for (JsonNode raw : ContentJson.array(services.get("modules"))) {
            ObjectNode module = ContentJson.object(raw);
            JsonNode imageValue = module.get("image");
            if (imageValue == null || !imageValue.isObject()) continue;
            ObjectNode image = (ObjectNode) imageValue;
            changed |= normalizePresentation(image, false, ContentJson.text(image.get("position"), 60), mapper);
        }
        return changed;
    }

    private static boolean normalizePageMedia(ObjectNode content, ObjectMapper mapper) {
        boolean changed = false;
        ObjectNode about = ContentJson.object(content.get("aboutPage"));
        changed |= normalizeMediaAt(ContentJson.object(about.get("hero")), "media", mapper);
        ObjectNode compliance = ContentJson.object(about.get("compliance"));
        changed |= normalizeMediaAt(compliance, "image", mapper);
        for (JsonNode raw : ContentJson.array(compliance.get("certifications"))) {
            changed |= normalizeMediaAt(ContentJson.object(raw), "image", mapper);
        }

        ObjectNode careers = ContentJson.object(content.get("careersPage"));
        changed |= normalizeMediaAt(careers, "cultureImage", mapper);
        return changed;
    }

    private static boolean normalizeMediaRecords(ArrayNode records, ObjectMapper mapper) {
        boolean changed = false;
        for (JsonNode raw : records) {
            changed |= normalizeMediaAt(ContentJson.object(raw), "media", mapper);
        }
        return changed;
    }

    private static boolean normalizeMediaAt(ObjectNode parent, String field, ObjectMapper mapper) {
        JsonNode mediaValue = parent.get(field);
        if (mediaValue == null || !mediaValue.isObject()) return false;
        ObjectNode media = (ObjectNode) mediaValue;
        return normalizePresentation(media, isVideo(media), "", mapper);
    }

    private static boolean normalizePresentation(
        ObjectNode media,
        boolean video,
        String legacyPosition,
        ObjectMapper mapper
    ) {
        ObjectNode normalized = MediaPresentation.normalize(
            mapper, media.get("presentation"), video, legacyPosition
        );
        JsonNode current = media.get("presentation");
        if (normalized.equals(current)) return false;
        media.set("presentation", normalized);
        return true;
    }

    private static boolean isVideo(ObjectNode media) {
        if ("video".equals(ContentJson.text(media.get("type"), 20))) return true;
        String source = ContentJson.text(media.get("src"), 600).toLowerCase(Locale.ROOT);
        return source.endsWith(".mp4") || source.endsWith(".webm") || source.endsWith(".ogg");
    }
}
