package br.com.rodogarcia.cms.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import javax.imageio.ImageIO;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.support.MediaTestContext;
import dev.matrixlab.webp4j.WebPCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

class MediaServiceTest {
    private static final Clock CLOCK = Clock.fixed(
        Instant.parse("2026-09-03T12:30:00.000Z"), ZoneOffset.UTC
    );

    @TempDir
    Path root;

    @Test
    void convertsPngIntoFourWebpVariantsAndRecordsMetadata() throws Exception {
        MediaTestContext context = new MediaTestContext(root, CLOCK);
        ObjectNode record = context.media.save(
            "Hero Rodogarcia.png", "image/png", png(32, 24), null
        );

        assertThat(record.path("url").asString()).endsWith(".webp");
        assertThat(record.path("thumbnailUrl").asString()).endsWith("-thumb.webp");
        assertThat(record.path("mediumUrl").asString()).endsWith("-medium.webp");
        assertThat(record.path("largeUrl").asString()).endsWith("-large.webp");
        assertThat(record.has("originalUrl")).isFalse();
        assertThat(record.path("width").intValue()).isEqualTo(32);
        assertThat(record.path("height").intValue()).isEqualTo(24);
        assertThat(record.path("aspectRatio").doubleValue()).isEqualTo(1.3333d);
        assertStoredVariant(context, record, "url", "optimized", 32, 24);
        assertStoredVariant(context, record, "thumbnailUrl", "thumbnail", 420, 260);
        assertStoredVariant(context, record, "mediumUrl", "medium", 32, 24);
        assertStoredVariant(context, record, "largeUrl", "large", 32, 24);

        JsonNode library = context.store.readArray(context.properties.storagePaths().mediaLibrary());
        assertThat(library).hasSize(1);
        JsonNode persisted = library.get(0);
        for (String field : List.of(
            "optimizedWidth", "optimizedHeight",
            "thumbnailWidth", "thumbnailHeight",
            "mediumWidth", "mediumHeight",
            "largeWidth", "largeHeight"
        )) {
            assertThat(persisted.path(field).intValue()).isEqualTo(record.path(field).intValue());
        }

        JsonNode listed = context.media.listAdminImages().get(0);
        assertThat(listed.path("url").asString()).isEqualTo(record.path("url").asString());
        assertThat(listed.path("optimizedWidth").intValue()).isEqualTo(32);
        assertThat(listed.path("thumbnailWidth").intValue()).isEqualTo(420);
        assertThat(listed.path("mediumWidth").intValue()).isEqualTo(32);
        assertThat(listed.path("largeWidth").intValue()).isEqualTo(32);
    }

    @Test
    void readsTechnicalMetadataForVersionedImagesNotYetInTheLibrary() throws Exception {
        MediaTestContext context = new MediaTestContext(root, CLOCK);
        Files.createDirectories(context.properties.frontendPublicDir());
        Files.write(context.properties.frontendPublicDir().resolve("operacao.png"), png(80, 45));

        JsonNode record = null;
        for (JsonNode item : context.media.listAdminImages()) {
            if (item.path("url").asString().equals("/operacao.png")) {
                record = item;
                break;
            }
        }

        assertThat(record).isNotNull();
        assertThat(record.path("width").intValue()).isEqualTo(80);
        assertThat(record.path("height").intValue()).isEqualTo(45);
        assertThat(record.path("aspectRatio").doubleValue()).isEqualTo(1.7778d);
    }

    @Test
    void rejectsMimeSpoofingBeforeWritingAnything() {
        MediaTestContext context = new MediaTestContext(root, CLOCK);
        assertThatThrownBy(() -> context.media.save(
            "fake.png", "image/png", "not a png".getBytes(StandardCharsets.UTF_8), null
        )).isInstanceOf(ApiException.class).hasMessageContaining("não corresponde");
        assertThat(context.properties.uploadsDir()).doesNotExist();
    }

    @Test
    void preservesImageAlphaInTheGeneratedWebp() throws Exception {
        BufferedImage source = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = source.createGraphics();
        graphics.setColor(new Color(20, 80, 160, 255));
        graphics.fillRect(4, 4, 8, 8);
        graphics.dispose();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(source, "png", output);
        MediaTestContext context = new MediaTestContext(root, CLOCK);

        ObjectNode record = context.media.save(
            "transparente.png", "image/png", output.toByteArray(), null
        );
        BufferedImage decoded = WebPCodec.decodeImage(
            Files.readAllBytes(uploadPath(context, record.path("url").asString()))
        );

        assertThat(decoded.getColorModel().hasAlpha()).isTrue();
        assertThat(decoded.getRGB(0, 0) >>> 24).isZero();
        assertThat(decoded.getRGB(8, 8) >>> 24).isEqualTo(255);
    }

    @Test
    void acceptsApplicationOggAndPersistsOnlyTheConvertedWebm() throws Exception {
        AdminMediaProcessor processor = mock(AdminMediaProcessor.class);
        doAnswer(invocation -> {
            Path output = invocation.getArgument(1, Path.class);
            Files.write(output, "converted-webm".getBytes(StandardCharsets.US_ASCII));
            return null;
        }).when(processor).video(any(Path.class), any(Path.class));
        MediaTestContext context = new MediaTestContext(root, CLOCK, processor);

        ObjectNode record = context.media.save(
            "evidência.ogg",
            "application/ogg",
            "OggSvalid-audio-video".getBytes(StandardCharsets.US_ASCII),
            null
        );

        assertThat(record.path("mediaType").asString()).isEqualTo("video");
        assertThat(record.path("format").asString()).isEqualTo("webm");
        assertThat(record.path("originalFormat").asString()).isEqualTo("application/ogg");
        assertThat(record.path("url").asString()).endsWith(".webm");
        assertThat(Files.readString(uploadPath(context, record.path("url").asString())))
            .isEqualTo("converted-webm");
        try (var files = Files.list(context.properties.uploadsDir())) {
            assertThat(files.map(path -> path.getFileName().toString()).toList())
                .allMatch(name -> name.endsWith(".webm"));
        }
        verify(processor).video(any(Path.class), any(Path.class));
    }

