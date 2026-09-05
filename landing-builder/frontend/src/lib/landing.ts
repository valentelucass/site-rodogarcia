import "server-only";

export interface LandingTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  font: "system" | "space-grotesk" | "plus-jakarta";
}

export interface LandingSeo { title: string; description: string; index: boolean; }
export interface LandingMediaDescriptor { kind: "image" | "video"; alt: string; poster: string; }
export interface LandingMediaPlacement { focalPoint: { x: number; y: number }; playback?: { startSeconds: number; durationSeconds?: number }; }
export interface LandingMediaPresentation { desktop: LandingMediaPlacement; mobile?: LandingMediaPlacement; }

export interface PublicLandingPage {
  template: "campaign-v1";
  name: string;
  slug: string;
  seo: LandingSeo;
  theme: LandingTheme;
  analytics: { ga4MeasurementId: string };
  media: Record<string, LandingMediaDescriptor>;
  hero: {
    phone: string; email: string; logo: string; backgroundImage: string; eyebrow: string; title: string;
    description: string; ctaLabel: string; ctaUrl: string; highlights: Array<{ title: string; description: string }>; backgroundPresentation: LandingMediaPresentation;
  };
  lowerSection: { visible: boolean; title: string; description: string; formTitle: string; formDescription: string; submitLabel: string; mapBaseColor: string; mapBranchColor: string; mapBorderColor: string; ctaLabel: string; ctaUrl: string };
  benefits: { visible: boolean; eyebrow: string; title: string; description: string; items: Array<{ title: string; description: string }> };
  story: { visible: boolean; eyebrow: string; title: string; description: string; image: string; imagePresentation: LandingMediaPresentation; items: Array<{ title: string; description: string }>; ctaLabel: string; ctaUrl: string };
  metrics: { visible: boolean; eyebrow: string; title: string; items: Array<{ value: string; label: string; description: string }> };
  showcase: { visible: boolean; eyebrow: string; title: string; description: string; backgroundImage: string; backgroundPresentation: LandingMediaPresentation; ctaLabel: string; ctaUrl: string; items: Array<{ title: string; description: string }> };
  testimonial: { visible: boolean; eyebrow: string; title: string; description: string; items: Array<{ name: string; detail: string; quote: string; rating: number }> };
  faq: { visible: boolean; eyebrow: string; title: string; items: Array<{ question: string; answer: string }> };
  finalCta: { visible: boolean; eyebrow: string; title: string; description: string; backgroundImage: string; backgroundPresentation: LandingMediaPresentation; ctaLabel: string; ctaUrl: string };
  footer: { brand: string; description: string; phone: string; email: string; legalText: string };
}

export interface PublishedLandingIndexItem { slug: string; updatedAt: string; }

