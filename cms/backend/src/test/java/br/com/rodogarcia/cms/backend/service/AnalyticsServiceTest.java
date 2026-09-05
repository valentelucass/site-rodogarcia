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

class AnalyticsServiceTest {

    @TempDir Path root;
    private DomainTestContext context;
    private AnalyticsService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-03T12:34:56.789Z"), ZoneOffset.UTC);
        context = new DomainTestContext(root, clock, Map.of());
        service = new AnalyticsService(
            context.store, context.properties.storagePaths(), context.tracking,
            context.rateLimits, context.clientIp, clock);
    }

    @Test
    void validatesProvidersAndKeepsThePublicDtoMinimal() throws Exception {
        ObjectNode invalid = (ObjectNode) context.mapper.readTree(
            "{\"providers\":{\"ga4\":{\"enabled\":true,\"measurementId\":\"bad\"}}}");
        assertThatThrownBy(() -> service.updateConfig(invalid))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Measurement ID GA4 válido");

        ObjectNode valid = (ObjectNode) context.mapper.readTree("""
            {"siteUrl":"https://site.example","tracking":{"enabled":true,"heartbeatSeconds":30},
             "providers":{"ga4":{"enabled":true,"measurementId":"g-abcd1234"},
                          "clarity":{"enabled":true,"projectId":"abc123"},
                          "sentry":{"enabled":true,"dsn":"private"}}}
            """);
        ObjectNode stored = service.updateConfig(valid);
        assertThat(stored.path("providers").path("ga4").path("measurementId").asString())
            .isEqualTo("G-ABCD1234");
        ObjectNode publicConfig = service.readPublicConfig();
        assertThat(publicConfig.has("siteUrl")).isFalse();
        assertThat(publicConfig.path("providers").has("sentry")).isFalse();
        assertThat(publicConfig.path("providers").path("ga4").path("enabled").asBoolean()).isTrue();
    }

    @Test
    void recordsOnlyAllowedEventsAndBuildsStatsWithoutLegacyUserIds() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.9");
        ObjectNode invalid = context.mapper.createObjectNode().put("type", "not_allowed");
        assertThatThrownBy(() -> service.createEvent(invalid, request))
            .isInstanceOf(ApiException.class).hasMessage("Tipo de evento invalido.");

        ObjectNode pageView = context.mapper.createObjectNode();
        pageView.put("type", "page_view");
        pageView.put("page", "/servicos");
        pageView.put("sessionId", "session-a");
        pageView.put("userId", "must-not-persist");
        service.createEvent(pageView, request);
        Map<String, Object> stats = service.stats(30);
        assertThat(stats.get("totalPageViews")).isEqualTo(1);
        assertThat(stats.get("uniqueSessions")).isEqualTo(1);
        assertThat(context.store.readArray(context.properties.storagePaths().trackingEvents())
            .get(0).has("userId")).isFalse();
    }

    @Test
    void keepsNullConfigFractionalWindowsAndExpressNumberSerialization() throws Exception {
        assertThat(service.updateConfig(null).isEmpty()).isTrue();
        assertThat(service.updateConfig(context.mapper.nullNode()).isEmpty()).isTrue();

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.10");
        ObjectNode pageView = context.mapper.createObjectNode();
        pageView.put("type", "page_view");
        pageView.put("page", "/servicos/");
        pageView.put("sessionId", "session-a");
        service.createEvent(pageView, request);

        Map<String, Object> stats = service.stats(2.5);
        String json = context.mapper.writeValueAsString(stats);
        assertThat(json).contains("\"bounceRate\":100");
        assertThat(json).doesNotContain("\"bounceRate\":100.0");
        assertThat(json).contains("\"days\":2.5");
        assertThat(json).contains("\"page\":\"/servicos/\"");
    }
}
