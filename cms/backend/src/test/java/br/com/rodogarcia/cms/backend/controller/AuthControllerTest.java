package br.com.rodogarcia.cms.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import br.com.rodogarcia.cms.backend.exception.GlobalExceptionHandler;
import br.com.rodogarcia.cms.backend.security.TrailingSlashCompatibilityFilter;
import br.com.rodogarcia.cms.backend.support.AuthTestContext;
import br.com.rodogarcia.cms.backend.validation.JsonBodyCompatibilityFilter;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.util.pattern.PathPatternParser;
import tools.jackson.databind.JsonNode;

class AuthControllerTest {

    @TempDir
    Path root;

    private AuthTestContext context;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        context = new AuthTestContext(
            root,
            Clock.fixed(Instant.parse("2026-09-03T12:00:00Z"), ZoneOffset.UTC)
        );
        AuthController controller = new AuthController(
            context.auth, context.sessions, context.access, context.audit, context.mapper);
        PathPatternParser patterns = new PathPatternParser();
        patterns.setCaseSensitive(false);
        mvc = MockMvcBuilders.standaloneSetup(controller)
            .addInterceptors(context.interceptor)
            .addFilters(
                new TrailingSlashCompatibilityFilter(),
                new JsonBodyCompatibilityFilter(context.mapper)
            )
            .setPatternParser(patterns)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    @Test
    void runsSetupLoginSessionThemeAndLogoutWithOpaqueCookieAndCsrf() throws Exception {
        mvc.perform(get("/api/auth/setup"))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(jsonPath("$.setupRequired").value(true));

        mvc.perform(post("/api/auth/register")
                .header("Origin", AuthTestContext.ORIGIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Owner","email":"owner@rodogarcia.com.br",
                     "password":"SenhaTeste123","confirmPassword":"SenhaTeste123",
                     "setupCode":"codigo-setup-seguro-123"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.user.isOwner").value(true))
            .andExpect(jsonPath("$.user.passwordHash").doesNotExist());

        mvc.perform(post("/api/auth/login")
                .header("Origin", "https://evil.example")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"owner@rodogarcia.com.br\",\"password\":\"SenhaTeste123\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("Origem não autorizada."));

        MvcResult login = mvc.perform(post("/api/auth/login")
                .header("Origin", AuthTestContext.ORIGIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"owner@rodogarcia.com.br\",\"password\":\"SenhaTeste123\"}"))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("SameSite=Strict")))
            .andExpect(jsonPath("$.csrfToken").isString())
            .andReturn();

        String setCookie = login.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).contains("Path=/", "HttpOnly", "SameSite=Strict").doesNotContain("Max-Age");
        String sid = setCookie.substring("sid=".length(), setCookie.indexOf(';'));
        JsonNode loginBody = context.mapper.readTree(login.getResponse().getContentAsString());
        String csrf = loginBody.path("csrfToken").asString();

        mvc.perform(get("/api/auth/session").cookie(new Cookie("sid", sid)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(true))
            .andExpect(jsonPath("$.user.email").value("owner@rodogarcia.com.br"))
            .andExpect(jsonPath("$.csrfToken").value(csrf));

        mvc.perform(patch("/api/auth/cms-theme")
                .cookie(new Cookie("sid", sid))
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", "invalid")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"theme\":\"dark\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("Token CSRF invalido ou ausente."));

        mvc.perform(patch("/api/auth/cms-theme")
                .cookie(new Cookie("sid", sid))
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"theme\":\"dark\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.cmsTheme").value("dark"));

        mvc.perform(post("/api/auth/logout")
                .cookie(new Cookie("sid", sid))
                .header("Origin", AuthTestContext.ORIGIN))
            .andExpect(status().isForbidden())
            .andExpect(header().doesNotExist("Set-Cookie"));

        MvcResult logout = mvc.perform(post("/api/auth/logout")
                .cookie(new Cookie("sid", sid))
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", csrf))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Sessão encerrada."))
            .andReturn();
        assertThat(logout.getResponse().getHeaders("Set-Cookie"))
            .hasSize(2)
            .anyMatch(value -> value.matches(".*Expires=Thu, 0?1 Jan 1970 00:00:00 GMT.*"))
            .anyMatch(value -> value.contains("Max-Age=0") && value.contains("HttpOnly"));

        mvc.perform(get("/api/auth/session").cookie(new Cookie("sid", sid)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(false));
    }

    @Test
    void gatesTemporaryAdminsAndReservesUserMutationsForTheOwner() throws Exception {
        SessionCredentials owner = registerAndLoginOwner();

        mvc.perform(post("/api/admin/users")
                .cookie(owner.cookie())
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", owner.csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Admin Delegado","email":"delegado@rodogarcia.com.br",
                     "password":"SenhaTemporaria123","confirmPassword":"SenhaTemporaria123",
                     "role":"admin","cmsPermissions":["dashboard","users"]}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.createdUser.passwordChangeRequired").value(true));
        assertThat(context.audit.list(java.util.Map.of()).getFirst().path("action").asString())
            .isEqualTo("user.create");

        MvcResult delegatedLogin = mvc.perform(post("/api/auth/login")
                .header("Origin", AuthTestContext.ORIGIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"delegado@rodogarcia.com.br\",\"password\":\"SenhaTemporaria123\"}"))
            .andExpect(status().isOk())
            .andReturn();
        SessionCredentials delegated = credentials(delegatedLogin);

        mvc.perform(get("/api/admin/users").cookie(delegated.cookie()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("Troque sua senha antes de acessar o painel."));

        mvc.perform(post("/api/auth/change-password")
                .cookie(delegated.cookie())
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", delegated.csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"currentPassword":"SenhaTemporaria123","password":"NovaSenhaTeste123",
                     "confirmPassword":"NovaSenhaTeste123"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.passwordChangeRequired").value(false));

        mvc.perform(get("/api/admin/users").cookie(delegated.cookie()))
            .andExpect(status().isOk());

        mvc.perform(post("/api/admin/users")
                .cookie(delegated.cookie())
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", delegated.csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Tentativa","email":"tentativa@rodogarcia.com.br",
                     "password":"SenhaTeste123","confirmPassword":"SenhaTeste123","role":"admin"}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("Somente o usuário supremo pode gerenciar acessos."));

        mvc.perform(get("/api/admin/access-profiles").cookie(delegated.cookie()))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/access-profiles").cookie(owner.cookie()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.profiles.length()").value(5));
    }

