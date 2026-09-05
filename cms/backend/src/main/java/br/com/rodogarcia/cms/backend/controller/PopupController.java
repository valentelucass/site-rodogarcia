package br.com.rodogarcia.cms.backend.controller;

import java.util.Map;

import br.com.rodogarcia.cms.backend.service.AuditService;
import br.com.rodogarcia.cms.backend.service.PopupService;
import br.com.rodogarcia.cms.backend.validation.JsonBodyCompatibilityFilter;
import br.com.rodogarcia.cms.backend.validation.RequestPolicy;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api")
public class PopupController {

    private final PopupService popup;
    private final RequestPolicy policy;

    public PopupController(PopupService popup, RequestPolicy policy) {
        this.popup = popup;
        this.policy = policy;
    }

    @GetMapping("/popup-config")
    public Map<String, Object> config() {
        return Map.of("config", popup.readConfig());
    }

    @PostMapping("/popup-config")
    public Map<String, Object> update(HttpServletRequest request) {
        policy.requireAllowedOrigin(request);
        policy.requireJson(request);
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("message", "Configuracao do popup atualizada com sucesso.");
        response.put("config", popup.updateConfig(
            JsonBodyCompatibilityFilter.parsedBody(request), request));
        return response;
    }

    @GetMapping("/leads")
    public Map<String, Object> leads() {
        return Map.of("leads", popup.listLeads());
    }

    @PostMapping("/leads")
    public ResponseEntity<Map<String, Object>> lead(HttpServletRequest request) {
        policy.requireAllowedOrigin(request);
        policy.requireJson(request);
        JsonNode body = JsonBodyCompatibilityFilter.parsedBody(request);
        JsonNode lead = popup.createLead(body, request);
        Map<String, Object> leadResponse = new java.util.LinkedHashMap<>();
        leadResponse.put("id", lead.path("id").asString());
        leadResponse.put("createdAt", lead.path("createdAt").asString());
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("message", "Lead recebido com sucesso.");
        response.put("lead", leadResponse);
        return ResponseEntity.status(201).body(response);
    }

    @GetMapping("/popup-events")
    public Map<String, Object> events(HttpServletRequest request) {
        String days = AuditService.queryParameter(request, "days", "30");
        return popup.events(AuditService.jsNumber(days));
    }

    @PostMapping("/popup-events")
    public ResponseEntity<Map<String, String>> event(HttpServletRequest request) {
        policy.requireAllowedOrigin(request);
        policy.requireJson(request);
        JsonNode body = JsonBodyCompatibilityFilter.parsedBody(request);
        popup.createEvent(body, request);
        return ResponseEntity.status(201).body(Map.of("message", "Evento registrado."));
    }
}
