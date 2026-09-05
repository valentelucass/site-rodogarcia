package br.com.rodogarcia.cms.backend.config;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public record CmsProperties(
    String nodeEnv,
    String host,
    int port,
    Path projectRoot,
    Path repoRoot,
    Path siteBackendRoot,
    Path storageRoot,
    Path uploadsDir,
    Path frontendPublicDir,
    String frontendOrigin,
    Set<String> allowedOrigins,
    String trustProxy,
    String sessionSecret,
    String adminSetupCode,
    String landingBuilderApiUrl,
    String landingBuilderServiceToken,
    String ffmpegPath,
    String ffprobePath,
    int mediaWebpQuality,
    int mediaWebpThumbQuality,
    int mediaWebpMediumWidth,
    int mediaWebpLargeWidth,
    int mediaWebpOptimizedWidth,
    boolean production,
    StoragePaths storagePaths
) {

    public static CmsProperties load() {
        Path projectRoot = detectProjectRoot();
        Path repoRoot = projectRoot.resolve("..").resolve("..").normalize().toAbsolutePath();
        Map<String, String> environment = new LinkedHashMap<>(
            EnvironmentFileLoader.read(repoRoot.resolve(".env"))
        );
        environment.putAll(System.getenv());
        return from(environment, projectRoot);
    }

    public static CmsProperties from(Map<String, String> environment, Path projectRoot) {
        Path absoluteProjectRoot = projectRoot.toAbsolutePath().normalize();
        Path repoRoot = absoluteProjectRoot.resolve("..").resolve("..").normalize();
        Path siteBackendRoot = repoRoot.resolve("site").resolve("backend").normalize();
        String nodeEnv = valueOrDefault(environment.get("NODE_ENV"), "development");
        boolean production = nodeEnv.equals("production");
        String host = valueOrDefault(environment.get("HOST"), "127.0.0.1");
        int port = numberEnvironment(environment.get("PORT"), 31013);
        String frontendOrigin = valueOrDefault(
            environment.get("FRONTEND_ORIGIN"),
            "http://127.0.0.1:35180"
        );
        String directCmsOrigin = valueOrDefault(
            environment.get("CMS_INTERNAL_URL"),
            "http://127.0.0.1:35013"
        );
        List<String> extraOrigins = commaSeparated(environment.get("CORS_ORIGINS"));
        String rawSecret = firstNonNull(
            environment.get("JWT_SECRET"),
            environment.get("SESSION_SECRET"),
            ""
        );
        String sessionSecret = rawSecret.isEmpty()
            ? "dev-only-change-this-rodogarcia-secret"
            : rawSecret;
        String adminSetupCode = valueOrDefault(environment.get("ADMIN_SETUP_CODE"), "");
        String configuredFfmpeg = valueOrDefault(environment.get("FFMPEG_PATH"), "").trim();
        String configuredFfprobe = valueOrDefault(environment.get("FFPROBE_PATH"), "").trim();

        if (production) {
            List<String> errors = new ArrayList<>();
            if (isWeakSecret(rawSecret)) {
                errors.add("JWT_SECRET ou SESSION_SECRET deve ter pelo menos 32 caracteres fortes.");
            }
            if (isWeakSetupCode(adminSetupCode)) {
                errors.add("ADMIN_SETUP_CODE deve ser forte e ter pelo menos 16 caracteres.");
            }
            validateHttpsOrigin("FRONTEND_ORIGIN", frontendOrigin, errors);
            for (int index = 0; index < extraOrigins.size(); index++) {
                validateHttpsOrigin("CORS_ORIGINS[" + index + "]", extraOrigins.get(index), errors);
            }
            validateProductionMediaTool("FFMPEG_PATH", configuredFfmpeg, repoRoot, errors);
            validateProductionMediaTool("FFPROBE_PATH", configuredFfprobe, repoRoot, errors);
            if (!errors.isEmpty()) {
                throw new IllegalStateException(
                    "Configuração de produção insegura: " + String.join(" ", errors)
                );
            }
        }

        LinkedHashSet<String> allowedOrigins = new LinkedHashSet<>();
        allowedOrigins.add(frontendOrigin);
        if (!production) {
            allowedOrigins.add(swapLoopback(frontendOrigin));
            allowedOrigins.add(directCmsOrigin);
            allowedOrigins.add(swapLoopback(directCmsOrigin));
            allowedOrigins.add("http://" + host + ":" + port);
        }
        allowedOrigins.addAll(extraOrigins);

        String storageOverride = firstNonNull(
            environment.get("CMS_STORAGE_ROOT"),
            environment.get("STORAGE_ROOT"),
            null
        );
        Path storageRoot = storageOverride == null || storageOverride.isEmpty()
            ? siteBackendRoot.resolve("storage")
            : resolveAgainst(siteBackendRoot, storageOverride);
        String uploadsOverride = firstNonNull(
            environment.get("CMS_UPLOADS_DIR"),
            environment.get("UPLOADS_DIR"),
            null
        );
        Path uploadsDir = uploadsOverride == null || uploadsOverride.isEmpty()
            ? storageRoot.resolve("uploads")
            : resolveAgainst(siteBackendRoot, uploadsOverride);
        Path frontendPublicDir = resolveAgainst(
            repoRoot,
            valueOrDefault(
                environment.get("FRONTEND_PUBLIC_DIR"),
                Path.of("site", "frontend", "public").toString()
            )
        );
        StoragePaths storagePaths = StoragePaths.from(environment, siteBackendRoot, storageRoot);
        String ffmpegPath = configuredFfmpeg;

        return new CmsProperties(
            nodeEnv,
            host,
            port,
            absoluteProjectRoot,
            repoRoot,
            siteBackendRoot,
            storageRoot.normalize(),
            uploadsDir.normalize(),
            frontendPublicDir.normalize(),
            frontendOrigin,
            Set.copyOf(allowedOrigins),
            valueOrDefault(environment.get("TRUST_PROXY"), "false").trim(),
            sessionSecret,
            adminSetupCode,
            stripTrailingSlash(valueOrDefault(environment.get("LANDING_BUILDER_API_URL"), "").trim()),
            valueOrDefault(environment.get("LANDING_BUILDER_SERVICE_TOKEN"), "").trim(),
            ffmpegPath,
            configuredFfprobe,
            clampedNumber(environment.get("MEDIA_WEBP_QUALITY"), 82, 60, 95),
            clampedNumber(environment.get("MEDIA_WEBP_THUMB_QUALITY"), 72, 55, 90),
            clampedNumber(environment.get("MEDIA_WEBP_MEDIUM_WIDTH"), 960, 480, 1_600),
            clampedNumber(environment.get("MEDIA_WEBP_LARGE_WIDTH"), 1_440, 960, 2_400),
            clampedNumber(environment.get("MEDIA_WEBP_OPTIMIZED_WIDTH"), 1_920, 1_200, 3_200),
            production,
            storagePaths
        );
    }

    private static Path detectProjectRoot() {
        try {
            Path location = Path.of(CmsProperties.class.getProtectionDomain()
                .getCodeSource().getLocation().toURI()).toAbsolutePath().normalize();
            Path parent = Files.isDirectory(location) ? location.getParent() : location.getParent();
            if (parent != null && parent.getFileName() != null
                && (parent.getFileName().toString().equals("target")
                    || parent.getFileName().toString().startsWith("dist"))) {
                return parent.getParent().toAbsolutePath().normalize();
            }
        } catch (Exception ignored) {
            // O diretório de trabalho permanece o fallback operacional.
        }
        return Path.of("").toAbsolutePath().normalize();
    }

    static Path resolveAgainst(Path base, String value) {
        Path candidate = Path.of(value);
        return (candidate.isAbsolute() ? candidate : base.resolve(candidate))
            .toAbsolutePath().normalize();
    }

    private static int numberEnvironment(String value, int fallback) {
        if (value == null) return fallback;
        try {
            String normalized = value.trim();
            double number = normalized.isEmpty() ? 0 : Double.parseDouble(normalized);
            if (!Double.isFinite(number)) return fallback;
            if (number < 0 || number > 65_535 || number != Math.rint(number)) {
                throw new IllegalArgumentException("PORT precisa ser um inteiro entre 0 e 65535.");
            }
            return (int) number;
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static int clampedNumber(String value, int fallback, int minimum, int maximum) {
        if (value == null) return fallback;
        String normalized = value.trim();
        try {
            double number = normalized.isEmpty() ? 0 : Double.parseDouble(normalized);
            if (!Double.isFinite(number)) return fallback;
            int rounded = (int) Math.floor(number + 0.5d);
            return Math.max(minimum, Math.min(maximum, rounded));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static List<String> commaSeparated(String value) {
        if (value == null) return List.of();
        return java.util.Arrays.stream(value.split(","))
            .map(String::trim)
            .filter(item -> !item.isEmpty())
            .toList();
    }

    private static void validateHttpsOrigin(String name, String value, List<String> errors) {
        try {
            URI uri = URI.create(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                errors.add(name + " deve usar HTTPS em produção.");
            }
            Long numericIpv4 = parseWhatwgIpv4(host);
            if (uri.getPort() > 65_535) {
                errors.add(name + " deve ser uma origem absoluta válida.");
            }
            if (host == null || isLocalHostname(host)
                || (numericIpv4 != null
                    && (numericIpv4 == 0L || numericIpv4 == 0x7f000001L))) {
                errors.add(name + " não pode apontar para localhost em produção.");
            }
        } catch (IllegalArgumentException ignored) {
            errors.add(name + " deve ser uma origem absoluta válida.");
        }
    }

    private static void validateProductionMediaTool(
        String variableName,
        String configuredPath,
        Path repoRoot,
        List<String> errors
    ) {
        if (configuredPath.isBlank()) {
            errors.add(variableName + " absoluto e estável é obrigatório para o CMS Spring em produção.");
            return;
        }

        try {
            Path executable = Path.of(configuredPath).toAbsolutePath().normalize();
            if (!Path.of(configuredPath).isAbsolute()) {
                errors.add(variableName + " deve ser absoluto em produção.");
            } else if (executable.startsWith(repoRoot.toAbsolutePath().normalize())) {
                errors.add(variableName + " deve ficar fora do repositório em produção.");
            } else if (!Files.isRegularFile(executable)) {
                errors.add(variableName + " deve apontar para um arquivo existente em produção.");
            }
        } catch (RuntimeException ignored) {
            errors.add(variableName + " deve ser um caminho absoluto válido em produção.");
        }
    }

    private static boolean isLocalHostname(String hostname) {
        return Set.of("localhost", "127.0.0.1", "0.0.0.0", "::1")
            .contains(hostname.toLowerCase(Locale.ROOT));
    }

    /** Reproduz a normalização IPv4 numérica do WHATWG URL usada pelo Node. */
    private static Long parseWhatwgIpv4(String hostname) {
        if (hostname == null || hostname.isEmpty()) return null;
        String source = hostname.endsWith(".")
            ? hostname.substring(0, hostname.length() - 1) : hostname;
        String[] parts = source.split("\\.", -1);
        if (parts.length == 0 || parts.length > 4) return null;
        long[] numbers = new long[parts.length];
        for (int index = 0; index < parts.length; index++) {
            String part = parts[index];
            int radix = 10;
            if (part.regionMatches(true, 0, "0x", 0, 2)) {
                radix = 16;
                part = part.substring(2);
            } else if (part.length() > 1 && part.charAt(0) == '0') {
                radix = 8;
                part = part.substring(1);
            }
            if (part.isEmpty()) part = "0";
            if (!part.matches(radix == 16 ? "[0-9a-fA-F]+" : radix == 8 ? "[0-7]+" : "[0-9]+")) {
                return null;
            }
            try {
                numbers[index] = Long.parseUnsignedLong(part, radix);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        for (int index = 0; index < numbers.length - 1; index++) {
            if (numbers[index] > 255) return null;
        }
        long finalLimit = 1L << (8 * (5 - numbers.length));
        if (numbers[numbers.length - 1] >= finalLimit) return null;
        long address = numbers[numbers.length - 1];
        for (int index = 0; index < numbers.length - 1; index++) {
            address += numbers[index] << (8 * (3 - index));
        }
        return address;
    }

    private static boolean isWeakSecret(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return value.length() < 32 || lower.contains("dev-only")
            || lower.contains("change-this") || lower.contains("altere-para");
    }

    private static boolean isWeakSetupCode(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return value.length() < 16 || lower.contains("dev-only")
            || lower.contains("change-this") || lower.contains("altere-para");
    }

    private static String swapLoopback(String value) {
        return value.contains("127.0.0.1")
            ? value.replace("127.0.0.1", "localhost")
            : value.replace("localhost", "127.0.0.1");
    }

    private static String stripTrailingSlash(String value) {
        return value.replaceAll("/+$", "");
    }

    private static String valueOrDefault(String value, String fallback) {
        return value == null ? fallback : value;
    }

    private static String firstNonNull(String first, String second, String fallback) {
        return first != null ? first : second != null ? second : fallback;
    }

}
