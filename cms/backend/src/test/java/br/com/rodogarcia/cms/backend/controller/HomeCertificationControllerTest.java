package br.com.rodogarcia.cms.backend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rodogarcia.cms.backend.service.MediaService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class HomeCertificationControllerTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void preservesTheDedicatedHomeCertificationEnvelope() throws Exception {
        MediaService media = mock(MediaService.class);
        ObjectNode configuration = mapper.createObjectNode();
        configuration.putObject("slots").put("home.cert.iso", "/uploads/iso.webp");
        configuration.putArray("images");
        ObjectNode slots = mapper.createObjectNode().put("home.cert.iso", "/uploads/iso.webp");
        when(media.homeCertificationConfiguration()).thenReturn(configuration);
        when(media.updateHomeCertificationSlots(any(), any())).thenReturn(slots);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
            new HomeCertificationController(mapper, media)
        ).build();

        mvc.perform(get("/api/admin/home/certifications"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.slots['home.cert.iso']").value("/uploads/iso.webp"))
            .andExpect(jsonPath("$.images").isArray());

        mvc.perform(put("/api/admin/home/certifications")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"slots\":{\"home.cert.iso\":\"/uploads/iso.webp\"}}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Certificações da Home atualizadas."))
            .andExpect(jsonPath("$.slots['home.cert.iso']").value("/uploads/iso.webp"));
        verify(media).updateHomeCertificationSlots(any(), any());
    }
}
