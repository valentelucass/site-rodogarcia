package br.com.rodogarcia.cms.backend.controller;

import java.io.IOException;
import java.util.Map;

import br.com.rodogarcia.cms.backend.service.AuditService;
import br.com.rodogarcia.cms.backend.service.MediaService;
import br.com.rodogarcia.cms.backend.service.content.CmsContentService;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.validation.MultipartPayload;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@RestController
public final class HomeCertificationController {
    private final JsonMapper mapper;
    private final CmsContentService content;
    private final MediaService media;
    private final AuditService audit;

    public HomeCertificationController(
        JsonMapper mapper,
        CmsContentService content,
        MediaService media,
        AuditService audit
    ) {
        this.mapper = mapper;
        this.content = content;
        this.media = media;
        this.audit = audit;
    }

    @GetMapping("/api/admin/home/certifications")
    public ObjectNode certifications() {
        ObjectNode response = mapper.createObjectNode();
        response.set("items", content.home().path("certifications").deepCopy());
        response.set("images", media.homeCertificationImages());
        return response;
    }

    /**
     * Recebe o logo no próprio editor da Home, sem ampliar o acesso à tela de
     * Biblioteca. A persistência e o processamento continuam centralizados em
     * {@link MediaService}.
     */
    @PostMapping("/api/admin/home/certifications/media")
    public ResponseEntity<ObjectNode> uploadCertificationImage(HttpServletRequest request) {
        MultipartFile file = MultipartPayload.singleAdminMedia(request);
        if (file == null) throw new ApiException(422, "Selecione uma imagem para upload.");
        try {
            ObjectNode uploaded = media.saveImageOnly(
                file.getOriginalFilename() == null ? "" : file.getOriginalFilename(),
                file.getContentType() == null ? "" : file.getContentType(),
                file.getBytes(),
                request
            );
            ObjectNode response = mapper.createObjectNode();
            response.put("message", "Logo enviado com sucesso.");
            response.set("image", uploaded);
            return ResponseEntity.status(201).body(response);
        } catch (IOException error) {
            throw new ApiException(500, "Erro interno no servidor.");
        }
    }

    @PutMapping(value = "/api/admin/home/certifications", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ObjectNode updateCertifications(
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        ObjectNode home = content.updateHome("certifications", body);
        audit.record(request, "home.certifications_update", "home:certifications", Map.of(
            "count", Integer.toString(home.path("certifications").size())
        ));
        ObjectNode response = mapper.createObjectNode();
        response.put("message", "Certificações da Home atualizadas.");
        response.set("items", home.path("certifications").deepCopy());
        return response;
    }
}
