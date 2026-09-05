package br.com.rodogarcia.cms.backend.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MediaMetadataReaderTest {

    @TempDir
    Path root;

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
}
