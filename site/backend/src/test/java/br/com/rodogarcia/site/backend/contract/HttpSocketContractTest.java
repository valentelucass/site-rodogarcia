package br.com.rodogarcia.site.backend.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.Socket;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import br.com.rodogarcia.site.backend.SiteBackendApplication;
import br.com.rodogarcia.site.backend.config.ApplicationProperties;
import br.com.rodogarcia.site.backend.security.EslOperationTokenService;
import br.com.rodogarcia.site.backend.service.EslTransportService;
import jakarta.servlet.MultipartConfigElement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.filter.FormContentFilter;
import org.springframework.web.multipart.MultipartResolver;
import org.junit.jupiter.api.extension.ExtendWith;

@SpringBootTest(
    classes = SiteBackendApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@Import(HttpSocketContractTest.IsolatedTestConfiguration.class)
@ExtendWith(OutputCaptureExtension.class)
class HttpSocketContractTest {

    private static final String ALLOWED_ORIGIN = "https://frontend.contract.test";
    private static final String DENIED_ORIGIN = "https://denied.contract.test";
    private static final String HEALTH_BODY = "{\"ok\":true}";
    private static final String HEALTH_ETAG = "W/\"b-Ai2R8hgEarLmHKwesT1qcY913ys\"";
    private static final String NOT_FOUND_BODY = "{\"error\":\"Recurso não encontrado.\"}";
    private static final String INTERNAL_ERROR_BODY = "{\"error\":\"Erro interno no servidor.\"}";
    private static final Path TEST_ROOT = createTestRoot();

    @LocalServerPort
    int port;

    @MockitoBean
    EslTransportService eslTransportService;

    @org.springframework.beans.factory.annotation.Autowired
    ConfigurableApplicationContext applicationContext;

    @org.springframework.beans.factory.annotation.Autowired
    EslOperationTokenService operationTokenService;

    private HttpClient client;

    @BeforeEach
    void setUp() {
        client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .version(HttpClient.Version.HTTP_1_1)
            .build();
    }

    @Test
    void servesHealthGetAndHeadWithExpressBytesAndHelmetHeaders() throws Exception {
        HttpResponse<byte[]> get = send(request("/health").GET().build());

        assertThat(get.statusCode()).isEqualTo(200);
        assertThat(get.body()).isEqualTo(HEALTH_BODY.getBytes(StandardCharsets.UTF_8));
        assertThat(header(get, "Content-Type")).isEqualTo("application/json; charset=utf-8");
        assertThat(header(get, "Content-Length")).isEqualTo("11");
        assertThat(header(get, "ETag")).isEqualTo(HEALTH_ETAG);
        assertThat(header(get, "Connection")).isEqualTo("keep-alive");
        assertThat(header(get, "Keep-Alive")).isEqualTo("timeout=5");
        assertHelmetHeaders(get);
        assertDefaultCorsWithoutOrigin(get);
        assertNoRuntimeLeakage(get);

        HttpResponse<byte[]> head = send(request("/health")
            .method("HEAD", HttpRequest.BodyPublishers.noBody())
            .build());

        assertThat(head.statusCode()).isEqualTo(200);
        assertThat(head.body()).isEmpty();
        assertThat(header(head, "Content-Type")).isEqualTo("application/json; charset=utf-8");
        assertThat(header(head, "Content-Length")).isEqualTo("11");
        assertThat(header(head, "ETag")).isEqualTo(HEALTH_ETAG);
        assertHelmetHeaders(head);
        assertDefaultCorsWithoutOrigin(head);
        assertNoRuntimeLeakage(head);
    }

    @Test
    void matchesRouteCasingAndOptionalTrailingSlash() throws Exception {
        HttpResponse<byte[]> response = send(request("/HeAlTh/").GET().build());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo(HEALTH_BODY.getBytes(StandardCharsets.UTF_8));
        assertThat(header(response, "ETag")).isEqualTo(HEALTH_ETAG);
    }

    @Test
    void returns304WithoutEntityHeadersForFreshHealthResponse() throws Exception {
        HttpResponse<byte[]> response = send(request("/health")
            .header("If-None-Match", HEALTH_ETAG)
            .GET()
            .build());

        assertThat(response.statusCode()).isEqualTo(304);
        assertThat(response.body()).isEmpty();
        assertThat(header(response, "ETag")).isEqualTo(HEALTH_ETAG);
        assertThat(response.headers().firstValue("Content-Type")).isEmpty();
        assertThat(response.headers().firstValue("Content-Length")).isEmpty();
        assertHelmetHeaders(response);
        assertDefaultCorsWithoutOrigin(response);
        assertNoRuntimeLeakage(response);
    }

    @Test
    void turnsWrongMethodErrorPathAndUnknownPathIntoTheSameJson404Contract() throws Exception {
        assertNotFound(send(request("/health")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build()));
        assertNotFound(send(request("/error").GET().build()));
        assertNotFound(send(request("/path-that-does-not-exist").GET().build()));
    }

    @Test
    void keepsLiteralSemicolonsInRouteMatchingAndCollectionIdsLikeNode() throws Exception {
        assertNotFound(send(request("/health;probe").GET().build()));
        assertNotFound(send(request("/health;jsessionid=x").GET().build()));
        assertNotFound(send(request("/health;JSESSIONID=x").GET().build()));

        HttpResponse<byte[]> fixedMutation = send(request("/api/quote/fractional;probe")
            .header("Origin", ALLOWED_ORIGIN)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
            .build());
        assertNotFoundPayload(fixedMutation);
        assertAllowedCors(fixedMutation);

        String tokenForUnmodifiedId = operationTokenService
            .createCollectionMaintenanceToken("123");
        HttpResponse<byte[]> dynamicMutation = send(request("/api/collections/123;probe")
            .header("Origin", ALLOWED_ORIGIN)
            .header("Content-Type", "application/json")
            .header("x-collection-capability", tokenForUnmodifiedId)
            .method("PATCH", HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
            .build());
        assertJsonError(
            dynamicMutation,
            403,
            "A autorização desta operação é inválida ou expirou."
        );
        assertAllowedCors(dynamicMutation);

        HttpResponse<byte[]> sessionLookingId = send(request(
            "/api/collections/123;jsessionid=x"
        )
            .header("Origin", ALLOWED_ORIGIN)
            .header("Content-Type", "application/json")
            .header("x-collection-capability", tokenForUnmodifiedId)
            .method("PATCH", HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
            .build());
        assertJsonError(
            sessionLookingId,
            403,
            "A autorização desta operação é inválida ou expirou."
        );

        HttpResponse<byte[]> deniedOptions = send(request("/api/quote/fractional;probe")
            .header("Origin", DENIED_ORIGIN)
            .header("Access-Control-Request-Method", "POST")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
            .build());
        assertNotFoundPayload(deniedOptions);
        assertThat(deniedOptions.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
        assertThat(deniedOptions.headers().firstValue("Vary")).isEmpty();
        verifyNoInteractions(eslTransportService);
    }

    @Test
    void distinguishesMissingBodyFramingFromAnExplicitZeroLengthBody() throws Exception {
        RawHttpResponse unframed = sendRaw(
            "POST",
            "/api/quote/fractional",
            Map.of(
                "Origin", ALLOWED_ORIGIN,
                "Content-Type", "application/json"
            ),
            null
        );
        assertRawJsonError(unframed, 415, "Content-Type deve ser application/json.");
        assertRawAllowedCors(unframed);

        RawHttpResponse explicitEmpty = sendRaw(
            "POST",
            "/api/quote/fractional",
            Map.of(
                "Origin", ALLOWED_ORIGIN,
                "Content-Type", "application/json"
            ),
            ""
        );
        assertRawJsonError(explicitEmpty, 422, "Informe um CNPJ válido.");
        assertRawAllowedCors(explicitEmpty);
        verifyNoInteractions(eslTransportService);
    }

    @Test
    void handlesAsteriskOptionsAndRejectsLowercaseMethodsLikeNodeHttpParser() throws Exception {
        RawHttpResponse allowed = sendRaw(
            "OPTIONS",
            "*",
            Map.of(
                "Origin", ALLOWED_ORIGIN,
                "Access-Control-Request-Method", "POST"
            ),
            null
        );
        assertThat(allowed.statusCode()).isEqualTo(204);
        assertThat(allowed.body()).isEmpty();
        assertThat(allowed.header("Content-Length")).isEqualTo("0");
        assertRawAllowedCors(allowed);
        assertRawHelmetHeaders(allowed);

        RawHttpResponse denied = sendRaw(
            "OPTIONS",
            "*",
            Map.of(
                "Origin", DENIED_ORIGIN,
                "Access-Control-Request-Method", "POST"
            ),
            null
        );
        assertRawJsonError(denied, 404, "Recurso não encontrado.");
        assertThat(denied.header("Access-Control-Allow-Origin")).isNull();
        assertThat(denied.header("Access-Control-Allow-Credentials")).isNull();
        assertThat(denied.header("Vary")).isNull();

        for (String method : new String[] { "get", "head", "options" }) {
            RawHttpResponse lowercase = sendRaw(method, "/health", Map.of(), null);
            assertThat(lowercase.statusCode()).isEqualTo(400);
            assertThat(lowercase.header("Connection")).isEqualTo("close");
            assertThat(lowercase.header("Content-Security-Policy")).isNull();
        }
    }

    @Test
    void acceptsHeadersUpToTheNodeSixteenKibibyteParserLimit() throws Exception {
        RawHttpResponse response = sendRaw(
            "GET",
            "/health",
            Map.of("X-Contract-Padding", "a".repeat(12_000)),
            null
        );

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo(HEALTH_BODY.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void passesEncodedSlashBackslashAndNullThroughTheExpressCompatibilityPipeline()
        throws Exception {
        for (String encoded : new String[] { "%2F", "%5C", "%00" }) {
            assertNotFound(send(request("/health" + encoded).GET().build()));

            HttpResponse<byte[]> fixedMutation = send(request(
                "/api/quote/fractional" + encoded + "probe"
            )
                .header("Origin", ALLOWED_ORIGIN)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
                .build());
            assertNotFoundPayload(fixedMutation);
            assertAllowedCors(fixedMutation);

            String collectionPath = "/api/collections/123" + encoded + "probe";
            HttpResponse<byte[]> allowedOptions = send(request(collectionPath)
                .header("Origin", ALLOWED_ORIGIN)
                .header("Access-Control-Request-Method", "PATCH")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .build());
            assertThat(allowedOptions.statusCode()).isEqualTo(204);
            assertThat(allowedOptions.body()).isEmpty();
            assertThat(header(allowedOptions, "Content-Length")).isEqualTo("0");
            assertAllowedCors(allowedOptions);
            assertHelmetHeaders(allowedOptions);

            HttpResponse<byte[]> deniedOptions = send(request(collectionPath)
                .header("Origin", DENIED_ORIGIN)
                .header("Access-Control-Request-Method", "PATCH")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .build());
            assertThat(deniedOptions.statusCode()).isEqualTo(200);
            assertThat(deniedOptions.body()).isEqualTo(
                "PATCH".getBytes(StandardCharsets.UTF_8)
            );
            assertThat(header(deniedOptions, "Allow")).isEqualTo("PATCH");
            assertHelmetHeaders(deniedOptions);

            String tokenForDifferentId = operationTokenService
                .createCollectionMaintenanceToken("123");
            HttpResponse<byte[]> capabilityProtectedMutation = send(request(collectionPath)
                .header("Origin", ALLOWED_ORIGIN)
                .header("Content-Type", "application/json")
                .header("x-collection-capability", tokenForDifferentId)
                .method("PATCH", HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
                .build());
            assertJsonError(
                capabilityProtectedMutation,
                403,
                "A autorização desta operação é inválida ou expirou."
            );
            assertAllowedCors(capabilityProtectedMutation);
        }

        verifyNoInteractions(eslTransportService);
    }

    @Test
    void acceptsNodeCompatiblePrintableRequestTargetsOverRawTcp() throws Exception {
        for (String suffix : new String[] {
            "\\probe",
            "[probe",
            "]probe",
            "{probe",
            "}probe",
            "|probe",
            "^probe",
            "`probe",
            "<probe",
            ">probe",
            "\"probe"
        }) {
            assertRawNotFound(sendRaw("GET", "/health" + suffix, Map.of(), null));
        }

        RawHttpResponse deniedOptions = sendRaw(
            "OPTIONS",
            "/api/collections/123\\probe",
            Map.of(
                "Origin", DENIED_ORIGIN,
                "Access-Control-Request-Method", "PATCH"
            ),
            null
        );
        assertThat(deniedOptions.statusCode()).isEqualTo(200);
        assertThat(deniedOptions.body()).isEqualTo("PATCH".getBytes(StandardCharsets.UTF_8));
        assertThat(deniedOptions.header("Allow")).isEqualTo("PATCH");
        assertRawHelmetHeaders(deniedOptions);

        String token = operationTokenService.createCollectionMaintenanceToken("123");
        RawHttpResponse capabilityProtected = sendRaw(
            "PATCH",
            "/api/collections/123\\probe",
            Map.of(
                "Origin", ALLOWED_ORIGIN,
                "Content-Type", "application/json",
                "x-collection-capability", token
            ),
            "{}"
        );
        assertRawJsonError(
            capabilityProtected,
            403,
            "A autorização desta operação é inválida ou expirou."
        );
        assertRawAllowedCors(capabilityProtected);
        verifyNoInteractions(eslTransportService);
    }

    @Test
    void defersInvalidPercentAndUtf8DecodingToParameterizedRoutesOverRawTcp()
        throws Exception {
        for (String invalid : new String[] { "%", "%2", "%GG", "%C3", "%ED%A0%80" }) {
            assertRawNotFound(sendRaw("GET", "/health" + invalid, Map.of(), null));

            RawHttpResponse dynamicGet = sendRaw(
                "GET",
                "/api/public/postal-code/123" + invalid,
                Map.of(),
                null
            );
            assertRawJsonError(dynamicGet, 500, "Erro interno no servidor.");
            assertRawDefaultCors(dynamicGet);

            String collectionPath = "/api/collections/123" + invalid;
            RawHttpResponse allowedOptions = sendRaw(
                "OPTIONS",
                collectionPath,
                Map.of(
                    "Origin", ALLOWED_ORIGIN,
                    "Access-Control-Request-Method", "PATCH"
                ),
                null
            );
            assertThat(allowedOptions.statusCode()).isEqualTo(204);
            assertThat(allowedOptions.body()).isEmpty();
            assertThat(allowedOptions.header("Content-Length")).isEqualTo("0");
            assertRawAllowedCors(allowedOptions);
            assertRawHelmetHeaders(allowedOptions);

            RawHttpResponse deniedOptions = sendRaw(
                "OPTIONS",
                collectionPath,
                Map.of(
                    "Origin", DENIED_ORIGIN,
                    "Access-Control-Request-Method", "PATCH"
                ),
                null
            );
            assertRawJsonError(deniedOptions, 500, "Erro interno no servidor.");
            assertThat(deniedOptions.header("Access-Control-Allow-Origin")).isNull();
            assertThat(deniedOptions.header("Access-Control-Allow-Credentials")).isNull();
            assertThat(deniedOptions.header("Vary")).isNull();
        }

        String validToken = operationTokenService.createCollectionMaintenanceToken("123");
        for (String invalid : new String[] { "%GG", "%C3" }) {
            RawHttpResponse invalidCapabilityPath = sendRaw(
                "PATCH",
                "/api/collections/123" + invalid,
                Map.of(
                    "Origin", ALLOWED_ORIGIN,
                    "Content-Type", "application/json",
                    "x-collection-capability", validToken
                ),
                "{}"
            );
            assertRawJsonError(invalidCapabilityPath, 500, "Erro interno no servidor.");
            assertRawAllowedCors(invalidCapabilityPath);
        }

        RawHttpResponse validUtf8 = sendRaw(
            "PATCH",
            "/api/collections/123%C3%A9",
            Map.of(
                "Origin", ALLOWED_ORIGIN,
                "Content-Type", "application/json",
                "x-collection-capability", validToken
            ),
            "{}"
        );
        assertRawJsonError(
            validUtf8,
            403,
            "A autorização desta operação é inválida ou expirou."
        );
        assertRawAllowedCors(validUtf8);

        RawHttpResponse decodedId = sendRaw(
            "PATCH",
            "/api/collections/12%33",
            Map.of(
                "Origin", ALLOWED_ORIGIN,
                "Content-Type", "application/json",
                "x-collection-capability", validToken
            ),
            "{}"
        );
        assertRawJsonError(
            decodedId,
            422,
            "Informe ao menos um dado para atualizar a coleta."
        );
        assertRawAllowedCors(decodedId);
        verifyNoInteractions(eslTransportService);
    }

    @Test
    void appliesAllowedPreflightGloballyIncludingUnknownPaths() throws Exception {
        HttpResponse<byte[]> response = send(request("/unknown-preflight-target")
            .header("Origin", ALLOWED_ORIGIN)
            .header("Access-Control-Request-Method", "DELETE")
            .header("Access-Control-Request-Headers", "X-Test, Content-Type")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
            .build());

        assertThat(response.statusCode()).isEqualTo(204);
        assertThat(response.body()).isEmpty();
        assertThat(header(response, "Content-Length")).isEqualTo("0");
        assertThat(header(response, "Access-Control-Allow-Origin")).isEqualTo(ALLOWED_ORIGIN);
        assertThat(header(response, "Access-Control-Allow-Credentials")).isEqualTo("true");
        assertThat(header(response, "Access-Control-Allow-Methods"))
            .isEqualTo("GET,HEAD,PUT,PATCH,POST,DELETE");
        assertThat(header(response, "Access-Control-Allow-Headers"))
            .isEqualTo("X-Test, Content-Type");
        assertThat(header(response, "Vary"))
            .isEqualTo("Origin, Access-Control-Request-Headers");
        assertHelmetHeaders(response);
        assertNoRuntimeLeakage(response);

        HttpResponse<byte[]> withoutRequestedHeaders = send(request("/another-unknown-target")
            .header("Origin", ALLOWED_ORIGIN)
            .header("Access-Control-Request-Method", "GET")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
            .build());

        assertThat(withoutRequestedHeaders.statusCode()).isEqualTo(204);
        assertThat(header(withoutRequestedHeaders, "Content-Length")).isEqualTo("0");
        assertThat(header(withoutRequestedHeaders, "Vary"))
            .isEqualTo("Origin, Access-Control-Request-Headers");
        assertThat(withoutRequestedHeaders.headers().firstValue("Access-Control-Allow-Headers"))
            .isEmpty();
    }

    @Test
    void mirrorsExpressAutomaticOptionsForKnownRouteWhenOriginIsDenied() throws Exception {
        HttpResponse<byte[]> response = send(request("/API/COLLECTIONS/123/CANCEL/")
            .header("Origin", DENIED_ORIGIN)
            .header("Access-Control-Request-Method", "POST")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
            .build());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo("POST".getBytes(StandardCharsets.UTF_8));
        assertThat(header(response, "Content-Type")).isEqualTo("text/plain");
        assertThat(header(response, "Content-Length")).isEqualTo("4");
        assertThat(header(response, "Allow")).isEqualTo("POST");
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
        assertThat(response.headers().firstValue("Access-Control-Allow-Credentials")).isEmpty();
        assertThat(response.headers().firstValue("Vary")).isEmpty();
        assertHelmetHeaders(response);
        assertNoRuntimeLeakage(response);
    }

    @Test
    void treatsEmptyOriginAsAbsentForCorsButStillRejectsItForMutationPolicy() throws Exception {
        HttpResponse<byte[]> health = send(request("/health")
            .header("Origin", "")
            .GET()
            .build());

        assertThat(health.statusCode()).isEqualTo(200);
        assertDefaultCorsWithoutOrigin(health);

        HttpResponse<byte[]> mutation = send(request("/api/quote/fractional")
            .header("Origin", "")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
            .build());

        assertJsonError(mutation, 403, "Origem não autorizada.");
        assertDefaultCorsWithoutOrigin(mutation);
        verifyNoInteractions(eslTransportService);
    }

    @Test
    void rejectsDuplicateOriginAndCapabilityFieldsLikeNode() throws Exception {
        HttpResponse<byte[]> health = send(request("/health")
            .header("Origin", ALLOWED_ORIGIN)
            .header("Origin", DENIED_ORIGIN)
            .GET()
            .build());

        assertThat(health.statusCode()).isEqualTo(200);
        assertThat(health.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
        assertThat(health.headers().firstValue("Access-Control-Allow-Credentials")).isEmpty();

        String token = operationTokenService.createCollectionMaintenanceToken("123");
        HttpResponse<byte[]> mutation = send(request("/api/collections/123")
            .header("Origin", ALLOWED_ORIGIN)
            .header("Content-Type", "application/json")
            .header("x-collection-capability", token)
            .header("x-collection-capability", "garbage")
            .method("PATCH", HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
            .build());

        assertJsonError(
            mutation,
            403,
            "A autorização desta operação é inválida ou expirou."
        );
        verifyNoInteractions(eslTransportService);
    }

    @Test
    void returnsJson404ForDeniedOptionsOnHealth() throws Exception {
        HttpResponse<byte[]> response = send(request("/health")
            .header("Origin", DENIED_ORIGIN)
            .header("Access-Control-Request-Method", "GET")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
            .build());

        assertNotFoundPayload(response);
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
        assertThat(response.headers().firstValue("Access-Control-Allow-Credentials")).isEmpty();
        assertThat(response.headers().firstValue("Vary")).isEmpty();
        assertNoRuntimeLeakage(response);
    }

    @org.junit.jupiter.api.RepeatedTest(10)
    void rejectsMalformedPrimitiveAndNonUtfJsonBeforeKnownOrUnknownRouting() throws Exception {
        for (String path : new String[] { "/api/quote/fractional", "/unknown-json-target" }) {
            assertInternalJsonParserError(send(jsonRequest(path, "application/json", "{")));
            assertInternalJsonParserError(send(jsonRequest(path, "application/json", "1")));
            assertInternalJsonParserError(send(jsonRequest(
                path,
                "application/json; charset=iso-8859-1",
                "{}"
            )));
        }

        verifyNoInteractions(eslTransportService);
    }

    @Test
    void doesNotAddJacksonLimitsBelowTheExistingTwoMegabyteBodyLimit() throws Exception {
        String deeplyNested = "{\"value\":" + "[".repeat(501) + "0" + "]".repeat(501) + "}";
        String longNumber = "{\"value\":" + "9".repeat(1_001) + "}";
        String longPropertyName = "{\"" + "n".repeat(50_001) + "\":true}";

        for (String body : new String[] { deeplyNested, longNumber, longPropertyName }) {
            HttpResponse<byte[]> response = send(jsonRequest(
                "/unknown-json-target",
                "application/json",
                body
            ));
            assertNotFoundPayload(response);
            assertThat(header(response, "Access-Control-Allow-Origin")).isEqualTo(ALLOWED_ORIGIN);
            assertThat(header(response, "Access-Control-Allow-Credentials")).isEqualTo("true");
            assertThat(header(response, "Vary")).isEqualTo("Origin");
        }

        verifyNoInteractions(eslTransportService);
    }

    @Test
    void doesNotExposeSessionPoweredByOrActuatorSurfaces() throws Exception {
        for (String path : new String[] { "/actuator", "/actuator/health" }) {
            HttpResponse<byte[]> response = send(request(path).GET().build());

            assertNotFound(response);
            assertNoRuntimeLeakage(response);
        }
    }

    @Test
    void disablesAutomaticMultipartAndFormContentParsing() throws Exception {
        assertThat(applicationContext.getBeansOfType(FormContentFilter.class)).isEmpty();
        assertThat(applicationContext.getBeansOfType(MultipartResolver.class)).isEmpty();
        assertThat(applicationContext.getBeansOfType(MultipartConfigElement.class)).isEmpty();

        HttpResponse<byte[]> multipart = send(request("/api/quote/fractional")
            .header("Origin", ALLOWED_ORIGIN)
            .header("Content-Type", "multipart/form-data; boundary=contract")
            .POST(HttpRequest.BodyPublishers.ofString(
                "--contract--\r\n",
                StandardCharsets.UTF_8
            ))
            .build());
        assertJsonError(multipart, 415, "Content-Type deve ser application/json.");

        HttpResponse<byte[]> form = send(request("/api/collections/123")
            .header("Origin", ALLOWED_ORIGIN)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .method(
                "PATCH",
                HttpRequest.BodyPublishers.ofString("comments=teste", StandardCharsets.UTF_8)
            )
            .build());
        assertJsonError(form, 415, "Content-Type deve ser application/json.");
        verifyNoInteractions(eslTransportService);
    }

    @Test
    void ignoresGenericSpringEnvironmentAndSystemPropertyOverrides() {
        var sources = applicationContext.getEnvironment().getPropertySources();

        assertThat(sources.contains("systemEnvironment")).isFalse();
        assertThat(sources.contains("systemProperties")).isFalse();
        assertThat(sources.contains("commandLineArgs")).isFalse();
        assertThat(sources.contains("spring.application.json")).isFalse();
        assertThat(applicationContext.getEnvironment().getProperty("debug")).isNull();
        assertThat(applicationContext.getEnvironment().getProperty(
            "server.servlet.context-path"
        )).isNull();
    }

    @Test
    void doesNotWriteUnknownSensitiveUrlsToLogs(CapturedOutput output) throws Exception {
        String canary = "secret-cnpj-60960473000243";

        assertNotFound(send(request("/" + canary).GET().build()));

        assertThat(output).doesNotContain(canary);
    }

    private HttpRequest jsonRequest(String path, String contentType, String body) {
        return request(path)
            .header("Origin", ALLOWED_ORIGIN)
            .header("Content-Type", contentType)
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
            .timeout(Duration.ofSeconds(10));
    }

    private HttpResponse<byte[]> send(HttpRequest request) throws IOException, InterruptedException {
        return client.send(request, HttpResponse.BodyHandlers.ofByteArray());
    }

    private RawHttpResponse sendRaw(
        String method,
        String requestTarget,
        Map<String, String> headers,
        String body
    ) throws IOException {
        byte[] bodyBytes = body == null
            ? new byte[0]
            : body.getBytes(StandardCharsets.UTF_8);
        StringBuilder requestHead = new StringBuilder()
            .append(method)
            .append(' ')
            .append(requestTarget)
            .append(" HTTP/1.1\r\n")
            .append("Host: 127.0.0.1:")
            .append(port)
            .append("\r\n")
            .append("Connection: close\r\n");
        for (Map.Entry<String, String> header : headers.entrySet()) {
            requestHead.append(header.getKey())
                .append(": ")
                .append(header.getValue())
                .append("\r\n");
        }
        if (body != null) {
            requestHead.append("Content-Length: ").append(bodyBytes.length).append("\r\n");
        }
        requestHead.append("\r\n");

        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("127.0.0.1", port), 5_000);
            socket.setSoTimeout(10_000);
            socket.getOutputStream().write(
                requestHead.toString().getBytes(StandardCharsets.ISO_8859_1)
            );
            socket.getOutputStream().write(bodyBytes);
            socket.getOutputStream().flush();
            return parseRawResponse(socket.getInputStream().readAllBytes());
        }
    }

    private static RawHttpResponse parseRawResponse(byte[] bytes) throws IOException {
        int headerEnd = indexOf(bytes, new byte[] { '\r', '\n', '\r', '\n' });
        if (headerEnd < 0) {
            throw new IOException("Resposta HTTP sem separador de headers.");
        }
        String[] lines = new String(
            bytes,
            0,
            headerEnd,
            StandardCharsets.ISO_8859_1
        ).split("\\r\\n");
        String[] statusParts = lines[0].split(" ", 3);
        if (statusParts.length < 2) {
            throw new IOException("Status HTTP inválido.");
        }

        Map<String, String> headers = new LinkedHashMap<>();
        for (int index = 1; index < lines.length; index++) {
            int separator = lines[index].indexOf(':');
            if (separator <= 0) {
                continue;
            }
            String name = lines[index].substring(0, separator).toLowerCase(Locale.ROOT);
            String value = lines[index].substring(separator + 1).stripLeading();
            headers.merge(name, value, (current, next) -> current + ", " + next);
        }
        return new RawHttpResponse(
            Integer.parseInt(statusParts[1]),
            headers,
            Arrays.copyOfRange(bytes, headerEnd + 4, bytes.length)
        );
    }

    private static int indexOf(byte[] value, byte[] searched) {
        for (int index = 0; index <= value.length - searched.length; index++) {
            boolean matches = true;
            for (int offset = 0; offset < searched.length; offset++) {
                if (value[index + offset] != searched[offset]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                return index;
            }
        }
        return -1;
    }

    private static String header(HttpResponse<?> response, String name) {
        return response.headers().firstValue(name).orElse(null);
    }

    private static void assertNotFound(HttpResponse<byte[]> response) {
        assertNotFoundPayload(response);
        assertDefaultCorsWithoutOrigin(response);
    }

    private static void assertNotFoundPayload(HttpResponse<byte[]> response) {
        assertThat(response.statusCode()).isEqualTo(404);
        assertThat(response.body()).isEqualTo(NOT_FOUND_BODY.getBytes(StandardCharsets.UTF_8));
        assertThat(header(response, "Content-Type")).isEqualTo("application/json; charset=utf-8");
        assertThat(header(response, "Content-Length"))
            .isEqualTo(Integer.toString(NOT_FOUND_BODY.getBytes(StandardCharsets.UTF_8).length));
        assertHelmetHeaders(response);
    }

    private static void assertInternalJsonParserError(HttpResponse<byte[]> response) {
        assertThat(response.statusCode()).isEqualTo(500);
        assertThat(response.headers().allValues("Connection")).containsExactly("close");
        assertThat(response.headers().allValues("Keep-Alive")).isEmpty();
        assertThat(response.body()).isEqualTo(INTERNAL_ERROR_BODY.getBytes(StandardCharsets.UTF_8));
        assertThat(header(response, "Content-Type")).isEqualTo("application/json; charset=utf-8");
        assertThat(header(response, "Content-Length"))
            .isEqualTo(Integer.toString(INTERNAL_ERROR_BODY.getBytes(StandardCharsets.UTF_8).length));
        assertThat(header(response, "Access-Control-Allow-Origin")).isEqualTo(ALLOWED_ORIGIN);
        assertThat(header(response, "Access-Control-Allow-Credentials")).isEqualTo("true");
        assertThat(header(response, "Vary")).isEqualTo("Origin");
        assertHelmetHeaders(response);
        assertNoRuntimeLeakage(response);
    }

    private static void assertJsonError(
        HttpResponse<byte[]> response,
        int status,
        String message
    ) {
        byte[] body = ("{\"error\":\"" + message + "\"}")
            .getBytes(StandardCharsets.UTF_8);
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(response.body()).isEqualTo(body);
        assertThat(header(response, "Content-Type")).isEqualTo("application/json; charset=utf-8");
        assertThat(header(response, "Content-Length")).isEqualTo(Integer.toString(body.length));
        assertHelmetHeaders(response);
        assertNoRuntimeLeakage(response);
    }

    private static void assertHelmetHeaders(HttpResponse<?> response) {
        assertThat(header(response, "Content-Security-Policy")).isEqualTo(
            "default-src 'self';base-uri 'self';font-src 'self' https: data:;"
                + "form-action 'self';frame-ancestors 'self';img-src 'self' data:;"
                + "object-src 'none';script-src 'self';script-src-attr 'none';"
                + "style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests"
        );
        assertThat(header(response, "Cross-Origin-Opener-Policy")).isEqualTo("same-origin");
        assertThat(header(response, "Cross-Origin-Resource-Policy")).isEqualTo("cross-origin");
        assertThat(header(response, "Origin-Agent-Cluster")).isEqualTo("?1");
        assertThat(header(response, "Referrer-Policy")).isEqualTo("no-referrer");
        assertThat(header(response, "Strict-Transport-Security"))
            .isEqualTo("max-age=31536000; includeSubDomains");
        assertThat(header(response, "X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(header(response, "X-DNS-Prefetch-Control")).isEqualTo("off");
        assertThat(header(response, "X-Download-Options")).isEqualTo("noopen");
        assertThat(header(response, "X-Frame-Options")).isEqualTo("SAMEORIGIN");
        assertThat(header(response, "X-Permitted-Cross-Domain-Policies")).isEqualTo("none");
        assertThat(header(response, "X-XSS-Protection")).isEqualTo("0");
        assertThat(response.headers().firstValue("Permissions-Policy")).isEmpty();
    }

    private static void assertDefaultCorsWithoutOrigin(HttpResponse<?> response) {
        assertThat(header(response, "Access-Control-Allow-Credentials")).isEqualTo("true");
        assertThat(header(response, "Vary")).isEqualTo("Origin");
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
    }

    private static void assertAllowedCors(HttpResponse<?> response) {
        assertThat(header(response, "Access-Control-Allow-Origin")).isEqualTo(ALLOWED_ORIGIN);
        assertThat(header(response, "Access-Control-Allow-Credentials")).isEqualTo("true");
        assertThat(header(response, "Vary")).startsWith("Origin");
    }

    private static void assertRawNotFound(RawHttpResponse response) {
        assertRawJsonError(response, 404, "Recurso não encontrado.");
        assertRawDefaultCors(response);
    }

    private static void assertRawJsonError(
        RawHttpResponse response,
        int status,
        String message
    ) {
        byte[] expectedBody = ("{\"error\":\"" + message + "\"}")
            .getBytes(StandardCharsets.UTF_8);
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(response.body()).isEqualTo(expectedBody);
        assertThat(response.header("Content-Type")).isEqualTo("application/json; charset=utf-8");
        assertThat(response.header("Content-Length"))
            .isEqualTo(Integer.toString(expectedBody.length));
        assertRawHelmetHeaders(response);
        assertRawNoRuntimeLeakage(response);
    }

    private static void assertRawAllowedCors(RawHttpResponse response) {
        assertThat(response.header("Access-Control-Allow-Origin")).isEqualTo(ALLOWED_ORIGIN);
        assertThat(response.header("Access-Control-Allow-Credentials")).isEqualTo("true");
        assertThat(response.header("Vary")).startsWith("Origin");
    }

    private static void assertRawDefaultCors(RawHttpResponse response) {
        assertThat(response.header("Access-Control-Allow-Credentials")).isEqualTo("true");
        assertThat(response.header("Vary")).isEqualTo("Origin");
        assertThat(response.header("Access-Control-Allow-Origin")).isNull();
    }

    private static void assertRawHelmetHeaders(RawHttpResponse response) {
        assertThat(response.header("Content-Security-Policy")).isEqualTo(
            "default-src 'self';base-uri 'self';font-src 'self' https: data:;"
                + "form-action 'self';frame-ancestors 'self';img-src 'self' data:;"
                + "object-src 'none';script-src 'self';script-src-attr 'none';"
                + "style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests"
        );
        assertThat(response.header("Cross-Origin-Opener-Policy")).isEqualTo("same-origin");
        assertThat(response.header("Cross-Origin-Resource-Policy")).isEqualTo("cross-origin");
        assertThat(response.header("Origin-Agent-Cluster")).isEqualTo("?1");
        assertThat(response.header("Referrer-Policy")).isEqualTo("no-referrer");
        assertThat(response.header("Strict-Transport-Security"))
            .isEqualTo("max-age=31536000; includeSubDomains");
        assertThat(response.header("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.header("X-DNS-Prefetch-Control")).isEqualTo("off");
        assertThat(response.header("X-Download-Options")).isEqualTo("noopen");
        assertThat(response.header("X-Frame-Options")).isEqualTo("SAMEORIGIN");
        assertThat(response.header("X-Permitted-Cross-Domain-Policies")).isEqualTo("none");
        assertThat(response.header("X-XSS-Protection")).isEqualTo("0");
        assertThat(response.header("Permissions-Policy")).isNull();
    }

    private static void assertRawNoRuntimeLeakage(RawHttpResponse response) {
        assertThat(response.header("Set-Cookie")).isNull();
        assertThat(response.header("Server")).isNull();
        assertThat(response.header("X-Powered-By")).isNull();
    }

    private static void assertNoRuntimeLeakage(HttpResponse<?> response) {
        assertThat(response.headers().firstValue("Set-Cookie")).isEmpty();
        assertThat(response.headers().firstValue("Server")).isEmpty();
        assertThat(response.headers().firstValue("X-Powered-By")).isEmpty();
        assertThat(response.headers().map().keySet())
            .noneMatch(name -> name.equalsIgnoreCase("JSESSIONID"));
    }

    private static Path createTestRoot() {
        try {
            Path root = Files.createTempDirectory("rodogarcia-http-contract-");
            Files.createDirectories(root.resolve("storage/private"));
            return root.toAbsolutePath().normalize();
        } catch (IOException error) {
            throw new ExceptionInInitializerError(error);
        }
    }

    private record RawHttpResponse(
        int statusCode,
        Map<String, String> headers,
        byte[] body
    ) {
        private String header(String name) {
            return headers.get(name.toLowerCase(Locale.ROOT));
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class IsolatedTestConfiguration {

        @Bean
        @Primary
        ApplicationProperties contractApplicationProperties() {
            Path projectRoot = TEST_ROOT.resolve("site/backend");
            return ApplicationProperties.from(
                Map.ofEntries(
                    Map.entry("NODE_ENV", "development"),
                    Map.entry("HOST", "127.0.0.1"),
                    Map.entry("PORT", "0"),
                    Map.entry("STORAGE_ROOT", TEST_ROOT.resolve("storage").toString()),
                    Map.entry(
                        "RATE_LIMITS_STORE_PATH",
                        TEST_ROOT.resolve("storage/private/rate-limits.json").toString()
                    ),
                    Map.entry("FRONTEND_ORIGIN", ALLOWED_ORIGIN),
                    Map.entry("ESL_TENANT", "contract-test"),
                    Map.entry("GRAPHQL_API_KEY", "contract-test-key"),
                    Map.entry(
                        "ESL_OPERATION_SECRET",
                        "contract-test-operation-secret-at-least-32-chars"
                    )
                ),
                projectRoot
            );
        }
    }
}
