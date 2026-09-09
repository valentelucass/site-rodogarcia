package br.com.rodogarcia.cms.backend.security;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Espelha a combinação entre o middleware global e as rotas registradas no
 * {@code adminRouter} Express. As rotas genéricas de entidade permanecem
 * observáveis mesmo quando a única entidade de negócio válida é {@code units}.
 */
public final class AdminRouteContract {

    public static final long LANDING_MEDIA_MAX_REQUEST_BYTES = 70L * 1024L * 1024L;

    private static final Pattern ONE_SEGMENT = Pattern.compile("^/[^/]+$");
    private static final Pattern TWO_SEGMENTS = Pattern.compile("^/[^/]+/[^/]+$");
    private static final Pattern ENTITY_REORDER = Pattern.compile("^/[^/]+/reorder$");
    private static final Pattern PAGE_SECTION = Pattern.compile("^/pages/[^/]+/[^/]+$");
    private static final Pattern LANDING_PUBLICATION = Pattern.compile(
        "^/landings/[^/]+/(publish|unpublish)$"
    );
    private static final Pattern IMPROVEMENT_ITEM = Pattern.compile("^/improvements/[^/]+$");
    private static final Pattern ACCESS_PROFILE_ITEM = Pattern.compile("^/access-profiles/[^/]+$");
    private static final Pattern USER_ITEM = Pattern.compile("^/users/[^/]+$");

    private AdminRouteContract() {
    }

    /** Remove somente a barra final única aceita pelo strict-routing desligado. */
    public static String normalizeTrailingSlash(String path) {
        if (path == null || path.isEmpty()) return "/";
        return path.length() > 1 && path.endsWith("/") && !path.endsWith("//")
            ? path.substring(0, path.length() - 1)
            : path;
    }

    /**
     * O Express testa {@code req.path} com {@code startsWith} antes do matching
     * case-insensitive das rotas. Por isso esta função é deliberadamente
     * sensível a maiúsculas e minúsculas.
     */
    public static String permissionForPath(String path) {
        if (path.startsWith("/landings") || path.startsWith("/landing-media")) return "landing-pages";
        if (path.startsWith("/access-profiles") || path.startsWith("/users")) return "users";
        if (path.startsWith("/home")) return "home";
        if (path.startsWith("/services-page")) return "services";
        if (path.startsWith("/pages/careers")) return "careers-page";
        if (path.startsWith("/pages/collections")) return "collections";
        if (path.startsWith("/pages/contact")) return "contact-page";
        if (path.startsWith("/pages/quote")) return "quote-page";
        if (path.startsWith("/pages/business")) return "business-page";
        if (path.startsWith("/pages/about")) return "about-page";
        if (path.startsWith("/pages/improvements")) return "improvements";
        if (path.startsWith("/footer-links")) return "footer-links";
        if (path.startsWith("/header-navigation")) return "header-navigation";
        if (path.startsWith("/site-texts")) return "home";
        if (path.startsWith("/images") || path.startsWith("/media-")) return "images";
        if (path.startsWith("/seo")) return "seo";
        if (path.startsWith("/consent-settings")) return "cookies";
        if (path.startsWith("/cookie-consents")) return "cookie-monitoring";
        if (path.startsWith("/leads")) return "leads";
        if (path.startsWith("/improvements")) return "improvements";
        if (path.startsWith("/tracking") || path.startsWith("/audit-log")) return "tracking";
        if (path.startsWith("/content")) return "dashboard";
        if (path.startsWith("/units")) return "units";
        return null;
    }

    public static boolean requiresSupreme(String path, String method) {
        String folded = folded(path);
        return (folded.equals("/access-profiles") && isGetOrHeadOrPost(method))
            || (ACCESS_PROFILE_ITEM.matcher(folded).matches()
                && (method.equals("PUT") || method.equals("DELETE")))
            || (folded.equals("/users") && method.equals("POST"))
            || (USER_ITEM.matcher(folded).matches()
                && (method.equals("PUT") || method.equals("DELETE")));
    }

    public static MutationPolicy mutationPolicy(String path, String method) {
        String folded = folded(path);
        if (method.equals("POST")) {
            if (folded.equals("/landing-media")) {
                return new MutationPolicy(true, false, LANDING_MEDIA_MAX_REQUEST_BYTES);
            }
            if (folded.equals("/images") || folded.equals("/home/certifications/media")
                || folded.equals("/improvements")
                || LANDING_PUBLICATION.matcher(folded).matches()) {
                return MutationPolicy.WITHOUT_JSON;
            }
            if (folded.equals("/images/replace-reference")
                || ONE_SEGMENT.matcher(folded).matches()
                || ENTITY_REORDER.matcher(folded).matches()) {
                return MutationPolicy.JSON;
            }
            return MutationPolicy.NONE;
        }
        if (method.equals("PUT")) {
            if (folded.equals("/header-navigation")
                || TWO_SEGMENTS.matcher(folded).matches()
                || PAGE_SECTION.matcher(folded).matches()) {
                return MutationPolicy.JSON;
            }
            return MutationPolicy.NONE;
        }
        if (method.equals("DELETE")) {
            if (folded.equals("/images")) return MutationPolicy.JSON;
            return TWO_SEGMENTS.matcher(folded).matches()
                ? MutationPolicy.WITHOUT_JSON : MutationPolicy.NONE;
        }
        if (method.equals("PATCH") && IMPROVEMENT_ITEM.matcher(folded).matches()) {
            return MutationPolicy.JSON;
        }
        return MutationPolicy.NONE;
    }

    /** Rotas finais genéricas {@code /:entity} do Express, inclusive HEAD. */
    public static boolean matchesGenericEntityRoute(String path, String method) {
        String folded = folded(path);
        return switch (method) {
            case "GET", "HEAD" -> ONE_SEGMENT.matcher(folded).matches();
            case "POST" -> ONE_SEGMENT.matcher(folded).matches()
                || ENTITY_REORDER.matcher(folded).matches();
            case "PUT", "DELETE" -> TWO_SEGMENTS.matcher(folded).matches();
            default -> false;
        };
    }

    /** Métodos que o OPTIONS automático do Router Express agrega por path. */
    public static Set<String> genericEntityMethods(String path) {
        String folded = folded(path);
        Set<String> methods = new LinkedHashSet<>();
        if (ONE_SEGMENT.matcher(folded).matches()) {
            methods.add("GET");
            methods.add("HEAD");
            methods.add("POST");
        }
        if (TWO_SEGMENTS.matcher(folded).matches()) {
            methods.add("DELETE");
            methods.add("PUT");
            if (ENTITY_REORDER.matcher(folded).matches()) methods.add("POST");
        }
        return methods;
    }

    private static String folded(String path) {
        return normalizeTrailingSlash(path).toLowerCase(Locale.ROOT);
    }

    private static boolean isGetOrHeadOrPost(String method) {
        return method.equals("GET") || method.equals("HEAD") || method.equals("POST");
    }

    public record MutationPolicy(boolean matched, boolean requiresJson, long maxContentLength) {
        private static final MutationPolicy NONE = new MutationPolicy(false, false, 0);
        private static final MutationPolicy JSON = new MutationPolicy(true, true, 0);
        private static final MutationPolicy WITHOUT_JSON = new MutationPolicy(true, false, 0);
    }
}
