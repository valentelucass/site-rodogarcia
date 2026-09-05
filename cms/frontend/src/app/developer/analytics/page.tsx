"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChartBar,
  CheckCircle,
  CursorClick,
  GlobeHemisphereWest,
  Lightning,
  Pulse,
} from "@phosphor-icons/react";
import { useApiRequest } from "@/hooks/useApiRequest";
import {
  adminResourceKeys,
  invalidateAdminResource,
  useAdminResource,
} from "@/hooks/useAdminResource";
import { useCarouselPagination } from "@/hooks/useCarouselPagination";
import { api } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  DeveloperCard,
  DeveloperField,
  DeveloperHelp,
  DeveloperHero,
  DeveloperCarouselPagination,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  DeveloperTooltip,
  developerInputClassName,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
} from "@/components/developer/ui";

interface StatsResponse {
  totalPageViews: number;
  uniqueSessions: number;
  topPages: Array<{ page: string; views: number }>;
  recentEvents: Array<{
    id: string;
    event?: string;
    type: string;
    page: string;
    element?: string;
    timestamp: number;
    sessionId?: string;
  }>;
  stats: {
    generatedAt?: string;
    metrics: {
      visitors?: number;
      sessions: number;
      bounceRate?: number;
      avgTimeSeconds?: number;
      averageSessionDuration?: number;
      pageViews?: number;
    };
    heatmap?: {
      avgScrollPercent: number;
      topClickAreas: Array<{ area: string; total: number }>;
    };
    conversions: {
      forms: number;
      downloads: number;
      leads: number;
      popupSubmissions?: number;
      popupOpen: number;
      total?: number;
      conversionRate?: number;
    };
    eventCounts: Record<string, number>;
    eventsTable?: Array<{
      id: string;
      event: string;
      page: string;
      timestamp: number;
      sessionId?: string;
    }>;
  };
}

interface ConfigForm {
  trackingEnabled: boolean;
  scrollMilestones: string;
  ga4Enabled: boolean;
  ga4MeasurementId: string;
  clarityEnabled: boolean;
  clarityProjectId: string;
}

const DEFAULT_FORM: ConfigForm = {
  trackingEnabled: true,
  scrollMilestones: "25,50,75,100",
  ga4Enabled: false,
  ga4MeasurementId: "",
  clarityEnabled: false,
  clarityProjectId: "",
};
const compactAnalyticsInputClassName = `${developerInputClassName} py-2`;

interface AnalyticsResourceData {
  stats: StatsResponse | null;
  form: ConfigForm;
}

function hydrateForm(config: Record<string, unknown> | undefined): ConfigForm {
  const tracking = (config?.tracking as Record<string, unknown> | undefined) ?? {};
  const providers = (config?.providers as Record<string, unknown> | undefined) ?? {};
  const ga4 = (providers.ga4 as Record<string, unknown> | undefined) ?? {};
  const clarity = (providers.clarity as Record<string, unknown> | undefined) ?? {};

  return {
    trackingEnabled: Boolean(tracking.enabled ?? true),
    scrollMilestones: Array.isArray(tracking.scrollMilestones)
      ? tracking.scrollMilestones.join(",")
      : DEFAULT_FORM.scrollMilestones,
    ga4Enabled: Boolean(ga4.enabled),
    ga4MeasurementId: String(ga4.measurementId ?? ""),
    clarityEnabled: Boolean(clarity.enabled),
    clarityProjectId: String(clarity.projectId ?? ""),
  };
}

function buildPayload(form: ConfigForm) {
  const scrollMilestones = form.scrollMilestones
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0 && item <= 100);

  return {
    tracking: {
      enabled: form.trackingEnabled,
      scrollMilestones: [...new Set(scrollMilestones)].sort((a, b) => a - b),
    },
    providers: {
      ga4: {
        enabled: form.ga4Enabled,
        measurementId: form.ga4MeasurementId,
      },
      clarity: {
        enabled: form.clarityEnabled,
        projectId: form.clarityProjectId,
      },
    },
  };
}

