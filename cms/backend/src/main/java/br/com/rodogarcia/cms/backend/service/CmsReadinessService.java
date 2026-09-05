package br.com.rodogarcia.cms.backend.service;

import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.function.Predicate;

import br.com.rodogarcia.cms.backend.config.CmsProperties;
import br.com.rodogarcia.cms.backend.config.StoragePaths;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public final class CmsReadinessService {

    private final CmsProperties properties;
    private final Predicate<Path> writeProbe;

    @Autowired
    public CmsReadinessService(CmsProperties properties) {
        this(properties, CmsReadinessService::canCreateAndDeleteProbe);
    }

    CmsReadinessService(CmsProperties properties, Predicate<Path> writeProbe) {
        this.properties = properties;
        this.writeProbe = writeProbe;
    }

    public boolean isReady() {
        try {
            StoragePaths paths = properties.storagePaths();
            if (!mediaToolsAreReadyWhenRequired()) return false;
            if (!existingDirectoryIsReadable(paths.root())) return false;

            Set<Path> writeProbeDirectories = new LinkedHashSet<>();
            writeProbeDirectories.add(paths.root().toAbsolutePath().normalize());

            for (Path directory : paths.directoryTargets()) {
                if (directory.equals(paths.root())) continue;
                Path probeDirectory = writeProbeDirectoryForDirectory(directory);
                if (probeDirectory == null) return false;
                writeProbeDirectories.add(probeDirectory);
            }
            for (Path file : paths.fileTargets()) {
                Path probeDirectory = writeProbeDirectoryForFile(file);
                if (probeDirectory == null) return false;
                writeProbeDirectories.add(probeDirectory);
            }

            Path uploadsProbeDirectory = writeProbeDirectoryForDirectory(properties.uploadsDir());
            if (uploadsProbeDirectory == null) return false;
            writeProbeDirectories.add(uploadsProbeDirectory);
            if (!existingDirectoryIsReadable(properties.frontendPublicDir())) return false;

            return writeProbeDirectories.stream().allMatch(writeProbe);
        } catch (InvalidPathException | SecurityException error) {
            return false;
        }
    }

    private boolean mediaToolsAreReadyWhenRequired() {
        if (!properties.production()) return true;
        return executableIsReady(properties.ffmpegPath())
            && executableIsReady(properties.ffprobePath());
    }

    private static boolean executableIsReady(String configured) {
        if (configured == null || configured.isBlank()) return false;
        Path executable = Path.of(configured).toAbsolutePath().normalize();
        return Files.isRegularFile(executable)
            && Files.isReadable(executable)
            && Files.isExecutable(executable);
    }

    private static Path writeProbeDirectoryForFile(Path target) {
        Path normalized = target.toAbsolutePath().normalize();
        if (Files.exists(normalized)) {
            boolean valid = Files.isRegularFile(normalized)
                && Files.isReadable(normalized)
                && Files.isWritable(normalized)
                && existingDirectoryIsReadable(normalized.getParent());
            return valid ? normalized.getParent() : null;
        }
        if (!Files.notExists(normalized)) return null;
        return nearestExistingReadableDirectory(normalized.getParent());
    }

    private static Path writeProbeDirectoryForDirectory(Path target) {
        Path normalized = target.toAbsolutePath().normalize();
        if (Files.exists(normalized)) return existingDirectoryIsReadable(normalized) ? normalized : null;
        if (!Files.notExists(normalized)) return null;
        return nearestExistingReadableDirectory(normalized.getParent());
    }

    private static Path nearestExistingReadableDirectory(Path candidate) {
        Path current = candidate;
        while (current != null) {
            if (Files.exists(current)) return existingDirectoryIsReadable(current) ? current : null;
            if (!Files.notExists(current)) return null;
            current = current.getParent();
        }
        return null;
    }

    private static boolean canCreateAndDeleteProbe(Path directory) {
        Path probe = null;
        try {
            probe = Files.createTempFile(directory, ".cms-readiness-", ".tmp");
            Files.writeString(probe, "ready");
            if (!Files.isRegularFile(probe) || !Files.isReadable(probe) || !Files.isWritable(probe)) {
                return false;
            }
            if (!Files.readString(probe).equals("ready")) return false;
            Files.delete(probe);
            probe = null;
            return true;
        } catch (Exception error) {
            return false;
        } finally {
            if (probe != null) {
                try {
                    Files.deleteIfExists(probe);
                } catch (Exception ignored) {
                    // O probe já falhou; não há resposta positiva com resíduo conhecido.
                }
            }
        }
    }

    private static boolean existingDirectoryIsReadable(Path directory) {
        return directory != null
            && Files.isDirectory(directory)
            && Files.isReadable(directory);
    }
}
