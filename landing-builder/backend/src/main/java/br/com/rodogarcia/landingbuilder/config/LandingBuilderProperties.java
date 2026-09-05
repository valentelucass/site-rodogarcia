package br.com.rodogarcia.landingbuilder.config;

import java.nio.file.Path;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Configuração tipada do runtime Spring e dos caminhos privados do Builder. */
@Component
public final class LandingBuilderProperties {

    private static final int DEFAULT_PORT = 36110;
    private static final String[] ENVIRONMENT_KEYS = {
        "NODE_ENV",
        "LANDING_BUILDER_HOST",
        "HOST",
        "LANDING_BUILDER_PORT",
        "PORT",
        "LANDING_BUILDER_SERVICE_TOKEN",
        "LANDING_BUILDER_STORAGE_ROOT",
        "FFMPEG_PATH",
        "FFPROBE_PATH"
    };
    private final boolean production;
    private final String host;
    private final int port;
    private final String serviceToken;
    private final Path storageRoot;
    private final String ffmpegPath;
    private final String ffprobePath;

    @Autowired
    public LandingBuilderProperties(Environment environment) {
        this(environmentValues(environment, Path.of("")));
    }

    LandingBuilderProperties(Map<String, String> values) {
        production = "production".equals(values.getOrDefault("NODE_ENV", "").trim());
        host = firstNonBlank(values.get("LANDING_BUILDER_HOST"), values.get("HOST"), "127.0.0.1");
        port = parsePort(firstNonBlank(values.get("LANDING_BUILDER_PORT"), values.get("PORT"), String.valueOf(DEFAULT_PORT)));
        serviceToken = trim(values.get("LANDING_BUILDER_SERVICE_TOKEN"));
        String configuredStorageRoot = trim(values.get("LANDING_BUILDER_STORAGE_ROOT"));
        storageRoot = Path.of(configuredStorageRoot.isEmpty() ? "storage" : configuredStorageRoot).toAbsolutePath().normalize();
        ffmpegPath = trim(values.get("FFMPEG_PATH"));
        ffprobePath = trim(values.get("FFPROBE_PATH"));

        if (production && (!isStrongServiceToken(serviceToken)
            || configuredStorageRoot.isEmpty()
            || !Path.of(configuredStorageRoot).isAbsolute()
            || !isStableFfmpeg(ffmpegPath)
            || !isStableFfmpeg(ffprobePath))) {
            throw new IllegalStateException("Configuração inválida do Landing Builder.");
        }
    }

    public boolean isProduction() { return production; }
    public String host() { return host; }
    public int port() { return port; }
    public String serviceToken() { return serviceToken; }
    public Path storageRoot() { return storageRoot; }
    public String ffmpegPath() { return ffmpegPath; }
    public String ffprobePath() { return ffprobePath; }

    static Map<String, String> environmentValues(Environment environment, Path workingDirectory) {
        Path directory = workingDirectory.toAbsolutePath().normalize();
        Map<String, String> values = new LinkedHashMap<>(
            EnvironmentFileLoader.read(directory.resolve(".env"))
        );
        for (String name : ENVIRONMENT_KEYS) {
            String configured = environment.getProperty(name);
            if (configured != null) values.put(name, configured);
        }
        return values;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            String trimmed = trim(value);
            if (!trimmed.isEmpty()) return trimmed;
        }
        return "";
    }

    private static String trim(String value) { return value == null ? "" : value.trim(); }

    private static int parsePort(String value) {
        try {
            int parsed = Integer.parseInt(value);
            if (parsed >= 1 && parsed <= 65535) return parsed;
        } catch (NumberFormatException ignored) {
            // A resposta de boot permanece segura e sem detalhe de ambiente.
        }
        throw new IllegalStateException("Configuração inválida do Landing Builder.");
    }

    private static boolean isStrongServiceToken(String value) {
        return value.length() >= 32 && !value.matches("(?i).*?(altere-para|change-me|example|placeholder).*?");
    }

    private static boolean isStableFfmpeg(String value) {
        if (value.isBlank()) return false;
        try {
            Path path = Path.of(value).toAbsolutePath().normalize();
            return path.isAbsolute() && Files.isRegularFile(path) && !path.toString().replace('\\', '/').contains("/node_modules/");
        } catch (RuntimeException ignored) {
            return false;
        }
    }
}
