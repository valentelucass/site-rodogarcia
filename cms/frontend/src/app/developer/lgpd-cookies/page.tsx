"use client";

import { useDeveloperNotifier } from "@/components/developer/DeveloperNotifications";

import { useEffect, useMemo, useState } from "react";
import { CaretLeft, CaretRight, CheckCircle, Pulse } from "@phosphor-icons/react";
import { DeveloperResponsivePreview } from "@/components/developer/DeveloperResponsivePreview";
import {
  DeveloperCard,
  DeveloperField,
  DeveloperHero,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  DeveloperTooltip,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
  developerInputClassName,
} from "@/components/developer/ui";
import { useApiRequest } from "@/hooks/useApiRequest";
import { adminResourceKeys, invalidateAdminResource, useAdminResource } from "@/hooks/useAdminResource";
import { api, site } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface ConsentCategory {
  key: string;
  label: string;
  description: string;
  required: boolean;
  enabledByDefault: boolean;
}

interface ConsentSettings {
  enabled: boolean;
  version: number;
  title: string;
  description: string;
  acceptAllLabel: string;
  rejectLabel: string;
  preferencesLabel: string;
  saveLabel: string;
  style: string;
  behavior: {
    requireExplicitChoice: boolean;
    blockAnalyticsUntilConsent: boolean;
    reopenOnVersionChange: boolean;
  };
  desktop: { position: string; compact: boolean };
  mobile: { position: string; compact: boolean };
  categories: ConsentCategory[];
}

const CATEGORIES_PER_PAGE = 4;

const DEFAULT_SETTINGS: ConsentSettings = {
  enabled: true,
  version: 1,
  title: "Usamos cookies para melhorar sua experiência",
  description: "Utilizamos cookies necessários e, com sua permissão, cookies de analytics e marketing.",
  acceptAllLabel: "Aceitar todos",
  rejectLabel: "Recusar opcionais",
  preferencesLabel: "Preferências",
  saveLabel: "Salvar preferências",
  style: "floating",
  behavior: { requireExplicitChoice: true, blockAnalyticsUntilConsent: true, reopenOnVersionChange: true },
  desktop: { position: "bottom-center", compact: true },
  mobile: { position: "bottom-sheet", compact: false },
  categories: [],
};

function ToggleField({
  label,
  checked,
  onChange,
  tooltip,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tooltip?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-[0_4px_12px_rgba(15,23,42,0.025)]", disabled && "cursor-not-allowed opacity-70")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
      <span className="inline-flex items-center gap-1.5">
        {label}
        {tooltip ? <DeveloperTooltip content={tooltip} /> : null}
      </span>
    </label>
  );
}

