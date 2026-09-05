package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentDefaults;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class HomeContentAdminServiceTest {
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final HomeContentAdminService home = new HomeContentAdminService(
        mapper, new TestContentMediaValidator());

    @Test
    void keepsTheCanonicalHomeShapeAndExplicitlyEmptyQuickActions() {
        ObjectNode normalized = home.normalize(ContentDefaults.home(mapper));

        assertThat(normalized.path("hero").path("slides").size()).isZero();
        assertThat(normalized.path("quickActions").size()).isEqualTo(8);
        assertThat(normalized.path("trackingCta").path("buttons").size()).isEqualTo(2);

        ObjectNode payload = mapper.createObjectNode();
        payload.set("quickActions", mapper.createArrayNode());
        ObjectNode updated = home.replaceSection(normalized, "quickActions", payload);
        assertThat(updated.path("quickActions").isEmpty()).isTrue();
    }

    @Test
    void rejectsEnabledQuickActionsOutsideTheAllowlist() {
        ObjectNode payload = mapper.createObjectNode();
        ArrayNode actions = payload.putArray("quickActions");
        actions.addObject().put("label", "Atalho").put("icon", "Script")
            .put("href", "/cotacao").put("enabled", true);

        assertThatThrownBy(() -> home.replaceSection(ContentDefaults.home(mapper), "quickActions", payload))
            .isInstanceOf(ApiException.class)
            .hasMessage("Atalho 1: texto e ícone válido são obrigatórios.");
    }

    @Test
    void rejectsVideoModeWithAnImageAsset() {
        ObjectNode payload = mapper.createObjectNode();
        ObjectNode slide = payload.putArray("slides").addObject();
        slide.put("title", "Título").put("description", "Descrição").put("mode", "text-media");
        slide.putObject("media").put("type", "video").put("src", "/foto.webp").put("alt", "Foto");

        assertThatThrownBy(() -> home.replaceSection(ContentDefaults.home(mapper), "hero", payload))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("tipo de arquivo incompatível");
    }

    @Test
    void normalizesPresentationPerHomeMediaUse() {
        ObjectNode payload = mapper.createObjectNode();
        ObjectNode slide = payload.putArray("slides").addObject();
        slide.put("title", "Título").put("description", "Descrição").put("mode", "text-media");
        ObjectNode media = slide.putObject("media");
        media.put("type", "video").put("src", "/video.webm").put("alt", "Vídeo");
        media.putObject("presentation").putObject("desktop")
            .putObject("focalPoint").put("x", 15).put("y", 85);

        ObjectNode result = home.replaceSection(ContentDefaults.home(mapper), "hero", payload);

        assertThat(result.path("hero").path("slides").get(0).path("media")
            .path("presentation").path("desktop").path("focalPoint").path("x").asInt())
            .isEqualTo(15);
        assertThat(result.path("hero").path("slides").get(0).path("media")
            .path("presentation").path("desktop").path("playback").path("startSeconds").asInt())
            .isZero();
    }

    @Test
    void rejectsVideoRangesOutsideTheConfirmedPhysicalDuration() {
        HomeContentAdminService durationAwareHome = new HomeContentAdminService(
            mapper, new TestContentMediaValidator(Map.of("/video.webm", 10D))
        );
        ObjectNode payload = mapper.createObjectNode();
        ObjectNode slide = payload.putArray("slides").addObject();
        slide.put("title", "Título").put("description", "Descrição").put("mode", "text-media");
        ObjectNode media = slide.putObject("media");
        media.put("type", "video").put("src", "/video.webm").put("alt", "Vídeo");
        media.putObject("presentation").putObject("desktop").putObject("playback")
            .put("startSeconds", 8).put("durationSeconds", 3);

        assertThatThrownBy(() -> durationAwareHome.replaceSection(
            ContentDefaults.home(mapper), "hero", payload
        )).isInstanceOf(ApiException.class)
            .hasMessageContaining("fim do trecho ultrapassa");
    }
}
