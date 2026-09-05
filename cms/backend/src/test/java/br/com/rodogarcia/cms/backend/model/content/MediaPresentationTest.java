package br.com.rodogarcia.cms.backend.model.content;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class MediaPresentationTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void defaultsToCenterAndLetsMobileInheritDesktopPlayback() {
        ObjectNode source = mapper.createObjectNode();
        ObjectNode desktop = source.putObject("desktop");
        desktop.putObject("focalPoint").put("x", 24).put("y", 76);
        desktop.putObject("playback").put("startSeconds", 5).put("durationSeconds", 10);
        source.putObject("mobile").putObject("focalPoint").put("x", 80).put("y", 20);

        ObjectNode normalized = MediaPresentation.normalize(mapper, source, true, "");

        assertThat(normalized.path("desktop").path("focalPoint").path("x").asInt()).isEqualTo(24);
        assertThat(normalized.path("mobile").path("focalPoint").path("y").asInt()).isEqualTo(20);
        assertThat(normalized.path("mobile").path("playback"))
            .isEqualTo(normalized.path("desktop").path("playback"));
        assertThat(MediaPresentation.normalize(mapper, null, false, "").path("desktop")
            .path("focalPoint").path("x").asInt()).isEqualTo(50);
    }

    @Test
    void rejectsOutOfRangeFocusAndInvalidPlaybackValues() {
        ObjectNode source = mapper.createObjectNode();
        ObjectNode desktop = source.putObject("desktop");
        desktop.putObject("focalPoint").put("x", 101).put("y", -1);
        desktop.putObject("playback").put("startSeconds", -2).put("durationSeconds", 0);

        ObjectNode normalized = MediaPresentation.normalize(mapper, source, true, "");

        assertThat(normalized.path("desktop").path("focalPoint").path("x").asInt()).isEqualTo(50);
        assertThat(normalized.path("desktop").path("focalPoint").path("y").asInt()).isEqualTo(50);
        assertThat(normalized.path("desktop").path("playback").path("startSeconds").asInt()).isZero();
        assertThat(normalized.path("desktop").path("playback").has("durationSeconds")).isFalse();
    }

    @Test
    void mapsLegacyServicePositionsWithoutChangingTheSourceField() {
        ObjectNode normalized = MediaPresentation.normalize(mapper, null, false, "object-[50%_45%]");

        assertThat(normalized.path("desktop").path("focalPoint").path("x").asInt()).isEqualTo(50);
        assertThat(normalized.path("desktop").path("focalPoint").path("y").asInt()).isEqualTo(45);
    }
}
