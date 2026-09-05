package br.com.rodogarcia.cms.backend.validation;

import java.util.List;
import java.util.Map;
import java.util.Set;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.improvement.ImprovementInput;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.StringNode;

@Component
public final class ImprovementValidator {
    private static final Set<String> PROFILES = Set.of("site_user", "employee");
    private static final Set<String> SITE_CATEGORIES = Set.of(
        "site_suggestion", "site_problem", "site_accessibility", "site_content"
    );
    private static final Set<String> STATUSES = Set.of("pending", "completed", "archived");

    public ImprovementInput parse(Map<String, List<String>> form, boolean admin) {
        String profile = text(form, "profile", 40);
        if (!PROFILES.contains(profile)) {
            throw invalid("Invalid option: expected one of \"site_user\"|\"employee\"");
        }

        String name = text(form, "name", 100);
        if (name.isEmpty()) throw invalid("Informe seu nome.");

        String email = Sanitizers.email(node(scalar(form, "email")));
        if (email.isEmpty()) throw invalid("Informe um e-mail válido.");

        String phone = phoneValue(form)
            .replaceAll("\\D", "");
        if (!phone.isEmpty() && phone.length() != 10 && phone.length() != 11) {
            throw invalid("Informe um telefone brasileiro válido.");
        }

        String category = text(form, "category", 60);
        if (category.isEmpty()) throw invalid("Escolha um tipo de melhoria.");

        String message = text(form, "message", 2_000);
        if (message.length() < 10) throw invalid("Descreva a melhoria com mais detalhes.");

        String page = text(form, "page", 180);
        String branch = text(form, "branch", 100);
        String area = text(form, "area", 100);
        String expectedResult = text(form, "expectedResult", 800);
        String applicationPlace = text(form, "applicationPlace", 180);

        if (profile.equals("site_user") && !SITE_CATEGORIES.contains(category)) {
            throw invalid("Escolha uma categoria relacionada ao site.");
        }
        if (!admin && profile.equals("employee") && branch.isEmpty()) {
            throw invalid("Informe a filial em que trabalha.");
        }
        if (admin && !profile.equals("employee")) {
            throw invalid("O CMS aceita somente sugestões de colaboradores.");
        }

        return new ImprovementInput(
            profile, name, email, phone, category, message, page, branch, area,
            expectedResult, applicationPlace
        );
    }

    public ImprovementInput parse(JsonNode body, boolean admin) {
        Map<String, List<String>> form = new java.util.LinkedHashMap<>();
        if (body != null && body.isObject()) {
            body.properties().forEach(entry -> {
                JsonNode value = entry.getValue();
                if (value != null && (value.isString() || value.isNumber())) {
                    form.put(entry.getKey(), List.of(value.asString()));
                }
            });
        }
        return parse(form, admin);
    }

    public String status(Object value) {
        String normalized = Sanitizers.text(value, 20);
        if (!STATUSES.contains(normalized)) throw invalid("Status de melhoria inválido.");
        return normalized;
    }

    public String status(JsonNode value) {
        String normalized = Sanitizers.text(value, 20);
        if (!STATUSES.contains(normalized)) throw invalid("Status de melhoria inválido.");
        return normalized;
    }

    private static String text(Map<String, List<String>> form, String key, int maxLength) {
        String value = scalar(form, key);
        return value == null ? "" : Sanitizers.text(value, maxLength);
    }

    private static String scalar(Map<String, List<String>> form, String key) {
        List<String> values = form.get(key);
        return values != null && values.size() == 1 ? values.getFirst() : null;
    }

    private static String phoneValue(Map<String, List<String>> form) {
        List<String> values = form.get("phone");
        if (values == null || values.isEmpty()) return "";
        return String.join(",", values);
    }

    private static StringNode node(String value) {
        return StringNode.valueOf(value == null ? "" : value);
    }

    private static ApiException invalid(String message) {
        return new ApiException(422, message);
    }
}
