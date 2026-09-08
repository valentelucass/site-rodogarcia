package br.com.rodogarcia.landingbuilder.controller;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import br.com.rodogarcia.landingbuilder.exception.ApiException;
import br.com.rodogarcia.landingbuilder.service.CampaignService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

@RestController
@RequestMapping("/api/internal/landings")
public final class InternalLandingsController {

    private final CampaignService campaigns;

    public InternalLandingsController(CampaignService campaigns) {
        this.campaigns = campaigns;
    }

    @RequestMapping(method = {RequestMethod.GET, RequestMethod.HEAD})
    public Map<String, ArrayNode> list() {
        return Map.of("landings", campaigns.listInternal());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, ObjectNode> create(@RequestBody JsonNode body) {
        return Map.of("landing", campaigns.create(body));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, ObjectNode> update(@PathVariable String id, @RequestBody JsonNode body) {
        return Map.of("landing", campaigns.update(id, body));
    }

    @PostMapping("/{id}/publish")
    public Map<String, ObjectNode> publish(
        @PathVariable String id,
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        requireEmptyOrJson(request, body);
        return Map.of("landing", campaigns.setStatus(id, "published"));
    }

    @PostMapping("/{id}/unpublish")
    public Map<String, ObjectNode> unpublish(
        @PathVariable String id,
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        requireEmptyOrJson(request, body);
        return Map.of("landing", campaigns.setStatus(id, "unpublished"));
    }

    @PostMapping("/{id}/preview")
    public ObjectNode preview(
        @PathVariable String id,
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        requireEmptyOrJson(request, body);
        return campaigns.provisionPreview(id, previewRotateRequested(body));
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, ObjectNode> duplicate(
        @PathVariable String id,
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        requireEmptyOrJson(request, body);
        return Map.of("landing", campaigns.duplicate(id));
    }

    @PostMapping("/{id}/archive")
    public Map<String, ObjectNode> archive(
        @PathVariable String id,
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        requireEmptyOrJson(request, body);
        return Map.of("landing", campaigns.archive(id));
    }

    @DeleteMapping("/{id}")
    public Map<String, Boolean> delete(
        @PathVariable String id,
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        requireEmptyOrJson(request, body);
        campaigns.delete(id);
        return Map.of("ok", true);
    }

    @PostMapping(value = "/{id}/schedule", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, ObjectNode> schedule(@PathVariable String id, @RequestBody JsonNode body) {
        return Map.of("landing", campaigns.schedule(id, body));
    }

    @RequestMapping(value = "/{id}/revisions", method = {RequestMethod.GET, RequestMethod.HEAD})
    public Map<String, ArrayNode> revisions(@PathVariable String id) {
        return Map.of("revisions", campaigns.revisions(id));
    }

    @PostMapping("/{id}/revisions/{revisionId}/rollback")
    public Map<String, ObjectNode> rollback(
        @PathVariable String id,
        @PathVariable String revisionId,
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        requireEmptyOrJson(request, body);
        return Map.of("landing", campaigns.rollback(id, revisionId));
    }

    private static void requireEmptyOrJson(HttpServletRequest request, JsonNode body) {
        String contentLength = request.getHeader("Content-Length");
        boolean hasBody = request.getHeader("Transfer-Encoding") != null
            || (contentLength != null && !"0".equals(contentLength));
        if (hasBody && !isJson(request.getContentType())) {
            throw new ApiException("Use Content-Type: application/json.", 415);
        }
    }

    private static boolean previewRotateRequested(JsonNode body) {
        if (body == null || body.isNull() || body.isEmpty()) return false;
        if (!body.isObject() || body.size() != 1 || !body.has("rotate") || !body.path("rotate").isBoolean()) {
            throw new ApiException("Payload de prévia inválido.", 422);
        }
        return body.path("rotate").asBoolean();
    }

    private static boolean isJson(String contentType) {
        return contentType != null && contentType.toLowerCase().startsWith(MediaType.APPLICATION_JSON_VALUE);
    }
}
