package br.com.rodogarcia.cms.backend.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CmsReadinessServiceTest {

    @TempDir
    Path root;

    @Test
    void acceptsMissingStoresWhenTheirParentsCanCreateAndReplaceThem() throws IOException {
        CmsProperties properties = developmentProperties(Map.of());
        prepareRequiredDirectories(properties);

        assertThat(new CmsReadinessService(properties).isReady()).isTrue();
        try (var files = Files.list(properties.storageRoot())) {
            assertThat(files.filter(path -> path.getFileName().toString()
                .startsWith(".cms-readiness-"))).isEmpty();
        }
    }

    @Test
    void deduplicatesWriteProbesAndFailsClosedWhenARealProbeFails() throws IOException {
        CmsProperties properties = developmentProperties(Map.of());
        prepareRequiredDirectories(properties);
        List<Path> probed = new ArrayList<>();

        CmsReadinessService successful = new CmsReadinessService(properties, directory -> {
            probed.add(directory);
            return true;
        });

        assertThat(successful.isReady()).isTrue();
        assertThat(probed).containsExactly(properties.storageRoot().toAbsolutePath().normalize());

        CmsReadinessService failing = new CmsReadinessService(properties, directory -> false);
        assertThat(failing.isReady()).isFalse();
    }

    @Test
    void checksEveryConfiguredJsonFileTarget() throws IOException {
        CmsProperties properties = developmentProperties(Map.of());
        prepareRequiredDirectories(properties);
        CmsReadinessService readiness = new CmsReadinessService(properties);

        assertThat(properties.storagePaths().fileTargets()).hasSize(23);
        for (Path file : properties.storagePaths().fileTargets()) {
            Files.createDirectories(file);
            assertThat(readiness.isReady()).as(file.toString()).isFalse();
            Files.delete(file);
            assertThat(readiness.isReady()).as(file.toString()).isTrue();
        }
    }

    @Test
    void validatesEveryConfiguredDirectoryTarget() throws IOException {
        CmsProperties properties = developmentProperties(Map.of());
        prepareRequiredDirectories(properties);
        CmsReadinessService readiness = new CmsReadinessService(properties);

        assertThat(properties.storagePaths().directoryTargets()).hasSize(3);
        for (Path directory : properties.storagePaths().directoryTargets()) {
            if (directory.equals(properties.storageRoot())) continue;
            Files.createDirectories(directory.getParent());
            Files.writeString(directory, "not-a-directory");
            assertThat(readiness.isReady()).as(directory.toString()).isFalse();
            Files.delete(directory);
            assertThat(readiness.isReady()).as(directory.toString()).isTrue();
        }
    }

    @Test
    void rejectsInvalidStorageUploadAndPublicDirectoryShapes() throws IOException {
        CmsProperties missingRoot = developmentProperties(Map.of());
        Files.createDirectories(missingRoot.frontendPublicDir());
        assertThat(new CmsReadinessService(missingRoot).isReady()).isFalse();

        CmsProperties invalidUploads = developmentProperties(Map.of());
        prepareRequiredDirectories(invalidUploads);
        Files.writeString(invalidUploads.uploadsDir(), "not-a-directory");
        assertThat(new CmsReadinessService(invalidUploads).isReady()).isFalse();

        CmsProperties missingPublic = developmentProperties(Map.of(
            "CMS_STORAGE_ROOT", root.resolve("separate-storage").toString(),
            "FRONTEND_PUBLIC_DIR", root.resolve("missing-public").toString()
        ));
        Files.createDirectories(missingPublic.storageRoot());
        assertThat(new CmsReadinessService(missingPublic).isReady()).isFalse();
    }

    @Test
    void rejectsAProductionFfmpegThatDisappearsAfterStartupValidation() throws IOException {
        String executableName = System.getProperty("os.name", "")
            .toLowerCase(java.util.Locale.ROOT).contains("win") ? "ffmpeg.exe" : "ffmpeg";
        String probeName = System.getProperty("os.name", "")
            .toLowerCase(java.util.Locale.ROOT).contains("win") ? "ffprobe.exe" : "ffprobe";
        Path ffmpeg = root.resolve("stable-tools").resolve(executableName).toAbsolutePath();
        Path ffprobe = root.resolve("stable-tools").resolve(probeName).toAbsolutePath();
        Files.createDirectories(ffmpeg.getParent());
        Files.write(ffmpeg, new byte[] {0});
        Files.write(ffprobe, new byte[] {0});
        ffmpeg.toFile().setExecutable(true, false);
        ffprobe.toFile().setExecutable(true, false);
        assertThat(Files.isExecutable(ffmpeg)).isTrue();
        assertThat(Files.isExecutable(ffprobe)).isTrue();

        Map<String, String> environment = new LinkedHashMap<>();
        environment.put("NODE_ENV", "production");
        environment.put("FRONTEND_ORIGIN", "https://site.rodogarcia.com.br");
        environment.put("SESSION_SECRET", "session-secret-with-more-than-32-characters");
        environment.put("ADMIN_SETUP_CODE", "setup-code-2026-safe-value");
        environment.put("FFMPEG_PATH", ffmpeg.toString());
        environment.put("FFPROBE_PATH", ffprobe.toString());
        environment.put("CMS_STORAGE_ROOT", root.resolve("production-storage").toString());
        environment.put("FRONTEND_PUBLIC_DIR", root.resolve("production-public").toString());
        CmsProperties properties = CmsProperties.from(environment, projectRoot());
        prepareRequiredDirectories(properties);

        CmsReadinessService readiness = new CmsReadinessService(properties);
        assertThat(readiness.isReady()).isTrue();

        Files.delete(ffmpeg);
        assertThat(readiness.isReady()).isFalse();
    }

    private CmsProperties developmentProperties(Map<String, String> overrides) {
        Map<String, String> environment = new LinkedHashMap<>(overrides);
        environment.putIfAbsent("NODE_ENV", "development");
        environment.putIfAbsent("CMS_STORAGE_ROOT", root.resolve("storage").toString());
        environment.putIfAbsent("FRONTEND_PUBLIC_DIR", root.resolve("public").toString());
        return CmsProperties.from(environment, projectRoot());
    }

    private Path projectRoot() {
        return root.resolve("repo/cms/backend");
    }

    private static void prepareRequiredDirectories(CmsProperties properties) throws IOException {
        Files.createDirectories(properties.storageRoot());
        Files.createDirectories(properties.frontendPublicDir());
    }
}
