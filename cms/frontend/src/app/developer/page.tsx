"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  ChartBar,
  CursorClick,
  ImagesSquare,
  Pulse,
  Sparkle,
} from "@phosphor-icons/react";
import { adminResourceKeys, useAdminResource } from "@/hooks/useAdminResource";
import { useCarouselPagination } from "@/hooks/useCarouselPagination";
import {
  adminNavigationGroups,
  api,
  type AppPath,
} from "@/lib/routes";
import { permissionForAdminPath } from "@/lib/cmsAccess";
import { useSession } from "@/hooks/useSession";
import type { ApiRequestResult } from "@/hooks/useApiRequest";
import {
  DeveloperCard,
  DeveloperHelp,
  DeveloperHero,
  DeveloperCarouselPagination,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  developerSecondaryButtonClassName,
} from "@/components/developer/ui";

interface ContentSummary {
  homePage?: {
    hero?: { slides?: Array<{ active?: boolean }> };
    section1?: { items?: Array<unknown> };
    section2?: { items?: Array<{ active?: boolean }> };
    section3?: { cards?: Array<unknown> };
    regionalPresence?: { units?: Array<{ active?: boolean }> };
    socialProof?: { feedbacks?: Array<{ active?: boolean }> };
    quickActions?: Array<{ enabled?: boolean }>;
  };
  careersPage?: {
    jobs?: Array<{ active?: boolean }>;
  };
  aboutPage?: {
    hero?: { title?: string; description?: string; media?: { src?: string } };
    compliance?: {
      image?: { src?: string };
      title?: string;
      description?: string;
      certificateText?: string;
    };
    finalCta?: {
      title?: string;
      description?: string;
      buttons?: Array<{ label?: string; url?: string }>;
    };
  };
  contactPage?: {
    heroWhatsappButton?: { label?: string; url?: string };
    mainChannels?: Array<unknown>;
    info?: {
      companyTitle?: string;
      address?: string;
      hours?: string;
      channelGuideTitle?: string;
      channelGuideDescription?: string;
      documentsDescription?: string;
      quickSupportDescription?: string;
      indicators?: Array<unknown>;
    };
    finalCta?: { buttons?: Array<unknown> };
  };
  footerLinks?: {
    footer?: {
      description?: string;
      proposalButton?: { label?: string; url?: string };
      supportButton?: { label?: string; url?: string };
      columns?: Array<unknown>;
      bottomLinks?: Array<unknown>;
      copyrightText?: string;
      locationText?: string;
    };
  };
  units: Array<{ active?: boolean; ativo?: boolean }>;
}

interface DashboardAnalytics {
  totalPageViews: number;
  uniqueSessions: number;
  topPages: Array<{ page: string; views: number }>;
}

interface DashboardPopup {
  analytics?: {
    totals: Record<string, number>;
    conversionRate: number;
    topPages: Array<{ pagePath: string; total: number }>;
  };
}

interface DashboardLeads {
  leads: Array<{ createdAt?: string }>;
}

interface DashboardImages {
  images: Array<{ source: string; usedInContent: boolean }>;
}

interface OptionalDashboardData<T> {
  available: boolean;
  data: T;
}

interface DashboardData {
  content: ContentSummary;
  analytics: OptionalDashboardData<DashboardAnalytics>;
  popup: OptionalDashboardData<DashboardPopup>;
  leads: OptionalDashboardData<DashboardLeads>;
  images: OptionalDashboardData<DashboardImages>;
}

const EMPTY_CONTENT: ContentSummary = {
  homePage: {
    hero: { slides: [] },
    section1: { items: [] },
    section2: { items: [] },
    section3: { cards: [] },
    regionalPresence: { units: [] },
    socialProof: { feedbacks: [] },
    quickActions: [],
  },
  careersPage: { jobs: [] },
  footerLinks: { footer: { columns: [], bottomLinks: [] } },
  units: [],
};

const EMPTY_ANALYTICS: DashboardAnalytics = {
  totalPageViews: 0,
  uniqueSessions: 0,
  topPages: [],
};

const EMPTY_POPUP: DashboardPopup = {};
const EMPTY_LEADS: DashboardLeads = { leads: [] };
const EMPTY_IMAGES: DashboardImages = { images: [] };