    @Test
    void treatsAValidPrimitiveJsonBodyAsAnEmptyPayloadLikeExpress() throws Exception {
        mvc.perform(post("/api/auth/login")
                .header("Origin", AuthTestContext.ORIGIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("42"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("JSON inválido."));

        mvc.perform(post("/api/auth/register")
                .header("Origin", AuthTestContext.ORIGIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("[]"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("Codigo de setup invalido."));
    }

    @Test
    void keepsMutationSecurityOnCaseInsensitiveRoutesWithATrailingSlash() throws Exception {
        mvc.perform(post("/API/AUTH/REGISTER/")
                .header("Origin", "https://evil.example")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Owner","email":"owner@rodogarcia.com.br",
                     "password":"SenhaTeste123","confirmPassword":"SenhaTeste123",
                     "setupCode":"codigo-setup-seguro-123"}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("Origem não autorizada."));

        assertThat(context.auth.hasAnyUser()).isFalse();
    }

    @Test
    void recordsTheSixIdentityAndAccessProfileAuditActionsWithNodeMetadata() throws Exception {
        SessionCredentials owner = registerAndLoginOwner();

        MvcResult createdUser = mvc.perform(post("/api/admin/users")
                .cookie(owner.cookie())
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", owner.csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Operador","email":"operador@rodogarcia.com.br",
                     "password":"SenhaTeste123","confirmPassword":"SenhaTeste123","role":"user"}
                    """))
            .andExpect(status().isCreated())
            .andReturn();
        String userId = context.mapper.readTree(createdUser.getResponse().getContentAsString())
            .path("createdUser").path("id").asString();

        mvc.perform(put("/api/admin/users/{id}", userId)
                .cookie(owner.cookie())
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", owner.csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isOk());
        mvc.perform(delete("/api/admin/users/{id}", userId)
                .cookie(owner.cookie())
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", owner.csrf()))
            .andExpect(status().isOk());

        MvcResult createdProfile = mvc.perform(post("/api/admin/access-profiles")
                .cookie(owner.cookie())
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", owner.csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Auditoria\",\"permissions\":[\"dashboard\"]}"))
            .andExpect(status().isCreated())
            .andReturn();
        String profileId = context.mapper.readTree(createdProfile.getResponse().getContentAsString())
            .path("profile").path("id").asString();

        mvc.perform(put("/api/admin/access-profiles/{id}", profileId)
                .cookie(owner.cookie())
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", owner.csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Auditoria 2\",\"permissions\":[\"dashboard\"]}"))
            .andExpect(status().isOk());
        mvc.perform(delete("/api/admin/access-profiles/{id}", profileId)
                .cookie(owner.cookie())
                .header("Origin", AuthTestContext.ORIGIN)
                .header("X-CSRF-Token", owner.csrf()))
            .andExpect(status().isNoContent());

        List<JsonNode> logs = context.audit.list(java.util.Map.of("limit", "10"));
        assertThat(logs).extracting(log -> log.path("action").asString()).containsExactly(
            "user.create",
            "user.update",
            "user.delete",
            "access.profile_create",
            "access.profile_update",
            "access.profile_delete"
        );
        assertThat(logs.get(0).path("target").asString()).isEqualTo("operador@rodogarcia.com.br");
        assertThat(logs.get(0).path("metadata").path("role").asString()).isEqualTo("user");
        assertThat(logs.get(1).path("metadata").path("role").asString()).isEqualTo("user");
        assertThat(logs.get(1).path("metadata").path("active").asString()).isEqualTo("false");
        assertThat(logs.subList(2, 6)).allSatisfy(log ->
            assertThat(log.has("metadata")).isFalse());
    }

    private SessionCredentials registerAndLoginOwner() throws Exception {
        mvc.perform(post("/api/auth/register")
                .header("Origin", AuthTestContext.ORIGIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Owner","email":"owner@rodogarcia.com.br",
                     "password":"SenhaTeste123","confirmPassword":"SenhaTeste123",
                     "setupCode":"codigo-setup-seguro-123"}
                    """))
            .andExpect(status().isCreated());
        MvcResult login = mvc.perform(post("/api/auth/login")
                .header("Origin", AuthTestContext.ORIGIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"owner@rodogarcia.com.br\",\"password\":\"SenhaTeste123\"}"))
            .andExpect(status().isOk())
            .andReturn();
        return credentials(login);
    }

    private SessionCredentials credentials(MvcResult login) throws Exception {
        String header = login.getResponse().getHeader("Set-Cookie");
        String sid = header.substring("sid=".length(), header.indexOf(';'));
        String csrf = context.mapper.readTree(login.getResponse().getContentAsString())
            .path("csrfToken").asString();
        return new SessionCredentials(new Cookie("sid", sid), csrf);
    }

    private record SessionCredentials(Cookie cookie, String csrf) {
    }
}
