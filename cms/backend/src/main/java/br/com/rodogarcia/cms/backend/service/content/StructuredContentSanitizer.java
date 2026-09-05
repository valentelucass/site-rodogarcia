package br.com.rodogarcia.cms.backend.service.content;

import java.time.Clock;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import br.com.rodogarcia.cms.backend.model.content.ContentDefaults;
import br.com.rodogarcia.cms.backend.model.content.ContentJson;
import br.com.rodogarcia.cms.backend.model.content.ContentKeys;
import br.com.rodogarcia.cms.backend.model.content.ContentTime;
import br.com.rodogarcia.cms.backend.model.content.MediaPresentation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.BooleanNode;
import tools.jackson.databind.node.IntNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

@Service
public final class StructuredContentSanitizer {
    private static final Set<String> NAVIGATION_ICONS = Set.of(
        "home", "services", "about", "business", "contact", "careers", "quote",
        "collections", "voice", "improvements"
    );
    private static final Set<String> NAVIGATION_TONES = Set.of("blue", "emerald", "amber", "violet");
    private static final Set<String> URL_FIELDS = Set.of(
        "url", "href", "ctaUrl", "quoteUrl", "trackingUrl", "contactUrl", "applyUrl",
        "certificateUrl", "creditUrl", "whatsappUrl", "downloadFile"
    );
    private static final Set<String> COLOR_FIELDS = Set.of("color", "iconColor", "buttonColor");
    private static final Set<String> MULTILINE_FIELDS = Set.of("metaTags");
    private static final Set<String> FIXED_ARRAY_PATHS = Set.of(
        "businessPage.faq.items",
        "aboutPage.hero.buttons",
        "aboutPage.finalCta.buttons",
        "businessPage.scaleCta.buttons",
        "contactPage.mainChannels",
        "contactPage.info.items",
        "contactPage.info.indicators",
        "contactPage.finalCta.buttons",
        "careersPage.hero.buttons",
        "careersPage.directApplication.buttons",
        "careersPage.finalCta.buttons",
        "quotePage.hero.buttons",
        "quotePage.directChannels",
        "collectionsPage.hero.buttons",
        "collectionsPage.operationGuidance.items",
        "quotePage.operationGuidance.items",
        "improvementsPage.operationGuidance.items",
        "footerLinks.terms.finalCta.buttons",
        "footerLinks.help.hero.buttons",
        "footerLinks.help.quickAccess.actions",
        "footerLinks.help.faq.items",
        "footerLinks.privacy.finalCta.buttons"
    );
    private static final Map<String, Integer> ARRAY_LIMITS = Map.of(
        "aboutPage.compliance.certifications", 12,
        "footerLinks.footer.serviceHours", 5,
        "footerLinks.help.contactCard.channelDescriptions", 3,
        "footerLinks.privacy.dataSection.blocks", 5
    );
    private static final Set<String> EMPTY_MEANS_DEFAULT_ARRAY_PATHS = Set.of(
        "aboutPage.compliance.certifications"
    );
    private static final Set<String> QUOTE_ICONS = Set.of(
        "WhatsappLogo", "PhoneCall", "EnvelopeSimple", "ClipboardText",
        "ChatCircleDots", "Headset", "MapPinLine", "Truck"
    );
    private static final Set<String> SOCIAL_ICONS = Set.of(
        "InstagramLogo", "LinkedinLogo", "FacebookLogo", "WhatsappLogo"
    );
    private static final Set<String> HELP_ICONS = Set.of("Package", "ChatCircleDots", "ShieldCheck");

    private final JsonMapper mapper;
    private final ContentMediaValidator mediaValidator;
    private final Clock clock;

    @Autowired
    public StructuredContentSanitizer(JsonMapper mapper, ContentMediaValidator mediaValidator) {
        this(mapper, mediaValidator, Clock.systemUTC());
    }

    StructuredContentSanitizer(JsonMapper mapper, ContentMediaValidator mediaValidator, Clock clock) {
        this.mapper = mapper;
        this.mediaValidator = mediaValidator;
        this.clock = clock;
    }

    public ObjectNode page(String pageKey, JsonNode value) {
        if (!ContentKeys.PAGE_KEYS.contains(pageKey)) return null;
        ObjectNode defaults = ContentDefaults.page(mapper, pageKey);
        JsonNode input = value;
        if (pageKey.equals("careers") && value != null && value.isObject()) {
            ObjectNode source = ((ObjectNode) value).deepCopy();
            if (!source.has("jobs") || !source.get("jobs").isArray()) {
                source.set("jobs", mapper.createArrayNode());
            }
            input = source;
        }
        ObjectNode result = sanitizeObject(input, defaults, ContentKeys.PAGE_PROPERTIES.get(pageKey));
        if (pageKey.equals("about")) {
            ObjectNode sourceCompliance = ContentJson.object(ContentJson.object(value).get("compliance"));
            ObjectNode resultCompliance = ContentJson.object(result.get("compliance"));
            ObjectNode defaultCompliance = ContentJson.object(defaults.get("compliance"));
            resultCompliance.set("certifications", sanitizeCertifications(
                sourceCompliance, defaultCompliance));
        }
        if (pageKey.equals("contact")) enforceContactLabels(result, defaults);
        if (pageKey.equals("quote")) enforceQuoteApproval(value, result, defaults);
        return result;
    }

