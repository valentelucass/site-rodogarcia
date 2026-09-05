package br.com.rodogarcia.cms.backend.repository.auth;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.model.auth.CmsPermissionOverride;
import br.com.rodogarcia.cms.backend.model.auth.UserRecord;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Repository
public class UserRepository {

    private final JsonFileStore store;
    private final Path path;

    public UserRepository(JsonFileStore store, StoragePaths paths) {
        this.store = store;
        this.path = paths.users();
    }

    public List<UserRecord> list() {
        return store.withWriteLock(List.of(path), () -> copyUsers(readUsers()));
    }

    public UserRecord findByEmail(String email) {
        return store.withWriteLock(List.of(path), () -> readUsers().stream()
            .filter(user -> email.equals(user.getEmail()) && user.isActive())
            .findFirst().map(UserRecord::copy).orElse(null));
    }

    public UserRecord findAnyByEmail(String email) {
        return store.withWriteLock(List.of(path), () -> readUsers().stream()
            .filter(user -> email.equals(user.getEmail()))
            .findFirst().map(UserRecord::copy).orElse(null));
    }

    public UserRecord findById(String id) {
        return store.withWriteLock(List.of(path), () -> readUsers().stream()
            .filter(user -> id.equals(user.getId()))
            .findFirst().map(UserRecord::copy).orElse(null));
    }

    public UserRecord create(UserRecord user) {
        return store.withWriteLock(List.of(path), () -> {
            List<UserRecord> users = readUsers();
            users.add(user.copy());
            writeUsers(users);
            return user.copy();
        });
    }

    public UserRecord createIfEmpty(UserRecord user) {
        return store.withWriteLock(List.of(path), () -> {
            List<UserRecord> users = readUsers();
            if (!users.isEmpty()) return null;
            users.add(user.copy());
            writeUsers(users);
            return user.copy();
        });
    }

    public UserRecord createIfEmailAvailable(UserRecord user) {
        return store.withWriteLock(List.of(path), () -> {
            List<UserRecord> users = readUsers();
            if (users.stream().anyMatch(existing -> user.getEmail().equals(existing.getEmail()))) {
                return null;
            }
            users.add(user.copy());
            writeUsers(users);
            return user.copy();
        });
    }

    public UserRecord update(String id, UserPatch patch) {
        return store.withWriteLock(List.of(path), () -> {
            List<UserRecord> users = readUsers();
            for (int index = 0; index < users.size(); index++) {
                UserRecord existing = users.get(index);
                if (!id.equals(existing.getId())) continue;
                UserRecord updated = existing.copy();
                patch.apply(updated);
                users.set(index, updated);
                writeUsers(users);
                return updated.copy();
            }
            return null;
        });
    }

    /**
     * Aplica a alteração e valida a unicidade do e-mail sobre o mesmo snapshot,
     * enquanto o lock de escrita do arquivo continua adquirido.
     */
    public UpdateResult updateIfEmailAvailable(String id, UserPatch patch) {
        return store.withWriteLock(List.of(path), () -> {
            List<UserRecord> users = readUsers();
            for (int index = 0; index < users.size(); index++) {
                UserRecord existing = users.get(index);
                if (!id.equals(existing.getId())) continue;
                UserRecord updated = existing.copy();
                patch.apply(updated);
                boolean conflict = users.stream().anyMatch(candidate ->
                    !id.equals(candidate.getId())
                        && java.util.Objects.equals(updated.getEmail(), candidate.getEmail())
                );
                if (conflict) return new UpdateResult(null, true);
                users.set(index, updated);
                writeUsers(users);
                return new UpdateResult(updated.copy(), false);
            }
            return new UpdateResult(null, false);
        });
    }

    public boolean delete(String id) {
        return store.withWriteLock(List.of(path), () -> {
            List<UserRecord> users = readUsers();
            boolean removed = users.removeIf(user -> id.equals(user.getId()));
            if (removed) writeUsers(users);
            return removed;
        });
    }

    public boolean hasAny() {
        return store.withWriteLock(List.of(path), () -> !readUsers().isEmpty());
    }

    private List<UserRecord> readUsers() {
        ObjectNode fallback = store.mapper().createObjectNode();
        fallback.putArray("users");
        JsonNode root = store.read(path, fallback);
        JsonNode usersNode = root == null ? null : root.get("users");
        if (usersNode == null || !usersNode.isArray()) {
            throw new IllegalStateException("Armazenamento de usuários inválido.");
        }
        List<UserRecord> users = new ArrayList<>();
        for (JsonNode node : usersNode) users.add(parseUser(node));

        if (users.stream().noneMatch(user -> Boolean.TRUE.equals(user.getIsOwner()))) {
            users.stream()
                .filter(user -> user.isAdmin() && user.isActive())
                .min(Comparator.comparing(
                    UserRecord::getCreatedAt,
                    Comparator.nullsFirst(String::compareTo)
                ))
                .ifPresent(user -> user.setIsOwner(true));
        }
        return users;
    }

