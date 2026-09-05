"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUp,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useApiRequest } from "@/hooks/useApiRequest";
import { api, site } from "@/lib/routes";
import { DEFAULT_FOOTER_LINKS } from "@/lib/footerLinksDefaults";
import type {
  FooterActionCard,
  FooterGlobalContent,
  FooterLinkColumn,
  FooterLinkItem,
  FooterLinksContent,
  FooterLinksHelpContent,
  FooterLinksPrivacyContent,
  FooterLinksTermsContent,
  FooterSocialLink,
  FooterTextBlock,
  PageButton,
  PageFaqItem,
} from "@/types/content";
import {
  DeveloperCard,
  DeveloperField,
  DeveloperHero,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  developerGhostButtonClassName,
  developerInputClassName,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
} from "@/components/developer/ui";
import { DeveloperConfirmButton } from "@/components/developer/DeveloperConfirmButton";
import { DeveloperCmsAccordion } from "@/components/developer/DeveloperCmsAccordion";
import { DeveloperResponsivePreview } from "@/components/developer/DeveloperResponsivePreview";
import { cn } from "@/lib/utils";

type SectionKey = "footer" | "terms" | "help" | "privacy";
type FooterStepKey = "institutional" | "footer" | "social";

const FOOTER_STEPS = [
  {
    key: "institutional",
    step: "Etapa 1",
    title: "Páginas institucionais",
    description: "Termos de Uso, Central de Ajuda e Privacidade.",
  },
  {
    key: "footer",
    step: "Etapa 2",
    title: "Links gerais do footer",
    description: "Chamadas, colunas, links inferiores e horários.",
  },
  {
    key: "social",
    step: "Etapa 3",
    title: "Redes sociais",
    description: "Links externos e a identificação dos canais sociais.",
  },
] as const;

const SOCIAL_ICON_OPTIONS = [
  ["InstagramLogo", "Instagram"],
  ["LinkedinLogo", "LinkedIn"],
  ["FacebookLogo", "Facebook"],
  ["WhatsappLogo", "WhatsApp"],
] as const;

const HELP_ICON_OPTIONS = [
  ["Package", "Pacote"],
  ["ChatCircleDots", "Conversa"],
  ["ShieldCheck", "Privacidade"],
] as const;

function IconSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <DeveloperField label={label} required>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={developerInputClassName}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </DeveloperField>
  );
}

const panelClassName =
  "rounded-[22px] border border-[var(--border)]/80 bg-slate-50/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:p-5";
const priorityPanelClassName =
  "rounded-[22px] border border-[#93c5fd] bg-[linear-gradient(135deg,rgba(219,234,254,0.82)_0%,rgba(239,246,255,0.8)_54%,rgba(248,251,255,0.9)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(29,78,216,0.08)] ring-1 ring-[var(--primary)]/7 sm:p-5";
const mutedPanelClassName =
  "rounded-[22px] border border-slate-300/85 bg-slate-100/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5";
const ctaPanelClassName =
  "rounded-[22px] border border-[var(--primary)]/22 bg-[linear-gradient(135deg,rgba(219,234,254,0.66)_0%,rgba(255,255,255,0.94)_72%)] p-4 shadow-[0_12px_28px_rgba(29,78,216,0.1)] sm:p-5";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next.map((entry, orderIndex) => ({ ...(entry as object), order: orderIndex + 1 })) as T[];
}

function CountHint({ value, maxLength }: { value: string; maxLength: number }) {
  return (
    <span className="mt-1 block text-[11px] text-[var(--color-muted-raw)]">
      {String(value ?? "").length}/{maxLength} caracteres
    </span>
  );
}

function SaveButton({ saving, children }: { saving: boolean; children: string }) {
  return (
    <button type="submit" disabled={saving} className={developerPrimaryButtonClassName}>
      <CheckCircle size={18} weight="bold" />
      {saving ? "Salvando..." : children}
    </button>
  );
}

function TextInput({
  label,
  value,
  onChange,
  maxLength,
  textarea,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  textarea?: boolean;
  required?: boolean;
}) {
  return (
    <DeveloperField label={label} required={required}>
      {textarea ? (
        <textarea
          required={required}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          rows={3}
          className={`${developerInputClassName} resize-none`}
        />
      ) : (
        <input
          required={required}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          className={developerInputClassName}
        />
      )}
      <CountHint value={value ?? ""} maxLength={maxLength} />
    </DeveloperField>
  );
}

function ButtonFields({
  button,
  onChange,
  label = "Botão",
}: {
  button: PageButton;
  onChange: (button: PageButton) => void;
  label?: string;
}) {
  return (
    <div className={cn(mutedPanelClassName, "grid gap-5 md:grid-cols-2")}>
      <TextInput label={`${label} - texto`} value={button.label} maxLength={60} onChange={(value) => onChange({ ...button, label: value })} />
      <DeveloperField label={`${label} - link`} required>
        <input required value={button.url} onChange={(event) => onChange({ ...button, url: event.target.value })} className={developerInputClassName} />
      </DeveloperField>
    </div>
  );
}

