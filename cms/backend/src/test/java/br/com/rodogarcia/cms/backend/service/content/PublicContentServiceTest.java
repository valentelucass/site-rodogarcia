package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import br.com.rodogarcia.cms.backend.repository.content.ContentRepository;
import br.com.rodogarcia.cms.backend.repository.content.MediaSlotsRepository;
import br.com.rodogarcia.cms.backend.repository.content.SiteTextsRepository;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class PublicContentServiceTest {
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final TestContentMediaValidator media = new TestContentMediaValidator();

    @Test
    void keepsNodeMapThenFilterIndexesAndRequiresACompleteServicesFaq() {
        PublicContentService service = serviceWith(mapper.createObjectNode());
        ObjectNode input = mapper.createObjectNode();
        ObjectNode faq = input.putObject("faq").put("title", "FAQ");
        ArrayNode faqItems = faq.putArray("items");
        faqItems.addObject().put("question", "").put("answer", "Inválida");
        faqItems.addObject().put("question", "Pergunta válida").put("answer", "Resposta válida");

        ObjectNode normalized = service.publicServices(input);

        assertThat(normalized.path("faq").path("items")).hasSize(1);
        assertThat(normalized.path("faq").path("items").get(0).path("id").asString())
            .isEqualTo("services-faq-2");
        assertThat(normalized.path("faq").path("items").get(0).path("order").asInt())
            .isEqualTo(2);

        faq.put("title", "");
        assertThat(service.publicServices(input).path("faq").path("items")).isEmpty();
    }

    @Test
    void appliesPublicHomeLimitsBeforeRequiredFieldFiltering() {
        PublicContentService service = serviceWith(mapper.createObjectNode());
        ObjectNode home = mapper.createObjectNode();
        ObjectNode regional = home.putObject("regionalPresence");
        ArrayNode units = regional.putArray("units");
        for (int index = 1; index <= 25; index++) {
            ObjectNode unit = units.addObject()
                .put("id", "unit-" + index)
                .put("name", "Unidade " + index)
                .put("state", "SP")
                .put("description", "Descrição")
                .put("contactUrl", "/fale-conosco");
            if (index != 1) unit.put("address", "Endereço " + index);
        }
        ObjectNode section3 = home.putObject("section3")
            .put("badge", "Seção")
            .put("title", "Título")
            .put("description", "Descrição")
            .put("ctaLabel", "Abrir")
            .put("ctaUrl", "/destino");
        ArrayNode cards = section3.putArray("cards");
        for (int index = 0; index < 3; index++) {
            ObjectNode card = cards.addObject()
                .put("badge", "b".repeat(70))
                .put("title", "Título")
                .put("description", "Descrição")
                .put("ctaLabel", "c".repeat(50))
                .put("ctaUrl", "/destino");
            card.putObject("media").put("src", "/card-" + index + ".webp");
        }

        ObjectNode normalized = service.publicHome(home);

        assertThat(normalized.path("regionalPresence").path("units")).hasSize(23);
        assertThat(normalized.path("regionalPresence").path("units").get(22).path("id").asString())
            .isEqualTo("unit-24");
        assertThat(normalized.path("section3").path("cards").get(0).path("badge").asString())
            .hasSize(60);
        assertThat(normalized.path("section3").path("cards").get(0).path("ctaLabel").asString())
            .hasSize(40);
    }

    @Test
    void keepsPublicUnitNullishAliasAndBooleanSemantics() {
        ObjectNode content = mapper.createObjectNode();
        ArrayNode units = content.putArray("units");
        units.addObject()
            .put("id", "ignored")
            .put("name", "")
            .put("nome", "Nome legado")
            .put("state", "SP")
            .put("address", "Endereço");
        units.addObject()
            .put("id", "kept")
            .put("name", "Nome")
            .put("state", "SP")
            .put("address", "Endereço")
            .put("isDefault", false)
            .put("matriz", true);

        ObjectNode result = serviceWith(content).publicContent();

        assertThat(result.path("units")).hasSize(1);
        assertThat(result.path("units").get(0).path("id").asString()).isEqualTo("kept");
        assertThat(result.path("units").get(0).path("isDefault").asBoolean()).isFalse();
        assertThat(result.path("units").get(0).has("quoteCnpj")).isFalse();
        assertThat(result.path("units").get(0).has("genericPostalCode")).isFalse();
    }

    private PublicContentService serviceWith(ObjectNode content) {
        ContentRepository repository = mock(ContentRepository.class);
        SiteTextsRepository siteTexts = mock(SiteTextsRepository.class);
        MediaSlotsRepository mediaSlots = mock(MediaSlotsRepository.class);
        when(repository.read()).thenReturn(content);
        when(siteTexts.read()).thenReturn(mapper.createObjectNode());
        when(mediaSlots.read()).thenReturn(mapper.createObjectNode());
        StructuredContentSanitizer sanitizer = new StructuredContentSanitizer(
            mapper,
            media,
            Clock.fixed(Instant.parse("2026-01-02T03:04:05.678Z"), ZoneOffset.UTC)
        );
        return new PublicContentService(
            mapper, repository, siteTexts, mediaSlots, media, sanitizer);
    }
}
