package br.com.rodogarcia.cms.backend.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.repository.JsonCollections;
import br.com.rodogarcia.cms.backend.security.ClientIpResolver;
import br.com.rodogarcia.cms.backend.utils.Ids;
import br.com.rodogarcia.cms.backend.utils.IsoTime;
import br.com.rodogarcia.cms.backend.utils.Sanitizers;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

@Service
public class FormsService {

    private final JsonCollections collections;
    private final StoragePaths paths;
    private final RateLimitService rateLimits;
    private final ClientIpResolver clientIpResolver;
    private final LeadService leads;
    private final TrackingService tracking;
    private final Clock clock;

    public FormsService(
        JsonCollections collections,
        StoragePaths paths,
        RateLimitService rateLimits,
        ClientIpResolver clientIpResolver,
        LeadService leads,
        TrackingService tracking,
        Clock clock
    ) {
        this.collections = collections;
        this.paths = paths;
        this.rateLimits = rateLimits;
        this.clientIpResolver = clientIpResolver;
        this.leads = leads;
        this.tracking = tracking;
        this.clock = clock;
    }

    public ObjectNode createContact(JsonNode body, HttpServletRequest request) {
        rateLimits.require(
            "contact", clientIpResolver.resolve(request), RateLimitService.LEAD,
            "Limite de envios atingido. Tente novamente mais tarde."
        );
        requireObject(body);
        ObjectNode entry = JsonNodeFactory.instance.objectNode();
        entry.put("id", Ids.generate("contact"));
        entry.put("createdAt", IsoTime.format(clock.millis()));
        entry.put("name", Sanitizers.text(body.get("name"), 80));
        entry.put("email", Sanitizers.email(body.get("email")));
        entry.put("phone", Sanitizers.text(body.get("phone"), 20));
        entry.put("subject", Sanitizers.text(body.get("subject"), 120));
        entry.put("message", Sanitizers.text(body.get("message"), 2_000));
        entry.put("userAgent", Sanitizers.text(request.getHeader("User-Agent"), 240));
        if (entry.path("name").asString().isEmpty() || entry.path("email").asString().isEmpty()
            || entry.path("message").asString().isEmpty()) {
            throw new ApiException(422, "Nome, e-mail e mensagem são obrigatórios.");
        }
        append(paths.contacts(), entry);
        ObjectNode metadata = JsonNodeFactory.instance.objectNode();
        metadata.put("subject", entry.path("subject").asString());
        metadata.put("contactId", entry.path("id").asString());
        leads.create(
            entry.path("id").asString(), request, "contact-form", JsonNodeFactory.instance.stringNode("/fale-conosco"),
            entry.get("name"), entry.get("email"), entry.get("phone"), null, null, metadata
        );
        recordFormSubmit("/fale-conosco", "contact-form", "contactId", entry.path("id").asString(), request);
        return entry;
    }

    public ObjectNode createQuote(JsonNode body, HttpServletRequest request) {
        rateLimits.require(
            "quote", clientIpResolver.resolve(request), RateLimitService.LEAD,
            "Limite de envios atingido. Tente novamente mais tarde."
        );
        requireObject(body);
        ObjectNode entry = JsonNodeFactory.instance.objectNode();
        entry.put("id", Ids.generate("quote"));
        entry.put("createdAt", IsoTime.format(clock.millis()));
        entry.put("name", Sanitizers.text(body.get("name"), 80));
        entry.put("company", Sanitizers.text(body.get("company"), 120));
        entry.put("email", Sanitizers.email(body.get("email")));
        entry.put("phone", Sanitizers.text(body.get("phone"), 20));
        entry.put("origin", Sanitizers.text(body.get("origin"), 120));
        entry.put("destination", Sanitizers.text(body.get("destination"), 120));
        entry.put("cargoType", Sanitizers.text(body.get("cargoType"), 80));
        entry.put("weight", Sanitizers.text(body.get("weight"), 40));
        entry.put("notes", Sanitizers.text(body.get("notes"), 1_000));
        entry.put("userAgent", Sanitizers.text(request.getHeader("User-Agent"), 240));
        if (entry.path("name").asString().isEmpty() || entry.path("email").asString().isEmpty()
            || entry.path("origin").asString().isEmpty() || entry.path("destination").asString().isEmpty()) {
            throw new ApiException(422, "Nome, e-mail, origem e destino são obrigatórios.");
        }
        append(paths.quotes(), entry);
        ObjectNode metadata = JsonNodeFactory.instance.objectNode();
        metadata.put("origin", entry.path("origin").asString());
        metadata.put("destination", entry.path("destination").asString());
        metadata.put("quoteId", entry.path("id").asString());
        leads.create(
            entry.path("id").asString(), request, "quote-form", JsonNodeFactory.instance.stringNode("/cotacao"),
            entry.get("name"), entry.get("email"), entry.get("phone"), entry.get("company"), null, metadata
        );
        recordFormSubmit("/cotacao", "quote-form", "quoteId", entry.path("id").asString(), request);
        return entry;
    }

    public List<JsonNode> listContacts() {
        return sorted(paths.contacts());
    }

    public List<JsonNode> listQuotes() {
        return sorted(paths.quotes());
    }

    private void append(java.nio.file.Path path, ObjectNode value) {
        collections.mutate(path, items -> {
            items.add(value.deepCopy());
            return null;
        });
    }

    private List<JsonNode> sorted(java.nio.file.Path path) {
        List<JsonNode> result = new ArrayList<>();
        collections.read(path).forEach(value -> result.add(value.deepCopy()));
        result.sort(Comparator.comparing(
            value -> value.path("createdAt").asString(), Comparator.reverseOrder()
        ));
        return result;
    }

    private void recordFormSubmit(
        String page,
        String source,
        String metadataKey,
        String id,
        HttpServletRequest request
    ) {
        ObjectNode event = JsonNodeFactory.instance.objectNode();
        event.put("event", "form_submit");
        event.put("page", page);
        event.put("source", source);
        event.putObject("metadata").put(metadataKey, id);
        tracking.record(event, request);
    }

    private static void requireObject(JsonNode body) {
        if (body == null || !body.isObject()) throw new ApiException(422, "Envie um objeto JSON válido.");
    }
}