    public ObjectNode footer(JsonNode value) {
        ObjectNode defaults = ContentDefaults.footer(mapper);
        ObjectNode result = sanitizeObject(value, defaults, "footerLinks");
        ObjectNode source = ContentJson.object(value);
        customizeFooterGlobal(
            ContentJson.object(source.get("footer")),
            ContentJson.object(result.get("footer")),
            ContentJson.object(defaults.get("footer"))
        );
        customizeFooterBlocks(source, result, defaults, "terms", "reading", "blocks", Integer.MAX_VALUE);
        customizeFooterBlocks(source, result, defaults, "privacy", "dataSection", "blocks", 5);
        enforceHelpActionIcons(source, result, defaults);
        return result;
    }

    public ObjectNode navigation(JsonNode value) {
        ObjectNode source = ContentJson.object(value);
        ArrayNode input = ContentJson.array(source.get("items"));
        ArrayNode fallback = (ArrayNode) ContentDefaults.navigation(mapper).get("items");
        ArrayNode items = mapper.createArrayNode();
        ArrayNode chosen = source.has("items") && source.get("items").isArray() ? input : fallback;
        int limit = Math.min(20, chosen.size());
        for (int index = 0; index < limit; index++) {
            ObjectNode raw = ContentJson.object(chosen.get(index));
            ObjectNode defaultItem = index < fallback.size()
                ? ContentJson.object(fallback.get(index))
                : mapper.createObjectNode();
            String rawUrl = ContentJson.text(raw.get("url"), 180);
            String url = rawUrl.startsWith("/") && !rawUrl.startsWith("//")
                ? rawUrl
                : ContentJson.text(defaultItem.get("url"), 180);
            String icon = ContentJson.text(raw.get("icon"), 40);
            ObjectNode item = mapper.createObjectNode();
            item.put("id", fallbackText(raw.get("id"), defaultItem.get("id"), 80, "nav-item-" + (index + 1)));
            item.put("order", index + 1);
            item.put("group", raw.has("group") && raw.get("group").isString()
                && "principal".equals(raw.get("group").asString()) ? "principal" : "explorar");
            item.put("label", fallbackText(raw.get("label"), defaultItem.get("label"), 60, "Item de navegação"));
            item.put("url", url.isEmpty() ? "/" : url);
            item.put("icon", NAVIGATION_ICONS.contains(icon)
                ? icon
                : fallbackText(defaultItem.get("icon"), null, 40, "about"));
            String highlight = ContentJson.text(raw.get("highlightLabel"), 24);
            if (!highlight.isEmpty()) {
                item.put("highlightLabel", highlight);
                String tone = raw.has("highlightTone") && raw.get("highlightTone").isString()
                    ? raw.get("highlightTone").asString() : "";
                item.put("highlightTone", NAVIGATION_TONES.contains(tone) ? tone : "blue");
            }
            items.add(item);
        }
        if (items.isEmpty()) items.addAll(fallback);
        ObjectNode result = mapper.createObjectNode();
        result.set("items", items);
        return result;
    }

    public ObjectNode sanitizeObject(JsonNode input, ObjectNode defaults, String path) {
        ObjectNode source = ContentJson.object(input);
        ObjectNode result = mapper.createObjectNode();
        defaults.properties().forEach(entry -> {
            String key = entry.getKey();
            JsonNode fallback = entry.getValue();
            JsonNode current = source.get(key);
            String childPath = path.isEmpty() ? key : path + "." + key;
            if (current == null || current.isNull()) current = alias(source, key, childPath);
            result.set(key, sanitizeValue(current, fallback, key, childPath));
        });
        deriveExternalFlags(result);
        return result;
    }

