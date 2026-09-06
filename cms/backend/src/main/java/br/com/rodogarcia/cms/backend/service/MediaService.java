package br.com.rodogarcia.cms.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.text.Collator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import br.com.rodogarcia.cms.backend.config.MediaSettings;
import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.exception.JsonStoreException;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import br.com.rodogarcia.cms.backend.repository.content.ContentRepository;
import br.com.rodogarcia.cms.backend.repository.content.SiteTextsRepository;
import br.com.rodogarcia.cms.backend.utils.Ids;
import br.com.rodogarcia.cms.backend.utils.IsoTime;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

@Service
public final class MediaService {
    public static final long MAX_IMAGE_UPLOAD_BYTES = 8L * 1_024 * 1_024;
    public static final long MAX_VIDEO_UPLOAD_BYTES = 64L * 1_024 * 1_024;

    private static final Set<String> IMAGE_MIME_TYPES = Set.of(
        "image/png", "image/jpeg", "image/webp", "image/avif"
    );
    private static final Set<String> VIDEO_MIME_TYPES = Set.of(
        "video/mp4", "video/webm", "video/ogg", "application/ogg"
    );
    private static final Map<String, String> MIME_EXTENSIONS = Map.of(
        "image/png", ".png",
        "image/jpeg", ".jpg",
        "image/webp", ".webp",
        "image/avif", ".avif",
        "video/mp4", ".mp4",
        "video/webm", ".webm",
        "video/ogg", ".ogg",
        "application/ogg", ".ogg"
    );
    private static final Set<String> EDITABLE_MEDIA_SLOTS = Set.of(
        "home.cert.iso",
        "home.cert.sassmaq",
        "home.cert.ecovadis",
        "home.cert.pf",
        "home.cert.pcsp",
        "home.cert.exercito",
        "home.cert.ibama"
    );

    private final JsonFileStore store;
    private final StoragePaths paths;
    private final Path uploadsRoot;
    private final Path publicRoot;
    private final ContentRepository contentRepository;
    private final SiteTextsRepository siteTextsRepository;
    private final MediaValidationService validation;
    private final AdminMediaProcessor processor;
    private final MediaMetadataReader metadataReader;
    private final MediaSettings settings;
    private final AuditService audit;
    private final Clock clock;

    public MediaService(
        JsonFileStore store,
        StoragePaths paths,
        CmsProperties properties,
        ContentRepository contentRepository,
        SiteTextsRepository siteTextsRepository,
        MediaValidationService validation,
        AdminMediaProcessor processor,
        MediaMetadataReader metadataReader,
        MediaSettings settings,
        AuditService audit,
        Clock clock
    ) {
        this.store = store;
        this.paths = paths;
        this.uploadsRoot = properties.uploadsDir().toAbsolutePath().normalize();
        this.publicRoot = properties.frontendPublicDir().toAbsolutePath().normalize();
        this.contentRepository = contentRepository;
        this.siteTextsRepository = siteTextsRepository;
        this.validation = validation;
        this.processor = processor;
        this.metadataReader = metadataReader;
        this.settings = settings;
        this.audit = audit;
        this.clock = clock;
    }

    public void recoverReferenceTransaction() {
        store.recoverTransaction(paths.mediaReplaceTransaction());
    }

