package br.com.rodogarcia.cms.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import br.com.rodogarcia.cms.backend.model.auth.SessionRecord;
import br.com.rodogarcia.cms.backend.support.AuthTestContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SessionServiceTest {

    @TempDir
    Path root;

    @Test
    void createsNodeCompatibleOpaqueTokensAndPersistsTheSlidingEightHourTtl() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-09-03T12:00:00Z"));
        AuthTestContext context = new AuthTestContext(root, clock);

        SessionRecord created = context.sessions.create("usr_test");
        assertThat(created.getId()).matches("[0-9a-f]{64}");
        assertThat(created.getCsrfToken()).matches("[0-9a-f]{64}");
        assertThat(created.getExpiresAt() - created.getCreatedAt())
            .isEqualTo(SessionService.SESSION_TTL_MS);

        clock.advance(Duration.ofHours(1));
        SessionRecord renewed = context.sessions.get(created.getId());
        assertThat(renewed).isNotNull();
        assertThat(renewed.getExpiresAt()).isEqualTo(clock.millis() + SessionService.SESSION_TTL_MS);

        String persisted = Files.readString(context.properties.storagePaths().sessions());
        assertThat(persisted).doesNotEndWith("\n");
        var value = context.mapper.readTree(persisted).path(created.getId());
        assertThat(value.path("id").asString()).isEqualTo(created.getId());
        assertThat(value.path("userId").asString()).isEqualTo("usr_test");
        assertThat(value.path("expiresAt").asLong()).isEqualTo(renewed.getExpiresAt());

        clock.advance(Duration.ofHours(9));
        assertThat(context.sessions.get(created.getId())).isNull();
        assertThat(context.mapper.readTree(Files.readString(
            context.properties.storagePaths().sessions())).has(created.getId())).isFalse();
    }

    private static final class MutableClock extends Clock {

        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
