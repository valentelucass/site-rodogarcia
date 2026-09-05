package br.com.rodogarcia.site.backend.integration.esl;

import java.io.IOException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import br.com.rodogarcia.site.backend.config.ApplicationProperties;
import br.com.rodogarcia.site.backend.exception.ApiException;
import br.com.rodogarcia.site.backend.integration.RestClientFactory;
import br.com.rodogarcia.site.backend.utils.NodeCompatibleJsonBytes;
import br.com.rodogarcia.site.backend.validation.StrictJson;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.NullNode;

@Component
public class EslGraphqlClient {

    static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);

    static {
        RestClientFactory.configureNodeFetchRedirectLimit();
    }

    private final ApplicationProperties properties;
    private final EslRequestScheduler scheduler;
    private final JsonMapper jsonMapper;
    private final RestClient restClient;

    @Autowired
    public EslGraphqlClient(
        ApplicationProperties properties,
        EslRequestScheduler scheduler,
        JsonMapper jsonMapper,
        RestClient.Builder restClientBuilder
    ) {
        this.properties = properties;
        this.scheduler = scheduler;
        this.jsonMapper = jsonMapper;
        HttpClient httpClient = RestClientFactory.nodeCompatibleHttpClientBuilder(REQUEST_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(REQUEST_TIMEOUT);
        this.restClient = restClientBuilder.requestFactory(requestFactory).build();
    }

    EslGraphqlClient(
        ApplicationProperties properties,
        EslRequestScheduler scheduler,
        JsonMapper jsonMapper,
        RestClient restClient
    ) {
        this.properties = properties;
        this.scheduler = scheduler;
        this.jsonMapper = jsonMapper;
        this.restClient = restClient;
    }

    public JsonNode execute(String query, Map<String, ?> variables) {
        if (properties.eslGraphqlApiKey().isEmpty() || properties.eslGraphqlUrl().isEmpty()) {
            throw new ApiException(503, "A integração com o ESL não está configurada.");
        }

        try {
            return scheduler.run(() -> exchange(query, variables));
        } catch (ApiException | EslGraphqlResponseException error) {
            throw error;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw unavailable(error);
        } catch (Exception error) {
            RuntimeException known = knownProviderException(error);
            if (known != null) {
                throw known;
            }
            throw unavailable(error);
        }
    }

    private static RuntimeException knownProviderException(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof ApiException apiException) {
                return apiException;
            }
            if (current instanceof EslGraphqlResponseException graphqlException) {
                return graphqlException;
            }
            current = current.getCause();
        }
        return null;
    }

    private JsonNode exchange(String query, Map<String, ?> variables) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("query", query);
        body.put("variables", variables);
        byte[] serializedBody;
        try {
            serializedBody = NodeCompatibleJsonBytes.normalize(jsonMapper.writeValueAsBytes(body));
        } catch (JacksonException error) {
            throw unavailable(error);
        }

        return restClient.post()
            .uri(properties.eslGraphqlUrl())
            .contentType(MediaType.APPLICATION_JSON)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.eslGraphqlApiKey())
            .body(serializedBody)
            .exchange((request, response) -> {
                int status = response.getStatusCode().value();
                byte[] bytes;
                try {
                    bytes = response.getBody().readAllBytes();
                } catch (IOException error) {
                    if (status >= 200 && status < 300) {
                        throw new ApiException(502, "O ESL retornou uma resposta inválida.");
                    }
                    return throwForHttpStatus(status);
                }
                if (status < 200 || status >= 300) {
                    return throwForHttpStatus(status);
                }

                JsonNode payload = parse(bytes);
                if (payload == null || !payload.isObject()) {
                    throw new ApiException(502, "O ESL retornou uma resposta inválida.");
                }
                List<String> errors = graphqlErrors(payload.get("errors"));
                if (!errors.isEmpty()) {
                    throw new EslGraphqlResponseException(errors);
                }
                JsonNode data = payload.get("data");
                return data == null ? NullNode.getInstance() : data;
            });
    }

    private static JsonNode throwForHttpStatus(int status) {
        if (status == 429) {
            throw new ApiException(
                503,
                "O ESL está temporariamente indisponível. Tente novamente em alguns segundos."
            );
        }
        throw new ApiException(
            502,
            "Não foi possível comunicar com o ESL. Tente novamente mais tarde."
        );
    }

    private JsonNode parse(byte[] bytes) {
        try {
            return StrictJson.readTree(jsonMapper, bytes);
        } catch (JacksonException ignored) {
            return null;
        }
    }

    private static List<String> graphqlErrors(JsonNode value) {
        if (value == null || !value.isArray()) {
            return List.of();
        }
        List<String> errors = new ArrayList<>();
        for (JsonNode item : value) {
            JsonNode message = item.isObject() ? item.get("message") : null;
            if (message != null && message.isString() && !message.stringValue().isEmpty()) {
                errors.add(message.stringValue());
            }
        }
        return errors;
    }

    private static ApiException unavailable(Exception error) {
        return new ApiException(
            503,
            "Não foi possível comunicar com o ESL. Tente novamente mais tarde.",
            error
        );
    }
}