    public synchronized ArrayNode listAdminImages() {
        Map<String, Integer> references = references();
        ArrayNode library = readLibrary();
        Map<String, JsonNode> libraryByUrl = libraryByUrl(library);
        List<ObjectNode> result = new ArrayList<>();

        for (JsonNode item : library) {
            if (!item.isObject()) continue;
            String url = normalizedPath(firstPresent(item, "url", "optimizedUrl"));
            Path statsPath = url.startsWith("/uploads/")
                ? safeResolve(uploadsRoot, url.substring("/uploads/".length()))
                : safeResolve(publicRoot, stripLeadingSlash(url));
            long fallbackSize = number(item.get("optimizedSize"), number(item.get("size"), 0));
            long size = regularSize(statsPath, fallbackSize);
            int referenceCount = references.getOrDefault(url, 0);
            ObjectNode record = store.mapper().createObjectNode();
            record.put("id", jsString(item.get("id"), ""));
            record.put("name", jsString(item.get("name"), basename(url)));
            record.put("url", url);
            record.put("size", size);
            record.put("references", referenceCount);
            record.put("usedInContent", referenceCount > 0);
            record.put("source", "upload");
            String explicitType = jsString(item.get("mediaType"), mediaTypeFromUrl(url));
            String mediaType = explicitType.equals("video") ? "video" : "image";
            record.put("mediaType", mediaType);
            record.put("format", jsString(item.get("format"), "webp"));
            putOptionalNumber(record, "width", number(item.get("width"), 0));
            putOptionalNumber(record, "height", number(item.get("height"), 0));
            putOptionalDecimal(record, "durationSeconds", decimal(item.get("durationSeconds"), 0d));
            record.put("uploadedAt", jsString(firstPresent(item, "uploadedAt", "createdAt"), ""));
            putOptionalNumber(record, "originalSize", number(item.get("originalSize"), 0));
            putOptionalNumber(record, "optimizedSize", number(item.get("optimizedSize"), size));
            record.put("originalUrl", normalizedPath(item.get("originalUrl")));
            record.put("optimizedUrl", normalizedPath(firstPresent(item, "optimizedUrl", "url")));
            record.put("thumbnailUrl", normalizedPath(item.get("thumbnailUrl")));
            record.put("mediumUrl", normalizedPath(item.get("mediumUrl")));
            record.put("largeUrl", normalizedPath(item.get("largeUrl")));
            putOptionalNumber(record, "optimizedWidth", number(item.get("optimizedWidth"), 0));
            putOptionalNumber(record, "optimizedHeight", number(item.get("optimizedHeight"), 0));
            putOptionalNumber(record, "thumbnailWidth", number(item.get("thumbnailWidth"), 0));
            putOptionalNumber(record, "thumbnailHeight", number(item.get("thumbnailHeight"), 0));
            putOptionalNumber(record, "mediumWidth", number(item.get("mediumWidth"), 0));
            putOptionalNumber(record, "mediumHeight", number(item.get("mediumHeight"), 0));
            putOptionalNumber(record, "largeWidth", number(item.get("largeWidth"), 0));
            putOptionalNumber(record, "largeHeight", number(item.get("largeHeight"), 0));
            enrichTechnicalMetadata(record, statsPath, mediaType);
            result.add(record);
        }

        for (Path file : walkFiles(uploadsRoot)) {
            String relative = slash(uploadsRoot.relativize(file).toString());
            if (!MediaValidationService.MEDIA_EXTENSIONS.contains(extension(relative))) continue;
            String url = normalizedPath(StringNode.valueOf("/uploads/" + relative));
            if (libraryByUrl.containsKey(url)) continue;
            result.add(scannedRecord(file, url, "upload", references));
        }
        for (Path file : walkFiles(publicRoot)) {
            String relative = slash(publicRoot.relativize(file).toString());
            if (relative.startsWith("uploads/")) continue;
            if (!MediaValidationService.MEDIA_EXTENSIONS.contains(extension(relative))) continue;
            String url = normalizedPath(StringNode.valueOf("/" + relative));
            int count = references.getOrDefault(url, 0);
            result.add(scannedRecord(file, url, count > 0 ? "content" : "library", references));
        }

        Collator collator = Collator.getInstance();
        result.sort((left, right) -> {
            Instant leftDate = instant(left.path("uploadedAt").asString());
            Instant rightDate = instant(right.path("uploadedAt").asString());
            if (leftDate != null && rightDate != null) {
                int date = rightDate.compareTo(leftDate);
                if (date != 0) return date;
            }
            return collator.compare(left.path("name").asString(), right.path("name").asString());
        });
        ArrayNode output = store.mapper().createArrayNode();
        result.forEach(output::add);
        return output;
    }

    public synchronized ObjectNode save(
        String fileName,
        String mimeType,
        byte[] bytes,
        HttpServletRequest request
    ) {
        if (IMAGE_MIME_TYPES.contains(mimeType)) {
            return saveImage(fileName, mimeType, bytes, request);
        }
        return saveVideo(fileName, mimeType, bytes, request);
    }