function optionalDashboardData<T>(
  response: ApiRequestResult<T>,
  fallback: T
): OptionalDashboardData<T> | null {
  if (!response.success && response.status !== 403) return null;

  return {
    available: response.success,
    data: response.success ? response.data ?? fallback : fallback,
  };
}

function unavailableMetricHelper(label: string) {
  return `${label} não está disponível para o seu perfil.`;
}

function DashboardMetric({
  title,
  value,
  icon: Icon,
  helper,
}: {
  title: string;
  value: string;
  icon: typeof ChartBar;
  helper: string;
}) {
  return (
    <DeveloperCard className="flex min-h-[82px] items-center gap-2.5 p-3 sm:gap-3 sm:p-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] sm:h-9 sm:w-9">
        <Icon size={18} weight="duotone" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[var(--color-muted-raw)]">
            {title}
          </p>
          <DeveloperHelp label={title} kind="metric" />
        </div>
        <p className="mt-0.5 text-xl font-bold leading-none tracking-[-0.045em] text-[var(--foreground)] sm:text-2xl">
          {value}
        </p>
        <p className="mt-1 truncate text-[11px] leading-4 text-[var(--color-muted-raw)]" title={helper}>
          {helper}
        </p>
      </div>
    </DeveloperCard>
  );
}

function CoverageRow({ label, value }: { label: string; value: number | null }) {
  const available = value !== null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--foreground)]">{label}</span>
        <span className="text-xs font-semibold text-[var(--primary)]">{available ? `${value}%` : "—"}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className="h-1.5 rounded-full bg-[linear-gradient(90deg,#1d4ed8_0%,#06b6d4_100%)]"
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function calculateCoverage(filled: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((filled / total) * 100);
}

function countFilled(values: Array<unknown>) {
  return values.filter((value) => Boolean(String(value ?? "").trim())).length;
}