    @Test
    void updatesOnlyEditableImageSlotsAndCanClearThem() throws Exception {
        MediaTestContext context = new MediaTestContext(root, CLOCK);
        Files.createDirectories(context.properties.frontendPublicDir());
        Files.writeString(context.properties.frontendPublicDir().resolve("certificate.png"), "image");
        Files.writeString(context.properties.frontendPublicDir().resolve("certificate.mp4"), "video");
        ObjectNode body = context.mapper.createObjectNode().put("home.cert.iso", "/certificate.png");
        assertThat(context.media.updateMediaSlots(body, null).path("home.cert.iso").asString())
            .isEqualTo("/certificate.png");

        assertThatThrownBy(() -> context.media.updateMediaSlots(
            context.mapper.createObjectNode().put("unknown.slot", "/certificate.png"), null
        )).isInstanceOf(ApiException.class).hasMessageContaining("não editável");
        assertThatThrownBy(() -> context.media.updateMediaSlots(
            context.mapper.createObjectNode().put("home.cert.sassmaq", "/certificate.mp4"), null
        )).isInstanceOf(ApiException.class).hasMessageContaining("tipo de arquivo");

        ObjectNode cleared = context.media.updateMediaSlots(
            context.mapper.createObjectNode().put("home.cert.iso", ""), null
        );
        assertThat(cleared.isEmpty()).isTrue();
    }

    @Test
    void replacesReferencesWithJournalAndDeletesAllVariantsAfterConfirmation() throws Exception {
        MediaTestContext context = new MediaTestContext(root, CLOCK);
        Files.createDirectories(context.properties.frontendPublicDir());
        Files.writeString(context.properties.frontendPublicDir().resolve("from.png"), "from");
        Files.writeString(context.properties.frontendPublicDir().resolve("to.png"), "to");
        context.store.write(
            context.properties.storagePaths().siteTexts(),
            context.mapper.createObjectNode().put("asset", "/from.png")
        );
        context.store.write(
            context.properties.storagePaths().mediaSlots(),
            context.mapper.createObjectNode().put("home.cert.iso", "/from.png")
        );
        context.store.write(
            context.properties.storagePaths().popupConfig(),
            context.mapper.createObjectNode().put("image", "/from.png")
        );
        context.store.write(
            context.properties.storagePaths().seoSettings(),
            context.mapper.createObjectNode().put("image", "/from.png")
        );

        context.media.replaceReferences("/from.png", "/to.png", null);

        assertThat(context.store.readObject(context.properties.storagePaths().siteTexts()).path("asset").asString())
            .isEqualTo("/to.png");
        assertThat(context.store.readObject(context.properties.storagePaths().mediaSlots()).path("home.cert.iso").asString())
            .isEqualTo("/to.png");
        assertThat(context.properties.storagePaths().mediaReplaceTransaction()).doesNotExist();

        ObjectNode uploaded = context.media.save("em-uso.png", "image/png", png(32, 24), null);
        context.store.write(
            context.properties.storagePaths().mediaSlots(),
            context.mapper.createObjectNode().put("home.cert.iso", uploaded.path("url").asString())
        );
        assertThatThrownBy(() -> context.media.delete(uploaded.path("url").asString(), false, null))
            .isInstanceOf(ApiException.class).hasMessageContaining("Confirme a exclusão");

        ObjectNode deleted = context.media.delete(uploaded.path("url").asString(), true, null);
        assertThat(deleted.path("referenceCount").intValue()).isEqualTo(1);
        for (String field : List.of("url", "thumbnailUrl", "mediumUrl", "largeUrl")) {
            assertThat(uploadPath(context, uploaded.path(field).asString())).doesNotExist();
        }
        assertThat(context.store.readObject(context.properties.storagePaths().mediaSlots())
            .path("home.cert.iso").asString()).isEmpty();
    }

    private static Path uploadPath(MediaTestContext context, String url) {
        return context.properties.uploadsDir().resolve(url.substring("/uploads/".length()));
    }

    private static void assertStoredVariant(
        MediaTestContext context,
        ObjectNode record,
        String urlField,
        String dimensionPrefix,
        int expectedWidth,
        int expectedHeight
    ) throws Exception {
        byte[] webp = Files.readAllBytes(uploadPath(context, record.path(urlField).asString()));
        assertThat(new String(webp, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("RIFF");
        assertThat(new String(webp, 8, 4, StandardCharsets.US_ASCII)).isEqualTo("WEBP");
        BufferedImage decoded = WebPCodec.decodeImage(webp);
        assertThat(decoded).isNotNull();
        assertThat(record.path(dimensionPrefix + "Width").intValue())
            .isEqualTo(expectedWidth)
            .isEqualTo(decoded.getWidth());
        assertThat(record.path(dimensionPrefix + "Height").intValue())
            .isEqualTo(expectedHeight)
            .isEqualTo(decoded.getHeight());
    }

    private static byte[] png(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(20, 80, 160));
        graphics.fillRect(0, 0, width, height);
        graphics.dispose();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }
}
