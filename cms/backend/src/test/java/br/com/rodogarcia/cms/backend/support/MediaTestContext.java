package br.com.rodogarcia.cms.backend.support;

import java.nio.file.Path;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import br.com.rodogarcia.cms.backend.config.MediaSettings;
import br.com.rodogarcia.cms.backend.repository.ImprovementRepository;
import br.com.rodogarcia.cms.backend.repository.JsonCollections;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import br.com.rodogarcia.cms.backend.repository.content.ContentRepository;
import br.com.rodogarcia.cms.backend.repository.content.SiteTextsRepository;
import br.com.rodogarcia.cms.backend.security.ClientIpResolver;
import br.com.rodogarcia.cms.backend.service.AdminMediaProcessor;
import br.com.rodogarcia.cms.backend.service.AuditService;
import br.com.rodogarcia.cms.backend.service.ImprovementService;
import br.com.rodogarcia.cms.backend.service.MediaService;
import br.com.rodogarcia.cms.backend.service.MediaMetadataReader;
import br.com.rodogarcia.cms.backend.service.MediaValidationService;
import br.com.rodogarcia.cms.backend.service.content.ContentMigrationService;
import br.com.rodogarcia.cms.backend.service.content.FilesystemContentMediaValidator;
import br.com.rodogarcia.cms.backend.service.content.StructuredContentSanitizer;
import tools.jackson.databind.json.JsonMapper;

public final class MediaTestContext {
    public final CmsProperties properties;
    public final JsonMapper mapper;
    public final JsonFileStore store;
    public final AuditService audit;
    public final MediaValidationService validation;
    public final MediaService media;
    public final ImprovementService improvements;

    public MediaTestContext(Path root, Clock clock) {
        this(root, clock, null);
    }

    public MediaTestContext(
        Path root,
        Clock clock,
        AdminMediaProcessor processorOverride
    ) {
        Map<String, String> environment = new LinkedHashMap<>();
        environment.put("NODE_ENV", "development");
        environment.put("FRONTEND_ORIGIN", "http://127.0.0.1:35180");
        environment.put("CMS_INTERNAL_URL", "http://127.0.0.1:35013");
        environment.put("CMS_STORAGE_ROOT", root.resolve("storage").toAbsolutePath().toString());
        environment.put("CMS_UPLOADS_DIR", root.resolve("storage/uploads").toAbsolutePath().toString());
        environment.put("FRONTEND_PUBLIC_DIR", root.resolve("public").toAbsolutePath().toString());
        properties = CmsProperties.from(environment, root.resolve("repo/cms/backend"));
        mapper = JsonMapper.builder().build();
        store = new JsonFileStore(mapper);
        ClientIpResolver clientIp = new ClientIpResolver(properties);
        audit = new AuditService(new JsonCollections(store), properties.storagePaths(), clientIp, clock);
        FilesystemContentMediaValidator contentMedia = new FilesystemContentMediaValidator(properties);
        StructuredContentSanitizer sanitizer = new StructuredContentSanitizer(mapper, contentMedia);
        ContentMigrationService migrations = new ContentMigrationService(mapper, sanitizer);
        ContentRepository content = new ContentRepository(store, properties.storagePaths(), migrations);
        SiteTextsRepository siteTexts = new SiteTextsRepository(store, properties.storagePaths());
        validation = new MediaValidationService(properties);
        MediaSettings settings = MediaSettings.defaults(properties.ffmpegPath(), properties.ffprobePath());
        AdminMediaProcessor processor = processorOverride == null
            ? new AdminMediaProcessor(settings)
            : processorOverride;
        media = new MediaService(
            store,
            properties.storagePaths(),
            properties,
            content,
            siteTexts,
            validation,
            processor,
            new MediaMetadataReader(settings),
            settings,
            audit,
            clock
        );
        media.recoverReferenceTransaction();
        improvements = new ImprovementService(
            new ImprovementRepository(store, properties.storagePaths()),
            audit,
            clock
        );
    }
}
