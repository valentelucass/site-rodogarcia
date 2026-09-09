package br.com.rodogarcia.cms.backend.model.content;

import java.util.List;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/** Itens iniciais da faixa de certificações da Home e migração dos slots legados. */
public final class HomeCertificationDefaults {
    private static final List<Definition> DEFINITIONS = List.of(
        new Definition("home-cert-iso", "ISO 9001", "Logo ISO 9001", "/certificados/iso-9001-marquee.96db5a941c71.webp", "home.cert.iso"),
        new Definition("home-cert-sassmaq", "SASSMAQ", "Logo SASSMAQ", "/certificados/sassmaq-marquee.2bd290b6d955.webp", "home.cert.sassmaq"),
        new Definition("home-cert-ecovadis", "EcoVadis", "Logo EcoVadis", "/certificados/ecovadis-marquee.328117d0b616.webp", "home.cert.ecovadis"),
        new Definition("home-cert-pf", "Licença PF", "Logo da Polícia Federal", "/certificados/policia-federal-marquee.e06c0a6ec034.webp", "home.cert.pf"),
        new Definition("home-cert-pcsp", "Polícia Civil SP", "Logo da Polícia Civil de São Paulo", "/certificados/policia-civil-sp-marquee.cf85d95a8c02.webp", "home.cert.pcsp"),
        new Definition("home-cert-exercito", "Exército Brasileiro", "Logo do Exército Brasileiro", "/certificados/exercito-brasileiro-marquee.25640e0eb885.webp", "home.cert.exercito"),
        new Definition("home-cert-ibama", "IBAMA", "Logo IBAMA", "/certificados/ibama-marquee.4cdbe07db023.webp", "home.cert.ibama")
    );

    private HomeCertificationDefaults() {
    }

    public static ArrayNode items(ObjectMapper mapper) {
        return items(mapper, null);
    }

    /** Mantém personalizações dos antigos sete slots ao migrar a coleção. */
    public static ArrayNode items(ObjectMapper mapper, JsonNode legacySlots) {
        ObjectNode slots = ContentJson.object(legacySlots);
        ArrayNode result = mapper.createArrayNode();
        int order = 0;
        for (Definition definition : DEFINITIONS) {
            String customImage = ContentJson.url(slots.get(definition.legacySlot()));
            ObjectNode item = result.addObject();
            item.put("id", definition.id());
            item.put("order", ++order);
            item.put("title", definition.title());
            item.put("alt", definition.alt());
            item.put("image", customImage.isEmpty() ? definition.image() : customImage);
        }
        return result;
    }

    private record Definition(String id, String title, String alt, String image, String legacySlot) {
    }
}
