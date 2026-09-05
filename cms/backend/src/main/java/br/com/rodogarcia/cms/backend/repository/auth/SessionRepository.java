package br.com.rodogarcia.cms.backend.repository.auth;

import java.nio.file.Path;
import java.time.Clock;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import br.com.rodogarcia.cms.backend.config.StoragePaths;
import br.com.rodogarcia.cms.backend.model.auth.SessionRecord;
import br.com.rodogarcia.cms.backend.repository.JsonFileStore;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Repository
public class SessionRepository {

    private final JsonFileStore store;
    private final Path path;
    private final Clock clock;

    public SessionRepository(JsonFileStore store, StoragePaths paths, Clock clock) {
        this.store = store;
        this.path = paths.sessions();
        this.clock = clock;
    }

    public void save(SessionRecord session) {
        store.withWriteLock(List.of(path), () -> {
            LinkedHashMap<String, SessionRecord> sessions = prune(readStore());
            sessions.put(session.getId(), session.copy());
            writeStore(sessions);
        });
    }

    public SessionRecord findAndRenew(String id, long ttlMillis) {
        return store.withWriteLock(List.of(path), () -> {
            LinkedHashMap<String, SessionRecord> sessions = readStore();
            SessionRecord session = sessions.get(id);
            long now = clock.millis();
            if (session == null) return null;
            if (session.getExpiresAt() <= now) {
                sessions.remove(id);
                writeStore(sessions);
                return null;
            }
            session.setExpiresAt(now + ttlMillis);
            sessions = prune(sessions);
            sessions.put(id, session);
            writeStore(sessions);
            return session.copy();
        });
    }

    public SessionRecord findWithoutRenewal(String id) {
        return store.withWriteLock(List.of(path), () -> {
            LinkedHashMap<String, SessionRecord> sessions = readStore();
            SessionRecord session = sessions.get(id);
            if (session == null) return null;
            if (session.getExpiresAt() <= clock.millis()) {
                sessions.remove(id);
                writeStore(sessions);
                return null;
            }
            return session.copy();
        });
    }

    public void delete(String id) {
        store.withWriteLock(List.of(path), () -> {
            LinkedHashMap<String, SessionRecord> sessions = readStore();
            sessions.remove(id);
            writeStore(sessions);
        });
    }

    public void deleteByUserId(String userId) {
        store.withWriteLock(List.of(path), () -> {
            LinkedHashMap<String, SessionRecord> sessions = prune(readStore());
            sessions.entrySet().removeIf(entry -> userId.equals(entry.getValue().getUserId()));
            writeStore(sessions);
        });
    }

    public void deleteByUserIdExcept(String userId, String sessionId) {
        store.withWriteLock(List.of(path), () -> {
            LinkedHashMap<String, SessionRecord> sessions = prune(readStore());
            sessions.entrySet().removeIf(entry -> userId.equals(entry.getValue().getUserId())
                && !sessionId.equals(entry.getKey()));
            writeStore(sessions);
        });
    }

    private LinkedHashMap<String, SessionRecord> readStore() {
        JsonNode root = store.read(path, store.mapper().createObjectNode());
        if (!root.isObject()) throw new IllegalStateException("Armazenamento de sessões inválido.");
        LinkedHashMap<String, SessionRecord> sessions = new LinkedHashMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = root.properties().iterator();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            JsonNode node = field.getValue();
            SessionRecord session = new SessionRecord(
                text(node, "id"),
                text(node, "userId"),
                text(node, "csrfToken"),
                number(node, "createdAt"),
                number(node, "expiresAt")
            );
            sessions.put(field.getKey(), session);
        }
        return sessions;
    }

    private LinkedHashMap<String, SessionRecord> prune(LinkedHashMap<String, SessionRecord> sessions) {
        long now = clock.millis();
        sessions.entrySet().removeIf(entry -> entry.getValue().getExpiresAt() <= now);
        return sessions;
    }

    private void writeStore(LinkedHashMap<String, SessionRecord> sessions) {
        ObjectNode root = store.mapper().createObjectNode();
        sessions.forEach((id, session) -> {
            ObjectNode node = root.putObject(id);
            node.put("id", session.getId());
            node.put("userId", session.getUserId());
            node.put("csrfToken", session.getCsrfToken());
            node.put("createdAt", session.getCreatedAt());
            node.put("expiresAt", session.getExpiresAt());
        });
        store.write(path, root);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isString() ? value.asString() : null;
    }

    private static long number(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isNumber() ? value.asLong() : 0L;
    }
}
