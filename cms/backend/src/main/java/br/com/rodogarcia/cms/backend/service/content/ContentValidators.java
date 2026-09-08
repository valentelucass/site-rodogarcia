package br.com.rodogarcia.cms.backend.service.content;

import java.util.Set;

import br.com.rodogarcia.cms.backend.exception.ApiException;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public final class ContentValidators {
    private static final Set<String> QUOTE_ICONS = Set.of(
        "WhatsappLogo", "PhoneCall", "EnvelopeSimple", "ClipboardText",
        "ChatCircleDots", "Headset", "MapPinLine", "Truck"
    );
    private static final Set<String> QUICK_ACTION_ICONS = Set.of(
        "FilePdf", "Calculator", "MagnifyingGlass", "Truck", "MapPin", "WhatsappLogo",
        "Phone", "Envelope", "ChatCircleDots", "Headset", "Package", "Handshake",
        "FileText", "ArrowSquareOut"
    );
    private static final Set<String> SOCIAL_ICONS = Set.of(
        "InstagramLogo", "LinkedinLogo", "FacebookLogo", "WhatsappLogo"
    );
    private static final Set<String> HELP_ICONS = Set.of("Package", "ChatCircleDots", "ShieldCheck");

    public void navigation(JsonNode payload) {
        ObjectNode source = requireObject(payload, "Navegação");
        JsonNode rawItems = source.get("items");
        if (rawItems == null || !rawItems.isArray() || rawItems.isEmpty() || rawItems.size() > 20) {
            throw new ApiException(400, "Informe entre 1 e 20 itens de navegação.");
        }
        Set<String> icons = Set.of(
            "home", "services", "about", "business", "contact", "careers", "quote",
            "collections", "voice", "improvements"
        );
        Set<String> tones = Set.of("blue", "emerald", "amber", "violet");
        for (JsonNode value : rawItems) {
            if (!value.isObject()) throw new ApiException(400, "Cada item precisa de nome e destino interno válido.");
            ObjectNode item = (ObjectNode) value;
            String label = ContentJson.text(item.get("label"), 60);
            String url = ContentJson.text(item.get("url"), 180);
            String icon = ContentJson.text(item.get("icon"), 40);
            if (label.isEmpty() || !url.startsWith("/")) {
                throw new ApiException(400, "Cada item precisa de nome e destino interno válido.");
            }
            if (url.startsWith("//") || !icons.contains(icon)) {
                throw new ApiException(400, "Use um ícone e destino permitidos para a navegação.");
            }
            if (!ContentJson.text(item.get("highlightLabel"), 24).isEmpty()
                && !tones.contains(ContentJson.text(item.get("highlightTone"), 20))) {
                throw new ApiException(400, "Escolha uma cor de destaque disponível.");
            }
        }
    }

    public void footer(String section, JsonNode payload) {
        ObjectNode source = requireObject(payload, "Seção FOOTER LINKS");
        switch (section) {
            case "footer" -> validateGlobalFooter(source);
            case "terms" -> validateTerms(source);
            case "help" -> validateHelp(source);
            case "privacy" -> validatePrivacy(source);
            default -> throw new ApiException(404, "Seção FOOTER LINKS não encontrada.");
        }
    }

    public void page(String page, String section, JsonNode payload) {
        ObjectNode source = requireObject(payload, "Seção");
        if (page.equals("about")) {
            if (section.equals("hero")) {
                required(source, "Sobre / Hero", "eyebrow", "title", "description");
                media(source.get("media"), "Sobre / Hero");
                ArrayNode stats = records(source.get("stats"), "Sobre / Hero: indicadores");
                if (stats.size() != 3) {
                    throw new ApiException(422, "Sobre / Hero: informe exatamente 3 indicadores.");
                }
                int index = 0;
                for (JsonNode value : stats) {
                    required(ContentJson.object(value), "Sobre / Hero: indicador " + (++index), "value", "label");
                }
                buttons(source.get("buttons"), 2, "Sobre / Hero");
            } else if (section.equals("compliance")) {
                required(source, "Sobre / Governança", "title", "description", "certificateText");
                media(source.get("image"), "Sobre / Governança");
                ArrayNode certifications = records(source.get("certifications"), "Sobre / Governança: certificados");
                if (certifications.size() < 1 || certifications.size() > 12) {
                    throw new ApiException(422, "Sobre / Governança: informe entre 1 e 12 certificados.");
                }
                int index = 0;
                for (JsonNode value : certifications) {
                    ObjectNode item = ContentJson.object(value);
                    required(item, "Sobre / Governança: certificado " + (++index), "title", "description");
                    media(item.get("image"), "Sobre / Governança");
                    optionalUrl(item.get("certificateUrl"), "Sobre / Governança: informe um link de certificado válido.");
                }
                optionalUrl(source.get("certificateUrl"), "Sobre / Governança: informe um link de certificado válido.");
            } else if (section.equals("finalCta")) {
                required(source, "Sobre / CTA final", "title", "description");
                buttons(source.get("buttons"), 2, "Sobre / CTA final");
            }
            return;
        }
        if (page.equals("business")) {
            if (section.equals("scaleCta")) buttons(source.get("buttons"), 2, "Empresas / CTA");
            if (section.equals("faq")) {
                required(source, "Empresas / FAQ", "title");
                faq(source.get("items"), 4, "Empresas / FAQ");
            }
            return;
        }
        if (page.equals("contact")) {
            if (section.equals("hero")) {
                buttons(single(source.has("heroWhatsappButton") ? source.get("heroWhatsappButton") : source), 1, "Contato / Hero");
            } else if (section.equals("mainChannels")) {
                ArrayNode channels = records(source.get("mainChannels"), "Contato: canais principais");
                if (channels.size() != 3) throw new ApiException(422, "Contato: informe exatamente 3 canais principais.");
                int index = 0;
                for (JsonNode channel : channels) {
                    ObjectNode item = ContentJson.object(channel);
                    required(item, "Contato: canal " + (++index), "description");
                    buttons(single(item.get("button")), 1, "Contato");
                }
            } else if (section.equals("info")) {
                ArrayNode items = records(source.get("items"), "Contato: itens informativos");
                ArrayNode indicators = records(source.get("indicators"), "Contato: indicadores");
                if (items.size() != 4 || indicators.size() != 2) {
                    throw new ApiException(422, "Contato: mantenha 4 itens informativos e 2 indicadores.");
                }
                for (JsonNode item : items) required(ContentJson.object(item), "Contato", "title", "description");
                for (JsonNode item : indicators) required(ContentJson.object(item), "Contato", "value", "description");
                required(source, "Contato / Informações", "companyTitle", "address", "hours", "channelGuideTitle",
                    "channelGuideDescription", "documentsDescription", "quickSupportDescription");
            } else if (section.equals("finalCta")) buttons(source.get("buttons"), 2, "Contato / CTA final");
            return;
        }
        if (page.equals("careers")) {
            if (Set.of("hero", "directApplication", "finalCta").contains(section)) {
                buttons(source.get("buttons"), 2, "Carreiras / Botões");
            } else if (section.equals("cultureImage")) {
                media(source, "Carreiras / Cultura");
            } else if (section.equals("jobs")) {
                JsonNode jobsValue = source.get("jobs");
                ArrayNode jobs = records(jobsValue, "Carreiras: vagas");
                if (jobsValue == null || jobs.size() != jobsValue.size()) {
                    throw new ApiException(422, "Carreiras: remova itens de vaga inválidos.");
                }
                int index = 0;
                for (JsonNode job : jobs) {
                    ObjectNode item = ContentJson.object(job);
                    required(item, "Carreiras: vaga " + (++index), "title", "location", "type", "description");
                    requiredUrl(item.get("applyUrl"), "Carreiras: preencha todos os campos obrigatórios da vaga " + index + ".");
                    optionalBoolean(item, "active", "Carreiras: informe um status válido.");
                }
            }
            return;
        }
        if (page.equals("quote")) {
            if (section.equals("hero")) buttons(source.get("buttons"), 2, "Cotação / Botões");
            else if (section.equals("approvalChannel")) {
                String url = ContentJson.url(source.get("whatsappUrl"));
                if (!url.matches("(?i)^https://(?:wa\\.me|api\\.whatsapp\\.com)/.*")) {
                    throw new ApiException(422, "Cotação: informe um link oficial do WhatsApp para aprovar a cotação.");
                }
            } else if (section.equals("unservedOrigin")) {
                required(source, "Cotação", "title", "description");
                buttons(single(source.get("button")), 1, "Cotação / Região não atendida");
            } else if (section.equals("operationGuidance")) operationGuidance(source, "Cotação / Orientações");
            else if (section.equals("directChannels")) directChannels(source);
            else if (section.equals("otherChannels")) otherChannels(source);
            return;
        }
        if (page.equals("collections")) {
            if (section.equals("hero")) buttons(source.get("buttons"), 2, "Coletas / Botões");
            if (section.equals("operationGuidance")) operationGuidance(source, "Coletas / Orientações");
            return;
        }
        if (page.equals("improvements") && section.equals("operationGuidance")) {
            operationGuidance(source, "Melhoria contínua / Orientações");
        }
    }

    private void validateGlobalFooter(ObjectNode source) {
        required(source, "Rodapé", "description", "serviceHoursTitle", "socialTitle", "copyrightText", "locationText", "creditText");
        buttons(single(source.get("proposalButton")), 1, "Botão de proposta");
        buttons(single(source.get("supportButton")), 1, "Botão de atendimento");
        requiredUrl(source.get("creditUrl"), "Link de crédito válido é obrigatório.");
        ArrayNode columns = records(source.get("columns"), "Colunas");
        int columnIndex = 0;
        for (JsonNode column : columns) {
            ObjectNode item = ContentJson.object(column);
            required(item, "Coluna " + (++columnIndex), "title");
            ArrayNode links = records(item.get("links"), "Coluna " + columnIndex + ": links");
            int linkIndex = 0;
            for (JsonNode link : links) buttons(single(link), 1, "Coluna " + columnIndex + ": link " + (++linkIndex));
        }
        textArray(source.get("serviceHours"), "Horários");
        ArrayNode socials = records(source.get("socialLinks"), "Redes sociais");
        int index = 0;
        for (JsonNode social : socials) {
            ObjectNode item = ContentJson.object(social);
            buttons(single(item), 1, "Rede social " + (++index));
            if (!SOCIAL_ICONS.contains(ContentJson.text(item.get("icon"), 40))) {
                throw new ApiException(422, "Rede social " + index + ": ícone inválido.");
            }
        }
        for (JsonNode link : records(source.get("bottomLinks"), "Links inferiores")) {
            buttons(single(link), 1, "Link inferior");
        }
    }

    private void validateTerms(ObjectNode source) {
        ObjectNode hero = requireObject(source.get("hero"), "Hero de termos");
        ObjectNode summary = requireObject(source.get("summary"), "Resumo de termos");
        ObjectNode reading = requireObject(source.get("reading"), "Leitura de termos");
        ObjectNode finalCta = requireObject(source.get("finalCta"), "CTA final de termos");
        required(hero, "Hero de termos", "eyebrow", "titleHighlight", "titleRest", "description");
        required(summary, "Resumo de termos", "eyebrow", "title", "description", "body");
        buttons(single(summary.get("button")), 1, "Resumo de termos: botão");
        required(reading, "Leitura de termos", "eyebrow", "title", "description");
        textBlocks(reading.get("blocks"), "Blocos de termos");
        required(finalCta, "CTA final de termos", "title", "description");
        buttons(finalCta.get("buttons"), 2, "CTA final de termos");
    }

    private void validateHelp(ObjectNode source) {
        ObjectNode hero = requireObject(source.get("hero"), "Hero da central de ajuda");
        ObjectNode quick = requireObject(source.get("quickAccess"), "Acessos rápidos");
        ObjectNode contact = requireObject(source.get("contactCard"), "Cartão de contato");
        ObjectNode faq = requireObject(source.get("faq"), "FAQ");
        ObjectNode support = requireObject(source.get("finalSupport"), "Suporte final");
        required(hero, "Hero da central de ajuda", "eyebrow", "titleHighlight", "titleRest", "description");
        buttons(hero.get("buttons"), 2, "Hero da central de ajuda");
        required(quick, "Acessos rápidos", "eyebrow", "title", "description");
        ArrayNode actions = records(quick.get("actions"), "Acessos rápidos");
        if (actions.size() != 3) throw new ApiException(422, "Acessos rápidos: mantenha exatamente 3 ações.");
        int index = 0;
        for (JsonNode action : actions) {
            ObjectNode item = ContentJson.object(action);
            required(item, "Ação rápida " + (++index), "title", "description");
            if (!HELP_ICONS.contains(ContentJson.text(item.get("icon"), 40))) {
                throw new ApiException(422, "Ação rápida " + index + ": ícone inválido.");
            }
            buttons(single(item.get("button")), 1, "Ação rápida " + index + ": botão");
        }
        required(contact, "Contato da ajuda", "phone", "hours");
        textArray(contact.get("channelDescriptions"), "Canais da ajuda");
        required(faq, "FAQ", "eyebrow", "title", "description");
        faq(faq.get("items"), 6, "FAQ");
        required(support, "Suporte final", "eyebrow", "title", "description");
        buttons(single(support.get("button")), 1, "Suporte final: botão");
    }

    private void validatePrivacy(ObjectNode source) {
        ObjectNode hero = requireObject(source.get("hero"), "Hero de privacidade");
        ObjectNode data = requireObject(source.get("dataSection"), "Seção de dados");
        ObjectNode finalCta = requireObject(source.get("finalCta"), "CTA final de privacidade");
        required(hero, "Hero de privacidade", "eyebrow", "titleHighlight", "titleRest", "description");
        buttons(single(hero.get("button")), 1, "Hero de privacidade: botão");
        required(data, "Seção de dados", "eyebrow", "title", "description");
        textBlocks(data.get("blocks"), "Blocos de privacidade");
        required(finalCta, "CTA final de privacidade", "title", "description");
        buttons(finalCta.get("buttons"), 2, "CTA final de privacidade");
    }

    private void directChannels(ObjectNode source) {
        ArrayNode channels = records(source.get("directChannels"), "Cotação: canais diretos");
        if (channels.size() != 2) throw new ApiException(422, "Cotação: informe exatamente 2 canais diretos.");
        int index = 0;
        for (JsonNode channel : channels) {
            ObjectNode item = ContentJson.object(channel);
            required(item, "Cotação: canal " + (++index), "title", "description");
            buttons(single(item.get("button")), 1, "Cotação");
        }
    }

    private void otherChannels(ObjectNode source) {
        JsonNode value = source.get("otherChannels");
        ArrayNode channels = records(value, "Cotação: canais");
        if (value == null || channels.size() != value.size()) throw new ApiException(422, "Cotação: remova itens de canal inválidos.");
        int index = 0;
        for (JsonNode channel : channels) {
            ObjectNode item = ContentJson.object(channel);
            int current = ++index;
            if (!QUOTE_ICONS.contains(ContentJson.text(item.get("icon"), 40))
                || ContentJson.hex(item.get("iconColor")).isEmpty()
                || ContentJson.hex(item.get("buttonColor")).isEmpty()) {
                throw new ApiException(422, "Cotação: preencha todos os campos obrigatórios do canal " + current + ".");
            }
            required(item, "Cotação: canal " + current, "title", "description");
            optionalBoolean(item, "active", "Cotação: preencha todos os campos obrigatórios do canal " + current + ".");
            buttons(single(item.get("button")), 1, "Cotação");
        }
    }

    private void operationGuidance(ObjectNode source, String label) {
        required(source, label, "eyebrow", "title", "description");
        faq(source.get("items"), 3, label);
    }

    public void quickActions(ArrayNode actions) {
        int index = 0;
        for (JsonNode value : actions) {
            ObjectNode action = ContentJson.object(value);
            String prefix = "Atalho " + (++index);
            if (ContentJson.text(action.get("label"), 40).isEmpty()
                || !QUICK_ACTION_ICONS.contains(ContentJson.text(action.get("icon"), 40))) {
                throw new ApiException(422, prefix + ": texto e ícone válido são obrigatórios.");
            }
            if (action.has("enabled") && action.get("enabled").isBoolean() && !action.get("enabled").booleanValue()) continue;
            String type = ContentJson.text(action.get("type"), 20);
            String target = type.equals("download")
                ? firstUrl(action, "downloadFile", "href")
                : ContentJson.url(action.get("href"));
            if (target.isEmpty()) throw new ApiException(422, prefix + ": informe um destino ou desative o atalho.");
            if (type.equals("modal") && !target.startsWith("#")) throw new ApiException(422, prefix + ": ações de âncora devem usar um destino iniciado por #.");
            if (type.equals("external") && !target.matches("(?i)^(?:https?:|mailto:|tel:).*")) throw new ApiException(422, prefix + ": links externos devem usar HTTP(S), mailto: ou tel:.");
            if ((type.isEmpty() || type.equals("link")) && !target.startsWith("/")) throw new ApiException(422, prefix + ": links internos devem começar com /.");
        }
    }

    private static void faq(JsonNode value, int count, String label) {
        ArrayNode items = records(value, label);
        if (items.size() != count) throw new ApiException(422, label + ": mantenha exatamente " + count + " perguntas.");
        int index = 0;
        for (JsonNode item : items) required(ContentJson.object(item), label + " " + (++index), "question", "answer");
    }

    private static void buttons(JsonNode value, int count, String label) {
        ArrayNode buttons = records(value, label);
        if (buttons.size() != count) throw new ApiException(422, label + ": informe exatamente " + count + " botão(ões).");
        int index = 0;
        for (JsonNode valueItem : buttons) {
            ObjectNode item = ContentJson.object(valueItem);
            if (ContentJson.text(item.get("label"), 60).isEmpty() || footerUrl(item.has("url") ? item.get("url") : item.get("href")).isEmpty()) {
                throw new ApiException(422, label + ": texto e link são obrigatórios no botão " + (++index) + ".");
            }
            index++;
        }
    }

    private static String footerUrl(JsonNode value) {
        String raw = ContentJson.text(value, 600);
        if (raw.equals("#")) return raw;
        return ContentJson.url(value);
    }

    private static void media(JsonNode value, String label) {
        ObjectNode media = requireObject(value, label + ": mídia");
        required(media, label, "src", "alt");
    }

    private static void required(ObjectNode source, String label, String... fields) {
        for (String field : fields) {
            if (ContentJson.text(source.get(field), 2000).isEmpty()) {
                throw new ApiException(422, label + ": o campo " + field + " é obrigatório.");
            }
        }
    }

    private static void requiredUrl(JsonNode value, String message) {
        if (footerUrl(value).isEmpty()) throw new ApiException(422, message);
    }

    private static void optionalUrl(JsonNode value, String message) {
        if (!ContentJson.text(value, 600).isEmpty() && ContentJson.url(value).isEmpty()) throw new ApiException(422, message);
    }

    private static void optionalBoolean(ObjectNode source, String key, String message) {
        if (source.has(key) && !source.get(key).isBoolean()) throw new ApiException(422, message);
    }

    private static ObjectNode requireObject(JsonNode value, String label) {
        if (value == null || !value.isObject()) throw new ApiException(422, label + " é obrigatório.");
        return (ObjectNode) value;
    }

    private static ArrayNode records(JsonNode value, String label) {
        if (value == null || !value.isArray()) throw new ApiException(422, label + ": informe uma lista válida.");
        for (JsonNode item : value) if (!item.isObject()) throw new ApiException(422, label + ": informe uma lista válida.");
        return (ArrayNode) value;
    }

    private static ArrayNode single(JsonNode value) {
        ArrayNode result = tools.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        if (value != null) result.add(value);
        return result;
    }

    private static void textArray(JsonNode value, String label) {
        if (value == null || !value.isArray()) throw new ApiException(422, label + ": informe uma lista válida.");
        int index = 0;
        for (JsonNode item : value) {
            if (ContentJson.text(item, 220).isEmpty()) throw new ApiException(422, label + " " + (++index) + " é obrigatório.");
            index++;
        }
    }

    private static void textBlocks(JsonNode value, String label) {
        int index = 0;
        for (JsonNode item : records(value, label)) {
            ObjectNode block = ContentJson.object(item);
            if (ContentJson.text(block.get("title"), 2000).isEmpty()
                || (ContentJson.text(block.get("description"), 2000).isEmpty()
                    && ContentJson.text(block.get("body"), 2000).isEmpty())) {
                throw new ApiException(422, label + " " + (++index) + ": título e descrição são obrigatórios.");
            }
            index++;
        }
    }

    private static String firstUrl(ObjectNode source, String... fields) {
        for (String field : fields) {
            String value = ContentJson.url(source.get(field));
            if (!value.isEmpty()) return value;
        }
        return "";
    }
}
