package br.com.rodogarcia.site.backend.security;

import java.io.IOException;
import java.util.Locale;

import br.com.rodogarcia.site.backend.utils.NodeRequestHeaders;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.web.filter.OncePerRequestFilter;

public class SecurityHeadersFilter extends OncePerRequestFilter {

    private static final String CONTENT_SECURITY_POLICY = String.join(";",
        "default-src 'self'",
        "base-uri 'self'",
        "font-src 'self' https: data:",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "script-src 'self'",
        "script-src-attr 'none'",
        "style-src 'self' https: 'unsafe-inline'",
        "upgrade-insecure-requests"
    );

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        response.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        response.setHeader("Origin-Agent-Cluster", "?1");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-DNS-Prefetch-Control", "off");
        response.setHeader("X-Download-Options", "noopen");
        response.setHeader("X-Frame-Options", "SAMEORIGIN");
        response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
        response.setHeader("X-XSS-Protection", "0");
        response.setHeader("X-Powered-By", null);
        String connection = NodeRequestHeaders.commaJoined(request, "Connection");
        if ("HTTP/1.1".equals(request.getProtocol())
            && (connection == null
                || !connection.toLowerCase(Locale.ROOT).contains("close"))) {
            response = new KeepAliveResponse(response);
        }
        filterChain.doFilter(request, response);
    }

    private static final class KeepAliveResponse extends HttpServletResponseWrapper {

        private KeepAliveResponse(HttpServletResponse response) {
            super(response);
            updateConnectionHeaders(response.getStatus());
        }

        @Override
        public void setStatus(int status) {
            super.setStatus(status);
            updateConnectionHeaders(status);
        }

        @Override
        public void sendError(int status) throws IOException {
            updateConnectionHeaders(status);
            super.sendError(status);
        }

        @Override
        public void sendError(int status, String message) throws IOException {
            updateConnectionHeaders(status);
            super.sendError(status, message);
        }

        @Override
        public void reset() {
            super.reset();
            updateConnectionHeaders(getStatus());
        }

        private void updateConnectionHeaders(int status) {
            // Mesmos status de Http11Processor.statusDropsConnection no Tomcat 11.
            // Anunciar keep-alive aqui faria o Tomcat acrescentar um segundo
            // Connection: close e clientes poderiam reutilizar um socket encerrado.
            boolean closesConnection = switch (status) {
                case 400, 408, 411, 413, 414, 500, 501, 503 -> true;
                default -> false;
            };
            setHeader("Connection", closesConnection ? "close" : "keep-alive");
            setHeader("Keep-Alive", closesConnection ? null : "timeout=5");
        }
    }
}
