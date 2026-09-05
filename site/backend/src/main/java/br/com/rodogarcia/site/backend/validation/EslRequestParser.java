package br.com.rodogarcia.site.backend.validation;

import java.util.Locale;
import java.util.regex.Pattern;

import br.com.rodogarcia.site.backend.dto.request.CancellationReason;
import br.com.rodogarcia.site.backend.dto.request.CityRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionAddressRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionCancellationRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionRequest;
import br.com.rodogarcia.site.backend.dto.request.CollectionUpdateRequest;
import br.com.rodogarcia.site.backend.dto.request.InvoiceLookupRequest;
import br.com.rodogarcia.site.backend.dto.request.InvoiceReferenceRequest;
import br.com.rodogarcia.site.backend.dto.request.PostalCityRequest;
import br.com.rodogarcia.site.backend.dto.request.QuoteRequest;
import br.com.rodogarcia.site.backend.exception.ApiException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.MissingNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class EslRequestParser {

    private static final long MAX_SAFE_JS_INTEGER = 9_007_199_254_740_991L;
    private static final Pattern CNPJ = Pattern.compile("^[0-9]{14}$");
    private static final Pattern PHONE = Pattern.compile("^[0-9]{10,15}$");
    private static final Pattern STATE_CODE = Pattern.compile("^[A-Z]{2}$");
    private static final Pattern POSTAL_CODE = Pattern.compile("^[0-9]{8}$");
    private static final Pattern DATE = Pattern.compile("^[0-9]{4}-[0-9]{2}-[0-9]{2}$");
    private static final Pattern TIME = Pattern.compile("^([01][0-9]|2[0-3]):[0-5][0-9]$");
    private static final Pattern INVOICE_KEY = Pattern.compile("^[0-9]{44}$");
    private static final Pattern REMOTE_ID = Pattern.compile("^[0-9]+$");
    private static final Pattern ESL_OPERATION_TOKEN = Pattern.compile(
        "^v1\\.[A-Za-z0-9_-]{12,}\\.[A-Za-z0-9_-]{24,}$"
    );

    public QuoteRequest parseQuote(JsonNode value) {
        ObjectNode input = requireObject(value);

        String customerCnpj = cnpj(property(input, "customerCnpj"));
        String senderCnpj = optionalCnpj(property(input, "senderCnpj"));
        String recipientCnpj = optionalCnpj(property(input, "recipientCnpj"));
        PostalCityRequest origin = postalCity(property(input, "origin"));
        PostalCityRequest destination = postalCity(property(input, "destination"));
        double height = positiveNumber(property(input, "height"), "Altura", 1_000);
        double width = positiveNumber(property(input, "width"), "Largura", 1_000);
        double length = positiveNumber(property(input, "length"), "Comprimento", 1_000);
        double realWeight = positiveNumber(property(input, "realWeight"), "Peso real", 1_000_000);
        double cubicVolume = positiveNumber(property(input, "cubicVolume"), "Metro cúbico", 100_000);
        double invoiceValue = positiveNumber(property(input, "invoiceValue"), "Valor da NF", 100_000_000);
        int invoiceVolumes = positiveInteger(property(input, "invoiceVolumes"));
        String requesterName = requiredText(property(input, "requesterName"), "Nome do solicitante", 100);
        String requesterPhone = EslTextNormalizer.digits(property(input, "requesterPhone"), 15);
        if (!PHONE.matcher(requesterPhone).matches()) {
            throw invalid("Informe um telefone válido.");
        }
        String requesterEmail = EslTextNormalizer.sanitizeEmail(property(input, "requesterEmail"));
        if (requesterEmail.isEmpty()) {
            throw invalid("Informe um e-mail válido.");
        }
        String productClassificationName = optionalText(property(input, "productClassificationName"), 100);
        String comments = optionalText(property(input, "comments"), 700);

        return new QuoteRequest(
            customerCnpj,
            senderCnpj,
            recipientCnpj,
            origin,
            destination,
            height,
            width,
            length,
            realWeight,
            cubicVolume,
            invoiceValue,
            invoiceVolumes,
            requesterName,
            requesterPhone,
            requesterEmail,
            productClassificationName,
            comments
        );
    }

    public InvoiceLookupRequest parseInvoiceLookup(JsonNode value) {
        ObjectNode input = requireObject(value);
        InvoiceReferenceRequest invoice = invoiceReference(input);

        if (invoice.invoiceKey().isEmpty() && invoice.invoiceNumber().isEmpty()) {
            throw invalid("Informe a chave ou o número da NF.");
        }
        if (invoice.senderCnpj().isEmpty() && invoice.recipientCnpj().isEmpty()) {
            throw invalid("Informe o CNPJ do remetente ou do destinatário para validar a NF.");
        }

        return new InvoiceLookupRequest(
            invoice.invoiceKey(),
            invoice.invoiceNumber(),
            invoice.invoiceSeries(),
            invoice.senderCnpj(),
            invoice.recipientCnpj()
        );
    }

    public CollectionRequest parseCollectionCreate(JsonNode value) {
        ObjectNode input = requireObject(value);

        String customerCnpj = cnpj(property(input, "customerCnpj"));
        String pickupLocationCnpj = cnpj(property(input, "pickupLocationCnpj"));
        String senderCnpj = optionalCnpj(property(input, "senderCnpj"));
        String recipientCnpj = optionalCnpj(property(input, "recipientCnpj"));
        CityRequest origin = city(property(input, "origin"));
        String serviceDate = requiredDate(property(input, "serviceDate"));
        String serviceStartHour = requiredTime(property(input, "serviceStartHour"));
        String serviceEndHour = requiredTime(property(input, "serviceEndHour"));
        CollectionAddressRequest deliveryAddress = collectionAddress(property(input, "deliveryAddress"));
        String invoiceValidationToken = optionalOperationToken(property(input, "invoiceValidationToken"));
        InvoiceReferenceRequest invoice = invoiceReference(requireObject(property(input, "invoice")));
        String referenceNumber = optionalText(property(input, "referenceNumber"), 100);
        String comments = optionalText(property(input, "comments"), 700);

        if (!invoiceValidationToken.isEmpty()) {
            if (invoice.invoiceKey().isEmpty() && invoice.invoiceNumber().isEmpty()) {
                throw invalid("A autorização da NF exige a mesma chave ou número validado.");
            }
            if (invoice.senderCnpj().isEmpty() && invoice.recipientCnpj().isEmpty()) {
                throw invalid("A autorização da NF exige o CNPJ do remetente ou do destinatário validado.");
            }
            if (!invoice.senderCnpj().equals(senderCnpj) || !invoice.recipientCnpj().equals(recipientCnpj)) {
                throw invalid("Os CNPJs da NF devem corresponder aos CNPJs informados para a coleta.");
            }
        }

        return new CollectionRequest(
            customerCnpj,
            pickupLocationCnpj,
            senderCnpj,
            recipientCnpj,
            origin,
            serviceDate,
            serviceStartHour,
            serviceEndHour,
            deliveryAddress,
            invoiceValidationToken,
            invoice,
            referenceNumber,
            comments
        );
    }

    public CollectionUpdateRequest parseCollectionUpdate(JsonNode value) {
        ObjectNode input = requireObject(value);
        String serviceDate = optionalDate(property(input, "serviceDate"));
        String serviceStartHour = optionalTime(property(input, "serviceStartHour"));
        String serviceEndHour = optionalTime(property(input, "serviceEndHour"));
        String comments = optionalText(property(input, "comments"), 700);

        if (serviceDate.isEmpty() && serviceStartHour.isEmpty() && serviceEndHour.isEmpty() && comments.isEmpty()) {
            throw invalid("Informe ao menos um dado para atualizar a coleta.");
        }
        if (!serviceStartHour.isEmpty()
            && !serviceEndHour.isEmpty()
            && serviceStartHour.compareTo(serviceEndHour) >= 0) {
            throw invalid("O horário final deve ser posterior ao horário inicial.");
        }

        return new CollectionUpdateRequest(serviceDate, serviceStartHour, serviceEndHour, comments);
    }

    public CollectionCancellationRequest parseCollectionCancellation(JsonNode value) {
        ObjectNode input = requireObject(value);
        String normalizedReason = optionalText(property(input, "reason"), 40).toUpperCase(Locale.ROOT);
        CancellationReason reason;
        try {
            reason = CancellationReason.valueOf(normalizedReason);
        } catch (IllegalArgumentException ignored) {
            throw invalid("Motivo de cancelamento inválido.");
        }
        String otherReason = optionalText(property(input, "otherReason"), 300);
        if (reason == CancellationReason.OUTROS && otherReason.isEmpty()) {
            throw invalid("Descreva o motivo do cancelamento.");
        }
        return new CollectionCancellationRequest(reason, otherReason);
    }

    public String parseRemoteCollectionId(JsonNode value) {
        String id = EslTextNormalizer.sanitizeText(value, 30);
        if (!REMOTE_ID.matcher(id).matches()) {
            throw invalid("Identificador remoto inválido.");
        }
        return id;
    }

    private static PostalCityRequest postalCity(JsonNode value) {
        ObjectNode input = requireObject(value);
        String name = requiredText(property(input, "name"), "Cidade", 100);
        String stateCode = stateCode(property(input, "stateCode"), false);
        String postalCode = postalCode(property(input, "postalCode"));
        return new PostalCityRequest(name, stateCode, postalCode);
    }

    private static CityRequest city(JsonNode value) {
        ObjectNode input = requireObject(value);
        String name = requiredText(property(input, "name"), "Cidade", 100);
        String stateCode = stateCode(property(input, "stateCode"), false);
        return new CityRequest(name, stateCode);
    }

    private static CollectionAddressRequest collectionAddress(JsonNode value) {
        if (value == null || value.isMissingNode()) {
            return emptyAddress();
        }
        ObjectNode input = requireObject(value);
        String postalCodeText = optionalText(property(input, "postalCode"), 12);
        String postalCode = asciiDigits(postalCodeText, 8);
        String street = optionalText(property(input, "street"), 160);
        String number = optionalText(property(input, "number"), 40);
        String complement = optionalText(property(input, "complement"), 120);
        String neighborhood = optionalText(property(input, "neighborhood"), 100);
        String city = optionalText(property(input, "city"), 100);
        String stateCode = stateCode(property(input, "stateCode"), true);
        return new CollectionAddressRequest(postalCode, street, number, complement, neighborhood, city, stateCode);
    }

    private static CollectionAddressRequest emptyAddress() {
        return new CollectionAddressRequest("", "", "", "", "", "", "");
    }

    private static InvoiceReferenceRequest invoiceReference(ObjectNode input) {
        String invoiceKey = EslTextNormalizer.digits(property(input, "invoiceKey"), 44);
        if (!invoiceKey.isEmpty() && !INVOICE_KEY.matcher(invoiceKey).matches()) {
            throw invalid("Chave da NF deve ter 44 dígitos.");
        }
        String invoiceNumber = optionalText(property(input, "invoiceNumber"), 40);
        String invoiceSeries = optionalText(property(input, "invoiceSeries"), 20);
        String senderCnpj = optionalCnpj(property(input, "senderCnpj"));
        String recipientCnpj = optionalCnpj(property(input, "recipientCnpj"));
        return new InvoiceReferenceRequest(invoiceKey, invoiceNumber, invoiceSeries, senderCnpj, recipientCnpj);
    }

    private static String cnpj(JsonNode value) {
        String result = EslTextNormalizer.digits(value, 14);
        if (!CNPJ.matcher(result).matches()) {
            throw invalid("Informe um CNPJ válido.");
        }
        return result;
    }

    private static String optionalCnpj(JsonNode value) {
        String result = EslTextNormalizer.digits(value, 14);
        if (!result.isEmpty() && !CNPJ.matcher(result).matches()) {
            throw invalid("Informe um CNPJ válido.");
        }
        return result;
    }

    private static String stateCode(JsonNode value, boolean optional) {
        String result = EslTextNormalizer.sanitizeText(value, 2).toUpperCase(Locale.ROOT);
        if ((!optional || !result.isEmpty()) && !STATE_CODE.matcher(result).matches()) {
            throw invalid("Informe a UF com duas letras.");
        }
        return result;
    }

    private static String postalCode(JsonNode value) {
        String result = EslTextNormalizer.digits(value, 8);
        if (!POSTAL_CODE.matcher(result).matches()) {
            throw invalid("Informe um CEP válido.");
        }
        return result;
    }

    private static String requiredDate(JsonNode value) {
        String result = EslTextNormalizer.sanitizeText(value, 10);
        if (!isNodeCompatibleDate(result)) {
            throw invalid("Informe uma data válida no formato AAAA-MM-DD.");
        }
        return result;
    }

    private static String optionalDate(JsonNode value) {
        String result = EslTextNormalizer.sanitizeText(value, 10);
        if (!result.isEmpty() && !isNodeCompatibleDate(result)) {
            throw invalid("Informe uma data válida no formato AAAA-MM-DD.");
        }
        return result;
    }

    private static boolean isNodeCompatibleDate(String value) {
        if (!DATE.matcher(value).matches()) {
            return false;
        }
        int month = Integer.parseInt(value.substring(5, 7));
        int day = Integer.parseInt(value.substring(8, 10));
        // Date.parse normaliza 29–31 dentro do mês seguinte; só 00, >31 e mês
        // fora de 01–12 são rejeitados para o formato fixo usado pelo Node.
        return month >= 1 && month <= 12 && day >= 1 && day <= 31;
    }

    private static String requiredTime(JsonNode value) {
        String result = EslTextNormalizer.sanitizeText(value, 5);
        if (!TIME.matcher(result).matches()) {
            throw invalid("Informe um horário válido no formato HH:MM.");
        }
        return result;
    }

    private static String optionalTime(JsonNode value) {
        String result = EslTextNormalizer.sanitizeText(value, 5);
        if (!result.isEmpty() && !TIME.matcher(result).matches()) {
            throw invalid("Informe um horário válido no formato HH:MM.");
        }
        return result;
    }

    private static String optionalOperationToken(JsonNode value) {
        String token = EslTextNormalizer.sanitizeText(value, 2_048);
        if (!token.isEmpty() && !ESL_OPERATION_TOKEN.matcher(token).matches()) {
            throw invalid("Autorização de operação inválida.");
        }
        return token;
    }

    private static double positiveNumber(JsonNode value, String label, double maxValue) {
        double result = EslTextNormalizer.coerceNumber(value);
        if (Double.isNaN(result)) {
            throw invalid(label + " deve ser numérico.");
        }
        if (!Double.isFinite(result)) {
            throw invalid(label + " deve ser finito.");
        }
        if (!(result > 0.0d)) {
            throw invalid(label + " deve ser maior que zero.");
        }
        if (result > maxValue) {
            throw invalid(label + " excede o limite permitido.");
        }
        return result;
    }

    private static int positiveInteger(JsonNode value) {
        double result = EslTextNormalizer.coerceNumber(value);
        if (Double.isNaN(result)) {
            throw invalid("Quantidade de volumes deve ser numérica.");
        }
        if (!Double.isFinite(result)
            || result != Math.rint(result)
            || Math.abs(result) > MAX_SAFE_JS_INTEGER) {
            throw invalid("Quantidade de volumes deve ser inteira.");
        }
        if (!(result > 0.0d)) {
            throw invalid("Quantidade de volumes deve ser maior que zero.");
        }
        if (result > 1_000_000) {
            throw invalid("Quantidade de volumes excede o limite permitido.");
        }
        return (int) result;
    }

    private static String requiredText(JsonNode value, String label, int maxLength) {
        String result = EslTextNormalizer.sanitizeText(value, maxLength);
        if (result.isEmpty()) {
            throw invalid(label + " é obrigatório.");
        }
        return result;
    }

    private static String optionalText(JsonNode value, int maxLength) {
        return EslTextNormalizer.sanitizeText(value, maxLength);
    }

    private static String asciiDigits(String value, int maxLength) {
        StringBuilder result = new StringBuilder(Math.min(value.length(), maxLength));
        for (int index = 0; index < value.length() && result.length() < maxLength; index++) {
            char character = value.charAt(index);
            if (character >= '0' && character <= '9') {
                result.append(character);
            }
        }
        return result.toString();
    }

    private static ObjectNode requireObject(JsonNode value) {
        if (value instanceof ObjectNode object) {
            return object;
        }
        throw invalid("Invalid input: expected object, received " + receivedType(value));
    }

    private static JsonNode property(ObjectNode input, String name) {
        JsonNode value = input.get(name);
        return value == null ? MissingNode.getInstance() : value;
    }

    private static String receivedType(JsonNode value) {
        if (value == null || value.isMissingNode()) {
            return "undefined";
        }
        if (value.isNull()) {
            return "null";
        }
        if (value.isArray()) {
            return "array";
        }
        if (value.isObject()) {
            return "object";
        }
        if (value.isString()) {
            return "string";
        }
        if (value.isNumber()) {
            return "number";
        }
        if (value.isBoolean()) {
            return "boolean";
        }
        return "unknown";
    }

    private static ApiException invalid(String message) {
        return new ApiException(422, message);
    }
}
