package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Path;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class PublicMediaCatalogTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @TempDir
    Path temporaryDirectory;

    @Test
    void publishesOnlyKnownCatalogDerivativesWithTheirExactDimensions() {
        Path libraryPath = temporaryDirectory.resolve("media-library.json");
        JsonFileStore store = new JsonFileStore(mapper);
        StoragePaths paths = mock(StoragePaths.class);
        when(paths.mediaLibrary()).thenReturn(libraryPath);
        ArrayNode library = mapper.createArrayNode();
        library.addObject()
            .put("mediaType", "image")
            .put("url", "/uploads/photo.webp")
            .put("optimizedUrl", "/uploads/photo.webp")
            .put("thumbnailUrl", "/uploads/photo-thumb.webp")
            .put("mediumUrl", "/uploads/photo-medium.webp")
            .put("largeUrl", "/uploads/photo-large.webp")
            .put("width", 2_400)
            .put("height", 1_600)
            .put("optimizedWidth", 1_811)
            .put("optimizedHeight", 1_207)
            .put("thumbnailWidth", 418)
            .put("thumbnailHeight", 259)
            .put("mediumWidth", 877)
            .put("mediumHeight", 584)
            .put("largeWidth", 1_333)
            .put("largeHeight", 889);
        store.write(libraryPath, library);

        PublicMediaCatalog catalog = new PublicMediaCatalog(
            store,
            paths,
            new TestContentMediaValidator()
        );
        ObjectNode media = mapper.createObjectNode()
            .put("src", "/fallback.webp")
            .put("desktopSrc", "/uploads/photo.webp")
            .put("mediumUrl", "https://attacker.example/image.webp")
            .put("largeWidth", 999_999);

        catalog.enrich(media);

        assertThat(media.path("width").asInt()).isEqualTo(1_811);
        assertThat(media.path("height").asInt()).isEqualTo(1_207);
        assertThat(media.path("thumbnailUrl").asString()).isEqualTo("/uploads/photo-thumb.webp");
        assertThat(media.path("thumbnailWidth").asInt()).isEqualTo(418);
        assertThat(media.path("thumbnailHeight").asInt()).isEqualTo(259);
        assertThat(media.path("mediumUrl").asString()).isEqualTo("/uploads/photo-medium.webp");
        assertThat(media.path("mediumWidth").asInt()).isEqualTo(877);
        assertThat(media.path("mediumHeight").asInt()).isEqualTo(584);
        assertThat(media.path("largeUrl").asString()).isEqualTo("/uploads/photo-large.webp");
        assertThat(media.path("largeWidth").asInt()).isEqualTo(1_333);
        assertThat(media.path("largeHeight").asInt()).isEqualTo(889);
    }

    @Test
    void removesUntrustedDerivativeFieldsWhenTheSourceIsNotInTheCatalog() {
        Path libraryPath = temporaryDirectory.resolve("empty-media-library.json");
        JsonFileStore store = new JsonFileStore(mapper);
        store.write(libraryPath, mapper.createArrayNode());
        StoragePaths paths = mock(StoragePaths.class);
        when(paths.mediaLibrary()).thenReturn(libraryPath);
        PublicMediaCatalog catalog = new PublicMediaCatalog(
            store,
            paths,
            new TestContentMediaValidator()
        );
        ObjectNode media = mapper.createObjectNode()
            .put("src", "/legacy.webp")
            .put("thumbnailUrl", "https://attacker.example/image.webp")
            .put("optimizedWidth", 12_000)
            .put("width", 12_000);

        catalog.enrich(media);

        assertThat(media.has("thumbnailUrl")).isFalse();
        assertThat(media.has("optimizedWidth")).isFalse();
        assertThat(media.has("width")).isFalse();
        assertThat(media.path("src").asString()).isEqualTo("/legacy.webp");
    }

    @Test
    void omitsLegacyDerivativesWithoutPersistedPhysicalDimensions() {
        Path libraryPath = temporaryDirectory.resolve("legacy-media-library.json");
        JsonFileStore store = new JsonFileStore(mapper);
        StoragePaths paths = mock(StoragePaths.class);
        when(paths.mediaLibrary()).thenReturn(libraryPath);
        ArrayNode library = mapper.createArrayNode();
        library.addObject()
            .put("mediaType", "image")
            .put("url", "/uploads/legacy.webp")
            .put("optimizedUrl", "/uploads/legacy.webp")
            .put("thumbnailUrl", "/uploads/legacy-thumb.webp")
            .put("mediumUrl", "/uploads/legacy-medium.webp")
            .put("largeUrl", "/uploads/legacy-large.webp")
            .put("width", 2_400)
            .put("height", 1_600)
            .put("mediumWidth", 960);
        store.write(libraryPath, library);
        PublicMediaCatalog catalog = new PublicMediaCatalog(
            store,
            paths,
            new TestContentMediaValidator()
        );
        ObjectNode media = mapper.createObjectNode()
            .put("src", "/uploads/legacy.webp")
            .put("width", 2_400)
            .put("height", 1_600)
            .put("thumbnailUrl", "/uploads/legacy-thumb.webp")
            .put("mediumUrl", "/uploads/legacy-medium.webp")
            .put("largeUrl", "/uploads/legacy-large.webp");

        catalog.enrich(media);

        assertThat(media.path("src").asString()).isEqualTo("/uploads/legacy.webp");
        for (String field : new String[] {
            "width", "height", "optimizedWidth", "optimizedHeight",
            "thumbnailUrl", "thumbnailWidth", "thumbnailHeight",
            "mediumUrl", "mediumWidth", "mediumHeight",
            "largeUrl", "largeWidth", "largeHeight"
        }) {
            assertThat(media.has(field)).as(field).isFalse();
        }
    }
}
