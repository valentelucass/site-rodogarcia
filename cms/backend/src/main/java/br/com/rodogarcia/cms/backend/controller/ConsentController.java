package br.com.rodogarcia.cms.backend.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import br.com.rodogarcia.cms.backend.security.ClientIpResolver;
import br.com.rodogarcia.cms.backend.service.ConsentService;
import br.com.rodogarcia.cms.backend.service.RateLimitService;
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
public class ConsentController {

    private final ConsentService consent;
    private final RequestPolicy policy;
    private final RateLimitService rateLimits;
    private final ClientIpResolver clientIpResolver;

    public ConsentController(
        ConsentService consent,
        RequestPolicy policy,
        RateLimitService rateLimits,
        ClientIpResolver clientIpResolver
    ) {
        this.consent = consent;
        this.policy = policy;
        this.rateLimits = rateLimits;
        this.clientIpResolver = clientIpResolver;
    }

    @GetMapping({"/consent-settings", "/admin/consent-settings"})
    public Map<String, Object> settings() {
        return Map.of("settings", consent.readSettings());
    }

    @PostMapping("/consent-events")
    public ResponseEntity<Map<String, Object>> record(HttpServletRequest request) {
        policy.requireAllowedOrigin(request);
        policy.requireJson(request);
        rateLimits.require("consent", clientIpResolver.resolve(request), RateLimitService.CONSENT,
            "Muitas tentativas. Tente novamente mais tarde.");
        JsonNode body = JsonBodyCompatibilityFilter.parsedBody(request);
        JsonNode entry = consent.record(body, request);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("id", entry.path("id").asString());
        summary.put("createdAt", entry.path("createdAt").asString());
        summary.put("status", entry.path("status").asString());
        summary.put("version", entry.path("version").asInt());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Consentimento registrado.");
        response.put("consent", summary);
        return ResponseEntity.status(201).body(response);
    }

    @GetMapping("/admin/cookie-consents")
    public Map<String, Object> list(HttpServletRequest request) {
        return consent.list(br.com.rodogarcia.cms.backend.service.AuditService.queryParameters(request));
    }

    @PostMapping("/admin/consent-settings")
    public Map<String, Object> update(HttpServletRequest request) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Configuracao de LGPD/cookies atualizada.");
        response.put("settings", consent.updateSettings(
            JsonBodyCompatibilityFilter.parsedBody(request), request));
        return response;
    }
}