export default function CookiesPage() {
  const { apiRequest } = useApiRequest();
  const [form, setForm] = useState<ConsentSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const notify = useDeveloperNotifier();
  const [categoryPage, setCategoryPage] = useState(0);
  const [previewRevision, setPreviewRevision] = useState(0);

  const { data, loading, error, refresh } = useAdminResource<ConsentSettings>({
    key: adminResourceKeys.consent,
    fetcher: async (request) => {
      const response = await request<{ settings?: ConsentSettings }>(api.admin.consentSettings);
      return response.success
        ? { success: true, data: { ...DEFAULT_SETTINGS, ...response.data?.settings } }
        : { success: false, error: response.error ?? "Falha ao carregar cookies." };
    },
  });

  useEffect(() => {
    if (data) setForm({ ...DEFAULT_SETTINGS, ...data });
  }, [data]);

  const categoryPageCount = Math.max(1, Math.ceil(form.categories.length / CATEGORIES_PER_PAGE));
  const visibleCategories = useMemo(
    () => form.categories.slice(categoryPage * CATEGORIES_PER_PAGE, (categoryPage + 1) * CATEGORIES_PER_PAGE),
    [categoryPage, form.categories]
  );

  useEffect(() => {
    setCategoryPage((current) => Math.min(current, categoryPageCount - 1));
  }, [categoryPageCount]);

  async function handleSave() {
    const requiredTexts = [
      form.title,
      form.description,
      form.acceptAllLabel,
      form.rejectLabel,
      form.preferencesLabel,
      form.saveLabel,
    ];
    const hasInvalidCategory = form.categories.some(
      (category) => !category.label.trim() || !category.description.trim()
    );
    if (
      requiredTexts.some((value) => !value.trim()) ||
      !Number.isInteger(form.version) ||
      form.version < 1 ||
      form.version > 999 ||
      hasInvalidCategory
    ) {
      notify({ tone: "error", text: "Preencha os textos obrigatórios, as categorias e uma versão entre 1 e 999." });
      return;
    }
    setSaving(true);
    notify(null);
    const response = await apiRequest(api.admin.consentSettings, { method: "POST", body: JSON.stringify(form) });
    setSaving(false);
    if (!response.success) {
      notify({ tone: "error", text: response.error ?? "Falha ao salvar LGPD/cookies." });
      return;
    }
    invalidateAdminResource([adminResourceKeys.consent, adminResourceKeys.dashboard]);
    notify({ tone: "success", text: "Configuração de LGPD/cookies salva com sucesso." });
    setPreviewRevision((revision) => revision + 1);
    await refresh();
  }

  function updateCategory(index: number, patch: Partial<ConsentCategory>) {
    setForm((current) => ({
      ...current,
      categories: current.categories.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="LGPD / Cookies"
        title="Consentimento claro em todos os dispositivos."
        description="Configure banner e categorias de cookies."
        stats={[
          { label: "Categorias", value: form.categories.length },
          { label: "Versão", value: form.version },
          { label: "Status", value: form.enabled ? "Ativo" : "Inativo" },
        ]}
      />

      {loading ? <div className="mt-5"><DeveloperMessage tone="info">Carregando configuração...</DeveloperMessage></div> : null}
      {error ? <div className="mt-5"><DeveloperMessage tone="error">{error}</DeveloperMessage></div> : null}

      <div className="mt-5">
        <DeveloperResponsivePreview href={site.home} title="Preview do consentimento" showConsent revision={previewRevision} />
      </div>

      <div className="mt-5 grid gap-5">
        <DeveloperCard className="border-[#bfdbfe] bg-[linear-gradient(135deg,rgba(239,246,255,0.94),rgba(255,255,255,0.96))] p-5 sm:p-6">
          <DeveloperSectionHeading eyebrow="Banner público" title="Mensagem e ações principais" description="Estes textos aparecem antes de qualquer escolha do visitante." />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px]">
            <DeveloperField label="Título" required>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className={developerInputClassName} />
            </DeveloperField>
            <DeveloperField label="Versão" required tooltip="Aumente ao mudar o texto, as categorias ou o comportamento do consentimento.">
              <input type="number" min={1} value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: Number(event.target.value) || 1 }))} className={developerInputClassName} />
            </DeveloperField>
          </div>
          <div className="mt-4"><DeveloperField label="Descrição" required><textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${developerInputClassName} resize-none`} /></DeveloperField></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["acceptAllLabel", "Aceitar todos"],
              ["rejectLabel", "Recusar opcionais"],
              ["preferencesLabel", "Abrir preferências"],
              ["saveLabel", "Salvar preferências"],
            ].map(([key, label]) => <DeveloperField key={key} label={label} required><input required value={String(form[key as keyof ConsentSettings] ?? "")} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className={developerInputClassName} /></DeveloperField>)}
          </div>
        </DeveloperCard>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <DeveloperCard className="p-5 sm:p-6">
            <DeveloperSectionHeading eyebrow="Regras de exibição" title="Quando e onde o banner aparece" description="As escolhas abaixo preservam o bloqueio de recursos opcionais até o consentimento." />
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleField label="Banner ativo" checked={form.enabled} onChange={(enabled) => setForm((current) => ({ ...current, enabled }))} tooltip="Liga ou desliga o banner no site público." />
              <ToggleField label="Exigir escolha" checked={form.behavior.requireExplicitChoice} onChange={(requireExplicitChoice) => setForm((current) => ({ ...current, behavior: { ...current.behavior, requireExplicitChoice } }))} tooltip="Mantém o banner até o visitante tomar uma decisão." />
              <ToggleField label="Bloquear analytics" checked disabled onChange={() => {}} tooltip="Regra obrigatória: analytics permanece bloqueado antes do consentimento compatível." />
              <ToggleField label="Reabrir por versão" checked={form.behavior.reopenOnVersionChange} onChange={(reopenOnVersionChange) => setForm((current) => ({ ...current, behavior: { ...current.behavior, reopenOnVersionChange } }))} tooltip="Exibe o banner novamente após atualizar a versão." />
            </div>
          </DeveloperCard>
          <DeveloperCard className="p-5 sm:p-6">
            <DeveloperSectionHeading eyebrow="Posicionamento" title="Desktop e mobile" description="O preview acima mostra os três breakpoints reais." />
            <div className="grid gap-4">
              <DeveloperField label="Posição no desktop" tooltip="O layout público usa a posição central responsiva."><select value="bottom-center" disabled className={`${developerInputClassName} cursor-not-allowed bg-slate-100`}><option value="bottom-center">Inferior centralizado</option></select></DeveloperField>
              <DeveloperField label="Posição no mobile"><select value={form.mobile.position} onChange={(event) => setForm((current) => ({ ...current, mobile: { ...current.mobile, position: event.target.value } }))} className={developerInputClassName}><option value="bottom-sheet">Painel inferior</option><option value="center-modal">Modal central</option></select></DeveloperField>
            </div>
          </DeveloperCard>
        </section>

        <DeveloperCard className="p-5 sm:p-6">
          <DeveloperSectionHeading eyebrow="Categorias" title="Tipos de cookies" description="O botão de preferências abre estas categorias em uma janela paginada no site público." action={
            <span className="rounded-full border border-[var(--primary)]/15 bg-[var(--primary)]/6 px-3 py-1.5 text-xs font-bold text-[var(--primary)]">{form.categories.length} cadastradas</span>
          } />
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleCategories.map((category, visibleIndex) => {
              const index = categoryPage * CATEGORIES_PER_PAGE + visibleIndex;
              return (
                <article key={`${category.key}-${index}`} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-[0_5px_14px_rgba(15,23,42,0.025)]">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--primary)]">Categoria {index + 1}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DeveloperField label="Nome" required><input required value={category.label} onChange={(event) => updateCategory(index, { label: event.target.value })} className={developerInputClassName} /></DeveloperField>
                    <DeveloperField label="Chave" tooltip="Identificador técnico fixo usado pelo site."><input value={category.key} readOnly aria-readonly="true" className={`${developerInputClassName} cursor-not-allowed bg-slate-100 text-slate-500`} /></DeveloperField>
                  </div>
                  <div className="mt-4"><DeveloperField label="Descrição" required><textarea required rows={2} value={category.description} onChange={(event) => updateCategory(index, { description: event.target.value })} className={`${developerInputClassName} resize-none`} /></DeveloperField></div>
                  <div className="mt-4 flex flex-wrap gap-3"><ToggleField label="Obrigatória" checked={category.required} disabled onChange={() => {}} tooltip="Somente a categoria necessária é obrigatória." /><ToggleField label="Ativa por padrão" checked={category.enabledByDefault} disabled onChange={() => {}} tooltip="Categorias opcionais exigem escolha explícita e não são pré-selecionadas." /></div>
                </article>
              );
            })}
          </div>
          {categoryPageCount > 1 ? <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-[var(--color-muted-raw)]">Exibindo categorias {categoryPage * CATEGORIES_PER_PAGE + 1}–{Math.min((categoryPage + 1) * CATEGORIES_PER_PAGE, form.categories.length)} de {form.categories.length}.</p><div className="flex gap-2"><button type="button" onClick={() => setCategoryPage((page) => Math.max(0, page - 1))} disabled={categoryPage === 0} className={cn(developerSecondaryButtonClassName, "min-h-9 px-3 py-1.5 text-xs")}><CaretLeft size={15} weight="bold" />Anterior</button><button type="button" onClick={() => setCategoryPage((page) => Math.min(categoryPageCount - 1, page + 1))} disabled={categoryPage === categoryPageCount - 1} className={cn(developerSecondaryButtonClassName, "min-h-9 px-3 py-1.5 text-xs")}>Próxima<CaretRight size={15} weight="bold" /></button></div></div> : null}
        </DeveloperCard>

        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-[18px] border border-slate-200 bg-white/95 p-3 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="px-1 text-sm text-[var(--color-muted-raw)]">Salve para atualizar o banner público e o preview real.</p>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={handleSave} disabled={saving} className={developerPrimaryButtonClassName}><CheckCircle size={18} weight="bold" />{saving ? "Salvando..." : "Salvar configuração"}</button><button type="button" onClick={() => void refresh()} className={developerSecondaryButtonClassName}><Pulse size={16} weight="bold" />Atualizar</button></div>
        </div>
      </div>
    </DeveloperPage>
  );
}
