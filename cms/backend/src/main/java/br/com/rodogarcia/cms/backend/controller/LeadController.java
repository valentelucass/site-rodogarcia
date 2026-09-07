package br.com.rodogarcia.cms.backend.controller;

import java.util.Map;

import br.com.rodogarcia.cms.backend.service.AuditService;
import br.com.rodogarcia.cms.backend.service.LeadService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class LeadController {

    private final LeadService leads;

    public LeadController(LeadService leads) {
        this.leads = leads;
    }

    @GetMapping("/leads")
    public Map<String, Object> list(HttpServletRequest request) {
        Map<String, String> filters = AuditService.queryParameters(request);
        Map<String, Object> result = leads.listUnified(filters);
        if ("true".equalsIgnoreCase(filters.get("summary"))) {
            return Map.of("total", result.get("total"));
        }
        return result;
    }
}
