package br.com.rodogarcia.landingbuilder.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import br.com.rodogarcia.landingbuilder.config.LandingBuilderProperties;
import br.com.rodogarcia.landingbuilder.exception.ApiException;
import br.com.rodogarcia.landingbuilder.repository.LandingMediaRepository;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import dev.matrixlab.webp4j.WebPCodec;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public final class LandingMediaService {

    public static final String URL_PREFIX = "/landing-media/";
    private static final int MAX_IMAGE_BYTES = 20 * 1024 * 1024;
    private static final int MAX_VIDEO_BYTES = 70 * 1024 * 1024;
    private static final long MAX_IMAGE_PIXELS = 40_000_000L;
    private static final Pattern ID = Pattern.compile("^media_[A-Za-z0-9-]{36}$");
    private static final Set<String> MP4_BRANDS = Set.of(
        "isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V ", "MSNV", "qt  "
    );

    private final ObjectMapper mapper;
    private final LandingMediaRepository repository;
    private final CampaignService campaignService;
    private final String ffmpegPath;
    private final String ffprobePath;

    public LandingMediaService(
        ObjectMapper mapper,
        LandingMediaRepository repository,
        CampaignService campaignService,
        LandingBuilderProperties properties
    ) {
        this.mapper = mapper;
        this.repository = repository;
        this.campaignService = campaignService;
        ffmpegPath = properties.ffmpegPath();
        ffprobePath = properties.ffprobePath();
    }

    public synchronized ArrayNode list() {
        List<ObjectNode> records = objectNodes(repository.readMedia());
        records.sort(Comparator.comparing(LandingMediaService::createdAt).reversed());
        ArrayNode result = mapper.createArrayNode();
        records.forEach(record -> result.add(toDto(record)));
        return result;
    }

    public synchronized ObjectNode save(MultipartFile file, String alt) {
        if (file == null || file.isEmpty()) throw new ApiException("Envie um arquivo no campo file.", 422);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ignored) {
            throw new ApiException("Arquivo de mídia inválido.", 422);
        }
        if (bytes.length == 0 || bytes.length != file.getSize()) throw new ApiException("Arquivo de mídia inválido.", 422);

        String imageMime = detectImageMime(bytes);
        String videoMime = imageMime == null ? detectVideoMime(bytes) : null;
        if (imageMime == null && videoMime == null) {
            throw unsupportedMedia();
        }
        if (imageMime != null) {
            if (bytes.length > MAX_IMAGE_BYTES) throw new ApiException("Imagem excede o limite de 20 MB.", 422);
            return saveImage(bytes, imageMime, normalizeAlt(alt));
        }
        if (bytes.length > MAX_VIDEO_BYTES) throw new ApiException("Vídeo excede o limite de 70 MB.", 422);
        return saveVideo(bytes, videoMime, normalizeAlt(alt));
    }

    public synchronized ObjectNode updateMetadata(String rawId, JsonNode input) {
        String id = safeId(rawId);
        if (id == null || !(input instanceof ObjectNode body) || body.size() == 0 || body.size() > 2
            || body.properties().stream().anyMatch(entry -> !Set.of("alt", "poster").contains(entry.getKey()))) {
            throw new ApiException("Metadados de mídia inválidos.", 422);
        }
        ArrayNode media = repository.readMedia();
        int index = find(media, id);
        if (index < 0) throw new ApiException("Mídia não encontrada.", 404);
        ObjectNode updated = ((ObjectNode) media.get(index)).deepCopy();
        if (body.has("alt")) {
            if (!body.path("alt").isTextual()) throw new ApiException("Metadados de mídia inválidos.", 422);
            updated.put("alt", normalizeAlt(body.path("alt").asText()));
        }
        if (body.has("poster")) {
            if (!body.path("poster").isNull() && !body.path("poster").isTextual()) {
                throw new ApiException("Metadados de mídia inválidos.", 422);
            }
            if (!"video".equals(updated.path("kind").asText())) {
                throw new ApiException("Poster é permitido apenas para vídeos.", 422);
            }
            String poster = body.path("poster").isNull() ? "" : body.path("poster").asText();
            if (!poster.isBlank()) {
                ObjectNode posterRecord = recordForUrl(media, poster);
                if (posterRecord == null || !"image".equals(posterRecord.path("kind").asText())) {
                    throw new ApiException("O poster precisa ser uma imagem da biblioteca da campanha.", 422);
                }
            }
            updated.put("poster", poster);
        }
        media.set(index, updated);
        repository.writeMedia(media);
        return toDto(updated);
    }

    public synchronized void delete(String rawId) {
        String id = safeId(rawId);
        if (id == null) throw new ApiException("Mídia não encontrada.", 404);
        ArrayNode media = repository.readMedia();
        int index = find(media, id);
        if (index < 0) throw new ApiException("Mídia não encontrada.", 404);
        ObjectNode record = (ObjectNode) media.get(index);
        if (campaignService.isMediaReferenced(record.path("url").asText())) {
            throw new ApiException("Esta mídia ainda está em uso por uma landing page.", 409);
        }
        Path path = filePath(record);
        if (path == null) throw new ApiException("Registro de mídia inválido.", 422);
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            throw new ApiException("Não foi possível processar a solicitação.", 500);
        }
        media.remove(index);
        repository.writeMedia(media);
    }

    public synchronized ResolvedMedia resolve(String rawId) {
        String id = safeId(rawId);
        if (id == null) return null;
        for (ObjectNode record : objectNodes(repository.readMedia())) {
            if (!id.equals(record.path("id").asText())) continue;
            Path file = filePath(record);
            if (file != null && Files.isRegularFile(file)) return new ResolvedMedia(toDto(record), file);
        }
        return null;
    }

    public synchronized boolean existsUrl(String rawUrl) {
        if (rawUrl == null || !rawUrl.startsWith(URL_PREFIX)) return false;
        String id = safeId(rawUrl.substring(URL_PREFIX.length()));
        if (id == null || !rawUrl.equals(URL_PREFIX + id)) return false;
        return objectNodes(repository.readMedia()).stream().anyMatch(item -> rawUrl.equals(item.path("url").asText()));
    }

    private ObjectNode saveImage(byte[] bytes, String mimeType, String alt) {
        DecodedImage image = decodeImage(bytes, mimeType);
        BufferedImage resized = resizeInside(orient(image.image(), image.orientation()), 2_400);
        if (!WebPCodec.isAvailable()) {
            throw new ApiException("Conversão de imagem indisponível nesta plataforma.", 503);
        }
        byte[] webp;
        try {
            webp = WebPCodec.encodeImage(resized, 82);
        } catch (IOException | RuntimeException error) {
            throw new ApiException("Não foi possível validar ou otimizar a imagem enviada.", 422);
        }
        String id = "media_" + UUID.randomUUID();
        String storageName = id + ".webp";
        writeMediaFile(storageName, webp, "Não foi possível validar ou otimizar a imagem enviada.", 422);
        ObjectNode record = record(id, "image", "image/webp", webp.length, storageName, alt);
        record.put("width", resized.getWidth());
        record.put("height", resized.getHeight());
        prepend(record);
        return toDto(record);
    }

    private ObjectNode saveVideo(byte[] bytes, String mimeType, String alt) {
        String extension = switch (mimeType) {
            case "video/mp4" -> "mp4";
            case "video/webm" -> "webm";
            case "video/ogg" -> "ogg";
            default -> throw unsupportedMedia();
        };
        String id = "media_" + UUID.randomUUID();
        String storageName = id + "." + extension;
        writeMediaFile(storageName, bytes, "Não foi possível salvar o vídeo enviado.", 422);
        ObjectNode record = record(id, "video", mimeType, bytes.length, storageName, alt);
        VideoMetadata metadata = readVideoMetadata(filePath(record));
        if (metadata != null) {
            if (metadata.width() > 0) record.put("width", metadata.width());
            if (metadata.height() > 0) record.put("height", metadata.height());
            if (metadata.durationSeconds() > 0) record.put("durationSeconds", metadata.durationSeconds());
        }
        prepend(record);
        return toDto(record);
    }

    private void prepend(ObjectNode record) {
        ArrayNode current = repository.readMedia();
        ArrayNode updated = mapper.createArrayNode();
        updated.add(record);
        updated.addAll(current);
        repository.writeMedia(updated);
    }

    private ObjectNode record(String id, String kind, String mimeType, int size, String storageName, String alt) {
        return mapper.createObjectNode()
            .put("id", id)
            .put("url", URL_PREFIX + id)
            .put("kind", kind)
            .put("mimeType", mimeType)
            .put("size", size)
            .put("alt", alt)
            .put("poster", "")
            .put("createdAt", Instant.now().toString())
            .put("storageName", storageName);
    }

    private ObjectNode toDto(ObjectNode record) {
        ObjectNode dto = mapper.createObjectNode();
        dto.put("id", record.path("id").asText());
        dto.put("url", record.path("url").asText());
        dto.put("kind", record.path("kind").asText());
        dto.put("mimeType", record.path("mimeType").asText());
        dto.put("size", record.path("size").asLong());
        dto.put("alt", record.path("alt").asText(""));
        dto.put("poster", record.path("poster").asText(""));
        if (record.path("width").canConvertToInt() && record.path("width").asInt() > 0) dto.put("width", record.path("width").asInt());
        if (record.path("height").canConvertToInt() && record.path("height").asInt() > 0) dto.put("height", record.path("height").asInt());
        if (record.path("durationSeconds").isNumber() && record.path("durationSeconds").asDouble() > 0) dto.put("durationSeconds", record.path("durationSeconds").asDouble());
        dto.put("createdAt", record.path("createdAt").asText());
        return dto;
    }

    private Path filePath(ObjectNode record) {
        String id = safeId(record.path("id").asText());
        String kind = record.path("kind").asText();
        String storageName = record.path("storageName").asText();
        if (id == null || !("image".equals(kind) || "video".equals(kind))) return null;
        Set<String> extensions = "image".equals(kind) ? Set.of("webp") : Set.of("mp4", "webm", "ogg");
        boolean valid = extensions.stream().anyMatch(extension -> storageName.equals(id + "." + extension));
        if (!valid) return null;
        Path root = repository.mediaRoot();
        Path candidate = root.resolve(storageName).toAbsolutePath().normalize();
        return candidate.startsWith(root) ? candidate : null;
    }

    private VideoMetadata readVideoMetadata(Path path) {
        if (path == null || ffprobePath.isBlank()) return null;
        Process process = null;
        try {
            process = new ProcessBuilder(ffprobePath, "-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "default=noprint_wrappers=1", path.toString())
                .redirectErrorStream(true).start();
            if (!process.waitFor(5, TimeUnit.SECONDS) || process.exitValue() != 0) return null;
            byte[] output = process.getInputStream().readNBytes(8_192);
            int width = 0;
            int height = 0;
            double duration = 0;
            for (String line : new String(output, StandardCharsets.UTF_8).split("\\R")) {
                String[] pair = line.split("=", 2);
                if (pair.length != 2) continue;
                if ("width".equals(pair[0])) width = parsePositiveInt(pair[1]);
                if ("height".equals(pair[0])) height = parsePositiveInt(pair[1]);
                if ("duration".equals(pair[0])) duration = parsePositiveDouble(pair[1]);
            }
            return duration > 0 ? new VideoMetadata(width, height, duration) : null;
        } catch (IOException ignored) {
            if (process != null) process.destroyForcibly();
            return null;
        } catch (InterruptedException ignored) {
            if (process != null) process.destroyForcibly();
            Thread.currentThread().interrupt();
            return null;
        }
    }

    private static int parsePositiveInt(String value) {
        try { return Math.max(0, Integer.parseInt(value.trim())); } catch (NumberFormatException ignored) { return 0; }
    }

    private static double parsePositiveDouble(String value) {
        try {
            double parsed = Double.parseDouble(value.trim());
            return Double.isFinite(parsed) && parsed > 0 && parsed <= 86_400 ? parsed : 0;
        } catch (NumberFormatException ignored) { return 0; }
    }

    private record VideoMetadata(int width, int height, double durationSeconds) { }

    private void writeMediaFile(String storageName, byte[] bytes, String errorMessage, int statusCode) {
        Path root = repository.mediaRoot();
        Path finalPath = root.resolve(storageName).toAbsolutePath().normalize();
        if (!finalPath.startsWith(root)) throw new ApiException("Não foi possível processar a solicitação.", 500);
        Path temporary = root.resolve(storageName + "." + UUID.randomUUID() + ".tmp");
        try {
            Files.createDirectories(root);
            Files.write(temporary, bytes);
            try {
                Files.move(temporary, finalPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(temporary, finalPath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ignored) {
            try {
                Files.deleteIfExists(temporary);
            } catch (IOException ignoredCleanup) {
                // The temporary name is opaque and remains inside the private volume.
            }
            throw new ApiException(errorMessage, statusCode);
        }
    }

    private DecodedImage decodeImage(byte[] bytes, String mimeType) {
        try {
            BufferedImage image;
            int orientation = 1;
            if ("image/webp".equals(mimeType)) {
                int[] dimensions = WebPCodec.getWebPInfo(bytes);
                guardDimensions(dimensions[0], dimensions[1]);
                image = WebPCodec.decodeImage(bytes);
            } else if ("image/avif".equals(mimeType)) {
                image = decodeAvif(bytes);
            } else {
                image = decodeRaster(bytes);
                if ("image/jpeg".equals(mimeType)) orientation = jpegOrientation(bytes);
            }
            if (image == null) throw new IOException("unsupported image");
            guardDimensions(image.getWidth(), image.getHeight());
            return new DecodedImage(image, orientation);
        } catch (ApiException error) {
            throw error;
        } catch (IOException | RuntimeException error) {
            throw new ApiException("Não foi possível validar ou otimizar a imagem enviada.", 422);
        }
    }

    private BufferedImage decodeAvif(byte[] bytes) throws IOException {
        if (ffmpegPath.isBlank()) {
            throw new ApiException("Conversão de imagem indisponível nesta plataforma.", 503);
        }
        Path input = Files.createTempFile("landing-builder-media-", ".avif");
        Path output = Files.createTempFile("landing-builder-media-", ".png");
        try {
            Files.write(input, bytes);
            Files.deleteIfExists(output);
            Process process;
            try {
                process = new ProcessBuilder(
                    ffmpegPath, "-y", "-max_pixels", String.valueOf(MAX_IMAGE_PIXELS),
                    "-i", input.toString(), "-frames:v", "1", output.toString()
                )
                    .redirectInput(ProcessBuilder.Redirect.PIPE)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            } catch (IOException error) {
                throw new ApiException("Conversão de imagem indisponível nesta plataforma.", 503);
            }
            process.getOutputStream().close();
            if (!process.waitFor(Duration.ofMinutes(2).toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new ApiException("Conversão de imagem indisponível nesta plataforma.", 503);
            }
            if (process.exitValue() != 0) throw new IOException("ffmpeg failed");
            return decodeRaster(Files.readAllBytes(output));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new ApiException("Conversão de imagem indisponível nesta plataforma.", 503);
        } finally {
            Files.deleteIfExists(input);
            Files.deleteIfExists(output);
        }
    }

    private static BufferedImage decodeRaster(byte[] bytes) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (input == null) throw new IOException("unsupported image");
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IOException("unsupported image");
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                guardDimensions(reader.getWidth(0), reader.getHeight(0));
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        }
    }

    private static BufferedImage resizeInside(BufferedImage source, int maximum) {
        if (source.getWidth() <= maximum && source.getHeight() <= maximum) return source;
        double ratio = Math.min(maximum / (double) source.getWidth(), maximum / (double) source.getHeight());
        int width = Math.max(1, (int) Math.round(source.getWidth() * ratio));
        int height = Math.max(1, (int) Math.round(source.getHeight() * ratio));
        BufferedImage result = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = result.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return result;
    }

    private static BufferedImage orient(BufferedImage source, int orientation) {
        if (orientation <= 1 || orientation > 8) return source;
        boolean swap = orientation >= 5;
        int width = swap ? source.getHeight() : source.getWidth();
        int height = swap ? source.getWidth() : source.getHeight();
        BufferedImage result = new BufferedImage(
            width,
            height,
            source.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB
        );
        for (int y = 0; y < source.getHeight(); y++) {
            for (int x = 0; x < source.getWidth(); x++) {
                int destinationX;
                int destinationY;
                switch (orientation) {
                    case 2 -> { destinationX = source.getWidth() - 1 - x; destinationY = y; }
                    case 3 -> { destinationX = source.getWidth() - 1 - x; destinationY = source.getHeight() - 1 - y; }
                    case 4 -> { destinationX = x; destinationY = source.getHeight() - 1 - y; }
                    case 5 -> { destinationX = y; destinationY = x; }
                    case 6 -> { destinationX = source.getHeight() - 1 - y; destinationY = x; }
                    case 7 -> { destinationX = source.getHeight() - 1 - y; destinationY = source.getWidth() - 1 - x; }
                    case 8 -> { destinationX = y; destinationY = source.getWidth() - 1 - x; }
                    default -> { destinationX = x; destinationY = y; }
                }
                result.setRGB(destinationX, destinationY, source.getRGB(x, y));
            }
        }
        return result;
    }

    private static void guardDimensions(int width, int height) throws IOException {
        if (width < 1 || height < 1 || ((long) width * height) > MAX_IMAGE_PIXELS) {
            throw new IOException("image dimensions");
        }
    }

    private static String detectImageMime(byte[] bytes) {
        if (startsWith(bytes, new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})) return "image/png";
        if (bytes.length >= 3 && bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff) return "image/jpeg";
        if (bytes.length >= 12 && ascii(bytes, 0, 4).equals("RIFF") && ascii(bytes, 8, 4).equals("WEBP")) return "image/webp";
        if (isoBrands(bytes).stream().anyMatch(brand -> brand.equals("avif") || brand.equals("avis"))) return "image/avif";
        return null;
    }

    private static String detectVideoMime(byte[] bytes) {
        if (isoBrands(bytes).stream().anyMatch(MP4_BRANDS::contains)) return "video/mp4";
        if (startsWith(bytes, new byte[] {0x1a, 0x45, (byte) 0xdf, (byte) 0xa3}) && contains(bytes, "webm", 4_096)) return "video/webm";
        if (ascii(bytes, 0, Math.min(4, bytes.length)).equals("OggS") && contains(bytes, "theora", 65_536)) return "video/ogg";
        return null;
    }

    private static List<String> isoBrands(byte[] bytes) {
        if (bytes.length < 16 || !ascii(bytes, 4, 4).equals("ftyp")) return List.of();
        List<String> brands = new ArrayList<>();
        for (int index = 8; index + 4 <= Math.min(bytes.length, 64); index += 4) brands.add(ascii(bytes, index, 4));
        return brands;
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) return false;
        for (int index = 0; index < prefix.length; index++) if (bytes[index] != prefix[index]) return false;
        return true;
    }

    private static boolean contains(byte[] bytes, String text, int maximum) {
        byte[] expected = text.getBytes(StandardCharsets.US_ASCII);
        int end = Math.min(bytes.length, maximum);
        for (int offset = 0; offset + expected.length <= end; offset++) {
            boolean matches = true;
            for (int index = 0; index < expected.length; index++) {
                if (bytes[offset + index] != expected[index]) { matches = false; break; }
            }
            if (matches) return true;
        }
        return false;
    }

    private static String ascii(byte[] bytes, int offset, int length) {
        if (offset < 0 || length < 0 || offset + length > bytes.length) return "";
        return new String(bytes, offset, length, StandardCharsets.US_ASCII);
    }

    private static int jpegOrientation(byte[] bytes) {
        if (bytes.length < 4 || (bytes[0] & 0xff) != 0xff || (bytes[1] & 0xff) != 0xd8) return 1;
        int offset = 2;
        while (offset + 4 <= bytes.length) {
            if ((bytes[offset] & 0xff) != 0xff) break;
            int marker = bytes[offset + 1] & 0xff;
            offset += 2;
            if (marker == 0xda || marker == 0xd9 || offset + 2 > bytes.length) break;
            int length = ((bytes[offset] & 0xff) << 8) | (bytes[offset + 1] & 0xff);
            if (length < 2 || offset + length > bytes.length) break;
            if (marker == 0xe1 && length >= 14 && ascii(bytes, offset + 2, 6).equals("Exif\0\0")) {
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
        ByteBuffer data = ByteBuffer.wrap(bytes).order(little ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN);
        int ifd = start + data.getInt(start + 4);
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

    private static String safeId(String id) {
        return id != null && ID.matcher(id).matches() ? id : null;
    }

    private static String normalizeAlt(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() > 160) throw new ApiException("A descrição da mídia aceita até 160 caracteres.", 422);
        return normalized;
    }

    private static ObjectNode recordForUrl(ArrayNode media, String url) {
        for (JsonNode value : media) {
            if (value instanceof ObjectNode record && url.equals(record.path("url").asText())) return record;
        }
        return null;
    }

    private static int find(ArrayNode array, String id) {
        for (int index = 0; index < array.size(); index++) {
            if (id.equals(array.get(index).path("id").asText())) return index;
        }
        return -1;
    }

    private static String createdAt(ObjectNode record) {
        return record.path("createdAt").asText("");
    }

    private static List<ObjectNode> objectNodes(ArrayNode source) {
        List<ObjectNode> result = new ArrayList<>();
        for (JsonNode value : source) if (value instanceof ObjectNode object) result.add(object);
        return result;
    }

    private static ApiException unsupportedMedia() {
        return new ApiException("Tipo de mídia não suportado. Use PNG, JPG, WebP, AVIF, MP4, WebM ou Ogg de vídeo válido.", 422);
    }

    public record ResolvedMedia(ObjectNode record, Path filePath) { }

    private record DecodedImage(BufferedImage image, int orientation) { }
}
