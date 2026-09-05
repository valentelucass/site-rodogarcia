package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import br.com.rodogarcia.cms.backend.model.content.ContentDefaults;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class ContentMigrationServiceTest {
    private static final String NOW = "2026-01-02T03:04:05.678Z";
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final StructuredContentSanitizer sanitizer = new StructuredContentSanitizer(
        mapper, new TestContentMediaValidator());
    private final ContentMigrationService migrations = new ContentMigrationService(mapper, sanitizer);

    @Test
    void migratesLegacyUnitsFeedbackAndPageDefaultsIdempotently() {
        ObjectNode raw = mapper.createObjectNode();
        raw.set("homePage", mapper.createObjectNode());
        ArrayNode units = raw.putArray("units");
        units.addObject()
            .put("id", "unit-matriz")
            .put("order", 1)
            .put("nome", "Matriz")
            .put("estado", "sp")
            .put("endereco", "Rua Teste, 10")
            .put("telefone", "0800 000 000")
            .put("tipo", "matriz")
            .put("ativo", true);
        ArrayNode feedbacks = raw.putArray("feedbacks");
        feedbacks.addObject()
            .put("id", "legacy-feedback")
            .put("nome", "Cliente")
            .put("texto", "Entrega previsível")
            .put("resultadoTexto", "Distribuição nacional")
            .put("nota", 4);

        ContentMigrationService.MigrationResult first = migrations.migrate(
            raw, mapper.createObjectNode(), mapper.createObjectNode());

        assertThat(first.shouldPersist()).isTrue();
        assertThat(first.content().path("homePage").path("regionalPresence").path("units").get(0)
            .path("additionalEmail").asString()).isEqualTo("comercial.agu@rodogarcia.com.br");
        assertThat(first.content().path("homePage").path("socialProof").path("feedbacks").get(0)
            .path("testimonial").asString()).isEqualTo("Entrega previsível");
        assertThat(first.content().path("units").get(0).path("quoteCnpj").asString())
            .isEqualTo("60960473000162");
        assertThat(first.content().path("aboutPage").isObject()).isTrue();

        ContentMigrationService.MigrationResult second = migrations.migrate(
            first.content(), mapper.createObjectNode(), mapper.createObjectNode());
        assertThat(second.shouldPersist()).isFalse();
        assertThat(second.content()).isEqualTo(first.content());
    }

    @Test
    void preservesNodeLegacyContactMigrationAndCareersDefaultQuirk() {
        StructuredContentSanitizer fixedSanitizer = new StructuredContentSanitizer(
            mapper,
            new TestContentMediaValidator(),
            Clock.fixed(Instant.parse(NOW), ZoneOffset.UTC)
        );
        ContentMigrationService fixedMigrations = new ContentMigrationService(mapper, fixedSanitizer);
        ObjectNode raw = ContentDefaults.repositoryContent(mapper);
        raw.remove("contactPage");
        raw.remove("careersPage");
        raw.remove("quotePage");
        raw.putArray("vagas").addObject()
            .put("id", "legacy-custom")
            .put("title", "Vaga legada")
            .put("location", "Bauru/SP")
            .put("contractType", "CLT")
            .put("description", "Não substitui as vagas padrão no Node")
            .put("applyUrl", "/legado");
        ObjectNode texts = mapper.createObjectNode();
        texts.put("contactEmailAddress", "endereco-invalido");
        texts.put("contactCtaLabel", "CTA legado");
        texts.put("contactCtaUrl", "/destino-legado");
        texts.put("aboutHeroImage", "/legacy-about.webp");
        ObjectNode mediaSlots = mapper.createObjectNode();
        mediaSlots.put("about.hero", "https://example.com/invalid.webp");

        ContentMigrationService.MigrationResult migrated = fixedMigrations.migrate(
            raw, texts, mediaSlots);

        assertThat(migrated.content().path("contactPage").path("mainChannels").get(1)
            .path("button").path("url").asString())
            .isEqualTo("mailto:gerente.financeiro@rodogarcia.com.br");
        assertThat(migrated.content().path("contactPage").path("finalCta").path("buttons").get(0)
            .path("label").asString()).isEqualTo("CTA legado");
        assertThat(migrated.content().path("contactPage").path("finalCta").path("buttons").get(0)
            .path("url").asString()).isEqualTo("/destino-legado");
        assertThat(migrated.content().path("careersPage").path("jobs")).hasSize(3);
        assertThat(migrated.content().path("careersPage").path("jobs").get(0).path("id").asString())
            .isEqualTo("career-job-1");
        assertThat(migrated.content().path("careersPage").path("jobs").toString())
            .doesNotContain("legacy-custom");
        assertThat(migrated.content().path("quotePage").path("otherChannels").get(0)
            .path("createdAt").asString()).isEqualTo(NOW);
        assertThat(migrated.content().path("quotePage").path("otherChannels").get(0)
            .path("updatedAt").asString()).isEqualTo(NOW);
        assertThat(migrated.content().path("aboutPage").path("hero").path("media")
            .path("src").asString()).isEqualTo("/legacy-about.webp");

        ContentMigrationService.MigrationResult second = fixedMigrations.migrate(
            migrated.content(), texts, mediaSlots);
        assertThat(second.shouldPersist()).isFalse();
        assertThat(second.content()).isEqualTo(migrated.content());
    }

    @Test
    void distinguishesMissingHomeFromPresentEmptyHomeAndKeepsReturnedCollectionOrder() {
        ObjectNode missingHome = mapper.createObjectNode();
        ArrayNode missingUnits = missingHome.putArray("units");
        missingUnits.addObject().put("id", "unit-z").put("order", 2).put("name", "Z");
        missingUnits.addObject().put("id", "unit-a").put("order", 1).put("name", "A");

        ObjectNode normalizedMissing = migrations.migrate(
            missingHome, mapper.createObjectNode(), mapper.createObjectNode()).content();

        assertThat(normalizedMissing.path("homePage").path("regionalPresence").path("units")).isEmpty();
        assertThat(normalizedMissing.path("units").get(0).path("id").asString()).isEqualTo("unit-z");
        assertThat(normalizedMissing.path("units").get(1).path("id").asString()).isEqualTo("unit-a");
        List<String> keys = new ArrayList<>();
        keys.addAll(normalizedMissing.propertyNames());
        assertThat(keys).containsExactly(
            "heroSlides", "dnaSlides", "vagas", "feedbacks", "units",
            "aboutPage", "businessPage", "contactPage", "careersPage", "quotePage",
            "collectionsPage", "headerNavigation", "footerLinks", "homePage", "servicesPage",
            "improvementsPage"
        );

        ObjectNode presentHome = mapper.createObjectNode();
        presentHome.putObject("homePage");
        presentHome.set("units", missingUnits.deepCopy());
        ObjectNode normalizedPresent = migrations.migrate(
            presentHome, mapper.createObjectNode(), mapper.createObjectNode()).content();
        assertThat(normalizedPresent.path("homePage").path("regionalPresence").path("units"))
            .hasSize(2);
        assertThat(normalizedPresent.path("homePage").path("regionalPresence").path("units").get(0)
            .path("id").asString()).isEqualTo("unit-a");
    }

    @Test
    void migratesLegacyServicePositionToItsOwnPresentation() {
        ObjectNode raw = ContentDefaults.repositoryContent(mapper);
        ObjectNode services = (ObjectNode) raw.get("servicesPage");
        ObjectNode image = services.putArray("modules").addObject().putObject("image");
        image.put("src", "/service.webp").put("alt", "Serviço").put("position", "object-top");

        ContentMigrationService.MigrationResult migrated = migrations.migrate(
            raw, mapper.createObjectNode(), mapper.createObjectNode());

        assertThat(migrated.shouldPersist()).isTrue();
        assertThat(migrated.content().path("servicesPage").path("modules").get(0).path("image")
            .path("presentation").path("desktop").path("focalPoint").path("x").asInt())
            .isEqualTo(50);
        assertThat(migrated.content().path("servicesPage").path("modules").get(0).path("image")
            .path("presentation").path("desktop").path("focalPoint").path("y").asInt())
            .isZero();
    }
}