function LinkItemFields({
  item,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  extra,
  nested = false,
}: {
  item: FooterLinkItem | FooterSocialLink;
  onChange: (item: FooterLinkItem | FooterSocialLink) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  extra?: ReactNode;
  nested?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DeveloperCmsAccordion
      items={[item]}
      openIndex={isOpen ? 0 : null}
      onOpenChange={(index) => setIsOpen(index === 0)}
      getEyebrow={() => nested ? "Link da coluna" : "Link do footer"}
      getTitle={(link) => link.label || "Link sem texto"}
      variant="services"
      compact
      renderActions={() => (
        <>
          <button type="button" data-cms-collection-action="up" onClick={onMoveUp} className={developerGhostButtonClassName}><ArrowUp size={16} weight="bold" />Subir</button>
          <button type="button" data-cms-collection-action="down" onClick={onMoveDown} className={developerGhostButtonClassName}><ArrowDown size={16} weight="bold" />Descer</button>
          <DeveloperConfirmButton actionType="remove" message="Este link será removido do rodapé." onConfirm={onRemove}><Trash size={16} weight="bold" />Remover</DeveloperConfirmButton>
        </>
      )}
      renderItem={(link) => (
        <div className={cn("grid gap-4", extra ? "lg:grid-cols-3" : "md:grid-cols-2")}>
          <TextInput label="Texto" value={link.label} maxLength={60} onChange={(value) => onChange({ ...link, label: value })} />
          <DeveloperField label="Link" required>
            <input required value={link.url} onChange={(event) => onChange({ ...link, url: event.target.value })} className={developerInputClassName} />
          </DeveloperField>
          {extra}
        </div>
      )}
    />
  );
}

function ServiceHoursEditor({
  title,
  hours,
  onTitleChange,
  onChange,
}: {
  title: string;
  hours: string[];
  onTitleChange: (title: string) => void;
  onChange: (hours: string[]) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function moveHour(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= hours.length) return;
    onChange(moveItem(hours, index, direction));
    if (openIndex === index) setOpenIndex(target);
  }

  function removeHour(index: number) {
    const nextHours = hours.filter((_, hourIndex) => hourIndex !== index);
    if (openIndex === index) setOpenIndex(nextHours.length ? Math.min(index, nextHours.length - 1) : null);
    else if (openIndex !== null && openIndex > index) setOpenIndex(openIndex - 1);
    onChange(nextHours);
  }

  return (
    <div className={cn(mutedPanelClassName, "space-y-4")}>
      <TextInput label="Título dos horários" value={title} maxLength={80} onChange={onTitleChange} />
      <DeveloperCmsAccordion
        items={hours}
        openIndex={openIndex}
        onOpenChange={setOpenIndex}
        getEyebrow={(_, index) => `Horário ${index + 1}`}
        getTitle={(hour, index) => hour || `Horário ${index + 1} sem texto`}
        variant="services"
        compact
        renderActions={(_, index) => (
          <>
            <button type="button" data-cms-collection-action="up" onClick={() => moveHour(index, -1)} className={developerGhostButtonClassName}><ArrowUp size={16} weight="bold" />Subir</button>
            <button type="button" data-cms-collection-action="down" onClick={() => moveHour(index, 1)} className={developerGhostButtonClassName}><ArrowDown size={16} weight="bold" />Descer</button>
            <DeveloperConfirmButton actionType="remove" message="Este horário será removido do rodapé." onConfirm={() => removeHour(index)}><Trash size={16} weight="bold" />Remover</DeveloperConfirmButton>
          </>
        )}
        renderItem={(hour, index) => <TextInput label={`Horário ${index + 1}`} value={hour} maxLength={220} onChange={(value) => {
          const nextHours = [...hours];
          nextHours[index] = value;
          onChange(nextHours);
        }} />}
      />
      {hours.length < 5 ? (
        <button type="button" onClick={() => { onChange([...hours, ""]); setOpenIndex(hours.length); }} className={developerSecondaryButtonClassName}>
          <Plus size={16} weight="bold" />
          Novo horário
        </button>
      ) : null}
    </div>
  );
}

function TextBlockEditor({
  blocks,
  onChange,
  max = 20,
  fixed = false,
  titleLabel = "Título",
  descriptionLabel = "Descrição",
}: {
  blocks: FooterTextBlock[];
  onChange: (blocks: FooterTextBlock[]) => void;
  max?: number;
  fixed?: boolean;
  titleLabel?: string;
  descriptionLabel?: string;
}) {
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const openIndex = openBlockId ? blocks.findIndex((block) => block.id === openBlockId) : null;

  function addBlock() {
    const block = { id: createId("footer-block"), order: blocks.length + 1, title: "", description: "" };
    onChange([...blocks, block]);
    setOpenBlockId(block.id);
  }

  function removeBlock(index: number) {
    const nextBlocks = blocks.filter((_, blockIndex) => blockIndex !== index);
    if (blocks[index]?.id === openBlockId) {
      setOpenBlockId(nextBlocks[index]?.id ?? nextBlocks[index - 1]?.id ?? null);
    }
    onChange(nextBlocks);
  }

  return (
    <div className="space-y-4">
      {!fixed && blocks.length < max ? (
        <button
          type="button"
          onClick={addBlock}
          className={developerSecondaryButtonClassName}
        >
          <Plus size={16} weight="bold" />
          Novo bloco
        </button>
      ) : null}
      <DeveloperCmsAccordion
        items={blocks}
        openIndex={openIndex === -1 ? null : openIndex}
        onOpenChange={(index) => setOpenBlockId(index === null ? null : blocks[index]?.id ?? null)}
        getEyebrow={(_, index) => `Bloco ${index + 1}`}
        getTitle={(block) => block.title || "Bloco sem título"}
        variant="services"
        compact
        renderActions={!fixed ? (_, index) => (
          <>
            <button type="button" data-cms-collection-action="up" onClick={() => onChange(moveItem(blocks, index, -1))} className={developerGhostButtonClassName}><ArrowUp size={16} weight="bold" />Subir</button>
            <button type="button" data-cms-collection-action="down" onClick={() => onChange(moveItem(blocks, index, 1))} className={developerGhostButtonClassName}><ArrowDown size={16} weight="bold" />Descer</button>
            <DeveloperConfirmButton actionType="remove" message="Este bloco será removido do rodapé." onConfirm={() => removeBlock(index)}><Trash size={16} weight="bold" />Remover</DeveloperConfirmButton>
          </>
        ) : undefined}
        renderItem={(block, index) => (
          <div className="grid gap-5 md:grid-cols-2">
            <TextInput label={titleLabel} value={block.title} maxLength={180} onChange={(value) => {
              const next = [...blocks];
              next[index] = { ...block, title: value };
              onChange(next);
            }} />
            <TextInput label={descriptionLabel} value={block.description} maxLength={700} textarea onChange={(value) => {
              const next = [...blocks];
              next[index] = { ...block, description: value };
              onChange(next);
            }} />
          </div>
        )}
      />
    </div>
  );
}

