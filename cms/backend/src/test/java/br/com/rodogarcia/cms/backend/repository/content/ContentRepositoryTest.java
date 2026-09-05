package br.com.rodogarcia.cms.backend.repository.content;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import br.com.rodogarcia.cms.backend.service.content.ContentMigrationService;
import br.com.rodogarcia.cms.backend.service.content.StructuredContentSanitizer;
import br.com.rodogarcia.cms.backend.service.content.TestContentMediaValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class ContentRepositoryTest {
    @TempDir
    Path root;

    @Test
    void createsTheCanonicalSerializedStoreAndKeepsRuntimeOnlyDefaultsReadable() throws Exception {
        Path project = root.resolve("cms").resolve("backend");
        Path storage = root.resolve("storage");
        Files.createDirectories(project);
        CmsProperties properties = CmsProperties.from(
            Map.of("CMS_STORAGE_ROOT", storage.toString()), project);
        JsonMapper mapper = JsonMapper.builder().build();
        JsonFileStore store = new JsonFileStore(mapper);
        StructuredContentSanitizer sanitizer = new StructuredContentSanitizer(
            mapper, new TestContentMediaValidator());
        ContentMigrationService migrations = new ContentMigrationService(mapper, sanitizer);
        ContentRepository repository = new ContentRepository(
            store, properties.storagePaths(), migrations);

        ObjectNode content = repository.read();

        assertThat(Files.isRegularFile(properties.storagePaths().content())).isTrue();
        assertThat(content.has("improvementsPage")).isTrue();
        assertThat(content.path("homePage").path("hero").path("slides")).isEmpty();
        assertThat(content.path("servicesPage").path("modules")).isEmpty();
        assertThat(content.path("aboutPage").isObject()).isTrue();
        assertThat(content.path("quotePage").path("otherChannels")).hasSize(4);
        assertThat(content.path("quotePage").path("otherChannels").get(0)
            .path("createdAt").asString()).isNotEmpty();
        JsonNode persisted = mapper.readTree(properties.storagePaths().content().toFile());
        assertThat(persisted.has("improvementsPage")).isFalse();
        assertThat(repository.read()).isEqualTo(content);
    }
}
