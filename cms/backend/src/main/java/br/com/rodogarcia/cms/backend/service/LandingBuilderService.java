package br.com.rodogarcia.cms.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.zip.GZIPInputStream;
import java.util.zip.InflaterInputStream;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import org.brotli.dec.BrotliInputStream;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public class LandingBuilderService {

    private static final String TOKEN_HEADER = "x-landing-builder-service-token";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(8);
    private static final int MAX_REDIRECTS = 20;
    private static final byte[] EMPTY_BODY = new byte[0];

    private final CmsProperties properties;
    private final JsonMapper mapper;
    private final HttpClient client;
    private final Duration timeout;

    @Autowired
    public LandingBuilderService(CmsProperties properties, JsonFileStore store) {
        this(properties, store.mapper(), REQUEST_TIMEOUT);
    }

    LandingBuilderService(CmsProperties properties, JsonMapper mapper, Duration timeout) {
        this.properties = properties;
        this.mapper = mapper;
        this.timeout = timeout;
        this.client = HttpClient.newBuilder()
            .connectTimeout(timeout)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    }

    public JsonNode listPages() {
        return request(HttpMethod.GET, "/api/internal/landings", null, false);
    }

    public JsonNode createPage(JsonNode payload) {
        return request(HttpMethod.POST, "/api/internal/landings", json(payload), true);
    }

    public JsonNode updatePage(String id, JsonNode payload) {
        return request(HttpMethod.PUT,
            "/api/internal/landings/" + segment(id), json(payload), true);
    }

    public JsonNode publishPage(String id, boolean publish) {
        return request(HttpMethod.POST,
            "/api/internal/landings/" + segment(id)
                + (publish ? "/publish" : "/unpublish"), null, false);
    }

    public JsonNode preview(String id) {
        return request(HttpMethod.POST,
            "/api/internal/landings/" + segment(id) + "/preview", null, false);
    }

    public JsonNode duplicatePage(String id) {
        return request(HttpMethod.POST, "/api/internal/landings/" + segment(id) + "/duplicate", null, false);
    }

    public JsonNode archivePage(String id) {
        return request(HttpMethod.POST, "/api/internal/landings/" + segment(id) + "/archive", null, false);
    }

    public JsonNode deletePage(String id) {
        return request(HttpMethod.DELETE, "/api/internal/landings/" + segment(id), null, false);
    }

    public JsonNode schedulePage(String id, JsonNode payload) {
        return request(HttpMethod.POST, "/api/internal/landings/" + segment(id) + "/schedule", json(payload), false);
    }

    public JsonNode revisions(String id) {
        return request(HttpMethod.GET, "/api/internal/landings/" + segment(id) + "/revisions", null, false);
    }

    public JsonNode rollback(String id, String revisionId) {
        return request(HttpMethod.POST, "/api/internal/landings/" + segment(id)
            + "/revisions/" + segment(revisionId) + "/rollback", null, false);
    }

    public JsonNode listMedia() {
        return request(HttpMethod.GET, "/api/internal/media", null, false);
    }

    public JsonNode uploadMedia(MultipartFile file, String alt) {
        requireIntegration();
        try {
            MultipartBody multipart = multipart(file, alt);
            return request(
                HttpMethod.POST,
                "/api/internal/media",
                new RequestBody(
                    multipart.bytes(),
                    "multipart/form-data; boundary=" + multipart.boundary()
                ),
                false
            );
        } catch (IOException error) {
            throw unavailable();
        }
    }

    public JsonNode deleteMedia(String id) {
        return request(HttpMethod.DELETE, "/api/internal/media/" + segment(id), null, false);
    }

    public JsonNode updateMedia(String id, JsonNode payload) {
        return request(HttpMethod.PUT, "/api/internal/media/" + segment(id), json(payload), false);
    }

    private JsonNode request(HttpMethod method, String path, RequestBody body, boolean json) {
        requireIntegration();
        RequestBody effectiveBody = json && body == null
            ? new RequestBody(EMPTY_BODY, "application/json")
            : body;
        OutboundRequest outbound = new OutboundRequest(
            method.name(),
            uri(properties.landingBuilderApiUrl() + path),
            effectiveBody
        );
        WireResponse response = exchange(outbound);
        JsonNode payload = parsePayload(response.body());
        if (response.status() < 200 || response.status() >= 300) {
            String message = payload.isObject() && payload.has("error")
                ? javascriptString(payload.get("error"))
                : "Não foi possível concluir a operação no construtor.";
            throw new ApiException(response.status() >= 500 ? 503 : response.status(), message);
        }
        return payload;
    }

    private WireResponse exchange(OutboundRequest initial) {
        long deadline = System.nanoTime() + timeout.toNanos();
        OutboundRequest current = initial;
        int redirects = 0;
        while (true) {
            HttpResponse<InputStream> response = send(current, deadline);
            int status = response.statusCode();
            String location = response.headers().firstValue("location").orElse(null);
            if (isRedirect(status) && location != null) {
                closeQuietly(response.body());
                if (redirects >= MAX_REDIRECTS) throw unavailable();
                current = redirected(current, status, location);
                redirects++;
                continue;
            }
            return new WireResponse(status, readBody(response, deadline));
        }
    }

    private HttpResponse<InputStream> send(OutboundRequest request, long deadline) {
        CompletableFuture<HttpResponse<InputStream>> pending;
        try {
            HttpRequest.BodyPublisher publisher = request.body() == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofByteArray(request.body().bytes());
            HttpRequest.Builder builder = HttpRequest.newBuilder(request.uri())
                .header(TOKEN_HEADER, properties.landingBuilderServiceToken())
                .header("Accept", "*/*")
                .header("Accept-Language", "*")
                .header("Accept-Encoding", "gzip, deflate")
                .method(request.method(), publisher);
            if (request.body() != null) {
                builder.header("Content-Type", request.body().contentType());
            }
            pending = client.sendAsync(
                builder.build(),
                HttpResponse.BodyHandlers.ofInputStream()
            );
        } catch (RuntimeException error) {
            throw unavailable();
        }
        long waitNanos = deadline - System.nanoTime();
        if (waitNanos <= 0) {
            pending.cancel(true);
            throw unavailable();
        }
        try {
            return pending.get(waitNanos, TimeUnit.NANOSECONDS);
        } catch (TimeoutException error) {
            pending.cancel(true);
            throw unavailable();
        } catch (InterruptedException error) {
            pending.cancel(true);
            Thread.currentThread().interrupt();
            throw unavailable();
        } catch (ExecutionException error) {
            throw unavailable();
        }
    }

    /**
     * Fetch resolve ao receber os headers; uma falha/timeout posterior é absorvida
     * pelo response.json().catch(() =&gt; ({})) da implementação Node.
     */
    private byte[] readBody(HttpResponse<InputStream> response, long deadline) {
        CompletableFuture<byte[]> pending = new CompletableFuture<>();
        Thread worker = Thread.ofVirtual().start(() -> {
            try (InputStream body = decoded(response.body(),
                response.headers().allValues("content-encoding"))) {
                pending.complete(body.readAllBytes());
            } catch (Exception error) {
                pending.complete(EMPTY_BODY);
            }
        });
        long waitNanos = deadline - System.nanoTime();
        if (waitNanos <= 0) {
            closeQuietly(response.body());
            worker.interrupt();
            return EMPTY_BODY;
        }
        try {
            return pending.get(waitNanos, TimeUnit.NANOSECONDS);
        } catch (TimeoutException error) {
            closeQuietly(response.body());
            worker.interrupt();
            return EMPTY_BODY;
        } catch (InterruptedException error) {
            closeQuietly(response.body());
            worker.interrupt();
            Thread.currentThread().interrupt();
            throw unavailable();
        } catch (ExecutionException error) {
            return EMPTY_BODY;
        }
    }

    private OutboundRequest redirected(OutboundRequest request, int status, String location) {
        URI next;
        try {
            next = request.uri().resolve(location);
            if (next.getFragment() != null) {
                next = new URI(next.getScheme(), next.getRawAuthority(), next.getRawPath(),
                    next.getRawQuery(), null);
            }
        } catch (IllegalArgumentException | URISyntaxException error) {
            throw unavailable();
        }
        if (next.getScheme() == null
            || (!next.getScheme().equalsIgnoreCase("http")
                && !next.getScheme().equalsIgnoreCase("https"))
            || next.getRawUserInfo() != null) {
            throw unavailable();
        }
        // O fetch Node reapassa headers customizados em redirects cross-origin.
        // O proxy Spring recusa a troca de origem para nunca expor o token privado.
        if (!sameOrigin(request.uri(), next)) throw unavailable();
        boolean switchToGet = ((status == 301 || status == 302)
            && request.method().equals("POST"))
            || (status == 303 && !request.method().equals("GET")
                && !request.method().equals("HEAD"));
        return switchToGet
            ? new OutboundRequest("GET", next, null)
            : new OutboundRequest(request.method(), next, request.body());
    }

    private JsonNode parsePayload(byte[] response) {
        if (response == null || response.length == 0) return mapper.createObjectNode();
        try {
            String json = new String(response, StandardCharsets.UTF_8);
            if (!json.isEmpty() && json.charAt(0) == '\ufeff') json = json.substring(1);
            JsonNode parsed = mapper.readTree(json);
            return parsed == null ? mapper.createObjectNode() : parsed;
        } catch (Exception ignored) {
            return mapper.createObjectNode();
        }
    }

    private RequestBody json(JsonNode payload) {
        JsonNode effective = payload == null ? mapper.createObjectNode() : payload;
        return new RequestBody(jsonStringify(effective).getBytes(StandardCharsets.UTF_8),
            "application/json");
    }

    private static MultipartBody multipart(MultipartFile file, String alt) throws IOException {
        String boundary = "----formdata-java-" + UUID.randomUUID().toString().replace("-", "");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        writeAscii(output, "--" + boundary + "\r\n");
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isEmpty()) filename = "media";
        writeUtf8(output, "Content-Disposition: form-data; name=\"file\"; filename=\""
            + multipartName(filename) + "\"\r\n");
        writeAscii(output, "Content-Type: " + blobContentType(file.getContentType()) + "\r\n\r\n");
        output.write(file.getBytes());
        writeAscii(output, "\r\n");
        String normalizedAlt = ecmaTrim(alt == null ? "" : alt);
        if (!normalizedAlt.isEmpty()) {
            writeAscii(output, "--" + boundary + "\r\n");
            writeAscii(output, "Content-Disposition: form-data; name=\"alt\"\r\n");
            writeAscii(output, "Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            writeUtf8(output, normalizeLineEndings(normalizedAlt));
            writeAscii(output, "\r\n");
        }
        writeAscii(output, "--" + boundary + "--\r\n");
        return new MultipartBody(boundary, output.toByteArray());
    }

    private static String blobContentType(String value) {
        if (value == null || value.isEmpty()) return "application/octet-stream";
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character < 0x20 || character > 0x7e) return "application/octet-stream";
        }
        return value.toLowerCase(Locale.ROOT);
    }

    private static String multipartName(String value) {
        return normalizeLineEndings(value)
            .replace("\r", "%0D")
            .replace("\n", "%0A")
            .replace("\"", "%22");
    }

    private static String normalizeLineEndings(String value) {
        return value.replace("\r\n", "\n").replace('\r', '\n').replace("\n", "\r\n");
    }

    private static void writeAscii(ByteArrayOutputStream output, String value) throws IOException {
        output.write(value.getBytes(StandardCharsets.US_ASCII));
    }

    private static void writeUtf8(ByteArrayOutputStream output, String value) throws IOException {
        output.write(value.getBytes(StandardCharsets.UTF_8));
    }

    private static InputStream decoded(InputStream body, List<String> headerValues)
        throws IOException {
        List<String> encodings = new ArrayList<>();
        for (String value : headerValues) {
            for (String encoding : value.split(",")) {
                if (!encoding.isBlank()) encodings.add(encoding.trim().toLowerCase(Locale.ROOT));
            }
        }
        InputStream decoded = body;
        for (int index = encodings.size() - 1; index >= 0; index--) {
            decoded = switch (encodings.get(index)) {
                case "gzip", "x-gzip" -> new GZIPInputStream(decoded);
                case "deflate" -> new InflaterInputStream(decoded);
                case "br" -> new BrotliInputStream(decoded);
                default -> decoded;
            };
        }
        return decoded;
    }

    private void requireIntegration() {
        if (properties.landingBuilderApiUrl().isEmpty()
            || properties.landingBuilderServiceToken().isEmpty()) {
            throw new ApiException(503,
                "O construtor de landing pages ainda não está configurado neste ambiente.");
        }
    }

    private static ApiException unavailable() {
        return new ApiException(503,
            "O construtor de landing pages não está disponível no momento.");
    }

    static String segment(String value) {
        String input = value == null ? "" : value;
        StringBuilder encoded = new StringBuilder();
        for (int offset = 0; offset < input.length();) {
            char character = input.charAt(offset);
            if (Character.isSurrogate(character)) {
                if (!Character.isHighSurrogate(character)
                    || offset + 1 >= input.length()
                    || !Character.isLowSurrogate(input.charAt(offset + 1))) {
                    throw new IllegalArgumentException("Identificador Unicode inválido.");
                }
            }
            int codePoint = input.codePointAt(offset);
            offset += Character.charCount(codePoint);
            byte[] bytes = new String(Character.toChars(codePoint)).getBytes(StandardCharsets.UTF_8);
            for (byte item : bytes) {
                int unsigned = item & 0xff;
                if (unsigned < 128 && isUriComponentCharacter((char) unsigned)) {
                    encoded.append((char) unsigned);
                } else {
                    encoded.append('%');
                    encoded.append(Character.toUpperCase(Character.forDigit(unsigned >>> 4, 16)));
                    encoded.append(Character.toUpperCase(Character.forDigit(unsigned & 15, 16)));
                }
            }
        }
        return encoded.toString();
    }

    private static boolean isUriComponentCharacter(char value) {
        return value >= 'A' && value <= 'Z'
            || value >= 'a' && value <= 'z'
            || value >= '0' && value <= '9'
            || "-_.!~*'()".indexOf(value) >= 0;
    }

    private static String javascriptString(JsonNode value) {
        if (value == null || value.isNull()) return "null";
        if (value.isString()) return value.asString();
        if (value.isBoolean()) return value.booleanValue() ? "true" : "false";
        if (value.isNumber()) return formatEcmaNumber(value.doubleValue());
        if (value.isArray()) {
            List<String> values = new ArrayList<>();
            value.forEach(item -> values.add(item == null || item.isNull()
                ? "" : javascriptString(item)));
            return String.join(",", values);
        }
        return "[object Object]";
    }

    private static String jsonStringify(JsonNode value) {
        StringBuilder json = new StringBuilder();
        appendJson(json, value);
        return json.toString();
    }

    private static void appendJson(StringBuilder json, JsonNode value) {
        if (value == null || value.isNull()) {
            json.append("null");
        } else if (value.isObject()) {
            json.append('{');
            List<Map.Entry<String, JsonNode>> properties = new ArrayList<>(value.properties());
            properties.sort(Comparator.comparingLong(entry -> arrayIndex(entry.getKey())));
            boolean first = true;
            for (Map.Entry<String, JsonNode> property : properties) {
                if (!first) json.append(',');
                appendJsonString(json, property.getKey());
                json.append(':');
                appendJson(json, property.getValue());
                first = false;
            }
            json.append('}');
        } else if (value.isArray()) {
            json.append('[');
            for (int index = 0; index < value.size(); index++) {
                if (index > 0) json.append(',');
                appendJson(json, value.get(index));
            }
            json.append(']');
        } else if (value.isString()) {
            appendJsonString(json, value.asString());
        } else if (value.isBoolean()) {
            json.append(value.booleanValue());
        } else if (value.isNumber()) {
            double number = value.doubleValue();
            json.append(Double.isFinite(number) ? formatEcmaNumber(number) : "null");
        } else {
            json.append("null");
        }
    }

    private static long arrayIndex(String value) {
        if (value.isEmpty() || value.length() > 10 || value.length() > 1 && value.charAt(0) == '0') {
            return Long.MAX_VALUE;
        }
        long parsed = 0;
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character < '0' || character > '9') return Long.MAX_VALUE;
            parsed = parsed * 10 + character - '0';
        }
        return parsed < 4_294_967_295L ? parsed : Long.MAX_VALUE;
    }

    private static void appendJsonString(StringBuilder json, String value) {
        json.append('"');
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> json.append("\\\"");
                case '\\' -> json.append("\\\\");
                case '\b' -> json.append("\\b");
                case '\f' -> json.append("\\f");
                case '\n' -> json.append("\\n");
                case '\r' -> json.append("\\r");
                case '\t' -> json.append("\\t");
                default -> {
                    if (character < 0x20 || isUnpairedSurrogate(value, index)) {
                        json.append(String.format(Locale.ROOT, "\\u%04x", (int) character));
                    } else {
                        json.append(character);
                    }
                }
            }
        }
        json.append('"');
    }

    private static boolean isUnpairedSurrogate(String value, int index) {
        char character = value.charAt(index);
        if (Character.isHighSurrogate(character)) {
            return index + 1 >= value.length()
                || !Character.isLowSurrogate(value.charAt(index + 1));
        }
        return Character.isLowSurrogate(character)
            && (index == 0 || !Character.isHighSurrogate(value.charAt(index - 1)));
    }

    private static String formatEcmaNumber(double value) {
        if (!Double.isFinite(value)) return String.valueOf(value);
        if (value == 0D) return "0";
        boolean negative = value < 0D;
        long expectedBits = Double.doubleToRawLongBits(value);
        BigDecimal exact = new BigDecimal(Math.abs(value));
        RoundingMode[] modes = {RoundingMode.DOWN, RoundingMode.UP, RoundingMode.HALF_EVEN};
        for (int precision = 1; precision <= 17; precision++) {
            BigDecimal best = null;
            BigDecimal distance = null;
            for (RoundingMode mode : modes) {
                BigDecimal candidate = exact.round(new MathContext(precision, mode)).stripTrailingZeros();
                String formatted = formatDecimal(candidate, negative);
                if (Double.doubleToRawLongBits(Double.parseDouble(formatted)) != expectedBits) continue;
                BigDecimal currentDistance = candidate.subtract(exact).abs();
                if (best == null || currentDistance.compareTo(distance) < 0
                    || currentDistance.compareTo(distance) == 0
                        && best.unscaledValue().abs().testBit(0)
                        && !candidate.unscaledValue().abs().testBit(0)) {
                    best = candidate;
                    distance = currentDistance;
                }
            }
            if (best != null) return formatDecimal(best, negative);
        }
        return Double.toString(value);
    }

    private static String formatDecimal(BigDecimal value, boolean negative) {
        int exponent = value.precision() - value.scale() - 1;
        String unsigned;
        if (exponent >= -6 && exponent < 21) {
            unsigned = value.toPlainString();
        } else {
            String digits = value.unscaledValue().abs().toString();
            String coefficient = digits.length() == 1
                ? digits : digits.charAt(0) + "." + digits.substring(1);
            unsigned = coefficient + "e" + (exponent >= 0 ? "+" : "") + exponent;
        }
        return negative ? "-" + unsigned : unsigned;
    }

    private static String ecmaTrim(String value) {
        int start = 0;
        int end = value.length();
        while (start < end && isEcmaWhitespace(value.charAt(start))) start++;
        while (end > start && isEcmaWhitespace(value.charAt(end - 1))) end--;
        return value.substring(start, end);
    }

    private static boolean isEcmaWhitespace(char value) {
        return Character.isWhitespace(value)
            || Character.isSpaceChar(value)
            || value == '\ufeff';
    }

    private static boolean isRedirect(int status) {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }

    private static boolean sameOrigin(URI current, URI next) {
        String currentHost = current.getHost();
        String nextHost = next.getHost();
        return currentHost != null
            && nextHost != null
            && current.getScheme().equalsIgnoreCase(next.getScheme())
            && currentHost.equalsIgnoreCase(nextHost)
            && effectivePort(current) == effectivePort(next);
    }

    private static int effectivePort(URI value) {
        if (value.getPort() >= 0) return value.getPort();
        return value.getScheme().equalsIgnoreCase("https") ? 443 : 80;
    }

    private static URI uri(String value) {
        try {
            URI uri = URI.create(value);
            if (uri.getScheme() == null
                || (!uri.getScheme().equalsIgnoreCase("http")
                    && !uri.getScheme().equalsIgnoreCase("https"))
                || uri.getRawUserInfo() != null) {
                throw unavailable();
            }
            return uri.getFragment() == null
                ? uri
                : new URI(uri.getScheme(), uri.getRawAuthority(), uri.getRawPath(),
                    uri.getRawQuery(), null);
        } catch (URISyntaxException error) {
            throw unavailable();
        } catch (IllegalArgumentException error) {
            throw unavailable();
        }
    }

    private static void closeQuietly(InputStream input) {
        try {
            input.close();
        } catch (IOException ignored) {
            // A resposta não é reutilizada depois do redirect/timeout.
        }
    }

    private record RequestBody(byte[] bytes, String contentType) { }
    private record MultipartBody(String boundary, byte[] bytes) { }
    private record OutboundRequest(String method, URI uri, RequestBody body) { }
    private record WireResponse(int status, byte[] body) { }
}
