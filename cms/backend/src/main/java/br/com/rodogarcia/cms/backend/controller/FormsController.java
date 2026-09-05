package br.com.rodogarcia.cms.backend.controller;

import java.util.Map;

import br.com.rodogarcia.cms.backend.service.FormsService;
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
public class FormsController {

    private final FormsService forms;
    private final RequestPolicy policy;

    public FormsController(FormsService forms, RequestPolicy policy) {
        this.forms = forms;
        this.policy = policy;
    }

    @GetMapping("/contact")
    public Map<String, Object> contacts() {
        return Map.of("contacts", forms.listContacts());
    }

    @PostMapping("/contact")
    public ResponseEntity<Map<String, Object>> contact(HttpServletRequest request) {
        policy.requireJson(request);
        policy.requireAllowedOrigin(request);
        JsonNode body = JsonBodyCompatibilityFilter.parsedBody(request);
        JsonNode entry = forms.createContact(body, request);
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("message", "Mensagem recebida com sucesso.");
        response.put("id", entry.path("id").asString());
        return ResponseEntity.status(201).body(response);
    }

    @GetMapping("/quote")
    public Map<String, Object> quotes() {
        return Map.of("quotes", forms.listQuotes());
    }

    @PostMapping("/quote")
    public ResponseEntity<Map<String, Object>> quote(HttpServletRequest request) {
        policy.requireJson(request);
        policy.requireAllowedOrigin(request);
        JsonNode body = JsonBodyCompatibilityFilter.parsedBody(request);
        JsonNode entry = forms.createQuote(body, request);
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("message", "Solicitação de cotação recebida.");
        response.put("id", entry.path("id").asString());
        return ResponseEntity.status(201).body(response);
    }
}