    public synchronized ObjectNode replaceReferences(
        String fromRaw,
        String toRaw,
        HttpServletRequest request
    ) {
        String fromUrl = validation.assertInternal(fromRaw, MediaValidationService.Kind.ALL, true, "URL atual");
        String toUrl = validation.assertInternal(toRaw, MediaValidationService.Kind.ALL, true, "Nova URL");
        if (fromUrl.isEmpty() || toUrl.isEmpty()) throw new ApiException(422, "Informe URLs validas.");
        if (!mediaTypeFromUrl(fromUrl).equals(mediaTypeFromUrl(toUrl))) {
            throw new ApiException(422, "Substitua a referência por uma mídia do mesmo tipo.");
        }

        store.writeTransaction(
            referenceStorePaths(),
            paths.mediaReplaceTransaction(),
            () -> referenceUpdates(fromUrl, toUrl, List.of(fromUrl))
        );
        audit.record(request, "media.replace_reference", fromUrl, Map.of("toUrl", toUrl));
        ObjectNode result = store.mapper().createObjectNode();
        result.put("fromUrl", fromUrl);
        result.put("toUrl", toUrl);
        return result;
    }

    public synchronized ObjectNode delete(
        String rawUrl,
        boolean confirmInUse,
        HttpServletRequest request
    ) {
        String url = validation.assertInternal(rawUrl, MediaValidationService.Kind.ALL, true, "Mídia");
        if (!url.startsWith("/uploads/")) {
            throw new ApiException(422, "Somente arquivos enviados pela Biblioteca podem ser excluídos.");
        }

        List<Path> lockedPaths = new ArrayList<>(referenceStorePaths());
        lockedPaths.add(paths.mediaReplaceTransaction());
        lockedPaths.add(paths.mediaLibrary());
        return store.withWriteLock(
            lockedPaths,
            () -> deleteLocked(url, confirmInUse, request)
        );
    }

    private ObjectNode deleteLocked(
        String url,
        boolean confirmInUse,
        HttpServletRequest request
    ) {
        JsonNode record = libraryByUrl(readLibrary()).get(url);
        List<String> urls = uploadedUrlsForRecord(record, url);
        Map<String, Integer> references = references();
        int referenceCount = urls.stream().mapToInt(item -> references.getOrDefault(item, 0)).sum();
        if (referenceCount > 0 && !confirmInUse) {
            throw new ApiException(
                409,
                "Esta mídia está em uso em " + referenceCount
                    + " referência(s). Confirme a exclusão para removê-la e usar os fallbacks do site."
            );
        }

        List<Path> files = urls.stream()
            .map(this::uploadFilePath)
            .filter(Files::exists)
            .toList();
        if (files.isEmpty()) throw new ApiException(404, "Arquivo de mídia não encontrado.");

        LinkedHashMap<Path, JsonNode> updates = referenceUpdates("", "", urls);
        store.writeTransaction(updates, paths.mediaReplaceTransaction());

        ArrayNode retained = store.mapper().createArrayNode();
        for (JsonNode item : readLibrary()) {
            boolean remove = uploadedUrlsForRecord(item, "").stream().anyMatch(urls::contains);
            if (!remove) retained.add(item.deepCopy());
        }
        writeLibrary(retained);
        files.forEach(MediaService::deleteQuietly);
        audit.record(
            request,
            "media.delete",
            url,
            Map.of("referenceCount", String.valueOf(referenceCount), "removedFiles", String.valueOf(files.size()))
        );
        ObjectNode result = store.mapper().createObjectNode();
        result.put("url", url);
        result.put("referenceCount", referenceCount);
        result.put("removedFiles", files.size());
        return result;
    }

    public synchronized ObjectNode readMediaSlots() {
        return store.readObject(paths.mediaSlots()).deepCopy();
    }

