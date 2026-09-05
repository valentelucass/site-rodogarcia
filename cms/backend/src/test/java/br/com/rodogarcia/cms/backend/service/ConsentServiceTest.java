package br.com.rodogarcia.cms.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.support.DomainTestContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import tools.jackson.databind.node.ObjectNode;

class ConsentServiceTest {

    @TempDir Path root;
    private DomainTestContext context;
    private ConsentService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-03T12:34:56.789Z"), ZoneOffset.UTC);
        context = new DomainTestContext(root, clock, Map.of());
        service = new ConsentService(
            context.store, context.properties.storagePaths(), context.clientIp, context.audit, clock);
    }

    @Test
    void normalizesUpdatesAndPersistsOnlyResolvedConsentCategories() throws Exception {
        ObjectNode defaults = service.readSettings();
        assertThat(defaults.path("categories").size()).isEqualTo(3);
        assertThat(defaults.path("categories").get(0).path("key").asString()).isEqualTo("necessary");

        ObjectNode update = (ObjectNode) context.mapper.readTree("""
            {"version":2,"enabled":true,"mobile":{"position":"center-modal"},
             "categories":[
               {"key":"analytics","label":"Analytics","description":"Métricas"},
               {"key":"necessary","label":"Necessários","description":"Operação"}
             ]}
            """);
        ObjectNode settings = service.updateSettings(update, request());
        assertThat(settings.path("version").asInt()).isEqualTo(2);
        assertThat(settings.path("categories").get(0).path("key").asString()).isEqualTo("necessary");
        assertThat(context.audit.list(Map.of()).getFirst().path("action").asString())
            .isEqualTo("consent.update");

        ObjectNode body = (ObjectNode) context.mapper.readTree("""
            {"decision":"accepted","sessionId":"session-1","locationAllowed":false,
             "approximateLocation":"não deve persistir","categories":{"analytics":false}}
            """);
        ObjectNode recorded = service.record(body, request());
        assertThat(recorded.path("createdAt").asString()).isEqualTo("2026-09-03T12:34:56.789Z");
        assertThat(recorded.path("categories").path("necessary").asBoolean()).isTrue();
        assertThat(recorded.path("categories").path("analytics").asBoolean()).isTrue();
        assertThat(recorded.path("approximateLocation").asString()).isEmpty();
        assertThat(recorded.path("ipMasked").asString()).isEqualTo("127.0.0.0");
        assertThat(service.list(Map.of("status", "accepted")).get("total")).isEqualTo(1);
    }

    @Test
    void rejectsDuplicateCategoryKeysBeforeWriting() throws Exception {
        ObjectNode body = (ObjectNode) context.mapper.readTree("""
            {"categories":[
              {"key":"analytics","label":"A","description":"A"},
              {"key":"ANALYTICS","label":"B","description":"B"}
            ]}
            """);
        assertThatThrownBy(() -> service.updateSettings(body, request()))
            .isInstanceOf(ApiException.class)
            .hasMessage("Consentimento: as chaves das categorias devem ser únicas e preenchidas.");
        assertThat(java.nio.file.Files.exists(context.properties.storagePaths().consentSettings()))
            .isFalse();
    }

    @Test
    void acceptsAnEmptyBodyAndKeepsLocationConsentStrictlyBoolean() throws Exception {
        ObjectNode recorded = service.record(null, request());
        assertThat(recorded.path("decision").asString()).isEqualTo("custom");

        ObjectNode misleadingLocation = context.mapper.createObjectNode();
        misleadingLocation.put("locationAllowed", "true");
        misleadingLocation.put("approximateLocation", "São Paulo");
        ObjectNode second = service.record(misleadingLocation, request());
        assertThat(second.path("approximateLocation").asString()).isEmpty();

        Map<String, Object> page = service.list(Map.of("page", "0", "pageSize", "0"));
        assertThat(page.get("page")).isEqualTo(1);
        assertThat(page.get("pageSize")).isEqualTo(50);
        assertThat(page.get("total")).isEqualTo(2);
    }

    private MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.42");
        request.addHeader("User-Agent", "Mozilla/5.0 Mobile");
        return request;
    }
}
