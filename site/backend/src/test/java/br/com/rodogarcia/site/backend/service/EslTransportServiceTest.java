package br.com.rodogarcia.site.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import br.com.rodogarcia.site.backend.dto.request.CancellationReason;
import br.com.rodogarcia.site.backend.dto.request.CityRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionAddressRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionCancellationRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionRequest;
import br.com.rodogarcia.site.backend.dto.request.InvoiceReferenceRequest;
import br.com.rodogarcia.site.backend.dto.request.PostalCityRequest;
import br.com.rodogarcia.site.backend.dto.request.QuoteRequest;
import br.com.rodogarcia.site.backend.integration.esl.EslGraphqlClient;
import br.com.rodogarcia.site.backend.integration.esl.EslGraphqlDocuments;
import br.com.rodogarcia.site.backend.security.EslOperationTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class EslTransportServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-17T15:00:00.000Z");
    private static final String CORPORATION_CNPJ = "60960473000243";

    private final JsonMapper jsonMapper = JsonMapper.builder().build();
    private EslGraphqlClient graphqlClient;
    private EslOperationTokenService tokenService;
    private EslTransportService service;

    @BeforeEach
    void setUp() {
        graphqlClient = mock(EslGraphqlClient.class);
        tokenService = mock(EslOperationTokenService.class);
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new EslTransportService(
            graphqlClient,
            tokenService,
            new EslDeliveryRegionService(graphqlClient, clock),
            new EslWhatsappMessageFactory(),
            clock
        );
    }

    @Test
    void buildsFractionalQuoteWithResolvedBranchWeightTableAndTotal() throws Exception {
        when(graphqlClient.execute(anyString(), anyMap()))
            .thenReturn(
                deliveryRegions("Osasco", "SP", CORPORATION_CNPJ),
                json("""
                    {
                      "quoteCreate": {
                        "success": true,
                        "errors": [],
                        "resource": {
                          "id": "125",
                          "sequenceCode": 24,
                          "referenceNumber": "SITE-123",
                          "requestedAt": "2026-07-17T12:00:00-03:00",
                          "quoteStretchBids": [{"total":824.5},{"total":75.5}]
                        }
                      }
                    }
                    """
                )
            );

        QuoteRequest input = quote();
        Map<String, Object> result = service.createFractionalQuote(input);

        @SuppressWarnings("unchecked")
        Map<String, Object> price = (Map<String, Object>) result.get("price");
        assertThat(((Number) price.get("total")).doubleValue()).isEqualTo(900D);
        assertThat((List<?>) price.get("stretches")).hasSize(2);

        ArgumentCaptor<String> query = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings({ "rawtypes", "unchecked" })
        ArgumentCaptor<Map<String, ?>> variables = (ArgumentCaptor) ArgumentCaptor.forClass(Map.class);
        verify(graphqlClient, times(2)).execute(query.capture(), variables.capture());
        assertThat(query.getAllValues().get(0)).contains("deliveryRegion");
        assertThat(query.getAllValues().get(1)).contains("quoteStretchBids { total }");

        Map<String, Object> params = map(variables.getAllValues().get(1).get("params"));
        assertThat(map(params.get("corporation")).get("document")).isEqualTo(CORPORATION_CNPJ);
        assertThat(params.get("requestedAt")).isEqualTo("2026-07-17T15:00:00.000Z");
        assertThat(params.get("referenceNumber").toString()).matches("SITE-[a-f0-9]{24}");
        Map<String, Object> bid = map(((List<?>) params.get("quoteStretchBidsAttributes")).getFirst());
        assertThat(((Number) bid.get("realWeight")).doubleValue()).isEqualTo(25_000D);
        assertThat(map(bid.get("customerPriceTable")).get("name")).isEqualTo("PADRÃO");
        assertThat(map(bid.get("payer")).get("document")).isEqualTo(input.customerCnpj());
    }

    @Test
    void mirrorsJavascriptCoercionForUpstreamErrorsAndNumericArrays() throws Exception {
        when(graphqlClient.execute(anyString(), anyMap()))
            .thenReturn(
                deliveryRegions("Osasco", "SP", CORPORATION_CNPJ),
                json("""
                    {"quoteCreate":{"success":true,"errors":["\u00a0\ufeff"],"resource":{
                      "id":"125","quoteStretchBids":[{"total":["0x10"]},{"total":[5]}]
                    }}}
                    """)
            );

        Map<String, Object> result = service.createFractionalQuote(quote());
        Map<String, Object> price = map(result.get("price"));

        assertThat(((Number) price.get("total")).doubleValue()).isEqualTo(21D);
    }

    @Test
    void usesDefaultBranchForMultiCorporationRegionAndCachesRegionsForFiveMinutes() throws Exception {
        when(graphqlClient.execute(eq(EslGraphqlDocuments.DELIVERY_REGION), anyMap()))
            .thenReturn(json("""
                {
                  "deliveryRegion": {
                    "nodes": [{
                      "deliveryCities": [{"city":{"name":"Toritama","state":{"code":"PE"}}}],
                      "ediDefaultCorporation": {"person":{"cnpj":"60960473000839"}},
                      "deliveryRegionCorporations": [
                        {"corporation":{"person":{"cnpj":"60960473001134"}}},
                        {"corporation":{"person":{"cnpj":"60960473000839"}}}
                      ]
                    }],
                    "pageInfo": {"endCursor":null,"hasNextPage":false}
                  }
                }
                """));
        when(graphqlClient.execute(eq(EslGraphqlDocuments.QUOTE_CREATE), anyMap()))
            .thenReturn(json("""
                {"quoteCreate":{"success":true,"errors":[],"resource":{"id":"126","quoteStretchBids":[]}}}
                """));

        QuoteRequest input = quoteWithOrigin("Toritama", "PE", "55125000");
        service.prepareClosedQuoteWhatsapp(input);
        service.createFractionalQuote(input);

        verify(graphqlClient, times(1)).execute(eq(EslGraphqlDocuments.DELIVERY_REGION), anyMap());
        ArgumentCaptor<Map<String, ?>> variables = mapCaptor();
        verify(graphqlClient).execute(eq(EslGraphqlDocuments.QUOTE_CREATE), variables.capture());
        Map<String, Object> params = map(variables.getValue().get("params"));
        assertThat(map(params.get("corporation")).get("document"))
            .isEqualTo("60960473000839");
    }

    @Test
    void createsCollectionWithValidatedInvoiceAndOpaqueMaintenanceCapability() throws Exception {
        when(graphqlClient.execute(anyString(), anyMap()))
            .thenReturn(
                deliveryRegions("Osasco", "SP", CORPORATION_CNPJ),
                json("""
                    {
                      "invoice": {"edges":[{"node":{
                        "id":"8950942","key":"35250300000000000000000000000000000000000000",
                        "number":"456","series":"1","issueDate":"2026-07-17",
                        "value":15000,"volume":3,"weight":100,"status":"pending"
                      }}]}
                    }
                    """),
                json("""
                    {"pickCreate":{"success":true,"errors":[],"resource":{
                      "id":"359397","sequenceCode":13925,"status":"requested"
                    }}}
                    """)
            );
        when(tokenService.invoiceValidationFingerprint(any())).thenReturn("f".repeat(64));
        when(tokenService.requireInvoiceValidationToken("v1.valid", "f".repeat(64)))
            .thenReturn("8950942");
        when(tokenService.createCollectionMaintenanceToken("359397"))
            .thenReturn("v1.maintenance");

        Map<String, Object> result = service.createCollection(collection("v1.valid"));

        assertThat(result.get("requiresWhatsApp")).isEqualTo(false);
        Map<String, Object> collection = map(result.get("collection"));
        assertThat(collection)
            .containsEntry("id", "359397")
            .containsEntry("maintenanceToken", "v1.maintenance");

        ArgumentCaptor<Map<String, ?>> variables = mapCaptor();
        verify(graphqlClient).execute(eq(EslGraphqlDocuments.PICK_CREATE), variables.capture());
        Map<String, Object> params = map(variables.getValue().get("params"));
        assertThat(params)
            .containsEntry("requestDate", "2026-07-17")
            .containsEntry("requestHour", "12:00");
        Map<String, Object> item = map(((List<?>) params.get("pickItemsAttributes")).getFirst());
        assertThat(map(item.get("payer")).get("document")).isEqualTo("01351335000117");
        assertThat(map(item.get("sender")).get("document")).isEqualTo("01351335000117");
        assertThat(item).doesNotContainKey("recipient");
        Map<String, Object> invoiceLink = map(
            ((List<?>) item.get("pickItemInvoicesAttributes")).getFirst()
        );
        assertThat(((Number) invoiceLink.get("invoiceId")).longValue()).isEqualTo(8_950_942L);
    }

    @Test
    void fallsBackToWhatsappOnlyWhenEslReportsAnUnregisteredCustomer() throws Exception {
        when(graphqlClient.execute(anyString(), anyMap()))
            .thenReturn(
                deliveryRegions("Osasco", "SP", CORPORATION_CNPJ),
                json("""
                    {"pickCreate":{"success":false,"errors":["Cliente não cadastrado"],"resource":null}}
                    """)
            );

        Map<String, Object> result = service.createCollection(collection(""));

        assertThat(result.get("requiresWhatsApp")).isEqualTo(true);
        assertThat(result.get("whatsappMessage").toString())
            .contains("Cliente: 01351335000117")
            .contains("NF: 35250300000000000000000000000000000000000000")
            .doesNotContain(CORPORATION_CNPJ);
    }

    @Test
    void sendsCanonicalCancellationReasonAndNodeStyleTimestamp() throws Exception {
        when(graphqlClient.execute(eq(EslGraphqlDocuments.PICK_CANCELLATION), anyMap()))
            .thenReturn(json("""
                {"pickCancellation":{"success":true,"errors":[],"resource":{
                  "id":"359397","sequenceCode":13925,"status":"canceled",
                  "cancellationReason":"Outros: Cliente alterou a programação"
                }}}
                """));

        Map<String, Object> result = service.cancelCollection(
            "359397",
            new CollectionCancellationRequest(
                CancellationReason.OUTROS,
                "Cliente alterou a programação"
            )
        );

        assertThat(result.get("status")).isEqualTo("canceled");
        ArgumentCaptor<Map<String, ?>> variables = mapCaptor();
        verify(graphqlClient).execute(eq(EslGraphqlDocuments.PICK_CANCELLATION), variables.capture());
        assertThat(variables.getValue().get("id")).isEqualTo("359397");
        Map<String, Object> params = map(variables.getValue().get("params"));
        assertThat(params)
            .containsEntry("cancellationReason", "Outros: Cliente alterou a programação")
            .containsEntry("cancellationDatetime", "2026-07-17T15:00:00.000Z");
    }

    @Test
    void preservesWeightAndThreeMeterPriceRules() {
        QuoteRequest input = quote();
        assertThat(EslTransportService.quoteWeightForEsl(input)).isEqualTo(25_000D);
        assertThat(EslTransportService.quotePriceTableForEsl(input)).isEqualTo("PADRÃO");

        QuoteRequest longCargo = new QuoteRequest(
            input.customerCnpj(), input.senderCnpj(), input.recipientCnpj(),
            input.origin(), input.destination(), 2D, 3D, 2D, 4_700D, 16D,
            input.invoiceValue(), input.invoiceVolumes(), input.requesterName(),
            input.requesterPhone(), input.requesterEmail(),
            input.productClassificationName(), input.comments()
        );
        assertThat(EslTransportService.quoteWeightForEsl(longCargo)).isEqualTo(4_800D);
        assertThat(EslTransportService.quotePriceTableForEsl(longCargo))
            .isEqualTo("PADRÃO - 3 METROS");
    }

    private QuoteRequest quote() {
        return quoteWithOrigin("Osasco", "SP", "06268000");
    }

    private QuoteRequest quoteWithOrigin(String city, String state, String postalCode) {
        return new QuoteRequest(
            "01351335000117",
            "01351335000117",
            "60960473000162",
            new PostalCityRequest(city, state, postalCode),
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

    private CollectionRequest collection(String token) {
        return new CollectionRequest(
            "01351335000117",
            "60960473000162",
            "01351335000117",
            "",
            new CityRequest("Osasco", "SP"),
            "2026-07-24",
            "08:00",
            "12:00",
            new CollectionAddressRequest("", "", "", "", "", "", ""),
            token,
            new InvoiceReferenceRequest(
                "35250300000000000000000000000000000000000000",
                "",
                "",
                "01351335000117",
                ""
            ),
            "",
            ""
        );
    }

    private JsonNode deliveryRegions(
        String city,
        String state,
        String corporationCnpj
    ) throws Exception {
        return json("""
            {
              "deliveryRegion": {
                "nodes": [{
                  "deliveryCities": [{"city":{"name":"%s","state":{"code":"%s"}}}],
                  "deliveryRegionCorporations": [
                    {"corporation":{"person":{"cnpj":"%s"}}}
                  ]
                }],
                "pageInfo": {"endCursor":null,"hasNextPage":false}
              }
            }
            """.formatted(city, state, corporationCnpj));
    }

    private JsonNode json(String value) throws Exception {
        return jsonMapper.readTree(value);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings({ "rawtypes", "unchecked" })
    private static ArgumentCaptor<Map<String, ?>> mapCaptor() {
        return (ArgumentCaptor) ArgumentCaptor.forClass(Map.class);
    }
}