    private JsonNode sanitizeValue(JsonNode current, JsonNode fallback, String key, String path) {
        if (fallback.isObject()) return sanitizeObject(current, (ObjectNode) fallback, path);
        if (fallback.isArray()) return sanitizeArray(current, (ArrayNode) fallback, path);
        if (fallback.isBoolean()) {
            return BooleanNode.valueOf(ContentJson.strictBoolean(current, fallback.booleanValue()));
        }
        if (fallback.isIntegralNumber()) {
            return IntNode.valueOf(ContentJson.integer(current, fallback.intValue()));
        }
        if (fallback.isNumber()) {
            return current != null && current.isNumber() ? current.deepCopy() : fallback.deepCopy();
        }
        if (fallback.isNull()) return current == null ? fallback.deepCopy() : current.deepCopy();

        int separator = path.lastIndexOf('.');
        String parentPath = separator < 0 ? "" : path.substring(0, separator);
        int maxLength = maxLength(parentPath, key);
        String fallbackValue = ContentJson.text(fallback, maxLength);
        String value;
        if (MULTILINE_FIELDS.contains(key)) {
            value = ContentJson.multiline(current, maxLength);
        } else if (URL_FIELDS.contains(key)) {
            value = ContentJson.url(current);
        } else if (COLOR_FIELDS.contains(key) || key.toLowerCase(Locale.ROOT).endsWith("color")) {
            value = ContentJson.hex(current);
        } else if (isMediaPath(path, key)) {
            value = safeImage(current, fallbackValue);
        } else {
            value = ContentJson.text(current, maxLength);
        }
        if (value.isEmpty()) value = fallbackValue;
        return StringNode.valueOf(value);
    }

    private ArrayNode sanitizeArray(JsonNode current, ArrayNode fallback, String path) {
        if (path.equals("careersPage.jobs")) return sanitizeCareersJobs(current, fallback);
        if (path.equals("quotePage.otherChannels")) return sanitizeQuoteChannels(current, fallback);
        boolean supplied = current != null && current.isArray();
        ArrayNode input = supplied ? (ArrayNode) current : fallback;
        if (EMPTY_MEANS_DEFAULT_ARRAY_PATHS.contains(path) && input.isEmpty()) input = fallback;
        ArrayNode result = mapper.createArrayNode();
        boolean fixed = FIXED_ARRAY_PATHS.contains(path);
        int size = fixed ? fallback.size() : input.size();
        size = Math.min(size, ARRAY_LIMITS.getOrDefault(path, Integer.MAX_VALUE));
        for (int index = 0; index < size; index++) {
            JsonNode fallbackItem = fallback.isEmpty()
                ? JsonNodeFactory.instance.objectNode()
                : fallback.get(Math.min(index, fallback.size() - 1));
            JsonNode inputItem = index < input.size() ? input.get(index) : fallbackItem;
            JsonNode value;
            if (fallbackItem.isObject()) {
                value = sanitizeDynamicObject(inputItem, (ObjectNode) fallbackItem, path + "[]", index);
            } else if (fallbackItem.isString()) {
                String clean = ContentJson.text(inputItem, 220);
                if (clean.isEmpty() && !supplied) clean = ContentJson.text(fallbackItem, 220);
                if (clean.isEmpty() && supplied) continue;
                value = StringNode.valueOf(clean);
            } else {
                value = inputItem.deepCopy();
            }
            result.add(value);
        }
        if (hasOrderedItems(fallback) || (fallback.isEmpty() && hasOrderedItems(input))) {
            normalizeOrders(result);
        }
        return result;
    }

    private ObjectNode sanitizeDynamicObject(
        JsonNode input,
        ObjectNode fallback,
        String path,
        int index
    ) {
        ObjectNode result = sanitizeObject(input, fallback, path);
        if (result.has("id") && ContentJson.text(result.get("id"), 80).isEmpty()) {
            result.put("id", "item-" + (index + 1));
        }
        return result;
    }

    private ArrayNode sanitizeCareersJobs(JsonNode current, ArrayNode fallback) {
        ArrayNode source = current != null && current.isArray() ? (ArrayNode) current : fallback;
        ArrayNode result = mapper.createArrayNode();
        int order = 0;
        for (JsonNode value : source) {
            ObjectNode item = ContentJson.object(value);
            ObjectNode output = mapper.createObjectNode();
            String id = ContentJson.text(item.get("id"), 80);
            output.put("id", id.isEmpty() ? ContentJson.newId("career_job") : id);
            output.put("order", ++order);
            output.put("title", ContentJson.text(item.get("title"), 90));
            output.put("location", ContentJson.text(item.get("location"), 90));
            JsonNode type = item.has("type") && !item.get("type").isNull()
                ? item.get("type") : item.get("contractType");
            output.put("type", ContentJson.text(type, 40));
            output.put("description", ContentJson.text(item.get("description"), 220));
            output.put("applyUrl", ContentJson.url(item.get("applyUrl")));
            output.put("active", !item.has("active") || !item.get("active").isBoolean()
                || item.get("active").booleanValue());
            output.put("createdAt", ContentJson.text(item.get("createdAt"), 40));
            output.put("updatedAt", ContentJson.text(item.get("updatedAt"), 40));
            if (required(output, "title", "location", "type", "description", "applyUrl")) {
                result.add(output);
            }
        }
        normalizeOrders(result);
        return result;
    }

