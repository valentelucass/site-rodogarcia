package br.com.rodogarcia.site.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import br.com.rodogarcia.site.backend.config.ApplicationProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class HttpCompatibilityFiltersTest {

    @TempDir
    Path temporaryDirectory;

    private AllowedOriginService origins;

    @BeforeEach
    void setUp() {
        origins = new AllowedOriginService(ApplicationProperties.from(
            Map.of(
                "FRONTEND_ORIGIN", "https://allowed.example",
                "HOST", "127.0.0.1",
                "PORT", "31012"
            ),
            temporaryDirectory.resolve("backend")
        ));
    }

    @Test
    void emitsTheLiteralHelmetHeaderSet() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SecurityHeadersFilter().doFilter(request, response, (ignoredRequest, ignoredResponse) -> { });

        assertThat(response.getHeader("Content-Security-Policy")).isEqualTo(
            "default-src 'self';base-uri 'self';font-src 'self' https: data:;"
                + "form-action 'self';frame-ancestors 'self';img-src 'self' data:;"
                + "object-src 'none';script-src 'self';script-src-attr 'none';"
                + "style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests"
        );
        assertThat(response.getHeader("Cross-Origin-Opener-Policy")).isEqualTo("same-origin");
        assertThat(response.getHeader("Cross-Origin-Resource-Policy")).isEqualTo("cross-origin");
        assertThat(response.getHeader("Origin-Agent-Cluster")).isEqualTo("?1");
        assertThat(response.getHeader("Referrer-Policy")).isEqualTo("no-referrer");
        assertThat(response.getHeader("Strict-Transport-Security"))
            .isEqualTo("max-age=31536000; includeSubDomains");
        assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getHeader("X-DNS-Prefetch-Control")).isEqualTo("off");
        assertThat(response.getHeader("X-Download-Options")).isEqualTo("noopen");
        assertThat(response.getHeader("X-Frame-Options")).isEqualTo("SAMEORIGIN");
        assertThat(response.getHeader("X-Permitted-Cross-Domain-Policies")).isEqualTo("none");
        assertThat(response.getHeader("X-XSS-Protection")).isEqualTo("0");
        assertThat(response.getHeader("X-Powered-By")).isNull();
    }

    @Test
    void finishesAllowedPreflightEvenForAnUnknownPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/unknown");
        request.addHeader("Origin", "https://allowed.example");
        request.addHeader("Access-Control-Request-Headers", "X-Test, Content-Type");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean();

        new CorsCompatibilityFilter(origins).doFilter(
            request,
            response,
            (ignoredRequest, ignoredResponse) -> called.set(true)
        );

        assertThat(called).isFalse();
        assertThat(response.getStatus()).isEqualTo(204);
        assertThat(response.getHeader("Access-Control-Allow-Origin"))
            .isEqualTo("https://allowed.example");
        assertThat(response.getHeader("Access-Control-Allow-Credentials")).isEqualTo("true");
        assertThat(response.getHeader("Access-Control-Allow-Methods"))
            .isEqualTo("GET,HEAD,PUT,PATCH,POST,DELETE");
        assertThat(response.getHeader("Access-Control-Allow-Headers"))
            .isEqualTo("X-Test, Content-Type");
        assertThat(response.getHeader("Vary")).isEqualTo("Origin, Access-Control-Request-Headers");
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 408, 411, 413, 414, 500, 501, 503})
    void doesNotAdvertiseKeepAliveForStatusesThatCloseTheSocket(int status) throws Exception {
        for (boolean useSendError : new boolean[] {false, true}) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
            MockHttpServletResponse response = new MockHttpServletResponse();

            new SecurityHeadersFilter().doFilter(request, response, (ignored, filtered) -> {
                HttpServletResponse httpResponse = (HttpServletResponse) filtered;
                if (useSendError) {
                    httpResponse.sendError(status);
                } else {
                    httpResponse.setStatus(status);
                    httpResponse.flushBuffer();
                }
            });

            assertThat(response.getHeaders("Connection")).containsExactly("close");
            assertThat(response.getHeader("Keep-Alive")).isNull();
            assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {200, 204, 304, 401, 403, 404, 415, 422, 429, 502, 504})
    void preservesKeepAliveForReusableResponses(int status) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SecurityHeadersFilter().doFilter(request, response, (ignored, filtered) -> {
            HttpServletResponse httpResponse = (HttpServletResponse) filtered;
            httpResponse.setStatus(500);
            httpResponse.setStatus(status);
        });

        assertThat(response.getHeaders("Connection")).containsExactly("keep-alive");
        assertThat(response.getHeader("Keep-Alive")).isEqualTo("timeout=5");
    }

    @Test
    void joinsDuplicateOriginAndRequestedHeaderFieldsBeforeCorsEvaluation() throws Exception {
        MockHttpServletRequest denied = new MockHttpServletRequest("GET", "/health");
        denied.addHeader("Origin", "https://allowed.example");
        denied.addHeader("Origin", "https://denied.example");
        MockHttpServletResponse deniedResponse = new MockHttpServletResponse();

        new CorsCompatibilityFilter(origins).doFilter(
            denied,
            deniedResponse,
            (ignoredRequest, ignoredResponse) -> { }
        );

        assertThat(deniedResponse.getHeader("Access-Control-Allow-Origin")).isNull();
        assertThat(deniedResponse.getHeader("Access-Control-Allow-Credentials")).isNull();

        MockHttpServletRequest preflight = new MockHttpServletRequest("OPTIONS", "/health");
        preflight.addHeader("Origin", "https://allowed.example");
        preflight.addHeader("Access-Control-Request-Headers", "X-One");
        preflight.addHeader("Access-Control-Request-Headers", "X-Two");
        MockHttpServletResponse preflightResponse = new MockHttpServletResponse();

        new CorsCompatibilityFilter(origins).doFilter(
            preflight,
            preflightResponse,
            (ignoredRequest, ignoredResponse) -> { }
        );

        assertThat(preflightResponse.getHeader("Access-Control-Allow-Headers"))
            .isEqualTo("X-One, X-Two");
    }

    @Test
    void mirrorsExpressAutomaticOptionsOnlyForKnownApiRoutesAfterCorsDenial() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(
            "OPTIONS",
            "/api/collections/123/cancel"
        );
        request.addHeader("Origin", "https://denied.example");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new ExpressOptionsCompatibilityFilter(origins).doFilter(
            request,
            response,
            (ignoredRequest, ignoredResponse) -> { }
        );

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getHeader("Allow")).isEqualTo("POST");
        assertThat(response.getHeader("Content-Type")).isEqualTo("text/plain");
        assertThat(response.getContentAsString(StandardCharsets.UTF_8)).isEqualTo("POST");
        assertThat(response.getHeader("Access-Control-Allow-Origin")).isNull();
    }

    @Test
    void neverAuthorizesAnEmptyOriginEvenWhenFrontendOriginIsEmpty() {
        AllowedOriginService emptyConfiguredOrigin = new AllowedOriginService(
            ApplicationProperties.from(
                Map.of("FRONTEND_ORIGIN", ""),
                temporaryDirectory.resolve("backend")
            )
        );

        assertThat(emptyConfiguredOrigin.isAllowed("")).isFalse();
        assertThat(emptyConfiguredOrigin.isAllowed(null)).isFalse();
    }
}
