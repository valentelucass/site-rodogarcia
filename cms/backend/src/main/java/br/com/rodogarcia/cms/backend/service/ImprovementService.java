package br.com.rodogarcia.cms.backend.service;

import java.io.IOException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.exception.JsonStoreException;
import br.com.rodogarcia.cms.backend.model.improvement.ImprovementDownload;
import br.com.rodogarcia.cms.backend.model.improvement.ImprovementInput;
import br.com.rodogarcia.cms.backend.model.improvement.ImprovementUpload;
import br.com.rodogarcia.cms.backend.repository.ImprovementRepository;
import br.com.rodogarcia.cms.backend.utils.Ids;
import br.com.rodogarcia.cms.backend.utils.IsoTime;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public final class ImprovementService {
    public static final int MAX_FILES = 5;
    public static final long MAX_FILE_BYTES = 8L * 1_024 * 1_024;
    public static final long MAX_REQUEST_BYTES = 42L * 1_024 * 1_024;
    public static final int RETENTION_DAYS = 60;

    private static final long RETENTION_MILLIS = RETENTION_DAYS * 24L * 60 * 60 * 1_000;
    private static final Set<String> IMAGE_MIME_TYPES = Set.of(
        "image/png", "image/jpeg", "image/webp", "image/avif"
    );
    private static final Set<String> ATTACHMENT_MIME_TYPES = Set.of(
        "image/png", "image/jpeg", "image/webp", "image/avif", "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    private final ImprovementRepository repository;
    private final AuditService audit;
    private final Clock clock;

    public ImprovementService(
        ImprovementRepository repository,
        AuditService audit,
        Clock clock
    ) {
        this.repository = repository;
        this.audit = audit;
        this.clock = clock;
    }

    public synchronized ObjectNode create(
        ImprovementInput input,
        List<ImprovementUpload> files
    ) {
        runRetention(Instant.ofEpochMilli(clock.millis()));
        List<AttachmentEntry> attachments = persistAttachments(files);
        String now = IsoTime.format(clock.millis());
        ObjectNode entry = repository.store().mapper().createObjectNode();
        entry.put("id", Ids.generate("improvement"));
        entry.put("createdAt", now);
        entry.put("updatedAt", now);
        entry.put("statusChangedAt", now);
        entry.put("status", "pending");
        ArrayNode attachmentNodes = entry.putArray("attachments");
        attachments.forEach(attachment -> attachmentNodes.add(attachment.node()));
        entry.put("profile", input.profile());
        entry.put("name", input.name());
        entry.put("email", input.email());
        entry.put("phone", input.profile().equals("site_user") ? "" : input.phone());
        entry.put("category", input.category());
        entry.put("message", input.message());
        entry.put("page", input.profile().equals("employee") ? "" : input.page());
        entry.put("branch", input.profile().equals("site_user") ? "" : input.branch());
        entry.put("area", input.profile().equals("site_user") ? "" : input.area());
        entry.put("expectedResult", input.profile().equals("site_user") ? "" : input.expectedResult());
        entry.put("applicationPlace", input.profile().equals("site_user") ? "" : input.applicationPlace());

        try {
            repository.mutate(items -> {
                items.add(entry.deepCopy());
                while (items.size() > 5_000) items.remove(0);
                return null;
            });
        } catch (RuntimeException error) {
            deleteAttachments(entry);
            throw error;
        }
        return entry;
    }

    public synchronized List<JsonNode> list(String rawStatus) {
        runRetention(Instant.ofEpochMilli(clock.millis()));
        String status = Sanitizers.text(rawStatus, 20);
        List<JsonNode> result = new ArrayList<>();
        repository.read().forEach(item -> {
            if (status.isEmpty() || item.path("status").asString().equals(status)) {
                result.add(item.deepCopy());
            }
        });
        result.sort(Comparator.comparing(
            item -> item.path("createdAt").asString(),
            Comparator.reverseOrder()
        ));
        return result;
    }

    public synchronized ObjectNode updateStatus(
        String rawId,
        String status,
        HttpServletRequest request
    ) {
        runRetention(Instant.ofEpochMilli(clock.millis()));
        String id = Sanitizers.text(rawId, 100);
        ObjectNode updated = repository.mutate(items -> {
            int index = indexOf(items, id);
            if (index < 0) throw new ApiException(404, "Solicitação de melhoria não encontrada.");
            ObjectNode current = items.get(index).isObject()
                ? (ObjectNode) items.get(index).deepCopy()
                : repository.store().mapper().createObjectNode();
            String now = IsoTime.format(clock.millis());
            current.put("status", status);
            current.put("updatedAt", now);
            current.put("statusChangedAt", now);
            if (status.equals("completed")) current.put("completedAt", now);
            if (status.equals("archived")) current.put("archivedAt", now);
            if (!status.equals("completed")) current.remove("completedAt");
            if (!status.equals("archived")) current.remove("archivedAt");
            items.set(index, current);
            return current.deepCopy();
        });
        audit.record(request, "improvement.status.update", id, Map.of("status", status));
        return updated;
    }

    public synchronized ImprovementDownload attachment(String rawId, String rawAttachmentId) {
        runRetention(Instant.ofEpochMilli(clock.millis()));
        String id = Sanitizers.text(rawId, 100);
        String attachmentId = Sanitizers.text(rawAttachmentId, 100);
        JsonNode improvement = null;
        for (JsonNode item : repository.read()) {
            if (item.path("id").asString().equals(id)) {
                improvement = item;
                break;
            }
        }
        if (improvement == null) {
            throw new ApiException(404, "Solicitação de melhoria não encontrada.");
        }
        for (AttachmentEntry item : attachmentsFor(improvement)) {
            if (!item.id().equals(attachmentId)) continue;
            Path path = attachmentPath(item.storedName());
            if (!Files.isRegularFile(path)) throw new ApiException(404, "Anexo não encontrado.");
            return new ImprovementDownload(
                item.id(), item.name(), item.mimeType(), item.size(), item.storedName(), path,
                IMAGE_MIME_TYPES.contains(item.mimeType())
            );
        }
        throw new ApiException(404, "Anexo não encontrado.");
    }

    public synchronized void runRetention(Instant now) {
        repository.locked(items -> {
            String nowIso = IsoTime.format(now.toEpochMilli());
            ArrayNode retained = repository.store().mapper().createArrayNode();
            boolean changed = false;
            for (JsonNode source : items) {
                if (!source.isObject()) {
                    retained.add(source.deepCopy());
                    continue;
                }
                ObjectNode item = (ObjectNode) source;
                if (item.path("status").asString().equals("archived")
                    && dateIsOlderThan(firstDate(item, "archivedAt", "updatedAt"), now)) {
                    deleteAttachments(item);
                    changed = true;
                    continue;
                }
                if (item.path("status").asString().equals("completed")
                    && dateIsOlderThan(firstDate(item, "completedAt", "updatedAt"), now)) {
                    ObjectNode archived = item.deepCopy();
                    archived.put("status", "archived");
                    archived.put("archivedAt", nowIso);
                    archived.put("updatedAt", nowIso);
                    retained.add(archived);
                    changed = true;
                    continue;
                }
                retained.add(item.deepCopy());
            }
            if (changed) repository.write(retained);
            return null;
        });
    }

    private List<AttachmentEntry> persistAttachments(List<ImprovementUpload> files) {
        if (files.size() > MAX_FILES) throw new ApiException(422, "Envie no máximo cinco anexos.");
        List<PendingAttachment> pending = new ArrayList<>();
        for (ImprovementUpload file : files) {
            if (file.size() > MAX_FILE_BYTES) {
                throw new ApiException(413, "Arquivo ou payload excede o limite permitido.");
            }
            String mimeType = detectAttachmentMime(file.originalName(), file.bytes());
            if (mimeType == null) {
                throw new ApiException(
                    422,
                    "Anexe apenas fotos PNG, JPG, WebP ou AVIF, ou arquivos CSV, XLS e XLSX válidos."
                );
            }
            String id = Ids.generate("attachment");
            String storedName = id + extensionForMime(mimeType);
            pending.add(new PendingAttachment(
                new AttachmentEntry(
                    id, safeAttachmentName(file.originalName()), mimeType,
                    file.size(), storedName, attachmentNode(id, file.originalName(), mimeType, file.size(), storedName)
                ),
                file.bytes()
            ));
        }

        try {
            Files.createDirectories(repository.attachmentRoot());
        } catch (IOException error) {
            throw new JsonStoreException(repository.attachmentRoot(), error);
        }
        List<Path> written = new ArrayList<>();
        try {
            for (PendingAttachment item : pending) {
                Path path = attachmentPath(item.entry().storedName());
                Files.write(path, item.bytes(), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
                written.add(path);
            }
        } catch (IOException error) {
            written.forEach(ImprovementService::deleteQuietly);
            throw new JsonStoreException(repository.attachmentRoot(), error);
        }
        return pending.stream().map(PendingAttachment::entry).toList();
    }

    private ObjectNode attachmentNode(
        String id,
        String originalName,
        String mimeType,
        long size,
        String storedName
    ) {
        ObjectNode node = repository.store().mapper().createObjectNode();
        node.put("id", id);
        node.put("name", safeAttachmentName(originalName));
        node.put("mimeType", mimeType);
        node.put("size", size);
        node.put("storedName", storedName);
        return node;
    }

    private List<AttachmentEntry> attachmentsFor(JsonNode item) {
        List<AttachmentEntry> result = new ArrayList<>();
        JsonNode values = item.path("attachments");
        if (!values.isArray()) return result;
        for (JsonNode value : values) {
            if (!value.isObject() || !value.path("id").isString()
                || !value.path("name").isString() || !value.path("storedName").isString()
                || !value.path("size").isNumber()
                || !ATTACHMENT_MIME_TYPES.contains(value.path("mimeType").asString())) continue;
            result.add(new AttachmentEntry(
                value.path("id").asString(), value.path("name").asString(),
                value.path("mimeType").asString(), value.path("size").longValue(),
                value.path("storedName").asString(), (ObjectNode) value.deepCopy()
            ));
        }
        return result;
    }

    private void deleteAttachments(JsonNode item) {
        for (AttachmentEntry attachment : attachmentsFor(item)) {
            try {
                deleteQuietly(attachmentPath(attachment.storedName()));
            } catch (RuntimeException ignored) {
                // A retenção continua para os demais anexos, conforme o contrato histórico.
            }
        }
    }

    private Path attachmentPath(String storedName) {
        try {
            Path root = repository.attachmentRoot().toAbsolutePath().normalize();
            Path resolved = root.resolve(storedName).toAbsolutePath().normalize();
            if (resolved.equals(root) || !resolved.startsWith(root)) {
                throw new ApiException(404, "Anexo não encontrado.");
            }
            return resolved;
        } catch (InvalidPathException error) {
            throw new ApiException(404, "Anexo não encontrado.");
        }
    }

    private static String detectAttachmentMime(String originalName, byte[] buffer) {
        String extension = extension(originalName);
        if (extension.equals(".png") && hasPrefix(buffer, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
        if ((extension.equals(".jpg") || extension.equals(".jpeg")) && hasPrefix(buffer, 0xff, 0xd8, 0xff)) return "image/jpeg";
        if (extension.equals(".webp") && ascii(buffer, 0, 4).equals("RIFF") && ascii(buffer, 8, 4).equals("WEBP")) return "image/webp";
        if (extension.equals(".avif") && ascii(buffer, 4, 4).equals("ftyp") && Set.of("avif", "avis").contains(ascii(buffer, 8, 4))) return "image/avif";
        if (extension.equals(".xls") && hasPrefix(buffer, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return "application/vnd.ms-excel";
        if (extension.equals(".xlsx") && hasPrefix(buffer, 0x50, 0x4b, 0x03, 0x04)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (extension.equals(".csv") && buffer.length > 0 && !containsZero(buffer)) return "text/csv";
        return null;
    }

    private static boolean hasPrefix(byte[] buffer, int... prefix) {
        if (buffer.length < prefix.length) return false;
        for (int index = 0; index < prefix.length; index++) {
            if ((buffer[index] & 0xff) != prefix[index]) return false;
        }
        return true;
    }

    private static String ascii(byte[] buffer, int offset, int length) {
        if (offset < 0 || buffer.length < offset + length) return "";
        return new String(buffer, offset, length, java.nio.charset.StandardCharsets.US_ASCII);
    }

    private static boolean containsZero(byte[] buffer) {
        for (byte value : buffer) if (value == 0) return true;
        return false;
    }

    private static String extension(String value) {
        String basename = basename(value).toLowerCase(Locale.ROOT);
        int dot = basename.lastIndexOf('.');
        return dot < 0 ? "" : basename.substring(dot);
    }

    private static String extensionForMime(String mimeType) {
        return switch (mimeType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/avif" -> ".avif";
            case "text/csv" -> ".csv";
            case "application/vnd.ms-excel" -> ".xls";
            default -> ".xlsx";
        };
    }

    private static String safeAttachmentName(String value) {
        String normalized = basename(value)
            .replaceAll("[\\\\/:*?\"<>|\\x00-\\x1F]", " ")
            .replaceAll("\\s+", " ")
            .trim();
        normalized = Sanitizers.text(normalized, 150);
        return normalized.isEmpty() ? "anexo" : normalized;
    }

    private static String basename(String value) {
        String source = value == null ? "" : value;
        int index = Math.max(source.lastIndexOf('/'), source.lastIndexOf('\\'));
        return index < 0 ? source : source.substring(index + 1);
    }

    private static boolean dateIsOlderThan(String value, Instant now) {
        try {
            long timestamp = Instant.parse(value).toEpochMilli();
            return now.toEpochMilli() - timestamp >= RETENTION_MILLIS;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String firstDate(ObjectNode item, String first, String second) {
        JsonNode preferred = item.get(first);
        return preferred == null || preferred.isNull()
            ? item.path(second).asString()
            : preferred.asString();
    }

    private static int indexOf(ArrayNode items, String id) {
        for (int index = 0; index < items.size(); index++) {
            if (items.get(index).path("id").asString().equals(id)) return index;
        }
        return -1;
    }

    private static void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // A limpeza segue o comportamento tolerante do baseline.
        }
    }

    private record AttachmentEntry(
        String id,
        String name,
        String mimeType,
        long size,
        String storedName,
        ObjectNode node
    ) {
    }

    private record PendingAttachment(AttachmentEntry entry, byte[] bytes) {
    }
}
