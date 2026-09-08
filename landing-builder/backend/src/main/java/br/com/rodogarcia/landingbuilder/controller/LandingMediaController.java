package br.com.rodogarcia.landingbuilder.controller;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import br.com.rodogarcia.landingbuilder.exception.ApiException;
import br.com.rodogarcia.landingbuilder.service.LandingMediaService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.multipart.MultipartFile;

@RestController
public final class LandingMediaController {

    private final LandingMediaService media;

    public LandingMediaController(LandingMediaService media) {
        this.media = media;
    }

    @RequestMapping(value = "/landing-media/{id}", method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<FileSystemResource> serve(@PathVariable String id) {
        LandingMediaService.ResolvedMedia resolved = media.resolve(id);
        if (resolved == null) throw new ApiException("Mídia não encontrada.", 404);
        String mimeType = resolved.record().path("mimeType").asString(MediaType.APPLICATION_OCTET_STREAM_VALUE);
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().build().toString())
            .contentType(MediaType.parseMediaType(mimeType))
            .body(new FileSystemResource(resolved.filePath()));
    }

    @RequestMapping(value = "/api/internal/media", method = {RequestMethod.GET, RequestMethod.HEAD})
    public Map<String, ArrayNode> list() {
        return Map.of("media", media.list());
    }

    @PostMapping(value = "/api/internal/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, ObjectNode> upload(
        @RequestPart(name = "file", required = false) MultipartFile file,
        @RequestPart(name = "alt", required = false) String alt
    ) {
        return Map.of("media", media.save(file, alt));
    }

    @PutMapping(value = "/api/internal/media/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, ObjectNode> update(@PathVariable String id, @RequestBody JsonNode body) {
        return Map.of("media", media.updateMetadata(id, body));
    }

    @DeleteMapping("/api/internal/media/{id}")
    public Map<String, Boolean> delete(
        @PathVariable String id,
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        String contentLength = request.getHeader("Content-Length");
        boolean hasBody = request.getHeader("Transfer-Encoding") != null
            || (contentLength != null && !"0".equals(contentLength));
        if (hasBody && (request.getContentType() == null
            || !request.getContentType().toLowerCase().startsWith(MediaType.APPLICATION_JSON_VALUE))) {
            throw new ApiException("Use Content-Type: application/json.", 415);
        }
        media.delete(id);
        return Map.of("ok", true);
    }
}