export default function FooterLinksCmsPage() {
  const { apiRequest } = useApiRequest();
  const [content, setContent] = useState<FooterLinksContent>(DEFAULT_FOOTER_LINKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SectionKey | "">("");
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [activeStep, setActiveStep] = useState<FooterStepKey>("institutional");
  const [previewRevision, setPreviewRevision] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const response = await apiRequest<{ footerLinks?: FooterLinksContent }>(api.admin.footerLinks);
      if (!alive) return;
      if (response.success) {
        setContent(response.data?.footerLinks ?? DEFAULT_FOOTER_LINKS);
        setStatus(null);
      } else {
        setStatus({ tone: "error", text: response.error ?? "Falha ao carregar FOOTER LINKS." });
      }
      setLoading(false);
    }

    void load();

    return () => {
      alive = false;
    };
  }, [apiRequest]);

  const stats = useMemo(
    () => [
      { label: "Colunas", value: content.footer.columns.length },
      { label: "FAQ", value: content.help.faq.items.length },
      { label: "Privacidade", value: content.privacy.dataSection.blocks.length },
    ],
    [content]
  );
  const activeStepIndex = Math.max(0, FOOTER_STEPS.findIndex((step) => step.key === activeStep));
  const activeStepInfo = FOOTER_STEPS[activeStepIndex] ?? FOOTER_STEPS[0];

  function selectStep(step: FooterStepKey) {
    setActiveStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function moveStep(direction: -1 | 1) {
    const nextStep = FOOTER_STEPS[activeStepIndex + direction];
    if (nextStep) selectStep(nextStep.key);
  }

  function update(mutator: (draft: FooterLinksContent) => void) {
    setContent((current) => {
      const next = clone(current);
      mutator(next);
      return next;
    });
  }

  async function saveSection(sectionKey: SectionKey, payload: FooterGlobalContent | FooterLinksTermsContent | FooterLinksHelpContent | FooterLinksPrivacyContent) {
    setSaving(sectionKey);
    setStatus(null);
    const response = await apiRequest<{ footerLinks?: FooterLinksContent }>(
      api.admin.footerLinksSection(sectionKey),
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    setSaving("");
    if (!response.success) {
      setStatus({ tone: "error", text: response.error ?? "Falha ao salvar seção." });
      return;
    }
    setContent(response.data?.footerLinks ?? content);
    setPreviewRevision((current) => current + 1);
    setStatus({ tone: "success", text: "FOOTER LINKS salvo com sucesso." });
  }

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="FOOTER LINKS"
        title="Links e páginas do rodapé."
        description="Controle do rodapé e páginas institucionais."
        stats={stats}
        actions={
          <a href={site.home} className={developerSecondaryButtonClassName}>
            <ArrowSquareOut size={16} weight="bold" />
            Ver site
          </a>
        }
      />

      {loading ? <div className="mt-5"><DeveloperMessage tone="info">Carregando...</DeveloperMessage></div> : null}
      {status ? <div className="mt-5"><DeveloperMessage tone={status.tone}>{status.text}</DeveloperMessage></div> : null}

      <div className="mt-5">
        <DeveloperResponsivePreview
          href={site.home}
          title="Preview do rodapé"
          anchor="contato"
          revision={previewRevision}
        />
      </div>

      <section className="mt-5 rounded-[24px] border border-[var(--primary)]/16 bg-[linear-gradient(135deg,rgba(219,234,254,0.9)_0%,rgba(239,246,255,0.86)_54%,rgba(224,242,254,0.78)_100%)] p-4 shadow-[0_12px_28px_rgba(29,78,216,0.08)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Edição por etapas
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[var(--foreground)]">
              {activeStepInfo.title}
            </h2>
            <p className="mt-1 max-w-[68ch] text-sm leading-5 text-[var(--color-muted-raw)]">
              {activeStepInfo.description}
            </p>
          </div>
          <div className="inline-flex w-fit items-center rounded-full border border-[var(--primary)]/14 bg-white/72 p-1 shadow-[0_8px_20px_rgba(29,78,216,0.07)]">
            <button
              type="button"
              onClick={() => moveStep(-1)}
              disabled={activeStepIndex === 0}
              className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CaretLeft size={16} weight="bold" />
              Anterior
            </button>
            <button
              type="button"
              onClick={() => moveStep(1)}
              disabled={activeStepIndex === FOOTER_STEPS.length - 1}
              className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próximo
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Selecionar etapa de edição do footer">
          {FOOTER_STEPS.map((step, index) => {
            const isActive = step.key === activeStep;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => selectStep(step.key)}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "group flex min-h-12 min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                  isActive
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_8px_18px_rgba(29,78,216,0.16)]"
                    : "border-[var(--primary)]/14 bg-white/58 text-[var(--foreground)] hover:border-[var(--primary)]/32 hover:bg-white/82"
                )}
              >
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", isActive ? "bg-white/18 text-white" : "bg-[var(--primary)]/8 text-[var(--primary)]")}>
                  {index + 1}
                </span>
                <span className="min-w-0 truncate text-sm font-semibold">{step.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-5 grid gap-5">
        {activeStep === "institutional" ? (
          <InstitutionalPagesStep
            content={content}
            onChange={(mutator) => update(mutator)}
            onSave={saveSection}
            saving={saving}
          />
        ) : null}
        {activeStep === "footer" ? (
          <FooterGlobalEditor
            footer={content.footer}
            onChange={(footer) => update((draft) => { draft.footer = footer; })}
            onSave={() => saveSection("footer", content.footer)}
            saving={saving === "footer"}
          />
        ) : null}
        {activeStep === "social" ? (
          <FooterSocialEditor
            footer={content.footer}
            onChange={(footer) => update((draft) => { draft.footer = footer; })}
            onSave={() => saveSection("footer", content.footer)}
            saving={saving === "footer"}
          />
        ) : null}
      </div>
    </DeveloperPage>
  );
}

