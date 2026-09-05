package br.com.rodogarcia.cms.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import br.com.rodogarcia.cms.backend.exception.GlobalExceptionHandler;
import br.com.rodogarcia.cms.backend.support.MediaTestContext;
import br.com.rodogarcia.cms.backend.validation.ImprovementValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.JsonNode;

class ImprovementControllerTest {
    private static final Instant NOW = Instant.parse("2026-03-02T00:00:00.000Z");

    @TempDir
    Path root;

    private MediaTestContext context;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        context = new MediaTestContext(root, Clock.fixed(NOW, ZoneOffset.UTC));
        ImprovementController controller = new ImprovementController(
            context.improvements,
            new ImprovementValidator(),
            context.audit,
            context.mapper
        );
        mvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    @Test
    void acceptsJsonAndMultipartUsingTheNodeResponseContract() throws Exception {
        mvc.perform(post("/api/improvements")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "profile":"site_user",
                      "name":"Ana Silva",
                      "email":"ana@example.com",
                      "category":"site_suggestion",
                      "message":"O formulário poderia explicar melhor o próximo passo.",
                      "page":"/cotacao"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.message")
                .value("Sua sugestão foi recebida. Obrigado por contribuir."))
            .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.matchesPattern(
                "improvement_[0-9a-f]{32}"
            )));

        MockMultipartFile attachment = new MockMultipartFile(
            "attachments",
            "evidência.csv",
            "text/csv",
            "coluna,valor\nstatus,ok".getBytes(StandardCharsets.UTF_8)
        );
        String body = mvc.perform(multipart("/api/improvements")
                .file(attachment)
                .param("profile", "site_user")
                .param("name", "Bruno Costa")
                .param("email", "bruno@example.com")
                .param("category", "site_problem")
                .param("message", "O botão de cotação não deixa claro o próximo passo.")
                .param("page", "/cotacao"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.message")
                .value("Sua sugestão foi recebida. Obrigado por contribuir."))
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        String improvementId = context.mapper.readTree(body).path("id").asString();
        assertThat(context.improvements.list("")).hasSize(2);
        assertThat(improvementId).matches("improvement_[0-9a-f]{32}");
        mvc.perform(get("/api/admin/improvements")
                .queryParam("status", "archived", "pending"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.improvements.length()").value(2));
    }

    @Test
    void downloadsPrivateAttachmentWithRangeConditionalAndHeadSemantics() throws Exception {
        MockMultipartFile attachment = new MockMultipartFile(
            "attachments",
            "evidência.csv",
            "text/csv",
            "coluna,valor\nstatus,ok".getBytes(StandardCharsets.UTF_8)
        );
        String response = mvc.perform(multipart("/api/admin/improvements")
                .file(attachment)
                .param("profile", "employee")
                .param("name", "Ana Silva")
                .param("email", "ana@example.com")
                .param("phone", "11999990000")
                .param("category", "automation")
                .param("message", "A conferência poderia eliminar uma etapa manual.")
                .param("branch", "Osasco/SP"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.message")
                .value("Sua sugestão interna foi registrada para triagem."))
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        String improvementId = context.mapper.readTree(response).path("id").asString();
        JsonNode saved = context.improvements.list("").getFirst();
        String attachmentId = saved.path("attachments").get(0).path("id").asString();
        String path = "/api/admin/improvements/" + improvementId
            + "/attachments/" + attachmentId;
        byte[] expected = "coluna,valor\nstatus,ok".getBytes(StandardCharsets.UTF_8);

        String etag = mvc.perform(get(path))
            .andExpect(status().isOk())
            .andExpect(content().bytes(expected))
            .andExpect(content().contentType("text/csv"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(header().string("Accept-Ranges", "bytes"))
            .andExpect(header().string(
                "Content-Disposition",
                "attachment; filename*=UTF-8''evid%C3%AAncia.csv"
            ))
            .andExpect(header().exists("ETag"))
            .andExpect(header().exists("Last-Modified"))
            .andReturn().getResponse().getHeader("ETag");

        mvc.perform(get(path).header("If-None-Match", etag))
            .andExpect(status().isNotModified())
            .andExpect(content().bytes(new byte[0]));
        mvc.perform(get(path).header("Range", "bytes=0-5"))
            .andExpect(status().isPartialContent())
            .andExpect(header().string("Content-Range", "bytes 0-5/" + expected.length))
            .andExpect(content().bytes("coluna".getBytes(StandardCharsets.UTF_8)));
        mvc.perform(head(path))
            .andExpect(status().isOk())
            .andExpect(header().longValue("Content-Length", expected.length))
            .andExpect(content().bytes(new byte[0]));
    }
}