    private UserRecord parseUser(JsonNode node) {
        if (!node.isObject()) throw new IllegalStateException("Armazenamento de usuários inválido.");
        UserRecord user = new UserRecord();
        user.setId(text(node, "id"));
        user.setEmail(text(node, "email"));
        user.setName(text(node, "name"));
        user.setRole(text(node, "role"));
        user.setActive(bool(node, "active"));
        user.setIsOwner(bool(node, "isOwner"));
        user.setMustChangePassword(bool(node, "mustChangePassword"));
        user.setPermissions(strings(node.get("permissions")));
        user.setAccessProfileId(text(node, "accessProfileId"));
        user.setCmsPermissions(node.has("cmsPermissions")
            ? presentStrings(node.get("cmsPermissions")) : null);
        JsonNode overrides = node.get("cmsPermissionOverrides");
        if (overrides != null && overrides.isArray()) {
            List<CmsPermissionOverride> values = new ArrayList<>();
            for (JsonNode item : overrides) {
                values.add(new CmsPermissionOverride(text(item, "permission"), text(item, "effect")));
            }
            user.setCmsPermissionOverrides(values);
        }
        user.setCmsTheme(text(node, "cmsTheme"));
        user.setPasswordResetRequestedAt(text(node, "passwordResetRequestedAt"));
        user.setCreatedAt(text(node, "createdAt"));
        user.setPasswordHash(text(node, "passwordHash"));
        return user;
    }

    private void writeUsers(List<UserRecord> users) {
        ObjectNode root = store.mapper().createObjectNode();
        ArrayNode array = root.putArray("users");
        users.forEach(user -> array.add(toJson(user)));
        store.write(path, root);
    }

    private ObjectNode toJson(UserRecord user) {
        ObjectNode node = store.mapper().createObjectNode();
        put(node, "id", user.getId());
        put(node, "email", user.getEmail());
        put(node, "name", user.getName());
        put(node, "role", user.getRole());
        put(node, "active", user.getActive());
        put(node, "isOwner", user.getIsOwner());
        put(node, "mustChangePassword", user.getMustChangePassword());
        putStrings(node, "permissions", user.getPermissions());
        put(node, "accessProfileId", user.getAccessProfileId());
        putStrings(node, "cmsPermissions", user.getCmsPermissions());
        if (user.getCmsPermissionOverrides() != null) {
            ArrayNode values = node.putArray("cmsPermissionOverrides");
            for (CmsPermissionOverride override : user.getCmsPermissionOverrides()) {
                ObjectNode item = values.addObject();
                put(item, "permission", override.getPermission());
                put(item, "effect", override.getEffect());
            }
        }
        put(node, "cmsTheme", user.getCmsTheme());
        put(node, "passwordResetRequestedAt", user.getPasswordResetRequestedAt());
        put(node, "createdAt", user.getCreatedAt());
        put(node, "passwordHash", user.getPasswordHash());
        return node;
    }

    private static List<UserRecord> copyUsers(List<UserRecord> users) {
        return users.stream().map(UserRecord::copy).toList();
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isString() ? value.asString() : null;
    }

    private static Boolean bool(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isBoolean() ? value.asBoolean() : null;
    }

    private static List<String> strings(JsonNode node) {
        if (node == null || !node.isArray()) return null;
        List<String> values = new ArrayList<>();
        for (JsonNode value : node) {
            if (value.isString()) values.add(value.asString());
        }
        return values;
    }

    private static List<String> presentStrings(JsonNode node) {
        List<String> values = strings(node);
        return values == null ? List.of() : values;
    }

    private static void put(ObjectNode node, String key, String value) {
        if (value != null) node.put(key, value);
    }

    private static void put(ObjectNode node, String key, Boolean value) {
        if (value != null) node.put(key, value);
    }

    private static void putStrings(ObjectNode node, String key, List<String> values) {
        if (values == null) return;
        ArrayNode array = node.putArray(key);
        values.forEach(array::add);
    }

    @FunctionalInterface
    public interface UserPatch {
        void apply(UserRecord user);
    }

    public record UpdateResult(UserRecord user, boolean emailConflict) {
    }
}
