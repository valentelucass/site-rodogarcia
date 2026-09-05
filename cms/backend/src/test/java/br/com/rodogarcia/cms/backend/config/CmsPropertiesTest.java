package br.com.rodogarcia.cms.backend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CmsPropertiesTest {

    @TempDir
    Path root;

    @Test
    void resolvesStorageOverridesAgainstThePublicBackendAndFrontendAgainstTheRepo() {
        Path project = root.resolve("repo/cms/backend");
        Map<String, String> environment = new LinkedHashMap<>();
        environment.put("CMS_STORAGE_ROOT", "runtime/storage");
        environment.put("CMS_UPLOADS_DIR", "runtime/uploads");
        environment.put("FRONTEND_PUBLIC_DIR", "web/public");
        environment.put("CONTENT_STORE_PATH", "stores/content-v1.json");
        environment.put("USERS_STORE_PATH", "stores/users-v1.json");

        CmsProperties properties = CmsProperties.from(environment, project);
        Path repository = root.resolve("repo").toAbsolutePath().normalize();
        Path publicBackend = repository.resolve("site/backend");

        assertThat(properties.storageRoot()).isEqualTo(publicBackend.resolve("runtime/storage"));
        assertThat(properties.uploadsDir()).isEqualTo(publicBackend.resolve("runtime/uploads"));
        assertThat(properties.frontendPublicDir()).isEqualTo(repository.resolve("web/public"));
        assertThat(properties.storagePaths().content())
            .isEqualTo(publicBackend.resolve("stores/content-v1.json"));
        assertThat(properties.storagePaths().users())
            .isEqualTo(publicBackend.resolve("stores/users-v1.json"));
    }

    @Test
    void givesTheCmsAliasesNullishPrecedenceLikeNode() {
        Path project = root.resolve("repo/cms/backend");
        CmsProperties properties = CmsProperties.from(Map.of(
            "CMS_STORAGE_ROOT", "",
            "STORAGE_ROOT", "ignored-storage-alias",
            "CMS_UPLOADS_DIR", "",
            "UPLOADS_DIR", "ignored-uploads-alias"
        ), project);
        Path publicBackend = root.resolve("repo/site/backend").toAbsolutePath().normalize();

        assertThat(properties.storageRoot()).isEqualTo(publicBackend.resolve("storage"));
        assertThat(properties.uploadsDir()).isEqualTo(publicBackend.resolve("storage/uploads"));
    }

    @Test
    void preservesDevelopmentOriginsAndTypedMediaConfiguration() {
        Map<String, String> environment = new LinkedHashMap<>();
        environment.put("FRONTEND_ORIGIN", "http://127.0.0.1:35180");
        environment.put("CMS_INTERNAL_URL", "http://127.0.0.1:35013");
        environment.put("CORS_ORIGINS", "https://one.example, https://two.example");
        environment.put("FFMPEG_PATH", "C:/tools/ffmpeg.exe");
        environment.put("FFPROBE_PATH", "C:/tools/ffprobe.exe");
        environment.put("MEDIA_WEBP_QUALITY", "96");
        environment.put("MEDIA_WEBP_THUMB_QUALITY", " ");
        environment.put("MEDIA_WEBP_MEDIUM_WIDTH", "1200.5");
        environment.put("MEDIA_WEBP_LARGE_WIDTH", "invalid");
        environment.put("MEDIA_WEBP_OPTIMIZED_WIDTH", "100");

        CmsProperties properties = CmsProperties.from(
            environment, root.resolve("repo/cms/backend"));

        assertThat(properties.allowedOrigins()).contains(
            "http://127.0.0.1:35180",
            "http://localhost:35180",
            "http://127.0.0.1:35013",
            "http://localhost:35013",
            "https://one.example",
            "https://two.example"
        );
        assertThat(properties.ffmpegPath()).isEqualTo("C:/tools/ffmpeg.exe");
        assertThat(properties.ffprobePath()).isEqualTo("C:/tools/ffprobe.exe");
        assertThat(properties.mediaWebpQuality()).isEqualTo(95);
        assertThat(properties.mediaWebpThumbQuality()).isEqualTo(55);
        assertThat(properties.mediaWebpMediumWidth()).isEqualTo(1201);
        assertThat(properties.mediaWebpLargeWidth()).isEqualTo(1440);
        assertThat(properties.mediaWebpOptimizedWidth()).isEqualTo(1200);
    }

    @Test
    void rejectsWeakProductionConfigurationAndAcceptsStrongHttpsConfiguration() throws IOException {
        Map<String, String> weak = new LinkedHashMap<>();
        weak.put("NODE_ENV", "production");
        weak.put("FRONTEND_ORIGIN", "http://127.0.0.1:6060");
        weak.put("SESSION_SECRET", "short");
        weak.put("ADMIN_SETUP_CODE", "short");

        assertThatThrownBy(() -> CmsProperties.from(weak, root.resolve("repo/cms/backend")))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Configuração de produção insegura")
            .hasMessageContaining("HTTPS");

        Map<String, String> strong = new LinkedHashMap<>();
        strong.put("NODE_ENV", "production");
        strong.put("FRONTEND_ORIGIN", "https://site.rodogarcia.com.br");
        strong.put("CORS_ORIGINS", "https://www.rodogarcia.com.br");
        strong.put("SESSION_SECRET", "session-secret-with-more-than-32-characters");
        strong.put("ADMIN_SETUP_CODE", "setup-code-2026-safe-value");
        Path ffmpeg = root.resolve("stable-tools/ffmpeg.exe").toAbsolutePath();
        Path ffprobe = root.resolve("stable-tools/ffprobe.exe").toAbsolutePath();
        Files.createDirectories(ffmpeg.getParent());
        Files.write(ffmpeg, new byte[] {0});
        Files.write(ffprobe, new byte[] {0});
        strong.put("FFMPEG_PATH", ffmpeg.toString());
        strong.put("FFPROBE_PATH", ffprobe.toString());

        CmsProperties properties = CmsProperties.from(
            strong, root.resolve("repo/cms/backend"));
        assertThat(properties.production()).isTrue();
        assertThat(properties.allowedOrigins()).containsExactlyInAnyOrder(
            "https://site.rodogarcia.com.br",
            "https://www.rodogarcia.com.br"
        );
        assertThat(properties.ffmpegPath()).isEqualTo(ffmpeg.toString());
        assertThat(properties.ffprobePath()).isEqualTo(ffprobe.toString());
    }

    @Test
    void requiresAStableAbsoluteFfmpegOutsideTheRepositoryInProduction() throws IOException {
        Path project = root.resolve("repo/cms/backend");
        Map<String, String> base = new LinkedHashMap<>();
        base.put("NODE_ENV", "production");
        base.put("FRONTEND_ORIGIN", "https://site.rodogarcia.com.br");
        base.put("SESSION_SECRET", "session-secret-with-more-than-32-characters");
        base.put("ADMIN_SETUP_CODE", "setup-code-2026-safe-value");

        assertThatThrownBy(() -> CmsProperties.from(base, project))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("FFMPEG_PATH");

        base.put("FFMPEG_PATH", "ffmpeg");
        assertThatThrownBy(() -> CmsProperties.from(base, project))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("absoluto");

        Path managedFfmpeg = root.resolve("repo/cms/backend/tools/ffmpeg.exe").toAbsolutePath();
        Files.createDirectories(managedFfmpeg.getParent());
        Files.write(managedFfmpeg, new byte[] {0});
        base.put("FFMPEG_PATH", managedFfmpeg.toString());
        assertThatThrownBy(() -> CmsProperties.from(base, project))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("fora do repositório");
    }

    @Test
    void rejectsWhatwgNumericLoopbackAndInvalidPortsLikeNodeUrl() {
        for (String origin : java.util.List.of(
            "https://2130706433",
            "https://0x7f000001",
            "https://0177.0.0.1",
            "https://site.example:99999"
        )) {
            Map<String, String> environment = new LinkedHashMap<>();
            environment.put("NODE_ENV", "production");
            environment.put("FRONTEND_ORIGIN", origin);
            environment.put("SESSION_SECRET", "session-secret-with-more-than-32-characters");
            environment.put("ADMIN_SETUP_CODE", "setup-code-2026-safe-value");

            assertThatThrownBy(() -> CmsProperties.from(
                environment, root.resolve("repo/cms/backend")))
                .as(origin)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Configuração de produção insegura");
        }
    }
}
