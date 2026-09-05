package br.com.rodogarcia.cms.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.service.content.TestContentMediaValidator;
import br.com.rodogarcia.cms.backend.support.DomainTestContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class PublicModulesParityTest {

    @TempDir Path root;
    private DomainTestContext context;
    private LeadService leads;
    private FormsService forms;
    private PopupService popup;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-03T12:34:56.789Z"), ZoneOffset.UTC);
        context = new DomainTestContext(root, clock, Map.of());
        leads = new LeadService(context.collections, context.properties.storagePaths(), context.tracking, clock);
        forms = new FormsService(
            context.collections, context.properties.storagePaths(), context.rateLimits,
            context.clientIp, leads, context.tracking, clock);
        popup = new PopupService(
            context.store, context.collections, context.properties.storagePaths(),
            new TestContentMediaValidator(), context.rateLimits, context.clientIp,
            leads, context.tracking, context.audit, clock);
    }

    @Test
    void formsChargeTheRateLimitBeforeValidationAndKeepAllWriteSideEffects() {
        MockHttpServletRequest request = request("127.0.0.11");
        assertThatThrownBy(() -> forms.createContact(null, request))
            .isInstanceOf(ApiException.class)
            .hasMessage("Envie um objeto JSON válido.");
        assertThat(context.rateLimits.state("contact", "127.0.0.11", RateLimitService.LEAD).count())
            .isEqualTo(1);

        ObjectNode body = context.mapper.createObjectNode();
        body.put("name", "Pessoa");
        body.put("email", "PESSOA@example.com");
        body.put("message", "Mensagem");
        ObjectNode contact = forms.createContact(body, request);

        assertThat(context.store.readArray(context.properties.storagePaths().contacts())).hasSize(1);
        assertThat(context.store.readArray(context.properties.storagePaths().leads())).hasSize(1);
        assertThat(context.store.readArray(context.properties.storagePaths().trackingEvents()))
            .extracting(item -> item.path("event").asString())
            .containsExactly("lead_created", "form_submit");
        assertThat(contact.path("email").asString()).isEqualTo("pessoa@example.com");
    }

    @Test
    void trackingMatchesNullishFieldsPathNormalizationAndJavascriptMetadataCoercion() {
        MockHttpServletRequest request = request("127.0.0.12");
        ObjectNode typeOnly = context.mapper.createObjectNode().put("type", "click");
        assertThatThrownBy(() -> context.tracking.createPublic(typeOnly, request))
            .isInstanceOf(ApiException.class).hasMessage("Tipo de evento invalido.");
        assertThat(context.rateLimits.state("tracking", "127.0.0.12", RateLimitService.ANALYTICS).count())
            .isEqualTo(1);

        ObjectNode body = context.mapper.createObjectNode();
        body.put("event", "click");
        body.put("page", "/servicos/");
        ObjectNode metadata = body.putObject("metadata");
        metadata.putObject("nested").put("value", 1);
        metadata.putNull("empty");
        metadata.putArray("values").add(1).addNull().add(true);
        ObjectNode saved = context.tracking.createPublic(body, request);

        assertThat(saved.path("page").asString()).isEqualTo("/servicos/");
        assertThat(saved.path("metadata").path("nested").asString()).isEqualTo("[object Object]");
        assertThat(saved.path("metadata").path("values").asString()).isEqualTo("1,,true");
        assertThat(saved.path("metadata").has("empty")).isFalse();
        assertThat(context.tracking.list(Map.of("limit", "0"))).hasSize(1);
        assertThat(AuditService.parseSliceLimit("1.9", 120, 1, 500)).isEqualTo(1);
        assertThat(AuditService.jsNumber("-0x10")).isNaN();
    }

    @Test
    void popupKeepsRateOrderStrictBooleansAndEmptyBodyFailure() {
        MockHttpServletRequest request = request("127.0.0.13");
        assertThatThrownBy(() -> popup.createEvent(null, request))
            .isInstanceOf(NullPointerException.class);
        assertThat(context.rateLimits.state(
            "popupEvent", "127.0.0.13", RateLimitService.POPUP_EVENT).count()).isZero();

        ObjectNode event = context.mapper.createObjectNode();
        event.put("event", "popup_shown");
        event.put("pagePath", "/cotacao/");
        event.put("mobile", "true");
        ObjectNode saved = popup.createEvent(event, request);
        assertThat(saved.path("pagePath").asString()).isEqualTo("/cotacao/");
        assertThat(saved.path("mobile").asBoolean()).isFalse();

        ObjectNode landing = context.mapper.createObjectNode();
        landing.put("source", "landing-b2b-form");
        landing.put("name", "Pessoa");
        landing.put("email", "pessoa@example.com");
        landing.put("phone", "11999999999");
        landing.put("cnpj", "12345678000199");
        landing.put("privacyAccepted", "true");
        assertThatThrownBy(() -> popup.createLead(landing, request))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("aceite a Política de Privacidade");
        assertThat(context.rateLimits.state("lead", "127.0.0.13", RateLimitService.LEAD).count())
            .isZero();

        ArrayNode arrayPatch = context.mapper.createArrayNode().add("ignored");
        ObjectNode config = popup.updateConfig(arrayPatch, request);
        assertThat(config.path("title").asString()).isEqualTo("Antes de sair...");
        assertThat(context.audit.list(Map.of()).getFirst().path("action").asString())
            .isEqualTo("popup.update");
    }

    @Test
    void popupKeepsAnImagePresentationPerValidatedImage() {
        ObjectNode body = context.mapper.createObjectNode();
        body.put("image", "/popup.png");
        ObjectNode standardPresentation = body.putObject("imagePresentation");
        standardPresentation.putObject("desktop").putObject("focalPoint")
            .put("x", 24).put("y", 72);
        standardPresentation.putObject("mobile").putObject("focalPoint")
            .put("x", 120).put("y", 16);

        ObjectNode desktop = body.putObject("desktop");
        desktop.put("image", "/popup-desktop.webp");
        desktop.putObject("imagePresentation").putObject("desktop").putObject("focalPoint")
            .put("x", 88).put("y", 30);

        ObjectNode mobile = body.putObject("mobile");
        mobile.put("image", "/popup-mobile.avif");
        mobile.putObject("imagePresentation").putObject("desktop").putObject("focalPoint")
            .put("x", 18).put("y", 64);

        ObjectNode saved = popup.updateConfig(body, request("127.0.0.19"));

        assertThat(saved.path("imagePresentation").path("desktop").path("focalPoint").path("x").asInt())
            .isEqualTo(24);
        assertThat(saved.path("imagePresentation").path("mobile").path("focalPoint").path("x").asInt())
            .isEqualTo(24);
        assertThat(saved.path("desktop").path("imagePresentation").path("desktop")
            .path("focalPoint").path("x").asInt()).isEqualTo(88);
        assertThat(saved.path("mobile").path("imagePresentation").path("desktop")
            .path("focalPoint").path("y").asInt()).isEqualTo(64);

        ObjectNode withoutImage = context.mapper.createObjectNode();
        withoutImage.put("image", "");
        withoutImage.putObject("imagePresentation").putObject("desktop").putObject("focalPoint")
            .put("x", 12).put("y", 12);
        ObjectNode savedWithoutImage = popup.updateConfig(withoutImage, request("127.0.0.20"));
        assertThat(savedWithoutImage.has("imagePresentation")).isFalse();
    }

    @Test
    void popupDeduplicatesConcurrentLeadSubmissionsAtomically() throws Exception {
        ObjectNode body = context.mapper.createObjectNode();
        body.put("name", "Pessoa");
        body.put("email", "concorrente@example.com");
        body.put("phone", "11999999999");

        int attempts = 6;
        CountDownLatch ready = new CountDownLatch(attempts);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(attempts)) {
            var futures = java.util.stream.IntStream.range(0, attempts)
                .mapToObj(index -> executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    try {
                        popup.createLead(body.deepCopy(), request("127.0.0.15"));
                        return "created";
                    } catch (ApiException error) {
                        return "error:" + error.status();
                    }
                }))
                .toList();
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<String> results = futures.stream().map(future -> {
                try {
                    return future.get(10, TimeUnit.SECONDS);
                } catch (Exception error) {
                    throw new AssertionError(error);
                }
            }).toList();
            assertThat(results).containsExactlyInAnyOrder(
                "created", "error:409", "error:409", "error:409", "error:409", "error:409"
            );
        }

        assertThat(context.store.readArray(context.properties.storagePaths().leads())).hasSize(1);
        assertThat(context.store.readArray(context.properties.storagePaths().popupLeads())).hasSize(1);
        assertThat(context.store.readArray(context.properties.storagePaths().trackingEvents())).hasSize(1);
    }

    @Test
    void unifiedLeadsKeepInvalidLegacyDatesAndJavascriptPaginationFallbacks() {
        ArrayNode stored = context.mapper.createArrayNode();
        ObjectNode legacy = stored.addObject();
        legacy.put("id", "");
        legacy.put("createdAt", "invalid-date");
        legacy.put("source", "cms");
        context.store.write(context.properties.storagePaths().leads(), stored);

        Map<String, Object> result = leads.listUnified(Map.of(
            "from", "2026-01-01", "page", "0", "pageSize", "0"));
        assertThat(result.get("total")).isEqualTo(1);
        assertThat(result.get("page")).isEqualTo(1);
        assertThat(result.get("pageSize")).isEqualTo(50);
        @SuppressWarnings("unchecked")
        var values = (java.util.List<ObjectNode>) result.get("leads");
        assertThat(values.getFirst().path("id").asString()).isEmpty();
    }

    @Test
    void auditKeepsJavascriptLimitAndMetadataSemantics() {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("object", Map.of("secret", "not-expanded"));
        metadata.put("empty", null);
        context.audit.record(request("127.0.0.14"), "content.update", "target", metadata);
        context.audit.record(request("127.0.0.14"), "content.update", "target-2", Map.of());

        assertThat(context.audit.list(Map.of("limit", "1.9"))).hasSize(1);
        assertThat(context.audit.list(Map.of("limit", "0"))).hasSize(2);
        ObjectNode first = (ObjectNode) context.store.readArray(
            context.properties.storagePaths().auditLog()).get(0);
        assertThat(first.path("metadata").path("object").asString()).isEqualTo("[object Object]");
        assertThat(first.path("metadata").has("empty")).isFalse();
    }

    @Test
    void repeatedQueryParametersRemainArraysForJavascriptFallbackSemantics() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("days", "1", "2");
        request.addParameter("page", "3");
        Map<String, String> query = AuditService.queryParameters(request);
        assertThat(query).containsEntry("days", null).containsEntry("page", "3");
        assertThat(AuditService.queryParameter(request, "days", "30")).isNull();
        assertThat(AuditService.jsNumber(query.get("days"))).isZero();
    }

    private MockHttpServletRequest request(String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(ip);
        request.addHeader("User-Agent", "Mozilla/5.0 Mobile");
        return request;
    }
}
