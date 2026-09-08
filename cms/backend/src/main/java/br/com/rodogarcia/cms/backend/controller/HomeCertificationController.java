package br.com.rodogarcia.cms.backend.controller;

import br.com.rodogarcia.cms.backend.service.MediaService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@RestController
public final class HomeCertificationController {
    private final JsonMapper mapper;
    private final MediaService media;

    public HomeCertificationController(JsonMapper mapper, MediaService media) {
        this.mapper = mapper;
        this.media = media;
    }

    @GetMapping("/api/admin/home/certifications")
    public ObjectNode certifications() {
        return media.homeCertificationConfiguration();
    }

    @PutMapping(value = "/api/admin/home/certifications", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ObjectNode updateCertifications(
        @RequestBody(required = false) JsonNode body,
        HttpServletRequest request
    ) {
        ObjectNode response = mapper.createObjectNode();
        response.put("message", "Certificações da Home atualizadas.");
        response.set("slots", media.updateHomeCertificationSlots(body, request));
        return response;
    }
}
