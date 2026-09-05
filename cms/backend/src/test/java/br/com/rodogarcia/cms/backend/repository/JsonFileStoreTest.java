package br.com.rodogarcia.cms.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import br.com.rodogarcia.cms.backend.exception.JsonStoreException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class JsonFileStoreTest {

    @TempDir
    Path root;

    private final JsonMapper mapper = JsonMapper.builder().build();
    private final JsonFileStore store = new JsonFileStore(mapper);

    @Test
    void readsBomUsesMissingDefaultsAndPreservesInvalidJson() throws Exception {
        Path missing = root.resolve("missing.json");
        ObjectNode defaultValue = mapper.createObjectNode().put("default", true);
        ObjectNode first = (ObjectNode) store.read(missing, defaultValue);
        first.put("changed", true);
        assertThat(store.read(missing, defaultValue).has("changed")).isFalse();

        Path bom = root.resolve("bom.json");
        Files.writeString(bom, "\uFEFF{\"ok\":true}", StandardCharsets.UTF_8);
        assertThat(store.readObject(bom).path("ok").asBoolean()).isTrue();

        Path invalid = root.resolve("invalid.json");
        Files.writeString(invalid, "{", StandardCharsets.UTF_8);
        assertThatThrownBy(() -> store.readObject(invalid))
            .isInstanceOf(JsonStoreException.class);

        Path empty = root.resolve("empty.json");
        Files.writeString(empty, "", StandardCharsets.UTF_8);
        assertThatThrownBy(() -> store.readObject(empty))
            .isInstanceOf(JsonStoreException.class);
        try (var files = Files.list(root)) {
            assertThat(files.map(path -> path.getFileName().toString()).toList())
                .anyMatch(name -> name.matches("\\.invalid\\.json\\.invalid-\\d+\\.json"))
                .anyMatch(name -> name.matches("\\.empty\\.json\\.invalid-\\d+\\.json"));
        }
    }

    @Test
    void decodesMalformedUtf8WithReplacementLikeNodeBufferBeforeParsing() throws Exception {
        Path file = root.resolve("replacement.json");
        Files.write(file, new byte[] {
            '{', '"', 'v', 'a', 'l', 'u', 'e', '"', ':', '"', (byte) 0xc3, '"', '}'
        });

        assertThat(store.readObject(file).path("value").asString()).isEqualTo("\uFFFD");
        try (var files = Files.list(root)) {
            assertThat(files.map(path -> path.getFileName().toString()).toList())
                .noneMatch(name -> name.startsWith(".replacement.json.invalid-"));
        }
    }

    @Test
    void writesTheCommonJsonStringifyLayoutWithoutBomOrTrailingNewline() throws Exception {
        Path file = root.resolve("layout.json");
        ObjectNode value = mapper.createObjectNode();
        value.put("name", "Rodogarcia");
        value.put("enabled", true);
        value.putArray("items").add(1).addNull();

        store.write(file, value);

        assertThat(Files.readAllBytes(file)).startsWith((byte) '{');
        assertThat(Files.readString(file, StandardCharsets.UTF_8)).isEqualTo("""
            {
              "name": "Rodogarcia",
              "enabled": true,
              "items": [
                1,
                null
              ]
            }""");
    }

    @Test
    void failsClosedForAValidJsonRootWithTheWrongCollectionShape() throws Exception {
        Path collection = root.resolve("events.json");
        Files.writeString(collection, "{}", StandardCharsets.UTF_8);

        assertThatThrownBy(() -> store.readArray(collection))
            .isInstanceOf(JsonStoreException.class);
        try (var files = Files.list(root)) {
            assertThat(files.map(path -> path.getFileName().toString()).toList())
                .doesNotContain(".events.json.invalid-0.json")
                .noneMatch(name -> name.startsWith(".events.json.invalid-"));
        }
    }

    @Test
    void serializesConcurrentCollectionMutationsWithoutLostUpdates() throws Exception {
        Path file = root.resolve("events.json");
        JsonCollections collections = new JsonCollections(store);
        int writers = 8;
        int writesPerWorker = 40;
        var executor = Executors.newFixedThreadPool(writers);
        try {
            for (int worker = 0; worker < writers; worker++) {
                int workerId = worker;
                executor.submit(() -> {
                    for (int item = 0; item < writesPerWorker; item++) {
                        int value = item;
                        collections.mutate(file, entries -> {
                            entries.add(workerId + "-" + value);
                            return null;
                        });
                    }
                });
            }
        } finally {
            executor.shutdown();
            assertThat(executor.awaitTermination(20, TimeUnit.SECONDS)).isTrue();
        }

        ArrayNode persisted = store.readArray(file);
        assertThat(persisted).hasSize(writers * writesPerWorker);
        assertThat(Files.readString(file)).doesNotEndWith("\n");
    }

    @Test
    void computesATransactionSnapshotOnlyAfterLockingEveryDeclaredStore() throws Exception {
        Path first = root.resolve("first.json");
        Path second = root.resolve("second.json");
        Path journal = root.resolve("transaction.json");
        store.write(first, mapper.createObjectNode().put("value", "initial"));
        store.write(second, mapper.createObjectNode().put("value", "initial"));
        CountDownLatch snapshotStarted = new CountDownLatch(1);
        CountDownLatch releaseSnapshot = new CountDownLatch(1);
        CountDownLatch concurrentWriteStarted = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var transaction = executor.submit(() -> store.writeTransaction(
                List.of(first, second),
                journal,
                () -> {
                    snapshotStarted.countDown();
                    await(releaseSnapshot);
                    Map<Path, JsonNode> updates = new LinkedHashMap<>();
                    updates.put(first, store.readObject(first).put("transaction", true));
                    updates.put(second, store.readObject(second).put("transaction", true));
                    return updates;
                }
            ));
            assertThat(snapshotStarted.await(5, TimeUnit.SECONDS)).isTrue();

            var concurrentWrite = executor.submit(() -> {
                concurrentWriteStarted.countDown();
                store.write(first, mapper.createObjectNode().put("value", "concurrent"));
            });
            assertThat(concurrentWriteStarted.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(concurrentWrite.isDone()).isFalse();
            releaseSnapshot.countDown();
            transaction.get(5, TimeUnit.SECONDS);
            concurrentWrite.get(5, TimeUnit.SECONDS);
        } finally {
            releaseSnapshot.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }

        assertThat(store.readObject(first).path("value").asString()).isEqualTo("concurrent");
        assertThat(store.readObject(second).path("transaction").asBoolean()).isTrue();
        assertThat(journal).doesNotExist();
    }

    @Test
    void rejectsTransactionPathsThatCollapseToTheSameNormalizedFile() {
        Path file = root.resolve("same.json");
        Map<Path, JsonNode> entries = new LinkedHashMap<>();
        entries.put(file, mapper.createObjectNode().put("value", 1));
        entries.put(root.resolve("child/../same.json"), mapper.createObjectNode().put("value", 2));

        assertThatThrownBy(() -> store.writeTransaction(entries, root.resolve("transaction.json")))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("duplicados");
    }

    @Test
    void rollsBackPreparedTransactionsForExistingAndNewTargets() throws Exception {
        Path existing = root.resolve("existing.json");
        Path existingTemporary = root.resolve(".existing.json.tx.tmp");
        Path existingBackup = root.resolve(".existing.json.tx.bak");
        Path created = root.resolve("created.json");
        Path createdTemporary = root.resolve(".created.json.tx.tmp");
        Path createdBackup = root.resolve(".created.json.tx.bak");
        Path journal = root.resolve("transaction.json");
        Files.writeString(existing, "{\"value\":\"old\"}");
        Files.writeString(existingTemporary, "{\"value\":\"new\"}");
        Files.writeString(created, "{\"value\":\"partial\"}");
        Files.writeString(createdTemporary, "{\"value\":\"new\"}");
        ObjectNode state = mapper.createObjectNode().put("phase", "prepared");
        ArrayNode entries = state.putArray("entries");
        addJournalEntry(entries, existing, existingTemporary, existingBackup, true);
        addJournalEntry(entries, created, createdTemporary, createdBackup, false);
        store.write(journal, state);

        store.recoverTransaction(journal);

        assertThat(store.readObject(existing).path("value").asString()).isEqualTo("old");
        assertThat(created).doesNotExist();
        assertThat(List.of(journal, existingTemporary, existingBackup, createdTemporary, createdBackup))
            .allMatch(path -> !Files.exists(path));
    }

    @Test
    void rollsBackAnInterruptedMultiStoreCommitAndCleansItsArtifacts() throws Exception {
        Path file = root.resolve("content.json");
        Path temporary = root.resolve(".content.json.tx.tmp");
        Path backup = root.resolve(".content.json.tx.bak");
        Path journal = root.resolve("transaction.json");
        Files.writeString(file, "{\"value\":\"new\"}");
        Files.writeString(temporary, "{\"value\":\"staged\"}");
        Files.writeString(backup, "{\"value\":\"old\"}");
        store.write(journal, journal("committing", file, temporary, backup, true));

        store.recoverTransaction(journal);

        assertThat(store.readObject(file).path("value").asString()).isEqualTo("old");
        assertThat(List.of(journal, temporary, backup)).allMatch(path -> !Files.exists(path));
    }

    @Test
    void rollsBackEveryPartiallyCommittedEntryInReverseOrder() throws Exception {
        Path first = root.resolve("first.json");
        Path firstTemporary = root.resolve(".first.json.tx.tmp");
        Path firstBackup = root.resolve(".first.json.tx.bak");
        Path second = root.resolve("second.json");
        Path secondTemporary = root.resolve(".second.json.tx.tmp");
        Path secondBackup = root.resolve(".second.json.tx.bak");
        Path created = root.resolve("created.json");
        Path createdTemporary = root.resolve(".created.json.tx.tmp");
        Path createdBackup = root.resolve(".created.json.tx.bak");
        Path journal = root.resolve("transaction.json");
        Files.writeString(first, "{\"value\":\"new\"}");
        Files.writeString(firstBackup, "{\"value\":\"old-first\"}");
        Files.writeString(second, "{\"value\":\"old-second\"}");
        Files.writeString(secondTemporary, "{\"value\":\"new\"}");
        Files.writeString(created, "{\"value\":\"new\"}");
        ObjectNode state = mapper.createObjectNode().put("phase", "committing");
        ArrayNode entries = state.putArray("entries");
        addJournalEntry(entries, first, firstTemporary, firstBackup, true);
        addJournalEntry(entries, second, secondTemporary, secondBackup, true);
        addJournalEntry(entries, created, createdTemporary, createdBackup, false);
        store.write(journal, state);

        store.recoverTransaction(journal);

        assertThat(store.readObject(first).path("value").asString()).isEqualTo("old-first");
        assertThat(store.readObject(second).path("value").asString()).isEqualTo("old-second");
        assertThat(created).doesNotExist();
        assertThat(List.of(journal, firstTemporary, firstBackup, secondTemporary,
            secondBackup, createdTemporary, createdBackup))
            .allMatch(path -> !Files.exists(path));
    }

    @Test
    void keepsCommittedFilesAndOnlyCleansTransactionArtifacts() throws Exception {
        Path file = root.resolve("content.json");
        Path temporary = root.resolve(".content.json.tx.tmp");
        Path backup = root.resolve(".content.json.tx.bak");
        Path journal = root.resolve("transaction.json");
        Files.writeString(file, "{\"value\":\"new\"}");
        Files.writeString(temporary, "{\"value\":\"staged\"}");
        Files.writeString(backup, "{\"value\":\"old\"}");
        store.write(journal, journal("committed", file, temporary, backup, true));

        store.recoverTransaction(journal);

        assertThat(store.readObject(file).path("value").asString()).isEqualTo("new");
        assertThat(List.of(journal, temporary, backup)).allMatch(path -> !Files.exists(path));
    }

    @Test
    void malformedJournalEntryFailsClosedWithoutDeletingTheJournal() throws Exception {
        Path journal = root.resolve("transaction.json");
        ObjectNode invalid = mapper.createObjectNode().put("phase", "committing");
        invalid.putArray("entries").addObject().put("hadOriginal", false);
        store.write(journal, invalid);

        assertThatThrownBy(() -> store.recoverTransaction(journal))
            .isInstanceOf(JsonStoreException.class)
            .hasMessageContaining("transaction.json");
        assertThat(journal).exists();
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Timeout aguardando o teste concorrente.");
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(error);
        }
    }

    private ObjectNode journal(
        String phase,
        Path file,
        Path temporary,
        Path backup,
        boolean hadOriginal
    ) {
        ObjectNode journal = mapper.createObjectNode().put("phase", phase);
        addJournalEntry(journal.putArray("entries"), file, temporary, backup, hadOriginal);
        return journal;
    }

    private static void addJournalEntry(
        ArrayNode entries,
        Path file,
        Path temporary,
        Path backup,
        boolean hadOriginal
    ) {
        ObjectNode entry = entries.addObject();
        entry.put("filePath", file.toString());
        entry.put("tempPath", temporary.toString());
        entry.put("backupPath", backup.toString());
        entry.put("hadOriginal", hadOriginal);
    }
}