    private ArrayNode sanitizeQuoteChannels(JsonNode current, ArrayNode fallback) {
        boolean supplied = current != null && current.isArray();
        ArrayNode source = supplied ? (ArrayNode) current : fallback;
        ArrayNode result = mapper.createArrayNode();
        for (int index = 0; index < source.size(); index++) {
            ObjectNode item = ContentJson.object(source.get(index));
            ObjectNode fallbackItem = ContentJson.object(fallback.isEmpty()
                ? null : fallback.get(index < fallback.size() ? index : 0));
            ObjectNode output = mapper.createObjectNode();
            String id = ContentJson.text(item.get("id"), 80);
            output.put("id", id.isEmpty() ? ContentJson.newId("quote_channel") : id);
            output.put("order", index + 1);
            JsonNode iconValue = item.has("icon") && !item.get("icon").isNull()
                ? item.get("icon") : fallbackItem.get("icon");
            String icon = ContentJson.text(iconValue, 40);
            output.put("icon", QUOTE_ICONS.contains(icon) ? icon : "ChatCircleDots");
            output.put("iconColor", colorOr(item.get("iconColor"), fallbackItem.get("iconColor")));
            output.put("title", textOr(item.get("title"), fallbackItem.get("title"), 90));
            output.put("description", textOr(item.get("description"), fallbackItem.get("description"), 220));
            output.set("button", sanitizeButton(item.get("button"), ContentJson.object(fallbackItem.get("button")), 40));
            output.put("buttonColor", colorOr(item.get("buttonColor"), fallbackItem.get("buttonColor")));
            output.put("active", !item.has("active") || !item.get("active").isBoolean()
                || item.get("active").booleanValue());
            String now = ContentTime.now(clock);
            String createdAt = supplied ? ContentJson.text(item.get("createdAt"), 40) : "";
            String updatedAt = supplied ? ContentJson.text(item.get("updatedAt"), 40) : "";
            output.put("createdAt", createdAt.isEmpty() ? now : createdAt);
            output.put("updatedAt", updatedAt.isEmpty() ? now : updatedAt);
            result.add(output);
        }
        return result;
    }

    private ArrayNode sanitizeCertifications(
        ObjectNode sourceCompliance,
        ObjectNode defaultCompliance
    ) {
        ArrayNode source = ContentJson.array(sourceCompliance.get("certifications"));
        ArrayNode defaults = ContentJson.array(defaultCompliance.get("certifications"));
        if (source.isEmpty()) return defaults.deepCopy();

        ObjectNode genericFallback = mapper.createObjectNode();
        genericFallback.put("title", textOr(
            sourceCompliance.get("certificateText"), defaultCompliance.get("certificateText"), 180));
        genericFallback.put("description", textOr(
            sourceCompliance.get("description"), defaultCompliance.get("description"), 320));
        genericFallback.set("image", sanitizeMedia(
            sourceCompliance.get("image"), ContentJson.object(defaultCompliance.get("image"))));

        ArrayNode result = mapper.createArrayNode();
        int limit = Math.min(12, source.size());
        for (int index = 0; index < limit; index++) {
            ObjectNode item = ContentJson.object(source.get(index));
            ObjectNode fallback = index < defaults.size()
                ? ContentJson.object(defaults.get(index)) : genericFallback;
            ObjectNode output = mapper.createObjectNode();
            output.put("title", textOr(item.get("title"), fallback.get("title"), 180));
            output.put("description", textOr(item.get("description"), fallback.get("description"), 320));
            output.set("image", sanitizeMedia(item.get("image"), ContentJson.object(fallback.get("image"))));
            output.put("certificateUrl", ContentJson.url(item.get("certificateUrl")));
            result.add(output);
        }
        return result;
    }

    private void enforceContactLabels(ObjectNode page, ObjectNode defaults) {
        ArrayNode channels = ContentJson.array(page.get("mainChannels"));
        ArrayNode defaultChannels = ContentJson.array(defaults.get("mainChannels"));
        for (int index = 0; index < Math.min(channels.size(), defaultChannels.size()); index++) {
            ContentJson.object(channels.get(index)).put(
                "title", ContentJson.text(defaultChannels.get(index).get("title"), 320));
        }
        ArrayNode items = ContentJson.array(page.path("info").get("items"));
        ArrayNode defaultItems = ContentJson.array(defaults.path("info").get("items"));
        for (int index = 0; index < Math.min(items.size(), defaultItems.size()); index++) {
            ContentJson.object(items.get(index)).put(
                "label", ContentJson.text(defaultItems.get(index).get("label"), 320));
        }
    }

