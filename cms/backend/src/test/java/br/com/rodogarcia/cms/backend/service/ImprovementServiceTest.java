package br.com.rodogarcia.cms.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.improvement.ImprovementInput;
import br.com.rodogarcia.cms.backend.model.improvement.ImprovementUpload;
import br.com.rodogarcia.cms.backend.support.MediaTestContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class ImprovementServiceTest {
    private static final Instant NOW = Instant.parse("2026-03-02T00:00:00.000Z");

    @TempDir
    Path root;

    @Test
    void persistsValidatedAttachmentAndNormalizesProfileSpecificFields() throws Exception {
        MediaTestContext context = context();
        ObjectNode created = context.improvements.create(
            input("site_user"),
            List.of(new ImprovementUpload(
                "../evidência.csv",
                "coluna,valor\nstatus,ok".getBytes(StandardCharsets.UTF_8)
            ))
        );

        assertThat(created.path("id").asString()).matches("improvement_[0-9a-f]{32}");
        assertThat(created.path("phone").asString()).isEmpty();
        assertThat(created.path("branch").asString()).isEmpty();
        assertThat(created.path("page").asString()).isEqualTo("/cotacao");
        ObjectNode attachment = (ObjectNode) created.path("attachments").get(0);
        assertThat(attachment.path("id").asString()).matches("attachment_[0-9a-f]{32}");
        assertThat(attachment.path("name").asString()).isEqualTo("evidência.csv");
        assertThat(attachment.path("mimeType").asString()).isEqualTo("text/csv");
        assertThat(Files.readString(
            context.properties.storagePaths().improvementAttachments()
                .resolve(attachment.path("storedName").asString())
        )).contains("status,ok");
    }

    @Test
    void rejectsSpoofedAttachmentsBeforeWriting() {
        MediaTestContext context = context();
        assertThatThrownBy(() -> context.improvements.create(
            input("employee"),
            List.of(new ImprovementUpload("fake.png", "not png".getBytes(StandardCharsets.UTF_8)))
        ))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("PNG, JPG, WebP ou AVIF");
        assertThat(context.improvements.list("")).isEmpty();
    }

    @Test
    void archivesCompletedAndDeletesArchivedRecordsAndAttachmentsAtSixtyDays() throws Exception {
        MediaTestContext context = context();
        Path attachments = context.properties.storagePaths().improvementAttachments();
        Files.createDirectories(attachments);
        Files.writeString(attachments.resolve("attachment_old.csv"), "old");
        ArrayNode records = context.mapper.createArrayNode();
        records.addObject()
            .put("id", "done")
            .put("status", "completed")
            .put("completedAt", "2026-01-01T00:00:00.000Z")
            .put("updatedAt", "2026-01-01T00:00:00.000Z");
        ObjectNode archived = records.addObject()
            .put("id", "old")
            .put("status", "archived")
            .put("archivedAt", "2026-01-01T00:00:00.000Z")
            .put("updatedAt", "2026-01-01T00:00:00.000Z");
        archived.putArray("attachments").addObject()
            .put("id", "attachment_old")
            .put("name", "old.csv")
            .put("mimeType", "text/csv")
            .put("size", 3)
            .put("storedName", "attachment_old.csv");
        context.store.write(context.properties.storagePaths().improvements(), records);

        context.improvements.runRetention(NOW);

        ArrayNode retained = context.store.readArray(context.properties.storagePaths().improvements());
        assertThat(retained).hasSize(1);
        assertThat(retained.get(0).path("status").asString()).isEqualTo("archived");
        assertThat(retained.get(0).path("archivedAt").asString()).isEqualTo("2026-03-02T00:00:00.000Z");
        assertThat(attachments.resolve("attachment_old.csv")).doesNotExist();
    }

    @Test
    void continuesDeletingRemainingAttachmentsWhenOneDeletionFails() throws Exception {
        MediaTestContext context = context();
        Path attachments = context.properties.storagePaths().improvementAttachments();
        Path undeletableDirectory = attachments.resolve("attachment_directory");
        Files.createDirectories(undeletableDirectory);
        Files.writeString(undeletableDirectory.resolve("child.txt"), "keeps directory non-empty");
        Files.writeString(attachments.resolve("attachment_deletable.csv"), "delete me");

        ArrayNode records = context.mapper.createArrayNode();
        ObjectNode archived = records.addObject()
            .put("id", "old")
            .put("status", "archived")
            .put("archivedAt", "2026-01-01T00:00:00.000Z")
            .put("updatedAt", "2026-01-01T00:00:00.000Z");
        archived.putArray("attachments")
            .add(attachment(context, "blocked", "attachment_directory"))
            .add(attachment(context, "deletable", "attachment_deletable.csv"));
        context.store.write(context.properties.storagePaths().improvements(), records);

        context.improvements.runRetention(NOW);

        assertThat(context.store.readArray(context.properties.storagePaths().improvements())).isEmpty();
        assertThat(undeletableDirectory).exists();
        assertThat(attachments.resolve("attachment_deletable.csv")).doesNotExist();
    }

    private MediaTestContext context() {
        return new MediaTestContext(root, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static ObjectNode attachment(
        MediaTestContext context,
        String id,
        String storedName
    ) {
        return context.mapper.createObjectNode()
            .put("id", id)
            .put("name", storedName)
            .put("mimeType", "text/csv")
            .put("size", 3)
            .put("storedName", storedName);
    }

    private static ImprovementInput input(String profile) {
        return new ImprovementInput(
            profile,
            "Ana Silva",
            "ana@example.com",
            "11999990000",
            profile.equals("site_user") ? "site_suggestion" : "automation",
            "O formulário poderia explicar melhor o próximo passo.",
            "/cotacao",
            "Osasco/SP",
            "Operação",
            "Mais clareza",
            "Portal"
        );
    }
}
