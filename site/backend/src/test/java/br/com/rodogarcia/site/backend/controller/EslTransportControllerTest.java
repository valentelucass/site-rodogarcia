package br.com.rodogarcia.site.backend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.Map;

import br.com.rodogarcia.site.backend.dto.request.CityRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionAddressRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionUpdateRequest;
import br.com.rodogarcia.site.backend.dto.request.InvoiceReferenceRequest;
import br.com.rodogarcia.site.backend.dto.request.PostalCityRequest;
import br.com.rodogarcia.site.backend.dto.request.QuoteRequest;
import br.com.rodogarcia.site.backend.exception.GlobalExceptionHandler;
import br.com.rodogarcia.site.backend.model.RateLimitPolicy;
import br.com.rodogarcia.site.backend.security.EslOperationTokenService;
import br.com.rodogarcia.site.backend.security.RequestPolicy;
import br.com.rodogarcia.site.backend.service.EslTransportService;
import br.com.rodogarcia.site.backend.service.ExpressJsonResponse;
import br.com.rodogarcia.site.backend.validation.EslRequestParser;
import br.com.rodogarcia.site.backend.validation.ParsedJsonBody;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.http.MediaType;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class EslTransportControllerTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();
    private EslTransportService transportService;
    private EslRequestParser requestParser;
    private EslOperationTokenService tokenService;
    private RequestPolicy requestPolicy;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        transportService = mock(EslTransportService.class);
        requestParser = mock(EslRequestParser.class);
        tokenService = mock(EslOperationTokenService.class);
        requestPolicy = mock(RequestPolicy.class);
        ExpressJsonResponse jsonResponse = new ExpressJsonResponse(jsonMapper);
        EslTransportController controller = new EslTransportController(
            transportService,
            requestParser,
            tokenService,
            requestPolicy,
            jsonResponse
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler(jsonResponse))
            .build();
    }

    @Test
    void createsFractionalQuoteAtTheExactUrlWith201Envelope() throws Exception {
        JsonNode body = jsonMapper.readTree("{}");
        QuoteRequest input = quote();
        when(requestParser.parseQuote(body)).thenReturn(input);
        when(transportService.createFractionalQuote(input)).thenReturn(linkedMap(
            "id", "125",
            "sequenceCode", "24"
        ));

        mockMvc.perform(post("/api/quote/fractional/")
                .contentType(MediaType.APPLICATION_JSON)
                .requestAttr(ParsedJsonBody.ATTRIBUTE, body))
            .andExpect(status().isCreated())
            .andExpect(content().contentType("application/json; charset=utf-8"))
            .andExpect(content().json(
                "{\"quote\":{\"id\":\"125\",\"sequenceCode\":\"24\"}}",
                JsonCompareMode.LENIENT
            ));

        verify(requestPolicy).requirePublicMutation(
            any(HttpServletRequest.class),
            eq(RateLimitPolicy.ESL_QUOTE)
        );
    }

    @Test
    void returns200AndNoStoreForWhatsappCollectionFallback() throws Exception {
        JsonNode body = jsonMapper.readTree("{}");
        CollectionRequest input = collection();
        when(requestParser.parseCollectionCreate(body)).thenReturn(input);
        when(transportService.createCollection(input)).thenReturn(linkedMap(
            "requiresWhatsApp", true,
            "whatsappMessage", "Solicitação de coleta pelo site Rodogarcia"
        ));

        mockMvc.perform(post("/api/collections")
                .contentType(MediaType.APPLICATION_JSON)
                .requestAttr(ParsedJsonBody.ATTRIBUTE, body))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(content().json(
                """
                {
                  "requiresWhatsApp": true,
                  "whatsappMessage": "Solicitação de coleta pelo site Rodogarcia"
                }
                """,
                JsonCompareMode.LENIENT
            ));

        verify(requestPolicy).requirePublicMutation(
            any(HttpServletRequest.class),
            eq(RateLimitPolicy.ESL_COLLECTION_CREATE)
        );
    }

    @Test
    void enforcesMaintenanceCapabilityAfterRateAndBeforeParsing() throws Exception {
        JsonNode body = jsonMapper.readTree("{\"comments\":\"Nova janela\"}");
        CollectionUpdateRequest input = new CollectionUpdateRequest("", "", "", "Nova janela");
        when(requestParser.parseRemoteCollectionId(any())).thenReturn("359397");
        when(requestParser.parseCollectionUpdate(body)).thenReturn(input);
        when(transportService.updateCollection("359397", input)).thenReturn(linkedMap(
            "id", "359397",
            "sequenceCode", "13925",
            "status", "requested"
        ));

        mockMvc.perform(patch("/api/collections/359397/")
                .contentType(MediaType.APPLICATION_JSON)
                .header("x-collection-capability", "v1.capability")
                .requestAttr(ParsedJsonBody.ATTRIBUTE, body))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(content().json(
                """
                {"collection":{"id":"359397","sequenceCode":"13925","status":"requested"}}
                """,
                JsonCompareMode.LENIENT
            ));

        InOrder order = inOrder(requestPolicy, tokenService, requestParser, transportService);
        order.verify(requestPolicy).requirePublicMutation(
            any(HttpServletRequest.class),
            eq(RateLimitPolicy.ESL_COLLECTION_MAINTENANCE)
        );
        order.verify(tokenService).requireCollectionMaintenanceToken("v1.capability", "359397");
        order.verify(requestParser).parseRemoteCollectionId(any());
        order.verify(requestParser).parseCollectionUpdate(body);
        order.verify(transportService).updateCollection("359397", input);
    }

    private QuoteRequest quote() {
        return new QuoteRequest(
            "01351335000117",
            "",
            "",
            new PostalCityRequest("Osasco", "SP", "06268000"),
            new PostalCityRequest("Agudos", "SP", "17123210"),
            2D,
            2D,
            2D,
            25_000D,
            25D,
            250_000D,
            150,
            "Caio Garcia",
            "14991943869",
            "caio@example.com",
            "",
            ""
        );
    }

    private CollectionRequest collection() {
        return new CollectionRequest(
            "01351335000117",
            "60960473000162",
            "",
            "",
            new CityRequest("Osasco", "SP"),
            "2026-07-24",
            "08:00",
            "12:00",
            new CollectionAddressRequest("", "", "", "", "", "", ""),
            "",
            new InvoiceReferenceRequest("", "", "", "", ""),
            "",
            ""
        );
    }

    private static Map<String, Object> linkedMap(Object... entries) {
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < entries.length; index += 2) {
            result.put((String) entries[index], entries[index + 1]);
        }
        return result;
    }
}