const FALLBACK_SITE_URL = "http://127.0.0.1:35180";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexColorPattern = /^#[0-9a-f]{6}$/i;
const ga4MeasurementIdPattern = /^G-[A-Z0-9]{4,}$/i;
const internalMediaPattern = /^\/landing-media(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function string(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function visible(value: unknown) { return value !== false; }

function normalizeSlug(value: unknown) {
  const slug = string(value, 80).toLowerCase();
  return slugPattern.test(slug) ? slug : "";
}

function normalizeColor(value: unknown, fallback: string) {
  const color = string(value, 7);
  return hexColorPattern.test(color) ? color : fallback;
}

function normalizeMediaUrl(value: unknown) {
  const url = string(value, 300);
  return internalMediaPattern.test(url) ? url : "";
}

const centeredPresentation: LandingMediaPresentation = { desktop: { focalPoint: { x: 50, y: 50 } } };

function normalizePresentation(value: unknown): LandingMediaPresentation {
  const input = record(value);
  const normalizePlacement = (candidate: unknown): LandingMediaPlacement | null => {
    const placement = record(candidate);
    const focal = record(placement?.focalPoint);
    const x = typeof focal?.x === "number" && Number.isFinite(focal.x) && focal.x >= 0 && focal.x <= 100 ? focal.x : null;
    const y = typeof focal?.y === "number" && Number.isFinite(focal.y) && focal.y >= 0 && focal.y <= 100 ? focal.y : null;
    if (x == null || y == null) return null;
    const playbackInput = record(placement?.playback);
    const startSeconds = typeof playbackInput?.startSeconds === "number" && Number.isFinite(playbackInput.startSeconds) && playbackInput.startSeconds >= 0 && playbackInput.startSeconds <= 86_400 ? playbackInput.startSeconds : null;
    const durationSeconds = typeof playbackInput?.durationSeconds === "number" && Number.isFinite(playbackInput.durationSeconds) && playbackInput.durationSeconds >= .1 && playbackInput.durationSeconds <= 86_400 ? playbackInput.durationSeconds : null;
    return { focalPoint: { x, y }, ...(startSeconds == null ? {} : { playback: { startSeconds, ...(durationSeconds == null ? {} : { durationSeconds }) } }) };
  };
  const desktop = normalizePlacement(input?.desktop);
  const mobile = normalizePlacement(input?.mobile);
  return { desktop: desktop ?? centeredPresentation.desktop, ...(mobile ? { mobile } : {}) };
}

function normalizeMediaDescriptors(value: unknown): Record<string, LandingMediaDescriptor> {
  const input = record(value) ?? {};
  const result: Record<string, LandingMediaDescriptor> = {};
  for (const [url, rawDescriptor] of Object.entries(input)) {
    const normalizedUrl = normalizeMediaUrl(url);
    const descriptor = record(rawDescriptor);
    if (!normalizedUrl || !descriptor) continue;
    const kind = descriptor.kind === "video" ? "video" : descriptor.kind === "image" ? "image" : null;
    if (!kind) continue;
    result[normalizedUrl] = {
      kind,
      alt: string(descriptor.alt, 160),
      poster: normalizeMediaUrl(descriptor.poster),
    };
  }
  return result;
}

function normalizeActionUrl(value: unknown) {
  const url = string(value, 400);
  if (!url) return "";
  if (/^\/(?!\/)[^\s\\]*$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    return ["https:", "mailto:", "tel:"].includes(parsed.protocol) ? url : "";
  } catch {
    return "";
  }
}

function normalizeHighlights(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).flatMap((item) => {
    const itemRecord = record(item);
    if (!itemRecord) return [];
    const title = string(itemRecord.title, 80);
    const description = string(itemRecord.description, 220);
    return title || description ? [{ title, description }] : [];
  });
}

function normalizeBenefits(value: unknown): PublicLandingPage["benefits"] {
  const input = record(value) ?? {};
  const items = Array.isArray(input.items) ? input.items.slice(0, 6).flatMap((item) => {
    const entry = record(item);
    const title = string(entry?.title, 80);
    const description = string(entry?.description, 220);
    return title || description ? [{ title, description }] : [];
  }) : [];
  return { visible: visible(input.visible), eyebrow: string(input.eyebrow, 80), title: string(input.title, 180), description: string(input.description, 700), items };
}

function normalizeFeatureItems(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).flatMap((item) => {
    const entry = record(item);
    const title = string(entry?.title, 100);
    const description = string(entry?.description, 320);
    return title || description ? [{ title, description }] : [];
  });
}

function normalizeMetrics(value: unknown): PublicLandingPage["metrics"] {
  const input = record(value) ?? {};
  const items = Array.isArray(input.items) ? input.items.slice(0, 4).flatMap((item) => {
    const entry = record(item);
    const metricValue = string(entry?.value, 40);
    const label = string(entry?.label, 120);
    const description = string(entry?.description, 320);
    return metricValue || label || description ? [{ value: metricValue, label, description }] : [];
  }) : [];
  return { visible: visible(input.visible), eyebrow: string(input.eyebrow, 80), title: string(input.title, 180), items };
}