    public synchronized ObjectNode updateMediaSlots(JsonNode body, HttpServletRequest request) {
        ObjectNode next = readMediaSlots();
        if (body != null && body.isObject()) {
            body.properties().forEach(entry -> {
                String key = Sanitizers.text(entry.getKey(), 120);
                if (!EDITABLE_MEDIA_SLOTS.contains(key)) {
                    throw new ApiException(
                        422,
                        "Slot de mídia não editável: " + (key.isEmpty() ? entry.getKey() : key) + "."
                    );
                }
                String mediaUrl = validation.assertInternal(
                    entry.getValue(), MediaValidationService.Kind.IMAGE, false, "Slot " + key
                );
                if (mediaUrl.isEmpty()) next.remove(key);
                else next.put(key, mediaUrl);
            });
        }
        store.write(paths.mediaSlots(), next);
        audit.record(
            request,
            "media.slots_update",
            "media-slots",
            Map.of("count", String.valueOf(next.size()))
        );
        return next;
    }

    private ObjectNode saveImage(
        String fileName,
        String mimeType,
        byte[] bytes,
        HttpServletRequest request
    ) {
        if (!IMAGE_MIME_TYPES.contains(mimeType) || !MIME_EXTENSIONS.containsKey(mimeType)) {
            throw new ApiException(422, "Tipo de imagem não suportado. Use PNG, JPG, WebP ou AVIF.");
        }
        if (bytes.length == 0 || bytes.length > MAX_IMAGE_UPLOAD_BYTES) {
            throw new ApiException(422, "Imagem fora do limite permitido.");
        }
        if (!validImageSignature(mimeType, bytes)) {
            throw new ApiException(422, "O conteúdo do arquivo não corresponde ao tipo informado.");
        }

        AdminMediaProcessor.ProcessedImage image = processor.image(bytes, mimeType);
        createUploadsDirectory();
        String base = safeBaseName(fileName) + "-" + UUID.randomUUID();
        String optimizedName = base + ".webp";
        String thumbnailName = base + "-thumb.webp";
        String mediumName = base + "-medium.webp";
        String largeName = base + "-large.webp";
        Path optimized = uploadsRoot.resolve(optimizedName);
        Path thumbnail = uploadsRoot.resolve(thumbnailName);
        Path medium = uploadsRoot.resolve(mediumName);
        Path large = uploadsRoot.resolve(largeName);
        writeBytes(optimized, image.optimized());
        writeBytes(thumbnail, image.thumbnail());
        writeBytes(medium, image.medium());
        writeBytes(large, image.large());

        ObjectNode record = store.mapper().createObjectNode();
        record.put("id", Ids.generate("media"));
        record.put("name", basename(fileName));
        record.put("url", "/uploads/" + optimizedName);
        record.put("mediaType", "image");
        record.put("optimizedUrl", "/uploads/" + optimizedName);
        record.put("thumbnailUrl", "/uploads/" + thumbnailName);
        record.put("mediumUrl", "/uploads/" + mediumName);
        record.put("largeUrl", "/uploads/" + largeName);
        record.put("format", "webp");
        record.put("originalFormat", mimeType);
        record.put("width", image.width());
        record.put("height", image.height());
        record.put("optimizedWidth", image.optimizedWidth());
        record.put("optimizedHeight", image.optimizedHeight());
        record.put("thumbnailWidth", image.thumbnailWidth());
        record.put("thumbnailHeight", image.thumbnailHeight());
        record.put("mediumWidth", image.mediumWidth());
        record.put("mediumHeight", image.mediumHeight());
        record.put("largeWidth", image.largeWidth());
        record.put("largeHeight", image.largeHeight());
        putAspectRatio(record, image.width(), image.height());
        record.put("originalSize", bytes.length);
        record.put("optimizedSize", size(optimized));
        record.put("thumbnailSize", size(thumbnail));
        record.put("mediumSize", size(medium));
        record.put("largeSize", size(large));
        record.put("webpQuality", settings.webpQuality());
        record.put("uploadedAt", IsoTime.format(clock.millis()));
        prependLibrary(record);
        audit.record(
            request,
            "media.upload",
            record.path("url").asString(),
            Map.of(
                "fileName", fileName,
                "originalSize", String.valueOf(bytes.length),
                "optimizedSize", String.valueOf(record.path("optimizedSize").longValue())
            )
        );
        return record;
    }

