package br.com.rodogarcia.cms.backend.service.content;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.OptionalDouble;
import java.util.Set;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import br.com.rodogarcia.cms.backend.config.MediaSettings;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.service.MediaMetadataReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.StringNode;

@Component
public final class FilesystemContentMediaValidator implements ContentMediaValidator {
    private static final Set<String> IMAGES = Set.of(
        ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"
    );
    private static final Set<String> VIDEOS = Set.of(".mp4", ".webm", ".ogg");

    private final Path uploadsRoot;
    private final Path publicRoot;
    private final MediaMetadataReader metadataReader;

    public FilesystemContentMediaValidator(CmsProperties properties) {
        this(properties, new MediaMetadataReader(
            MediaSettings.defaults(properties.ffmpegPath(), properties.ffprobePath())
        ));
    }

    @Autowired
    public FilesystemContentMediaValidator(CmsProperties properties, MediaMetadataReader metadataReader) {
        uploadsRoot = properties.uploadsDir().toAbsolutePath().normalize();
        publicRoot = properties.frontendPublicDir().toAbsolutePath().normalize();
        this.metadataReader = metadataReader;
    }

    @Override
    public String image(JsonNode value, String label) {
        return assertMedia(value, label, IMAGES);
    }

    @Override
    public String video(JsonNode value, String label) {
        return assertMedia(value, label, VIDEOS);
    }

    @Override
    public String media(JsonNode value, String label) {
        return assertMedia(value, label, Set.of(
            ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif",
            ".mp4", ".webm", ".ogg"
        ));
    }

    @Override
    public String normalize(JsonNode value) {
        String raw = ContentJson.text(value, 600);
        if (raw.isEmpty() || ContentJson.hasScheme(raw)) return "";
        String normalized = raw.startsWith("/public/")
            ? ContentJson.path(StringNode.valueOf(raw.substring("/public".length())))
            : ContentJson.path(value);
        return normalized;
    }

    @Override
    public boolean isKnownImage(String value) {
        return known(value, IMAGES);
    }

    @Override
    public OptionalDouble videoDuration(String value) {
        Path file = knownFile(value, VIDEOS);
        if (file == null) return OptionalDouble.empty();
        return metadataReader.video(file)
            .map(metadata -> OptionalDouble.of(metadata.durationSeconds()))
            .orElseGet(OptionalDouble::empty);
    }

    private String assertMedia(JsonNode value, String label, Set<String> extensions) {
        String raw = ContentJson.text(value, 600);
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            if (!raw.isEmpty()) {
                throw new ApiException(422, label + ": use somente arquivos internos da biblioteca de mídia.");
            }
            return "";
        }
        String extension = extension(normalized);
        if (!extensions.contains(extension)) {
            throw new ApiException(422, label + ": tipo de arquivo incompatível com o campo.");
        }
        if (!known(normalized, extensions)) {
            throw new ApiException(422, label + ": use somente arquivos internos da biblioteca de mídia.");
        }
        return normalized;
    }

    private boolean known(String value, Set<String> extensions) {
        return knownFile(value, extensions) != null;
    }

    private Path knownFile(String value, Set<String> extensions) {
        String normalized = normalize(StringNode.valueOf(value));
        if (normalized.isEmpty() || !extensions.contains(extension(normalized))) return null;
        Path root = normalized.startsWith("/uploads/") ? uploadsRoot : publicRoot;
        String relative = normalized.startsWith("/uploads/")
            ? normalized.substring("/uploads/".length())
            : normalized.substring(1);
        Path resolved = root.resolve(relative).toAbsolutePath().normalize();
        if (!resolved.startsWith(root) || resolved.equals(root)) return null;
        try {
            return Files.isRegularFile(resolved) ? resolved : null;
        } catch (SecurityException ignored) {
            return null;
        }
    }

    private static String extension(String path) {
        int slash = path.lastIndexOf('/');
        int dot = path.lastIndexOf('.');
        return dot > slash ? path.substring(dot).toLowerCase(Locale.ROOT) : "";
    }
}
