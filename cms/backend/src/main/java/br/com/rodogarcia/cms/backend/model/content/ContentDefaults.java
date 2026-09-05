package br.com.rodogarcia.cms.backend.model.content;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.zip.GZIPInputStream;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

public final class ContentDefaults {
    private static volatile ObjectNode cached;
    private static final String COMPRESSED_JSON = ""
        + "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"
        ;

    private ContentDefaults() {
    }

    public static ObjectNode content(ObjectMapper mapper) {
        ObjectNode current = cached;
        if (current == null) {
            synchronized (ContentDefaults.class) {
                current = cached;
                if (current == null) {
                    current = decode(mapper);
                    cached = current;
                }
            }
        }
        return current.deepCopy();
    }

    public static ObjectNode home(ObjectMapper mapper) {
        return (ObjectNode) content(mapper).get("homePage").deepCopy();
    }

    public static ObjectNode repositoryContent(ObjectMapper mapper) {
        ObjectNode result = mapper.createObjectNode();
        result.set("homePage", home(mapper));
        result.set("servicesPage", services(mapper));
        result.putArray("heroSlides");
        result.putArray("dnaSlides");
        result.putArray("feedbacks");
        result.putArray("vagas");
        result.putArray("units");
        return result;
    }

    public static ObjectNode services(ObjectMapper mapper) {
        return (ObjectNode) content(mapper).get("servicesPage").deepCopy();
    }

    public static ObjectNode page(ObjectMapper mapper, String pageKey) {
        String property = ContentKeys.PAGE_PROPERTIES.get(pageKey);
        if (property == null) return null;
        ObjectNode content = content(mapper);
        return content.has(property) && content.get(property).isObject()
            ? (ObjectNode) content.get(property).deepCopy()
            : mapper.createObjectNode();
    }

    public static ObjectNode footer(ObjectMapper mapper) {
        return (ObjectNode) content(mapper).get("footerLinks").deepCopy();
    }

    public static ObjectNode navigation(ObjectMapper mapper) {
        return (ObjectNode) content(mapper).get("headerNavigation").deepCopy();
    }

    private static ObjectNode improvements(ObjectMapper mapper) {
        ObjectNode page = mapper.createObjectNode();
        ObjectNode guidance = page.putObject("operationGuidance");
        guidance.put("eyebrow", "Para aproveitar melhor");
        guidance.put("title", "Dicas para enviar uma boa sugestão");
        guidance.put("description", "Quanto mais contexto você compartilhar, mais fácil será avaliar o próximo passo.");
        var items = guidance.putArray("items");
        items.addObject().put("id", "improvements-guidance-context").put("order", 1)
            .put("question", "O que vale a pena explicar?")
            .put("answer", "Conte o que acontece hoje, em que momento isso dificulta sua rotina ou experiência no site e qual resultado você espera alcançar.");
        items.addObject().put("id", "improvements-guidance-files").put("order", 2)
            .put("question", "Posso enviar um arquivo ou uma imagem?")
            .put("answer", "Sim. Você pode anexar fotos, planilhas CSV, XLS ou XLSX que ajudem a entender o caso. Os arquivos ficam disponíveis apenas para a equipe responsável.");
        items.addObject().put("id", "improvements-guidance-return").put("order", 3)
            .put("question", "Quando receberei um retorno?")
            .put("answer", "Cada sugestão é analisada pela equipe responsável. O envio não gera atendimento imediato, mas ajuda a priorizar melhorias reais para o site e para a operação.");
        return page;
    }

    private static ObjectNode decode(ObjectMapper mapper) {
        byte[] compressed = Base64.getDecoder().decode(COMPRESSED_JSON);
        try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(compressed))) {
            ObjectNode content = (ObjectNode) mapper.readTree(gzip);
            if (!content.has("improvementsPage")) content.set("improvementsPage", improvements(mapper));
            ContentMediaPresentations.normalizeContent(content, mapper);
            return content;
        } catch (IOException exception) {
            throw new IllegalStateException("Defaults de conteúdo do CMS inválidos.", exception);
        }
    }
}