    private void enforceQuoteApproval(JsonNode value, ObjectNode page, ObjectNode defaults) {
        ObjectNode source = ContentJson.object(ContentJson.object(value).get("approvalChannel"));
        String candidate = ContentJson.url(source.get("whatsappUrl"));
        if (!candidate.matches("(?i)^https://(?:wa\\.me|api\\.whatsapp\\.com)/.*")) {
            candidate = defaults.path("approvalChannel").path("whatsappUrl").asString();
        }
        ContentJson.object(page.get("approvalChannel")).put("whatsappUrl", candidate);
    }

    private void enforceHelpActionIcons(ObjectNode source, ObjectNode result, ObjectNode defaults) {
        ArrayNode rawActions = ContentJson.array(
            ContentJson.object(ContentJson.object(source.get("help")).get("quickAccess")).get("actions"));
        ArrayNode actions = ContentJson.array(
            ContentJson.object(ContentJson.object(result.get("help")).get("quickAccess")).get("actions"));
        ArrayNode fallback = ContentJson.array(
            ContentJson.object(ContentJson.object(defaults.get("help")).get("quickAccess")).get("actions"));
        for (int index = 0; index < Math.min(actions.size(), fallback.size()); index++) {
            String icon = index < rawActions.size()
                ? ContentJson.text(ContentJson.object(rawActions.get(index)).get("icon"), 40) : "";
            ContentJson.object(actions.get(index)).put("icon", HELP_ICONS.contains(icon)
                ? icon : fallback.get(index).path("icon").asString());
        }
    }

    private void customizeFooterGlobal(
        ObjectNode source,
        ObjectNode result,
        ObjectNode defaults
    ) {
        ArrayNode defaultColumns = ContentJson.array(defaults.get("columns"));
        ArrayNode columnsSource = source.has("columns") && source.get("columns").isArray()
            ? records(source.get("columns")) : defaultColumns;
        ArrayNode columns = mapper.createArrayNode();
        for (int index = 0; index < columnsSource.size(); index++) {
            ObjectNode fallback = index < defaultColumns.size()
                ? ContentJson.object(defaultColumns.get(index)) : null;
            ObjectNode column = sanitizeFooterColumn(
                ContentJson.object(columnsSource.get(index)), index, fallback);
            if (!ContentJson.text(column.get("title"), 80).isEmpty()) columns.add(column);
        }
        normalizeOrders(columns);
        result.set("columns", columns);

        ArrayNode hours = mapper.createArrayNode();
        JsonNode rawHours = source.get("serviceHours");
        ArrayNode hoursSource = rawHours != null && rawHours.isArray()
            ? (ArrayNode) rawHours : ContentJson.array(defaults.get("serviceHours"));
        for (JsonNode value : hoursSource) {
            if (hours.size() == 5) break;
            String text = ContentJson.text(value, 220);
            if (!text.isEmpty()) hours.add(text);
        }
        result.set("serviceHours", hours);

        result.set("socialLinks", sanitizeFooterLinks(
            source, defaults, "socialLinks", true));
        result.set("bottomLinks", sanitizeFooterLinks(
            source, defaults, "bottomLinks", false));
    }

    private ArrayNode sanitizeFooterLinks(
        ObjectNode source,
        ObjectNode defaults,
        String key,
        boolean social
    ) {
        ArrayNode fallback = ContentJson.array(defaults.get(key));
        ArrayNode chosen = source.has(key) && source.get(key).isArray()
            ? records(source.get(key)) : fallback;
        ArrayNode result = mapper.createArrayNode();
        for (int index = 0; index < chosen.size(); index++) {
            ObjectNode fallbackItem = index < fallback.size()
                ? ContentJson.object(fallback.get(index)) : null;
            ObjectNode item = sanitizeFooterLink(
                ContentJson.object(chosen.get(index)), index, fallbackItem);
            if (social) {
                String icon = ContentJson.text(chosen.get(index).get("icon"), 40);
                String fallbackIcon = fallbackItem == null
                    ? "" : ContentJson.text(fallbackItem.get("icon"), 40);
                item.put("icon", SOCIAL_ICONS.contains(icon)
                    ? icon : (fallbackIcon.isEmpty() ? "InstagramLogo" : fallbackIcon));
            }
            if (required(item, "label", "url")) result.add(item);
        }
        normalizeOrders(result);
        return result;
    }

