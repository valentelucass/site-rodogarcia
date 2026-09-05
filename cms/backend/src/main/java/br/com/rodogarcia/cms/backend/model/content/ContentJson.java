package br.com.rodogarcia.cms.backend.model.content;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

public final class ContentJson {
    private static final Pattern CONTROL = Pattern.compile("[\\u0000-\\u001F\\u007F]");
    private static final Pattern MULTILINE_CONTROL = Pattern.compile("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]");
    private static final Pattern WHITESPACE = Pattern.compile("[\\s\\u00A0]+");
    private static final Pattern HORIZONTAL_WHITESPACE = Pattern.compile("[ \\t]+");
    private static final Pattern FRAGMENT = Pattern.compile("^#[A-Za-z][A-Za-z0-9_:.-]*$");
    private static final Pattern HEX = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final Pattern SCHEME = Pattern.compile("^[A-Za-z][A-Za-z0-9+.-]*:");
    private static final Set<String> URL_SCHEMES = Set.of("http", "https", "mailto", "tel");

    private ContentJson() {
    }

    public static ObjectNode object(JsonNode value) {
        return value != null && value.isObject()
            ? (ObjectNode) value
            : JsonNodeFactory.instance.objectNode();
    }

    public static ArrayNode array(JsonNode value) {
        return value != null && value.isArray()
            ? (ArrayNode) value
            : JsonNodeFactory.instance.arrayNode();
    }

    public static boolean has(JsonNode value, String field) {
        return value != null && value.isObject() && value.has(field);
    }

    public static String text(JsonNode value, int maxLength) {
        if (value == null || (!value.isString() && !value.isNumber())) return "";
        String normalized = WHITESPACE.matcher(CONTROL.matcher(value.asString()).replaceAll(" "))
            .replaceAll(" ").trim();
        return truncate(normalized, maxLength);
    }

    public static String text(JsonNode object, String field, int maxLength) {
        return text(object == null ? null : object.get(field), maxLength);
    }

    public static String multiline(JsonNode value, int maxLength) {
        if (value == null || (!value.isString() && !value.isNumber())) return "";
        String[] lines = value.asString().replace("\r\n", "\n").replace('\r', '\n').split("\n", -1);
        StringBuilder result = new StringBuilder();
        for (String line : lines) {
            String clean = HORIZONTAL_WHITESPACE.matcher(
                MULTILINE_CONTROL.matcher(line).replaceAll(" ")
            ).replaceAll(" ").trim();
            if (clean.isEmpty()) continue;
            if (!result.isEmpty()) result.append('\n');
            result.append(clean);
        }
        return truncate(result.toString(), maxLength);
    }

    public static String email(JsonNode value) {
        String email = text(value, 160).toLowerCase(Locale.ROOT);
        return email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") ? email : "";
    }

    public static String hex(JsonNode value) {
        String color = text(value, 16);
        return HEX.matcher(color).matches() ? color : "";
    }

    public static String url(JsonNode value) {
        String raw = text(value, 600);
        if (raw.isEmpty()) return "";
        if (FRAGMENT.matcher(raw).matches()) return raw;
        if (raw.startsWith("/")) return path(value);
        try {
            URI uri = new URI(raw);
            String scheme = uri.getScheme();
            if (scheme == null || !URL_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT))) return "";
            if ((scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")) && uri.getHost() == null) {
                return "";
            }
            return uri.toASCIIString();
        } catch (URISyntaxException exception) {
            return "";
        }
    }

    public static String path(JsonNode value) {
        String raw = text(value, 400).replace('\\', '/');
        if (raw.isEmpty() || !raw.startsWith("/") || raw.startsWith("//")) return "";
        String suffix = "";
        int queryIndex = firstPositive(raw.indexOf('?'), raw.indexOf('#'));
        if (queryIndex >= 0) {
            suffix = raw.substring(queryIndex);
            raw = raw.substring(0, queryIndex);
        }
        Deque<String> segments = new ArrayDeque<>();
        for (String segment : raw.split("/+")) {
            if (segment.isEmpty() || segment.equals(".")) continue;
            if (segment.equals("..")) {
                if (!segments.isEmpty()) segments.removeLast();
                continue;
            }
            segments.addLast(segment);
        }
        String normalized = "/" + String.join("/", segments) + suffix;
        return normalized.contains("..") ? "" : normalized;
    }

    public static boolean strictBoolean(JsonNode value, boolean fallback) {
        return value != null && value.isBoolean() ? value.booleanValue() : fallback;
    }

    public static int integer(JsonNode value, int fallback) {
        if (value == null || !value.isNumber()) return fallback;
        double number = value.doubleValue();
        return Double.isFinite(number) ? (int) number : fallback;
    }

    public static long order(JsonNode value, long fallback) {
        if (value == null || !value.isNumber()) return fallback;
        double number = value.doubleValue();
        return Double.isFinite(number) ? (long) number : fallback;
    }

    public static ObjectNode deepMergeDefaults(JsonNode input, JsonNode defaults) {
        ObjectNode result = JsonNodeFactory.instance.objectNode();
        ObjectNode source = object(input);
        ObjectNode fallback = object(defaults);
        fallback.properties().forEach(entry -> {
            JsonNode current = source.get(entry.getKey());
            JsonNode fallbackValue = entry.getValue();
            if (fallbackValue.isObject()) {
                result.set(entry.getKey(), deepMergeDefaults(current, fallbackValue));
            } else if (current == null || current.isNull()) {
                result.set(entry.getKey(), fallbackValue.deepCopy());
            } else {
                result.set(entry.getKey(), current.deepCopy());
            }
        });
        return result;
    }

    public static ObjectNode copyObject(JsonNode value) {
        return object(value).deepCopy();
    }

    public static String newId(String prefix) {
        return prefix + "_" + java.util.UUID.randomUUID().toString().replace("-", "");
    }

    private static int firstPositive(int first, int second) {
        if (first < 0) return second;
        if (second < 0) return first;
        return Math.min(first, second);
    }

    private static String truncate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    public static boolean hasScheme(String value) {
        return SCHEME.matcher(value).find();
    }
}
