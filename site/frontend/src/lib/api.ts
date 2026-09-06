import { cache } from "react";
import type { ApiResponse } from "@/types/api";
import { api } from "@/lib/routes";
import type {
  AboutPageContent,
  BusinessPageContent,
  CareersPageContent,
  CollectionsPageContent,
  ContactPageContent,
  FooterLinksContent,
  HeaderNavigationContent,
  HomePageContent,
  ImprovementsPageContent,
  OperationalUnit,
  QuotePageContent,
  ServicesPageContent,
} from "@/types/content";

const normalizeBackendUrl = (url: string) => url.replace(/\/+$/, "");

const firstConfiguredBackendUrl = (
  fallback: string,
  ...values: Array<string | undefined>
): string => values.find((value) => value?.trim())?.trim() ?? fallback;

const API_BASE_URL = normalizeBackendUrl(
  firstConfiguredBackendUrl(
    process.env.NODE_ENV === "production"
      ? "http://127.0.0.1:6050"
      : "http://127.0.0.1:31012",
    process.env.BACKEND_PROXY_URL,
    process.env.NEXT_PUBLIC_BACKEND_PROXY_URL,
    process.env.BACKEND_INTERNAL_URL,
    process.env.NEXT_PUBLIC_BACKEND_URL
  )
);

const CMS_API_BASE_URL = normalizeBackendUrl(
  firstConfiguredBackendUrl(
    process.env.NODE_ENV === "production"
      ? "http://127.0.0.1:6051"
      : "http://127.0.0.1:31013",
    process.env.CMS_BACKEND_INTERNAL_URL,
    process.env.CMS_BACKEND_PROXY_URL
  )
);

function apiBaseUrlFor(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];

  if (
    pathname === api.public.content ||
    pathname === api.public.seo ||
    pathname === api.public.mediaSlots
  ) {
    return CMS_API_BASE_URL;
  }

  return API_BASE_URL;
}

export interface PublicContentResponse {
  homePage: HomePageContent;
  servicesPage: ServicesPageContent;
  aboutPage: AboutPageContent;
  businessPage: BusinessPageContent;
  contactPage: ContactPageContent;
  careersPage: CareersPageContent;
  quotePage: QuotePageContent;
  collectionsPage: CollectionsPageContent;
  improvementsPage: ImprovementsPageContent;
  footerLinks: FooterLinksContent;
  headerNavigation: HeaderNavigationContent;
  units: OperationalUnit[];
  siteTexts: Record<string, string>;
}

/**
 * Fetch tipado para uso em Server Components (não inclui CSRF token).
 * Usa Next.js fetch com cache tag para ISR.
 */
export async function serverFetch<T>(
  path: string,
  options?: RequestInit & { tags?: string[] }
): Promise<ApiResponse<T>> {
  const url = `${apiBaseUrlFor(path)}${path}`;

  try {
    const res = await fetch(url, {
      ...options,
      next: options?.tags ? { tags: options.tags } : undefined,
    });

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      return {
        success: false,
        error: errorBody.error ?? `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as T;
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro de rede.",
    };
  }
}

/**
 * Lê o conteúdo público da API.
 * Chamado por Server Components e deduplicado no mesmo render, mesmo com
 * `no-store`, para que página, header e rodapé não repitam a leitura pública.
 */
export const fetchPublicContent = cache(async function fetchPublicContent() {
  return serverFetch<PublicContentResponse>(api.public.content, {
    tags: ["public-content"],
    cache: "no-store",
  });
});
