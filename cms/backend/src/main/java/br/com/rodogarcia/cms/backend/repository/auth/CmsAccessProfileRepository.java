package br.com.rodogarcia.cms.backend.repository.auth;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.model.auth.CmsAccessProfile;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Repository
public class CmsAccessProfileRepository {

    private static final String SEED_DATE = "2026-08-11T00:00:00.000Z";

    private final JsonFileStore store;
    private final Path path;

    public CmsAccessProfileRepository(JsonFileStore store, StoragePaths paths) {
        this.store = store;
        this.path = paths.cmsAccessProfiles();
    }

    public List<CmsAccessProfile> list() {
        return store.withWriteLock(List.of(path), () -> readProfiles().stream()
            .map(CmsAccessProfile::copy).toList());
    }

    public CmsAccessProfile findById(String id) {
        return store.withWriteLock(List.of(path), () -> readProfiles().stream()
            .filter(profile -> id.equals(profile.getId()))
            .findFirst().map(CmsAccessProfile::copy).orElse(null));
    }

    public CmsAccessProfile create(CmsAccessProfile profile) {
        return store.withWriteLock(List.of(path), () -> {
            List<CmsAccessProfile> profiles = readProfiles();
            profiles.add(profile.copy());
            writeProfiles(profiles);
            return profile.copy();
        });
    }

    public CmsAccessProfile update(String id, ProfilePatch patch) {
        return store.withWriteLock(List.of(path), () -> {
            List<CmsAccessProfile> profiles = readProfiles();
            for (int index = 0; index < profiles.size(); index++) {
                CmsAccessProfile profile = profiles.get(index);
                if (!id.equals(profile.getId())) continue;
                CmsAccessProfile updated = profile.copy();
                patch.apply(updated);
                profiles.set(index, updated);
                writeProfiles(profiles);
                return updated.copy();
            }
            return null;
        });
    }

    public boolean remove(String id) {
        return store.withWriteLock(List.of(path), () -> {
            List<CmsAccessProfile> profiles = readProfiles();
            boolean removed = profiles.removeIf(profile -> id.equals(profile.getId()));
            if (removed) writeProfiles(profiles);
            return removed;
        });
    }

    private List<CmsAccessProfile> readProfiles() {
        ObjectNode fallback = store.mapper().createObjectNode();
        ArrayNode defaults = fallback.putArray("profiles");
        seededProfiles().forEach(profile -> defaults.add(toJson(profile)));
        JsonNode root = store.read(path, fallback);
        JsonNode array = root == null ? null : root.get("profiles");
        if (array == null || !array.isArray()) {
            throw new IllegalStateException("Armazenamento de perfis de acesso inválido.");
        }
        List<CmsAccessProfile> profiles = new ArrayList<>();
        for (JsonNode node : array) profiles.add(parse(node));
        List<CmsAccessProfile> missing = seededProfiles().stream()
            .filter(seed -> profiles.stream().noneMatch(profile -> seed.getId().equals(profile.getId())))
            .toList();
        if (!missing.isEmpty()) {
            profiles.addAll(missing.stream().map(CmsAccessProfile::copy).toList());
            writeProfiles(profiles);
        }
        return profiles;
    }

    private void writeProfiles(List<CmsAccessProfile> profiles) {
        ObjectNode root = store.mapper().createObjectNode();
        ArrayNode array = root.putArray("profiles");
        profiles.forEach(profile -> array.add(toJson(profile)));
        store.write(path, root);
    }

    private ObjectNode toJson(CmsAccessProfile profile) {
        ObjectNode node = store.mapper().createObjectNode();
        node.put("id", profile.getId());
        node.put("name", profile.getName());
        node.put("description", profile.getDescription());
        ArrayNode permissions = node.putArray("permissions");
        if (profile.getPermissions() != null) profile.getPermissions().forEach(permissions::add);
        if (profile.getActive() != null) node.put("active", profile.getActive());
        node.put("createdAt", profile.getCreatedAt());
        node.put("updatedAt", profile.getUpdatedAt());
        return node;
    }

    private CmsAccessProfile parse(JsonNode node) {
        if (!node.isObject()) throw new IllegalStateException("Armazenamento de perfis de acesso inválido.");
        CmsAccessProfile profile = new CmsAccessProfile();
        profile.setId(text(node, "id"));
        profile.setName(text(node, "name"));
        profile.setDescription(text(node, "description"));
        profile.setPermissions(strings(node.get("permissions")));
        JsonNode active = node.get("active");
        profile.setActive(active != null && active.isBoolean() ? active.asBoolean() : null);
        profile.setCreatedAt(text(node, "createdAt"));
        profile.setUpdatedAt(text(node, "updatedAt"));
        return profile;
    }

    private static List<CmsAccessProfile> seededProfiles() {
        return List.of(
            profile("sector-content", "Conteúdo institucional", "Páginas, navegação e rodapé do site.", List.of("home", "services", "about-page", "business-page", "contact-page", "careers-page", "collections", "quote-page", "improvements", "header-navigation", "footer-links", "units")),
            profile("sector-marketing", "Marketing e comunicação", "Conteúdo, mídias, SEO e campanhas do site.", List.of("dashboard", "home", "services", "about-page", "business-page", "contact-page", "careers-page", "images", "popup", "seo", "analytics")),
            profile("sector-commercial", "Comercial e atendimento", "Cotação, coletas, contatos e leads recebidos.", List.of("dashboard", "quote-page", "collections", "contact-page", "leads", "units")),
            profile("sector-operations", "Operações", "Unidades, coletas e rastreamento operacional.", List.of("dashboard", "collections", "units", "tracking")),
            profile("sector-privacy", "Privacidade e qualidade", "Consentimentos, LGPD e sugestões de melhoria.", List.of("dashboard", "improvements", "cookie-monitoring", "cookies"))
        );
    }

    private static CmsAccessProfile profile(String id, String name, String description, List<String> permissions) {
        CmsAccessProfile profile = new CmsAccessProfile();
        profile.setId(id);
        profile.setName(name);
        profile.setDescription(description);
        profile.setPermissions(new ArrayList<>(permissions));
        profile.setActive(true);
        profile.setCreatedAt(SEED_DATE);
        profile.setUpdatedAt(SEED_DATE);
        return profile;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isString() ? value.asString() : null;
    }

    private static List<String> strings(JsonNode node) {
        if (node == null || !node.isArray()) return null;
        List<String> values = new ArrayList<>();
        for (JsonNode value : node) if (value.isString()) values.add(value.asString());
        return values;
    }

    @FunctionalInterface
    public interface ProfilePatch {
        void apply(CmsAccessProfile profile);
    }
}
