package br.com.rodogarcia.cms.backend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rodogarcia.cms.backend.service.AuditService;
import br.com.rodogarcia.cms.backend.service.MediaService;
import br.com.rodogarcia.cms.backend.service.content.CmsContentService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class HomeCertificationControllerTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void exposesAndUpdatesTheDynamicHomeCertificationCollection() throws Exception {
        CmsContentService content = mock(CmsContentService.class);
        MediaService media = mock(MediaService.class);
        AuditService audit = mock(AuditService.class);
        ObjectNode home = mapper.createObjectNode();
        home.putArray("certifications").addObject()
            .put("id", "cert-iso")
            .put("title", "ISO 9001")
            .put("alt", "Logo ISO 9001")
            .put("image", "/uploads/iso.webp");
        when(content.home()).thenReturn(home);
        when(content.updateHome(any(), any())).thenReturn(home);
        when(media.homeCertificationImages()).thenReturn(mapper.createArrayNode());
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
            new HomeCertificationController(mapper, content, media, audit)
        ).build();

        mvc.perform(get("/api/admin/home/certifications"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].id").value("cert-iso"))
            .andExpect(jsonPath("$.images").isArray());

        mvc.perform(put("/api/admin/home/certifications")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[{\"id\":\"cert-iso\",\"title\":\"ISO 9001\",\"alt\":\"Logo ISO 9001\",\"image\":\"/uploads/iso.webp\"}]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Certificações da Home atualizadas."))
            .andExpect(jsonPath("$.items[0].image").value("/uploads/iso.webp"));
        verify(content).updateHome(any(), any());
        verify(audit).record(any(), any(), any(), any());
    }

    @Test
    void uploadsAnImageThroughTheHomePermissionRoute() throws Exception {
        CmsContentService content = mock(CmsContentService.class);
        MediaService media = mock(MediaService.class);
        AuditService audit = mock(AuditService.class);
        ObjectNode uploaded = mapper.createObjectNode()
            .put("url", "/uploads/logo.webp")
            .put("mediaType", "image");
        when(media.saveImageOnly(any(), any(), any(), any())).thenReturn(uploaded);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
            new HomeCertificationController(mapper, content, media, audit)
        ).build();

        mvc.perform(multipart("/api/admin/home/certifications/media")
                .file(new MockMultipartFile("media", "logo.png", "image/png", new byte[] {1, 2, 3})))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.message").value("Logo enviado com sucesso."))
            .andExpect(jsonPath("$.image.url").value("/uploads/logo.webp"));

        verify(media).saveImageOnly(any(), any(), any(), any());
    }
}