export default function DeveloperDashboardPage() {
  const [passwordChanged, setPasswordChanged] = useState(false);
  const { session } = useSession();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("passwordChanged") !== "1") return;
    setPasswordChanged(true);
    url.searchParams.delete("passwordChanged");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const { data, loading, error } = useAdminResource<DashboardData>({
    key: adminResourceKeys.dashboard,
    fetcher: async (apiRequest) => {
      const [contentRes, analyticsRes, popupRes, leadsRes, imagesRes] =
        await Promise.all([
          apiRequest<{ content: ContentSummary }>(api.admin.content),
          apiRequest<DashboardAnalytics>(`${api.analytics.stats}?days=30`),
          apiRequest<DashboardPopup>(`${api.popup.events}?days=30`),
          apiRequest<DashboardLeads>(`${api.admin.leads}?limit=200`),
          apiRequest<DashboardImages>(api.admin.images),
        ]);

      if (!contentRes.success) {
        return {
          success: false,
          error: contentRes.error ?? "Falha ao carregar o dashboard.",
        };
      }

      const analytics = optionalDashboardData(analyticsRes, EMPTY_ANALYTICS);
      const popup = optionalDashboardData(popupRes, EMPTY_POPUP);
      const leads = optionalDashboardData(leadsRes, EMPTY_LEADS);
      const images = optionalDashboardData(imagesRes, EMPTY_IMAGES);

      if (!analytics || !popup || !leads || !images) {
        return {
          success: false,
          error: "Não foi possível carregar um indicador complementar do painel. Tente novamente.",
        };
      }

      return {
        success: true,
        data: {
          content: contentRes.data?.content ?? EMPTY_CONTENT,
          analytics,
          popup,
          leads,
          images,
        },
      };
    },
  });

  const summary = useMemo(() => {
    if (!data) return null;

    const analytics = data.analytics.data;
    const popup = data.popup.data;
    const images = data.images.data;
    const homePage = data.content.homePage;
    const heroSlides = homePage?.hero?.slides ?? [];
    const section1Items = homePage?.section1?.items ?? [];
    const operationItems = homePage?.section2?.items ?? [];
    const serviceCards = homePage?.section3?.cards ?? [];
    const regionalUnits = homePage?.regionalPresence?.units ?? [];
    const quickActions = homePage?.quickActions ?? [];
    const homeFeedbacks = homePage?.socialProof?.feedbacks ?? [];
    const careersJobs = data.content.careersPage?.jobs ?? [];

    const heroActive = heroSlides.filter((item) => item.active !== false).length;
    const operationsActive = operationItems.filter((item) => item.active !== false).length;
    const jobsActive = careersJobs.filter((item) => item.active !== false).length;
    const feedbacksActive = homeFeedbacks.filter((item) => item.active !== false).length;
    const unitsActive = data.content.units.filter(
      (item) => item.active !== false && item.ativo !== false
    ).length;
    const regionalUnitsActive = regionalUnits.filter((item) => item.active !== false).length;
    const uploadImages = data.images.available
      ? images.images.filter((item) => item.source === "upload").length
      : null;
    const contentImages = data.images.available
      ? images.images.filter((item) => item.usedInContent).length
      : null;
    const editableItems =
      heroSlides.length +
      section1Items.length +
      operationItems.length +
      serviceCards.length +
      quickActions.length +
      careersJobs.length +
      homeFeedbacks.length +
      data.content.units.length;
    const totalActive = heroActive + operationsActive + jobsActive + feedbacksActive + unitsActive;

    const coverageHome = calculateCoverage(
      Number(heroActive > 0) +
        Number(section1Items.length > 0) +
        Number(operationsActive > 0) +
        Number(serviceCards.length > 0) +
        Number(regionalUnitsActive > 0),
      5
    );
    const coverageCareers = calculateCoverage(
      Number(careersJobs.length > 0) +
        Number(jobsActive > 0),
      2
    );
    const coverageFooter = calculateCoverage(
      (() => {
        const footer = data.content.footerLinks?.footer;
        return countFilled([
          footer?.description,
          footer?.proposalButton?.label,
          footer?.proposalButton?.url,
          footer?.supportButton?.label,
          footer?.supportButton?.url,
          footer?.columns?.length,
          footer?.bottomLinks?.length,
          footer?.copyrightText,
          footer?.locationText,
        ]);
      })(),
      9
    );
    const coverageAbout = calculateCoverage(
      (() => {
        const about = data.content.aboutPage;
        return countFilled([
          about?.hero?.title,
          about?.hero?.description,
          about?.hero?.media?.src,
          about?.compliance?.image?.src,
          about?.compliance?.title,
          about?.compliance?.description,
          about?.compliance?.certificateText,
          about?.finalCta?.title,
          about?.finalCta?.description,
          about?.finalCta?.buttons?.length,
        ]);
      })(),
      10
    );
    const coverageContact = calculateCoverage(
      (() => {
        const contact = data.content.contactPage;
        return countFilled([
          contact?.heroWhatsappButton?.label,
          contact?.heroWhatsappButton?.url,
          contact?.mainChannels?.length,
          contact?.info?.companyTitle,
          contact?.info?.address,
          contact?.info?.hours,
          contact?.info?.channelGuideTitle,
          contact?.info?.channelGuideDescription,
          contact?.info?.documentsDescription,
          contact?.info?.quickSupportDescription,
          contact?.info?.indicators?.length,
          contact?.finalCta?.buttons?.length,
        ]);
      })(),
      12
    );
    const coverageContent = data.images.available
      ? calculateCoverage(
        Number(feedbacksActive > 0) + Number(contentImages! > 0) + Number(uploadImages! > 0),
        3
      )
      : null;

    return {
      heroActive,
      operationsActive,
      jobsActive,
      feedbacksActive,
      unitsActive,
      uploadImages,
      contentImages,
      editableItems,
      publicationRate: calculateCoverage(totalActive, editableItems || 1),
      coverageHome,
      coverageCareers,
      coverageFooter,
      coverageAbout,
      coverageContact,
      coverageContent,
      popupTotals: popup.analytics?.totals ?? {},
      popupTopPages: popup.analytics?.topPages ?? [],
      popupConversion: popup.analytics?.conversionRate ?? 0,
    };
  }, [data]);

  const quickLinks = adminNavigationGroups.flatMap((group) =>
    group.items.filter((item) => {
      if (item.key === "dashboard") return false;
      const permission = permissionForAdminPath(item.href);
      return !permission || !session?.user?.cmsPermissions || session.user.cmsPermissions.includes(permission);
    })
  );
  const topPages = (data?.analytics.data.topPages ?? []).slice(0, 8);
  const popupTopPages = summary?.popupTopPages ?? [];
  const {
    pages: popupTopPagesPages,
    currentPage: popupTopPagesPage,
    totalPages: popupTopPagesTotalPages,
    nextPage: nextPopupTopPagesPage,
    prevPage: prevPopupTopPagesPage,
  } = useCarouselPagination(popupTopPages, 6);

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="Painel Rodogarcia"
        title="Visão executiva do CMS."
        description="Visão geral das operações do CMS."
        stats={[
          { label: "Módulos ativos", value: quickLinks.length },
          {
            label: "Últimos 30 dias",
            value: data?.analytics.available ? data.analytics.data.uniqueSessions : "—",
          },
        ]}
      />

      {passwordChanged ? (
        <div className="mt-5">
          <DeveloperMessage tone="success">Senha atualizada com sucesso. Seu acesso ao CMS está liberado.</DeveloperMessage>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <DeveloperMessage tone="info">Carregando dados do painel...</DeveloperMessage>
        </div>
      ) : null}

      {error ? (
        <div className="mt-6">
          <DeveloperMessage tone="error">{error}</DeveloperMessage>
        </div>
      ) : null}

      {data && summary ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardMetric
              title="Itens editáveis"
              value={summary.editableItems.toLocaleString("pt-BR")}
              icon={Sparkle}
              helper="Áreas editáveis do site."
            />
            <DashboardMetric
              title="Page views"
              value={data.analytics.available ? data.analytics.data.totalPageViews.toLocaleString("pt-BR") : "—"}
              icon={ChartBar}
              helper={data.analytics.available ? "Views do período atual." : unavailableMetricHelper("Page views")}
            />
            <DashboardMetric
              title="Conversão do popup"
              value={data.popup.available ? `${summary.popupConversion.toFixed(1)}%` : "—"}
              icon={Pulse}
              helper={data.popup.available ? "Envios por exibição." : unavailableMetricHelper("A conversão do popup")}
            />
            <DashboardMetric
              title="Leads capturados"
              value={data.leads.available ? data.leads.data.leads.length.toLocaleString("pt-BR") : "—"}
              icon={CursorClick}
              helper={data.leads.available ? "Contatos pelo popup." : unavailableMetricHelper("Os leads")}
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <DeveloperCard className="p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
              <DeveloperSectionHeading
                eyebrow="Saúde do conteúdo"
                title="Cobertura por módulo"
                description="Leitura rápida do que já tem dados suficientes para aparecer bem nas páginas do projeto atual."
              />
              <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
                <CoverageRow label="Home" value={summary.coverageHome} />
                <CoverageRow label="Trabalhe Conosco" value={summary.coverageCareers} />
                <CoverageRow label="Footer links" value={summary.coverageFooter} />
                <CoverageRow label="Sobre" value={summary.coverageAbout} />
                <CoverageRow label="Contato" value={summary.coverageContact} />
                <CoverageRow label="Mídia e social proof" value={summary.coverageContent} />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-white/72 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--primary)]">
                      Publicação ativa
                    </p>
                    <p className="text-xl font-bold leading-none tracking-[-0.04em] text-[var(--foreground)]">
                      {summary.publicationRate}%
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--color-muted-raw)]">
                    Hero: {summary.heroActive} • Operações: {summary.operationsActive}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-white/72 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--primary)]">
                      Biblioteca
                    </p>
                    <p className="text-xl font-bold leading-none tracking-[-0.04em] text-[var(--foreground)]">
                      {summary.contentImages ?? "—"}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--color-muted-raw)]">
                    {data.images.available ? `Uploads salvos: ${summary.uploadImages ?? 0}` : unavailableMetricHelper("A biblioteca")}
                  </p>
                </div>
              </div>
            </DeveloperCard>

            <DeveloperCard className="p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
              <DeveloperSectionHeading
                eyebrow="Visão comercial"
                title="Sinais operacionais"
                description="Jobs, depoimentos e popup."
              />

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    label: "Vagas ativas",
                    value: summary.jobsActive.toLocaleString("pt-BR"),
                    icon: Briefcase,
                  },
                  {
                    label: "Feedbacks ativos",
                    value: summary.feedbacksActive.toLocaleString("pt-BR"),
                    icon: Sparkle,
                  },
                  {
                    label: "Unidades ativas",
                    value: summary.unitsActive.toLocaleString("pt-BR"),
                    icon: CursorClick,
                  },
                  {
                    label: "Popup exibido",
                    value: data.popup.available ? String(summary.popupTotals.popup_shown ?? 0) : "—",
                    icon: Pulse,
                  },
                  {
                    label: "Popup enviado",
                    value: data.popup.available ? String(summary.popupTotals.popup_submitted ?? 0) : "—",
                    icon: CursorClick,
                  },
                  {
                    label: "Assets da biblioteca",
                    value: data.images.available ? data.images.data.images.length.toLocaleString("pt-BR") : "—",
                    icon: ImagesSquare,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex min-h-14 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-white/72 px-2.5 py-2"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                      <item.icon size={17} weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--foreground)]">{item.label}</p>
                    </div>
                    <span className="text-base font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </DeveloperCard>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <DeveloperCard className="flex h-full flex-col p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
              <DeveloperSectionHeading
                eyebrow="Rotas mais acessadas"
                title="Top páginas do site"
                description="As páginas abaixo receberam mais visualizações no período atual."
              />

              <div className="grid gap-x-5 gap-y-2.5 pt-1 sm:grid-cols-2">
                {!data.analytics.available ? (
                  <DeveloperMessage tone="info">Os indicadores de analytics não estão disponíveis para o seu perfil.</DeveloperMessage>
                ) : topPages.length > 0 ? (
                  topPages.map((item) => {
                    const maxViews = Math.max(...data.analytics.data.topPages.map((page) => page.views), 1);
                    const pct = Math.round((item.views / maxViews) * 100);

                    return (
                      <div key={item.page}>
                        <div className="flex items-center gap-2">
                          <span className="flex-1 truncate text-xs font-medium text-[var(--foreground)]">
                            {item.page}
                          </span>
                          <span className="text-xs font-semibold text-[var(--primary)]">{item.views}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                          <div
                            className="h-1.5 rounded-full bg-[linear-gradient(90deg,#1d4ed8_0%,#06b6d4_100%)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <DeveloperMessage tone="info">Nenhuma página registrada ainda.</DeveloperMessage>
                )}
              </div>
            </DeveloperCard>

            <DeveloperCard>
              <DeveloperSectionHeading
                eyebrow="Acesso rápido"
                title="Abrir módulos do CMS"
                description="Acesse os módulos de gestão do site."
              />

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href as AppPath}
                    className={`${developerSecondaryButtonClassName} min-h-9 rounded-lg px-3 py-1.5 text-xs`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)] bg-white/72 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                  Top páginas do popup
                </p>
                {!data.popup.available ? (
                  <DeveloperMessage tone="info">Os indicadores do popup não estão disponíveis para o seu perfil.</DeveloperMessage>
                ) : <>
                  <div className="mt-2 overflow-hidden px-px">
                    <div
                      className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                      style={{ transform: `translateX(-${popupTopPagesPage * 100}%)` }}
                    >
                      {popupTopPagesPages.map((page, index) => (
                        <div key={index} className="grid min-w-0 basis-full shrink-0 gap-1.5 sm:grid-cols-2">
                          {page.length > 0 ? (
                            page.map((item) => (
                              <div
                                key={item.pagePath}
                                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--border)]/75 px-2.5 py-2 text-xs"
                              >
                                <span className="truncate text-[var(--foreground)]">{item.pagePath}</span>
                                <strong className="text-[var(--primary)]">{item.total}</strong>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[var(--color-muted-raw)]">
                              Ainda não há páginas com volume suficiente no popup.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <DeveloperCarouselPagination
                    currentPage={popupTopPagesPage}
                    totalPages={popupTopPagesTotalPages}
                    onNext={nextPopupTopPagesPage}
                    onPrev={prevPopupTopPagesPage}
                    compact
                  />
                </>}
              </div>
            </DeveloperCard>
          </section>
        </>
      ) : null}
    </DeveloperPage>
  );
}