    private ObjectNode saveVideo(
        String fileName,
        String mimeType,
        byte[] bytes,
        HttpServletRequest request
    ) {
        if (!VIDEO_MIME_TYPES.contains(mimeType) || !MIME_EXTENSIONS.containsKey(mimeType)) {
            throw new ApiException(
                422,
                "Tipo de mídia não suportado. Use imagem PNG/JPG/WebP/AVIF ou vídeo MP4/WebM/Ogg."
            );
        }
        if (bytes.length == 0 || bytes.length > MAX_VIDEO_UPLOAD_BYTES) {
            throw new ApiException(422, "Video fora do limite permitido.");
        }
        if (!validVideoSignature(mimeType, bytes)) {
            throw new ApiException(422, "O conteúdo do vídeo não corresponde ao tipo informado.");
        }

        createUploadsDirectory();
        String base = safeBaseName(fileName) + "-" + UUID.randomUUID();
        Path input = uploadsRoot.resolve(base + MIME_EXTENSIONS.get(mimeType));
        Path temporary = uploadsRoot.resolve(base + ".tmp.webm");
        Path stored = uploadsRoot.resolve(base + ".webm");
        writeBytes(input, bytes);
        try {
            processor.video(input, temporary);
            try {
                Files.move(temporary, stored);
            } catch (IOException error) {
                throw new JsonStoreException(stored, error);
            }
        } finally {
            deleteQuietly(input);
            deleteQuietly(temporary);
        }

        long outputSize = size(stored);
        ObjectNode record = store.mapper().createObjectNode();
        record.put("id", Ids.generate("media"));
        record.put("name", basename(fileName));
        record.put("url", "/uploads/" + stored.getFileName());
        record.put("mediaType", "video");
        record.put("format", "webm");
        record.put("originalFormat", mimeType);
        record.put("size", outputSize);
        record.put("originalSize", bytes.length);
        record.put("optimizedSize", outputSize);
        record.put("uploadedAt", IsoTime.format(clock.millis()));
        metadataReader.video(stored).ifPresent(metadata -> {
            record.put("width", metadata.width());
            record.put("height", metadata.height());
            record.put("durationSeconds", roundedMetric(metadata.durationSeconds()));
            putAspectRatio(record, metadata.width(), metadata.height());
        });
        prependLibrary(record);
        audit.record(
            request,
            "media.upload",
            record.path("url").asString(),
            Map.of("fileName", fileName, "originalSize", String.valueOf(bytes.length), "mediaType", "video")
        );
        return record;
    }

    private LinkedHashMap<Path, JsonNode> referenceUpdates(
        String fromUrl,
        String toUrl,
        List<String> deleteUrls
    ) {
        JsonNode content = contentRepository.read();
        JsonNode siteTexts = siteTextsRepository.read();
        JsonNode slots = store.readObject(paths.mediaSlots());
        JsonNode popup = store.readObject(paths.popupConfig());
        JsonNode seo = store.readObject(paths.seoSettings());
        LinkedHashMap<Path, JsonNode> updates = new LinkedHashMap<>();
        if (!fromUrl.isEmpty()) {
            updates.put(paths.content(), replace(content, fromUrl, toUrl));
            updates.put(paths.siteTexts(), replace(siteTexts, fromUrl, toUrl));
            updates.put(paths.mediaSlots(), replace(slots, fromUrl, toUrl));
            updates.put(paths.popupConfig(), replace(popup, fromUrl, toUrl));
            updates.put(paths.seoSettings(), replace(seo, fromUrl, toUrl));
            return updates;
        }
        for (String url : deleteUrls) {
            content = replace(content, url, "");
            siteTexts = replace(siteTexts, url, "");
            slots = replace(slots, url, "");
            popup = replace(popup, url, "");
            seo = replace(seo, url, "");
        }
        updates.put(paths.content(), content);
        updates.put(paths.siteTexts(), siteTexts);
        updates.put(paths.mediaSlots(), slots);
        updates.put(paths.popupConfig(), popup);
        updates.put(paths.seoSettings(), seo);
        return updates;
    }

