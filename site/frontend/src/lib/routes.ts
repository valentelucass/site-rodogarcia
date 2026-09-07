import redirectAliasesData from "./redirectAliases.json";

export type AppPath = `/${string}`;

export interface NavigationItem {
  href: AppPath;
  label: string;
  key: string;
}

export interface SitemapEntry {
  path: AppPath;
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: number;
}

export interface RedirectAlias {
  source: AppPath;
  destination: string;
  permanent: boolean;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
  "https://site.rodogarcia.com.br";
const SITE_NAME = "Rodogarcia Transportes";

export const site = {
  home: "/",
  services: "/servicos",
  about: "/sobre",
  business: "/para-empresas",
  quote: "/cotacao",
  collections: "/coletas",
  improvements: "/melhoria-continua",
  contact: "/fale-conosco",
  help: "/central-ajuda",
  press: "/imprensa",
  careers: "/trabalhe-conosco",
  terms: "/termos-de-uso",
  privacy: "/privacidade",
  voice: "/sua-voz",
} as const satisfies Record<string, AppPath>;

/** URLs públicas do processo CMS, atendidas pelo gateway do site em /admin. */
export const cms = {
  base: "/admin",
  login: "/admin/auth/entrar",
  root: "/admin/developer",
} as const;

export const api = {
  analytics: {
    publicConfig: "/api/analytics/public-config",
    event: "/api/analytics/event",
  },
  popup: {
    config: "/api/popup-config",
    events: "/api/popup-events",
    leads: "/api/leads",
  },
  forms: {
    improvements: "/api/improvements",
  },
  eslTransport: {
    quoteFractional: "/api/quote/fractional",
    quoteClosedWhatsapp: "/api/quote/closed/whatsapp",
    collectionInvoiceValidation: "/api/collections/invoice-validation",
    collections: "/api/collections",
  },
  public: {
    content: "/api/public/content",
    seo: "/api/public/seo",
    mediaSlots: "/api/public/media-slots",
    postalCode: (postalCode: string) => `/api/public/postal-code/${postalCode}`,
    company: (cnpj: string) => `/api/public/company/${cnpj}`,
  },
  consent: {
    settings: "/api/consent-settings",
    events: "/api/consent-events",
  },
  tracking: {
    event: "/api/tracking/event",
  },
} as const;

export const external = {
  developerProfile: "https://www.linkedin.com/in/dev-lucasandrade/",
  tracking: "https://rodogarcia.eslcloud.com.br/recipient_tracking",
  whatsappCommercial: "https://wa.me/5511993139536",
  whatsappQuoteFractional: "https://wa.me/5514991053933",
  whatsappQuoteFull: "https://wa.me/5514991053933",
  whatsappQuoteApproval: "https://wa.me/5514991053696",
  commercialEmailAddress: "gerente.financeiro@rodogarcia.com.br",
  commercialEmail: "mailto:gerente.financeiro@rodogarcia.com.br",
  careersEmailAddress: "rh@rodogarcia.com.br",
  careersEmail: "mailto:rh@rodogarcia.com.br",
  careersEmailWithSubject:
    "mailto:rh@rodogarcia.com.br?subject=Candidatura%20-%20Trabalhe%20Conosco",
  phoneDisplay: "0800 591 4557",
  phoneHref: "tel:08005914557",
  brazilFlag: "https://flagcdn.com/w20/br.png",
} as const;

export const seo = {
  baseUrl: BASE_URL,
  siteName: SITE_NAME,
  defaultOgImage: "/capilaridade-rodogarcia.d6d0bb115823.webp",
  sitemapPath: "/sitemap.xml",
  disallow: ["/admin", "/developer/", "/auth/", "/api/"] as const,
  absoluteUrl(path: string) {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    return `${BASE_URL}${path}`;
  },
} as const;

export const headerNavigation = [
  { href: site.home, label: "Início", key: "home" },
  { href: site.services, label: "Serviços", key: "services" },
  { href: site.about, label: "Sobre", key: "about" },
  { href: site.business, label: "Empresas", key: "business" },
  { href: site.contact, label: "Contato", key: "contact" },
  { href: site.voice, label: "Sua Voz", key: "voice" },
] as const satisfies readonly NavigationItem[];

export const drawerNavigation = [
  { href: site.careers, label: "Carreiras", key: "careers" },
  { href: site.collections, label: "Coletas", key: "collections" },
  { href: site.contact, label: "Contato", key: "contact" },
  { href: site.quote, label: "Cotação", key: "quote" },
  { href: site.business, label: "Empresas", key: "business" },
  { href: site.improvements, label: "Melhoria contínua", key: "improvements" },
  { href: site.services, label: "Serviços", key: "services" },
  { href: site.about, label: "Sobre", key: "about" },
  { href: site.voice, label: "Sua Voz", key: "voice" },
  { href: site.home, label: "Início", key: "home" },
] as const satisfies readonly NavigationItem[];

export const sitemapRoutes = [
  { path: site.home, changeFrequency: "weekly", priority: 1.0 },
  { path: site.services, changeFrequency: "monthly", priority: 0.9 },
  { path: site.about, changeFrequency: "monthly", priority: 0.8 },
  { path: site.business, changeFrequency: "monthly", priority: 0.8 },
  { path: site.quote, changeFrequency: "monthly", priority: 0.9 },
  { path: site.collections, changeFrequency: "monthly", priority: 0.8 },
  { path: site.improvements, changeFrequency: "monthly", priority: 0.5 },
  { path: site.contact, changeFrequency: "monthly", priority: 0.7 },
  { path: site.help, changeFrequency: "monthly", priority: 0.6 },
  { path: site.press, changeFrequency: "monthly", priority: 0.5 },
  { path: site.careers, changeFrequency: "weekly", priority: 0.7 },
  { path: site.terms, changeFrequency: "yearly", priority: 0.3 },
  { path: site.privacy, changeFrequency: "yearly", priority: 0.3 },
  { path: site.voice, changeFrequency: "yearly", priority: 0.4 },
] as const satisfies readonly SitemapEntry[];

/**
 * Fonte única dos redirects consumida pelo runtime Next e por qualquer leitor
 * de rotas do site. O arquivo JSON permite que o next.config.js o carregue sem
 * duplicar o contrato em JavaScript e TypeScript.
 */
export const redirectAliases = redirectAliasesData as readonly RedirectAlias[];