    private ObjectNode sanitizeFooterColumn(
        ObjectNode source,
        int index,
        ObjectNode fallback
    ) {
        ObjectNode result = mapper.createObjectNode();
        String fallbackId = fallback == null ? "" : ContentJson.text(fallback.get("id"), 80);
        String id = ContentJson.text(source.get("id"), 80);
        result.put("id", id.isEmpty()
            ? (fallbackId.isEmpty() ? ContentJson.newId("footer_column") : fallbackId) : id);
        result.put("order", index + 1);
        result.put("title", textOr(source.get("title"), fallback == null ? null : fallback.get("title"), 80, "Links"));

        ArrayNode fallbackLinks = fallback == null
            ? mapper.createArrayNode() : ContentJson.array(fallback.get("links"));
        ArrayNode chosen = source.has("links") && source.get("links").isArray()
            ? records(source.get("links")) : fallbackLinks;
        ArrayNode links = mapper.createArrayNode();
        for (int linkIndex = 0; linkIndex < chosen.size(); linkIndex++) {
            ObjectNode fallbackLink = linkIndex < fallbackLinks.size()
                ? ContentJson.object(fallbackLinks.get(linkIndex)) : null;
            ObjectNode link = sanitizeFooterLink(
                ContentJson.object(chosen.get(linkIndex)), linkIndex, fallbackLink);
            if (required(link, "label", "url")) links.add(link);
        }
        normalizeOrders(links);
        result.set("links", links);
        return result;
    }

    private ObjectNode sanitizeFooterLink(ObjectNode source, int index, ObjectNode fallback) {
        ObjectNode fallbackButton = fallback == null ? mapper.createObjectNode() : fallback;
        if (fallback == null) fallbackButton.put("url", "/");
        ObjectNode result = sanitizeButton(source, fallbackButton, 60);
        String id = ContentJson.text(source.get("id"), 80);
        String fallbackId = fallback == null ? "" : ContentJson.text(fallback.get("id"), 80);
        ObjectNode ordered = mapper.createObjectNode();
        ordered.put("id", id.isEmpty()
            ? (fallbackId.isEmpty() ? ContentJson.newId("footer_link") : fallbackId) : id);
        ordered.put("order", index + 1);
        result.properties().forEach(entry -> ordered.set(entry.getKey(), entry.getValue().deepCopy()));
        return ordered;
    }

    private void customizeFooterBlocks(
        ObjectNode source,
        ObjectNode result,
        ObjectNode defaults,
        String sectionKey,
        String containerKey,
        String arrayKey,
        int limit
    ) {
        ObjectNode sourceContainer = ContentJson.object(
            ContentJson.object(source.get(sectionKey)).get(containerKey));
        ObjectNode resultContainer = ContentJson.object(
            ContentJson.object(result.get(sectionKey)).get(containerKey));
        ObjectNode defaultContainer = ContentJson.object(
            ContentJson.object(defaults.get(sectionKey)).get(containerKey));
        ArrayNode fallback = ContentJson.array(defaultContainer.get(arrayKey));
        ArrayNode chosen = sourceContainer.has(arrayKey) && sourceContainer.get(arrayKey).isArray()
            ? records(sourceContainer.get(arrayKey)) : fallback;
        ArrayNode blocks = mapper.createArrayNode();
        int size = Math.min(limit, chosen.size());
        for (int index = 0; index < size; index++) {
            ObjectNode fallbackBlock = index < fallback.size()
                ? ContentJson.object(fallback.get(index)) : null;
            ObjectNode block = sanitizeTextBlock(
                ContentJson.object(chosen.get(index)), index, fallbackBlock);
            if (required(block, "title", "description")) blocks.add(block);
        }
        normalizeOrders(blocks);
        resultContainer.set(arrayKey, blocks);
    }

    private ObjectNode sanitizeTextBlock(ObjectNode source, int index, ObjectNode fallback) {
        ObjectNode result = mapper.createObjectNode();
        String id = ContentJson.text(source.get("id"), 80);
        String fallbackId = fallback == null ? "" : ContentJson.text(fallback.get("id"), 80);
        result.put("id", id.isEmpty()
            ? (fallbackId.isEmpty() ? ContentJson.newId("footer_block") : fallbackId) : id);
        result.put("order", index + 1);
        result.put("title", textOr(source.get("title"), fallback == null ? null : fallback.get("title"), 180));
        JsonNode description = source.has("description") && !source.get("description").isNull()
            ? source.get("description") : source.get("body");
        result.put("description", textOr(
            description, fallback == null ? null : fallback.get("description"), 700));
        return result;
    }

    private ObjectNode sanitizeMedia(JsonNode value, ObjectNode fallback) {
        ObjectNode source = ContentJson.object(value);
        JsonNode src = firstNonNull(source, "src", "image", "url");
        ObjectNode result = mapper.createObjectNode();
        result.put("src", safeImage(src, ContentJson.text(fallback.get("src"), 600)));
        result.put("alt", textOr(source.get("alt"), fallback.get("alt"), 160));
        result.set("presentation", MediaPresentation.normalize(
            mapper, source.get("presentation"), false, ""
        ));
        return result;
    }

