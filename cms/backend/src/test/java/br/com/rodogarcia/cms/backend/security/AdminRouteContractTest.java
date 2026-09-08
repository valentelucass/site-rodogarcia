package br.com.rodogarcia.cms.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AdminRouteContractTest {

    @Test
    void keepsNodePermissionLookupCaseSensitiveAndPrefixBased() {
        assertThat(AdminRouteContract.permissionForPath("/home")).isEqualTo("home");
        assertThat(AdminRouteContract.permissionForPath("/home/certifications")).isEqualTo("home");
        assertThat(AdminRouteContract.permissionForPath("/home-extra")).isEqualTo("home");
        assertThat(AdminRouteContract.permissionForPath("/media-slots")).isEqualTo("images");
        assertThat(AdminRouteContract.permissionForPath("/HOME")).isNull();
        assertThat(AdminRouteContract.permissionForPath("/unknown")).isNull();
    }

    @Test
    void appliesMutationMiddlewareOnlyWhenAnExpressRouteMatches() {
        assertPolicy("/content", "POST", true, true, 0);
        assertPolicy("/content", "PATCH", false, false, 0);
        assertPolicy("/content/reorder", "POST", true, true, 0);
        assertPolicy("/home/unknown", "PUT", true, true, 0);
        assertPolicy("/home/certifications", "PUT", true, true, 0);
        assertPolicy("/home/hero", "POST", false, false, 0);
        assertPolicy("/pages/about/hero", "PUT", true, true, 0);
        assertPolicy("/pages/about/hero/deeper", "PUT", false, false, 0);
        assertPolicy("/images", "POST", true, false, 0);
        assertPolicy("/images", "DELETE", true, true, 0);
        assertPolicy("/improvements/id", "PATCH", true, true, 0);
        assertPolicy("/improvements/id/extra", "PATCH", false, false, 0);
        assertPolicy(
            "/landing-media",
            "POST",
            true,
            false,
            AdminRouteContract.LANDING_MEDIA_MAX_REQUEST_BYTES
        );
    }

    @Test
    void appliesSupremeOnlyToTheFourExplicitIdentityRouteShapes() {
        assertThat(AdminRouteContract.requiresSupreme("/access-profiles", "HEAD")).isTrue();
        assertThat(AdminRouteContract.requiresSupreme("/access-profiles/id", "PUT")).isTrue();
        assertThat(AdminRouteContract.requiresSupreme("/users", "POST")).isTrue();
        assertThat(AdminRouteContract.requiresSupreme("/users/id", "DELETE")).isTrue();
        assertThat(AdminRouteContract.requiresSupreme("/users", "GET")).isFalse();
        assertThat(AdminRouteContract.requiresSupreme("/users/id/extra", "DELETE")).isFalse();
    }

    @Test
    void modelsGenericEntityRoutesAndAutomaticOptionsIncludingTrailingSlash() {
        assertThat(AdminRouteContract.matchesGenericEntityRoute("/content", "HEAD")).isTrue();
        assertThat(AdminRouteContract.matchesGenericEntityRoute("/content/", "POST")).isTrue();
        assertThat(AdminRouteContract.matchesGenericEntityRoute("/content//", "POST")).isFalse();
        assertThat(AdminRouteContract.matchesGenericEntityRoute("/home/id", "DELETE")).isTrue();
        assertThat(AdminRouteContract.matchesGenericEntityRoute("/home/id", "POST")).isFalse();
        assertThat(AdminRouteContract.matchesGenericEntityRoute("/home/reorder", "POST")).isTrue();

        assertThat(AdminRouteContract.genericEntityMethods("/content"))
            .containsExactly("GET", "HEAD", "POST");
        assertThat(AdminRouteContract.genericEntityMethods("/home/id"))
            .containsExactly("DELETE", "PUT");
        assertThat(AdminRouteContract.genericEntityMethods("/home/reorder"))
            .containsExactly("DELETE", "PUT", "POST");
    }

    private static void assertPolicy(
        String path,
        String method,
        boolean matched,
        boolean requiresJson,
        long maxContentLength
    ) {
        AdminRouteContract.MutationPolicy policy = AdminRouteContract.mutationPolicy(path, method);
        assertThat(policy.matched()).as("matched %s %s", method, path).isEqualTo(matched);
        assertThat(policy.requiresJson()).as("json %s %s", method, path).isEqualTo(requiresJson);
        assertThat(policy.maxContentLength()).as("length %s %s", method, path)
            .isEqualTo(maxContentLength);
    }
}
