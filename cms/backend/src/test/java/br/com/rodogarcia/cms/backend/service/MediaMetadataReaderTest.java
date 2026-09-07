package br.com.rodogarcia.cms.backend.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MediaMetadataReaderTest {
    private static final String VP8_WEBP = "UklGRpgAAABXRUJQVlA4IIwAAACwDACdASpBAXsAPm02mUmkIyKhIEgAgA2JaW7hdrEe3AfgAAAoNHrbaLhBkENVSa7bRcIMghqqTXbaLhBkENVSa7bRcIMghqqTXbaLhBkENVSa7bRcIMghqqTXbaLhBkENVSa7bRcIMghqqTXaYAD+/3lH///iGej1Ml3//8KtwxCy4ZYgwIAAAAAAAA==";
    private static final String VP8L_WEBP = "UklGRigAAABXRUJQVlA4TBsAAAAvPgEeAAdQqFKUsf8BBWkbMPUvfzei/8n91zkA";
    private static final String VP8X_WEBP = "UklGRsYAAABXRUJQVlA4WAoAAAAQAAAAPAEAdgAAQUxQSBUAAAABB1DAiAgoSNuAqX/5uxH9T+6/LgEAVlA4IIoAAABQDACdASo9AXcAPm02mUmkIyKhIEgAgA2JaW7hdrEe3AfgAAAoNHrbaLhBkENVSa7bRcIMghqqTXbaLhBkENVSa7bRcIMghqqTXbaLhBkENVSa7bRcIMghqqTXbaLhBkENVSa7bRcIMgheAAD+/3lH///iGej1Ml3//8KtwxCy4ZZhwIAAAAAAAAA=";

    @TempDir
    Path root;

    @Test
    void readsVp8Vp8lAndVp8xImagesWithoutLaunchingFfprobe() throws Exception {
        List<ImageFixture> fixtures = List.of(
            new ImageFixture("lossy.webp", VP8_WEBP, 321, 123),
            new ImageFixture("lossless.webp", VP8L_WEBP, 319, 121),
            new ImageFixture("extended-alpha.webp", VP8X_WEBP, 317, 119)
        );
        AtomicInteger launches = new AtomicInteger();
        MediaMetadataReader reader = new MediaMetadataReader("ffprobe", ignored -> {
            launches.incrementAndGet();
            return new CompletedProcess("width=1\nheight=1\nduration=1\n");
        });

        for (ImageFixture fixture : fixtures) {
            Path image = root.resolve(fixture.name());
            Files.write(image, Base64.getDecoder().decode(fixture.base64()));

            assertThat(reader.image(image)).contains(
                new MediaMetadataReader.Dimensions(fixture.width(), fixture.height())
            );
        }
        assertThat(launches).hasValue(0);
    }

    @Test
    void rejectsTruncatedWebpWithoutFallingBackToFfprobe() throws Exception {
        byte[] complete = Base64.getDecoder().decode(VP8X_WEBP);
        Path image = root.resolve("truncated.webp");
        Files.write(image, Arrays.copyOf(complete, complete.length - 7));
        AtomicInteger launches = new AtomicInteger();
        MediaMetadataReader reader = new MediaMetadataReader("ffprobe", ignored -> {
            launches.incrementAndGet();
            return new CompletedProcess("width=317\nheight=119\nduration=1\n");
        });

        assertThat(reader.image(image)).isEmpty();
        assertThat(launches).hasValue(0);
    }

    @Test
    void rejectsWebpCanvasDimensionsAboveTheApplicationLimit() throws Exception {
        byte[] oversized = Base64.getDecoder().decode(VP8X_WEBP);
        oversized[24] = (byte) 0xff;
        oversized[25] = (byte) 0xff;
        oversized[26] = (byte) 0xff;
        Path image = root.resolve("oversized.webp");
        Files.write(image, oversized);
        AtomicInteger launches = new AtomicInteger();
        MediaMetadataReader reader = new MediaMetadataReader("ffprobe", ignored -> {
            launches.incrementAndGet();
            return new CompletedProcess("width=317\nheight=119\nduration=1\n");
        });

        assertThat(reader.image(image)).isEmpty();
        assertThat(launches).hasValue(0);
    }

    @Test
    void readsOnlyTheExpectedVideoFieldsWithAFixedSafeCommand() throws Exception {
        Path video = root.resolve("interior.webm");
        Files.writeString(video, "fixture");
        AtomicReference<List<String>> command = new AtomicReference<>();
        MediaMetadataReader reader = new MediaMetadataReader("ffprobe", value -> {
            command.set(List.copyOf(value));
            return new CompletedProcess("width=1920\nheight=1080\nduration=12.56\n");
        });

        assertThat(reader.video(video)).contains(
            new MediaMetadataReader.VideoMetadata(1920, 1080, 12.56d)
        );
        assertThat(command.get()).containsExactly(
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height:format=duration",
            "-of", "default=noprint_wrappers=1",
            video.toAbsolutePath().normalize().toString()
        );
    }

    @Test
    void failsClosedWhenTheProbeDoesNotFinishInsideTheLimit() throws Exception {
        Path video = root.resolve("interior.webm");
        Files.writeString(video, "fixture");
        WaitingProcess process = new WaitingProcess();
        MediaMetadataReader reader = new MediaMetadataReader("ffprobe", ignored -> process);

        assertThat(reader.video(video)).isEmpty();
        assertThat(process.destroyed).isTrue();
    }

    private static class CompletedProcess extends Process {
        private final InputStream input;

        CompletedProcess(String output) {
            input = new ByteArrayInputStream(output.getBytes(StandardCharsets.UTF_8));
        }

        @Override
        public OutputStream getOutputStream() {
            return new ByteArrayOutputStream();
        }

        @Override
        public InputStream getInputStream() {
            return input;
        }

        @Override
        public InputStream getErrorStream() {
            return InputStream.nullInputStream();
        }

        @Override
        public int waitFor() {
            return 0;
        }

        @Override
        public boolean waitFor(long timeout, TimeUnit unit) {
            return true;
        }

        @Override
        public int exitValue() {
            return 0;
        }

        @Override
        public void destroy() {
        }
    }

    private static final class WaitingProcess extends CompletedProcess {
        private boolean destroyed;

        WaitingProcess() {
            super("");
        }

        @Override
        public boolean waitFor(long timeout, TimeUnit unit) {
            return false;
        }

        @Override
        public Process destroyForcibly() {
            destroyed = true;
            return this;
        }
    }

    private record ImageFixture(String name, String base64, int width, int height) {
    }
}
