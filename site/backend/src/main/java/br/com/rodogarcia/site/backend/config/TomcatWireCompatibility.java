package br.com.rodogarcia.site.backend.config;

import java.io.IOException;

import br.com.rodogarcia.site.backend.utils.NodePathDecoder;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.catalina.Lifecycle;
import org.apache.catalina.Valve;
import org.apache.catalina.connector.Connector;
import org.apache.catalina.connector.CoyoteAdapter;
import org.apache.catalina.connector.Request;
import org.apache.catalina.connector.Response;
import org.apache.catalina.valves.ValveBase;
import org.apache.coyote.http11.AbstractHttp11Protocol;
import org.apache.tomcat.util.buf.ByteChunk;
import org.apache.tomcat.util.buf.MessageBytes;

/**
 * Mantém literais de headers que o Tomcat normaliza ou suprime, mas que fazem
 * parte do contrato HTTP legado do Express.
 */
public final class TomcatWireCompatibility {

    private static final String COYOTE_RESPONSE_ATTRIBUTE =
        TomcatWireCompatibility.class.getName() + ".coyoteResponse";

    private TomcatWireCompatibility() {
    }

    /**
     * Mantém sequências percent-encoded no path cru até a aplicação, como
     * faz o parser HTTP usado pelo Node. O Tomcat rejeita esses casos antes dos
     * filtros por padrão, o que produziria uma página HTML 400 sem Helmet/CORS.
     */
    public static void customizeConnector(Connector connector) {
        connector.setEncodedSolidusHandling("passthrough");
        connector.setEncodedReverseSolidusHandling("passthrough");
        if (connector.getProtocolHandler() instanceof AbstractHttp11Protocol<?> http11) {
            http11.setRelaxedPathChars("\"<>[\\]^`{|}");
            http11.setMaxHttpRequestHeaderSize(16 * 1024);
            http11.setKeepAliveTimeout(5_000);
        }
        connector.addLifecycleListener(event -> {
            if (!Lifecycle.AFTER_INIT_EVENT.equals(event.getType())) {
                return;
            }
            if (!(connector.getProtocolHandler().getAdapter()
                instanceof NodeCompatibleCoyoteAdapter)) {
                connector.getProtocolHandler().setAdapter(
                    new NodeCompatibleCoyoteAdapter(connector)
                );
            }
        });
    }

    public static Valve contextValve() {
        return new ValveBase(true) {
            @Override
            public void invoke(Request request, Response response)
                throws IOException, ServletException {
                request.setAttribute(COYOTE_RESPONSE_ATTRIBUTE, response.getCoyoteResponse());
                getNext().invoke(request, response);
            }
        };
    }

    public static void setLiteralContentType(
        HttpServletRequest request,
        HttpServletResponse response,
        String value
    ) {
        response.setHeader("Content-Type", value);
        org.apache.coyote.Response coyoteResponse = coyoteResponse(request);
        if (coyoteResponse == null) {
            return;
        }

        // O setter Servlet recompõe o media type como `type;charset=...`.
        coyoteResponse.setContentType(null);
        coyoteResponse.getMimeHeaders()
            .setValue("Content-Type")
            .setString(value);
    }

    public static void removeContentType(
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        response.setHeader("Content-Type", null);
        org.apache.coyote.Response coyoteResponse = coyoteResponse(request);
        if (coyoteResponse == null) {
            return;
        }
        coyoteResponse.setContentType(null);
        coyoteResponse.getMimeHeaders().removeHeader("Content-Type");
    }

    public static void setLiteralZeroContentLength(
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        response.setContentLength(0);
        org.apache.coyote.Response coyoteResponse = coyoteResponse(request);
        if (coyoteResponse == null) {
            return;
        }

        // O Tomcat força contentLength=-1 para 204; o header explícito do cors
        // do Express precisa permanecer no bloco MIME enviado ao cliente.
        coyoteResponse.getMimeHeaders()
            .setValue("Content-Length")
            .setString("0");
    }

    private static org.apache.coyote.Response coyoteResponse(HttpServletRequest request) {
        Object value = request.getAttribute(COYOTE_RESPONSE_ATTRIBUTE);
        return value instanceof org.apache.coyote.Response response ? response : null;
    }

    /**
     * O normalizador do Tomcat recusa NUL, barra invertida e escapes percentuais
     * incompletos antes do pipeline Servlet. A máscara reversível permite o
     * mapeamento sem alterar o request-target que os filtros e o MVC recebem.
     */
    private static final class NodeCompatibleCoyoteAdapter extends CoyoteAdapter {

