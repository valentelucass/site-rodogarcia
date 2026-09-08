export type AppPath = `/${string}`;

export interface NavigationItem {
  href: AppPath;
  label: string;
  key: string;
  exact?: boolean;
}

/** Prefixo visível do CMS. As rotas internas continuam lógicas para o App Router. */
export const CMS_BASE_PATH = "/admin" as const;

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
const fallbackSiteUrl = process.env.NODE_ENV === "development" ? "http://127.0.0.1:35180" : "";

function splitPathAndSuffix(value: string) {
  const suffixIndex = value.search(/[?#]/);
  return suffixIndex < 0
    ? { pathname: value, suffix: "" }
    : { pathname: value.slice(0, suffixIndex), suffix: value.slice(suffixIndex) };
}

/** Remove o prefixo visível do CMS para ACL, navegação e contexto de rota. */
export function normalizeCmsPathname(pathname: string | null | undefined): AppPath {
  const rawPathname = typeof pathname === "string" ? splitPathAndSuffix(pathname.trim()).pathname : "";
  const normalized = rawPathname.startsWith("/") ? rawPathname : `/${rawPathname}`;

  if (normalized === CMS_BASE_PATH || normalized === `${CMS_BASE_PATH}/`) return "/";
  if (normalized.startsWith(`${CMS_BASE_PATH}/`)) return normalized.slice(CMS_BASE_PATH.length) as AppPath;
  return normalized as AppPath;
}

/** Converte uma rota lógica do CMS na URL que deve aparecer no navegador. */
export function cmsHref(pathname: AppPath | string): string {
  const rawPathname = pathname.trim() || "/";
  const { pathname: pathWithoutSuffix, suffix } = splitPathAndSuffix(rawPathname);
  const logicalPath = normalizeCmsPathname(pathWithoutSuffix);
  return `${CMS_BASE_PATH}${logicalPath === "/" ? "" : logicalPath}${suffix}`;
}

/** Resolve uma rota pública no host do site, inclusive ao rodar o CMS diretamente em DEV. */
export function siteUrl(pathname: AppPath | string = "/"): string {
  const value = pathname.trim() || "/";
  if (/^https?:\/\//i.test(value)) return value;

  const pathWithLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  const baseUrl = configuredSiteUrl || fallbackSiteUrl;
  return baseUrl ? `${baseUrl}${pathWithLeadingSlash}` : pathWithLeadingSlash;
}

/** Uploads continuam same-origin no CMS; assets do site usam a URL pública canônica. */
export function resolveCmsMediaUrl(pathname: string | null | undefined): string {
  if (!pathname) return "";
  return pathname.startsWith("/uploads/") ? pathname : siteUrl(pathname);
}

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

export const auth = {
  login: "/auth/entrar",
  changePassword: "/auth/trocar-senha",
  prefix: "/auth/",
} as const;

export const admin = {
  root: "/developer",
  home: "/developer/home",
  services: "/developer/servicos",
  aboutPage: "/developer/sobre",
  businessPage: "/developer/para-empresas",
  contactPage: "/developer/fale-conosco",
  careersPage: "/developer/trabalhe-conosco",
  quotePage: "/developer/cotacao",
  collectionsPage: "/developer/coletas",
  improvements: "/developer/melhorias",
  headerNavigation: "/developer/navegacao",
  footerLinks: "/developer/footer-links",
  units: "/developer/unidades",
  popup: "/developer/popup-exit",
  users: "/developer/usuarios",
  sectors: "/developer/setores",
  images: "/developer/imagens",
  analytics: "/developer/analytics",
  seo: "/developer/seo",
  tracking: "/developer/rastreamento",
  leads: "/developer/leads",
  cookies: "/developer/lgpd-cookies",
  cookieMonitoring: "/developer/monitoramento-cookies",
  landingPages: "/developer/landing-pages",
  prefix: "/developer/",
} as const;

export const api = {
  auth: {
    login: "/api/auth/login",
    passwordResetRequest: "/api/auth/password-reset-request",
    logout: "/api/auth/logout",
    register: "/api/auth/register",
    session: "/api/auth/session",
    changePassword: "/api/auth/change-password",
    cmsTheme: "/api/auth/cms-theme",
  },
  admin: {
    content: "/api/admin/content",
    siteTexts: "/api/admin/site-texts",
    images: "/api/admin/images",
    imagesSummary: "/api/admin/images?summary=true",
    home: "/api/admin/home",
    homeHero: "/api/admin/home/hero",
    homeSection1: "/api/admin/home/section-1",
    homeSection2: "/api/admin/home/section-2",
    homeSection3: "/api/admin/home/section-3",
    homeCertifications: "/api/admin/home/certifications",
    homeQuickActions: "/api/admin/home/quick-actions",
    footerLinks: "/api/admin/footer-links",
    headerNavigation: "/api/admin/header-navigation",
    footerLinksSection: (key: string) => `/api/admin/footer-links/${key}`,
    homeRegionalPresence: "/api/admin/home/regional-presence",
    homeTrackingCta: "/api/admin/home/tracking-cta",
    homeSocialProof: "/api/admin/home/social-proof",
    servicesPage: "/api/admin/services-page",
    servicesModules: "/api/admin/services-page/modules",
    servicesFinalCta: "/api/admin/services-page/final-cta",
    servicesFaq: "/api/admin/services-page/faq",
    page: (key: string) => `/api/admin/pages/${key}`,
    pageSection: (page: string, section: string) => `/api/admin/pages/${page}/${section}`,
    users: "/api/admin/users",
    accessProfiles: "/api/admin/access-profiles",
    accessProfile: (id: string) => `/api/admin/access-profiles/${id}`,
    replaceImageReference: "/api/admin/images/replace-reference",
    mediaSlots: "/api/admin/media-slots",
    seoSettings: "/api/admin/seo-settings",
    consentSettings: "/api/admin/consent-settings",
    cookieConsents: "/api/admin/cookie-consents",
    leads: "/api/admin/leads",
    improvements: "/api/admin/improvements",
    trackingEvents: "/api/admin/tracking-events",
    auditLog: "/api/admin/audit-log",
    landings: "/api/admin/landings",
    landing: (id: string) => `/api/admin/landings/${id}`,
    landingPreview: (id: string) => `/api/admin/landings/${id}/preview`,
    duplicateLanding: (id: string) => `/api/admin/landings/${id}/duplicate`,
    archiveLanding: (id: string) => `/api/admin/landings/${id}/archive`,
    scheduleLanding: (id: string) => `/api/admin/landings/${id}/schedule`,
    landingRevisions: (id: string) => `/api/admin/landings/${id}/revisions`,
    rollbackLanding: (id: string, revisionId: string) => `/api/admin/landings/${id}/revisions/${revisionId}/rollback`,
    landingMedia: "/api/admin/landing-media",
    landingMediaItem: (id: string) => `/api/admin/landing-media/${id}`,
    publishLanding: (id: string) => `/api/admin/landings/${id}/publish`,
    unpublishLanding: (id: string) => `/api/admin/landings/${id}/unpublish`,
    entity: (entity: string) => `/api/admin/${entity}`,
    entityItem: (entity: string, id: string) => `/api/admin/${entity}/${id}`,
    reorder: (entity: string) => `/api/admin/${entity}/reorder`,
  },
  analytics: {
    config: "/api/analytics/config",
    stats: "/api/analytics/stats",
  },
  popup: {
    config: "/api/popup-config",
    events: "/api/popup-events",
    leads: "/api/leads",
  },
} as const;

export const external = {
  developerProfile: "https://www.linkedin.com/in/dev-lucasandrade/",
  tracking: "https://rodogarcia.eslcloud.com.br/recipient_tracking",
  whatsappCommercial: "https://wa.me/5511993139536",
  whatsappQuoteFractional: "https://wa.me/5514991053933",
  whatsappQuoteFull: "https://wa.me/5514991053933",
  whatsappQuoteApproval: "https://wa.me/5514991053696",
  commercialEmail: "mailto:gerente.financeiro@rodogarcia.com.br",
  careersEmail: "mailto:rh@rodogarcia.com.br",
  careersEmailWithSubject: "mailto:rh@rodogarcia.com.br?subject=Candidatura%20-%20Trabalhe%20Conosco",
  phoneDisplay: "0800 591 4557",
  phoneHref: "tel:08005914557",
} as const;

export const adminNavigationGroups = [
  { label: "Dashboard", key: "overview", items: [{ href: admin.root, label: "Dashboard", key: "dashboard", exact: true }] },
  { label: "Páginas", key: "pages", items: [
    { href: admin.careersPage, label: "Página Carreiras", key: "careers-page" }, { href: admin.collectionsPage, label: "Página Coletas", key: "collections-page" },
    { href: admin.contactPage, label: "Página Contato", key: "contact-page" }, { href: admin.quotePage, label: "Página Cotação", key: "quote-page" },
    { href: admin.businessPage, label: "Página Empresas", key: "business-page" }, { href: admin.home, label: "Página Inicial", key: "home" },
    { href: admin.improvements, label: "Página Melhoria", key: "improvements" }, { href: admin.services, label: "Página Serviços", key: "services" }, { href: admin.aboutPage, label: "Página Sobre", key: "about-page" },
  ] },
  { label: "Estrutura do site", key: "site-structure", items: [{ href: admin.headerNavigation, label: "Navegação", key: "header-navigation" }, { href: admin.footerLinks, label: "Rodapé", key: "footer-links" }, { href: admin.units, label: "Unidades", key: "units" }] },
  { label: "Ferramentas", key: "tools", items: [{ href: admin.analytics, label: "Analytics", key: "analytics" }, { href: admin.landingPages, label: "Landing Pages", key: "landing-pages" }, { href: admin.images, label: "Imagens", key: "images" }, { href: admin.popup, label: "Popup de saída", key: "popup" }, { href: admin.tracking, label: "Rastreamento", key: "tracking" }, { href: admin.seo, label: "SEO", key: "seo" }] },
  { label: "Registros e privacidade", key: "records-privacy", items: [{ href: admin.cookieMonitoring, label: "Consentimentos", key: "cookie-monitoring" }, { href: admin.leads, label: "Leads", key: "leads" }, { href: admin.cookies, label: "LGPD e cookies", key: "cookies" }] },
  { label: "Administração", key: "administration", items: [{ href: admin.users, label: "Usuários", key: "users" }, { href: admin.sectors, label: "Setores e acessos", key: "access-profiles" }] },
] as const satisfies readonly { label: string; key: string; items: readonly NavigationItem[] }[];

export function getAdminRouteContext(pathname: string) {
  const logicalPathname = normalizeCmsPathname(pathname);
  for (const group of adminNavigationGroups) for (const item of group.items) {
    const isExact = "exact" in item && item.exact === true;
    if ((isExact ? logicalPathname === item.href : logicalPathname.startsWith(item.href))) return { groupLabel: group.label, item };
  }
  return { groupLabel: "Dashboard", item: adminNavigationGroups[0].items[0] };
}