    private List<Path> referenceStorePaths() {
        return List.of(
            paths.content(),
            paths.siteTexts(),
            paths.mediaSlots(),
            paths.popupConfig(),
            paths.seoSettings()
        );
    }

    private JsonNode replace(JsonNode value, String from, String to) {
        if (value == null) return store.mapper().nullNode();
        if (value.isString()) {
            return sanitizedUrl(value).equals(from) ? StringNode.valueOf(to) : value.deepCopy();
        }
        if (value.isArray()) {
            ArrayNode result = store.mapper().createArrayNode();
            value.forEach(item -> result.add(replace(item, from, to)));
            return result;
        }
        if (value.isObject()) {
            ObjectNode result = store.mapper().createObjectNode();
            value.properties().forEach(entry -> result.set(entry.getKey(), replace(entry.getValue(), from, to)));
            return result;
        }
        return value.deepCopy();
    }

    private Map<String, Integer> references() {
        Map<String, Integer> references = new HashMap<>();
        collectReferences(contentRepository.read(), references);
        collectReferences(siteTextsRepository.read(), references);
        collectReferences(readMediaSlots(), references);
        collectReferences(store.readObject(paths.popupConfig()), references);
        collectReferences(store.readObject(paths.seoSettings()), references);
        return references;
    }

    private void collectReferences(JsonNode value, Map<String, Integer> references) {
        if (value == null) return;
        if (value.isString()) {
            String sanitized = sanitizedUrl(value);
            if (!sanitized.isEmpty()
                && MediaValidationService.MEDIA_EXTENSIONS.contains(extension(sanitized))) {
                references.merge(sanitized, 1, Integer::sum);
            }
            return;
        }
        if (value.isArray() || value.isObject()) {
            value.forEach(item -> collectReferences(item, references));
        }
    }

    private String sanitizedUrl(JsonNode value) {
        return ContentJson.url(value);
    }

    private ArrayNode readLibrary() {
        return store.readArray(paths.mediaLibrary());
    }

    private void writeLibrary(ArrayNode value) {
        store.write(paths.mediaLibrary(), value);
    }

    private void prependLibrary(ObjectNode record) {
        ArrayNode output = store.mapper().createArrayNode();
        output.add(record.deepCopy());
        for (JsonNode item : readLibrary()) {
            if (output.size() == 5_000) break;
            output.add(item.deepCopy());
        }
        writeLibrary(output);
    }

    private Map<String, JsonNode> libraryByUrl(ArrayNode library) {
        Map<String, JsonNode> result = new LinkedHashMap<>();
        for (JsonNode item : library) {
            for (String field : List.of(
                "url", "optimizedUrl", "originalUrl", "thumbnailUrl",
                "mediumUrl", "largeUrl", "posterUrl"
            )) {
                String url = normalizedPath(item.get(field));
                if (!url.isEmpty()) result.put(url, item);
            }
        }
        return result;
    }

    private List<String> uploadedUrlsForRecord(JsonNode record, String fallbackUrl) {
        Set<String> urls = new java.util.LinkedHashSet<>();
        addUploadedUrl(urls, fallbackUrl);
        if (record != null && record.isObject()) {
            for (String field : List.of(
                "url", "optimizedUrl", "originalUrl", "thumbnailUrl",
                "mediumUrl", "largeUrl", "posterUrl"
            )) addUploadedUrl(urls, normalizedPath(record.get(field)));
        }
        return List.copyOf(urls);
    }

    private static void addUploadedUrl(Set<String> urls, String url) {
        if (url != null && url.startsWith("/uploads/")) urls.add(url);
    }

    private Path uploadFilePath(String url) {
        String relative = url.replaceFirst("^/uploads/", "");
        Path file = safeResolve(uploadsRoot, relative);
        if (file == null || file.equals(uploadsRoot) || !file.startsWith(uploadsRoot)) {
            throw new ApiException(422, "Arquivo de mídia inválido.");
        }
        return file;
    }