        private NodeCompatibleCoyoteAdapter(Connector connector) {
            super(connector);
        }

        @Override
        protected boolean postParseRequest(
            org.apache.coyote.Request coyoteRequest,
            Request request,
            org.apache.coyote.Response coyoteResponse,
            Response response
        ) throws IOException, ServletException {
            String method = coyoteRequest.getMethod();
            if (containsLowercaseAscii(method)) {
                coyoteResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                coyoteResponse.setMessage("Bad Request");
                coyoteResponse.getMimeHeaders()
                    .setValue("Connection")
                    .setString("close");
                return false;
            }

            MessageBytes requestUri = coyoteRequest.requestURI();
            byte[] original = maskOptionsAsterisk(coyoteRequest, requestUri);
            byte[] unsupportedOriginal = maskUnsupportedPathBytes(requestUri);
            if (original == null) {
                original = unsupportedOriginal;
            }
            try {
                return super.postParseRequest(
                    coyoteRequest,
                    request,
                    coyoteResponse,
                    response
                );
            } finally {
                if (original != null) {
                    requestUri.setBytes(original, 0, original.length);
                }
            }
        }

        private static byte[] maskOptionsAsterisk(
            org.apache.coyote.Request request,
            MessageBytes requestUri
        ) {
            if (!"OPTIONS".equals(request.getMethod())
                || requestUri.getType() != MessageBytes.T_BYTES) {
                return null;
            }
            ByteChunk raw = requestUri.getByteChunk();
            if (raw.getLength() != 1 || raw.getBytes()[raw.getStart()] != '*') {
                return null;
            }
            byte[] original = new byte[] { '*' };
            byte[] masked = "/__express_options_asterisk__".getBytes(
                java.nio.charset.StandardCharsets.US_ASCII
            );
            requestUri.setBytes(masked, 0, masked.length);
            return original;
        }

        private static boolean containsLowercaseAscii(String value) {
            for (int index = 0; index < value.length(); index++) {
                char character = value.charAt(index);
                if (character >= 'a' && character <= 'z') {
                    return true;
                }
            }
            return false;
        }

        private static byte[] maskUnsupportedPathBytes(MessageBytes requestUri) {
            if (requestUri.getType() != MessageBytes.T_BYTES) {
                return null;
            }

            ByteChunk raw = requestUri.getByteChunk();
            int start = raw.getStart();
            int length = raw.getLength();
            byte[] source = raw.getBytes();
            boolean maskAllPercentSigns = !NodePathDecoder.canDecodeURIComponent(
                source,
                start,
                length
            );
            int extraBytes = 0;
            for (int index = start; index < start + length; index++) {
                if (source[index] == '\\') {
                    extraBytes += 2;
                    continue;
                }
                if (source[index] == '%') {
                    if (maskAllPercentSigns) {
                        extraBytes += 2;
                    } else if (isEncodedNull(source, index, start + length)) {
                        extraBytes += 2;
                        index += 2;
                    } else {
                        index += 2;
                    }
                }
            }
            if (extraBytes == 0) {
                return null;
            }

            byte[] original = new byte[length];
            System.arraycopy(source, start, original, 0, length);
            byte[] masked = new byte[length + extraBytes];
            int read = 0;
            int write = 0;
            while (read < original.length) {
                if (original[read] == '\\') {
                    masked[write++] = '%';
                    masked[write++] = '5';
                    masked[write++] = 'C';
                    read++;
                    continue;
                }
                if (original[read] == '%' && maskAllPercentSigns) {
                    masked[write++] = '%';
                    masked[write++] = '2';
                    masked[write++] = '5';
                    read++;
                    continue;
                }
                if (isEncodedNull(original, read, original.length)) {
                    masked[write++] = '%';
                    masked[write++] = '2';
                    masked[write++] = '5';
                    masked[write++] = '0';
                    masked[write++] = '0';
                    read += 3;
                    continue;
                }
                masked[write++] = original[read++];
            }
            requestUri.setBytes(masked, 0, masked.length);
            return original;
        }

        private static boolean isEncodedNull(byte[] value, int index, int end) {
            return index <= end - 3
                && value[index] == '%'
                && value[index + 1] == '0'
                && value[index + 2] == '0';
        }

    }
}
