package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import br.com.rodogarcia.cms.backend.model.content.ContentDefaults;
import br.com.rodogarcia.cms.backend.model.content.ContentKeys;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class StructuredContentSanitizerTest {
    private static final String NOW = "2026-01-02T03:04:05.678Z";
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final StructuredContentSanitizer sanitizer = new StructuredContentSanitizer(
        mapper, new TestContentMediaValidator());
    private final StructuredContentSanitizer fixedSanitizer = new StructuredContentSanitizer(
        mapper,
        new TestContentMediaValidator(),
        Clock.fixed(Instant.parse(NOW), ZoneOffset.UTC)
    );

    @Test
    void keepsCanonicalStructuredDefaultsStable() {
        for (String page : ContentKeys.PAGE_KEYS) {
            assertThat(sanitizer.page(page, ContentDefaults.page(mapper, page)))
                .as(page)
                .isEqualTo(ContentDefaults.page(mapper, page));
        }
        assertThat(sanitizer.footer(ContentDefaults.footer(mapper)))
            .isEqualTo(ContentDefaults.footer(mapper));
        assertThat(sanitizer.navigation(ContentDefaults.navigation(mapper)))
            .isEqualTo(ContentDefaults.navigation(mapper));
    }

    @Test
    void matchesNodeGeneratedIdsOrderingAndQuoteTimestampsForDynamicArrays() {
        ObjectNode careers = mapper.createObjectNode();
        ArrayNode jobs = careers.putArray("jobs");
        validJob(jobs.addObject(), "Primeira", 50);
        validJob(jobs.addObject(), "Segunda", -4);

        ArrayNode normalizedJobs = (ArrayNode) fixedSanitizer.page("careers", careers).get("jobs");

        assertThat(normalizedJobs).hasSize(2);
        assertThat(normalizedJobs.get(0).path("id").asString()).matches("career_job_[0-9a-f]{32}");
        assertThat(normalizedJobs.get(1).path("id").asString()).matches("career_job_[0-9a-f]{32}")
            .isNotEqualTo(normalizedJobs.get(0).path("id").asString());
        assertThat(normalizedJobs.get(0).path("order").asInt()).isEqualTo(1);
        assertThat(normalizedJobs.get(1).path("order").asInt()).isEqualTo(2);
        assertThat(normalizedJobs.get(0).path("createdAt").asString()).isEmpty();
        assertThat(normalizedJobs.get(0).path("updatedAt").asString()).isEmpty();

        ObjectNode quote = mapper.createObjectNode();
        quote.putObject("approvalChannel").put("whatsappUrl", "https://example.com/not-whatsapp");
        quote.putArray("directChannels").addObject().put("title", "Título editável");
        ArrayNode channels = quote.putArray("otherChannels");
        channels.addObject();
        channels.addObject().put("icon", "InvalidIcon");
        channels.addObject();
        channels.addObject();
        channels.addObject();

        ObjectNode normalizedQuote = fixedSanitizer.page("quote", quote);
        ArrayNode normalizedChannels = (ArrayNode) normalizedQuote.get("otherChannels");
        assertThat(normalizedQuote.path("directChannels").get(0).path("title").asString())
            .isEqualTo("Título editável");
        assertThat(normalizedQuote.path("approvalChannel").path("whatsappUrl").asString())
            .isEqualTo(ContentDefaults.page(mapper, "quote").path("approvalChannel").path("whatsappUrl").asString());
        assertThat(normalizedChannels).hasSize(5);
        assertThat(normalizedChannels.get(0).path("id").asString()).matches("quote_channel_[0-9a-f]{32}");
        assertThat(normalizedChannels.get(1).path("id").asString())
            .isNotEqualTo(normalizedChannels.get(0).path("id").asString());
        assertThat(normalizedChannels.get(1).path("icon").asString()).isEqualTo("ChatCircleDots");
        assertThat(normalizedChannels.get(4).path("icon").asString()).isEqualTo("WhatsappLogo");
        assertThat(normalizedChannels.get(4).path("title").asString()).isEqualTo("WhatsApp comercial");
        for (int index = 0; index < normalizedChannels.size(); index++) {
            assertThat(normalizedChannels.get(index).path("order").asInt()).isEqualTo(index + 1);
            assertThat(normalizedChannels.get(index).path("createdAt").asString()).isEqualTo(NOW);
            assertThat(normalizedChannels.get(index).path("updatedAt").asString()).isEqualTo(NOW);
        }
    }

    @Test
    void preservesNodeEmptyVersusDefaultRulesAndImmutableContactLabels() {
        ObjectNode careers = fixedSanitizer.page("careers", mapper.createObjectNode());
        assertThat(careers.path("jobs")).isEmpty();

        ObjectNode quoteInput = mapper.createObjectNode();
        quoteInput.putArray("otherChannels");
        assertThat(fixedSanitizer.page("quote", quoteInput).path("otherChannels")).isEmpty();

        ObjectNode missingQuote = fixedSanitizer.page("quote", mapper.createObjectNode());
        assertThat(missingQuote.path("otherChannels")).hasSize(4);
        assertThat(missingQuote.path("otherChannels").get(0).path("createdAt").asString()).isEqualTo(NOW);

        ObjectNode contact = ContentDefaults.page(mapper, "contact");
        ((ObjectNode) contact.path("mainChannels").get(0)).put("title", "Não pode mudar");
        ((ObjectNode) contact.path("info").path("items").get(0)).put("label", "Não pode mudar");
        ObjectNode normalizedContact = fixedSanitizer.page("contact", contact);
        ObjectNode defaultContact = ContentDefaults.page(mapper, "contact");
        assertThat(normalizedContact.path("mainChannels").get(0).path("title"))
            .isEqualTo(defaultContact.path("mainChannels").get(0).path("title"));
        assertThat(normalizedContact.path("info").path("items").get(0).path("label"))
            .isEqualTo(defaultContact.path("info").path("items").get(0).path("label"));
    }

    @Test
    void usesRootComplianceFallbackOnlyForExtraCertifications() {
        ObjectNode about = ContentDefaults.page(mapper, "about");
        ObjectNode compliance = (ObjectNode) about.get("compliance");
        compliance.put("certificateText", "Certificação genérica");
        compliance.put("description", "Descrição genérica");
        compliance.putObject("image").put("src", "/fallback.webp").put("alt", "Fallback");
        ArrayNode certifications = (ArrayNode) compliance.get("certifications");
        certifications.addObject();

        JsonNode extra = fixedSanitizer.page("about", about)
            .path("compliance").path("certifications").get(7);

        assertThat(extra.path("title").asString()).isEqualTo("Certificação genérica");
        assertThat(extra.path("description").asString()).isEqualTo("Descrição genérica");
        assertThat(extra.path("image").path("src").asString()).isEqualTo("/fallback.webp");
        assertThat(extra.path("certificateUrl").asString()).isEmpty();
    }

    @Test
    void generatesFooterIdsForItemsBeyondDefaultsAndKeepsExplicitEmptyLists() {
        ObjectNode footer = ContentDefaults.footer(mapper);
        ObjectNode global = (ObjectNode) footer.get("footer");
        ArrayNode columns = global.putArray("columns");
        for (int index = 0; index < 3; index++) {
            columns.addObject().put("title", "Coluna " + index).putArray("links");
        }
        ObjectNode extraColumn = columns.addObject().put("title", "Extra");
        ArrayNode extraLinks = extraColumn.putArray("links");
        extraLinks.addObject().put("label", "Primeiro").put("url", "/primeiro");
        extraLinks.addObject().put("label", "Segundo").put("url", "/segundo");
        ArrayNode blocks = ((ObjectNode) footer.path("terms").path("reading")).putArray("blocks");
        for (int index = 0; index < 6; index++) {
            blocks.addObject().put("title", "Bloco " + index).put("description", "Descrição " + index);
        }

        ObjectNode normalized = fixedSanitizer.footer(footer);
        JsonNode generatedColumn = normalized.path("footer").path("columns").get(3);
        assertThat(generatedColumn.path("id").asString()).matches("footer_column_[0-9a-f]{32}");
        assertThat(generatedColumn.path("links").get(0).path("id").asString()).matches("footer_link_[0-9a-f]{32}");
        assertThat(generatedColumn.path("links").get(1).path("id").asString())
            .isNotEqualTo(generatedColumn.path("links").get(0).path("id").asString());
        assertThat(normalized.path("terms").path("reading").path("blocks").get(5).path("id").asString())
            .matches("footer_block_[0-9a-f]{32}");

        ObjectNode empty = mapper.createObjectNode();
        ObjectNode emptyGlobal = empty.putObject("footer");
        emptyGlobal.putArray("columns");
        emptyGlobal.putArray("serviceHours");
        emptyGlobal.putArray("socialLinks");
        emptyGlobal.putArray("bottomLinks");
        empty.putObject("terms").putObject("reading").putArray("blocks");
        ObjectNode normalizedEmpty = fixedSanitizer.footer(empty);
        assertThat(normalizedEmpty.path("footer").path("columns")).isEmpty();
        assertThat(normalizedEmpty.path("footer").path("serviceHours")).isEmpty();
        assertThat(normalizedEmpty.path("footer").path("socialLinks")).isEmpty();
        assertThat(normalizedEmpty.path("footer").path("bottomLinks")).isEmpty();
        assertThat(normalizedEmpty.path("terms").path("reading").path("blocks")).isEmpty();
    }

    @Test
    void appliesNodeFieldLimitsAndKeepsNavigationPathTextUnnormalized() {
        ObjectNode about = ContentDefaults.page(mapper, "about");
        ((ObjectNode) about.get("hero")).put("description", "x".repeat(300));
        assertThat(fixedSanitizer.page("about", about).path("hero").path("description").asString())
            .hasSize(220);

        ObjectNode navigation = mapper.createObjectNode();
        navigation.putArray("items").addObject()
            .put("label", "Rota")
            .put("url", "/foo//bar/../baz")
            .put("icon", "home");
        assertThat(fixedSanitizer.navigation(navigation).path("items").get(0).path("url").asString())
            .isEqualTo("/foo//bar/../baz");
    }

    private static void validJob(ObjectNode job, String title, int order) {
        job.put("order", order)
            .put("title", title)
            .put("location", "Agudos/SP")
            .put("type", "Integral")
            .put("description", "Descrição")
            .put("applyUrl", "/trabalhe-conosco#candidatura");
    }
}
