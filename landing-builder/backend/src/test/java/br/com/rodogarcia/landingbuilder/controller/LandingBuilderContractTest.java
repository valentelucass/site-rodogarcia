package br.com.rodogarcia.landingbuilder.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import br.com.rodogarcia.landingbuilder.config.LandingBuilderProperties;
import br.com.rodogarcia.landingbuilder.exception.GlobalExceptionHandler;
import br.com.rodogarcia.landingbuilder.repository.LandingMediaRepository;
import br.com.rodogarcia.landingbuilder.repository.LandingRepository;
import br.com.rodogarcia.landingbuilder.security.LandingRateLimitFilter;
import br.com.rodogarcia.landingbuilder.security.JsonRequestBodyFilter;
import br.com.rodogarcia.landingbuilder.security.PayloadLimitFilter;
import br.com.rodogarcia.landingbuilder.security.RequestContractFilter;
import br.com.rodogarcia.landingbuilder.security.SecurityHeadersFilter;
import br.com.rodogarcia.landingbuilder.security.ServiceTokenFilter;
import br.com.rodogarcia.landingbuilder.service.CampaignService;
import br.com.rodogarcia.landingbuilder.service.LandingMediaService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Comparator;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class LandingBuilderContractTest {

    private static final String SERVICE_TOKEN = "test-service-token-with-at-least-thirty-two-characters";
    private static final byte[] PNG = Base64.getDecoder().decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1Jr"
            + "AAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
    );

    @Test
    void campaignsKeepTheInternalPreviewAndPublicDtoContracts() throws Exception {
        try (Fixture fixture = fixture()) {
            MvcResult createdResult = fixture.mvc().perform(post("/api/internal/landings")
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input("campanha-teste", "", true)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andReturn();
            JsonNode created = fixture.body(createdResult).path("landing");
            String id = created.path("id").asText();
            assertThat(id).matches("landing_[A-Za-z0-9-]{36}");
            assertThat(created.has("previewToken")).isFalse();
            assertThat(created.path("status").asText()).isEqualTo("draft");

            fixture.mvc().perform(get("/api/public/landings/campanha-teste"))
                .andExpect(status().isNotFound());

            MvcResult previewResult = fixture.mvc().perform(post("/api/internal/landings/{id}/preview", id)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isOk())
                .andReturn();
            String previewPath = fixture.body(previewResult).path("previewPath").asText();
            assertThat(previewPath).matches("/preview/[A-Za-z0-9_-]{43}");
            String previewToken = previewPath.substring(previewPath.lastIndexOf('/') + 1);

            MvcResult preview = fixture.mvc().perform(get("/api/public/previews/{token}", previewToken))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(header().string("X-Robots-Tag", "noindex, nofollow, noarchive"))
                .andReturn();
            JsonNode previewLanding = fixture.body(preview).path("landing");
            assertThat(previewLanding.has("id")).isFalse();
            assertThat(previewLanding.has("status")).isFalse();
            assertThat(previewLanding.path("analytics").size()).isEqualTo(1);
            assertThat(previewLanding.path("analytics").path("ga4MeasurementId").asText()).isEqualTo("G-TEST1234");
            assertThat(previewLanding.path("testimonial").has("quote")).isFalse();
            assertThat(previewLanding.path("hero").path("backgroundPresentation").path("desktop").path("focalPoint").path("x").asInt()).isEqualTo(25);
            assertThat(previewLanding.path("story").path("imagePresentation").path("desktop").path("focalPoint").path("y").asInt()).isEqualTo(75);

            fixture.mvc().perform(post("/api/internal/landings/{id}/publish", id)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("[]"))
                .andExpect(status().isOk());

            MvcResult index = fixture.mvc().perform(get("/api/public/landings"))
                .andExpect(status().isOk())
                .andReturn();
            JsonNode indexItem = fixture.body(index).path("landings").get(0);
            assertThat(indexItem.path("slug").asText()).isEqualTo("campanha-teste");
            assertThat(indexItem.has("status")).isFalse();

            MvcResult published = fixture.mvc().perform(get("/api/public/landings/campanha-teste"))
                .andExpect(status().isOk())
                .andReturn();
            JsonNode publicLanding = fixture.body(published).path("landing");
            assertThat(publicLanding.path("template").asText()).isEqualTo("campaign-v1");
            assertThat(publicLanding.path("benefits").path("items").size()).isEqualTo(4);
            assertThat(publicLanding.path("showcase").path("items").size()).isEqualTo(3);
            assertThat(publicLanding.path("faq").path("items").size()).isEqualTo(3);
            assertThat(publicLanding.path("lowerSection").path("mapBaseColor").asText()).isEqualTo("#A9D4EF");

            fixture.mvc().perform(put("/api/internal/landings/{id}", id)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input("campanha-teste", "", false)))
                .andExpect(status().isOk());
            MvcResult revisionsResult = fixture.mvc().perform(get("/api/internal/landings/{id}/revisions", id)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isOk())
                .andReturn();
            String revisionId = fixture.body(revisionsResult).path("revisions").get(0).path("id").asText();
            fixture.mvc().perform(post("/api/internal/landings/{id}/revisions/{revisionId}/rollback", id, revisionId)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isOk());
            MvcResult restored = fixture.mvc().perform(get("/api/public/landings/campanha-teste"))
                .andExpect(status().isOk())
                .andReturn();
            assertThat(fixture.body(restored).path("landing").path("seo").path("index").asBoolean()).isTrue();
            MvcResult hiddenIndex = fixture.mvc().perform(get("/api/public/landings"))
                .andExpect(status().isOk())
                .andReturn();
            assertThat(fixture.body(hiddenIndex).path("landings").size()).isEqualTo(1);

            fixture.mvc().perform(post("/api/internal/landings/{id}/preview", id)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"rotate\":true}"))
                .andExpect(status().isOk());
            fixture.mvc().perform(get("/api/public/previews/{token}", previewToken))
                .andExpect(status().isNotFound());
        }
    }

    @Test
    void mediaRequiresRealSignaturesAndCannotBeDeletedWhileReferenced() throws Exception {
        try (Fixture fixture = fixture()) {
            MockMultipartFile invalid = new MockMultipartFile("file", "fraude.png", "image/png", "not an image".getBytes(StandardCharsets.UTF_8));
            fixture.mvc().perform(multipart("/api/internal/media")
                    .file(invalid)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isUnprocessableEntity());

            MockMultipartFile image = new MockMultipartFile("file", "campaign.png", "image/png", PNG);
            MvcResult upload = fixture.mvc().perform(multipart("/api/internal/media")
                    .file(image)
                    .part(new org.springframework.mock.web.MockPart("alt", "Patio da operacao".getBytes(StandardCharsets.UTF_8)))
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isCreated())
                .andReturn();
            JsonNode media = fixture.body(upload).path("media");
            String mediaId = media.path("id").asText();
            String mediaUrl = media.path("url").asText();
            assertThat(mediaUrl).matches("/landing-media/media_[A-Za-z0-9-]{36}");
            assertThat(media.path("mimeType").asText()).isEqualTo("image/webp");
            assertThat(media.path("alt").asText()).isEqualTo("Patio da operacao");

            MvcResult served = fixture.mvc().perform(get(mediaUrl))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "public, max-age=31536000, immutable"))
                .andExpect(header().string("Content-Disposition", "inline"))
                .andReturn();
            byte[] servedImage = served.getResponse().getContentAsByteArray();
            assertThat(new String(servedImage, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("RIFF");
            assertThat(new String(servedImage, 8, 4, StandardCharsets.US_ASCII)).isEqualTo("WEBP");
            fixture.mvc().perform(head(mediaUrl)).andExpect(status().isOk());

            MockMultipartFile video = new MockMultipartFile("file", "campaign.mp4", "video/mp4", mp4());
            MvcResult videoUpload = fixture.mvc().perform(multipart("/api/internal/media")
                    .file(video)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isCreated())
                .andReturn();
            String videoUrl = fixture.body(videoUpload).path("media").path("url").asText();
            String videoId = fixture.body(videoUpload).path("media").path("id").asText();
            MvcResult updatedVideo = fixture.mvc().perform(put("/api/internal/media/{id}", videoId)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"alt\":\"Vídeo da operação\",\"poster\":\"" + mediaUrl + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
            assertThat(fixture.body(updatedVideo).path("media").path("poster").asText()).isEqualTo(mediaUrl);
            MvcResult servedVideo = fixture.mvc().perform(get(videoUrl))
                .andExpect(status().isOk())
                .andReturn();
            assertThat(servedVideo.getResponse().getContentAsByteArray()).containsExactly(mp4());

            fixture.mvc().perform(post("/api/internal/landings")
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input("campanha-com-midia", videoUrl, true)))
                .andExpect(status().isCreated());
            fixture.mvc().perform(post("/api/internal/landings")
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input("campanha-com-trecho", videoUrl, true).replace(
                        "\"imagePresentation\":{\"desktop\":{\"focalPoint\":{\"x\":60,\"y\":75}}}",
                        "\"imagePresentation\":{\"desktop\":{\"focalPoint\":{\"x\":60,\"y\":75},\"playback\":{\"startSeconds\":1,\"durationSeconds\":5}}}"
                    )))
                .andExpect(status().isUnprocessableEntity());
            fixture.mvc().perform(delete("/api/internal/media/{id}", mediaId)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isConflict());
            fixture.mvc().perform(post("/api/internal/landings")
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input("campanha-com-url-antiga", "/uploads/nao-permitido.webp", true)))
                .andExpect(status().isUnprocessableEntity());
        }
    }

    @Test
    void campaignLifecycleDuplicatesSchedulesArchivesAndDeletesSafely() throws Exception {
        try (Fixture fixture = fixture()) {
            MvcResult createdResult = fixture.mvc().perform(post("/api/internal/landings")
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input("ciclo-campanha", "", true)))
                .andExpect(status().isCreated())
                .andReturn();
            String id = fixture.body(createdResult).path("landing").path("id").asText();

            MvcResult duplicatedResult = fixture.mvc().perform(post("/api/internal/landings/{id}/duplicate", id)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isCreated())
                .andReturn();
            JsonNode duplicate = fixture.body(duplicatedResult).path("landing");
            assertThat(duplicate.path("status").asText()).isEqualTo("draft");
            assertThat(duplicate.path("slug").asText()).startsWith("ciclo-campanha-copia");

            fixture.mvc().perform(post("/api/internal/landings/{id}/schedule", id)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"publishAt\":\"2030-01-01T10:00:00Z\",\"unpublishAt\":\"2030-01-01T11:00:00Z\"}"))
                .andExpect(status().isOk());
            fixture.mvc().perform(post("/api/internal/landings/{id}/archive", id)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isOk());
            fixture.mvc().perform(delete("/api/internal/landings/{id}", id)
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isOk());
            fixture.mvc().perform(get("/api/internal/landings")
                    .header("x-landing-builder-service-token", SERVICE_TOKEN))
                .andExpect(status().isOk());
        }
    }

    @Test
    void protectionAndErrorContractsStayOpaque() throws Exception {
        try (Fixture fixture = fixture()) {
            fixture.mvc().perform(post("/api/internal/landings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
                .andExpect(status().isUnauthorized());
            fixture.mvc().perform(post("/api/internal/landings")
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.TEXT_PLAIN)
                    .content("{}"))
                .andExpect(status().isUnsupportedMediaType());
            fixture.mvc().perform(post("/api/internal/landings")
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{"))
                .andExpect(status().isBadRequest());
            fixture.mvc().perform(post("/api/internal/landings")
                    .header("x-landing-builder-service-token", SERVICE_TOKEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("x".repeat(1_024 * 1_024 + 1)))
                .andExpect(status().isPayloadTooLarge());
            fixture.mvc().perform(get("/does-not-exist"))
                .andExpect(status().isNotFound());
            fixture.mvc().perform(get("/api/public/landings"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cross-Origin-Resource-Policy", "cross-origin"));
        }
    }

    private static Fixture fixture() throws IOException {
        Path storage = Files.createTempDirectory("rodogarcia-landing-builder-");
        ObjectMapper mapper = new ObjectMapper();
        LandingBuilderProperties properties = new LandingBuilderProperties(new MockEnvironment()
            .withProperty("LANDING_BUILDER_STORAGE_ROOT", storage.toString())
            .withProperty("LANDING_BUILDER_SERVICE_TOKEN", SERVICE_TOKEN));
        LandingMediaRepository mediaRepository = new LandingMediaRepository(mapper, properties);
        CampaignService campaigns = new CampaignService(mapper, new LandingRepository(mapper, properties), mediaRepository);
        LandingMediaService media = new LandingMediaService(mapper, mediaRepository, campaigns, properties);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
                new HealthController(),
                new PublicLandingsController(campaigns),
                new InternalLandingsController(campaigns),
                new LandingMediaController(media),
                new FallbackController()
            )
            .setControllerAdvice(new GlobalExceptionHandler())
            .addFilters(
                new SecurityHeadersFilter(),
                new JsonRequestBodyFilter(mapper),
                new LandingRateLimitFilter(mapper),
                new ServiceTokenFilter(mapper, properties),
                new RequestContractFilter(mapper),
                new PayloadLimitFilter(mapper)
            )
            .build();
        return new Fixture(storage, mapper, mvc);
    }

    private static String input(String slug, String storyImage, boolean index) {
        return """
            {
              "name":"Landing de teste",
              "slug":"%s",
              "seo":{"title":"Soluções logísticas para operações industriais","description":"Conheça uma operação de logística preparada para armazenagem, distribuição e atendimento nacional com acompanhamento especializado.","index":%s},
              "theme":{},
              "analytics":{"ga4MeasurementId":"G-TEST1234"},
              "hero":{"title":"Operação logística segura e integrada","description":"Atendemos operações que precisam de armazenagem, distribuição e visibilidade para crescer com segurança.","ctaUrl":"/fale-conosco","backgroundPresentation":{"desktop":{"focalPoint":{"x":25,"y":40}}},"highlights":[{"title":"Destaque","description":"Descrição"}]},
              "lowerSection":{"title":"Seção inferior"},
              "story":{"image":"%s","imagePresentation":{"desktop":{"focalPoint":{"x":60,"y":75}}}}
            }
            """.formatted(slug, index, storyImage);
    }

    private static byte[] mp4() {
        return new byte[] {
            0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm', 0, 0, 0, 0,
            'i', 's', 'o', 'm', 'i', 's', 'o', '2'
        };
    }

    private record Fixture(Path storage, ObjectMapper mapper, MockMvc mvc) implements AutoCloseable {
        JsonNode body(MvcResult result) throws IOException {
            return mapper.readTree(result.getResponse().getContentAsByteArray());
        }

        @Override
        public void close() throws IOException {
            try (Stream<Path> paths = Files.walk(storage)) {
                paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException ignored) {
                        // O diretório é exclusivo do teste e pode ser removido pelo SO após liberar handles.
                    }
                });
            }
        }
    }
}
