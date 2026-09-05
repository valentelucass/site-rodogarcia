"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowsIn, ArrowsOut, Desktop, DeviceMobile, PencilSimple, Plus, Rectangle, SquaresFour, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { DeveloperHelp } from "./ui";
import { MediaPlacementEditor } from "./MediaPlacementEditor";
import { type CampaignV1SectionKey, type CampaignV1Sections } from "./landing-templates/CampaignV1SectionsEditor";
import { CAMPAIGN_V1_EDIT_TARGETS, CampaignV1FocusedSectionEditor, campaignV1EditTargetTitle, type CampaignV1EditTarget } from "./landing-templates/CampaignV1FocusedSectionEditor";
import { CampaignV1CoverageMap } from "./landing-templates/CampaignV1CoverageMap";

type EditorDialog = "theme" | "contacts" | "logo" | "background" | "hero-copy" | "hero-cta" | "highlights" | CampaignV1EditTarget | null;

type LandingPreview = CampaignV1Sections & {
  theme: { primaryColor: string; secondaryColor: string; backgroundColor: string; textColor: string };
  hero: {
    phone: string;
    email: string;
    logo: string;
    backgroundImage: string;
    backgroundPresentation?: import("@shared/types/media").ResponsiveMediaPresentation;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel: string;
    ctaUrl: string;
    highlights: Array<{ title: string; description: string }>;
  };
};

export type LandingMedia = {
  id: string;
  url: string;
  kind: "image" | "video" | string;
  alt?: string;
  poster?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  createdAt: string;
};

type MediaSlot = "logo" | "background";
type PreviewMode = "desktop" | "tablet" | "mobile" | "compare";
type IndividualPreviewMode = Exclude<PreviewMode, "compare">;
type LandingTheme = LandingPreview["theme"];
type ThemeColorKey = keyof LandingTheme;
type PreviewSectionKey = "hero" | CampaignV1SectionKey | "footer";
type ScrollSnapshot = {
  container: HTMLElement | null;
  previewContainers: Array<{ element: HTMLElement; top: number; left: number }>;
  top: number;
  left: number;
  windowX: number;
  windowY: number;
  overflowY: string;
  overscrollBehavior: string;
};

const PREVIEW_VIEWPORTS = [
  { key: "desktop", label: "Desktop", dimensions: "1440 px", icon: Desktop, widthClass: "w-full" },
  { key: "tablet", label: "Tablet", dimensions: "768 px", icon: Rectangle, widthClass: "w-[768px] max-w-full" },
  { key: "mobile", label: "Mobile", dimensions: "390 px", icon: DeviceMobile, widthClass: "w-[360px] max-w-full" },
] as const satisfies ReadonlyArray<{ key: IndividualPreviewMode; label: string; dimensions: string; icon: typeof Desktop; widthClass: string }>;

const PREVIEW_SECTION_NAV: ReadonlyArray<{ key: PreviewSectionKey; label: string }> = [
  { key: "hero", label: "Hero" },
  { key: "lowerSection", label: "Cobertura B2B" },
  { key: "benefits", label: "Serviços" },
  { key: "metrics", label: "Números" },
  { key: "story", label: "Imagem e conteúdo" },
  { key: "showcase", label: "Soluções" },
  { key: "testimonial", label: "Feedbacks" },
  { key: "faq", label: "FAQ" },
  { key: "finalCta", label: "CTA final" },
  { key: "footer", label: "Rodapé" },
];

const inputClass = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10";

const dialogTitle: Record<Exclude<EditorDialog, null>, string> = {
  theme: "Cores da landing",
  contacts: "Faixa de contatos",
  logo: "Logo",
  background: "Foto de fundo",
  "hero-copy": "Mensagem do Hero",
  "hero-cta": "Botão do Hero",
  highlights: "Informações em destaque",
  ...campaignV1EditTargetTitle,
};

const THEME_COLOR_FIELDS: ReadonlyArray<{ key: ThemeColorKey; label: string; description: string }> = [
  { key: "primaryColor", label: "Cor dos detalhes", description: "Botões, links e pontos de destaque." },
  { key: "secondaryColor", label: "Cor de apoio", description: "Elementos secundários e variações visuais." },
  { key: "backgroundColor", label: "Fundo", description: "Base das seções claras da landing." },
  { key: "textColor", label: "Texto", description: "Títulos e leitura principal." },
];

const THEME_PRESETS: ReadonlyArray<{ label: string; description: string; colors: LandingTheme }> = [
  { label: "Padrão", description: "Clara e neutra", colors: { primaryColor: "#111111", secondaryColor: "#2A2A2A", backgroundColor: "#FFFFFF", textColor: "#171717" } },
  { label: "Marinho", description: "Profissional", colors: { primaryColor: "#0F4C81", secondaryColor: "#38BDF8", backgroundColor: "#F8FAFC", textColor: "#0F172A" } },
  { label: "Grafite", description: "Sóbria", colors: { primaryColor: "#1E293B", secondaryColor: "#64748B", backgroundColor: "#F8FAFC", textColor: "#0F172A" } },
  { label: "Terracota", description: "Marcante", colors: { primaryColor: "#C2410C", secondaryColor: "#F97316", backgroundColor: "#FFF7ED", textColor: "#1C1917" } },
];

function isInternalMediaPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

