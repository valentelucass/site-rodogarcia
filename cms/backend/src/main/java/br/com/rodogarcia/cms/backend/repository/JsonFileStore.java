package br.com.rodogarcia.cms.backend.repository;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Supplier;

import br.com.rodogarcia.cms.backend.exception.JsonStoreException;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.core.util.DefaultIndenter;
import tools.jackson.core.util.DefaultPrettyPrinter;
import tools.jackson.core.util.Separators;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class JsonFileStore {

    private final JsonMapper mapper;
    private final Map<Path, ReentrantReadWriteLock> locks = new ConcurrentHashMap<>();
    private final java.util.concurrent.locks.ReentrantLock writeCoordinator =
        new java.util.concurrent.locks.ReentrantLock();

    public JsonFileStore(JsonMapper mapper) {
        this.mapper = mapper;
    }

    public JsonMapper mapper() {
        return mapper;
    }

    public JsonNode read(Path path, JsonNode defaultValue) {
        Path normalized = normalize(path);
        ReentrantReadWriteLock.ReadLock lock = lockFor(normalized).readLock();
        lock.lock();
        try {
            return readUnlocked(normalized, defaultValue);
        } finally {
            lock.unlock();
        }
    }

    public ArrayNode readArray(Path path) {
        JsonNode value = read(path, mapper.createArrayNode());
        if (!value.isArray()) {
            throw new JsonStoreException(
                normalize(path),
                new IllegalStateException("A raiz do armazenamento deveria ser uma lista JSON.")
            );
        }
        return (ArrayNode) value;
    }

    public ObjectNode readObject(Path path) {
        JsonNode value = read(path, mapper.createObjectNode());
        return value.isObject() ? (ObjectNode) value : mapper.createObjectNode();
    }

    public void write(Path path, Object value) {
        Path normalized = normalize(path);
        withWriteLock(
            List.of(normalized),
            () -> writeUnlocked(normalized, mapper.valueToTree(value))
        );
    }

    public <T> T withWriteLock(Collection<Path> paths, Supplier<T> operation) {
        writeCoordinator.lock();
        try {
            List<ReentrantReadWriteLock.WriteLock> acquired = paths.stream()
                .map(JsonFileStore::normalize)
                .distinct()
                .sorted(Comparator.comparing(Path::toString))
                .map(path -> lockFor(path).writeLock())
                .toList();
            acquired.forEach(ReentrantReadWriteLock.WriteLock::lock);
            try {
                return operation.get();
            } finally {
                for (int index = acquired.size() - 1; index >= 0; index--) {
                    acquired.get(index).unlock();
                }
            }
        } finally {
            writeCoordinator.unlock();
        }
    }

    public void withWriteLock(Collection<Path> paths, Runnable operation) {
        withWriteLock(paths, () -> {
            operation.run();
            return null;
        });
    }

    public void writeTransaction(Map<Path, ? extends JsonNode> entries, Path journalPath) {
        if (entries.isEmpty()) return;
        LinkedHashMap<Path, JsonNode> normalized = normalizeEntries(entries);
        writeTransaction(
            normalized.keySet(),
            journalPath,
            () -> normalized
        );
    }

    /**
     * Calcula o snapshot da transação somente depois de adquirir todos os locks.
     * Isso impede que uma atualização concorrente aconteça entre a leitura dos
     * stores relacionados e a criação do journal.
     */
    public void writeTransaction(
        Collection<Path> paths,
        Path journalPath,
        Supplier<? extends Map<Path, ? extends JsonNode>> entriesSupplier
    ) {
        Path normalizedJournal = normalize(journalPath);
        List<Path> expectedPaths = paths.stream().map(JsonFileStore::normalize).distinct().toList();
        if (expectedPaths.contains(normalizedJournal)) {
            throw new IllegalArgumentException("O journal não pode ser um arquivo de dados da transação.");
        }

        writeCoordinator.lock();
        try {
            recoverTransaction(normalizedJournal);
            List<Path> lockedPaths = new ArrayList<>(expectedPaths);
            lockedPaths.add(normalizedJournal);
            withWriteLock(lockedPaths, () -> {
                Map<Path, ? extends JsonNode> supplied = entriesSupplier.get();
                if (supplied == null || supplied.isEmpty()) return;
                LinkedHashMap<Path, JsonNode> normalizedEntries = normalizeEntries(supplied);
                if (!Set.copyOf(expectedPaths).containsAll(normalizedEntries.keySet())) {
                    throw new IllegalArgumentException(
                        "A transação JSON tentou gravar um caminho sem lock."
                    );
                }
                writeTransactionUnlocked(normalizedEntries, normalizedJournal);
            });
        } finally {
            writeCoordinator.unlock();
        }
    }

    public void recoverTransaction(Path journalPath) {
        Path normalizedJournal = normalize(journalPath);
        writeCoordinator.lock();
        try {
            if (!Files.exists(normalizedJournal)) return;
            JsonNode journal = read(normalizedJournal, mapper.createObjectNode());
            List<Path> lockedPaths = transactionArtifactPaths(journal, normalizedJournal);
            lockedPaths.add(normalizedJournal);
            withWriteLock(lockedPaths, () -> recoverTransactionUnlocked(normalizedJournal));
        } finally {
            writeCoordinator.unlock();
        }
    }

    private JsonNode readUnlocked(Path path, JsonNode defaultValue) {
        try {
            // Buffer.toString("utf8"), usado pelo Node, substitui sequências UTF-8
            // inválidas em vez de falhar antes do JSON.parse.
            String raw = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
            if (!raw.isEmpty() && raw.charAt(0) == '\uFEFF') raw = raw.substring(1);
            JsonNode parsed = mapper.readTree(raw);
            if (parsed == null || parsed.isMissingNode()) {
                preserveInvalid(path);
                throw new JsonStoreException(path, new IllegalArgumentException("JSON vazio."));
            }
            return parsed;
        } catch (NoSuchFileException ignored) {
            return defaultValue.deepCopy();
        } catch (JacksonException error) {
            preserveInvalid(path);
            throw new JsonStoreException(path, error);
        } catch (IOException error) {
            throw new JsonStoreException(path, error);
        }
    }

    private void writeUnlocked(Path path, JsonNode value) {
        Path directory = path.getParent();
        Path temporary = directory.resolve(
            "." + path.getFileName() + "." + ProcessHandle.current().pid()
                + "." + System.currentTimeMillis() + ".tmp"
        );
        try {
            Files.createDirectories(directory);
            Files.write(temporary, serialize(value));
            moveReplacing(temporary, path);
        } catch (IOException | JacksonException error) {
            tryDelete(temporary);
            throw new JsonStoreException(path, error);
        }
    }

    private byte[] serialize(JsonNode value) throws JacksonException {
        DefaultIndenter indenter = new DefaultIndenter("  ", "\n");
        Separators separators = Separators.createDefaultInstance()
            .withObjectNameValueSpacing(Separators.Spacing.AFTER);
        DefaultPrettyPrinter printer = new DefaultPrettyPrinter(separators)
            .withObjectIndenter(indenter)
            .withArrayIndenter(indenter);
        return mapper.writer().with(printer).writeValueAsBytes(value);
    }

    private void writeTransactionUnlocked(Map<Path, ? extends JsonNode> entries, Path journalPath) {
        String id = ProcessHandle.current().pid() + "-" + System.currentTimeMillis() + "-" + UUID.randomUUID();
        ObjectNode journal = mapper.createObjectNode();
        journal.put("phase", "prepared");
        ArrayNode journalEntries = journal.putArray("entries");
        List<TransactionEntry> prepared = new ArrayList<>();
        for (Map.Entry<Path, ? extends JsonNode> source : entries.entrySet()) {
            Path file = normalize(source.getKey());
            Path directory = file.getParent();
            String base = file.getFileName().toString();
            TransactionEntry entry = new TransactionEntry(
                file,
                directory.resolve("." + base + "." + id + ".tmp"),
                directory.resolve("." + base + "." + id + ".bak"),
                Files.exists(file),
                source.getValue()
            );
            prepared.add(entry);
            ObjectNode serialized = journalEntries.addObject();
            serialized.put("filePath", entry.file().toString());
            serialized.put("tempPath", entry.temporary().toString());
            serialized.put("backupPath", entry.backup().toString());
            serialized.put("hadOriginal", entry.hadOriginal());
        }
        try {
            writeUnlocked(journalPath, journal);
            for (TransactionEntry entry : prepared) {
                Files.createDirectories(entry.file().getParent());
                Files.write(entry.temporary(), serialize(entry.value()));
            }
            journal.put("phase", "committing");
            writeUnlocked(journalPath, journal);
            for (TransactionEntry entry : prepared) {
                if (entry.hadOriginal()) moveReplacing(entry.file(), entry.backup());
                moveReplacing(entry.temporary(), entry.file());
            }
            journal.put("phase", "committed");
            writeUnlocked(journalPath, journal);
            recoverTransactionUnlocked(journalPath);
        } catch (IOException | JacksonException error) {
            recoverTransactionUnlocked(journalPath);
            throw new JsonStoreException(journalPath, error);
        } catch (RuntimeException error) {
            recoverTransactionUnlocked(journalPath);
            throw error;
        }
    }

    private void recoverTransactionUnlocked(Path journalPath) {
        if (!Files.exists(journalPath)) return;
        JsonNode journal = readUnlocked(journalPath, mapper.createObjectNode());
        JsonNode entries = journal.path("entries");
        if (!entries.isArray()) {
            tryDelete(journalPath);
            return;
        }
        boolean committed = "committed".equals(journal.path("phase").asString());
        List<RecoveryEntry> values = recoveryEntries(entries, journalPath);
        if (!committed) java.util.Collections.reverse(values);
        for (RecoveryEntry value : values) {
            Path file = value.file();
            Path temporary = value.temporary();
            Path backup = value.backup();
            boolean hadOriginal = value.hadOriginal();
            try {
                if (!committed) {
                    if (Files.exists(backup)) {
                        tryDelete(file);
                        moveReplacing(backup, file);
                    } else if (!hadOriginal) {
                        tryDelete(file);
                    }
                }
            } catch (IOException error) {
                throw new JsonStoreException(journalPath, error);
            }
            tryDelete(temporary);
            tryDelete(backup);
        }
        tryDelete(journalPath);
    }

    private LinkedHashMap<Path, JsonNode> normalizeEntries(
        Map<Path, ? extends JsonNode> entries
    ) {
        LinkedHashMap<Path, JsonNode> normalized = new LinkedHashMap<>();
        for (Map.Entry<Path, ? extends JsonNode> entry : entries.entrySet()) {
            Path path = normalize(entry.getKey());
            if (normalized.containsKey(path)) {
                throw new IllegalArgumentException("A transação JSON contém caminhos duplicados.");
            }
            normalized.put(path, entry.getValue() == null ? mapper.nullNode() : entry.getValue());
        }
        return normalized;
    }

    private List<Path> transactionArtifactPaths(JsonNode journal, Path journalPath) {
        JsonNode entries = journal.path("entries");
        if (!entries.isArray()) return new ArrayList<>();
        List<Path> result = new ArrayList<>();
        for (RecoveryEntry entry : recoveryEntries(entries, journalPath)) {
            result.add(entry.file());
            result.add(entry.temporary());
            result.add(entry.backup());
        }
        return result;
    }

    private List<RecoveryEntry> recoveryEntries(JsonNode entries, Path journalPath) {
        List<RecoveryEntry> result = new ArrayList<>();
        for (JsonNode value : entries) {
            if (!value.isObject()
                || !value.path("filePath").isString()
                || value.path("filePath").asString().isEmpty()
                || !value.path("tempPath").isString()
                || value.path("tempPath").asString().isEmpty()
                || !value.path("backupPath").isString()
                || value.path("backupPath").asString().isEmpty()
                || !value.path("hadOriginal").isBoolean()) {
                throw invalidJournal(journalPath);
            }
            try {
                result.add(new RecoveryEntry(
                    normalize(Path.of(value.path("filePath").asString())),
                    normalize(Path.of(value.path("tempPath").asString())),
                    normalize(Path.of(value.path("backupPath").asString())),
                    value.path("hadOriginal").asBoolean()
                ));
            } catch (RuntimeException error) {
                throw new JsonStoreException(journalPath, error);
            }
        }
        return result;
    }

    private static JsonStoreException invalidJournal(Path journalPath) {
        return new JsonStoreException(
            journalPath,
            new IllegalArgumentException("Journal de transação JSON inválido.")
        );
    }

    private ReentrantReadWriteLock lockFor(Path path) {
        return locks.computeIfAbsent(path, ignored -> new ReentrantReadWriteLock());
    }

    private static Path normalize(Path path) {
        return path.toAbsolutePath().normalize();
    }

    private static void moveReplacing(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void preserveInvalid(Path path) {
        Path backup = path.getParent().resolve(
            "." + path.getFileName() + ".invalid-" + System.currentTimeMillis() + ".json"
        );
        try {
            Files.copy(path, backup);
        } catch (IOException ignored) {
            // A leitura continua falhando fechada mesmo se a cópia não puder ser preservada.
        }
    }

    private static void tryDelete(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // A recuperação continua para os demais artefatos.
        }
    }

    private record TransactionEntry(
        Path file,
        Path temporary,
        Path backup,
        boolean hadOriginal,
        JsonNode value
    ) {
    }

    private record RecoveryEntry(
        Path file,
        Path temporary,
        Path backup,
        boolean hadOriginal
    ) {
    }
}
