package br.com.rodogarcia.cms.backend.controller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.improvement.ImprovementDownload;
import br.com.rodogarcia.cms.backend.service.AuditService;
import br.com.rodogarcia.cms.backend.service.ImprovementService;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import br.com.rodogarcia.cms.backend.validation.ImprovementValidator;
import br.com.rodogarcia.cms.backend.validation.MultipartPayload;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@RestController
public final class ImprovementController {
    private final ImprovementService improvements;
    private final ImprovementValidator validator;
    private final AuditService audit;
    private final JsonMapper mapper;

    public ImprovementController(
        ImprovementService improvements,
        ImprovementValidator validator,
        AuditService audit,
        JsonMapper mapper
    ) {
        this.improvements = improvements;
        this.validator = validator;
        this.audit = audit;
        this.mapper = mapper;
    }

    @PostMapping("/api/improvements")
    public ResponseEntity<Map<String, Object>> createPublic(HttpServletRequest request) {
        ParsedImprovement parsed = parse(request, false);
        ObjectNode improvement = improvements.create(parsed.input(), parsed.attachments());
        return ResponseEntity.status(201).body(Map.of(
            "message", "Sua sugestão foi recebida. Obrigado por contribuir.",
            "id", improvement.path("id").asString()
        ));
    }

    @GetMapping("/api/admin/improvements")
    public Map<String, Object> list(HttpServletRequest request) {
        String[] values = request.getParameterValues("status");
        String status = values != null && values.length == 1 ? values[0] : "";
        return Map.of("improvements", improvements.list(status));
    }

    @PostMapping("/api/admin/improvements")
    public ResponseEntity<Map<String, Object>> createAdmin(HttpServletRequest request) {
        ParsedImprovement parsed = parse(request, true);
        ObjectNode improvement = improvements.create(parsed.input(), parsed.attachments());
        audit.record(
            request,
            "improvement.create",
            improvement.path("id").asString(),
            Map.of("profile", "employee", "category", improvement.path("category").asString())
        );
        return ResponseEntity.status(201).body(Map.of(
            "message", "Sua sugestão interna foi registrada para triagem.",
            "id", improvement.path("id").asString()
        ));
    }

    @PatchMapping(
        value = "/api/admin/improvements/{id}",
        consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public Map<String, Object> updateStatus(
        @PathVariable String id,
        @RequestBody JsonNode body,
        HttpServletRequest request
    ) {
        JsonNode rawStatus = body == null ? null : body.get("status");
        return Map.of(
            "improvement",
            improvements.updateStatus(
                Sanitizers.text(id, 100),
                validator.status(rawStatus),
                request
            )
        );
    }

    @GetMapping("/api/admin/improvements/{id}/attachments/{attachmentId}")
    public ResponseEntity<Resource> attachment(
        @PathVariable String id,
        @PathVariable String attachmentId,
        HttpServletRequest request
    ) {
        ImprovementDownload attachment = improvements.attachment(id, attachmentId);
        FileSystemResource resource = new FileSystemResource(attachment.path());
        try {
            long lastModified = Files.getLastModifiedTime(attachment.path()).toMillis();
            long size = Files.size(attachment.path());
            var response = ResponseEntity.ok()
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition(attachment))
                .lastModified(lastModified)
                .eTag(weakEtag(size, lastModified))
                .contentType(MediaType.parseMediaType(attachment.mimeType()))
                .contentLength(size);
            return request.getMethod().equals("HEAD")
                ? response.body(null)
                : response.body(resource);
        } catch (IOException error) {
            throw new ApiException(404, "Anexo não encontrado.");
        }
    }

    private static String disposition(ImprovementDownload attachment) {
        return (attachment.inline() ? "inline" : "attachment")
            + "; filename*=UTF-8''" + encodeURIComponent(attachment.name());
    }

    static String encodeURIComponent(String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        StringBuilder encoded = new StringBuilder();
        for (byte item : bytes) {
            int valueByte = item & 0xff;
            char character = (char) valueByte;
            if (valueByte < 128 && (Character.isLetterOrDigit(character)
                || "-_.!~*'()".indexOf(character) >= 0)) {
                encoded.append(character);
            } else {
                encoded.append('%');
                encoded.append(Character.toUpperCase(Character.forDigit(valueByte >>> 4, 16)));
                encoded.append(Character.toUpperCase(Character.forDigit(valueByte & 15, 16)));
            }
        }
        return encoded.toString();
    }

    static String weakEtag(long size, long lastModified) {
        return "W/\"" + Long.toHexString(size) + "-" + Long.toHexString(lastModified) + "\"";
    }

    private ParsedImprovement parse(HttpServletRequest request, boolean admin) {
        String contentType = request.getContentType();
        if (contentType != null
            && contentType.split(";", 2)[0].trim().equalsIgnoreCase(MediaType.APPLICATION_JSON_VALUE)) {
            try {
                JsonNode body = mapper.readTree(request.getInputStream());
                return new ParsedImprovement(validator.parse(body, admin), List.of());
            } catch (IOException error) {
                throw new ApiException(400, "JSON inválido.");
            }
        }
        MultipartPayload.ImprovementForm form = MultipartPayload.improvement(request);
        return new ParsedImprovement(
            validator.parse(form.fields(), admin),
            form.attachments()
        );
    }

    private record ParsedImprovement(
        br.com.rodogarcia.cms.backend.model.improvement.ImprovementInput input,
        List<br.com.rodogarcia.cms.backend.model.improvement.ImprovementUpload> attachments
    ) {
    }
}
