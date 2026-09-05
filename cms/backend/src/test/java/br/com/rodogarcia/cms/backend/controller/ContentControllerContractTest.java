package br.com.rodogarcia.cms.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import br.com.rodogarcia.cms.backend.model.auth.SessionRecord;
import br.com.rodogarcia.cms.backend.model.auth.UserRecord;
import br.com.rodogarcia.cms.backend.security.AuthenticatedUser;
import br.com.rodogarcia.cms.backend.security.SecurityContext;
import br.com.rodogarcia.cms.backend.service.AuthService;
import br.com.rodogarcia.cms.backend.service.content.CmsContentService;
import br.com.rodogarcia.cms.backend.service.content.ContentAuditTrail;
import br.com.rodogarcia.cms.backend.service.content.PublicContentService;
import br.com.rodogarcia.cms.backend.service.content.SeoService;
import br.com.rodogarcia.cms.backend.service.content.UnitContentService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class ContentControllerContractTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void preservesPublicContentMediaAndSeoEnvelopes() throws Exception {
        PublicContentService publicContent = mock(PublicContentService.class);
        ObjectNode content = mapper.createObjectNode();
        content.putObject("homePage");
        ObjectNode slots = mapper.createObjectNode();
        slots.putObject("slots").put("home.hero", "/hero.webp");
        when(publicContent.publicContent()).thenReturn(content);
        when(publicContent.publicMediaSlots()).thenReturn(slots);
        SeoService seo = mock(SeoService.class);
        ObjectNode seoPage = mapper.createObjectNode().put("path", "/sobre");
        when(seo.publicPage(any())).thenReturn(seoPage);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
            new PublicContentController(publicContent), new SeoController(mapper, seo)).build();

        mvc.perform(get("/api/public/content"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.homePage").isMap());
        mvc.perform(get("/api/public/media-slots"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.slots['home.hero']").value("/hero.webp"));
        mvc.perform(get("/api/public/seo").param("path", "/sobre"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.seo.path").value("/sobre"));
    }

    @Test
    void treatsRepeatedSeoPathAsRootAndKeepsTheExplicitNullEnvelope() throws Exception {
        SeoService seo = mock(SeoService.class);
        when(seo.publicPage(any())).thenReturn(null);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new SeoController(mapper, seo)).build();

        mvc.perform(get("/api/public/seo").param("path", "/sobre", "/cotacao"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.seo").doesNotExist());

        ArgumentCaptor<JsonNode> path = ArgumentCaptor.forClass(JsonNode.class);
        verify(seo).publicPage(path.capture());
        assertThat(path.getValue().asString()).isEqualTo("/");
    }

    @Test
    void preservesAdminMutationStatusesAndMessages() throws Exception {
        CmsContentService content = mock(CmsContentService.class);
        UnitContentService units = mock(UnitContentService.class);
        AuthService auth = mock(AuthService.class);
        ContentAuditTrail audit = mock(ContentAuditTrail.class);
        ObjectNode object = mapper.createObjectNode();
        var items = mapper.createArrayNode();
        when(content.updateHome(eq("section1"), any())).thenReturn(object);
        when(content.updateServices(eq("finalCta"), any())).thenReturn(object);
        when(content.updatePage(eq("about"), eq("hero"), any())).thenReturn(object);
        when(content.updateFooter(eq("footer"), any())).thenReturn(object);
        when(content.updateNavigation(any())).thenReturn(object);
        when(content.updateSiteTexts(any())).thenReturn(object);
        when(units.create(any())).thenReturn(new UnitContentService.MutationResult(object, items));
        when(units.update(eq("unit-1"), any())).thenReturn(new UnitContentService.MutationResult(object, items));
        when(units.delete("unit-1")).thenReturn(items);
        when(units.reorder(org.mockito.ArgumentMatchers.nullable(JsonNode.class))).thenReturn(items);
        ContentAdminController controller = new ContentAdminController(
            mapper, auth, content, units, audit);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller).build();

        expectMessage(mvc, put("/api/admin/home/section-1"), "Home atualizada com sucesso.", 200);
        expectMessage(mvc, put("/api/admin/services-page/final-cta"), "Página Serviços atualizada com sucesso.", 200);
        expectMessage(mvc, put("/api/admin/pages/about/hero"), "Pagina atualizada com sucesso.", 200);
        expectMessage(mvc, put("/api/admin/footer-links/footer"), "FOOTER LINKS atualizado com sucesso.", 200);
        expectMessage(mvc, put("/api/admin/header-navigation"), "Navegação atualizada com sucesso.", 200);
        expectMessage(mvc, post("/api/admin/site-texts"), "Textos atualizados com sucesso.", 200);
        expectMessage(mvc, post("/api/admin/units"), "Item criado com sucesso.", 201);
        expectMessage(mvc, post("/api/admin/units/reorder"), "Ordem atualizada.", 200);
        expectMessage(mvc, put("/api/admin/units/unit-1"), "Item atualizado com sucesso.", 200);
        mvc.perform(delete("/api/admin/units/unit-1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Item removido com sucesso."));
    }

    @Test
    void keepsAuthenticatedAdminReadEnvelope() throws Exception {
        CmsContentService content = mock(CmsContentService.class);
        UnitContentService units = mock(UnitContentService.class);
        AuthService auth = mock(AuthService.class);
        ContentAuditTrail audit = mock(ContentAuditTrail.class);
        when(content.content()).thenReturn(mapper.createObjectNode());
        when(auth.publicUser(any())).thenReturn(Map.of("id", "user-1"));
        UserRecord user = new UserRecord();
        user.setId("user-1");
        SessionRecord session = new SessionRecord("sid", "user-1", "csrf-value", 1, 2);
        AuthenticatedUser authenticated = new AuthenticatedUser(session, user);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
            new ContentAdminController(mapper, auth, content, units, audit)).build();

        mvc.perform(get("/api/admin/content")
                .requestAttr(SecurityContext.AUTH_ATTRIBUTE, authenticated))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.id").value("user-1"))
            .andExpect(jsonPath("$.csrfToken").value("csrf-value"))
            .andExpect(jsonPath("$.content").isMap());
    }

    private static void expectMessage(
        MockMvc mvc,
        org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
        String message,
        int status
    ) throws Exception {
        mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().is(status))
            .andExpect(jsonPath("$.message").value(message));
    }
}
