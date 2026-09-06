package br.com.rodogarcia.cms.backend.service;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.TimeUnit;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import br.com.rodogarcia.cms.backend.config.MediaSettings;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import dev.matrixlab.webp4j.WebPCodec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public final class AdminMediaProcessor {
    /*
     * Sharp aceita por padrão 268.402.689 pixels, mas o pipeline Java precisa
     * materializar o raster inteiro (e às vezes uma segunda cópia orientada) no
     * heap. O teto conservador de 20 MP preserva imagens editoriais grandes sem
     * herdar o orçamento de memória do pipeline nativo histórico.
     */
    static final long MAX_IMAGE_PIXELS = 20_000_000L;
    static final int MAX_IMAGE_DIMENSION = 16_383;
    private static final Duration DEFAULT_FFMPEG_TIMEOUT = Duration.ofMinutes(10);
    private static final Duration FFMPEG_TERMINATION_GRACE = Duration.ofSeconds(2);

    private final MediaSettings settings;
    private final Duration ffmpegTimeout;
    private final ProcessLauncher processLauncher;

    @Autowired
    public AdminMediaProcessor(MediaSettings settings) {
        this(settings, DEFAULT_FFMPEG_TIMEOUT, AdminMediaProcessor::startProcess);
    }

    AdminMediaProcessor(
        MediaSettings settings,
        Duration ffmpegTimeout,
        ProcessLauncher processLauncher
    ) {
        if (ffmpegTimeout == null || ffmpegTimeout.isZero() || ffmpegTimeout.isNegative()) {
            throw new IllegalArgumentException("O timeout do FFmpeg deve ser positivo.");
        }
        this.settings = settings;
        this.ffmpegTimeout = ffmpegTimeout;
        this.processLauncher = processLauncher;
    }

    public ProcessedImage image(byte[] source, String mimeType) {
        DecodedImage decoded = decode(source, mimeType);
        BufferedImage oriented = orient(decoded.image(), decoded.orientation());
        try {
            EncodedImage optimized = encodeImage(
                resizeWidth(oriented, settings.webpOptimizedWidth()),
                settings.webpQuality()
            );
            EncodedImage thumbnail = encodeImage(
                resizeCover(oriented, 420, 260),
                settings.webpThumbQuality()
            );
            EncodedImage medium = encodeImage(
                resizeWidth(oriented, settings.webpMediumWidth()),
                settings.webpQuality()
            );
            EncodedImage large = encodeImage(
                resizeWidth(oriented, settings.webpLargeWidth()),
                settings.webpQuality()
            );
            return new ProcessedImage(
                oriented.getWidth(),
                oriented.getHeight(),
                optimized.bytes(),
                thumbnail.bytes(),
                medium.bytes(),
                large.bytes(),
                optimized.width(),
                optimized.height(),
                thumbnail.width(),
                thumbnail.height(),
                medium.width(),
                medium.height(),
                large.width(),
                large.height()
            );
        } catch (IOException | RuntimeException error) {
            if (error instanceof ApiException api) throw api;
            throw new ApiException(422, "Não foi possível processar esta imagem.");
        }
    }

    public void video(Path input, Path output) {
        if (settings.ffmpegPath().isBlank()) {
            throw new ApiException(503, "Conversão de vídeo indisponível nesta plataforma.");
        }
        runFfmpeg(
            List.of(
                "-y", "-max_pixels", String.valueOf(MAX_IMAGE_PIXELS),
                "-i", input.toString(), "-map", "0:v:0", "-map", "0:a?",
                "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1",
                "-deadline", "good", "-c:a", "libopus", "-b:a", "96k", output.toString()
            ),
            "Não foi possível converter este vídeo para WebM.",
            "Conversão de vídeo indisponível. Configure o FFmpeg no servidor."
        );
    }

    private DecodedImage decode(byte[] source, String mimeType) {
        try {
            BufferedImage image;
            int orientation = 1;
            if (mimeType.equals("image/webp")) {
                int[] info = WebPCodec.getWebPInfo(source);
                guardDimensions(info[0], info[1]);
                image = WebPCodec.decodeImage(source);
            } else if (mimeType.equals("image/avif")) {
                image = decodeAvif(source);
            } else {
                image = decodeRaster(source);
                if (mimeType.equals("image/jpeg")) orientation = jpegOrientation(source);
            }
            if (image == null) throw new IOException("Unsupported image");
            guardDimensions(image.getWidth(), image.getHeight());
            return new DecodedImage(image, orientation);
        } catch (ApiException error) {
            throw error;
        } catch (IOException | RuntimeException error) {
            throw new ApiException(422, "Não foi possível processar esta imagem.");
        }
    }

    private BufferedImage decodeAvif(byte[] source) throws IOException {
        if (settings.ffmpegPath().isBlank()) {
            throw new ApiException(503, "Conversão de imagem indisponível nesta plataforma.");
        }
        Path input = Files.createTempFile("cms-media-", ".avif");
        Path output = Files.createTempFile("cms-media-", ".png");
        try {
            Files.write(input, source);
            Files.deleteIfExists(output);
            runFfmpeg(
                List.of(
                    "-y", "-max_pixels", String.valueOf(MAX_IMAGE_PIXELS),
                    "-i", input.toString(), "-frames:v", "1", output.toString()
                ),
                "Não foi possível processar esta imagem.",
                "Conversão de imagem indisponível. Configure o FFmpeg no servidor."
            );
            return decodeRaster(output);
        } finally {
            Files.deleteIfExists(input);
            Files.deleteIfExists(output);
        }
    }

    private static BufferedImage decodeRaster(byte[] source) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(source))) {
            return decodeRaster(input);
        }
    }

    private static BufferedImage decodeRaster(Path source) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(source.toFile())) {
            return decodeRaster(input);
        }
    }

    private static BufferedImage decodeRaster(ImageInputStream input) throws IOException {
        if (input == null) throw new IOException("Unsupported image");
        Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
        if (!readers.hasNext()) throw new IOException("Unsupported image");
        ImageReader reader = readers.next();
        try {
            reader.setInput(input, true, true);
            guardDimensions(reader.getWidth(0), reader.getHeight(0));
            return reader.read(0);
        } finally {
            reader.dispose();
        }
    }

    private void runFfmpeg(
        List<String> arguments,
        String conversionError,
        String unavailableError
    ) {
        String executable = settings.ffmpegPath();
        java.util.ArrayList<String> command = new java.util.ArrayList<>();
        command.add(executable);
        command.addAll(arguments);
        Process process = null;
        try {
            process = processLauncher.start(List.copyOf(command));
            process.getOutputStream().close();
            if (!process.waitFor(ffmpegTimeout.toMillis(), TimeUnit.MILLISECONDS)) {
                terminate(process);
                throw new ApiException(503, unavailableError);
            }
            int status = process.exitValue();
            if (status != 0) throw new ApiException(422, conversionError);
        } catch (InterruptedException error) {
            if (process != null) terminate(process);
            Thread.currentThread().interrupt();
            throw new ApiException(503, unavailableError);
        } catch (IOException error) {
            if (process != null) terminate(process);
            throw new ApiException(503, unavailableError);
        }
    }

    private static Process startProcess(List<String> command) throws IOException {
        return new ProcessBuilder(command)
            .redirectInput(ProcessBuilder.Redirect.PIPE)
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start();
    }

    private static void terminate(Process process) {
        process.destroy();
        try {
            if (!process.waitFor(FFMPEG_TERMINATION_GRACE.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                process.waitFor(FFMPEG_TERMINATION_GRACE.toMillis(), TimeUnit.MILLISECONDS);
            }
        } catch (InterruptedException error) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
        }
    }

    private static byte[] encode(BufferedImage image, int quality) throws IOException {
        if (!WebPCodec.isAvailable()) {
            throw new ApiException(503, "Conversão de imagem indisponível nesta plataforma.");
        }
        return WebPCodec.encodeImage(image, quality);
    }

    private static EncodedImage encodeImage(BufferedImage image, int quality) throws IOException {
        return new EncodedImage(image.getWidth(), image.getHeight(), encode(image, quality));
    }

    private static BufferedImage resizeWidth(BufferedImage source, int targetWidth) {
        if (source.getWidth() <= targetWidth) return source;
        int height = Math.max(1, (int) Math.round(source.getHeight() * (targetWidth / (double) source.getWidth())));
        return resize(source, targetWidth, height);
    }

    static BufferedImage resizeCover(BufferedImage source, int width, int height) {
        double sourceRatio = source.getWidth() / (double) source.getHeight();
        double targetRatio = width / (double) height;
        int sourceX = 0;
        int sourceY = 0;
        int sourceWidth = source.getWidth();
        int sourceHeight = source.getHeight();
        if (sourceRatio > targetRatio) {
            sourceWidth = Math.max(1, Math.min(
                source.getWidth(),
                (int) Math.round(source.getHeight() * targetRatio)
            ));
            sourceX = (source.getWidth() - sourceWidth) / 2;
        } else if (sourceRatio < targetRatio) {
            sourceHeight = Math.max(1, Math.min(
                source.getHeight(),
                (int) Math.round(source.getWidth() / targetRatio)
            ));
            sourceY = (source.getHeight() - sourceHeight) / 2;
        }
        BufferedImage result = canvas(source, width, height);
        Graphics2D graphics = result.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(
                source,
                0, 0, width, height,
                sourceX, sourceY, sourceX + sourceWidth, sourceY + sourceHeight,
                null
            );
        } finally {
            graphics.dispose();
        }
        return result;
    }

    private static BufferedImage resize(BufferedImage source, int width, int height) {
        BufferedImage result = canvas(source, width, height);
        Graphics2D graphics = result.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return result;
    }

    static BufferedImage orient(BufferedImage source, int orientation) {
        if (orientation <= 1 || orientation > 8) return source;
        boolean swap = orientation >= 5;
        int targetWidth = swap ? source.getHeight() : source.getWidth();
        int targetHeight = swap ? source.getWidth() : source.getHeight();
        BufferedImage result = canvas(source, targetWidth, targetHeight);
        for (int y = 0; y < source.getHeight(); y++) {
            for (int x = 0; x < source.getWidth(); x++) {
                int dx;
                int dy;
                switch (orientation) {
                    case 2 -> { dx = source.getWidth() - 1 - x; dy = y; }
                    case 3 -> { dx = source.getWidth() - 1 - x; dy = source.getHeight() - 1 - y; }
                    case 4 -> { dx = x; dy = source.getHeight() - 1 - y; }
                    case 5 -> { dx = y; dy = x; }
                    case 6 -> { dx = source.getHeight() - 1 - y; dy = x; }
                    case 7 -> { dx = source.getHeight() - 1 - y; dy = source.getWidth() - 1 - x; }
                    case 8 -> { dx = y; dy = source.getWidth() - 1 - x; }
                    default -> { dx = x; dy = y; }
                }
                result.setRGB(dx, dy, source.getRGB(x, y));
            }
        }
        return result;
    }

    private static BufferedImage canvas(BufferedImage source, int width, int height) {
        return new BufferedImage(
            width,
            height,
            source.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB
        );
    }

    static void guardDimensions(int width, int height) {
        if (width <= 0 || height <= 0
            || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION
            || (long) width * height > MAX_IMAGE_PIXELS) {
            throw new ApiException(422, "Não foi possível processar esta imagem.");
        }
    }

    @FunctionalInterface
    interface ProcessLauncher {
        Process start(List<String> command) throws IOException;
    }

    private static int jpegOrientation(byte[] bytes) {
        if (bytes.length < 4 || (bytes[0] & 0xff) != 0xff || (bytes[1] & 0xff) != 0xd8) return 1;
        int offset = 2;
        while (offset + 4 <= bytes.length) {
            if ((bytes[offset] & 0xff) != 0xff) break;
            int marker = bytes[offset + 1] & 0xff;
            offset += 2;
            if (marker == 0xda || marker == 0xd9) break;
            if (offset + 2 > bytes.length) break;
            int length = ((bytes[offset] & 0xff) << 8) | (bytes[offset + 1] & 0xff);
            if (length < 2 || offset + length > bytes.length) break;
            if (marker == 0xe1 && length >= 14
                && ascii(bytes, offset + 2, 6).equals("Exif\0\0")) {
                return tiffOrientation(bytes, offset + 8, length - 8);
            }
            offset += length;
        }
        return 1;
    }

    private static int tiffOrientation(byte[] bytes, int start, int length) {
        if (length < 8 || start + length > bytes.length) return 1;
        boolean little = bytes[start] == 'I' && bytes[start + 1] == 'I';
        boolean big = bytes[start] == 'M' && bytes[start + 1] == 'M';
        if (!little && !big) return 1;
        ByteOrder order = little ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN;
        ByteBuffer data = ByteBuffer.wrap(bytes).order(order);
        int ifdOffset = data.getInt(start + 4);
        int ifd = start + ifdOffset;
        if (ifd < start || ifd + 2 > start + length) return 1;
        int entries = data.getShort(ifd) & 0xffff;
        for (int index = 0; index < entries; index++) {
            int entry = ifd + 2 + index * 12;
            if (entry + 12 > start + length) break;
            if ((data.getShort(entry) & 0xffff) == 0x0112) {
                int value = data.getShort(entry + 8) & 0xffff;
                return value >= 1 && value <= 8 ? value : 1;
            }
        }
        return 1;
    }

    private static String ascii(byte[] bytes, int offset, int length) {
        if (offset < 0 || offset + length > bytes.length) return "";
        return new String(bytes, offset, length, java.nio.charset.StandardCharsets.ISO_8859_1);
    }

    private record DecodedImage(BufferedImage image, int orientation) {
    }

    private record EncodedImage(int width, int height, byte[] bytes) {
    }

    public record ProcessedImage(
        int width,
        int height,
        byte[] optimized,
        byte[] thumbnail,
        byte[] medium,
        byte[] large,
        int optimizedWidth,
        int optimizedHeight,
        int thumbnailWidth,
        int thumbnailHeight,
        int mediumWidth,
        int mediumHeight,
        int largeWidth,
        int largeHeight
    ) {
    }
}
