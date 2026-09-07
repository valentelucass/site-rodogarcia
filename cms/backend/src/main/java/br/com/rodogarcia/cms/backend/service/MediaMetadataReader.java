package br.com.rodogarcia.cms.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.channels.SeekableByteChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
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

        WebpResult webp = webpDimensions(file);
        if (webp.recognized()) return webp.dimensions();
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

    /**
     * WebP usa um contêiner RIFF pequeno, cujas dimensões ficam nos cabeçalhos
     * VP8, VP8L ou VP8X. A leitura direta evita depender de um processo externo
     * para imagens e valida todos os limites de chunks antes de confiar no valor.
     */
    private WebpResult webpDimensions(Path file) {
        boolean recognized = false;
        try (SeekableByteChannel channel = Files.newByteChannel(file, StandardOpenOption.READ)) {
            long fileSize = channel.size();
            if (fileSize < 12) return WebpResult.NOT_WEBP;
            byte[] riff = readExact(channel, 0, 12);
            if (riff == null || !fourCc(riff, 0, "RIFF") || !fourCc(riff, 8, "WEBP")) {
                return WebpResult.NOT_WEBP;
            }
            recognized = true;
            long declaredSize = unsignedLittleEndian32(riff, 4) + 8L;
            if (declaredSize != fileSize) return WebpResult.INVALID;

            Optional<Dimensions> canvas = Optional.empty();
            Optional<Dimensions> bitstream = Optional.empty();
            long offset = 12L;
            while (offset < declaredSize) {
                if (declaredSize - offset < 8L) return WebpResult.INVALID;
                byte[] chunkHeader = readExact(channel, offset, 8);
                if (chunkHeader == null) return WebpResult.INVALID;
                long chunkSize = unsignedLittleEndian32(chunkHeader, 4);
                long dataOffset = offset + 8L;
                long paddedSize = chunkSize + (chunkSize & 1L);
                if (paddedSize > declaredSize - dataOffset) return WebpResult.INVALID;

                if (fourCc(chunkHeader, 0, "VP8X")) {
                    Optional<Dimensions> current = vp8xDimensions(channel, dataOffset, chunkSize);
                    if (current.isEmpty() || canvas.isPresent()) return WebpResult.INVALID;
                    canvas = current;
                } else if (fourCc(chunkHeader, 0, "VP8L")) {
                    Optional<Dimensions> current = vp8lDimensions(channel, dataOffset, chunkSize);
                    if (current.isEmpty() || bitstream.isPresent()) return WebpResult.INVALID;
                    bitstream = current;
                } else if (fourCc(chunkHeader, 0, "VP8 ")) {
                    Optional<Dimensions> current = vp8Dimensions(channel, dataOffset, chunkSize);
                    if (current.isEmpty() || bitstream.isPresent()) return WebpResult.INVALID;
                    bitstream = current;
                }
                offset = dataOffset + paddedSize;
            }

            if (bitstream.isEmpty()) return WebpResult.INVALID;
            if (canvas.isPresent() && !canvas.get().equals(bitstream.get())) {
                return WebpResult.INVALID;
            }
            return new WebpResult(true, canvas.isPresent() ? canvas : bitstream);
        } catch (IOException | RuntimeException ignored) {
            return recognized ? WebpResult.INVALID : WebpResult.NOT_WEBP;
        }
    }

    private Optional<Dimensions> vp8Dimensions(
        SeekableByteChannel channel,
        long offset,
        long chunkSize
    ) throws IOException {
        if (chunkSize < 10L) return Optional.empty();
        byte[] header = readExact(channel, offset, 10);
        if (header == null
            || (header[0] & 1) != 0
            || (header[3] & 0xff) != 0x9d
            || (header[4] & 0xff) != 0x01
            || (header[5] & 0xff) != 0x2a) {
            return Optional.empty();
        }
        int width = unsignedLittleEndian16(header, 6) & 0x3fff;
        int height = unsignedLittleEndian16(header, 8) & 0x3fff;
        return Dimensions.from(width, height);
    }

    private Optional<Dimensions> vp8lDimensions(
        SeekableByteChannel channel,
        long offset,
        long chunkSize
    ) throws IOException {
        if (chunkSize < 5L) return Optional.empty();
        byte[] header = readExact(channel, offset, 5);
        if (header == null || (header[0] & 0xff) != 0x2f) return Optional.empty();
        int width = 1 + (header[1] & 0xff) + ((header[2] & 0x3f) << 8);
        int height = 1
            + ((header[2] & 0xc0) >> 6)
            + ((header[3] & 0xff) << 2)
            + ((header[4] & 0x0f) << 10);
        return Dimensions.from(width, height);
    }

    private Optional<Dimensions> vp8xDimensions(
        SeekableByteChannel channel,
        long offset,
        long chunkSize
    ) throws IOException {
        if (chunkSize != 10L) return Optional.empty();
        byte[] header = readExact(channel, offset, 10);
        if (header == null
            || (header[0] & 0xc1) != 0
            || header[1] != 0
            || header[2] != 0
            || header[3] != 0) {
            return Optional.empty();
        }
        int width = 1 + unsignedLittleEndian24(header, 4);
        int height = 1 + unsignedLittleEndian24(header, 7);
        return Dimensions.from(width, height);
    }

    private static byte[] readExact(
        SeekableByteChannel channel,
        long offset,
        int length
    ) throws IOException {
        ByteBuffer buffer = ByteBuffer.allocate(length);
        channel.position(offset);
        while (buffer.hasRemaining()) {
            int read = channel.read(buffer);
            if (read <= 0) return null;
        }
        return buffer.array();
    }

    private static boolean fourCc(byte[] value, int offset, String expected) {
        if (value.length - offset < 4 || expected.length() != 4) return false;
        for (int index = 0; index < 4; index++) {
            if ((value[offset + index] & 0xff) != expected.charAt(index)) return false;
        }
        return true;
    }

    private static int unsignedLittleEndian16(byte[] value, int offset) {
        return (value[offset] & 0xff) | ((value[offset + 1] & 0xff) << 8);
    }

    private static int unsignedLittleEndian24(byte[] value, int offset) {
        return unsignedLittleEndian16(value, offset) | ((value[offset + 2] & 0xff) << 16);
    }

    private static long unsignedLittleEndian32(byte[] value, int offset) {
        return Integer.toUnsignedLong(
            unsignedLittleEndian16(value, offset)
                | (unsignedLittleEndian16(value, offset + 2) << 16)
        );
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

    public record Dimensions(int width, int height) {
        static Optional<Dimensions> from(int width, int height) {
            if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
                return Optional.empty();
            }
            return Optional.of(new Dimensions(width, height));
        }
    }

    public record VideoMetadata(int width, int height, double durationSeconds) {
    }

    private record WebpResult(boolean recognized, Optional<Dimensions> dimensions) {
        private static final WebpResult NOT_WEBP = new WebpResult(false, Optional.empty());
        private static final WebpResult INVALID = new WebpResult(true, Optional.empty());
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