function InstitutionalPagesStep({
  content,
  onChange,
  onSave,
  saving,
}: {
  content: FooterLinksContent;
  onChange: (mutator: (draft: FooterLinksContent) => void) => void;
  onSave: (sectionKey: SectionKey, payload: FooterGlobalContent | FooterLinksTermsContent | FooterLinksHelpContent | FooterLinksPrivacyContent) => void;
  saving: SectionKey | "";
}) {
  const items = [
    { key: "terms", eyebrow: "Termos de Uso", title: "Página /termos-de-uso" },
    { key: "help", eyebrow: "Central de Ajuda", title: "Página /central-ajuda" },
    { key: "privacy", eyebrow: "Privacidade", title: "Página /privacidade" },
  ] as const;
  const [activeItemKey, setActiveItemKey] = useState<(typeof items)[number]["key"]>("terms");
  const activeItemIndex = Math.max(0, items.findIndex((item) => item.key === activeItemKey));
  const activeItem = items[activeItemIndex] ?? items[0];

  function selectItem(index: number) {
    const next = items[index];
    if (next) setActiveItemKey(next.key);
  }

  function renderActiveEditor() {
    if (activeItem.key === "terms") {
      return (
        <TermsEditor
          embedded
          terms={content.terms}
          onChange={(terms) => onChange((draft) => { draft.terms = terms; })}
          onSave={() => onSave("terms", content.terms)}
          saving={saving === "terms"}
        />
      );
    }

    if (activeItem.key === "help") {
      return (
        <HelpEditor
          embedded
          help={content.help}
          onChange={(help) => onChange((draft) => { draft.help = help; })}
          onSave={() => onSave("help", content.help)}
          saving={saving === "help"}
        />
      );
    }

    return (
      <PrivacyEditor
        embedded
        privacy={content.privacy}
        onChange={(privacy) => onChange((draft) => { draft.privacy = privacy; })}
        onSave={() => onSave("privacy", content.privacy)}
        saving={saving === "privacy"}
      />
    );
  }

  return (
    <DeveloperCard className="p-4 sm:p-5">
      <DeveloperSectionHeading
        eyebrow="Etapa 1"
        title="Páginas institucionais"
        description="Edite as páginas acessadas pelo rodapé sem deixar todos os campos abertos ao mesmo tempo."
      />
      <div className="mt-4 flex items-center gap-2 rounded-[18px] border border-[var(--primary)]/14 bg-[var(--primary)]/4 p-1.5">
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5" role="tablist" aria-label="Selecionar página institucional">
          {items.map((item, index) => {
            const isActive = item.key === activeItem.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectItem(index)}
                className={cn(
                  "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold transition-colors",
                  isActive
                    ? "bg-[var(--primary)] text-white shadow-[0_6px_14px_rgba(29,78,216,0.18)]"
                    : "text-slate-600 hover:bg-white hover:text-[var(--primary)]"
                )}
              >
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]", isActive ? "bg-white/18 text-white" : "bg-[var(--primary)]/8 text-[var(--primary)]")}>{index + 1}</span>
                <span className="truncate">{item.eyebrow}</span>
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => selectItem(activeItemIndex - 1)}
            disabled={activeItemIndex === 0}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-white hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Página institucional anterior"
          >
            <CaretLeft size={18} weight="bold" />
          </button>
          <span className="min-w-9 text-center text-xs font-bold tabular-nums text-slate-500">{activeItemIndex + 1}/{items.length}</span>
          <button
            type="button"
            onClick={() => selectItem(activeItemIndex + 1)}
            disabled={activeItemIndex === items.length - 1}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-white hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Próxima página institucional"
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>
      <div className="mt-4">{renderActiveEditor()}</div>
    </DeveloperCard>
  );
}