function EditControl({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={`absolute z-20 inline-flex size-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-950 shadow-md transition hover:scale-105 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-4 focus:ring-slate-950/15 ${className}`}><PencilSimple size={15} weight="bold" /></button>;
}

function isCampaignV1EditDialog(dialog: EditorDialog): dialog is CampaignV1EditTarget {
  return typeof dialog === "string" && (CAMPAIGN_V1_EDIT_TARGETS as ReadonlyArray<string>).includes(dialog);
}

function primaryEditTarget(section: CampaignV1SectionKey): CampaignV1EditTarget {
  const targets: Record<CampaignV1SectionKey, CampaignV1EditTarget> = {
    lowerSection: "lowerSection:heading",
    benefits: "benefits:heading",
    metrics: "metrics:heading",
    story: "story:content",
    showcase: "showcase:content",
    testimonial: "testimonial:heading",
    faq: "faq:heading",
    finalCta: "finalCta:content",
  };
  return targets[section];
}

function LandingThemeEditor({ theme, onChange }: { theme: LandingTheme; onChange: (theme: LandingTheme) => void }) {
  function updateColor(key: ThemeColorKey, value: string) {
    onChange({ ...theme, [key]: value });
  }

  return <div className="space-y-6">
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Paleta da campanha</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Escolha uma paleta de partida ou personalize cada cor abaixo.</p>
        </div>
        <DeveloperHelp label="Cores da landing" templateKey="landing-pages.field.theme" />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {THEME_PRESETS.map((preset) => {
          const selected = THEME_COLOR_FIELDS.every(({ key }) => theme[key].toLowerCase() === preset.colors[key].toLowerCase());

          return <button key={preset.label} type="button" onClick={() => onChange(preset.colors)} aria-pressed={selected} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/25 ${selected ? "border-slate-950 bg-slate-950 text-white shadow-md" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"}`}>
            <span className="grid shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-black/10 shadow-sm">
              {THEME_COLOR_FIELDS.map(({ key }) => <span key={key} className="size-4" style={{ backgroundColor: preset.colors[key] }} />)}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-bold"><span>{preset.label}</span>{selected ? <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]">Em uso</span> : null}</span>
              <span className={`mt-0.5 block text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>{preset.description}</span>
            </span>
          </button>;
        })}
      </div>
    </section>

    <section className="border-t border-slate-200 pt-5">
      <p className="text-sm font-bold text-slate-900">Personalizar cores</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Clique em uma amostra para abrir o seletor de cor. O código hexadecimal acompanha a escolha.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {THEME_COLOR_FIELDS.map((field) => <label key={field.key} className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm focus-within:border-slate-950 focus-within:ring-2 focus-within:ring-slate-950/10">
          <input type="color" value={theme[field.key]} onChange={(event) => updateColor(field.key, event.target.value.toUpperCase())} className="sr-only" />
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-inner">
            <span className="size-full rounded-[9px] border border-black/10" style={{ backgroundColor: theme[field.key] }} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-800">{field.label}</span>
            <span className="mt-0.5 block text-xs leading-4 text-slate-500">{field.description}</span>
            <span className="mt-2 inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-700">{theme[field.key]}</span>
          </span>
        </label>)}
      </div>
    </section>
  </div>;
}

function LandingMediaPicker({
  slot,
  currentUrl,
  media,
  uploading,
  onSelect,
  onUpload,
  onDelete,
}: {
  slot: MediaSlot;
  currentUrl: string;
  media: LandingMedia[];
  uploading: boolean;
  onSelect: (url: string) => void;
  onUpload: (file: File, alt?: string) => Promise<void>;
  onDelete: (item: LandingMedia) => Promise<void>;
}) {
  const imageMedia = media.filter((item) => item.kind === "image");
  const label = slot === "logo" ? "logo" : "foto de fundo";
  const [alt, setAlt] = useState("");

  async function uploadSelectedFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await onUpload(file, alt);
    setAlt("");
  }

  return <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-800">Mídia própria da campanha</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Escolha um arquivo já enviado ou envie uma mídia para esta landing. Links externos não são aceitos. Vídeos só podem ser usados na seção Imagem e conteúdo.</p>
      <label className="mt-3 block text-xs font-semibold text-slate-700">Descrição da mídia (alt)<input value={alt} onChange={(event) => setAlt(event.target.value)} maxLength={160} placeholder="Descreva a imagem para leitores de tela" className={inputClass} /></label>
      <label className={`mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 ${uploading ? "cursor-wait opacity-60" : ""}`}>
        <UploadSimple size={17} weight="bold" />
        {uploading ? "Enviando..." : "Enviar mídia"}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm,video/ogg" disabled={uploading} onChange={(event) => void uploadSelectedFile(event)} className="sr-only" />
      </label>
    </div>

    {currentUrl && isInternalMediaPath(currentUrl) ? <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/[0.05] p-3">
      <p className="text-xs font-semibold text-[var(--foreground)]">Selecionado para {label}</p>
      <img src={currentUrl} alt="Mídia selecionada" className="mt-2 h-24 w-full rounded-lg border border-slate-200 bg-white object-contain" />
      <button type="button" onClick={() => onSelect("")} className="mt-2 text-xs font-bold text-[var(--primary)] hover:underline">Remover desta área</button>
    </div> : null}

    <div>
      <p className="text-sm font-semibold text-slate-800">Biblioteca da campanha</p>
      {imageMedia.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nenhuma imagem enviada para esta campanha ainda.</p> : <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
        {imageMedia.map((item) => {
          const selected = item.url === currentUrl;
          return <article key={item.id} className={`overflow-hidden rounded-xl border bg-white ${selected ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/15" : "border-slate-200"}`}>
            <button type="button" onClick={() => onSelect(item.url)} className="block w-full text-left" aria-pressed={selected}>
              <img src={item.url} alt={item.alt || "Imagem da campanha"} className="h-28 w-full bg-slate-100 object-cover" />
              <span className="block truncate px-2.5 py-2 text-xs font-semibold text-slate-700">{item.alt || "Imagem sem descrição"}</span>
            </button>
            <div className="flex items-center justify-between border-t border-slate-100 px-2.5 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{selected ? "Em uso" : "Selecionar"}</span>
              <button type="button" onClick={() => { if (window.confirm("Excluir este arquivo da biblioteca da campanha?")) void onDelete(item); }} className="inline-flex size-7 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50" aria-label={`Excluir ${item.alt || "imagem"}`} title="Excluir arquivo">
                <Trash size={15} weight="bold" />
              </button>
            </div>
          </article>;
        })}
      </div>}
    </div>
  </div>;
}

function CampaignPreviewSections({ landing, compact = false, viewport = "desktop", onEdit, idPrefix = "landing-preview" }: { landing: LandingPreview; compact?: boolean; viewport?: IndividualPreviewMode; onEdit?: (target: CampaignV1EditTarget) => void; idPrefix?: string }) {
  const { theme } = landing;
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(landing.faq.items.length > 0 ? 0 : null);
  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";
  const sectionPadding = compact ? "px-4 py-5" : isMobile ? "px-5 py-8" : isTablet ? "px-7 py-10" : "px-6 py-12 sm:px-10";
  const sectionDivider = "1px solid rgba(17,17,17,.16)";
  const eyebrowClass = compact ? "text-[7px]" : "text-[10px]";
  const titleClass = compact ? "mt-1 text-sm" : isMobile ? "mt-2 text-xl tracking-[-0.035em]" : isTablet ? "mt-2 text-2xl tracking-[-0.035em]" : "mt-2 text-2xl tracking-[-0.035em] sm:text-3xl";
  const bodyClass = compact ? "mt-2 text-[8px] leading-3" : "mt-4 text-sm leading-6 opacity-80";
  const compactButtonClass = "mt-3 inline-flex rounded-full px-3 py-1.5 text-[8px] font-bold";
  const buttonClass = "mt-6 inline-flex rounded-full px-5 py-3 text-xs font-bold";
  const lowerTopGridClass = compact || isMobile ? "grid gap-5" : "grid grid-cols-[minmax(0,1fr)_minmax(250px,.8fr)] items-center gap-8";
  const formGridClass = compact || !isMobile ? "grid-cols-2" : "grid-cols-1";
  const benefitsGridClass = compact ? "" : isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-4";
  const metricsGridClass = compact || isMobile ? "grid-cols-1" : "grid-cols-3";
  const feedbackGridClass = compact || isMobile ? "grid-cols-1" : "grid-cols-3";
  const showcaseBackgroundImage = isInternalMediaPath(landing.showcase.backgroundImage) ? landing.showcase.backgroundImage : "";
  const edit = (target: CampaignV1EditTarget, label: string, className = "right-3 top-3") => onEdit ? <EditControl label={label} onClick={() => onEdit(target)} className={className} /> : null;
  const sectionId = (key: PreviewSectionKey) => compact ? undefined : `${idPrefix}-${key}`;

  return <>
    {landing.lowerSection.visible ? <section id={sectionId("lowerSection")} className={`relative ${sectionPadding}`} style={{ borderTop: sectionDivider, color: theme.textColor, backgroundColor: "#ffffff" }}>
      <div className={`relative ${compact ? "mb-4 text-center" : "mx-auto mb-8 max-w-3xl text-center"}`}>
        {edit("lowerSection:heading", "Editar título e descrição da cobertura", "right-0 -top-2")}
        <p className={`${eyebrowClass} font-bold uppercase tracking-[0.16em]`} style={{ color: theme.primaryColor }}>Cobertura nacional</p>
        <h3 className={`${titleClass} mx-auto ${compact ? "max-w-[22ch]" : "max-w-[24ch]"} font-bold leading-tight uppercase`}>{landing.lowerSection.title || "Cobertura para a sua operação"}</h3>
        <p className={`${bodyClass} mx-auto ${compact ? "max-w-xl" : "max-w-2xl"}`}>{landing.lowerSection.description || "Apresente a capacidade da sua operação em todo o Brasil."}</p>
      </div>
      <div className={lowerTopGridClass}>
        <div className="relative">
          {edit("lowerSection:map", "Editar cores do mapa", "right-1 top-1")}
          <CampaignV1CoverageMap compact={compact} colors={{ baseColor: landing.lowerSection.mapBaseColor, branchColor: landing.lowerSection.mapBranchColor, borderColor: landing.lowerSection.mapBorderColor }} />
        </div>
        <div className={`relative ${compact ? "rounded-lg p-3 text-white" : "rounded-2xl p-6 text-white shadow-lg"}`} style={{ background: theme.secondaryColor }}>
          {edit("lowerSection:form", "Editar formulário B2B", "right-3 top-3")}
          <h4 className={compact ? "text-[10px] font-bold uppercase leading-3" : "text-xl font-bold uppercase leading-tight"}>{landing.lowerSection.formTitle || "Fale com um especialista em logística B2B"}</h4>
          <p className={compact ? "mt-2 text-[7px] leading-3 text-white/75" : "mt-3 text-xs leading-5 text-white/75"}>{landing.lowerSection.formDescription || "Preencha seus dados para receber uma solução personalizada."}</p>
          <div className={`mt-3 grid gap-2 ${formGridClass}`}>{["Nome", "E-mail", "Telefone", "CNPJ", "Local da empresa", "Localização desejada"].map((field) => <span key={field} className={compact ? "rounded bg-white px-2 py-1.5 text-[7px] text-slate-500" : "rounded-lg bg-white px-3 py-2.5 text-xs text-slate-500"}>{field}</span>)}</div>
          <span className={compact ? "mt-3 block rounded-full px-2 py-1.5 text-center text-[7px] font-bold uppercase" : "mt-4 block rounded-full px-4 py-3 text-center text-xs font-bold uppercase"} style={{ background: theme.backgroundColor, color: theme.textColor }}>{landing.lowerSection.submitLabel || "Receber solução personalizada"}</span>
        </div>
      </div>
    </section> : null}

    {landing.benefits.visible ? <section id={sectionId("benefits")} className={`relative ${sectionPadding} text-center`} style={{ borderTop: sectionDivider, color: theme.textColor, backgroundColor: theme.backgroundColor }}>
      {edit("benefits:heading", "Editar chamada dos serviços")}
      <p className={`${eyebrowClass} font-bold uppercase tracking-[0.16em]`} style={{ color: theme.primaryColor }}>{landing.benefits.eyebrow}</p>
      <h3 className={`${titleClass} mx-auto max-w-[30ch] font-bold leading-tight uppercase`}>{landing.benefits.title}</h3>
      {landing.benefits.description ? <p className={`${bodyClass} mx-auto max-w-3xl`}>{landing.benefits.description}</p> : null}
      <div className={`relative mt-5 grid gap-2 ${benefitsGridClass}`} style={compact ? { gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" } : undefined}>
        {edit("benefits:cards", "Editar cards de serviços", "right-2 top-2")}
        {landing.benefits.items.map((item, index) => <article key={`${item.title}-${index}`} className={compact ? "rounded-md p-2 text-white" : "rounded-2xl p-5 text-white shadow-sm"} style={{ background: theme.secondaryColor }}><span className={compact ? "mx-auto grid size-5 place-items-center rounded-full bg-white/15 text-[7px] font-bold" : "mx-auto grid size-10 place-items-center rounded-full bg-white/15 text-xs font-bold"}>{String(index + 1).padStart(2, "0")}</span><strong className={compact ? "mt-2 block text-[8px] leading-3 uppercase" : "mt-4 block text-sm leading-5 uppercase"}>{item.title}</strong><p className={compact ? "mt-1 text-[7px] leading-3 text-white/75" : "mt-3 text-xs leading-5 text-white/75"}>{item.description}</p></article>)}
      </div>
    </section> : null}

    {landing.metrics.visible ? <section id={sectionId("metrics")} className={`relative ${sectionPadding}`} style={{ borderTop: sectionDivider, color: theme.textColor, backgroundColor: theme.backgroundColor }}>
      {edit("metrics:heading", "Editar chamada dos números")}
      {landing.metrics.eyebrow || landing.metrics.title ? <div className="text-center"><p className={`${eyebrowClass} font-bold uppercase tracking-[0.16em]`} style={{ color: theme.primaryColor }}>{landing.metrics.eyebrow}</p>{landing.metrics.title ? <h3 className={`${titleClass} mx-auto max-w-[28ch] font-bold leading-tight`}>{landing.metrics.title}</h3> : null}</div> : null}
      <div className={`relative grid gap-4 ${landing.metrics.eyebrow || landing.metrics.title ? "mt-5" : ""} ${metricsGridClass}`} style={compact ? { gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))" } : undefined}>
        {edit("metrics:items", "Editar indicadores", "right-2 top-2")}
        {landing.metrics.items.map((item, index) => <article key={`${item.value}-${index}`} className="text-center"><strong className={compact ? "block text-lg leading-none" : "block text-4xl leading-none"} style={{ color: theme.primaryColor }}>{item.value}</strong><span className={compact ? "mt-1 block text-[7px] font-bold leading-3" : "mt-2 block text-xs font-bold leading-5"}>{item.label}</span>{item.description ? <p className={compact ? "mt-1 text-[7px] leading-3 opacity-70" : "mx-auto mt-2 max-w-xs text-xs leading-5 opacity-70"}>{item.description}</p> : null}<span className={compact ? "mx-auto mt-3 block h-px w-10" : "mx-auto mt-5 block h-px w-24"} style={{ background: theme.primaryColor }} /></article>)}
      </div>
    </section> : null}

    {landing.story.visible ? <section id={sectionId("story")} className={`relative ${sectionPadding}`} style={{ borderTop: sectionDivider, color: "#ffffff", backgroundColor: theme.backgroundColor }}>
      <div className={compact || isMobile ? "grid overflow-hidden rounded-xl" : "grid grid-cols-2 overflow-hidden rounded-2xl"} style={{ background: theme.secondaryColor }}>
        <div className={`relative ${compact ? "min-h-28" : "min-h-72"}`}>{edit("story:image", "Editar imagem", "right-3 top-3")}{landing.story.image ? <img src={landing.story.image} alt="Imagem da campanha" className="size-full object-cover" /> : <div className="size-full" style={{ background: "linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,.02))" }} />}</div>
        <div className={`relative ${compact ? "p-3" : "p-7 sm:p-10"}`}>{edit("story:content", "Editar conteúdo da seção", "right-3 top-3")}<p className={`${eyebrowClass} font-bold uppercase tracking-[0.16em] text-white/75`}>{landing.story.eyebrow}</p><h3 className={`${titleClass} mt-2 max-w-[20ch] font-bold leading-tight uppercase`}>{landing.story.title}</h3><p className={`${bodyClass} max-w-2xl text-white/85`}>{landing.story.description}</p><div className={`relative ${compact ? "mt-3 grid gap-2" : "mt-6 grid gap-4"}`}>{edit("story:items", "Editar diferenciais", "right-0 -top-2")}{landing.story.items.map((item, index) => <article key={`${item.title}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2"><span aria-hidden="true" className={compact ? "grid size-4 place-items-center rounded-full bg-white/15 text-[6px] font-bold" : "grid size-7 place-items-center rounded-full bg-white/15 text-[9px] font-bold"}>{String(index + 1).padStart(2, "0")}</span><div><strong className={compact ? "block text-[8px] leading-3 uppercase" : "block text-sm leading-5 uppercase"}>{item.title}</strong><p className={compact ? "mt-1 text-[7px] leading-3 text-white/75" : "mt-1 text-xs leading-5 text-white/75"}>{item.description}</p></div></article>)}</div>{landing.story.ctaLabel ? <span className={compact ? compactButtonClass : buttonClass} style={{ background: "#ffffff", color: theme.secondaryColor }}>{landing.story.ctaLabel}</span> : null}</div>
      </div>
    </section> : null}

    {landing.showcase.visible ? <section id={sectionId("showcase")} className={`relative ${sectionPadding}`} style={{ borderTop: sectionDivider, color: "#ffffff", backgroundColor: theme.backgroundColor }}>
      <div className={compact || isMobile ? "grid gap-4 rounded-xl p-4" : "grid grid-cols-[minmax(0,.85fr)_minmax(0,1.65fr)] items-center gap-8 rounded-2xl p-8 sm:p-12"} style={{ minHeight: compact ? 160 : 420, backgroundColor: theme.secondaryColor, backgroundImage: showcaseBackgroundImage ? `linear-gradient(90deg, rgba(4,11,25,.92), rgba(9,12,44,.76)), url(${showcaseBackgroundImage})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className={`relative ${compact ? "" : "max-w-md"}`}>{edit("showcase:content", "Editar chamada e foto de fundo", "right-0 -top-2")}<p className={`${eyebrowClass} font-bold uppercase tracking-[0.16em] text-white/75`}>{landing.showcase.eyebrow}</p><h3 className={`${titleClass} mt-2 max-w-[20ch] font-bold leading-tight uppercase`}>{landing.showcase.title}</h3><p className={`${bodyClass} max-w-xl text-white/85`}>{landing.showcase.description}</p>{landing.showcase.ctaLabel ? <span className={compact ? compactButtonClass : buttonClass} style={{ background: "#ffffff", color: theme.secondaryColor }}>{landing.showcase.ctaLabel}</span> : null}</div>
        <div className="relative grid gap-2" style={{ gridTemplateColumns: compact || isMobile ? "repeat(auto-fit, minmax(110px, 1fr))" : "repeat(3, minmax(0, 1fr))" }}>{edit("showcase:cards", "Editar cards de soluções", "right-2 top-2")}{landing.showcase.items.map((item, index) => <article key={`${item.title}-${index}`} className={compact ? "rounded-md p-2 text-center" : "rounded-2xl p-5 text-center shadow-lg"} style={{ minHeight: compact ? 96 : 220, background: "rgba(255,255,255,.97)", color: theme.textColor }}><span aria-hidden="true" className={compact ? "mx-auto grid size-4 place-items-center rounded-full text-[6px] font-bold" : "mx-auto grid size-8 place-items-center rounded-full text-[10px] font-bold"} style={{ background: `${theme.primaryColor}18`, color: theme.primaryColor }}>{String(index + 1).padStart(2, "0")}</span><strong className={compact ? "mt-2 block text-[8px] leading-3 uppercase" : "mt-3 block text-sm leading-5 uppercase"}>{item.title}</strong><p className={compact ? "mt-1 text-[7px] leading-3 opacity-70" : "mt-3 text-xs leading-5 opacity-70"}>{item.description}</p></article>)}</div>
      </div>
    </section> : null}

    {landing.testimonial.visible ? <section id={sectionId("testimonial")} className={`relative ${sectionPadding} text-center`} style={{ borderTop: sectionDivider, color: theme.textColor, backgroundColor: theme.backgroundColor }}>
      {edit("testimonial:heading", "Editar chamada dos feedbacks")}
      <p className={`${eyebrowClass} font-bold uppercase tracking-[0.16em]`} style={{ color: theme.primaryColor }}>{landing.testimonial.eyebrow}</p>
      <h3 className={`${titleClass} mx-auto max-w-[30ch] font-bold leading-tight`}>{landing.testimonial.title}</h3>
      {landing.testimonial.description ? <p className={`${bodyClass} mx-auto max-w-4xl`}>{landing.testimonial.description}</p> : null}
      <div className={`relative mt-5 grid gap-2 text-left ${feedbackGridClass}`} style={compact ? { gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" } : undefined}>{edit("testimonial:cards", "Editar cards de feedbacks", "right-2 top-2")}{landing.testimonial.items.map((item, index) => <article key={`${item.name}-${index}`} className={compact ? "rounded-md bg-black/5 p-2" : "rounded-xl bg-black/5 p-4"}><div className="flex items-center gap-2"><span className={compact ? "grid size-5 place-items-center rounded-full bg-black/10 text-[6px] font-bold" : "grid size-8 place-items-center rounded-full bg-black/10 text-[9px] font-bold"}>{item.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CL"}</span><div><strong className={compact ? "block text-[8px] leading-3" : "block text-xs leading-4"}>{item.name}</strong><span className={compact ? "block text-[7px] leading-3 opacity-60" : "block text-[10px] leading-4 opacity-60"}>{item.detail}</span></div></div><span className={compact ? "mt-2 block text-[8px] tracking-[.08em] text-amber-600" : "mt-3 block text-sm tracking-[.08em] text-amber-600"}>{Array.from({ length: 5 }, (_, starIndex) => starIndex < item.rating ? "★" : "☆").join("")}</span><p className={compact ? "mt-2 text-[7px] leading-3" : "mt-3 text-xs leading-5"}>“{item.quote}”</p></article>)}</div>
    </section> : null}

    {landing.faq.visible ? <section id={sectionId("faq")} className={`relative ${sectionPadding}`} style={{ borderTop: sectionDivider, color: theme.textColor, backgroundColor: theme.backgroundColor }}>
      {edit("faq:heading", "Editar chamada das perguntas")}
      <div className="text-center"><p className={`${eyebrowClass} font-bold uppercase tracking-[0.16em]`} style={{ color: theme.primaryColor }}>{landing.faq.eyebrow}</p><h3 className={`${titleClass} mx-auto max-w-[28ch] font-bold leading-tight uppercase`}>{landing.faq.title}</h3></div>
      <div className={`relative ${compact ? "mt-4 grid gap-2" : "mx-auto mt-6 grid max-w-4xl gap-3"}`}>{edit("faq:items", "Editar perguntas e respostas", "right-2 top-2")}{landing.faq.items.map((item, index) => { const isOpen = openFaqIndex === index; return <article key={`${item.question}-${index}`} className={compact ? "overflow-hidden rounded-md border" : "overflow-hidden rounded-xl border-2"} style={{ borderColor: theme.primaryColor, background: isOpen ? theme.primaryColor : theme.backgroundColor, color: isOpen ? theme.backgroundColor : theme.textColor }}><button type="button" aria-expanded={isOpen} onClick={() => setOpenFaqIndex((currentIndex) => currentIndex === index ? null : index)} className={compact ? "flex w-full items-center justify-between gap-2 bg-transparent px-2 py-2 text-left text-[8px] font-bold" : "flex w-full items-center justify-between gap-4 bg-transparent px-4 py-4 text-left text-sm font-bold"} style={{ color: "inherit" }}><span>{item.question}</span><span aria-hidden="true">{isOpen ? "⌃" : "⌄"}</span></button>{isOpen ? <p className={compact ? "px-2 pb-2 text-[7px] leading-3 opacity-80" : "px-4 pb-4 text-xs leading-5 opacity-80"}>{item.answer}</p> : null}</article>; })}</div>
    </section> : null}

    {landing.finalCta.visible ? <section id={sectionId("finalCta")} className={`relative ${sectionPadding}`} style={{ borderTop: sectionDivider, background: theme.backgroundColor, color: "#ffffff" }}>
      <div className={`relative ${compact ? "rounded-lg p-4" : "rounded-2xl p-8 sm:p-12"}`} style={{ minHeight: compact ? 130 : 260, background: theme.primaryColor, backgroundImage: landing.finalCta.backgroundImage ? `linear-gradient(90deg, rgba(0,0,0,.84), rgba(0,0,0,.55)), url(${landing.finalCta.backgroundImage})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        {edit("finalCta:image", "Editar imagem de fundo", "right-3 top-3")}
        {edit("finalCta:content", "Editar chamada final", "right-3 top-12")}
        <p className={`${eyebrowClass} font-bold uppercase tracking-[0.16em] text-white/75`}>{landing.finalCta.eyebrow}</p>
        <h3 className={`${titleClass} max-w-[24ch] font-bold leading-tight`}>{landing.finalCta.title}</h3>
        <p className={`${bodyClass} max-w-3xl text-white/85`}>{landing.finalCta.description}</p>
        {landing.finalCta.ctaLabel ? <span className={compact ? compactButtonClass : buttonClass} style={{ background: "#ffffff", color: theme.primaryColor }}>{landing.finalCta.ctaLabel}</span> : null}
      </div>
    </section> : null}

    <footer id={sectionId("footer")} className={sectionPadding} style={{ borderTop: sectionDivider, background: "#111111", color: "#ffffff" }}>
      <div className={compact ? "space-y-3" : "flex flex-wrap justify-between gap-6"}>
        <div className="max-w-lg"><strong className={compact ? "text-sm" : "text-xl"}>Rodogarcia Transportes</strong><p className={compact ? "mt-2 text-[8px] leading-3 text-white/75" : "mt-3 text-sm leading-6 text-white/75"}>Uma operação com transparência, privacidade e respeito aos seus dados.</p></div>
        <div className={compact ? "flex flex-wrap gap-x-2 gap-y-1 text-[7px] text-white/85" : "flex flex-wrap content-start gap-x-4 gap-y-2 text-sm text-white/85"}><span>Privacidade e LGPD</span><span>Termos de uso</span><span>Gerenciar cookies</span></div>
      </div>
      <div className={compact ? "mt-4 flex flex-wrap justify-between gap-2 border-t border-white/20 pt-3 text-[7px] text-white/65" : "mt-6 flex flex-wrap justify-between gap-3 border-t border-white/20 pt-4 text-xs text-white/65"}><span>© {new Date().getFullYear()} Rodogarcia. Todos os direitos reservados.</span><span>Desenvolvido por Lucas Andrade</span></div>
    </footer>
  </>;
}

function LandingViewportReference({
  viewport,
  landing,
  backgroundImage,
  logo,
}: {
  viewport: (typeof PREVIEW_VIEWPORTS)[number];
  landing: LandingPreview;
  backgroundImage: string;
  logo: string;
}) {
  const { theme, hero } = landing;
  const Icon = viewport.icon;
  const hasBackgroundImage = Boolean(backgroundImage);
  const textColor = hasBackgroundImage ? "#ffffff" : theme.textColor;
  const mutedTextColor = hasBackgroundImage ? "rgba(255,255,255,.8)" : theme.textColor;
  const isMobile = viewport.key === "mobile";
  const highlightColumns = isMobile ? "1fr" : `repeat(${Math.min(Math.max(hero.highlights.length, 1), 4)}, minmax(0, 1fr))`;

  return <article className="min-w-0 rounded-xl border border-slate-300 bg-slate-100 p-2.5 shadow-sm">
    <header className="mb-2 flex items-center justify-between gap-2 px-0.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800"><Icon size={15} weight="bold" />{viewport.label}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{viewport.dimensions}</span>
    </header>
    <div className="h-[640px] overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-sm">
      <section className="overflow-hidden" style={{ color: textColor, backgroundColor: hasBackgroundImage ? theme.primaryColor : theme.backgroundColor, backgroundImage: hasBackgroundImage ? `linear-gradient(120deg, rgba(4,11,25,.9), rgba(4,11,25,.25)), url(${backgroundImage})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="flex min-h-8 items-center justify-between gap-2 border-b px-3 py-2 text-[8px] font-medium" style={{ background: hasBackgroundImage ? "rgba(0,0,0,.28)" : theme.backgroundColor, borderColor: hasBackgroundImage ? "rgba(255,255,255,.22)" : "rgba(17,17,17,.16)" }}>
          <span className="min-w-0 truncate">{hero.phone || "Telefone"}</span>
          {!isMobile ? <span className="min-w-0 truncate text-right">{hero.email || "E-mail"}</span> : null}
        </div>
        <div className="min-h-[248px] px-4 pb-5 pt-4" style={{ paddingInline: isMobile ? "1rem" : viewport.key === "desktop" ? "1.4rem" : "1.15rem" }}>
          {logo ? <img src={logo} alt="Logo da landing page" className="h-7 w-auto max-w-28 object-contain object-left" /> : <span className="text-[10px] font-black tracking-[0.1em]">SUA LOGO</span>}
          <div className="mt-7 max-w-[32rem]">
            <p className="truncate text-[7px] font-bold uppercase tracking-[0.18em]" style={{ color: mutedTextColor }}>{hero.eyebrow || "Mensagem de apoio"}</p>
            <h3 className="mt-2 overflow-hidden text-lg font-bold leading-[.95] tracking-[-.05em]" style={{ fontSize: isMobile ? "1.15rem" : viewport.key === "desktop" ? "1.7rem" : "1.45rem" }}>{hero.title || "Título principal da campanha"}</h3>
            <p className="mt-2 overflow-hidden text-[9px] leading-4" style={{ color: mutedTextColor }}>{hero.description || "Descreva aqui a proposta principal desta landing page."}</p>
            {hero.ctaLabel ? <span className="mt-3 inline-flex rounded-full px-3 py-1.5 text-[8px] font-bold" style={{ background: theme.primaryColor, color: theme.backgroundColor }}>{hero.ctaLabel}</span> : null}
          </div>
          <div className="mt-5 grid gap-1.5" style={{ gridTemplateColumns: highlightColumns }}>
            {hero.highlights.slice(0, 4).map((item, index) => <article key={`${item.title}-${index}`} className="min-w-0 rounded-md border p-2" style={{ borderColor: hasBackgroundImage ? "rgba(255,255,255,.48)" : "rgba(17,17,17,.2)", background: hasBackgroundImage ? "rgba(8,16,28,.5)" : theme.backgroundColor }}><strong className="block truncate text-[8px]">{item.title || "Informação"}</strong><p className="mt-1 overflow-hidden text-[7px] leading-3" style={{ color: mutedTextColor }}>{item.description || "Descrição da informação."}</p></article>)}
          </div>
        </div>
      </section>
      <CampaignPreviewSections landing={landing} compact viewport={viewport.key} />
    </div>
  </article>;
}

export function LandingVisualEditor<T extends LandingPreview>({
  landing,
  media,
  uploadingMedia,
  onChange,
  onUploadMedia,
  onDeleteMedia,
}: {
  landing: T;
  media: LandingMedia[];
  uploadingMedia: boolean;
  onChange: (update: (current: T) => T) => void;
  onUploadMedia: (file: File, alt?: string) => Promise<void>;
  onDeleteMedia: (item: LandingMedia) => Promise<void>;
}) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [dialog, setDialog] = useState<EditorDialog>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [adminShellPortalTarget, setAdminShellPortalTarget] = useState<HTMLElement | null>(null);
  const visualEditorRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const scrollSnapshotRef = useRef<ScrollSnapshot | null>(null);
  const { theme, hero } = landing;
  const backgroundImage = isInternalMediaPath(hero.backgroundImage) ? hero.backgroundImage : "";
  const logo = isInternalMediaPath(hero.logo) ? hero.logo : "";
  const hasBackgroundImage = Boolean(backgroundImage);
  const heroTextColor = hasBackgroundImage ? "#ffffff" : theme.textColor;
  const mutedHeroText = hasBackgroundImage ? "rgba(255,255,255,.82)" : theme.textColor;
  const activeViewport = PREVIEW_VIEWPORTS.find((viewport) => viewport.key === previewMode);
  const activeViewportKey: IndividualPreviewMode = activeViewport?.key ?? "desktop";
  const mobileCanvas = activeViewportKey === "mobile";
  const heroPlacement = mobileCanvas ? hero.backgroundPresentation?.mobile ?? hero.backgroundPresentation?.desktop : hero.backgroundPresentation?.desktop;
  const heroBackgroundPosition = `${heroPlacement?.focalPoint.x ?? 50}% ${heroPlacement?.focalPoint.y ?? 50}%`;
  const tabletCanvas = activeViewportKey === "tablet";
  const heroCanvasPadding = mobileCanvas ? "px-5 pb-8" : tabletCanvas ? "px-7 pb-9" : "px-6 pb-10 sm:px-10";
  const heroContactPadding = mobileCanvas ? "-mx-5 px-5" : tabletCanvas ? "-mx-7 px-7" : "-mx-6 px-6 sm:-mx-10 sm:w-[calc(100%+5rem)] sm:px-10";
  const heroCopySpacing = mobileCanvas ? "mt-10" : tabletCanvas ? "mt-14" : "mt-20";
  const heroTitleSize = mobileCanvas ? "2rem" : tabletCanvas ? "2.8rem" : "3.7rem";
  const previewIdPrefix = isFullscreen ? "landing-preview-fullscreen" : "landing-preview";
  const editHero = (patch: Partial<LandingPreview["hero"]>) => onChange((current) => ({ ...current, hero: { ...current.hero, ...patch } }));

  useEffect(() => {
    setAdminShellPortalTarget(document.querySelector<HTMLElement>("[data-admin-shell='true']"));
  }, []);

  // O navegador só mostra descendentes do elemento que entrou em fullscreen.
  // Fora dele, o portal segue no shell para não deslocar a página do CMS.
  const dialogPortalTarget = isFullscreen ? visualEditorRef.current : adminShellPortalTarget;

  useLayoutEffect(() => {
    if (!dialog) return;

    const snapshot = scrollSnapshotRef.current ?? captureScrollPosition();
    const scrollContainer = snapshot.container;
    if (scrollContainer) {
      scrollContainer.style.overflowY = "hidden";
      scrollContainer.style.overscrollBehavior = "none";
    }
    restoreScrollPosition(snapshot);
    const restoreFrame = window.requestAnimationFrame(() => restoreScrollPosition(snapshot));

    return () => {
      window.cancelAnimationFrame(restoreFrame);
      if (scrollContainer) {
        scrollContainer.style.overflowY = snapshot.overflowY;
        scrollContainer.style.overscrollBehavior = snapshot.overscrollBehavior;
      }
      restoreScrollPosition(snapshot);
      window.requestAnimationFrame(() => restoreScrollPosition(snapshot));
      scrollSnapshotRef.current = null;
    };
  }, [dialog]);

  useEffect(() => {
    function syncFullscreenState() {
      if (document.fullscreenElement !== visualEditorRef.current) setIsFullscreen(false);
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;

    document.documentElement.dataset.landingPreviewFullscreen = "true";
    return () => {
      delete document.documentElement.dataset.landingPreviewFullscreen;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen || dialog) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.fullscreenElement) setIsFullscreen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [dialog, isFullscreen]);

  useEffect(() => {
    if (!dialog) return;

    function closeDialogOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeDialog();
    }

    document.addEventListener("keydown", closeDialogOnEscape);
    return () => document.removeEventListener("keydown", closeDialogOnEscape);
  }, [dialog]);

  function updateHighlight(index: number, key: "title" | "description", value: string) {
    editHero({ highlights: hero.highlights.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) });
  }

  function openDialog(nextDialog: Exclude<EditorDialog, null>) {
    scrollSnapshotRef.current = captureScrollPosition();
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDialog(nextDialog);
  }

  function closeDialog() {
    const snapshot = scrollSnapshotRef.current;
    setDialog(null);
    window.requestAnimationFrame(() => {
      if (snapshot) restoreScrollPosition(snapshot);
      returnFocusRef.current?.focus({ preventScroll: true });
      if (snapshot) restoreScrollPosition(snapshot);
    });
  }

  function captureScrollPosition(): ScrollSnapshot {
    const container = document.querySelector<HTMLElement>("[data-admin-scroll]");
    const previewContainers = Array.from(visualEditorRef.current?.querySelectorAll<HTMLElement>("[data-landing-preview], [id$='-canvas']") ?? [])
      .map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }));
    return {
      container,
      previewContainers,
      top: container?.scrollTop ?? 0,
      left: container?.scrollLeft ?? 0,
      windowX: window.scrollX,
      windowY: window.scrollY,
      overflowY: container?.style.overflowY ?? "",
      overscrollBehavior: container?.style.overscrollBehavior ?? "",
    };
  }

  function restoreScrollPosition(snapshot: ScrollSnapshot) {
    if (snapshot.container) {
      snapshot.container.scrollTop = snapshot.top;
      snapshot.container.scrollLeft = snapshot.left;
    }
    snapshot.previewContainers.forEach(({ element, top, left }) => {
      element.scrollTop = top;
      element.scrollLeft = left;
    });
    window.scrollTo(snapshot.windowX, snapshot.windowY);
  }

  function navigatePreview(section: PreviewSectionKey) {
    if (previewMode === "compare") {
      setPreviewMode("desktop");
      window.setTimeout(() => {
        if (!scrollPreviewTo(section) && section !== "hero" && section !== "footer") openDialog(primaryEditTarget(section));
      }, 0);
      return;
    }

    if (scrollPreviewTo(section)) return;
    if (section !== "hero" && section !== "footer") openDialog(primaryEditTarget(section));
  }

  function scrollPreviewTo(section: PreviewSectionKey) {
    const canvas = document.getElementById(`${previewIdPrefix}-canvas`);
    const target = document.getElementById(`${previewIdPrefix}-${section}`);
    if (!canvas || !target) return false;

    const canvasTop = canvas.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    canvas.scrollTo({ top: canvas.scrollTop + targetTop - canvasTop, behavior: "smooth" });
    return true;
  }

  function openFullscreen() {
    setIsFullscreen(true);
    void visualEditorRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  function closeFullscreen() {
    if (document.fullscreenElement === visualEditorRef.current) {
      void document.exitFullscreen();
      return;
    }

    setIsFullscreen(false);
  }

  function renderPreviewToolbar(fullscreen = false) {
    return <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{fullscreen ? "Edição em tela cheia" : "Canvas de edição"}</p><h2 className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">Edite pelo lápis de cada seção</h2></div>
        <DeveloperHelp label="Referências de tela" templateKey="landing-pages.field.responsive-preview" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => openDialog("theme")} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/25">
          <PencilSimple size={14} weight="bold" />
          Cores
        </button>
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm" role="group" aria-label="Tamanho da prévia">
          {PREVIEW_VIEWPORTS.map((viewport) => {
            const Icon = viewport.icon;
            const selected = previewMode === viewport.key;

            return <button key={viewport.key} type="button" onClick={() => setPreviewMode(viewport.key)} aria-pressed={selected} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/30 ${selected ? "bg-slate-950 text-white shadow-sm" : "bg-white/80 text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,.18)] hover:bg-white hover:text-slate-950"}`}>
              <Icon size={15} weight="bold" />
              {viewport.label}
            </button>;
          })}
        </div>
        <button type="button" onClick={() => setPreviewMode("compare")} aria-pressed={previewMode === "compare"} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/25 ${previewMode === "compare" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"}`}>
          <SquaresFour size={15} weight="bold" />
          Comparar
        </button>
        <button type="button" onClick={fullscreen ? closeFullscreen : openFullscreen} aria-label={fullscreen ? "Sair da edição em tela cheia" : "Editar em tela cheia"} title={fullscreen ? "Sair da tela cheia" : "Editar em tela cheia"} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/25">
          {fullscreen ? <ArrowsIn size={15} weight="bold" /> : <ArrowsOut size={15} weight="bold" />}
          <span className="hidden sm:inline">{fullscreen ? "Sair" : "Tela cheia"}</span>
        </button>
      </div>
    </div>;
  }

  function renderPreviewNavigation() {
    return <nav className="mt-3 flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white/70 px-2 py-2 shadow-sm" aria-label="Navegar pela prévia">
      <span className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-raw)]">Ir para</span>
      <div className="flex min-w-max items-center gap-1" aria-label="Seções da landing">
        {PREVIEW_SECTION_NAV.map((section) => <button key={section.key} type="button" onClick={() => navigatePreview(section.key)} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/25">{section.label}</button>)}
      </div>
    </nav>;
  }

  function renderPreviewSurface(fullscreen = false) {
    const surfaceClassName = fullscreen ? previewMode === "compare" ? "h-full w-full overflow-auto bg-slate-100 p-4" : "h-full w-full overflow-hidden bg-white" : "mt-4 overflow-auto rounded-xl bg-slate-200 p-2 sm:p-4";
    const canvasClassName = fullscreen ? "h-full w-full max-h-none rounded-none shadow-none" : "max-h-[76vh] rounded-md shadow-2xl";

    return <div data-landing-preview="true" className={surfaceClassName}>{previewMode === "compare" ? <div className="grid w-full min-w-[920px] gap-3 lg:grid-cols-[minmax(0,3.7fr)_minmax(0,2fr)_minmax(190px,1fr)]">{PREVIEW_VIEWPORTS.map((viewport) => <LandingViewportReference key={viewport.key} viewport={viewport} landing={landing} backgroundImage={backgroundImage} logo={logo} />)}</div> : <div id={`${previewIdPrefix}-canvas`} className={`relative mx-auto overflow-y-auto bg-white transition-[width] duration-300 ${canvasClassName} ${activeViewport?.widthClass ?? "w-full"}`} style={{ color: theme.textColor, backgroundColor: theme.backgroundColor }}>
      <section id={`${previewIdPrefix}-hero`} className={`relative min-h-[480px] overflow-hidden ${heroCanvasPadding}`} style={{ color: heroTextColor, backgroundColor: hasBackgroundImage ? theme.primaryColor : theme.backgroundColor, backgroundImage: hasBackgroundImage ? `linear-gradient(90deg, rgba(4,11,25,.88), rgba(4,11,25,.2)), url(${backgroundImage})` : undefined, backgroundSize: "cover", backgroundPosition: heroBackgroundPosition }}>
        <EditControl label="Editar foto de fundo" onClick={() => openDialog("background")} className="bottom-4 right-3" />
        <div className={`${heroContactPadding} flex min-h-12 items-center gap-3 border-b py-3 text-xs`} style={{ background: hasBackgroundImage ? "rgba(0,0,0,.28)" : theme.backgroundColor, borderColor: hasBackgroundImage ? "rgba(255,255,255,.22)" : "rgba(17,17,17,.16)" }}><div className={`grid min-w-0 flex-1 gap-3 ${mobileCanvas ? "grid-cols-1" : "grid-cols-2"}`}><span className="truncate">{hero.phone || "Telefone"}</span>{mobileCanvas ? null : <span className="truncate text-right">{hero.email || "E-mail"}</span>}</div></div><EditControl label="Editar faixa de contatos" onClick={() => openDialog("contacts")} className="right-3 top-3" />
        <div className="relative mt-7 inline-flex min-h-12 items-center"><div>{logo ? <img src={logo} alt="Logo da landing page" className="h-12 w-auto max-w-52 object-contain object-left" /> : <><span className="block text-2xl font-black tracking-[0.08em]">SUA LOGO</span><span className="mt-1 block text-[8px] font-semibold tracking-[0.42em] opacity-60">IDENTIDADE DA CAMPANHA</span></>}</div><EditControl label="Editar logo" onClick={() => openDialog("logo")} className="-right-10 top-1" /></div>
        <div className={`relative ${heroCopySpacing} max-w-3xl`}><p className="text-[11px] font-bold uppercase tracking-[0.32em]" style={{ color: mutedHeroText }}>{hero.eyebrow || "Mensagem de apoio"}</p><h3 className="mt-4 font-bold leading-[.95] tracking-[-.05em]" style={{ fontSize: heroTitleSize }}>{hero.title || "Título principal da campanha"}</h3><p className="mt-4 max-w-xl text-sm leading-6" style={{ color: mutedHeroText }}>{hero.description || "Descreva aqui a proposta principal desta landing page."}</p>{hero.ctaLabel ? <span className="mt-6 inline-flex rounded-full px-5 py-3 text-xs font-bold" style={{ background: theme.primaryColor, color: theme.backgroundColor }}>{hero.ctaLabel}</span> : null}<EditControl label="Editar mensagem do Hero" onClick={() => openDialog("hero-copy")} className="right-0 -top-10" /><EditControl label="Editar botão do Hero" onClick={() => openDialog("hero-cta")} className="bottom-0 right-0" /></div>
        <div className="relative mt-8 grid w-full gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>{hero.highlights.map((item, index) => <article key={`${item.title}-${index}`} className="rounded-xl border p-4" style={{ borderColor: hasBackgroundImage ? "rgba(255,255,255,.56)" : "rgba(17,17,17,.2)", background: hasBackgroundImage ? "rgba(8,16,28,.5)" : theme.backgroundColor }}><strong className="block text-sm">{item.title || "Informação"}</strong><p className="mt-2 text-xs leading-5" style={{ color: mutedHeroText }}>{item.description || "Descrição da informação."}</p></article>)}<EditControl label="Editar informações em destaque" onClick={() => openDialog("highlights")} className="right-0 -top-10" /></div>
      </section>
      <CampaignPreviewSections landing={landing} viewport={activeViewportKey} onEdit={openDialog} idPrefix={previewIdPrefix} />
    </div>}</div>;
  }

  return <>
    <section ref={visualEditorRef} className={isFullscreen ? "fixed inset-0 z-[90] h-[100dvh] w-screen overflow-hidden bg-white" : "rounded-xl border border-[var(--border)] bg-slate-100/70 p-3 shadow-[0_8px_22px_rgba(15,23,42,0.035)] sm:p-4"}>
      {!isFullscreen ? <>{renderPreviewToolbar()}{renderPreviewNavigation()}{renderPreviewSurface()}</> : <div className="relative h-full w-full">{renderPreviewSurface(true)}<button type="button" onClick={closeFullscreen} className="absolute right-4 top-4 z-50 inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-950/90 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50" aria-label="Voltar ao editor do CMS" title="Voltar ao editor (Esc)"><ArrowsIn size={17} weight="bold" />Voltar<span className="hidden sm:inline">ao editor</span></button></div>}
    </section>
    {dialog && dialogPortalTarget ? createPortal(<div data-landing-editor-dialog="true" className={`${isFullscreen ? "" : "cms-content-dialog "}fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center`} role="dialog" aria-modal="true" aria-label={dialogTitle[dialog]} onMouseDown={closeDialog}><div className="landing-editor-dialog__surface max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6 lg:p-7" onMouseDown={(event) => event.stopPropagation()}><div className="mb-6 flex items-start justify-between gap-5"><div className="max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Edição rápida</p><h3 className="mt-1 text-xl font-bold text-slate-950">{dialogTitle[dialog]}</h3><p className="mt-1 text-sm text-slate-500">As alterações aparecem na prévia imediatamente. Salve a landing quando terminar.</p></div><button type="button" onClick={closeDialog} aria-label="Fechar" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} weight="bold" /></button></div>
      {dialog === "theme" ? <LandingThemeEditor theme={theme} onChange={(nextTheme) => onChange((current) => ({ ...current, theme: nextTheme }))} /> : null}
      {dialog === "contacts" ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Telefone<input value={hero.phone} onChange={(event) => editHero({ phone: event.target.value })} className={inputClass} /></label><label className="text-sm font-semibold text-slate-700">E-mail<input value={hero.email} onChange={(event) => editHero({ email: event.target.value })} className={inputClass} /></label></div> : null}
      {dialog === "logo" ? <LandingMediaPicker slot="logo" currentUrl={hero.logo} media={media} uploading={uploadingMedia} onSelect={(url) => editHero({ logo: url })} onUpload={onUploadMedia} onDelete={onDeleteMedia} /> : null}
      {dialog === "background" ? <><LandingMediaPicker slot="background" currentUrl={hero.backgroundImage} media={media} uploading={uploadingMedia} onSelect={(url) => editHero({ backgroundImage: url })} onUpload={onUploadMedia} onDelete={onDeleteMedia} /><MediaPlacementEditor label="o Hero da campanha" src={hero.backgroundImage} mediaType="image" value={hero.backgroundPresentation} onChange={(backgroundPresentation) => editHero({ backgroundPresentation })} frameAspectRatio="amplo e responsivo" /></> : null}
      {dialog === "hero-copy" ? <div className="grid gap-4"><label className="text-sm font-semibold text-slate-700">Selo<input value={hero.eyebrow} onChange={(event) => editHero({ eyebrow: event.target.value })} className={inputClass} maxLength={80} /></label><label className="text-sm font-semibold text-slate-700">Título<input value={hero.title} onChange={(event) => editHero({ title: event.target.value })} className={inputClass} maxLength={180} /></label><label className="text-sm font-semibold text-slate-700">Descrição<textarea value={hero.description} onChange={(event) => editHero({ description: event.target.value })} className={`${inputClass} min-h-24 resize-y`} maxLength={900} /></label></div> : null}
      {dialog === "hero-cta" ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Botão<input value={hero.ctaLabel} onChange={(event) => editHero({ ctaLabel: event.target.value })} className={inputClass} maxLength={70} /></label><label className="text-sm font-semibold text-slate-700">Destino do botão<input value={hero.ctaUrl} onChange={(event) => editHero({ ctaUrl: event.target.value })} className={inputClass} maxLength={400} /></label></div> : null}
      {dialog === "highlights" ? <div><p className="text-sm font-semibold text-slate-700">Informações em destaque</p><div className="mt-2 grid gap-3 sm:grid-cols-2">{hero.highlights.map((item, index) => <div key={index} className="rounded-xl border border-slate-200 p-3"><input value={item.title} onChange={(event) => updateHighlight(index, "title", event.target.value)} placeholder="Título" className={inputClass} /><textarea value={item.description} onChange={(event) => updateHighlight(index, "description", event.target.value)} placeholder="Descrição" className={`${inputClass} min-h-20 resize-y`} /></div>)}</div>{hero.highlights.length < 4 ? <button type="button" onClick={() => editHero({ highlights: [...hero.highlights, { title: "", description: "" }] })} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-slate-950"><Plus size={16} weight="bold" />Adicionar informação</button> : null}</div> : null}
      {isCampaignV1EditDialog(dialog) ? <CampaignV1FocusedSectionEditor target={dialog} landing={landing} media={media} onChange={onChange} /> : null}
      <div className="mt-6 flex justify-end"><button type="button" onClick={closeDialog} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Concluir edição</button></div>
    </div></div>, dialogPortalTarget) : null}
  </>;
}
