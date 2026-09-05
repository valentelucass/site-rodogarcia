package br.com.rodogarcia.cms.backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.UnaryOperator;

import br.com.rodogarcia.cms.backend.model.content.ContentDefaults;
import br.com.rodogarcia.cms.backend.model.content.ContentKeys;
import br.com.rodogarcia.cms.backend.repository.content.ContentRepository;
import br.com.rodogarcia.cms.backend.repository.content.SiteTextsRepository;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class CmsContentServiceTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void updatesAllTwentyThreePageSectionContractsFromCanonicalPayloads() {
        AtomicReference<ObjectNode> state = new AtomicReference<>(ContentDefaults.content(mapper));
        ContentRepository repository = mock(ContentRepository.class);
        when(repository.read()).thenAnswer(ignored -> state.get().deepCopy());
        when(repository.update(any())).thenAnswer(invocation -> {
            UnaryOperator<ObjectNode> operation = invocation.getArgument(0);
            ObjectNode updated = operation.apply(state.get().deepCopy());
            state.set(updated.deepCopy());
            return updated.deepCopy();
        });
        SiteTextsRepository siteTexts = mock(SiteTextsRepository.class);
        TestContentMediaValidator media = new TestContentMediaValidator();
        StructuredContentSanitizer sanitizer = new StructuredContentSanitizer(mapper, media);
        CmsContentService service = new CmsContentService(
            mapper,
            repository,
            siteTexts,
            new HomeContentAdminService(mapper, media),
            new ServicesContentAdminService(mapper, media),
            sanitizer,
            new ContentValidators(),
            media
        );

        int combinations = 0;
        for (Map.Entry<String, java.util.Set<String>> pageEntry : ContentKeys.PAGE_SECTIONS.entrySet()) {
            String pageKey = pageEntry.getKey();
            for (String sectionKey : pageEntry.getValue()) {
                ObjectNode defaults = ContentDefaults.page(mapper, pageKey);
                JsonNode payload = payload(defaults, pageKey, sectionKey);

                ObjectNode updated = service.updatePage(pageKey, sectionKey, payload);

                assertThat(updated).as(pageKey + "/" + sectionKey).isNotNull();
                combinations++;
            }
        }
        assertThat(combinations).isEqualTo(23);
    }

    private JsonNode payload(ObjectNode page, String pageKey, String sectionKey) {
        if (pageKey.equals("contact") && sectionKey.equals("hero")) {
            return page.get("heroWhatsappButton").deepCopy();
        }
        if ((pageKey.equals("contact") && sectionKey.equals("mainChannels"))
            || (pageKey.equals("careers") && sectionKey.equals("jobs"))
            || (pageKey.equals("quote") && (sectionKey.equals("directChannels") || sectionKey.equals("otherChannels")))) {
            ObjectNode wrapper = mapper.createObjectNode();
            wrapper.set(sectionKey, page.get(sectionKey).deepCopy());
            return wrapper;
        }
        return page.get(sectionKey).deepCopy();
    }
}
