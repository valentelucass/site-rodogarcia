package br.com.rodogarcia.cms.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.Map;
import java.util.UUID;

import br.com.rodogarcia.cms.backend.CmsBackendApplication;
import br.com.rodogarcia.cms.backend.config.CmsProperties;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.server.PathContainer;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(classes = {
    EndpointManifestCoverageTest.IsolatedConfiguration.class,
    CmsBackendApplication.class
})
class EndpointManifestCoverageTest {

    private static final Path TEST_ROOT = Path.of("target", "endpoint-contract-" + UUID.randomUUID())
        .toAbsolutePath().normalize();

    @Autowired
    RequestMappingHandlerMapping mappings;

    @Autowired
    JsonMapper mapper;

    @Test
    void everyFrozenNodeEndpointHasAConcreteSpringControllerMapping() throws Exception {
        JsonNode manifest = mapper.readTree(Files.readString(
            Path.of("contracts", "endpoint-manifest.v1.json")));
        assertThat(manifest.path("endpoints")).hasSize(95);

        for (JsonNode endpoint : manifest.path("endpoints")) {
            String path = concretePath(endpoint.path("path").asString());
            RequestMethod method = RequestMethod.valueOf(endpoint.path("method").asString());
            boolean found = mappings.getHandlerMethods().entrySet().stream().anyMatch(entry -> {
                if (entry.getValue().getBeanType().equals(FallbackController.class)) return false;
                var methods = entry.getKey().getMethodsCondition().getMethods();
                if (!methods.isEmpty() && !methods.contains(method)) return false;
                var patterns = entry.getKey().getPathPatternsCondition();
                return patterns != null && patterns.getPatterns().stream()
                    .anyMatch(pattern -> pattern.matches(PathContainer.parsePath(path)));
            });
            assertThat(found)
                .as("%s %s (%s)", method, path, endpoint.path("id").asString())
                .isTrue();
        }
    }

    @AfterAll
    static void cleanIsolatedStorage() throws IOException {
        if (!Files.exists(TEST_ROOT)) return;
        try (var paths = Files.walk(TEST_ROOT)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }

    private static String concretePath(String path) {
        return path
            .replace(":pageKey", "about")
            .replace(":sectionKey", "hero")
            .replace(":attachmentId", "attachment-contract")
            .replace(":entity", "units")
            .replace(":id", "contract-id");
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class IsolatedConfiguration {

        @Bean
        @Primary
        CmsProperties isolatedCmsProperties() throws IOException {
            Path storage = TEST_ROOT.resolve("storage");
            Files.createDirectories(storage);
            return CmsProperties.from(Map.of(
                "NODE_ENV", "development",
                "FRONTEND_ORIGIN", "http://127.0.0.1:35180",
                "CMS_INTERNAL_URL", "http://127.0.0.1:35013",
                "CMS_STORAGE_ROOT", storage.toString(),
                "SESSION_SECRET", "synthetic-session-secret-over-thirty-two-characters",
                "ADMIN_SETUP_CODE", "synthetic-setup-code-safe"
            ), Path.of("").toAbsolutePath().normalize());
        }
    }
}
