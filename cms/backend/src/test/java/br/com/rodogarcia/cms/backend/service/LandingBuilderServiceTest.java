package br.com.rodogarcia.cms.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class LandingBuilderServiceTest {

    private static final String TOKEN = "synthetic-builder-token";
    private static final byte[] EMPTY = new byte[0];

    @TempDir
    Path root;

    private HttpServer server;
    private LandingBuilderService service;
    private final AtomicReference<Response> response = new AtomicReference<>(
        new Response(200, "{\"items\":[]}"));
    private final AtomicReference<Captured> captured = new AtomicReference<>();
    private final List<Captured> requests = new CopyOnWriteArrayList<>();
    private final AtomicReference<Function<HttpExchange, Response>> responder =
        new AtomicReference<>(ignored -> response.get());

    @BeforeEach
    void setUp() throws Exception {
        startServer(this::handle);
        service = service(Duration.ofSeconds(8));
    }

    private LandingBuilderService service(Duration timeout) {
        CmsProperties properties = CmsProperties.from(Map.of(
            "CMS_STORAGE_ROOT", root.resolve("storage").toString(),
            "LANDING_BUILDER_API_URL", "http://127.0.0.1:" + server.getAddress().getPort(),
            "LANDING_BUILDER_SERVICE_TOKEN", TOKEN
        ), root.resolve("repo/cms/backend"));
        return new LandingBuilderService(properties, JsonMapper.builder().build(), timeout);
    }

    private void startServer(HttpHandler handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", handler);
        server.start();
    }

    @AfterEach
    void stop() {
        if (server != null) server.stop(0);
    }

    @Test
    void forwardsThePrivateTokenJsonAndEncodedIdentifier() {
        var payload = JsonMapper.builder().build().createObjectNode().put("title", "Teste");

        assertThat(service.updatePage("id /ç", payload).path("items").isArray()).isTrue();

        Captured request = captured.get();
        assertThat(request.method()).isEqualTo("PUT");
        assertThat(request.path()).isEqualTo("/api/internal/landings/id%20%2F%C3%A7");
        assertThat(request.token()).isEqualTo(TOKEN);
        assertThat(request.contentType()).startsWith("application/json");
        assertThat(request.body()).isEqualTo("{\"title\":\"Teste\"}");
    }

    @Test
    void matchesEncodeURIComponentForReservedUnicodeAndMalformedSurrogates() {
        assertThat(LandingBuilderService.segment("AZaz09-_.!~*'();/?:@&=+$,# ç😀"))
            .isEqualTo("AZaz09-_.!~*'()%3B%2F%3F%3A%40%26%3D%2B%24%2C%23%20"
                + "%C3%A7%F0%9F%98%80");
        assertThatThrownBy(() -> LandingBuilderService.segment("\ud800"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void serializesJsonWithJavascriptPropertyAndNumberSemantics() throws Exception {
        JsonMapper mapper = JsonMapper.builder().build();
        var payload = mapper.createObjectNode();
        payload.put("2", "two");
        payload.put("1", "one");
        payload.put("minusZero", -0D);
        payload.put("whole", 1D);
        payload.set("overflow", mapper.readTree("1e400"));
        payload.put("surrogate", "\ud800");

        service.createPage(payload);

        assertThat(captured.get().body()).isEqualTo(
            "{\"1\":\"one\",\"2\":\"two\",\"minusZero\":0,\"whole\":1,"
                + "\"overflow\":null,\"surrogate\":\"\\ud800\"}"
        );

        service.createPage(null);
        assertThat(captured.get().body()).isEqualTo("{}");
    }

    @Test
    void mapsRemoteErrorsWithoutExposingTransportDetails() {
        response.set(new Response(422, "{\"error\":\"Payload recusado.\"}"));
        assertThatThrownBy(() -> service.createPage(JsonMapper.builder().build().createObjectNode()))
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.status()).isEqualTo(422);
                assertThat(error.getMessage()).isEqualTo("Payload recusado.");
            });

        response.set(new Response(500, "internal stack"));
        assertThatThrownBy(service::listPages)
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.status()).isEqualTo(503);
                assertThat(error.getMessage())
                    .isEqualTo("Não foi possível concluir a operação no construtor.");
            });
    }

    @Test
    void preservesNodeErrorCoercionAndTreatsEveryNon2xxAsAnError() {
        response.set(new Response(422, "{\"error\":null}"));
        assertRemoteError(422, "null");

        response.set(new Response(422, "{\"error\":{\"detail\":\"private\"}}"));
        assertRemoteError(422, "[object Object]");

        response.set(new Response(422, "{\"error\":[1,null,{\"x\":1}]}"));
        assertRemoteError(422, "1,,[object Object]");

        response.set(new Response(300, "{\"ignored\":true}"));
        assertRemoteError(300, "Não foi possível concluir a operação no construtor.");
    }

    @Test
    void treatsAMalformedSuccessfulPayloadAsTheEmptyObjectLikeNodeFetch() {
        response.set(new Response(200, "not-json"));

        var payload = service.listPages();
        assertThat(payload.isObject()).isTrue();
        assertThat(payload.size()).isZero();
    }

    @Test
    void decodesRemoteJsonAsUtf8WithReplacementAndIgnoresTheDeclaredCharset() {
        response.set(new Response(200,
            new byte[] {'{', '"', 'x', '"', ':', '"', (byte) 0xff, '"', '}'},
            Map.of("Content-Type", "application/json; charset=iso-8859-1")));

        assertThat(service.listPages().path("x").asString()).isEqualTo("�");
    }

    @Test
    void followsTwentyRedirectsAndUsesFetchMethodRewritingRules() {
        AtomicInteger redirects = new AtomicInteger();
        responder.set(exchange -> {
            if (redirects.getAndIncrement() < 20) {
                return new Response(302, EMPTY, Map.of("Location", "/api/internal/landings"));
            }
            return new Response(200, "{\"ok\":true}");
        });

        var payload = JsonMapper.builder().build().createObjectNode().put("name", "Campanha");
        assertThat(service.createPage(payload).path("ok").asBoolean()).isTrue();
        assertThat(requests).hasSize(21);
        assertThat(requests.get(0).method()).isEqualTo("POST");
        assertThat(requests.get(1).method()).isEqualTo("GET");
        assertThat(requests.get(1).contentType()).isNull();
        assertThat(requests.get(1).body()).isEmpty();
        assertThat(requests).allSatisfy(item -> assertThat(item.token()).isEqualTo(TOKEN));
    }

    @Test
    void rejectsTheTwentyFirstRedirectLikeUndiciFetch() {
        responder.set(ignored -> new Response(307, EMPTY,
            Map.of("Location", "/api/internal/landings")));

        assertThatThrownBy(service::listPages)
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.status()).isEqualTo(503);
                assertThat(error.getMessage())
                    .isEqualTo("O construtor de landing pages não está disponível no momento.");
            });
        assertThat(requests).hasSize(21);
        assertThat(requests).allSatisfy(item -> assertThat(item.method()).isEqualTo("GET"));
    }

    @Test
    void preservesMethodAndBodyAcross307Redirects() {
        AtomicInteger count = new AtomicInteger();
        responder.set(ignored -> count.getAndIncrement() == 0
            ? new Response(307, EMPTY, Map.of("Location", "/redirected"))
            : new Response(200, "{}"));
        var payload = JsonMapper.builder().build().createObjectNode().put("title", "Teste");

        service.updatePage("landing_1", payload);

        assertThat(requests).hasSize(2);
        assertThat(requests.get(1).method()).isEqualTo("PUT");
        assertThat(requests.get(1).contentType()).isEqualTo("application/json");
        assertThat(requests.get(1).body()).isEqualTo("{\"title\":\"Teste\"}");
    }

    @Test
    void blocksCrossOriginRedirectsBeforeThePrivateTokenCanReachTheTarget() throws Exception {
        AtomicInteger targetRequests = new AtomicInteger();
        AtomicReference<String> targetToken = new AtomicReference<>();
        HttpServer target = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        target.createContext("/", exchange -> {
            targetRequests.incrementAndGet();
            targetToken.set(exchange.getRequestHeaders().getFirst(
                "x-landing-builder-service-token"));
            exchange.sendResponseHeaders(200, 2);
            exchange.getResponseBody().write("{}".getBytes(StandardCharsets.UTF_8));
            exchange.close();
        });
        target.start();
        try {
            String external = "http://127.0.0.1:" + target.getAddress().getPort() + "/target";
            responder.set(ignored -> new Response(302, EMPTY, Map.of("Location", external)));

            assertThatThrownBy(service::listPages)
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status()).isEqualTo(503);
                    assertThat(error.getMessage())
                        .isEqualTo("O construtor de landing pages não está disponível no momento.");
                    assertThat(error.getMessage()).doesNotContain(TOKEN);
                });

            assertThat(requests).hasSize(1);
            assertThat(targetRequests).hasValue(0);
            assertThat(targetToken.get()).isNull();
        } finally {
            target.stop(0);
        }
    }

    @Test
    void mapsTimeoutBeforeHeadersTo503ButBodyTimeoutToAnEmptyPayload() throws Exception {
        server.stop(0);
        CountDownLatch releaseBeforeHeaders = new CountDownLatch(1);
        startServer(exchange -> {
            try {
                releaseBeforeHeaders.await(2, TimeUnit.SECONDS);
                exchange.sendResponseHeaders(200, 0);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        service = service(Duration.ofMillis(300));

        assertThatThrownBy(service::listPages)
            .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status()).isEqualTo(503));
        releaseBeforeHeaders.countDown();

        server.stop(0);
        CountDownLatch bodyMayFinish = new CountDownLatch(1);
        startServer(exchange -> {
            try {
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, 0);
                exchange.getResponseBody().flush();
                bodyMayFinish.await(2, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        service = service(Duration.ofMillis(500));

        JsonNode payload = service.listPages();
        bodyMayFinish.countDown();
        assertThat(payload.isObject()).isTrue();
        assertThat(payload).isEmpty();
    }

    @Test
    void forwardsLandingMediaAsMultipartWithTheOptionalAlt() {
        MockMultipartFile file = new MockMultipartFile(
            "file", "campanha\"\r\nç.png", "Image/PNG", new byte[] {1, 2, 3, 4});

        service.uploadMedia(file, "\u00a0 Imagem\nda campanha \ufeff");

        Captured request = captured.get();
        assertThat(request.method()).isEqualTo("POST");
        assertThat(request.path()).isEqualTo("/api/internal/media");
        assertThat(request.token()).isEqualTo(TOKEN);
        assertThat(request.contentType()).startsWith("multipart/form-data; boundary=");
        assertThat(request.body())
            .contains("name=\"file\"")
            .contains("filename=\"campanha%22%0D%0AÃ§.png\"")
            .contains("Content-Type: image/png")
            .contains("name=\"alt\"")
            .contains("Content-Type: text/plain; charset=UTF-8")
            .contains("Imagem\r\nda campanha");
    }

    @Test
    void forwardsTheCampaignLifecycleAndMediaMetadataOperations() {
        JsonMapper mapper = JsonMapper.builder().build();
        var schedule = mapper.createObjectNode().put("publishAt", "2030-01-01T10:00:00Z");
        var media = mapper.createObjectNode().put("alt", "Patio principal");

        service.duplicatePage("landing one");
        assertThat(captured.get().method()).isEqualTo("POST");
        assertThat(captured.get().path()).isEqualTo("/api/internal/landings/landing%20one/duplicate");
        service.archivePage("landing one");
        assertThat(captured.get().path()).isEqualTo("/api/internal/landings/landing%20one/archive");
        service.schedulePage("landing one", schedule);
        assertThat(captured.get().path()).isEqualTo("/api/internal/landings/landing%20one/schedule");
        assertThat(captured.get().contentType()).startsWith("application/json");
        assertThat(captured.get().body()).isEqualTo("{\"publishAt\":\"2030-01-01T10:00:00Z\"}");
        service.revisions("landing one");
        assertThat(captured.get().method()).isEqualTo("GET");
        assertThat(captured.get().path()).isEqualTo("/api/internal/landings/landing%20one/revisions");
        service.rollback("landing one", "revision one");
        assertThat(captured.get().path()).isEqualTo("/api/internal/landings/landing%20one/revisions/revision%20one/rollback");
        service.deletePage("landing one");
        assertThat(captured.get().method()).isEqualTo("DELETE");
        assertThat(captured.get().path()).isEqualTo("/api/internal/landings/landing%20one");
        service.updateMedia("media one", media);
        assertThat(captured.get().method()).isEqualTo("PUT");
        assertThat(captured.get().path()).isEqualTo("/api/internal/media/media%20one");
        assertThat(captured.get().body()).isEqualTo("{\"alt\":\"Patio principal\"}");
    }

    @Test
    void reportsMissingConfigurationAndNetworkFailureWithoutLeakingDetails() {
        CmsProperties missing = CmsProperties.from(Map.of(
            "CMS_STORAGE_ROOT", root.resolve("other-storage").toString()
        ), root.resolve("repo/cms/backend"));
        LandingBuilderService notConfigured = new LandingBuilderService(
            missing, JsonMapper.builder().build(), Duration.ofMillis(200));
        assertThatThrownBy(notConfigured::listPages)
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.status()).isEqualTo(503);
                assertThat(error.getMessage()).contains("ainda não está configurado");
                assertThat(error.getMessage()).doesNotContain(TOKEN);
            });

        server.stop(0);
        assertThatThrownBy(service::listPages)
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.status()).isEqualTo(503);
                assertThat(error.getMessage())
                    .isEqualTo("O construtor de landing pages não está disponível no momento.");
                assertThat(error.getMessage()).doesNotContain(TOKEN);
            });
        server = null;
    }

    private void assertRemoteError(int status, String message) {
        assertThatThrownBy(service::listPages)
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.status()).isEqualTo(status);
                assertThat(error.getMessage()).isEqualTo(message);
                assertThat(error.getMessage()).doesNotContain(TOKEN);
            });
    }

    private void handle(HttpExchange exchange) throws IOException {
        byte[] requestBody = exchange.getRequestBody().readAllBytes();
        Captured observed = new Captured(
            exchange.getRequestMethod(),
            exchange.getRequestURI().toASCIIString(),
            exchange.getRequestHeaders().getFirst("x-landing-builder-service-token"),
            exchange.getRequestHeaders().getFirst("Content-Type"),
            new String(requestBody, StandardCharsets.ISO_8859_1)
        );
        captured.set(observed);
        requests.add(observed);
        Response selected = responder.get().apply(exchange);
        selected.headers().forEach((name, value) -> exchange.getResponseHeaders().set(name, value));
        if (!selected.headers().containsKey("Content-Type")) {
            exchange.getResponseHeaders().set("Content-Type", "application/json");
        }
        byte[] body = selected.body();
        exchange.sendResponseHeaders(selected.status(), body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
    }

    private record Response(int status, byte[] body, Map<String, String> headers) {
        private Response(int status, String body) {
            this(status, body.getBytes(StandardCharsets.UTF_8), Map.of());
        }
    }
    private record Captured(String method, String path, String token, String contentType, String body) { }
}