    private ObjectNode sanitizeButton(JsonNode value, ObjectNode fallback, int labelLength) {
        ObjectNode source = ContentJson.object(value);
        String url = ContentJson.url(firstNonNull(source, "url", "href"));
        if (url.isEmpty()) url = ContentJson.text(fallback.get("url"), 600);
        ObjectNode result = mapper.createObjectNode();
        result.put("label", textOr(source.get("label"), fallback.get("label"), labelLength));
        result.put("url", url);
        result.put("external", isExternal(url));
        return result;
    }

    private static ArrayNode records(JsonNode value) {
        ArrayNode result = JsonNodeFactory.instance.arrayNode();
        for (JsonNode item : ContentJson.array(value)) if (item.isObject()) result.add(item);
        return result;
    }

    private static JsonNode firstNonNull(ObjectNode value, String... fields) {
        for (String field : fields) {
            JsonNode candidate = value.get(field);
            if (candidate != null && !candidate.isNull()) return candidate;
        }
        return null;
    }

    private static boolean required(ObjectNode value, String... fields) {
        for (String field : fields) {
            if (ContentJson.text(value.get(field), 2000).isEmpty()) return false;
        }
        return true;
    }

    private static String colorOr(JsonNode value, JsonNode fallback) {
        String result = ContentJson.hex(value);
        return result.isEmpty() ? ContentJson.hex(fallback) : result;
    }

    private static String textOr(JsonNode value, JsonNode fallback, int maxLength) {
        return textOr(value, fallback, maxLength, "");
    }

    private static String textOr(
        JsonNode value,
        JsonNode fallback,
        int maxLength,
        String finalFallback
    ) {
        String result = ContentJson.text(value, maxLength);
        if (!result.isEmpty()) return result;
        result = ContentJson.text(fallback, maxLength);
        return result.isEmpty() ? finalFallback : result;
    }

    private static boolean isExternal(String url) {
        return url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("tel:");
    }

    public ArrayNode sortByOrder(JsonNode value) {
        ArrayNode result = mapper.createArrayNode();
        ContentJson.array(value).valueStream()
            .filter(JsonNode::isObject)
            .sorted(Comparator.comparingLong(item -> ContentJson.order(item.get("order"), 0)))
            .forEach(item -> result.add(item.deepCopy()));
        return result;
    }

    private void normalizeOrders(ArrayNode value) {
        for (int index = 0; index < value.size(); index++) {
            if (value.get(index).isObject()) ((ObjectNode) value.get(index)).put("order", index + 1);
        }
    }

    private static boolean hasOrderedItems(ArrayNode value) {
        for (JsonNode item : value) {
            if (item.isObject() && item.has("order")) return true;
        }
        return false;
    }

    private static JsonNode alias(ObjectNode source, String key, String path) {
        if (key.equals("url") && source.has("href")) return source.get("href");
        if (key.equals("src")) {
            if (source.has("image") && source.get("image").isValueNode()) return source.get("image");
            if (source.has("imageSrc")) return source.get("imageSrc");
            if (source.has("url") && source.get("url").isValueNode()) return source.get("url");
        }
        if (key.equals("type") && path.contains("careersPage.jobs[]") && source.has("contractType")) {
            return source.get("contractType");
        }
        if (key.equals("description") && path.contains("blocks[]") && source.has("body")) {
            return source.get("body");
        }
        return null;
    }

    private void deriveExternalFlags(ObjectNode node) {
        if (node.has("url") && node.has("external")) {
            String url = ContentJson.text(node.get("url"), 600);
            node.put("external", url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("tel:"));
        }
    }

    private String safeImage(JsonNode current, String fallback) {
        String normalized = mediaValidator.normalize(current);
        if (!normalized.isEmpty() && mediaValidator.isKnownImage(normalized)) return publicAsset(normalized);
        String normalizedFallback = mediaValidator.normalize(StringNode.valueOf(fallback));
        if (!normalizedFallback.isEmpty() && mediaValidator.isKnownImage(normalizedFallback)) {
            return publicAsset(normalizedFallback);
        }
        return fallback;
    }

    String internalImageOrEmpty(JsonNode value) {
        return safeImage(value, "");
    }

    private static String publicAsset(String value) {
        return value.startsWith("/public/") ? value.substring("/public".length()) : value;
    }

    private static boolean isMediaPath(String path, String key) {
        if (!Set.of("src", "image", "imageSrc", "poster", "desktopSrc", "mobileSrc", "photo", "ogImage").contains(key)) {
            return false;
        }
        return !path.contains("button") && !path.contains("url");
    }

