package br.com.rodogarcia.cms.backend.utils;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import tools.jackson.databind.JsonNode;

public final class Sanitizers {

    private static final Pattern CONTROL = Pattern.compile("[\\x00-\\x1F\\x7F]");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private Sanitizers() {
    }

    public static String text(JsonNode value, int maxLength) {
        if (value == null || (!value.isString() && !value.isNumber())) return "";
        return text(value.asString(), maxLength);
    }

    public static String text(Object value, int maxLength) {
        if (!(value instanceof String) && !(value instanceof Number)) return "";
        String normalized = WHITESPACE.matcher(
            CONTROL.matcher(String.valueOf(value)).replaceAll(" ")
        ).replaceAll(" ").trim();
        return normalized.substring(0, Math.min(normalized.length(), maxLength));
    }

    public static String multiline(JsonNode value, int maxLength) {
        if (value == null || (!value.isString() && !value.isNumber())) return "";
        String[] lines = value.asString().replace("\r\n", "\n").replace('\r', '\n').split("\n");
        StringBuilder result = new StringBuilder();
        for (String line : lines) {
            String normalized = line
                .replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]", " ")
                .replaceAll("[ \\t]+", " ")
                .trim();
            if (normalized.isEmpty()) continue;
            if (!result.isEmpty()) result.append('\n');
            result.append(normalized);
        }
        return result.substring(0, Math.min(result.length(), maxLength));
    }

    public static String email(JsonNode value) {
        String email = text(value, 160).toLowerCase(Locale.ROOT);
        return EMAIL.matcher(email).matches() ? email : "";
    }

    public static String path(JsonNode value) {
        String raw = text(value, 400).replace('\\', '/');
        if (raw.isEmpty() || !raw.startsWith("/") || raw.startsWith("//")) return "";
        java.util.ArrayDeque<String> segments = new java.util.ArrayDeque<>();
        for (String segment : raw.split("/")) {
            if (segment.isEmpty() || segment.equals(".")) continue;
            if (segment.equals("..")) {
                if (!segments.isEmpty()) segments.removeLast();
            } else {
                segments.addLast(segment);
            }
        }
        String normalized = "/" + String.join("/", segments);
        return normalized.contains("..") ? "" : normalized;
    }

    public static Map<String, String> metadata(
        JsonNode value,
        int maxEntries,
        int keyMaxLength,
        int valueMaxLength
    ) {
        if (value == null || !value.isObject()) return Map.of();
        Map<String, String> result = new LinkedHashMap<>();
        value.properties().stream().limit(maxEntries).forEach(entry -> {
            String key = text(entry.getKey(), keyMaxLength);
            String item = text(jsonStringValue(entry.getValue()), valueMaxLength);
            if (!key.isEmpty() && !item.isEmpty()) result.put(key, item);
        });
        return result;
    }

    public static Map<String, String> metadata(JsonNode value) {
        return metadata(value, 12, 60, 180);
    }

    public static String maskIp(String input) {
        String value = text(input, 80);
        if (value.isEmpty() || value.equals("unknown")) return "";
        try {
            InetAddress address = InetAddress.getByName(value);
            byte[] bytes = address.getAddress();
            if (bytes.length == 4) {
                return (bytes[0] & 255) + "." + (bytes[1] & 255) + ".0.0";
            }
            if (address instanceof Inet6Address) {
                int first = ((bytes[0] & 255) << 8) | (bytes[1] & 255);
                int second = ((bytes[2] & 255) << 8) | (bytes[3] & 255);
                int third = ((bytes[4] & 255) << 8) | (bytes[5] & 255);
                return Integer.toHexString(first) + ":" + Integer.toHexString(second)
                    + ":" + Integer.toHexString(third) + "::";
            }
        } catch (Exception ignored) {
            return "";
        }
        return "";
    }

    public static String digits(JsonNode value, int maxLength) {
        String raw = value == null || value.isNull() ? "" : value.asString();
        String digits = raw.replaceAll("\\D", "");
        return digits.substring(0, Math.min(digits.length(), maxLength));
    }

    private static Object jsonStringValue(JsonNode value) {
        if (value == null || value.isNull()) return "";
        if (value.isString() || value.isNumber() || value.isBoolean()) return value.asString();
        return value.toString();
    }
}
