package br.com.rodogarcia.site.backend.validation;

import java.math.BigInteger;
import java.util.Locale;
import java.util.regex.Pattern;

import br.com.rodogarcia.site.backend.utils.EcmaScriptNumberFormatter;
import tools.jackson.databind.JsonNode;

public final class EslTextNormalizer {

    private static final Pattern CONTROL_CHARACTERS = Pattern.compile("[\\u0000-\\u001F\\u007F]");
    private static final Pattern ECMASCRIPT_WHITESPACE = Pattern.compile(
        "[\\u0009-\\u000D\\u0020\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]+"
    );
    private static final Pattern EMAIL = Pattern.compile("^[^ @]+@[^ @]+\\.[^ @]+$");
    private static final Pattern DECIMAL_NUMBER = Pattern.compile(
        "^[+-]?(?:(?:[0-9]+(?:\\.[0-9]*)?)|(?:\\.[0-9]+))(?:[eE][+-]?[0-9]+)?$"
    );
    private static final Pattern HEX_NUMBER = Pattern.compile("^0[xX][0-9a-fA-F]+$");
    private static final Pattern BINARY_NUMBER = Pattern.compile("^0[bB][01]+$");
    private static final Pattern OCTAL_NUMBER = Pattern.compile("^0[oO][0-7]+$");

    private EslTextNormalizer() {
    }

    /**
     * Reproduz o contrato de sanitizeText do Node. O corte usa unidades UTF-16,
     * como String.prototype.slice, inclusive quando a última unidade é parte de
     * um par substituto.
     */
    public static String sanitizeText(JsonNode value, int maxLength) {
        String text;
        if (value != null && value.isString()) {
            text = value.stringValue();
        } else if (value != null && value.isNumber()) {
            text = EcmaScriptNumberFormatter.format(value.doubleValue());
        } else {
            return "";
        }

        String normalized = CONTROL_CHARACTERS.matcher(text).replaceAll(" ");
        normalized = ECMASCRIPT_WHITESPACE.matcher(normalized).replaceAll(" ").trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    public static String sanitizeEmail(JsonNode value) {
        String email = sanitizeText(value, 160).toLowerCase(Locale.ROOT);
        return EMAIL.matcher(email).matches() ? email : "";
    }

    public static String digits(JsonNode value, int maxLength) {
        String text = sanitizeText(value, maxLength * 2);
        StringBuilder result = new StringBuilder(Math.min(text.length(), maxLength));
        for (int index = 0; index < text.length() && result.length() < maxLength; index++) {
            char character = text.charAt(index);
            if (character >= '0' && character <= '9') {
                result.append(character);
            }
        }
        return result.toString();
    }

    /**
     * Implementa Number(value) para os tipos que podem chegar por JSON. Arrays
     * usam a mesma conversão textual recursiva de Array.prototype.toString.
     */
    public static double coerceNumber(JsonNode value) {
        if (value == null || value.isMissingNode()) {
            return Double.NaN;
        }
        if (value.isNull()) {
            return 0.0d;
        }
        if (value.isBoolean()) {
            return value.booleanValue() ? 1.0d : 0.0d;
        }
        if (value.isNumber()) {
            return value.doubleValue();
        }
        if (value.isString()) {
            return parseJsNumber(value.stringValue());
        }
        if (value.isArray()) {
            return parseJsNumber(jsArrayToString(value));
        }
        return Double.NaN;
    }

    private static double parseJsNumber(String input) {
        String value = trimEcmascriptWhitespace(input);
        if (value.isEmpty()) {
            return 0.0d;
        }
        if (value.equals("Infinity") || value.equals("+Infinity")) {
            return Double.POSITIVE_INFINITY;
        }
        if (value.equals("-Infinity")) {
            return Double.NEGATIVE_INFINITY;
        }

        try {
            if (HEX_NUMBER.matcher(value).matches()) {
                return new BigInteger(value.substring(2), 16).doubleValue();
            }
            if (BINARY_NUMBER.matcher(value).matches()) {
                return new BigInteger(value.substring(2), 2).doubleValue();
            }
            if (OCTAL_NUMBER.matcher(value).matches()) {
                return new BigInteger(value.substring(2), 8).doubleValue();
            }
            if (DECIMAL_NUMBER.matcher(value).matches()) {
                return Double.parseDouble(value);
            }
        } catch (NumberFormatException ignored) {
            return Double.NaN;
        }
        return Double.NaN;
    }

    private static String jsArrayToString(JsonNode array) {
        StringBuilder result = new StringBuilder();
        for (int index = 0; index < array.size(); index++) {
            if (index > 0) {
                result.append(',');
            }
            JsonNode item = array.get(index);
            if (item == null || item.isNull() || item.isMissingNode()) {
                continue;
            }
            if (item.isArray()) {
                result.append(jsArrayToString(item));
            } else if (item.isString()) {
                result.append(item.stringValue());
            } else if (item.isNumber()) {
                result.append(EcmaScriptNumberFormatter.format(item.doubleValue()));
            } else if (item.isBoolean()) {
                result.append(item.booleanValue() ? "true" : "false");
            } else {
                result.append("[object Object]");
            }
        }
        return result.toString();
    }

    private static String trimEcmascriptWhitespace(String value) {
        int start = 0;
        int end = value.length();
        while (start < end && isEcmascriptWhitespace(value.charAt(start))) {
            start++;
        }
        while (end > start && isEcmascriptWhitespace(value.charAt(end - 1))) {
            end--;
        }
        return value.substring(start, end);
    }

    private static boolean isEcmascriptWhitespace(char character) {
        return (character >= 0x0009 && character <= 0x000D)
            || character == 0x0020
            || character == 0x00A0
            || character == 0x1680
            || (character >= 0x2000 && character <= 0x200A)
            || character == 0x2028
            || character == 0x2029
            || character == 0x202F
            || character == 0x205F
            || character == 0x3000
            || character == 0xFEFF;
    }

}
