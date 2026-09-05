"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  CursorClick,
  EnvelopeSimple,
  Pulse,
} from "@phosphor-icons/react";
import { useApiRequest } from "@/hooks/useApiRequest";
import {
  adminResourceKeys,
  invalidateAdminResource,
  useAdminResource,
} from "@/hooks/useAdminResource";
import { useCarouselPagination } from "@/hooks/useCarouselPagination";
import { api, site, siteUrl } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  DeveloperMediaField,
  DeveloperMediaPreview,
} from "@/components/developer/DeveloperMediaField";
import { MediaPlacementEditor } from "@/components/developer/MediaPlacementEditor";
import { DeveloperResponsivePreview } from "@/components/developer/DeveloperResponsivePreview";
import { DEFAULT_POPUP_CONFIG, type PopupConfig } from "@shared/lib/popupDefaults";
import type { ResponsiveMediaPresentation } from "@shared/types/media";
import {
  DeveloperCard,
  DeveloperField,
  DeveloperHero,
  DeveloperCarouselPagination,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  developerInputClassName,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
} from "@/components/developer/ui";

interface PopupEvent {
  id: string;
  createdAt: string;
  event: string;
  pagePath: string;
  sessionId?: string;
}

interface PopupAnalytics {
  totals: Record<string, number>;
  conversionRate: number;
  topPages: Array<{ pagePath: string; total: number }>;
  last7Days: {
    events: number;
    shown: number;
    submitted: number;
  };
}

interface PopupLead {
  id: string;
  createdAt: string;
  pagePath?: string;
  name?: string;
  email?: string;
  phone?: string;
}

const DEFAULT_CONFIG: PopupConfig = DEFAULT_POPUP_CONFIG;

const popupPrimaryPanelClassName =
  "rounded-[22px] border border-[#93c5fd] bg-[linear-gradient(135deg,rgba(219,234,254,0.82)_0%,rgba(239,246,255,0.82)_54%,rgba(248,251,255,0.94)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(29,78,216,0.08)] ring-1 ring-[var(--primary)]/7 sm:p-5";

const popupSupportPanelClassName =
  "rounded-[22px] border border-slate-300/85 bg-slate-100/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5";