    private static int maxLength(String path, String key) {
        if (key.equals("eyebrow")) return 80;
        if (key.equals("question")) return 180;
        if (key.equals("answer")) return 320;
        if (key.equals("createdAt") || key.equals("updatedAt")) return 40;
        if (key.equals("alt")) return 160;
        if (key.equals("location")) return 90;
        if (key.equals("value")) return path.contains("contactPage.info.indicators") ? 40 : 120;
        if (key.equals("label") && path.startsWith("footerLinks")) return 60;
        if (key.equals("label")) return 40;
        if (key.equals("title")) {
            if (path.equals("aboutPage.hero") || path.equals("aboutPage.finalCta")) return 320;
            if (path.equals("aboutPage.compliance")) return 220;
            if (path.contains("certifications[]")) return 180;
            if (path.contains("contactPage") || path.contains("careersPage.jobs[]")) return 90;
            if (path.contains("quotePage.directChannels")) return 220;
            if (path.equals("quotePage.unservedOrigin") || path.contains("operationGuidance")) return 120;
            if (path.startsWith("footerLinks.footer")) return 80;
            if (path.equals("footerLinks.terms.summary")
                || path.equals("footerLinks.terms.finalCta")
                || path.equals("footerLinks.help.finalSupport")
                || path.equals("footerLinks.privacy.finalCta")
                || path.contains("footerLinks.help.quickAccess.actions[]")) return 180;
            if (path.startsWith("footerLinks")) return 220;
            return 320;
        }
        if (key.equals("description")) {
            if (path.equals("aboutPage.hero") || path.equals("aboutPage.finalCta")) return 220;
            if (path.equals("aboutPage.compliance") || path.contains("certifications[]")) return 320;
            if (path.contains("contactPage.mainChannels") || path.contains("contactPage.info.items")
                || path.contains("careersPage.jobs[]") || path.contains("quotePage.directChannels")
                || path.contains("quotePage.otherChannels")) return 220;
            if (path.contains("contactPage.info.indicators")) return 140;
            if (path.contains("operationGuidance") || path.equals("quotePage.unservedOrigin")) return 320;
            if (path.startsWith("footerLinks.footer")) return 260;
            if (path.contains("footerLinks.terms.reading.blocks[]")
                || path.contains("footerLinks.help.quickAccess.actions[]")
                || path.contains("footerLinks.privacy.dataSection.blocks[]")) return 700;
            if (path.contains(".hero")) return 260;
            if (path.contains(".summary")) return 260;
            if (path.contains(".reading") || path.contains(".quickAccess")
                || path.contains(".dataSection") || path.endsWith(".faq")) return 280;
            if (path.contains(".finalCta")) return 320;
            if (path.contains(".finalSupport")) return 260;
            return 700;
        }
        if (key.equals("body")) return 500;
        if (key.equals("certificateText")) return 180;
        if (key.equals("companyTitle") || key.equals("channelGuideTitle")) return 90;
        if (key.equals("address") && path.equals("contactPage.info")) return 220;
        if (key.equals("hours") && path.equals("contactPage.info")) return 160;
        if (key.equals("phone") && path.equals("footerLinks.help.contactCard")) return 80;
        if (key.equals("hours") && path.equals("footerLinks.help.contactCard")) return 180;
        if ((key.equals("channelGuideDescription") || key.equals("documentsDescription")
            || key.equals("quickSupportDescription")) && path.equals("contactPage.info")) return 220;
        if ((key.equals("titleHighlight") || key.equals("titleRest"))
            && path.startsWith("footerLinks")) return 90;
        if (key.equals("copyrightText") && path.equals("footerLinks.footer")) return 160;
        if ((key.equals("locationText") || key.equals("creditText"))
            && path.equals("footerLinks.footer")) return 120;
        if ((key.equals("serviceHoursTitle") || key.equals("socialTitle"))
            && path.equals("footerLinks.footer")) return 80;
        return switch (key) {
            case "id" -> 80;
            case "ctaLabel", "buttonLabel", "type", "icon" -> 60;
            case "state" -> 2;
            case "email", "additionalEmail" -> 160;
            case "url", "href", "ctaUrl", "quoteUrl", "trackingUrl", "contactUrl",
                 "applyUrl", "certificateUrl", "creditUrl", "whatsappUrl", "downloadFile",
                 "src", "poster", "desktopSrc", "mobileSrc", "ogImage" -> 600;
            case "testimonial" -> 800;
            case "metaTags" -> 1000;
            default -> 320;
        };
    }

    private static String fallbackText(JsonNode value, JsonNode fallback, int maxLength, String finalFallback) {
        String clean = ContentJson.text(value, maxLength);
        if (!clean.isEmpty()) return clean;
        clean = ContentJson.text(fallback, maxLength);
        return clean.isEmpty() ? finalFallback : clean;
    }

    public Set<String> validateNavigationIcons() {
        return new HashSet<>(NAVIGATION_ICONS);
    }
}