function formatDateTime(value?: string | number) {
  if (!value) return "-";
  const parsed = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function AnalyticsPage() {
  const { apiRequest } = useApiRequest();
  const [daysInput, setDaysInput] = useState(30);
  const [appliedDays, setAppliedDays] = useState(30);
  const [eventFilter, setEventFilter] = useState("");
  const [pageFilter, setPageFilter] = useState("");
  const [form, setForm] = useState<ConfigForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"" | "success" | "error">("");
  const [statusMessage, setStatusMessage] = useState("");
  const {
    data: resourceData,
    loading,
    error,
    refresh,
  } = useAdminResource<AnalyticsResourceData>({
    key: adminResourceKeys.analytics(appliedDays),
    fetcher: async (request) => {
      const [configResponse, statsResponse] = await Promise.all([
        request<{ config?: Record<string, unknown> }>(api.analytics.config),
        request<StatsResponse>(`${api.analytics.stats}?days=${appliedDays}`),
      ]);

      if (!configResponse.success || !statsResponse.success) {
        return {
          success: false,
          error:
            configResponse.error ??
            statsResponse.error ??
            "Falha ao carregar analytics.",
        };
      }

      return {
        success: true,
        data: {
          form: hydrateForm(configResponse.data?.config),
          stats: statsResponse.data ?? null,
        },
      };
    },
  });
  const stats = resourceData?.stats ?? null;
  const metrics = stats?.stats.metrics;
  const conversions = stats?.stats.conversions;
  const heatmap = stats?.stats.heatmap;
  const visitors = metrics?.visitors ?? stats?.uniqueSessions ?? 0;
  const sessions = metrics?.sessions ?? stats?.uniqueSessions ?? 0;
  const avgTimeSeconds = metrics?.avgTimeSeconds ?? metrics?.averageSessionDuration ?? 0;
  const avgScrollPercent = heatmap?.avgScrollPercent ?? 0;
  const conversionRate = conversions?.conversionRate ?? 0;
  const totalConversions =
    conversions?.total ??
    ((conversions?.forms ?? 0) +
      (conversions?.downloads ?? 0) +
      (conversions?.popupSubmissions ?? 0));
  const conversionEntries = [
    { label: "Formulários concluídos", value: conversions?.forms ?? 0 },
    { label: "Downloads", value: conversions?.downloads ?? 0 },
    { label: "Leads", value: conversions?.leads ?? 0 },
    { label: "Envios do popup", value: conversions?.popupSubmissions ?? 0 },
    { label: "Total", value: totalConversions },
  ];

  useEffect(() => {
    if (!resourceData) return;
    setForm(resourceData.form);
  }, [resourceData]);

  const eventEntries = useMemo(
    () =>
      stats?.stats.eventCounts
        ? Object.entries(stats.stats.eventCounts).sort(
            (left, right) => Number(right[1]) - Number(left[1])
          )
        : [],
    [stats]
  );
  const topPages = stats?.topPages ?? [];
  const eventsTable =
    stats?.stats.eventsTable ??
    stats?.recentEvents.map((event) => ({
      ...event,
      event: event.event ?? event.type,
    })) ??
    [];
  const filteredEventsTable = eventsTable.filter((event) => {
    const eventMatches = eventFilter
      ? event.event.toLowerCase().includes(eventFilter.toLowerCase())
      : true;
    const pageMatches = pageFilter
      ? event.page.toLowerCase().includes(pageFilter.toLowerCase())
      : true;
    return eventMatches && pageMatches;
  });
  const {
    pages: topPagesPages,
    currentPage: topPagesPage,
    totalPages: topPagesTotalPages,
    nextPage: nextTopPagesPage,
    prevPage: prevTopPagesPage,
  } = useCarouselPagination(topPages, 8);
  const {
    pages: eventEntriesPages,
    currentPage: eventEntriesPage,
    totalPages: eventEntriesTotalPages,
    nextPage: nextEventEntriesPage,
    prevPage: prevEventEntriesPage,
  } = useCarouselPagination(eventEntries, 5);
  const {
    pages: eventsTablePages,
    currentPage: eventsTablePage,
    totalPages: eventsTableTotalPages,
    nextPage: nextEventsTablePage,
    prevPage: prevEventsTablePage,
  } = useCarouselPagination(filteredEventsTable, 5);
  const {
    pages: conversionPages,
    currentPage: conversionPage,
    totalPages: conversionTotalPages,
    nextPage: nextConversionPage,
    prevPage: prevConversionPage,
  } = useCarouselPagination(conversionEntries, 5);

  async function handleSave() {
    const ga4MeasurementId = form.ga4MeasurementId.trim().toUpperCase();
    const clarityProjectId = form.clarityProjectId.trim();
    if (form.ga4Enabled && !/^(?:G|GT|AW)-[A-Z0-9]{4,}$/.test(ga4MeasurementId)) {
      setStatus("error");
      setStatusMessage("Informe um Measurement ID GA4 válido antes de habilitar o provedor.");
      return;
    }
    if (form.clarityEnabled && !/^[A-Za-z0-9]{6,80}$/.test(clarityProjectId)) {
      setStatus("error");
      setStatusMessage("Informe um Project ID Microsoft Clarity válido antes de habilitar o provedor.");
      return;
    }
    setSaving(true);
    setStatus("");
    setStatusMessage("");

    const response = await apiRequest(api.analytics.config, {
      method: "POST",
      body: JSON.stringify(buildPayload(form)),
    });

    setSaving(false);

    if (!response.success) {
      setStatus("error");
      setStatusMessage(response.error ?? "Falha ao salvar analytics.");
      return;
    }

    invalidateAdminResource(adminResourceKeys.analytics(appliedDays));
    setStatus("success");
    setStatusMessage("Configuração de analytics salva com sucesso.");
    await refresh();
  }

  function handleRefresh() {
    setStatus("");
    setStatusMessage("");
    if (daysInput !== appliedDays) {
      setAppliedDays(daysInput);
      return;
    }
    void refresh();
  }

  function setValue<K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="Automações - Analytics"
        title="Leitura de comportamento e configuração."
        description="Estatísticas e configurações de analytics."
        stats={[
          { label: "Visitantes", value: visitors },
          { label: "Sessões", value: sessions },
          {
            label: "Conversão",
            value: `${conversionRate.toFixed(1)}%`,
          },
        ]}
        actions={
          <div className="flex items-stretch gap-2">
            <div className="flex h-[54px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 shadow-sm backdrop-blur-md">
              <label htmlFor="analytics-period" className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                Período
              </label>
              <input
                id="analytics-period"
                type="number"
                min={1}
                max={120}
                value={daysInput}
                onChange={(event) => setDaysInput(Number(event.target.value) || 30)}
                aria-label="Período em dias"
                className="h-8 w-16 rounded-lg border border-white/10 bg-slate-900/70 px-2 text-sm font-medium text-sky-100 outline-none transition-colors focus:border-sky-300/60 focus:ring-2 focus:ring-sky-300/15"
              />
            </div>
            <button type="button" onClick={handleRefresh} className={cn(developerSecondaryButtonClassName, "h-[54px] min-h-[54px] px-4 py-2 text-xs")}>
              <Pulse size={15} weight="bold" />
              Atualizar
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="mt-6">
          <DeveloperMessage tone="info">Carregando dados de analytics...</DeveloperMessage>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-6">
          <DeveloperMessage tone="error">{statusMessage}</DeveloperMessage>
        </div>
      ) : null}

      {error ? (
        <div className="mt-6">
          <DeveloperMessage tone="error">{error}</DeveloperMessage>
        </div>
      ) : null}

      {stats ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Page views", value: stats.totalPageViews, icon: ChartBar },
              { label: "Sessões únicas", value: stats.uniqueSessions, icon: GlobeHemisphereWest },
              {
                label: "Tempo médio",
                value: `${avgTimeSeconds.toFixed(0)}s`,
                icon: Pulse,
              },
              {
                label: "Scroll médio",
                value: `${avgScrollPercent.toFixed(1)}%`,
                icon: Lightning,
              },
            ].map((item) => (
              <DeveloperCard key={item.label} className="flex min-h-[74px] items-center gap-2.5 p-3 sm:gap-3 sm:p-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] sm:h-9 sm:w-9">
                  <item.icon size={18} weight="duotone" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[var(--color-muted-raw)]">{item.label}</span>
                    <DeveloperHelp label={item.label} kind="metric" />
                  </div>
                  <div className="mt-0.5 text-xl font-bold leading-none tracking-[-0.045em] text-[var(--foreground)] sm:text-2xl">{item.value}</div>
                </div>
              </DeveloperCard>
            ))}
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <DeveloperCard className="flex h-full flex-col p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
              <DeveloperSectionHeading
                eyebrow="Páginas"
                title="Top páginas do período"
                description={`Atualizado em ${formatDateTime(stats.stats.generatedAt ?? Date.now())}.`}
              />

              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                  style={{ transform: `translateX(-${topPagesPage * 100}%)` }}
                >
                  {topPagesPages.map((page, index) => (
                    <div key={index} className="grid w-full shrink-0 gap-x-5 gap-y-2.5 sm:grid-cols-2">
                      {page.map((pageData, itemIndex) => {
                        const maxViews = Math.max(...stats.topPages.map((item) => item.views), 1);
                        const width = Math.round((pageData.views / maxViews) * 100);

                        return (
                          <div
                            key={pageData.page}
                            className={page.length % 2 === 1 && itemIndex === page.length - 1 ? "sm:col-span-2" : undefined}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-xs font-medium text-[var(--foreground)]">
                                {pageData.page}
                              </span>
                              <span className="text-xs font-semibold text-[var(--primary)]">
                                {pageData.views}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                              <div
                                className="h-1.5 rounded-full bg-[linear-gradient(90deg,#1d4ed8_0%,#06b6d4_100%)]"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3"><DeveloperCarouselPagination currentPage={topPagesPage} totalPages={topPagesTotalPages} onNext={nextTopPagesPage} onPrev={prevTopPagesPage} compact /></div>
            </DeveloperCard>

            <DeveloperCard className="flex h-full flex-col p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
              <DeveloperSectionHeading
                eyebrow="Eventos"
                title="Contagem por tipo"
                description="Resumo dos eventos recebidos pelo analytics."
              />

              <div className="flex-1 overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                  style={{ transform: `translateX(-${eventEntriesPage * 100}%)` }}
                >
                  {eventEntriesPages.map((page, index) => (
                    <div key={index} className="grid w-full shrink-0 gap-2 sm:grid-cols-2">
                      {page.length > 0 ? (
                        page.map(([eventName, total], itemIndex) => (
                          <div
                            key={eventName}
                            className={cn(
                              "flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/72 px-3 py-2",
                              page.length % 2 === 1 && itemIndex === page.length - 1 && "sm:col-span-2"
                            )}
                          >
                            <span className="truncate text-xs font-medium text-[var(--foreground)]">
                              {eventName}
                            </span>
                            <strong className="text-sm text-[var(--primary)]">{total}</strong>
                          </div>
                        ))
                      ) : (
                        <DeveloperMessage tone="info">Nenhum evento no período atual.</DeveloperMessage>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3"><DeveloperCarouselPagination currentPage={eventEntriesPage} totalPages={eventEntriesTotalPages} onNext={nextEventEntriesPage} onPrev={prevEventEntriesPage} compact /></div>
            </DeveloperCard>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <DeveloperCard className="flex h-full flex-col p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
              <DeveloperSectionHeading
                eyebrow="Auditoria"
                title="Eventos recentes"
                description="Últimos registros recebidos pelo endpoint de analytics."
              />

              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <DeveloperField
                  label="Filtrar tipo"
                  helpKey="filtrar-tipo"
                >
                  <input
                    value={eventFilter}
                    onChange={(event) => setEventFilter(event.target.value)}
                    className={compactAnalyticsInputClassName}
                    placeholder="page_view, cta_click..."
                  />
                </DeveloperField>
                <DeveloperField
                  label="Filtrar página"
                  helpKey="filtrar-pagina"
                >
                  <input
                    value={pageFilter}
                    onChange={(event) => setPageFilter(event.target.value)}
                    className={compactAnalyticsInputClassName}
                    placeholder="/servicos"
                  />
                </DeveloperField>
              </div>

              <div className="flex-1 overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                  style={{ transform: `translateX(-${eventsTablePage * 100}%)` }}
                >
                  {eventsTablePages.map((page, index) => (
                    <div key={index} className="w-full shrink-0">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted-raw)]">
                              <th className="pb-2 pr-4 font-semibold"><span className="inline-flex items-center gap-1.5">Evento <DeveloperHelp label="Evento" templateKey="evento" /></span></th>
                              <th className="pb-2 pr-4 font-semibold"><span className="inline-flex items-center gap-1.5">Página <DeveloperHelp label="Página" templateKey="pagina" /></span></th>
                              <th className="pb-2 pr-4 font-semibold"><span className="inline-flex items-center gap-1.5">Data <DeveloperHelp label="Data" templateKey="data" /></span></th>
                              <th className="pb-2 font-semibold">
                                <span className="inline-flex items-center gap-1.5">
                                  Sessão
                                  <DeveloperHelp label="Sessão" templateKey="sessao" />
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {page.map((event) => (
                              <tr key={event.id} className="border-b border-[var(--border)]/60 align-top">
                                <td className="py-2 pr-4 text-[var(--foreground)]">{event.event}</td>
                                <td className="py-2 pr-4 text-[var(--color-muted-raw)]">{event.page}</td>
                                <td className="py-2 pr-4 text-[var(--color-muted-raw)]">
                                  {formatDateTime(event.timestamp)}
                                </td>
                                <td className="py-2 text-[var(--color-muted-raw)]">
                                  {event.sessionId || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3"><DeveloperCarouselPagination currentPage={eventsTablePage} totalPages={eventsTableTotalPages} onNext={nextEventsTablePage} onPrev={prevEventsTablePage} compact /></div>
            </DeveloperCard>

            <DeveloperCard className="flex h-full flex-col p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
              <DeveloperSectionHeading
                eyebrow="Conversões"
                title="Resumo de resultados"
                description="Formulários, downloads, popup e taxa geral do período."
              />

              <div className="flex flex-1 overflow-hidden">
                <div className="flex w-full transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]" style={{ transform: `translateX(-${conversionPage * 100}%)` }}>
                  {conversionPages.map((conversionItems, index) => (
                    <div key={index} className="grid w-full shrink-0 content-start gap-2 sm:grid-cols-2">
                      {conversionItems.map((item, itemIndex) => (
                        <div
                          key={item.label}
                          className={cn(
                            "flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-slate-50/80 px-3 py-2",
                            conversionItems.length % 2 === 1 && itemIndex === conversionItems.length - 1 && "sm:col-span-2"
                          )}
                        >
                          <span className="text-xs font-medium text-[var(--foreground)]">{item.label}</span>
                          <strong className="text-sm text-[var(--primary)]">{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3"><DeveloperCarouselPagination currentPage={conversionPage} totalPages={conversionTotalPages} onNext={nextConversionPage} onPrev={prevConversionPage} compact /></div>
            </DeveloperCard>
          </section>
        </>
      ) : null}

      <section className="mt-6">
        <DeveloperCard className="p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
          <DeveloperSectionHeading
            eyebrow="Configuração"
            title="Eventos internos e integrações"
            description="Configura somente os recursos consumidos pela telemetria pública. O consentimento permanece centralizado em LGPD/Cookies."
            tooltip="Estas opções controlam os eventos internos e os provedores externos efetivamente carregados pelo site."
          />

          <div className="space-y-3">
            <div className="grid gap-2 rounded-lg border border-[#bfdbfe] bg-[linear-gradient(135deg,rgba(239,246,255,0.9),rgba(255,255,255,0.95))] p-2.5 sm:grid-cols-[minmax(220px,0.7fr)_minmax(280px,1.3fr)] sm:items-end sm:gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                  Eventos próprios
                </p>
                <label className="mt-1.5 flex min-h-9 items-center gap-2.5 rounded-lg border border-white bg-white/92 px-3 py-2 text-xs font-medium text-[var(--foreground)] shadow-[0_5px_12px_rgba(29,78,216,0.04)]">
                  <input
                    type="checkbox"
                    checked={form.trackingEnabled}
                    onChange={(event) => setValue("trackingEnabled", event.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Eventos internos ativos
                  <DeveloperHelp label="Eventos internos ativos" templateKey="eventos-internos-ativos" />
                </label>
              </div>
              <DeveloperField
                label="Marcos de scroll (%)"
                helpKey="marcos-de-scroll"
                className="[&>span]:!mb-1"
              >
                <input
                  value={form.scrollMilestones}
                  onChange={(event) => setValue("scrollMilestones", event.target.value)}
                  className={compactAnalyticsInputClassName}
                />
              </DeveloperField>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {[
                {
                  enabledKey: "ga4Enabled" as const,
                  fieldKey: "ga4MeasurementId" as const,
                  label: "GA4",
                  fieldLabel: "Measurement ID",
                  enabledHelpKey: "ga4",
                  fieldHelpKey: "measurement-id",
                },
                {
                  enabledKey: "clarityEnabled" as const,
                  fieldKey: "clarityProjectId" as const,
                  label: "Clarity",
                  fieldLabel: "Project ID",
                  enabledHelpKey: "clarity",
                  fieldHelpKey: "project-id",
                },
              ].map((item) => (
                <div key={item.label} className={cn("grid gap-2 rounded-lg border px-3 py-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.035)] sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end sm:gap-3", form[item.enabledKey] ? "border-[#93c5fd] bg-[#eff6ff]" : "border-slate-200 bg-slate-50/82")}>
                  <label className="flex min-h-9 items-center gap-2.5 text-xs font-medium text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={form[item.enabledKey]}
                      onChange={(event) =>
                        setValue(item.enabledKey, event.target.checked)
                      }
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {item.label}
                    <DeveloperHelp label={item.label} templateKey={item.enabledHelpKey} />
                  </label>

                  <DeveloperField label={item.fieldLabel} helpKey={item.fieldHelpKey} className="[&>span]:!mb-1">
                    <input
                      value={form[item.fieldKey]}
                      onChange={(event) =>
                        setValue(item.fieldKey, event.target.value)
                      }
                      required={form[item.enabledKey]}
                      aria-required={form[item.enabledKey]}
                      maxLength={item.fieldKey === "ga4MeasurementId" ? 40 : 80}
                      className={compactAnalyticsInputClassName}
                    />
                  </DeveloperField>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={handleSave} disabled={saving} className={cn(developerPrimaryButtonClassName, "!min-h-9 !rounded-lg !px-3 !py-1.5 text-xs")}>
                <CheckCircle size={18} weight="bold" />
                {saving ? "Salvando..." : "Salvar configuração"}
                <DeveloperHelp label="Salvar configuração" templateKey="salvar-configuracao" />
              </button>
              <button type="button" onClick={handleRefresh} className={cn(developerSecondaryButtonClassName, "!min-h-9 !rounded-lg !px-3 !py-1.5 text-xs")}>
                <CursorClick size={16} weight="bold" />
                Atualizar métricas
                <DeveloperHelp label="Atualizar métricas" templateKey="atualizar-metricas" />
              </button>
            </div>

            {status === "success" ? (
              <DeveloperMessage tone="success">
                {statusMessage}
              </DeveloperMessage>
            ) : null}
          </div>
        </DeveloperCard>
      </section>
    </DeveloperPage>
  );
}
