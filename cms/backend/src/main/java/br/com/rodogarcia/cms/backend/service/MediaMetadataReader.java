package br.com.rodogarcia.cms.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import br.com.rodogarcia.cms.backend.config.MediaSettings;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Lê somente os dados técnicos necessários para o CMS. Falhas do utilitário
 * ou de arquivos antigos resultam em metadados ausentes, sem revelar detalhes
 * do host, do caminho do arquivo ou da ferramenta ao navegador.
 */
@Component
public final class MediaMetadataReader {
    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(5);
    private static final int MAX_PROBE_OUTPUT_BYTES = 4_096;
    private static final int MAX_DIMENSION = 32_768;
    private static final double MAX_DURATION_SECONDS = 86_400d;

    private final String ffprobePath;
    private final ProcessLauncher launcher;

    @Autowired
    public MediaMetadataReader(MediaSettings settings) {
        this(settings.ffprobePath(), command -> new ProcessBuilder(command)
            .redirectErrorStream(true)
            .start());
    }

    MediaMetadataReader(String ffprobePath, ProcessLauncher launcher) {
        this.ffprobePath = ffprobePath == null ? "" : ffprobePath.trim();
        this.launcher = launcher;
    }

    public Optional<Dimensions> image(Path candidate) {
        Path file = regularFile(candidate);
        if (file == null) return Optional.empty();

        Optional<Dimensions> imageIo = imageIoDimensions(file);
        return imageIo.isPresent() ? imageIo : probe(file).flatMap(ProbeData::dimensions);
    }

    public Optional<VideoMetadata> video(Path candidate) {
        Path file = regularFile(candidate);
        if (file == null) return Optional.empty();
        return probe(file).flatMap(data -> data.dimensions().flatMap(dimensions -> {
            if (!Double.isFinite(data.durationSeconds())
                || data.durationSeconds() <= 0d
                || data.durationSeconds() > MAX_DURATION_SECONDS) {
                return Optional.empty();
            }
            return Optional.of(new VideoMetadata(
                dimensions.width(), dimensions.height(), data.durationSeconds()
            ));
        }));
    }

    private Optional<Dimensions> imageIoDimensions(Path file) {
        try (ImageInputStream input = ImageIO.createImageInputStream(file.toFile())) {
            if (input == null) return Optional.empty();
            java.util.Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) return Optional.empty();
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                return Dimensions.from(reader.getWidth(0), reader.getHeight(0));
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException ignored) {
            return Optional.empty();
        }
    }

    private Optional<ProbeData> probe(Path file) {
        if (ffprobePath.isBlank()) return Optional.empty();
        Process process = null;
        try {
            process = launcher.start(List.of(
                ffprobePath,
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height:format=duration",
                "-of", "default=noprint_wrappers=1",
                file.toString()
            ));
            process.getOutputStream().close();
            if (!process.waitFor(PROBE_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                return Optional.empty();
            }
            if (process.exitValue() != 0) return Optional.empty();
            String output = boundedOutput(process.getInputStream());
            if (output == null) return Optional.empty();
            return ProbeData.parse(output);
        } catch (IOException | InterruptedException | RuntimeException ignored) {
            if (process != null) process.destroyForcibly();
            if (ignored instanceof InterruptedException) Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }

    private static String boundedOutput(InputStream output) throws IOException {
        try (InputStream input = output) {
            byte[] bytes = input.readNBytes(MAX_PROBE_OUTPUT_BYTES + 1);
            if (bytes.length > MAX_PROBE_OUTPUT_BYTES) return null;
            return new String(bytes, StandardCharsets.UTF_8);
        }
    }

    private static Path regularFile(Path candidate) {
        if (candidate == null) return null;
        try {
            Path file = candidate.toAbsolutePath().normalize();
            return Files.isRegularFile(file) ? file : null;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    record Dimensions(int width, int height) {
        static Optional<Dimensions> from(int width, int height) {
            if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
                return Optional.empty();
            }
            return Optional.of(new Dimensions(width, height));
        }
    }

    public record VideoMetadata(int width, int height, double durationSeconds) {
    }

    @FunctionalInterface
    interface ProcessLauncher {
        Process start(List<String> command) throws IOException;
    }

    private record ProbeData(int width, int height, double durationSeconds) {
        static Optional<ProbeData> parse(String output) {
            Map<String, String> fields = new LinkedHashMap<>();
            for (String line : output.split("\\R")) {
                int separator = line.indexOf('=');
                if (separator <= 0) continue;
                fields.put(line.substring(0, separator), line.substring(separator + 1));
            }
            try {
                int width = Integer.parseInt(fields.getOrDefault("width", ""));
                int height = Integer.parseInt(fields.getOrDefault("height", ""));
                double duration = Double.parseDouble(fields.getOrDefault("duration", ""));
                if (!Double.isFinite(duration)) return Optional.empty();
                return Optional.of(new ProbeData(width, height, duration));
            } catch (NumberFormatException ignored) {
                return Optional.empty();
            }
        }

        Optional<Dimensions> dimensions() {
            return Dimensions.from(width, height);
        }
    }
}
