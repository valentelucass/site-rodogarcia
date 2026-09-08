package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentDefaults;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class ContentValidatorsTest {
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final ContentValidators validators = new ContentValidators();

    @Test
    void requiresExactlyThreeIndicatorsForTheAboutHero() {
        ObjectNode hero = ContentDefaults.page(mapper, "about").withObject("hero");
        hero.putArray("stats");

        assertThatThrownBy(() -> validators.page("about", "hero", hero))
            .isInstanceOf(ApiException.class)
            .hasMessage("Sobre / Hero: informe exatamente 3 indicadores.");
    }
}
