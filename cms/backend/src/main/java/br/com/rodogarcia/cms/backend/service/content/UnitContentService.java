package br.com.rodogarcia.cms.backend.service.content;

import java.time.Clock;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.model.content.ContentTime;
import br.com.rodogarcia.cms.backend.repository.content.ContentRepository;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public final class UnitContentService {
    private static final Set<String> STATES = Set.of(
        "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg",
        "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to"
    );
    private static final Set<String> TYPES = Set.of("matriz", "filial", "ponto de apoio");

    private final JsonMapper mapper;
    private final ContentRepository repository;
    private final Clock clock;

    public UnitContentService(JsonMapper mapper, ContentRepository repository, Clock clock) {
        this.mapper = mapper;
        this.repository = repository;
        this.clock = clock;
    }

    public ArrayNode list() {
        return normalizedItems(repository.read().get("units"));
    }

    public MutationResult create(JsonNode bodyValue) {
        ObjectNode input = ContentJson.object(bodyValue);
        validateInput(input);
        ObjectNode payload = sanitizePayload(input);
        validatePayload(payload);
        String id = ContentJson.newId("units");
        ObjectNode updated = repository.update(content -> {
            ArrayNode collection = sorted(content.get("units"));
            int maxOrder = 0;
            for (JsonNode item : collection) maxOrder = Math.max(maxOrder, ContentJson.integer(item.get("order"), 0));
            String now = ContentTime.now(clock);
            ObjectNode created = mapper.createObjectNode();
            created.put("id", id);
            created.put("order", maxOrder + 1);
            created.put("createdAt", now);
            created.put("updatedAt", now);
            payload.properties().forEach(entry -> created.set(entry.getKey(), entry.getValue().deepCopy()));
            if (payload.path("isDefault").asBoolean(false)) {
                for (JsonNode raw : collection) if (raw.isObject()) ((ObjectNode) raw).put("isDefault", false);
            }
            collection.add(created);
            content.set("units", collection);
            return content;
        });
        ArrayNode items = normalizedItems(updated.get("units"));
        return new MutationResult(find(items, id), items);
    }

    public MutationResult update(String idValue, JsonNode bodyValue) {
        String id = ContentJson.text(mapper.valueToTree(idValue), 120);
        if (id.isEmpty()) throw new ApiException(404, "Item não encontrado.");
        ObjectNode body = ContentJson.object(bodyValue);
        ObjectNode updated = repository.update(content -> {
            ArrayNode collection = sorted(content.get("units"));
            int index = indexOf(collection, id);
            if (index < 0) throw new ApiException(404, "Item não encontrado.");
            ObjectNode current = ContentJson.object(collection.get(index));
            ObjectNode input = current.deepCopy();
            body.properties().forEach(entry -> input.set(entry.getKey(), entry.getValue().deepCopy()));
            validateInput(input);
            ObjectNode payload = sanitizePayload(input);
            validatePayload(payload);
            ObjectNode item = current.deepCopy();
            payload.properties().forEach(entry -> item.set(entry.getKey(), entry.getValue().deepCopy()));
            item.put("id", current.path("id").asString());
            if (current.has("order")) item.set("order", current.get("order").deepCopy());
            item.put("updatedAt", ContentTime.now(clock));
            if (payload.path("isDefault").asBoolean(false)) {
                for (JsonNode raw : collection) {
                    if (raw.isObject() && !id.equals(raw.path("id").asString())) ((ObjectNode) raw).put("isDefault", false);
                }
            }
            collection.set(index, item);
            content.set("units", collection);
            return content;
        });
        ArrayNode items = normalizedItems(updated.get("units"));
        return new MutationResult(find(items, id), items);
    }

    public ArrayNode delete(String id) {
        ObjectNode updated = repository.update(content -> {
            ArrayNode collection = sorted(content.get("units"));
            int index = indexOf(collection, id);
            if (index < 0) throw new ApiException(404, "Item não encontrado.");
            collection.remove(index);
            normalizeOrders(collection);
            content.set("units", collection);
            return content;
        });
        return normalizedItems(updated.get("units"));
    }

    public ArrayNode reorder(JsonNode orderedIdsValue) {
        ObjectNode updated = repository.update(content -> {
            ArrayNode collection = sorted(content.get("units"));
            ArrayNode orderedIds = ContentJson.array(orderedIdsValue);
            ArrayNode result = mapper.createArrayNode();
            Set<String> seen = new HashSet<>();
            for (JsonNode rawId : orderedIds) {
                String id = rawId.asString();
                if (!seen.add(id)) continue;
                int index = indexOf(collection, id);
                if (index >= 0) result.add(collection.get(index).deepCopy());
            }
            for (JsonNode item : collection) {
                if (seen.add(item.path("id").asString())) result.add(item.deepCopy());
            }
            normalizeOrders(result);
            content.set("units", result);
            return content;
        });
        return normalizedItems(updated.get("units"));
    }

    private ObjectNode sanitizePayload(ObjectNode source) {
        String type = firstText(source, 40, "type", "tipo").toLowerCase();
        ObjectNode result = mapper.createObjectNode();
        result.put("name", firstText(source, 120, "name", "nome"));
        result.put("type", TYPES.contains(type) ? type : "");
        result.put("state", state(first(source, "state", "estado")));
        result.put("city", firstText(source, 80, "city", "cidade"));
        result.put("address", firstText(source, 220, "address", "endereco"));
        result.put("phone", firstText(source, 60, "phone", "telefone"));
        result.put("email", ContentJson.email(source.get("email")));
        result.put("additionalEmail", ContentJson.email(source.get("additionalEmail")));
        result.put("contactUrl", ContentJson.url(first(source, "contactUrl", "linkContato")));
        result.put("description", firstText(source, 220, "description", "descricao"));
        result.put("logisticsInfo", firstText(source, 260, "logisticsInfo", "infoLogistica"));
        result.put("isDefault", booleanAlias(source, false, "isDefault", "matriz"));
        result.put("active", booleanAlias(source, true, "active", "ativo"));
        return result;
    }

    private ObjectNode normalizeItem(ObjectNode source) {
        ObjectNode result = source.deepCopy();
        ObjectNode normalized = sanitizePayload(source);
        normalized.properties().forEach(entry -> result.set(entry.getKey(), entry.getValue().deepCopy()));
        result.put("type", firstText(source, 40, "type", "tipo"));
        result.put("quoteCnpj", digits(source.get("quoteCnpj"), 14));
        result.put("genericPostalCode", digits(source.get("genericPostalCode"), 8));
        return result;
    }

    private void validateInput(ObjectNode input) {
        String email = ContentJson.text(input.get("email"), 160);
        if (!email.isEmpty() && ContentJson.email(input.get("email")).isEmpty()) {
            throw new ApiException(422, "Informe um e-mail válido para a unidade.");
        }
        String additional = ContentJson.text(input.get("additionalEmail"), 160);
        if (additional.isEmpty() || ContentJson.email(input.get("additionalEmail")).isEmpty()) {
            throw new ApiException(422, "Informe um e-mail adicional válido para a unidade.");
        }
        JsonNode contact = first(input, "contactUrl", "linkContato");
        if (!ContentJson.text(contact, 600).isEmpty() && ContentJson.url(contact).isEmpty()) {
            throw new ApiException(422, "Informe um link de contato válido.");
        }
        validateDigits(input.get("quoteCnpj"), 14, "CNPJ para cotação");
        validateDigits(input.get("genericPostalCode"), 8, "CEP genérico da cidade");
        validateBooleanAlias(input, "active", "ativo");
        validateBooleanAlias(input, "isDefault", "matriz");
    }

    private static void validatePayload(ObjectNode payload) {
        if (blank(payload, "name") || blank(payload, "type") || blank(payload, "state") || blank(payload, "address")) {
            throw new ApiException(422, "Nome, tipo, UF brasileira e endereço são obrigatórios.");
        }
        if (blank(payload, "phone") && blank(payload, "email")) {
            throw new ApiException(422, "Informe ao menos telefone ou e-mail da unidade.");
        }
        if (blank(payload, "additionalEmail")) {
            throw new ApiException(422, "Informe o e-mail adicional da unidade.");
        }
    }

    private ArrayNode normalizedItems(JsonNode value) {
        ArrayNode result = mapper.createArrayNode();
        for (JsonNode item : sorted(value)) result.add(normalizeItem(ContentJson.object(item)));
        return result;
    }

    private ArrayNode sorted(JsonNode value) {
        ArrayNode result = mapper.createArrayNode();
        ContentJson.array(value).valueStream().filter(JsonNode::isObject)
            .sorted(Comparator.comparingLong(item -> ContentJson.order(item.get("order"), 0)))
            .forEach(item -> result.add(item.deepCopy()));
        return result;
    }

    private static void normalizeOrders(ArrayNode items) {
        for (int index = 0; index < items.size(); index++) ((ObjectNode) items.get(index)).put("order", index + 1);
    }

    private static int indexOf(ArrayNode items, String id) {
        for (int index = 0; index < items.size(); index++) if (id.equals(items.get(index).path("id").asString())) return index;
        return -1;
    }

    private ObjectNode find(ArrayNode items, String id) {
        int index = indexOf(items, id);
        return index < 0 ? mapper.createObjectNode() : ContentJson.object(items.get(index)).deepCopy();
    }

    private static void validateDigits(JsonNode value, int length, String label) {
        String digits = digits(value, length + 10);
        if (!digits.isEmpty() && digits.length() != length) {
            throw new ApiException(422, label + " deve ter " + length + " dígitos.");
        }
    }

    private static void validateBooleanAlias(ObjectNode input, String key, String alias) {
        JsonNode value = input.has(key) ? input.get(key) : input.get(alias);
        if (value != null && !value.isNull() && !value.isBoolean()) {
            throw new ApiException(422, key + ": informe um valor booleano válido.");
        }
    }

    private static boolean booleanAlias(ObjectNode source, boolean fallback, String key, String alias) {
        return ContentJson.strictBoolean(source.has(key) ? source.get(key) : source.get(alias), fallback);
    }

    private static String state(JsonNode value) {
        String state = ContentJson.text(value, 2).toLowerCase().replaceAll("[^a-z]", "");
        return STATES.contains(state) ? state : "";
    }

    private static String firstText(ObjectNode source, int limit, String first, String second) {
        return ContentJson.text(first(source, first, second), limit);
    }

    private static JsonNode first(ObjectNode source, String first, String second) {
        return source.has(first) && !source.get(first).isNull() ? source.get(first) : source.get(second);
    }

    private static boolean blank(ObjectNode source, String key) {
        return ContentJson.text(source.get(key), 2000).isEmpty();
    }

    private static String digits(JsonNode value, int maxLength) {
        String digits = ContentJson.text(value, Math.max(20, maxLength)).replaceAll("\\D", "");
        return digits.length() <= maxLength ? digits : digits.substring(0, maxLength);
    }

    public record MutationResult(ObjectNode item, ArrayNode items) {
    }
}
