package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import br.com.rodogarcia.cms.backend.repository.content.SeoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class SeoServiceTest {
    private static final String NOW = "2026-01-02T03:04:05.678Z";
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    @SuppressWarnings("unchecked")
    void omitsMissingRootTimestampLikeJsonStringifyButKeepsRepositoryDefaultTimestamp() {
        SeoRepository repository = mock(SeoRepository.class);
        ObjectProvider<ContentAuditTrail> audit = mock(ObjectProvider.class);
        SeoService service = new SeoService(
            mapper,
            repository,
            new TestContentMediaValidator(),
            audit,
            Clock.fixed(Instant.parse(NOW), ZoneOffset.UTC)
        );
        when(repository.read(any())).thenReturn(mapper.createObjectNode());

        ObjectNode existingWithoutTimestamp = service.readSettings();

        assertThat(existingWithoutTimestamp.path("pages")).hasSize(12);
        assertThat(existingWithoutTimestamp.has("updatedAt")).isFalse();

        when(repository.read(any())).thenAnswer(invocation -> {
            ObjectNode defaults = invocation.getArgument(0);
            return defaults.deepCopy();
        });
        ObjectNode missingFileDefaults = service.readSettings();
        assertThat(missingFileDefaults.path("updatedAt").asString()).isEqualTo(NOW);
    }
}
