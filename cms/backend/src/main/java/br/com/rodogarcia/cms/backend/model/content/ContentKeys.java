package br.com.rodogarcia.cms.backend.model.content;

import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ContentKeys {
    public static final List<String> PAGE_KEYS = List.of(
        "about", "business", "contact", "careers", "quote", "collections", "improvements"
    );
    public static final Map<String, String> PAGE_PROPERTIES = Map.of(
        "about", "aboutPage",
        "business", "businessPage",
        "contact", "contactPage",
        "careers", "careersPage",
        "quote", "quotePage",
        "collections", "collectionsPage",
        "improvements", "improvementsPage"
    );
    public static final Set<String> HOME_SECTIONS = Set.of(
        "hero", "section1", "section2", "section3", "regionalPresence",
        "trackingCta", "socialProof", "quickActions", "certifications"
    );
    public static final Set<String> SERVICES_SECTIONS = Set.of("modules", "finalCta", "faq");
    public static final Set<String> FOOTER_SECTIONS = Set.of("footer", "terms", "help", "privacy");
    public static final Map<String, Set<String>> PAGE_SECTIONS = Map.of(
        "about", Set.of("hero", "compliance", "finalCta"),
        "business", Set.of("scaleCta", "faq"),
        "contact", Set.of("hero", "mainChannels", "info", "finalCta"),
        "careers", Set.of("hero", "cultureImage", "jobs", "directApplication", "finalCta"),
        "quote", Set.of("hero", "approvalChannel", "unservedOrigin", "operationGuidance", "directChannels", "otherChannels"),
        "collections", Set.of("hero", "operationGuidance"),
        "improvements", Set.of("operationGuidance")
    );

    private ContentKeys() {
    }
}