function normalizeFeedbacks(value: unknown): PublicLandingPage["testimonial"] {
  const input = record(value) ?? {};
  const items = Array.isArray(input.items) ? input.items.slice(0, 6).flatMap((item) => {
    const entry = record(item);
    const name = string(entry?.name, 100);
    const detail = string(entry?.detail, 120);
    const quote = string(entry?.quote, 900);
    const rating = typeof entry?.rating === "number" && Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5 ? entry.rating : 5;
    return name || detail || quote ? [{ name, detail, quote, rating }] : [];
  }) : [];
  if (items.length) return { visible: visible(input.visible), eyebrow: string(input.eyebrow, 80), title: string(input.title, 180), description: string(input.description, 900), items };
  const quote = string(input.quote, 900);
  const name = string(input.author, 100);
  const detail = string(input.role, 120);
  return { visible: visible(input.visible), eyebrow: string(input.eyebrow, 80), title: string(input.title, 180), description: string(input.description, 900), items: quote || name || detail ? [{ name, detail, quote, rating: 5 }] : [] };
}

function normalizeFaq(value: unknown): PublicLandingPage["faq"] {
  const input = record(value) ?? {};
  const items = Array.isArray(input.items) ? input.items.slice(0, 8).flatMap((item) => {
    const entry = record(item);
    const question = string(entry?.question, 180);
    const answer = string(entry?.answer, 900);
    return question || answer ? [{ question, answer }] : [];
  }) : [];
  return { visible: visible(input.visible), eyebrow: string(input.eyebrow, 80), title: string(input.title, 180), items };
}

function normalizeLanding(value: unknown): PublicLandingPage | null {
  const input = record(value);
  if (!input) return null;
  const name = string(input.name, 120);
  const slug = normalizeSlug(input.slug);
  const hero = record(input.hero);
  const lowerSection = record(input.lowerSection);
  if (!name || !slug || !hero || !lowerSection) return null;

  const heroTitle = string(hero.title, 180);
  const lowerTitle = string(lowerSection.title, 180);
  if (!heroTitle || !lowerTitle) return null;

  const themeInput = record(input.theme) ?? {};
  const analyticsInput = record(input.analytics) ?? {};
  const seoInput = record(input.seo) ?? {};
  const story = record(input.story) ?? {};
  const showcase = record(input.showcase) ?? {};
  const testimonial = record(input.testimonial) ?? {};
  const finalCta = record(input.finalCta) ?? {};
  const footer = record(input.footer) ?? {};
  const measurementId = string(analyticsInput.ga4MeasurementId, 80);

  return {
    template: "campaign-v1",
    name,
    slug,
    seo: { title: string(seoInput.title, 180) || heroTitle, description: string(seoInput.description, 320) || string(hero.description, 700), index: seoInput.index !== false },
    theme: {
      primaryColor: normalizeColor(themeInput.primaryColor, "#111111"), secondaryColor: normalizeColor(themeInput.secondaryColor, "#111111"),
      backgroundColor: normalizeColor(themeInput.backgroundColor, "#ffffff"), textColor: normalizeColor(themeInput.textColor, "#111111"),
      font: themeInput.font === "space-grotesk" || themeInput.font === "plus-jakarta" ? themeInput.font : "system",
    },
    analytics: { ga4MeasurementId: ga4MeasurementIdPattern.test(measurementId) ? measurementId : "" },
    media: normalizeMediaDescriptors(input.media),
    hero: {
      phone: string(hero.phone, 40), email: string(hero.email, 160), logo: normalizeMediaUrl(hero.logo), backgroundImage: normalizeMediaUrl(hero.backgroundImage),
      eyebrow: string(hero.eyebrow, 80), title: heroTitle, description: string(hero.description, 700), ctaLabel: string(hero.ctaLabel, 70), ctaUrl: normalizeActionUrl(hero.ctaUrl), highlights: normalizeHighlights(hero.highlights), backgroundPresentation: normalizePresentation(hero.backgroundPresentation),
    },
    lowerSection: {
      visible: visible(lowerSection.visible),
      title: lowerTitle,
      description: string(lowerSection.description, 900),
      formTitle: string(lowerSection.formTitle, 180),
      formDescription: string(lowerSection.formDescription, 400),
      submitLabel: string(lowerSection.submitLabel, 70),
      mapBaseColor: normalizeColor(lowerSection.mapBaseColor, "#A9D4EF"),
      mapBranchColor: normalizeColor(lowerSection.mapBranchColor, "#2E2882"),
      mapBorderColor: normalizeColor(lowerSection.mapBorderColor, "#FFFFFF"),
      ctaLabel: string(lowerSection.ctaLabel, 70),
      ctaUrl: normalizeActionUrl(lowerSection.ctaUrl),
    },
    benefits: normalizeBenefits(input.benefits),
    story: { visible: visible(story.visible), eyebrow: string(story.eyebrow, 80), title: string(story.title, 180), description: string(story.description, 900), image: normalizeMediaUrl(story.image), imagePresentation: normalizePresentation(story.imagePresentation), items: normalizeFeatureItems(story.items, 4), ctaLabel: string(story.ctaLabel, 70), ctaUrl: normalizeActionUrl(story.ctaUrl) },
    metrics: normalizeMetrics(input.metrics),
    showcase: { visible: visible(showcase.visible), eyebrow: string(showcase.eyebrow, 80), title: string(showcase.title, 180), description: string(showcase.description, 700), backgroundImage: normalizeMediaUrl(showcase.backgroundImage), backgroundPresentation: normalizePresentation(showcase.backgroundPresentation), ctaLabel: string(showcase.ctaLabel, 70), ctaUrl: normalizeActionUrl(showcase.ctaUrl), items: normalizeFeatureItems(showcase.items, 3) },
    testimonial: normalizeFeedbacks(testimonial),
    faq: normalizeFaq(input.faq),
    finalCta: { visible: visible(finalCta.visible), eyebrow: string(finalCta.eyebrow, 80), title: string(finalCta.title, 180), description: string(finalCta.description, 700), backgroundImage: normalizeMediaUrl(finalCta.backgroundImage), backgroundPresentation: normalizePresentation(finalCta.backgroundPresentation), ctaLabel: string(finalCta.ctaLabel, 70), ctaUrl: normalizeActionUrl(finalCta.ctaUrl) },
    footer: { brand: string(footer.brand, 120) || name, description: string(footer.description, 400), phone: string(footer.phone, 40), email: string(footer.email, 160), legalText: string(footer.legalText, 240) || "Todos os direitos reservados." },
  };
}

