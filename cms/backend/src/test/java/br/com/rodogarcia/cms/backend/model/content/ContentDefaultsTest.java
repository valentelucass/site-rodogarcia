package br.com.rodogarcia.cms.backend.model.content;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class ContentDefaultsTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void decodesTheCanonicalNodeDefaultsWithoutLosingDynamicCollections() {
        ObjectNode content = ContentDefaults.content(mapper);

        assertThat(content.path("homePage").path("hero").path("slides").size()).isZero();
        assertThat(content.path("homePage").path("quickActions").size()).isEqualTo(8);
        assertThat(content.path("servicesPage").path("modules").size()).isZero();
        assertThat(content.path("servicesPage").path("faq").path("items").size()).isZero();
        assertThat(content.path("footerLinks").path("help").path("faq").path("items").size()).isEqualTo(6);
        assertThat(content.path("headerNavigation").path("items").size()).isEqualTo(10);
        assertThat(content.has("improvementsPage")).isTrue();
        assertThat(content.path("aboutPage").path("hero").path("media")
            .path("presentation").path("desktop").path("focalPoint").path("x").asInt())
            .isEqualTo(50);
    }

    @Test
    void returnsIndependentTreesForEveryRead() {
        ObjectNode first = ContentDefaults.content(mapper);
        first.remove("homePage");

        assertThat(ContentDefaults.content(mapper).has("homePage")).isTrue();
    }
}
