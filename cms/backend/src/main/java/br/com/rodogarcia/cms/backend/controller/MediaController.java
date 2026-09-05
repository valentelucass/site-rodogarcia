package br.com.rodogarcia.cms.backend.controller;

import java.io.IOException;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.service.MediaService;
import br.com.rodogarcia.cms.backend.validation.MultipartPayload;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@RestController
public final class MediaController {
    private final MediaService media;
    private final JsonMapper mapper;

    public MediaController(MediaService media, JsonMapper mapper) {
        this.media = media;
        this.mapper = mapper;
    }

    @GetMapping("/api/admin/images")
    public ObjectNode images() {
        ObjectNode response = mediaNode();
        response.set("images", media.listAdminImages());
        return response;
    }

    @PostMapping("/api/admin/images")
    public ResponseEntity<ObjectNode> upload(HttpServletRequest request) {
        MultipartFile file = MultipartPayload.singleAdminMedia(request);
        if (file == null) throw new ApiException(422, "Selecione uma mídia para upload.");
        try {
            ObjectNode uploaded = media.save(
                file.getOriginalFilename() == null ? "" : file.getOriginalFilename(),
                file.getContentType() == null ? "" : file.getContentType(),
                file.getBytes(),
                request
            );
            ObjectNode response = mediaNode();
            response.put("message", "Midia enviada com sucesso.");
            response.set("image", uploaded);
            response.set("images", media.listAdminImages());
            return ResponseEntity.status(201).body(response);
        } catch (IOException error) {
            throw new ApiException(500, "Erro interno no servidor.");
        }
    }

    @DeleteMapping(value = "/api/admin/images", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ObjectNode delete(
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        String url = body == null ? "" : jsString(body.get("url"));
        boolean confirm = body != null && body.path("confirmInUse").isBoolean()
            && body.path("confirmInUse").booleanValue();
        ObjectNode deleted = media.delete(url, confirm, request);
        ObjectNode response = mediaNode();
        response.put("message", "Mídia excluída com sucesso.");
        deleted.properties().forEach(entry -> response.set(entry.getKey(), entry.getValue()));
        response.set("images", media.listAdminImages());
        return response;
    }

    @PostMapping(
        value = "/api/admin/images/replace-reference",
        consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public ObjectNode replace(
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        String fromUrl = body == null ? "" : jsString(body.get("fromUrl"));
        String toUrl = body == null ? "" : jsString(body.get("toUrl"));
        ObjectNode changed = media.replaceReferences(fromUrl, toUrl, request);
        ObjectNode response = mediaNode();
        response.put("message", "Referencias atualizadas com sucesso.");
        changed.properties().forEach(entry -> response.set(entry.getKey(), entry.getValue()));
        response.set("images", media.listAdminImages());
        return response;
    }

    @GetMapping("/api/admin/media-slots")
    public ObjectNode mediaSlots() {
        ObjectNode response = mediaNode();
        response.set("slots", media.readMediaSlots());
        return response;
    }

    @PostMapping(value = "/api/admin/media-slots", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ObjectNode updateMediaSlots(
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        ObjectNode response = mediaNode();
        response.put("message", "Slots de mídia atualizados.");
        response.set("slots", media.updateMediaSlots(body, request));
        return response;
    }

    private ObjectNode mediaNode() {
        return mapper.createObjectNode();
    }

    private static String jsString(JsonNode value) {
        if (value == null || value.isNull()) return "";
        if (value.isString() || value.isNumber() || value.isBoolean()) return value.asString();
        return value.toString();
    }
}