function backendUrl() { return (process.env.LANDING_BUILDER_BACKEND_URL ?? "http://127.0.0.1:36110").replace(/\/+$/, ""); }

async function fetchPayload(path: string) {
  try {
    const response = await fetch(`${backendUrl()}${path}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export async function fetchLanding(slug: string): Promise<PublicLandingPage | null> {
  const payload = await fetchPayload(`/api/public/landings/${encodeURIComponent(slug)}`);
  return normalizeLanding(record(payload)?.landing);
}

export async function fetchPreviewLanding(token: string): Promise<PublicLandingPage | null> {
  const normalizedToken = string(token, 200);
  if (!normalizedToken) return null;
  const payload = await fetchPayload(`/api/public/previews/${encodeURIComponent(normalizedToken)}`);
  return normalizeLanding(record(payload)?.landing);
}

export async function fetchPublishedLandingIndex(): Promise<PublishedLandingIndexItem[]> {
  const payload = record(await fetchPayload("/api/public/landings"));
  const values = payload?.landings;
  if (!Array.isArray(values)) return [];
  return values.flatMap((item) => {
    const indexItem = record(item);
    const slug = normalizeSlug(indexItem?.slug);
    const updatedAt = string(indexItem?.updatedAt, 40);
    const date = new Date(updatedAt);
    return slug && !Number.isNaN(date.getTime()) ? [{ slug, updatedAt: date.toISOString() }] : [];
  });
}

export function builderSiteUrl() {
  const configured = (process.env.LANDING_BUILDER_SITE_URL ?? FALLBACK_SITE_URL).trim();
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid protocol");
    return new URL(url.origin);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export function landingUrl(slug: string) { return new URL(`/${slug}`, builderSiteUrl()); }