interface PopupResourceData {
  config: PopupConfig;
  analytics: PopupAnalytics | null;
  events: PopupEvent[];
  leads: PopupLead[];
  leadsRestricted: boolean;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function PopupImageEditor({
  label,
  value,
  presentation,
  onChange,
  onPresentationChange,
  framingOpen,
  onFramingOpenChange,
  frameAspectRatio,
  className,
}: {
  label: string;
  value: string;
  presentation?: ResponsiveMediaPresentation;
  onChange: (value: string) => void;
  onPresentationChange: (value: ResponsiveMediaPresentation) => void;
  framingOpen: boolean;
  onFramingOpenChange: (open: boolean) => void;
  frameAspectRatio: string;
  className?: string;
}) {
  const hasImage = value.trim().length > 0;

  return (
    <div className={className}>
      <div className={cn("grid gap-3", hasImage && "md:grid-cols-[220px_minmax(0,1fr)] md:items-start")}>
        {hasImage ? (
          <DeveloperMediaPreview
            value={value}
            previewAlt={label}
            mediaType="image"
            compact
            align="start"
            onFrame={() => onFramingOpenChange(true)}
          />
        ) : null}
        <DeveloperMediaField
          label="Arquivo da imagem"
          value={value}
          mediaType="image"
          helpKey="popup-exit.field.image"
          previewAlt={label}
          showPreview={false}
          onChange={onChange}
        />
      </div>
      <MediaPlacementEditor
        label={label}
        src={value}
        alt={label}
        mediaType="image"
        value={presentation}
        frameAspectRatio={frameAspectRatio}
        onChange={onPresentationChange}
        open={framingOpen}
        onOpenChange={onFramingOpenChange}
        hideTrigger
      />
    </div>
  );
}

export default function PopupExitPage() {
  const { apiRequest } = useApiRequest();
  const [config, setConfig] = useState<PopupConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"" | "success" | "error">("");
  const [statusMessage, setStatusMessage] = useState("");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [defaultImageFramingOpen, setDefaultImageFramingOpen] = useState(false);
  const [desktopImageFramingOpen, setDesktopImageFramingOpen] = useState(false);
  const [mobileImageFramingOpen, setMobileImageFramingOpen] = useState(false);
  const {
    data: resourceData,
    loading,
    error,
    refresh,
  } = useAdminResource<PopupResourceData>({
    key: adminResourceKeys.popup,
    fetcher: async (request) => {
      const [configResponse, eventsResponse, leadsResponse] = await Promise.all([
        request<{ config?: Partial<PopupConfig> }>(api.popup.config),
        request<{ events?: PopupEvent[]; analytics?: PopupAnalytics }>(
          `${api.popup.events}?days=30`
        ),
        request<{ leads?: PopupLead[] }>(api.popup.leads),
      ]);

      const leadsRestricted = !leadsResponse.success && leadsResponse.status === 403;

      if (
        !configResponse.success ||
        !eventsResponse.success ||
        (!leadsResponse.success && !leadsRestricted)
      ) {
        return {
          success: false,
          error:
            configResponse.error ??
            eventsResponse.error ??
            leadsResponse.error ??
            "Falha ao carregar o popup.",
        };
      }

      return {
        success: true,
        data: {
          config: {
            ...DEFAULT_CONFIG,
            ...configResponse.data?.config,
            desktop: {
              ...DEFAULT_CONFIG.desktop,
              ...(configResponse.data?.config?.desktop ?? {}),
            },
            mobile: {
              ...DEFAULT_CONFIG.mobile,
              ...(configResponse.data?.config?.mobile ?? {}),
            },
          },
          analytics: eventsResponse.data?.analytics ?? null,
          events: eventsResponse.data?.events ?? [],
          leads: leadsRestricted ? [] : leadsResponse.data?.leads ?? [],
          leadsRestricted,
        },
      };
    },
  });
  const analytics = resourceData?.analytics ?? null;
  const events = resourceData?.events ?? [];
  const leads = resourceData?.leads ?? [];
  const leadsRestricted = resourceData?.leadsRestricted ?? false;

  useEffect(() => {
    if (!resourceData) return;
    setConfig(resourceData.config);
  }, [resourceData]);

  const {
    pages: leadsPages,
    currentPage: leadsPage,
    totalPages: leadsTotalPages,
    nextPage: nextLeadsPage,
    prevPage: prevLeadsPage,
  } = useCarouselPagination(leads, 4);

  const {
    pages: eventsPages,
    currentPage: eventsPage,
    totalPages: eventsTotalPages,
    nextPage: nextEventsPage,
    prevPage: prevEventsPage,
  } = useCarouselPagination(events, 4);

  const popupTopPages = analytics?.topPages ?? [];
  const {
    pages: topPagesPages,
    currentPage: topPagesPage,
    totalPages: topPagesTotalPages,
    nextPage: nextTopPagesPage,
    prevPage: prevTopPagesPage,
  } = useCarouselPagination(popupTopPages, 4);

  const leadsLast7Days = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return leads.filter((lead) => Date.parse(lead.createdAt) >= sevenDaysAgo).length;
  }, [leads]);

  async function handleSave() {
    if (!config.title.trim() || !config.description.trim() || !config.buttonText.trim()) {
      setStatus("error");
      setStatusMessage("Preencha título, descrição e texto do botão antes de salvar.");
      return;
    }
    if (!config.enableName && !config.enableEmail && !config.enablePhone) {
      setStatus("error");
      setStatusMessage("Ative ao menos um campo de contato antes de salvar.");
      return;
    }

    setSaving(true);
    setStatus("");
    setStatusMessage("");

    const response = await apiRequest(api.popup.config, {
      method: "POST",
      body: JSON.stringify(config),
    });

    setSaving(false);

    if (!response.success) {
      setStatus("error");
      setStatusMessage(response.error ?? "Falha ao salvar o popup.");
      return;
    }

    invalidateAdminResource([adminResourceKeys.popup, adminResourceKeys.dashboard]);
    setStatus("success");
    setStatusMessage("Configuração do popup salva com sucesso.");
    setPreviewRevision((revision) => revision + 1);
    await refresh();
  }

  function setValue<K extends keyof PopupConfig>(key: K, value: PopupConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="Automações - Exit popup"
        title="Configuração e análise do popup de saída."
        description="Texto, exibição, eventos e leads."
        stats={[
          { label: "Popup exibido", value: analytics?.totals.popup_shown ?? 0 },
          { label: "Conversão", value: `${(analytics?.conversionRate ?? 0).toFixed(1)}%` },
          { label: "Leads", value: leadsRestricted ? "—" : leads.length },
        ]}
        actions={
          <button
            type="button"
            onClick={() => window.open(siteUrl("/?popup_test=1"), "_blank", "noopener,noreferrer")}
            className={developerSecondaryButtonClassName}
          >
            <ArrowSquareOut size={16} weight="bold" />
            Testar popup
          </button>
        }
      />

      {loading ? (
        <div className="mt-6">
          <DeveloperMessage tone="info">Carregando configuração do popup...</DeveloperMessage>
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

      <div className="mt-6">
        <DeveloperResponsivePreview
          href={site.home}
          title="Preview do popup de saída"
          showExitPopup
          revision={previewRevision}
        />
      </div>

      <div className="mt-8 flex flex-col gap-6">

        {/* Card 1 — Status */}
          <DeveloperCard className="p-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                  Status
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">Ativação do popup</p>
              </div>
              <label className="flex min-h-10 items-center gap-3 rounded-xl border border-[var(--primary)]/16 bg-[var(--primary)]/6 px-3 py-2 text-sm font-medium text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) => setValue("enabled", event.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Popup ativo
            </label>
            </div>
          </DeveloperCard>

          {/* Card 2 — Textos */}
          <DeveloperCard>
            <DeveloperSectionHeading
              eyebrow="Conteúdo"
              title="Textos do popup"
              description="Título, descrição, botão de envio, fechar e mensagem de confirmação."
            />
            <div className="space-y-5">
              <div className={cn(popupPrimaryPanelClassName, "space-y-5")}>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Mensagem principal
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-muted-raw)]">
                    Conteúdo apresentado antes do formulário de contato.
                  </p>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                <DeveloperField label="Título" required>
                  <input
                    value={config.title}
                    onChange={(event) => setValue("title", event.target.value)}
                    maxLength={80}
                    className={developerInputClassName}
                  />
                </DeveloperField>
                <DeveloperField label="Texto do botão" required>
                  <input
                    value={config.buttonText}
                    onChange={(event) => setValue("buttonText", event.target.value)}
                    maxLength={40}
                    className={developerInputClassName}
                  />
                </DeveloperField>
                  <DeveloperField label="Descrição" required className="lg:col-span-2">
                    <textarea
                      rows={3}
                      value={config.description}
                      onChange={(event) => setValue("description", event.target.value)}
                      maxLength={220}
                      className={`${developerInputClassName} resize-none`}
                    />
                  </DeveloperField>
                </div>
              </div>

              <div className={cn(popupSupportPanelClassName, "grid gap-5 lg:grid-cols-3")}>
                <DeveloperField label="Texto de fechar">
                  <input
                    value={config.closeText}
                    onChange={(event) => setValue("closeText", event.target.value)}
                    maxLength={24}
                    className={developerInputClassName}
                  />
                </DeveloperField>
                <DeveloperField label="Mensagem de sucesso">
                  <input
                    value={config.successMessage}
                    onChange={(event) => setValue("successMessage", event.target.value)}
                    maxLength={160}
                    className={developerInputClassName}
                  />
                </DeveloperField>
                <DeveloperField label="Badge">
                  <input
                    value={config.badgeText ?? ""}
                    onChange={(event) => setValue("badgeText", event.target.value)}
                    maxLength={40}
                    className={developerInputClassName}
                  />
                </DeveloperField>
              </div>

              <div className={cn(popupPrimaryPanelClassName, "p-3 sm:p-4")}>
                <div className="mb-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Imagem padrão</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-muted-raw)]">
                    Imagem usada quando não houver uma versão específica para desktop ou celular.
                  </p>
                </div>
                <PopupImageEditor
                  label="a imagem padrão do popup de saída"
                  value={config.image ?? ""}
                  onChange={(image) => setValue("image", image)}
                  presentation={config.imagePresentation}
                  frameAspectRatio="2:3 no desktop e largura total no celular"
                  onPresentationChange={(imagePresentation) => setValue("imagePresentation", imagePresentation)}
                  framingOpen={defaultImageFramingOpen}
                  onFramingOpenChange={setDefaultImageFramingOpen}
                />
              </div>
            </div>
          </DeveloperCard>

          <div className="grid gap-6 min-[1600px]:grid-cols-2 min-[1600px]:items-start">
            <DeveloperCard className="p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
              <DeveloperSectionHeading
                eyebrow="Desktop"
                title="Layout específico"
                description="Textos e imagem usados em telas maiores."
              />
              <div className="space-y-3">
                <DeveloperField label="Título desktop">
                  <input
                    value={config.desktop?.title ?? ""}
                    maxLength={120}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        desktop: { ...current.desktop, title: event.target.value },
                      }))
                    }
                    className={developerInputClassName}
                  />
                </DeveloperField>
                <DeveloperField label="Descrição desktop">
                  <textarea
                    rows={3}
                    value={config.desktop?.description ?? ""}
                    maxLength={280}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        desktop: { ...current.desktop, description: event.target.value },
                      }))
                    }
                    className={`${developerInputClassName} resize-none`}
                  />
                </DeveloperField>
                <PopupImageEditor
                  label="a imagem desktop do popup de saída"
                  value={config.desktop?.image ?? ""}
                  onChange={(image) =>
                    setConfig((current) => ({
                      ...current,
                      desktop: { ...current.desktop, image },
                    }))
                  }
                  presentation={config.desktop?.imagePresentation}
                  frameAspectRatio="2:3 no desktop"
                  onPresentationChange={(imagePresentation) =>
                    setConfig((current) => ({
                      ...current,
                      desktop: { ...current.desktop, imagePresentation },
                    }))
                  }
                  framingOpen={desktopImageFramingOpen}
                  onFramingOpenChange={setDesktopImageFramingOpen}
                />
              </div>
            </DeveloperCard>

            <DeveloperCard className="p-4 sm:p-4 [&>div:first-child]:mb-3 [&>div:first-child_p:last-child]:leading-5">
              <DeveloperSectionHeading
                eyebrow="Mobile"
                title="UX própria para celular"
                description="Usa texto, imagem e folha inferior adaptados."
                tooltip="Configuração exclusiva do popup em celulares, com layout próprio em formato de folha inferior."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <DeveloperField label="Título mobile">
                  <input
                    value={config.mobile?.title ?? ""}
                    maxLength={120}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        mobile: { ...current.mobile, title: event.target.value },
                      }))
                    }
                    className={developerInputClassName}
                  />
                </DeveloperField>
                <DeveloperField label="Descrição mobile" className="sm:col-span-2">
                  <textarea
                    rows={3}
                    value={config.mobile?.description ?? ""}
                    maxLength={280}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        mobile: { ...current.mobile, description: event.target.value },
                      }))
                    }
                    className={`${developerInputClassName} resize-none`}
                  />
                </DeveloperField>
                <DeveloperField label="Título da folha mobile" className="sm:col-start-2 sm:row-start-1">
                  <input
                    value={config.mobile?.sheetTitle ?? ""}
                    maxLength={80}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        mobile: { ...current.mobile, sheetTitle: event.target.value },
                      }))
                    }
                    className={developerInputClassName}
                  />
                </DeveloperField>
                <PopupImageEditor
                  label="a imagem mobile do popup de saída"
                  value={config.mobile?.image ?? ""}
                  className="sm:col-span-2"
                  onChange={(image) =>
                    setConfig((current) => ({
                      ...current,
                      mobile: { ...current.mobile, image },
                    }))
                  }
                  presentation={config.mobile?.imagePresentation}
                  frameAspectRatio="largura total, com faixa visual de 11rem"
                  onPresentationChange={(imagePresentation) =>
                    setConfig((current) => ({
                      ...current,
                      mobile: { ...current.mobile, imagePresentation },
                    }))
                  }
                  framingOpen={mobileImageFramingOpen}
                  onFramingOpenChange={setMobileImageFramingOpen}
                />
              </div>
            </DeveloperCard>
          </div>

          {/* Card 3 — Exibição */}
          <DeveloperCard>
            <DeveloperSectionHeading
              eyebrow="Exibição"
              title="Limites e temporizadores"
              description="Controle delay de ativação, intervalo de reexibição e limite por sessão."
              tooltip="Define quando o popup aparece e evita repetição excessiva na mesma sessão."
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <DeveloperField
                label="Delay (seg)"
                tooltip="Tempo mínimo antes de liberar o popup. Exemplo: 10 segundos após carregar a página."
              >
                <input
                  type="number"
                  min={0}
                  value={config.delaySeconds}
                  onChange={(event) =>
                    setValue("delaySeconds", Number(event.target.value) || 0)
                  }
                  className={developerInputClassName}
                />
              </DeveloperField>
              <DeveloperField
                label="Cooldown (h)"
                tooltip="Intervalo para não mostrar novamente ao mesmo visitante. Exemplo: 24 horas."
              >
                <input
                  type="number"
                  min={0}
                  value={config.cooldownHours}
                  onChange={(event) =>
                    setValue("cooldownHours", Number(event.target.value) || 0)
                  }
                  className={developerInputClassName}
                />
              </DeveloperField>
              <DeveloperField
                label="Exibições por sessão"
                tooltip="Limite de vezes que o popup pode aparecer durante uma visita. Exemplo: 1."
              >
                <input
                  type="number"
                  min={1}
                  value={config.maxShowsPerSession}
                  onChange={(event) =>
                    setValue("maxShowsPerSession", Number(event.target.value) || 1)
                  }
                  className={developerInputClassName}
                />
              </DeveloperField>
            </div>
          </DeveloperCard>

          {/* Card 4 — Campos + Gatilhos lado a lado */}
          <div className="grid gap-6 sm:grid-cols-2">
            <DeveloperCard>
              <DeveloperSectionHeading
                eyebrow="Formulário"
                title="Campos visíveis"
              />
              <div className="space-y-3">
                {[
                  { key: "enableName" as const, label: "Nome" },
                  { key: "enableEmail" as const, label: "E-mail" },
                  { key: "enablePhone" as const, label: "Telefone" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/72 px-4 py-2.5 text-sm font-medium text-[var(--foreground)]"
                  >
                    <input
                      type="checkbox"
                      checked={config[item.key]}
                      onChange={(event) => setValue(item.key, event.target.checked)}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </DeveloperCard>

            <DeveloperCard>
              <DeveloperSectionHeading
                eyebrow="Mobile"
                title="Gatilhos mobile"
              />
              <div className="space-y-3">
                {[
                  { key: "mobileScrollTrigger" as const, label: "Scroll rápido ao topo" },
                  { key: "mobileBackButtonTrigger" as const, label: "Botão voltar" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/72 px-4 py-2.5 text-sm font-medium text-[var(--foreground)]"
                  >
                    <input
                      type="checkbox"
                      checked={config[item.key]}
                      onChange={(event) => setValue(item.key, event.target.checked)}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </DeveloperCard>
          </div>

          {/* Card 5 — Ações */}
          <DeveloperCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                  Salvar
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted-raw)]">
                  Aplica todas as alterações feitas nos campos acima.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={developerPrimaryButtonClassName}
                >
                  <CheckCircle size={18} weight="bold" />
                  {saving ? "Salvando..." : "Salvar configuração"}
                </button>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className={developerSecondaryButtonClassName}
                >
                  <Pulse size={16} weight="bold" />
                  Atualizar métricas
                </button>
              </div>
            </div>
            {status === "success" ? (
              <div className="mt-4">
                <DeveloperMessage tone="success">{statusMessage}</DeveloperMessage>
              </div>
            ) : null}
          </DeveloperCard>


        {/* Card — Análise */}
          <DeveloperCard>
            <DeveloperSectionHeading
              eyebrow="Análise"
              title="Leitura de desempenho"
              description="Volume de exibição, envio e páginas onde vale otimizar primeiro."
              tooltip="Compare popup exibido vs enviado para medir conversão. Exemplo: 100 exibidos e 8 enviados = 8%."
            />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Popup exibido", value: analytics?.totals.popup_shown ?? 0, icon: Pulse },
                { label: "Popup enviado", value: analytics?.totals.popup_submitted ?? 0, icon: CursorClick },
                { label: "Eventos 7 dias", value: analytics?.last7Days.events ?? 0, icon: Pulse },
                {
                  label: "Leads 7 dias",
                  value: leadsRestricted ? "—" : leadsLast7Days,
                  icon: EnvelopeSimple,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex min-h-[88px] items-center gap-3 rounded-[20px] border border-[var(--border)] bg-white/72 px-4 py-3"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                    <item.icon size={17} weight="duotone" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold leading-none tracking-[-0.05em] text-[var(--foreground)]">
                      {item.value}
                    </p>
                    <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-raw)]">
                      {item.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[20px] border border-[var(--border)] bg-white/72 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                Top páginas do popup
              </p>
              <div className="mt-2 overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                  style={{ transform: `translateX(-${topPagesPage * 100}%)` }}
                >
                  {topPagesPages.map((page, index) => (
                    <div key={index} className="grid w-full shrink-0 gap-2 sm:grid-cols-2">
                      {page.length > 0 ? (
                        page.map((item) => (
                          <div
                            key={item.pagePath}
                            className="flex min-h-10 items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                          >
                            <span className="truncate text-[var(--foreground)]">{item.pagePath}</span>
                            <strong className="text-[var(--primary)]">{item.total}</strong>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[var(--color-muted-raw)] sm:col-span-2">
                          Sem eventos suficientes no período atual.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <DeveloperCarouselPagination
                currentPage={topPagesPage}
                totalPages={topPagesTotalPages}
                onNext={nextTopPagesPage}
                onPrev={prevTopPagesPage}
                compact
              />
            </div>
          </DeveloperCard>

        {/* Cards Leads + Eventos lado a lado em telas grandes */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Card — Leads */}
          <DeveloperCard className="flex h-full flex-col">
            <DeveloperSectionHeading
              eyebrow="Leads recentes"
              title="Últimos contatos capturados"
              description={
                leadsRestricted
                  ? "A configuração e os eventos permanecem disponíveis; contatos exigem a permissão Leads."
                  : "Lista curta para acompanhamento comercial sem sair do painel."
              }
            />
            {leadsRestricted ? (
              <DeveloperMessage tone="info">
                Sua conta não pode consultar dados de contato. Peça a um administrador a permissão Leads se precisar acompanhar os envios.
              </DeveloperMessage>
            ) : (
              <>
                <div className="overflow-hidden">
                  <div
                    className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                    style={{ transform: `translateX(-${leadsPage * 100}%)` }}
                  >
                    {leadsPages.map((page, index) => (
                      <div key={index} className="w-full shrink-0 space-y-3">
                        {page.length > 0 ? (
                          page.map((lead) => (
                            <article
                              key={lead.id}
                              className="rounded-[22px] border border-[var(--border)] bg-white/72 px-4 py-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-[var(--foreground)]">
                                  {lead.name || "Lead sem nome"}
                                </p>
                                <span className="text-xs text-[var(--color-muted-raw)]">
                                  {formatDateTime(lead.createdAt)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-7 text-[var(--color-muted-raw)]">
                                {lead.email || "-"} - {lead.phone || "-"}
                              </p>
                              <p className="text-xs text-[var(--color-muted-raw)]">
                                Origem: {lead.pagePath || "/"}
                              </p>
                            </article>
                          ))
                        ) : (
                          <DeveloperMessage tone="info">
                            Nenhum lead capturado ainda para o popup.
                          </DeveloperMessage>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-auto">
                  <DeveloperCarouselPagination
                    currentPage={leadsPage}
                    totalPages={leadsTotalPages}
                    onNext={nextLeadsPage}
                    onPrev={prevLeadsPage}
                    compact
                    alwaysVisible
                  />
                </div>
              </>
            )}
          </DeveloperCard>

          {/* Card — Eventos */}
          <DeveloperCard className="flex h-full flex-col">
            <DeveloperSectionHeading
              eyebrow="Eventos recentes"
              title="Auditoria rápida"
              description="Últimos eventos recebidos pelo endpoint do popup."
              tooltip="Mostra eventos do popup para rastrear exibição, envio e sessão sem abrir o módulo de rastreamento."
            />
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                style={{ transform: `translateX(-${eventsPage * 100}%)` }}
              >
                {eventsPages.map((page, index) => (
                  <div key={index} className="w-full shrink-0 space-y-3">
                    {page.length > 0 ? (
                      page.map((event) => (
                        <article
                          key={event.id}
                          className="rounded-[22px] border border-[var(--border)] bg-white/72 px-4 py-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                              {event.event}
                            </span>
                            <span className="text-xs text-[var(--color-muted-raw)]">
                              {formatDateTime(event.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[var(--color-muted-raw)]">
                            Página: {event.pagePath || "/"}
                          </p>
                          <p className="text-xs text-[var(--color-muted-raw)]">
                            Sessão: {event.sessionId || "-"}
                          </p>
                        </article>
                      ))
                    ) : (
                      <DeveloperMessage tone="info">Nenhum evento registrado ainda.</DeveloperMessage>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-auto">
              <DeveloperCarouselPagination
                currentPage={eventsPage}
                totalPages={eventsTotalPages}
                onNext={nextEventsPage}
                onPrev={prevEventsPage}
                compact
              />
            </div>
          </DeveloperCard>
        </div>

      </div>
    </DeveloperPage>
  );
}
