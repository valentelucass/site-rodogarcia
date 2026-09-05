package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.UnaryOperator;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.repository.content.ContentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

class UnitContentServiceTest {
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final AtomicReference<ObjectNode> state = new AtomicReference<>();
    private UnitContentService units;

    @BeforeEach
    void setUp() {
        ObjectNode initial = mapper.createObjectNode();
        initial.set("units", mapper.createArrayNode());
        state.set(initial);
        ContentRepository repository = mock(ContentRepository.class);
        when(repository.read()).thenAnswer(ignored -> state.get().deepCopy());
        when(repository.update(any())).thenAnswer(invocation -> {
            UnaryOperator<ObjectNode> operation = invocation.getArgument(0);
            ObjectNode updated = operation.apply(state.get().deepCopy());
            state.set(updated.deepCopy());
            return updated.deepCopy();
        });
        units = new UnitContentService(
            mapper,
            repository,
            Clock.fixed(Instant.parse("2026-09-03T12:00:00Z"), ZoneOffset.UTC)
        );
    }

    @Test
    void createsNormalizesAndReordersUnits() {
        ObjectNode first = valid("Matriz", "SP", true);
        UnitContentService.MutationResult created = units.create(first);

        assertThat(created.item().path("id").asString()).startsWith("units_");
        assertThat(created.item().path("state").asString()).isEqualTo("sp");
        assertThat(created.item().path("additionalEmail").asString()).isEqualTo("operacao@example.com");
        assertThat(created.item().path("createdAt").asString()).isEqualTo("2026-09-03T12:00:00.000Z");

        UnitContentService.MutationResult second = units.create(valid("Filial", "RJ", false));
        ArrayNode ids = mapper.createArrayNode().add(second.item().path("id").asString());
        ArrayNode reordered = units.reorder(ids);
        assertThat(reordered.get(0).path("name").asString()).isEqualTo("Filial");
        assertThat(reordered.get(0).path("order").asInt()).isEqualTo(1);
        assertThat(reordered.get(1).path("order").asInt()).isEqualTo(2);
    }

    @Test
    void rejectsInvalidAdditionalEmailBeforeWriting() {
        ObjectNode input = valid("Matriz", "SP", true);
        input.put("additionalEmail", "invalido");

        assertThatThrownBy(() -> units.create(input))
            .isInstanceOf(ApiException.class)
            .hasMessage("Informe um e-mail adicional válido para a unidade.");
        assertThat(state.get().path("units").isEmpty()).isTrue();
    }

    private ObjectNode valid(String name, String state, boolean isDefault) {
        return mapper.createObjectNode()
            .put("name", name)
            .put("type", isDefault ? "matriz" : "filial")
            .put("state", state)
            .put("city", "Agudos")
            .put("address", "Rua Teste, 10")
            .put("phone", "0800 000 000")
            .put("additionalEmail", "Operacao@Example.com")
            .put("contactUrl", "/fale-conosco")
            .put("isDefault", isDefault)
            .put("active", true);
    }
}