    private ObjectNode scannedRecord(
        Path file,
        String url,
        String source,
        Map<String, Integer> references
    ) {
        int referenceCount = references.getOrDefault(url, 0);
        ObjectNode record = store.mapper().createObjectNode();
        record.put("name", file.getFileName().toString());
        record.put("url", url);
        record.put("size", size(file));
        record.put("references", referenceCount);
        record.put("usedInContent", referenceCount > 0);
        record.put("source", source);
        record.put("mediaType", mediaTypeFromUrl(url));
        record.put("format", extension(url).replaceFirst("^\\.", ""));
        enrichTechnicalMetadata(record, file, record.path("mediaType").asString());
        try {
            record.put("uploadedAt", IsoTime.format(Files.getLastModifiedTime(file).toMillis()));
        } catch (IOException error) {
            throw new JsonStoreException(file, error);
        }
        return record;
    }

    private List<Path> walkFiles(Path root) {
        if (!Files.exists(root)) return List.of();
        try (Stream<Path> files = Files.walk(root)) {
            return files.filter(Files::isRegularFile).toList();
        } catch (IOException error) {
            throw new JsonStoreException(root, error);
        }
    }

    private void createUploadsDirectory() {
        try {
            Files.createDirectories(uploadsRoot);
        } catch (IOException error) {
            throw new JsonStoreException(uploadsRoot, error);
        }
    }

