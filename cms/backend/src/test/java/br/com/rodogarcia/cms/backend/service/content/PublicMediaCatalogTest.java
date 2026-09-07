package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import javax.imageio.ImageIO;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import br.com.rodogarcia.cms.backend.config.MediaSettings;
import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import br.com.rodogarcia.cms.backend.service.MediaMetadataReader;
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
    void publishesOnlyKnownCatalogDerivativesWithTheirExactDimensions() throws Exception {
        Path libraryPath = temporaryDirectory.resolve("media-library.json");
        JsonFileStore store = new JsonFileStore(mapper);
        StoragePaths paths = paths(libraryPath);
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
        createUploadFixtures(
            "photo.webp", "photo-thumb.webp", "photo-medium.webp", "photo-large.webp"
        );

        PublicMediaCatalog catalog = catalog(
            store, paths, new TestContentMediaValidator(), mock(MediaMetadataReader.class)
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
    void removesUntrustedDerivativeFieldsWhenTheSourceDoesNotExist() {
        Path libraryPath = temporaryDirectory.resolve("empty-media-library.json");
        JsonFileStore store = new JsonFileStore(mapper);
        store.write(libraryPath, mapper.createArrayNode());
        PublicMediaCatalog catalog = catalog(
            store,
            paths(libraryPath),
            new TestContentMediaValidator(),
            mock(MediaMetadataReader.class)
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
    void recoversMissingCatalogAndDerivativeDimensionsFromSafePhysicalFiles() throws Exception {
        Path libraryPath = temporaryDirectory.resolve("legacy-media-library.json");
        JsonFileStore store = new JsonFileStore(mapper);
        StoragePaths paths = paths(libraryPath);
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
        writeImage(upload("legacy.webp"), 1_800, 1_200);
        writeImage(upload("legacy-thumb.webp"), 320, 213);
        writeImage(upload("legacy-medium.webp"), 960, 640);
        writeImage(upload("legacy-large.webp"), 1_440, 960);
        String persistedBefore = Files.readString(libraryPath);

        PublicMediaCatalog catalog = catalog(
            store,
            paths,
            new TestContentMediaValidator(),
            new MediaMetadataReader(MediaSettings.defaults("", ""))
        );
        ObjectNode media = mapper.createObjectNode()
            .put("src", "/uploads/legacy.webp")
            .put("width", 9_999)
            .put("height", 9_999)
            .put("thumbnailUrl", "https://attacker.example/thumb.webp");

        catalog.enrich(media);

        assertThat(media.path("width").asInt()).isEqualTo(1_800);
        assertThat(media.path("height").asInt()).isEqualTo(1_200);
        assertDerivative(media, "thumbnail", "/uploads/legacy-thumb.webp", 320, 213);
        assertDerivative(media, "medium", "/uploads/legacy-medium.webp", 960, 640);
        assertDerivative(media, "large", "/uploads/legacy-large.webp", 1_440, 960);
        assertThat(Files.readString(libraryPath)).isEqualTo(persistedBefore);
    }

    @Test
    void derivesStaticImageDimensionsOncePerResponse() throws Exception {
        Path libraryPath = temporaryDirectory.resolve("empty-media-library.json");
        JsonFileStore store = new JsonFileStore(mapper);
        store.write(libraryPath, mapper.createArrayNode());
        Path image = publicFile("legacy.webp");
        Files.createDirectories(image.getParent());
        Files.writeString(image, "fixture");
        Path realImage = image.toRealPath();
        MediaMetadataReader metadataReader = mock(MediaMetadataReader.class);
        when(metadataReader.image(realImage)).thenReturn(Optional.of(
            new MediaMetadataReader.Dimensions(1_280, 720)
        ));
        PublicMediaCatalog catalog = catalog(
            store, paths(libraryPath), new TestContentMediaValidator(), metadataReader
        );
        ArrayNode response = mapper.createArrayNode();
        response.addObject().put("src", "/legacy.webp").put("width", 99);
        response.addObject().put("src", "/legacy.webp").put("height", 99);

        catalog.enrich(response);

        for (var value : response) {
            ObjectNode media = (ObjectNode) value;
            assertThat(media.path("width").asInt()).isEqualTo(1_280);
            assertThat(media.path("height").asInt()).isEqualTo(720);
        }
        verify(metadataReader, times(1)).image(realImage);
    }

    @Test
    void rejectsExternalTraversalAndEncodedPathsBeforePhysicalInspection() throws Exception {
        Path libraryPath = temporaryDirectory.resolve("media-library.json");
        JsonFileStore store = new JsonFileStore(mapper);
        StoragePaths paths = paths(libraryPath);
        ArrayNode library = mapper.createArrayNode();
        library.addObject()
            .put("mediaType", "image")
            .put("url", "/uploads/photo.webp")
            .put("optimizedUrl", "/uploads/photo.webp")
            .put("optimizedWidth", 1_200)
            .put("optimizedHeight", 800)
            .put("thumbnailUrl", "/uploads/../secret-thumb.webp");
        store.write(libraryPath, library);
        createUploadFixtures("photo.webp");
        writeImage(publicFile("photo.webp"), 640, 480);
        writeImage(publicFile("secret-thumb.webp"), 320, 240);
        MediaMetadataReader metadataReader = mock(MediaMetadataReader.class);
        PublicMediaCatalog catalog = catalog(
            store, paths, new TestContentMediaValidator(), metadataReader
        );

        ObjectNode safe = mapper.createObjectNode().put("src", "/uploads/photo.webp");
        ObjectNode traversal = mapper.createObjectNode()
            .put("src", "/uploads/../photo.webp")
            .put("width", 9_999);
        ObjectNode external = mapper.createObjectNode()
            .put("src", "https://attacker.example/photo.webp")
            .put("width", 9_999);
        ObjectNode encoded = mapper.createObjectNode()
            .put("src", "/%2e%2e/photo.webp")
            .put("width", 9_999);
        ArrayNode response = mapper.createArrayNode().add(safe).add(traversal).add(external).add(encoded);

        catalog.enrich(response);

        assertThat(safe.path("width").asInt()).isEqualTo(1_200);
        assertThat(safe.path("height").asInt()).isEqualTo(800);
        assertThat(safe.has("thumbnailUrl")).isFalse();
        assertThat(traversal.has("width")).isFalse();
        assertThat(external.has("width")).isFalse();
        assertThat(encoded.has("width")).isFalse();
        verify(metadataReader, times(0)).image(publicFile("photo.webp").toRealPath());
    }

    private PublicMediaCatalog catalog(
        JsonFileStore store,
        StoragePaths paths,
        ContentMediaValidator validator,
        MediaMetadataReader metadataReader
    ) {
        CmsProperties properties = mock(CmsProperties.class);
        when(properties.uploadsDir()).thenReturn(temporaryDirectory.resolve("uploads"));
        when(properties.frontendPublicDir()).thenReturn(temporaryDirectory.resolve("public"));
        return new PublicMediaCatalog(store, paths, validator, properties, metadataReader);
    }

    private StoragePaths paths(Path libraryPath) {
        StoragePaths paths = mock(StoragePaths.class);
        when(paths.mediaLibrary()).thenReturn(libraryPath);
        return paths;
    }

    private void createUploadFixtures(String... names) throws Exception {
        Files.createDirectories(temporaryDirectory.resolve("uploads"));
        for (String name : names) Files.writeString(upload(name), "fixture");
    }

    private void writeImage(Path path, int width, int height) throws Exception {
        Files.createDirectories(path.getParent());
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        assertThat(ImageIO.write(image, "png", path.toFile())).isTrue();
    }

    private Path upload(String name) {
        return temporaryDirectory.resolve("uploads").resolve(name);
    }

    private Path publicFile(String name) {
        return temporaryDirectory.resolve("public").resolve(name);
    }

    private static void assertDerivative(
        ObjectNode media,
        String name,
        String url,
        int width,
        int height
    ) {
        assertThat(media.path(name + "Url").asString()).isEqualTo(url);
        assertThat(media.path(name + "Width").asInt()).isEqualTo(width);
        assertThat(media.path(name + "Height").asInt()).isEqualTo(height);
    }
}
