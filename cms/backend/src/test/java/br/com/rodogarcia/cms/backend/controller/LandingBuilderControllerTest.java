package br.com.rodogarcia.cms.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.service.AuditService;
import br.com.rodogarcia.cms.backend.service.LandingBuilderService;
import br.com.rodogarcia.cms.backend.validation.JsonBodyCompatibilityFilter;
import br.com.rodogarcia.cms.backend.validation.RequestPolicy;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Part;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockMultipartHttpServletRequest;
import org.springframework.mock.web.MockPart;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class LandingBuilderControllerTest {

    private final JsonMapper mapper = JsonMapper.builder().build();
    private LandingBuilderService service;
    private AuditService audit;
    private RequestPolicy policy;
    private LandingBuilderController controller;

    @BeforeEach
    void setUp() {
        service = mock(LandingBuilderService.class);
        audit = mock(AuditService.class);
        policy = mock(RequestPolicy.class);
        controller = new LandingBuilderController(service, audit, policy);
    }

    @Test
    void usesTheGloballyParsedJsonAndAllowsTheEmptyJsonBody() {
        MockHttpServletRequest parsed = new MockHttpServletRequest();
        JsonNode body = mapper.createObjectNode().put("name", "Campanha");
        parsed.setAttribute(JsonBodyCompatibilityFilter.BODY_ATTRIBUTE, body);
        when(service.createPage(body)).thenReturn(mapper.createObjectNode().put("ok", true));

        assertThat(controller.create(parsed).getStatusCode().value()).isEqualTo(201);
        verify(service).createPage(body);

        MockHttpServletRequest empty = new MockHttpServletRequest();
        when(service.createPage(null)).thenReturn(mapper.createObjectNode());
        assertThat(controller.create(empty).getStatusCode().value()).isEqualTo(201);
        verify(service).createPage(null);
    }

    @Test
    void acceptsAZeroByteFileAndForwardsTheSingleAltField() {
        MockMultipartHttpServletRequest request = multipart();
        MockMultipartFile file = new MockMultipartFile(
            "file", "empty.png", "image/png", new byte[0]);
        request.addFile(file);
        request.addPart(new MockPart("file", "empty.png", new byte[0]));
        request.addPart(new MockPart("alt", "Descrição".getBytes(StandardCharsets.UTF_8)));
        request.addParameter("alt", "Descrição");
        when(service.uploadMedia(file, "Descrição"))
            .thenReturn(mapper.createObjectNode().put("ok", true));

        assertThat(controller.upload(request).getStatusCode().value()).isEqualTo(201);

        verify(policy).requireContentLength(request, 70L * 1024L * 1024L);
        verify(service).uploadMedia(file, "Descrição");
    }

    @Test
    void returnsTheNodeMissingFileErrorForNonMultipartRequests() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        assertApiError(() -> controller.upload(request), 422, "Selecione um arquivo de mídia.");
        verify(service, never()).uploadMedia(any(), any());
    }

    @Test
    void reproducesTheMulterFieldFileAndPartLimits() {
        MockMultipartHttpServletRequest unexpected = multipart();
        unexpected.addFile(new MockMultipartFile("other", "x.png", "image/png", new byte[] {1}));
        unexpected.addPart(new MockPart("other", "x.png", new byte[] {1}));
        assertApiError(() -> controller.upload(unexpected), 422, "Unexpected field");

        MockMultipartHttpServletRequest duplicate = multipart();
        duplicate.addFile(new MockMultipartFile("file", "a.png", "image/png", new byte[] {1}));
        duplicate.addFile(new MockMultipartFile("file", "b.png", "image/png", new byte[] {2}));
        duplicate.addPart(new MockPart("file", "a.png", new byte[] {1}));
        duplicate.addPart(new MockPart("file", "b.png", new byte[] {2}));
        assertApiError(() -> controller.upload(duplicate), 422, "Too many files");

        MockMultipartHttpServletRequest tooManyFields = multipart();
        tooManyFields.addPart(new MockPart("a", new byte[] {1}));
        tooManyFields.addPart(new MockPart("b", new byte[] {1}));
        tooManyFields.addPart(new MockPart("c", new byte[] {1}));
        assertApiError(() -> controller.upload(tooManyFields), 422, "Too many fields");

        MockMultipartHttpServletRequest tooManyParts = multipart();
        tooManyParts.addFile(new MockMultipartFile("file", "x.png", "image/png", new byte[] {1}));
        tooManyParts.addPart(new MockPart("file", "x.png", new byte[] {1}));
        tooManyParts.addPart(new MockPart("a", new byte[] {1}));
        tooManyParts.addPart(new MockPart("b", new byte[] {1}));
        assertApiError(() -> controller.upload(tooManyParts), 422, "Too many parts");

        MockMultipartHttpServletRequest longField = multipart();
        longField.addPart(new MockPart("alt", new byte[1_000]));
        assertApiError(() -> controller.upload(longField), 422, "Field value too long");
    }

    @Test
    void rejectsAFileAtTheExactMulterLimitAndMapsMalformedMultipartTo500() throws Exception {
        MockMultipartHttpServletRequest oversized = multipart();
        Part oversizedPart = mock(Part.class);
        when(oversizedPart.getSubmittedFileName()).thenReturn("huge.mp4");
        when(oversizedPart.getName()).thenReturn("file");
        when(oversizedPart.getSize()).thenReturn(70L * 1024L * 1024L);
        oversized.addPart(oversizedPart);
        assertApiError(
            () -> controller.upload(oversized),
            413,
            "Arquivo ou payload excede o limite permitido."
        );

        MultipartHttpServletRequest malformed = mock(MultipartHttpServletRequest.class);
        when(malformed.getHeader("Content-Length")).thenReturn(null);
        when(malformed.getParts()).thenThrow(new ServletException("private parser detail"));
        assertApiError(() -> controller.upload(malformed), 500, "Erro interno no servidor.");
    }

    private static MockMultipartHttpServletRequest multipart() {
        MockMultipartHttpServletRequest request = new MockMultipartHttpServletRequest();
        request.setMethod("POST");
        request.setContentType("multipart/form-data; boundary=test");
        return request;
    }

    private static void assertApiError(Runnable operation, int status, String message) {
        assertThatThrownBy(operation::run)
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.status()).isEqualTo(status);
                assertThat(error.getMessage()).isEqualTo(message);
            });
    }
}
