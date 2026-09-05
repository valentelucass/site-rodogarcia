package br.com.rodogarcia.site.backend.repository.json;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import br.com.rodogarcia.site.backend.exception.JsonStoreException;
import br.com.rodogarcia.site.backend.utils.NodeCompatibleJsonBytes;
import br.com.rodogarcia.site.backend.utils.NodeUtf8;
import br.com.rodogarcia.site.backend.validation.StrictJson;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.core.util.DefaultIndenter;
import tools.jackson.core.util.DefaultPrettyPrinter;
import tools.jackson.core.util.Separators;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class NodeCompatibleJsonStore {

    private final JsonMapper jsonMapper;

    public NodeCompatibleJsonStore(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    public JsonNode read(Path path, JsonNode defaultValue) {
        try {
            String raw = NodeUtf8.decode(Files.readAllBytes(path));
            if (!raw.isEmpty() && raw.charAt(0) == '\uFEFF') {
                raw = raw.substring(1);
            }
            return StrictJson.readTree(jsonMapper, raw);
        } catch (NoSuchFileException ignored) {
            return defaultValue.deepCopy();
        } catch (JacksonException error) {
            preserveInvalid(path);
            throw new JsonStoreException(path, error);
        } catch (IOException error) {
            throw new JsonStoreException(path, error);
        }
    }

    public void write(Path path, JsonNode value) {
        Path directory = path.getParent();
        String tempName = "." + path.getFileName() + "." + ProcessHandle.current().pid()
            + "." + System.currentTimeMillis() + ".tmp";
        Path temporary = directory.resolve(tempName);
        try {
            Files.createDirectories(directory);
            DefaultIndenter indenter = new DefaultIndenter("  ", "\n");
            Separators separators = Separators.createDefaultInstance()
                .withObjectNameValueSpacing(Separators.Spacing.AFTER);
            DefaultPrettyPrinter printer = new DefaultPrettyPrinter(separators)
                .withObjectIndenter(indenter)
                .withArrayIndenter(indenter);
            byte[] bytes = NodeCompatibleJsonBytes.normalize(
                jsonMapper.writer().with(printer).writeValueAsBytes(value)
            );
            Files.write(temporary, bytes);
            try {
                Files.move(
                    temporary,
                    path,
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING
                );
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(temporary, path, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException | JacksonException error) {
            throw new JsonStoreException(path, error);
        }
    }

    private static void preserveInvalid(Path path) {
        Path directory = path.getParent();
        Path backup = directory.resolve(
            "." + path.getFileName() + ".invalid-" + System.currentTimeMillis() + ".json"
        );
        try {
            Files.copy(path, backup);
        } catch (IOException ignored) {
            // O erro de leitura original permanece bloqueador mesmo sem a cópia.
        }
    }
}