    private static boolean validImageSignature(String mimeType, byte[] bytes) {
        return switch (mimeType) {
            case "image/png" -> prefix(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
            case "image/jpeg" -> prefix(bytes, 0xff, 0xd8, 0xff);
            case "image/webp" -> ascii(bytes, 0, 4).equals("RIFF") && ascii(bytes, 8, 4).equals("WEBP");
            case "image/avif" -> ascii(bytes, 4, 4).equals("ftyp") && Set.of("avif", "avis").contains(ascii(bytes, 8, 4));
            default -> false;
        };
    }

    private static boolean validVideoSignature(String mimeType, byte[] bytes) {
        return switch (mimeType) {
            case "video/mp4" -> bytes.length > 12 && ascii(bytes, 4, 4).equals("ftyp");
            case "video/webm" -> bytes.length > 4 && prefix(bytes, 0x1a, 0x45, 0xdf, 0xa3);
            case "video/ogg", "application/ogg" -> bytes.length > 4 && ascii(bytes, 0, 4).equals("OggS");
            default -> false;
        };
    }

    private static boolean prefix(byte[] bytes, int... expected) {
        if (bytes.length < expected.length) return false;
        for (int index = 0; index < expected.length; index++) {
            if ((bytes[index] & 0xff) != expected[index]) return false;
        }
        return true;
    }

    private static String ascii(byte[] bytes, int offset, int length) {
        if (offset < 0 || bytes.length < offset + length) return "";
        return new String(bytes, offset, length, java.nio.charset.StandardCharsets.US_ASCII);
    }

    private static String safeBaseName(String fileName) {
        String name = basename(fileName);
        int dot = name.lastIndexOf('.');
        if (dot > 0) name = name.substring(0, dot);
        String sanitized = Sanitizers.text(name, 80)
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-+|-+$", "");
        return sanitized.isEmpty() ? "imagem" : sanitized;
    }

    private String normalizedPath(JsonNode value) {
        String raw = Sanitizers.text(value, 400);
        return raw.isEmpty() ? "" : Sanitizers.path(StringNode.valueOf(raw));
    }

    private static String extension(String path) {
        return MediaValidationService.extension(path);
    }

    private static String mediaTypeFromUrl(String url) {
        return MediaValidationService.VIDEO_EXTENSIONS.contains(extension(url)) ? "video" : "image";
    }

    private static String basename(String value) {
        String source = value == null ? "" : value;
        int index = Math.max(source.lastIndexOf('/'), source.lastIndexOf('\\'));
        return index < 0 ? source : source.substring(index + 1);
    }

    private static String slash(String value) {
        return value.replace('\\', '/');
    }

    private static String stripLeadingSlash(String value) {
        return value.startsWith("/") ? value.substring(1) : value;
    }

    private static Path safeResolve(Path root, String relative) {
        try {
            Path resolved = root.resolve(relative).toAbsolutePath().normalize();
            return resolved.startsWith(root) ? resolved : null;
        } catch (InvalidPathException error) {
            return null;
        }
    }

    private static long regularSize(Path path, long fallback) {
        return path != null && Files.exists(path) ? size(path) : fallback;
    }

    private static long size(Path path) {
        try {
            return Files.size(path);
        } catch (IOException error) {
            throw new JsonStoreException(path, error);
        }
    }

    private static void writeBytes(Path path, byte[] bytes) {
        try {
            Files.write(path, bytes);
        } catch (IOException error) {
            throw new JsonStoreException(path, error);
        }
    }

    private static void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // A remoção segue para os demais artefatos.
        }
    }

    private static long number(JsonNode value, long fallback) {
        if (value == null || value.isNull()) return fallback;
        if (value.isNumber()) return value.longValue();
        if (value.isString()) {
            try {
                double parsed = Double.parseDouble(value.asString());
                return Double.isFinite(parsed) ? (long) parsed : fallback;
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static double decimal(JsonNode value, double fallback) {
        if (value == null || value.isNull()) return fallback;
        try {
            double parsed = value.isNumber() ? value.doubleValue() : Double.parseDouble(value.asString());
            return Double.isFinite(parsed) ? parsed : fallback;
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static void putOptionalNumber(ObjectNode target, String field, long value) {
        if (value != 0) target.put(field, value);
    }

    private static void putOptionalDecimal(ObjectNode target, String field, double value) {
        if (validDuration(value)) target.put(field, roundedMetric(value));
    }

    private void enrichTechnicalMetadata(ObjectNode record, Path file, String mediaType) {
        long width = number(record.get("width"), 0);
        long height = number(record.get("height"), 0);
        double duration = decimal(record.get("durationSeconds"), 0d);

        if ("video".equals(mediaType)) {
            if (!validDimensions(width, height) || !validDuration(duration)) {
                metadataReader.video(file).ifPresent(metadata -> {
                    record.put("width", metadata.width());
                    record.put("height", metadata.height());
                    record.put("durationSeconds", roundedMetric(metadata.durationSeconds()));
                });
            }
        } else if (!validDimensions(width, height)) {
            metadataReader.image(file).ifPresent(dimensions -> {
                record.put("width", dimensions.width());
                record.put("height", dimensions.height());
            });
        }

        long resolvedWidth = number(record.get("width"), 0);
        long resolvedHeight = number(record.get("height"), 0);
        if (validDimensions(resolvedWidth, resolvedHeight)) {
            putAspectRatio(record, resolvedWidth, resolvedHeight);
        } else {
            record.remove("width");
            record.remove("height");
            record.remove("aspectRatio");
        }
        if ("video".equals(mediaType)) {
            double resolvedDuration = decimal(record.get("durationSeconds"), 0d);
            if (validDuration(resolvedDuration)) {
                record.put("durationSeconds", roundedMetric(resolvedDuration));
            } else {
                record.remove("durationSeconds");
            }
        } else {
            record.remove("durationSeconds");
        }
    }

    private static boolean validDimensions(long width, long height) {
        return width > 0 && height > 0 && width <= 32_768 && height <= 32_768;
    }

    private static boolean validDuration(double duration) {
        return Double.isFinite(duration) && duration > 0d && duration <= 86_400d;
    }

    private static void putAspectRatio(ObjectNode target, long width, long height) {
        if (!validDimensions(width, height)) return;
        target.put("aspectRatio", roundedMetric((double) width / (double) height));
    }

    private static double roundedMetric(double value) {
        return Math.round(value * 10_000d) / 10_000d;
    }

    private static JsonNode firstPresent(JsonNode item, String... fields) {
        if (item == null) return null;
        for (String field : fields) {
            JsonNode value = item.get(field);
            if (value != null && !value.isNull()) return value;
        }
        return null;
    }

    private static String jsString(JsonNode value, String fallback) {
        if (value == null || value.isNull()) return fallback;
        if (value.isString()) return value.asString();
        if (value.isNumber() || value.isBoolean()) return value.asString();
        return value.toString();
    }

    private static Instant instant(String value) {
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }
}
