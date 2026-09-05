package br.com.rodogarcia.site.backend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rodogarcia.site.backend.dto.response.CompanyAddressResponse;
import br.com.rodogarcia.site.backend.dto.response.PostalCodeLookupResponse;
import br.com.rodogarcia.site.backend.exception.GlobalExceptionHandler;
import br.com.rodogarcia.site.backend.model.RateLimitPolicy;
import br.com.rodogarcia.site.backend.security.RequestPolicy;
import br.com.rodogarcia.site.backend.service.CompanyLookupService;
import br.com.rodogarcia.site.backend.service.ExpressJsonResponse;
import br.com.rodogarcia.site.backend.service.PostalCodeService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

class PublicLookupControllerTest {

    private PostalCodeService postalCodeService;
    private CompanyLookupService companyLookupService;
    private RequestPolicy requestPolicy;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        postalCodeService = mock(PostalCodeService.class);
        companyLookupService = mock(CompanyLookupService.class);
        requestPolicy = mock(RequestPolicy.class);
        ExpressJsonResponse jsonResponse = new ExpressJsonResponse(JsonMapper.builder().build());
        PublicLookupController controller = new PublicLookupController(
            postalCodeService,
            companyLookupService,
            requestPolicy,
            jsonResponse
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler(jsonResponse))
            .build();
    }

    @Test
    void servesTheExactPostalCodeUrlAndJsonContract() throws Exception {
        when(postalCodeService.lookup("06090000"))
            .thenReturn(new PostalCodeLookupResponse("06090000", "Osasco", "SP"));

        mockMvc.perform(get("/api/public/postal-code/06090000"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json; charset=utf-8"))
            .andExpect(content().json(
                "{\"postalCode\":\"06090000\",\"city\":\"Osasco\",\"stateCode\":\"SP\"}",
                JsonCompareMode.LENIENT
            ));

        verify(requestPolicy).consume(any(HttpServletRequest.class), eq(RateLimitPolicy.PUBLIC_POSTAL_CODE));
    }

    @Test
    void headStillExecutesTheProviderFlowAndEmitsNoBody() throws Exception {
        when(postalCodeService.lookup("06090000"))
            .thenReturn(new PostalCodeLookupResponse("06090000", "Osasco", "SP"));

        mockMvc.perform(head("/api/public/postal-code/06090000"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Length", "58"))
            .andExpect(content().string(""));

        verify(postalCodeService).lookup("06090000");
        verify(requestPolicy).consume(any(HttpServletRequest.class), eq(RateLimitPolicy.PUBLIC_POSTAL_CODE));
    }

    @Test
    void servesCompanyLookupIncludingTheExpressCompatibleTrailingSlash() throws Exception {
        when(companyLookupService.lookup("60960473000243"))
            .thenReturn(new CompanyAddressResponse(
                "60960473000243",
                "06090000",
                "Avenida dos Autonomistas",
                "1234",
                "Galpão 2",
                "Vila Yara",
                "Osasco",
                "SP"
            ));

        mockMvc.perform(get("/api/public/company/60960473000243/"))
            .andExpect(status().isOk())
            .andExpect(content().json("""
                {
                  "cnpj":"60960473000243",
                  "postalCode":"06090000",
                  "street":"Avenida dos Autonomistas",
                  "number":"1234",
                  "complement":"Galpão 2",
                  "neighborhood":"Vila Yara",
                  "city":"Osasco",
                  "stateCode":"SP"
                }
                """, JsonCompareMode.LENIENT));

        verify(requestPolicy).consume(
            any(HttpServletRequest.class),
            eq(RateLimitPolicy.PUBLIC_COMPANY_LOOKUP)
        );
    }
}