function FooterGlobalEditor({
  footer,
  onChange,
  onSave,
  saving,
}: {
  footer: FooterGlobalContent;
  onChange: (footer: FooterGlobalContent) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [openColumnId, setOpenColumnId] = useState<string | null>(null);
  const openColumnIndex = openColumnId ? footer.columns.findIndex((column) => column.id === openColumnId) : null;

  function updateColumn(index: number, column: FooterLinkColumn) {
    const columns = [...footer.columns];
    columns[index] = column;
    onChange({ ...footer, columns });
  }

  function removeColumn(index: number) {
    const nextColumns = footer.columns.filter((_, columnIndex) => columnIndex !== index);
    if (footer.columns[index]?.id === openColumnId) {
      setOpenColumnId(nextColumns[index]?.id ?? nextColumns[index - 1]?.id ?? null);
    }
    onChange({ ...footer, columns: nextColumns });
  }

  return (
    <DeveloperCard className="p-5 sm:p-6">
      <DeveloperSectionHeading eyebrow="Etapa 2" title="Links gerais do footer" description="Chamadas, Sua Voz, links institucionais e horários." />
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <div className="space-y-5">
        <div className={cn(priorityPanelClassName, "grid gap-5 md:grid-cols-2")}>
          <TextInput label="Descrição" value={footer.description} maxLength={260} textarea onChange={(value) => onChange({ ...footer, description: value })} />
          <TextInput label="Texto de copyright" value={footer.copyrightText} maxLength={160} onChange={(value) => onChange({ ...footer, copyrightText: value })} />
          <TextInput label="Texto de localização" value={footer.locationText} maxLength={120} onChange={(value) => onChange({ ...footer, locationText: value })} />
          <TextInput label="Crédito" value={footer.creditText} maxLength={120} onChange={(value) => onChange({ ...footer, creditText: value })} />
          <DeveloperField label="Link do crédito" required>
            <input value={footer.creditUrl} onChange={(event) => onChange({ ...footer, creditUrl: event.target.value })} className={developerInputClassName} />
          </DeveloperField>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ButtonFields button={footer.proposalButton} label="Receber proposta" onChange={(button) => onChange({ ...footer, proposalButton: button })} />
          <ButtonFields button={footer.supportButton} label="Falar com atendimento" onChange={(button) => onChange({ ...footer, supportButton: button })} />
        </div>

        <DeveloperSectionHeading
          title="Colunas de links"
          action={
            <button type="button" onClick={() => onChange({ ...footer, columns: [...footer.columns, { id: createId("footer-column"), order: footer.columns.length + 1, title: "Nova coluna", links: [] }] })} className={developerSecondaryButtonClassName}>
              <Plus size={16} weight="bold" />
              Nova coluna
            </button>
          }
        />
        <DeveloperCmsAccordion
          items={footer.columns}
          openIndex={openColumnIndex === -1 ? null : openColumnIndex}
          onOpenChange={(index) => setOpenColumnId(index === null ? null : footer.columns[index]?.id ?? null)}
          getEyebrow={(_, index) => `Coluna ${index + 1}`}
          getTitle={(column) => column.title || "Coluna sem título"}
          variant="services"
          compact
          renderActions={(_: FooterLinkColumn, columnIndex: number) => (
            <>
              <button type="button" data-cms-collection-action="up" onClick={() => onChange({ ...footer, columns: moveItem(footer.columns, columnIndex, -1) })} className={developerGhostButtonClassName}><ArrowUp size={16} weight="bold" />Subir</button>
              <button type="button" data-cms-collection-action="down" onClick={() => onChange({ ...footer, columns: moveItem(footer.columns, columnIndex, 1) })} className={developerGhostButtonClassName}><ArrowDown size={16} weight="bold" />Descer</button>
              <DeveloperConfirmButton actionType="remove" message="Esta coluna será removida do rodapé." onConfirm={() => removeColumn(columnIndex)}><Trash size={16} weight="bold" />Remover</DeveloperConfirmButton>
            </>
          )}
          renderItem={(column: FooterLinkColumn, columnIndex: number) => (
            <div className="space-y-4">
              <TextInput label="Título da coluna" value={column.title} maxLength={80} onChange={(value) => updateColumn(columnIndex, { ...column, title: value })} />
              <button type="button" onClick={() => updateColumn(columnIndex, { ...column, links: [...column.links, { id: createId("footer-link"), order: column.links.length + 1, label: "", url: site.home }] })} className={developerSecondaryButtonClassName}>
                <Plus size={16} weight="bold" />
                Novo link
              </button>
              {column.links.map((link, linkIndex) => (
                <LinkItemFields
                  key={link.id}
                  item={link}
                  nested
                  onChange={(item) => {
                    const links = [...column.links];
                    links[linkIndex] = item as FooterLinkItem;
                    updateColumn(columnIndex, { ...column, links });
                  }}
                  onMoveUp={() => updateColumn(columnIndex, { ...column, links: moveItem(column.links, linkIndex, -1) })}
                  onMoveDown={() => updateColumn(columnIndex, { ...column, links: moveItem(column.links, linkIndex, 1) })}
                  onRemove={() => updateColumn(columnIndex, { ...column, links: column.links.filter((_, index) => index !== linkIndex) })}
                />
              ))}
            </div>
          )}
        />

        <DeveloperSectionHeading
          title="Links inferiores"
          action={
            <button type="button" onClick={() => onChange({ ...footer, bottomLinks: [...footer.bottomLinks, { id: createId("footer-bottom-link"), order: footer.bottomLinks.length + 1, label: "", url: site.home }] })} className={developerSecondaryButtonClassName}>
              <Plus size={16} weight="bold" />
              Novo link inferior
            </button>
          }
        />
        {footer.bottomLinks.map((link, index) => (
          <LinkItemFields
            key={link.id}
            item={link}
            onChange={(item) => {
              const bottomLinks = [...footer.bottomLinks];
              bottomLinks[index] = item as FooterLinkItem;
              onChange({ ...footer, bottomLinks });
            }}
            onMoveUp={() => onChange({ ...footer, bottomLinks: moveItem(footer.bottomLinks, index, -1) })}
            onMoveDown={() => onChange({ ...footer, bottomLinks: moveItem(footer.bottomLinks, index, 1) })}
            onRemove={() => onChange({ ...footer, bottomLinks: footer.bottomLinks.filter((_, itemIndex) => itemIndex !== index) })}
          />
        ))}

        <ServiceHoursEditor
          title={footer.serviceHoursTitle}
          hours={footer.serviceHours}
          onTitleChange={(serviceHoursTitle) => onChange({ ...footer, serviceHoursTitle })}
          onChange={(serviceHours) => onChange({ ...footer, serviceHours })}
        />

        {false ? (
        <div className={cn(panelClassName, "space-y-4")}>
          <TextInput label="Título das redes sociais" value={footer.socialTitle} maxLength={80} onChange={(value) => onChange({ ...footer, socialTitle: value })} />
          <button type="button" onClick={() => onChange({ ...footer, socialLinks: [...footer.socialLinks, { id: createId("social-link"), order: footer.socialLinks.length + 1, icon: "InstagramLogo", label: "", url: "#" }] })} className={developerSecondaryButtonClassName}>
            <Plus size={16} weight="bold" />
            Nova rede
          </button>
          {footer.socialLinks.map((link, index) => (
            <LinkItemFields
              key={link.id}
              item={link}
              onChange={(item) => {
                const socialLinks = [...footer.socialLinks];
                socialLinks[index] = item as FooterSocialLink;
                onChange({ ...footer, socialLinks });
              }}
              onMoveUp={() => onChange({ ...footer, socialLinks: moveItem(footer.socialLinks, index, -1) })}
              onMoveDown={() => onChange({ ...footer, socialLinks: moveItem(footer.socialLinks, index, 1) })}
              onRemove={() => onChange({ ...footer, socialLinks: footer.socialLinks.filter((_, itemIndex) => itemIndex !== index) })}
              extra={
                <IconSelect label="Ícone" value={link.icon} options={SOCIAL_ICON_OPTIONS} onChange={(value) => {
                  const socialLinks = [...footer.socialLinks];
                  socialLinks[index] = { ...link, icon: value };
                  onChange({ ...footer, socialLinks });
                }} />
              }
            />
          ))}
        </div>
        ) : null}
        </div>

        <SaveButton saving={saving}>Salvar links gerais</SaveButton>
      </form>
    </DeveloperCard>
  );
}

function FooterSocialEditor({
  footer,
  onChange,
  onSave,
  saving,
}: {
  footer: FooterGlobalContent;
  onChange: (footer: FooterGlobalContent) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <DeveloperCard className="p-5 sm:p-6">
      <DeveloperSectionHeading
        eyebrow="Etapa 3"
        title="Redes sociais"
        description="Controle os links externos do footer em uma área própria."
      />
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <div className={cn(priorityPanelClassName, "space-y-4")}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <TextInput label="Título das redes sociais" value={footer.socialTitle} maxLength={80} onChange={(value) => onChange({ ...footer, socialTitle: value })} />
              <button type="button" onClick={() => onChange({ ...footer, socialLinks: [...footer.socialLinks, { id: createId("social-link"), order: footer.socialLinks.length + 1, icon: "InstagramLogo", label: "", url: "#" }] })} className={developerSecondaryButtonClassName}>
                <Plus size={16} weight="bold" />
                Nova rede
              </button>
          </div>
              {footer.socialLinks.map((link, index) => (
                <LinkItemFields
                  key={link.id}
                  item={link}
                  onChange={(item) => {
                    const socialLinks = [...footer.socialLinks];
                    socialLinks[index] = item as FooterSocialLink;
                    onChange({ ...footer, socialLinks });
                  }}
                  onMoveUp={() => onChange({ ...footer, socialLinks: moveItem(footer.socialLinks, index, -1) })}
                  onMoveDown={() => onChange({ ...footer, socialLinks: moveItem(footer.socialLinks, index, 1) })}
                  onRemove={() => onChange({ ...footer, socialLinks: footer.socialLinks.filter((_, itemIndex) => itemIndex !== index) })}
                  extra={
                    <IconSelect label="Ícone" value={link.icon} options={SOCIAL_ICON_OPTIONS} onChange={(value) => {
                      const socialLinks = [...footer.socialLinks];
                      socialLinks[index] = { ...link, icon: value };
                      onChange({ ...footer, socialLinks });
                    }} />
                  }
                />
              ))}
        </div>
        <SaveButton saving={saving}>Salvar redes sociais</SaveButton>
      </form>
    </DeveloperCard>
  );
}

function EditorShell({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  if (embedded) {
    return <div className="space-y-5">{children}</div>;
  }

  return <DeveloperCard className="p-5 sm:p-6">{children}</DeveloperCard>;
}

function TermsEditor({
  terms,
  onChange,
  onSave,
  saving,
  embedded = false,
}: {
  terms: FooterLinksTermsContent;
  onChange: (terms: FooterLinksTermsContent) => void;
  onSave: () => void;
  saving: boolean;
  embedded?: boolean;
}) {
  return (
    <EditorShell embedded={embedded}>
      <DeveloperSectionHeading eyebrow="Termos de Uso" title="Página /termos-de-uso" />
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <HeroFields hero={terms.hero} onChange={(hero) => onChange({ ...terms, hero })} />
        <div className={cn(ctaPanelClassName, "grid gap-5 md:grid-cols-2")}>
          <TextInput label="Eyebrow do resumo" value={terms.summary.eyebrow} maxLength={80} onChange={(value) => onChange({ ...terms, summary: { ...terms.summary, eyebrow: value } })} />
          <TextInput label="Título do resumo" value={terms.summary.title} maxLength={180} onChange={(value) => onChange({ ...terms, summary: { ...terms.summary, title: value } })} />
          <TextInput label="Descrição do resumo" value={terms.summary.description} maxLength={260} textarea onChange={(value) => onChange({ ...terms, summary: { ...terms.summary, description: value } })} />
          <TextInput label="Texto de apoio" value={terms.summary.body} maxLength={500} textarea onChange={(value) => onChange({ ...terms, summary: { ...terms.summary, body: value } })} />
        </div>
        <ButtonFields button={terms.summary.button} label="Botão da primeira seção" onChange={(button) => onChange({ ...terms, summary: { ...terms.summary, button } })} />
        <SectionHeaderFields section={terms.reading} onChange={(reading) => onChange({ ...terms, reading: { ...terms.reading, ...reading } })} />
        <TextBlockEditor blocks={terms.reading.blocks} onChange={(blocks) => onChange({ ...terms, reading: { ...terms.reading, blocks } })} />
        <FinalCtaFields finalCta={terms.finalCta} onChange={(finalCta) => onChange({ ...terms, finalCta })} />
        <SaveButton saving={saving}>Salvar Termos</SaveButton>
      </form>
    </EditorShell>
  );
}

function HelpEditor({
  help,
  onChange,
  onSave,
  saving,
  embedded = false,
}: {
  help: FooterLinksHelpContent;
  onChange: (help: FooterLinksHelpContent) => void;
  onSave: () => void;
  saving: boolean;
  embedded?: boolean;
}) {
  return (
    <EditorShell embedded={embedded}>
      <DeveloperSectionHeading eyebrow="Central de Ajuda" title="Página /central-ajuda" />
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <HeroFields hero={help.hero} onChange={(hero) => onChange({ ...help, hero: { ...help.hero, ...hero } })} buttons onButtonsChange={(buttons) => onChange({ ...help, hero: { ...help.hero, buttons } })} />
        <SectionHeaderFields section={help.quickAccess} onChange={(quickAccess) => onChange({ ...help, quickAccess: { ...help.quickAccess, ...quickAccess } })} />
        {help.quickAccess.actions.map((action, index) => (
          <ActionCardFields
            key={action.id}
            action={action}
            label={`Ação rápida ${index + 1}`}
            onChange={(nextAction) => {
              const actions = [...help.quickAccess.actions];
              actions[index] = nextAction;
              onChange({ ...help, quickAccess: { ...help.quickAccess, actions } });
            }}
            onMoveUp={() => onChange({ ...help, quickAccess: { ...help.quickAccess, actions: moveItem(help.quickAccess.actions, index, -1) } })}
            onMoveDown={() => onChange({ ...help, quickAccess: { ...help.quickAccess, actions: moveItem(help.quickAccess.actions, index, 1) } })}
          />
        ))}
        <div className={cn(mutedPanelClassName, "grid gap-5 md:grid-cols-2")}>
          <TextInput label="Telefone" value={help.contactCard.phone} maxLength={80} onChange={(value) => onChange({ ...help, contactCard: { ...help.contactCard, phone: value } })} />
          <TextInput label="Horário" value={help.contactCard.hours} maxLength={180} onChange={(value) => onChange({ ...help, contactCard: { ...help.contactCard, hours: value } })} />
          {help.contactCard.channelDescriptions.slice(0, 3).map((description, index) => (
            <TextInput key={index} label={`Descrição de canal ${index + 1}`} value={description} maxLength={220} textarea onChange={(value) => {
              const channelDescriptions = [...help.contactCard.channelDescriptions];
              channelDescriptions[index] = value;
              onChange({ ...help, contactCard: { ...help.contactCard, channelDescriptions } });
            }} />
          ))}
        </div>
        <SectionHeaderFields section={help.faq} onChange={(faq) => onChange({ ...help, faq: { ...help.faq, ...faq } })} />
        <FaqEditor items={help.faq.items} onChange={(items) => onChange({ ...help, faq: { ...help.faq, items } })} />
        <div className={cn(ctaPanelClassName, "grid gap-5 md:grid-cols-2")}>
          <TextInput label="Eyebrow do suporte final" value={help.finalSupport.eyebrow} maxLength={80} onChange={(value) => onChange({ ...help, finalSupport: { ...help.finalSupport, eyebrow: value } })} />
          <TextInput label="Título do suporte final" value={help.finalSupport.title} maxLength={180} onChange={(value) => onChange({ ...help, finalSupport: { ...help.finalSupport, title: value } })} />
          <TextInput label="Descrição do suporte final" value={help.finalSupport.description} maxLength={260} textarea onChange={(value) => onChange({ ...help, finalSupport: { ...help.finalSupport, description: value } })} />
        </div>
        <ButtonFields button={help.finalSupport.button} label="Botão de suporte" onChange={(button) => onChange({ ...help, finalSupport: { ...help.finalSupport, button } })} />
        <SaveButton saving={saving}>Salvar Central de Ajuda</SaveButton>
      </form>
    </EditorShell>
  );
}

function PrivacyEditor({
  privacy,
  onChange,
  onSave,
  saving,
  embedded = false,
}: {
  privacy: FooterLinksPrivacyContent;
  onChange: (privacy: FooterLinksPrivacyContent) => void;
  onSave: () => void;
  saving: boolean;
  embedded?: boolean;
}) {
  return (
    <EditorShell embedded={embedded}>
      <DeveloperSectionHeading eyebrow="Privacidade" title="Página /privacidade" />
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <HeroFields hero={privacy.hero} onChange={(hero) => onChange({ ...privacy, hero: { ...privacy.hero, ...hero } })} button={privacy.hero.button} buttonLabel="Botão de acesso aos termos" onButtonChange={(button) => onChange({ ...privacy, hero: { ...privacy.hero, button } })} />
        <SectionHeaderFields section={privacy.dataSection} onChange={(dataSection) => onChange({ ...privacy, dataSection: { ...privacy.dataSection, ...dataSection } })} />
        <TextBlockEditor blocks={privacy.dataSection.blocks} max={5} onChange={(blocks) => onChange({ ...privacy, dataSection: { ...privacy.dataSection, blocks } })} />
        <FinalCtaFields finalCta={privacy.finalCta} onChange={(finalCta) => onChange({ ...privacy, finalCta })} />
        <SaveButton saving={saving}>Salvar Privacidade</SaveButton>
      </form>
    </EditorShell>
  );
}

function HeroFields({
  hero,
  onChange,
  button,
  buttonLabel = "Botão do hero",
  onButtonChange,
  buttons,
  onButtonsChange,
}: {
  hero: { eyebrow: string; titleHighlight: string; titleRest: string; description: string };
  onChange: (hero: { eyebrow: string; titleHighlight: string; titleRest: string; description: string }) => void;
  button?: PageButton;
  buttonLabel?: string;
  onButtonChange?: (button: PageButton) => void;
  buttons?: boolean;
  onButtonsChange?: (buttons: PageButton[]) => void;
}) {
  const heroButtons = "buttons" in hero ? (hero as { buttons?: PageButton[] }).buttons ?? [] : [];
  return (
    <div className="space-y-5">
      <div className={cn(priorityPanelClassName, "grid gap-5 md:grid-cols-2")}>
        <TextInput label="Eyebrow" value={hero.eyebrow} maxLength={80} onChange={(value) => onChange({ ...hero, eyebrow: value })} />
        <TextInput label="Título em destaque" value={hero.titleHighlight} maxLength={90} onChange={(value) => onChange({ ...hero, titleHighlight: value })} />
        <TextInput label="Título complementar" value={hero.titleRest} maxLength={90} onChange={(value) => onChange({ ...hero, titleRest: value })} />
        <TextInput label="Descrição" value={hero.description} maxLength={260} textarea onChange={(value) => onChange({ ...hero, description: value })} />
      </div>
      {button && onButtonChange ? <ButtonFields button={button} label={buttonLabel} onChange={onButtonChange} /> : null}
      {buttons && onButtonsChange ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {heroButtons.slice(0, 2).map((item, index) => (
            <ButtonFields
              key={index}
              button={item}
              label={`Botão do hero ${index + 1}`}
              onChange={(nextButton) => {
                const next = [...heroButtons];
                next[index] = nextButton;
                onButtonsChange(next);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeaderFields({
  section,
  onChange,
}: {
  section: { eyebrow: string; title: string; description: string };
  onChange: (section: { eyebrow: string; title: string; description: string }) => void;
}) {
  return (
    <div className={cn(mutedPanelClassName, "grid gap-5 md:grid-cols-3")}>
      <TextInput label="Eyebrow" value={section.eyebrow} maxLength={80} onChange={(value) => onChange({ ...section, eyebrow: value })} />
      <TextInput label="Título" value={section.title} maxLength={220} onChange={(value) => onChange({ ...section, title: value })} />
      <TextInput label="Descrição" value={section.description} maxLength={280} textarea onChange={(value) => onChange({ ...section, description: value })} />
    </div>
  );
}

function FinalCtaFields({
  finalCta,
  onChange,
}: {
  finalCta: { title: string; description: string; buttons: PageButton[] };
  onChange: (finalCta: { title: string; description: string; buttons: PageButton[] }) => void;
}) {
  return (
    <div className="space-y-5">
      <div className={cn(ctaPanelClassName, "grid gap-5 md:grid-cols-2")}>
        <TextInput label="Título CTA final" value={finalCta.title} maxLength={180} onChange={(value) => onChange({ ...finalCta, title: value })} />
        <TextInput label="Descrição CTA final" value={finalCta.description} maxLength={320} textarea onChange={(value) => onChange({ ...finalCta, description: value })} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {finalCta.buttons.slice(0, 2).map((button, index) => (
          <ButtonFields
            key={index}
            button={button}
            label={`Botão final ${index + 1}`}
            onChange={(nextButton) => {
              const buttons = [...finalCta.buttons];
              buttons[index] = nextButton;
              onChange({ ...finalCta, buttons });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ActionCardFields({
  action,
  label,
  onChange,
  onMoveUp,
  onMoveDown,
}: {
  action: FooterActionCard;
  label: string;
  onChange: (action: FooterActionCard) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DeveloperCmsAccordion
      items={[action]}
      openIndex={isOpen ? 0 : null}
      onOpenChange={(index) => setIsOpen(index === 0)}
      getEyebrow={() => label}
      getTitle={(item) => item.title || "Ação rápida sem título"}
      variant="services"
      compact
      renderActions={() => (
        <>
          <button type="button" data-cms-collection-action="up" onClick={onMoveUp} className={developerGhostButtonClassName}><ArrowUp size={16} weight="bold" />Subir</button>
          <button type="button" data-cms-collection-action="down" onClick={onMoveDown} className={developerGhostButtonClassName}><ArrowDown size={16} weight="bold" />Descer</button>
        </>
      )}
      renderItem={(item) => (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-3">
            <IconSelect label="Ícone" value={item.icon} options={HELP_ICON_OPTIONS} onChange={(value) => onChange({ ...item, icon: value })} />
            <TextInput label="Título" value={item.title} maxLength={180} onChange={(value) => onChange({ ...item, title: value })} />
            <TextInput label="Descrição" value={item.description} maxLength={260} textarea onChange={(value) => onChange({ ...item, description: value })} />
          </div>
          <ButtonFields button={item.button} label="Botão" onChange={(button) => onChange({ ...item, button })} />
        </div>
      )}
    />
  );
}

function FaqEditor({
  items,
  onChange,
}: {
  items: PageFaqItem[];
  onChange: (items: PageFaqItem[]) => void;
}) {
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const openIndex = openFaqId ? items.findIndex((item) => item.id === openFaqId) : null;

  return (
    <DeveloperCmsAccordion
      items={items}
      openIndex={openIndex === -1 ? null : openIndex}
      onOpenChange={(index) => setOpenFaqId(index === null ? null : items[index]?.id ?? null)}
      getEyebrow={(_, index) => `Pergunta ${index + 1}`}
      getTitle={(item) => item.question || "Pergunta sem texto"}
      variant="services"
      compact
      renderActions={(_, index) => (
        <>
          <button type="button" data-cms-collection-action="up" onClick={() => onChange(moveItem(items, index, -1))} className={developerGhostButtonClassName}><ArrowUp size={16} weight="bold" />Subir</button>
          <button type="button" data-cms-collection-action="down" onClick={() => onChange(moveItem(items, index, 1))} className={developerGhostButtonClassName}><ArrowDown size={16} weight="bold" />Descer</button>
        </>
      )}
      renderItem={(item, index) => (
        <div className="grid gap-5 md:grid-cols-2">
          <TextInput label="Pergunta" value={item.question} maxLength={180} onChange={(value) => {
            const next = [...items];
            next[index] = { ...item, question: value };
            onChange(next);
          }} />
          <TextInput label="Resposta" value={item.answer} maxLength={320} textarea onChange={(value) => {
            const next = [...items];
            next[index] = { ...item, answer: value };
            onChange(next);
          }} />
        </div>
      )}
    />
  );
}
