package br.com.rodogarcia.cms.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import javax.imageio.ImageIO;

import br.com.rodogarcia.cms.backend.config.MediaSettings;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import dev.matrixlab.webp4j.WebPCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AdminMediaProcessorTest {
    @TempDir
    Path root;

    @Test
    void failsClosedWhenVideoConversionIsNotConfigured() {
        AdminMediaProcessor processor = new AdminMediaProcessor(MediaSettings.defaults(""));

        assertThatThrownBy(() -> processor.video(root.resolve("input.mp4"), root.resolve("output.webm")))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).status()).isEqualTo(503))
            .hasMessage("Conversão de vídeo indisponível nesta plataforma.");
    }

    @Test
    void failsClosedWithoutMisreportingAvifAsVideo() {
        AdminMediaProcessor processor = new AdminMediaProcessor(MediaSettings.defaults(""));
        byte[] avifHeader = "0000ftypavif".getBytes(StandardCharsets.US_ASCII);

        assertThatThrownBy(() -> processor.image(avifHeader, "image/avif"))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).status()).isEqualTo(503))
            .hasMessage("Conversão de imagem indisponível nesta plataforma.");
    }

    @Test
    void rejectsDeclaredPixelBombBeforeRasterAllocation() {
        AdminMediaProcessor processor = new AdminMediaProcessor(MediaSettings.defaults(""));
        byte[] header = new byte[33];
        ByteBuffer data = ByteBuffer.wrap(header);
        data.put(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a});
        data.putInt(13);
        data.put("IHDR".getBytes(StandardCharsets.US_ASCII));
        data.putInt(20_000);
        data.putInt(20_000);
        data.put(new byte[] {8, 6, 0, 0, 0});

        assertThatThrownBy(() -> processor.image(header, "image/png"))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).status()).isEqualTo(422))
            .hasMessage("Não foi possível processar esta imagem.");
    }

    @Test
    void enforcesTheHeapBudgetAndWebpDimensionBeforeDecoding() {
        assertThatCode(() -> AdminMediaProcessor.guardDimensions(5_000, 4_000))
            .doesNotThrowAnyException();

        assertThatThrownBy(() -> AdminMediaProcessor.guardDimensions(5_001, 4_000))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).status()).isEqualTo(422));
        assertThatThrownBy(() -> AdminMediaProcessor.guardDimensions(16_384, 1))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).status()).isEqualTo(422));
    }

    @Test
    void coverCropsExtremeAspectRatiosDirectlyIntoTheBoundedCanvas() {
        BufferedImage portrait = new BufferedImage(1, 16_383, BufferedImage.TYPE_INT_RGB);
        portrait.setRGB(0, 8_191, 0xff336699);

        BufferedImage result = AdminMediaProcessor.resizeCover(portrait, 420, 260);

        assertThat(result.getWidth()).isEqualTo(420);
        assertThat(result.getHeight()).isEqualTo(260);
        assertThat((long) result.getWidth() * result.getHeight()).isEqualTo(109_200L);
        assertThat(result.getRGB(210, 130)).isEqualTo(0xff336699);
    }

    @Test
    void forciblyTerminatesFfmpegAfterTheBoundedTimeout() {
        TimedOutProcess process = new TimedOutProcess();
        AtomicReference<List<String>> command = new AtomicReference<>();
        AdminMediaProcessor processor = new AdminMediaProcessor(
            MediaSettings.defaults("ffmpeg"),
            Duration.ofMillis(1),
            value -> {
                command.set(value);
                return process;
            }
        );

        assertThatThrownBy(() -> processor.video(
            root.resolve("input.mp4"), root.resolve("output.webm")))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).status()).isEqualTo(503))
            .hasMessage("Conversão de vídeo indisponível. Configure o FFmpeg no servidor.");
        assertThat(process.destroyed).isTrue();
        assertThat(process.forciblyDestroyed).isTrue();
        assertThat(process.timedWaits).isEqualTo(3);
        assertThat(command.get()).containsSubsequence(
            "-max_pixels", String.valueOf(AdminMediaProcessor.MAX_IMAGE_PIXELS), "-i"
        );
    }

    @Test
    void processesTheValidPngFixtureUsedBySecurityHardening() {
        AdminMediaProcessor processor = new AdminMediaProcessor(MediaSettings.defaults(""));
        byte[] fixture = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1Jr"
                + "AAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
        );

        AdminMediaProcessor.ProcessedImage result = processor.image(fixture, "image/png");

        assertThat(result.width()).isEqualTo(1);
        assertThat(result.height()).isEqualTo(1);
        for (byte[] webp : List.of(
            result.optimized(), result.thumbnail(), result.medium(), result.large()
        )) {
            assertThat(new String(webp, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("RIFF");
            assertThat(new String(webp, 8, 4, StandardCharsets.US_ASCII)).isEqualTo("WEBP");
        }
    }

    @Test
    void recordsPostExifAndPhysicalVariantDimensions() throws Exception {
        BufferedImage source = new BufferedImage(1_200, 2_000, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
        assertThat(ImageIO.write(source, "jpeg", jpeg)).isTrue();
        AdminMediaProcessor processor = new AdminMediaProcessor(MediaSettings.defaults(""));

        AdminMediaProcessor.ProcessedImage result = processor.image(
            withExifOrientation(jpeg.toByteArray(), 6),
            "image/jpeg"
        );

        assertThat(result.width()).isEqualTo(2_000);
        assertThat(result.height()).isEqualTo(1_200);
        assertPhysicalDimensions(
            result.optimized(), result.optimizedWidth(), result.optimizedHeight(), 1_920, 1_152
        );
        assertPhysicalDimensions(
            result.thumbnail(), result.thumbnailWidth(), result.thumbnailHeight(), 420, 260
        );
        assertPhysicalDimensions(
            result.medium(), result.mediumWidth(), result.mediumHeight(), 960, 576
        );
        assertPhysicalDimensions(
            result.large(), result.largeWidth(), result.largeHeight(), 1_440, 864
        );
    }

    @Test
    void appliesExifTransposeAndRotationsFiveThroughEight() {
        BufferedImage source = new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < source.getHeight(); y++) {
            for (int x = 0; x < source.getWidth(); x++) {
                source.setRGB(x, y, 0xff000000 | ((y * source.getWidth() + x + 1) * 0x010101));
            }
        }

        assertOrientation(source, 5, (x, y) -> new Point(y, x));
        assertOrientation(source, 6, (x, y) -> new Point(source.getHeight() - 1 - y, x));
        assertOrientation(source, 7, (x, y) -> new Point(
            source.getHeight() - 1 - y,
            source.getWidth() - 1 - x
        ));
        assertOrientation(source, 8, (x, y) -> new Point(y, source.getWidth() - 1 - x));
    }

    private static void assertOrientation(
        BufferedImage source,
        int orientation,
        java.util.function.BiFunction<Integer, Integer, Point> destination
    ) {
        BufferedImage result = AdminMediaProcessor.orient(source, orientation);
        assertThat(result.getWidth()).isEqualTo(source.getHeight());
        assertThat(result.getHeight()).isEqualTo(source.getWidth());
        for (int y = 0; y < source.getHeight(); y++) {
            for (int x = 0; x < source.getWidth(); x++) {
                Point point = destination.apply(x, y);
                assertThat(result.getRGB(point.x(), point.y())).isEqualTo(source.getRGB(x, y));
            }
        }
    }

    private static void assertPhysicalDimensions(
        byte[] encoded,
        int recordedWidth,
        int recordedHeight,
        int expectedWidth,
        int expectedHeight
    ) throws java.io.IOException {
        BufferedImage decoded = WebPCodec.decodeImage(encoded);
        assertThat(decoded).isNotNull();
        assertThat(recordedWidth).isEqualTo(expectedWidth).isEqualTo(decoded.getWidth());
        assertThat(recordedHeight).isEqualTo(expectedHeight).isEqualTo(decoded.getHeight());
    }

    private static byte[] withExifOrientation(byte[] jpeg, int orientation) {
        assertThat(jpeg).startsWith((byte) 0xff, (byte) 0xd8);
        byte[] exifSegment = {
            (byte) 0xff, (byte) 0xe1, 0, 34,
            'E', 'x', 'i', 'f', 0, 0,
            'I', 'I', 42, 0, 8, 0, 0, 0,
            1, 0,
            0x12, 0x01, 3, 0, 1, 0, 0, 0, (byte) orientation, 0, 0, 0,
            0, 0, 0, 0
        };
        ByteArrayOutputStream result = new ByteArrayOutputStream(jpeg.length + exifSegment.length);
        result.write(jpeg, 0, 2);
        result.writeBytes(exifSegment);
        result.write(jpeg, 2, jpeg.length - 2);
        return result.toByteArray();
    }

    private record Point(int x, int y) {
    }

    private static final class TimedOutProcess extends Process {
        private final ByteArrayOutputStream input = new ByteArrayOutputStream();
        private boolean destroyed;
        private boolean forciblyDestroyed;
        private int timedWaits;

        @Override
        public OutputStream getOutputStream() {
            return input;
        }

        @Override
        public InputStream getInputStream() {
            return new ByteArrayInputStream(new byte[0]);
        }

        @Override
        public InputStream getErrorStream() {
            return new ByteArrayInputStream(new byte[0]);
        }

        @Override
        public int waitFor() {
            return 0;
        }

        @Override
        public boolean waitFor(long timeout, TimeUnit unit) {
            timedWaits++;
            return forciblyDestroyed;
        }

        @Override
        public int exitValue() {
            if (!forciblyDestroyed) throw new IllegalThreadStateException();
            return 0;
        }

        @Override
        public void destroy() {
            destroyed = true;
        }

        @Override
        public Process destroyForcibly() {
            forciblyDestroyed = true;
            return this;
        }

        @Override
        public boolean isAlive() {
            return !forciblyDestroyed;
        }
    }
}
