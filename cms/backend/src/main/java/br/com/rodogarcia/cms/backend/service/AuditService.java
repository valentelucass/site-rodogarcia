package br.com.rodogarcia.cms.backend.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.repository.JsonCollections;
import br.com.rodogarcia.cms.backend.security.ClientIpResolver;
import br.com.rodogarcia.cms.backend.security.SecurityContext;
import br.com.rodogarcia.cms.backend.utils.Ids;
import br.com.rodogarcia.cms.backend.utils.IsoTime;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public class AuditService {

    private final JsonCollections collections;
    private final StoragePaths paths;
    private final ClientIpResolver clientIpResolver;
    private final Clock clock;

    public AuditService(
        JsonCollections collections,
        StoragePaths paths,
        ClientIpResolver clientIpResolver,
        Clock clock
    ) {
        this.collections = collections;
        this.paths = paths;
        this.clientIpResolver = clientIpResolver;
        this.clock = clock;
    }

    public void record(
        HttpServletRequest request,
        String action,
        String target,
        Map<String, ?> metadata
    ) {
        collections.mutate(paths.auditLog(), logs -> {
            ObjectNode entry = logs.addObject();
            entry.put("id", Ids.generate("audit"));
            entry.put("createdAt", IsoTime.format(clock.millis()));
            entry.put("action", Sanitizers.text(action, 80));
            entry.put("target", Sanitizers.text(target, 160));
            var authenticated = request == null ? null : SecurityContext.get(request);
            entry.put("actorId", authenticated == null ? "" : authenticated.user().getId());
            entry.put("actorEmail", authenticated == null ? "" : authenticated.user().getEmail());
            entry.put(
                "ip",
                request == null ? "" : Sanitizers.maskIp(clientIpResolver.resolve(request))
            );
            if (metadata != null && !metadata.isEmpty()) {
                ObjectNode metadataNode = entry.putObject("metadata");
                metadata.entrySet().stream().limit(12).forEach(item -> {
                    String key = Sanitizers.text(item.getKey(), 60);
                    String value = Sanitizers.text(jsString(item.getValue()), 180);
                    if (!key.isEmpty() && !value.isEmpty()) metadataNode.put(key, value);
                });
                if (metadataNode.isEmpty()) entry.remove("metadata");
            }
            while (logs.size() > 5_000) logs.remove(0);
            return null;
        });
    }

    public List<JsonNode> list(Map<String, String> filters) {
        String action = Sanitizers.text(filters.get("action"), 80).toLowerCase(Locale.ROOT);
        long from = parseDate(filters.get("from"));
        long to = parseDate(filters.get("to"));
        int limit = parseSliceLimit(filters.get("limit"), 120, 1, 500);
        List<JsonNode> result = new ArrayList<>();
        collections.read(paths.auditLog()).forEach(entry -> {
            long timestamp = parseDate(entry.path("createdAt").asString());
            if (!action.isEmpty()
                && !entry.path("action").asString().toLowerCase(Locale.ROOT).contains(action)) return;
            if (timestamp != Long.MIN_VALUE && from != Long.MIN_VALUE && timestamp < from) return;
            if (timestamp != Long.MIN_VALUE && to != Long.MIN_VALUE && timestamp > to) return;
            result.add(entry.deepCopy());
        });
        result.sort(Comparator.comparing(
            entry -> entry.path("createdAt").asString(),
            Comparator.reverseOrder()
        ));
        return result.stream().limit(limit).toList();
    }

    public static long parseDate(String value) {
        String source = value == null ? "" : value.strip();
        if (source.isEmpty()) return Long.MIN_VALUE;
        try {
            return Instant.parse(source).toEpochMilli();
        } catch (Exception ignored) { }
        try {
            return OffsetDateTime.parse(source).toInstant().toEpochMilli();
        } catch (Exception ignored) { }
        try {
            return ZonedDateTime.parse(source, DateTimeFormatter.RFC_1123_DATE_TIME)
                .toInstant().toEpochMilli();
        } catch (Exception ignored) { }
        try {
            return LocalDate.parse(source).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
        } catch (Exception ignored) { }
        try {
            String normalized = source.indexOf(' ') >= 0 ? source.replace(' ', 'T') : source;
            return LocalDateTime.parse(normalized).atZone(ZoneId.systemDefault())
                .toInstant().toEpochMilli();
        } catch (Exception ignored) { }
        return Long.MIN_VALUE;
    }

    /** Equivale a {@code Math.round(Number(value) || fallback)} para query strings usuais. */
    public static int parseNumber(String value, int fallback) {
        double parsed = jsNumber(value);
        double effective = Double.isNaN(parsed) || parsed == 0d ? fallback : parsed;
        long rounded = Math.round(effective);
        if (rounded > Integer.MAX_VALUE) return Integer.MAX_VALUE;
        if (rounded < Integer.MIN_VALUE) return Integer.MIN_VALUE;
        return (int) rounded;
    }

    /** Equivale ao limite numérico passado a {@code Array.prototype.slice}. */
    public static int parseSliceLimit(String value, int fallback, int min, int max) {
        double parsed = jsNumber(value);
        double effective = Double.isNaN(parsed) || parsed == 0d ? fallback : parsed;
        double clamped = Math.min(max, Math.max(min, effective));
        return (int) Math.floor(clamped);
    }

    public static double jsNumber(String value) {
        if (value == null) return 0d;
        String source = value.strip();
        if (source.isEmpty()) return 0d;
        try {
            boolean negative = source.startsWith("-");
            boolean signed = source.startsWith("+") || negative;
            String unsigned = signed ? source.substring(1) : source;
            if (signed && (unsigned.regionMatches(true, 0, "0x", 0, 2)
                || unsigned.regionMatches(true, 0, "0b", 0, 2)
                || unsigned.regionMatches(true, 0, "0o", 0, 2))) {
                return Double.NaN;
            }
            if (unsigned.regionMatches(true, 0, "0x", 0, 2)) {
                double parsed = Long.parseUnsignedLong(unsigned.substring(2), 16);
                return parsed;
            }
            if (unsigned.regionMatches(true, 0, "0b", 0, 2)) {
                double parsed = Long.parseUnsignedLong(unsigned.substring(2), 2);
                return parsed;
            }
            if (unsigned.regionMatches(true, 0, "0o", 0, 2)) {
                double parsed = Long.parseUnsignedLong(unsigned.substring(2), 8);
                return parsed;
            }
            return Double.parseDouble(source);
        } catch (NumberFormatException ignored) {
            return Double.NaN;
        }
    }

    public static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    /** Express expõe query repetida como array; os services tratam esse valor como não textual. */
    public static Map<String, String> queryParameters(HttpServletRequest request) {
        Map<String, String> result = new LinkedHashMap<>();
        request.getParameterMap().forEach((key, values) ->
            result.put(key, values != null && values.length == 1 ? values[0] : null));
        return result;
    }

    public static String queryParameter(
        HttpServletRequest request,
        String name,
        String fallback
    ) {
        String[] values = request.getParameterMap().get(name);
        if (values == null) return fallback;
        return values.length == 1 ? values[0] : null;
    }

    private static String jsString(Object value) {
        if (value == null) return "";
        if (value instanceof Collection<?> values) {
            return values.stream().map(AuditService::jsString).collect(java.util.stream.Collectors.joining(","));
        }
        if (value.getClass().isArray()) {
            int length = java.lang.reflect.Array.getLength(value);
            List<String> values = new ArrayList<>(length);
            for (int index = 0; index < length; index++) {
                values.add(jsString(java.lang.reflect.Array.get(value, index)));
            }
            return String.join(",", values);
        }
        if (value instanceof Map<?, ?>) return "[object Object]";
        return String.valueOf(value);
    }
}
