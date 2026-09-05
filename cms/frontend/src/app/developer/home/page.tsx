"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  ImageSquare,
  Plus,
  Trash,
  VideoCamera,
} from "@phosphor-icons/react";
import { useApiRequest } from "@/hooks/useApiRequest";
import {
  adminResourceKeys,
  invalidateAdminResource,
} from "@/hooks/useAdminResource";
import { api, external, site } from "@/lib/routes";
import type {
  HomeFeedback,
  HomeHeroButton,
  HomeHeroMode,
  HomeHeroSlide,
  HomeInteractiveItem,
  HomeMedia,
  HomeOperationItem,
  HomePageContent,
  HomeRegionalUnit,
  HomeServiceCard,
  OperationalUnit,
  QuickAction,
} from "@/types/content";
import { cn } from "@/lib/utils";
import {
  DeveloperMediaField,
  DeveloperMediaPreview,
} from "@/components/developer/DeveloperMediaField";
import { MediaPlacementEditor } from "@/components/developer/MediaPlacementEditor";
import { DeveloperResponsivePreview } from "@/components/developer/DeveloperResponsivePreview";
import { DeveloperConfirmButton } from "@/components/developer/DeveloperConfirmButton";
import {
  DeveloperCard,
  DeveloperColorField,
  DeveloperField,
  DeveloperHero,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  DeveloperStatusPill,
  developerDangerButtonClassName,
  developerGhostButtonClassName,
  developerInputClassName,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
} from "@/components/developer/ui";

type SaveKey =
  | "hero"
  | "quickActions"
  | "section1"
  | "section2"
  | "section3"
  | "regionalPresence"
  | "trackingCta"
  | "socialProof";

const HOME_STEPS = [
  {
    key: "hero",
    step: "Etapa 1",
    title: "Hero principal",
    description: "Carrossel inicial, mídias e botões de entrada da Home.",
  },
  {
    key: "quickActions",
    step: "Etapa 2",
    title: "Atalhos e Taxas",
    description: "Botões rápidos abaixo do hero, incluindo o PDF de taxas.",
  },
  {
    key: "section1",
    step: "Etapa 3",
    title: "Previsibilidade",
    description: "Título, 3 abas clicáveis e CTA da primeira seção.",
  },
  {
    key: "section2",
    step: "Etapa 4",
    title: "Operação conectada",
    description: "Até 5 itens da área escura em desktop e mobile.",
  },
  {
    key: "section3",
    step: "Etapa 5",
    title: "Linhas de serviço",
    description: "Badge, texto principal e cards paginados de soluções.",
  },
  {
    key: "regionalPresence",
    step: "Etapa 6",
    title: "Presença Regional",
    description: "Unidades exibidas no mapa e no card de unidade ativa.",
  },
  {
    key: "trackingCta",
    step: "Etapa 7",
    title: "Rastreie sua carga",
    description: "Somente textos e links dos dois botões da área de rastreio.",
  },
  {
    key: "socialProof",
    step: "Etapa 8",
    title: "Prova social",
    description: "Depoimentos, logos, estrelas, ordem e visibilidade.",
  },
] as const;

type HomeStepKey = (typeof HOME_STEPS)[number]["key"];

const EMPTY_MEDIA: HomeMedia = {
  type: "image",
  src: "",
  alt: "",
  poster: "",
  desktopSrc: "",
  mobileSrc: "",
};

const EMPTY_BUTTON: HomeHeroButton = {
  label: "",
  url: "",
  enabled: false,
  color: "#1d4ed8",
  variant: "solid",
};

const QUICK_ACTION_ICON_OPTIONS = [
  "FilePdf",
  "Calculator",
  "MagnifyingGlass",
  "Truck",
  "MapPin",
  "WhatsappLogo",
  "Phone",
  "Envelope",
  "ChatCircleDots",
  "Headset",
  "Package",
  "Handshake",
  "FileText",
  "ArrowSquareOut",
] as const;

const QUICK_ACTION_TYPE_OPTIONS: Array<{
  value: QuickAction["type"];
  label: string;
}> = [
  { value: "link", label: "Link interno" },
  { value: "external", label: "Link externo" },
  { value: "download", label: "Download" },
  { value: "modal", label: "Scroll/âncora" },
];

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "qa-taxas",
    order: 1,
    label: "Taxas",
    href: "",
    icon: "FilePdf",
    type: "download",
    enabled: false,
    downloadFile: "",
  },
  {
    id: "qa-cotacao",
    order: 2,
    label: "Cotação",
    href: site.quote,
    icon: "Calculator",
    type: "link",
    enabled: true,
  },
  {
    id: "qa-rastreamento",
    order: 3,
    label: "Rastreamento",
    href: external.tracking,
    icon: "MagnifyingGlass",
    type: "external",
    enabled: true,
  },
  {
    id: "qa-coleta",
    order: 4,
    label: "Solicitar Coleta",
    href: site.collections,
    icon: "Truck",
    type: "link",
    enabled: true,
  },
  {
    id: "qa-cidades",
    order: 5,
    label: "Cidades",
    href: "#mapa-regional",
    icon: "MapPin",
    type: "modal",
    enabled: true,
  },
  {
    id: "qa-whatsapp",
    order: 6,
    label: "WhatsApp",
    href: site.contact,
    icon: "WhatsappLogo",
    type: "link",
    enabled: true,
  },
  {
    id: "qa-telefone",
    order: 7,
    label: "Telefone",
    href: external.phoneHref,
    icon: "Phone",
    type: "external",
    enabled: true,
  },
  {
    id: "qa-email",
    order: 8,
    label: "E-mail",
    href: external.commercialEmail,
    icon: "Envelope",
    type: "external",
    enabled: true,
  },
];

const BRAZIL_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyHomePage(): HomePageContent {
  return {
    hero: { slides: [] },
    section1: {
      title: "",
      ctaLabel: "",
      ctaUrl: "",
      items: Array.from({ length: 3 }, (_, index) => emptySection1Item(index)),
    },
    section2: { title: "", items: [] },
    section3: {
      badge: "",
      title: "",
      description: "",
      ctaLabel: "",
      ctaUrl: "",
      cards: Array.from({ length: 3 }, (_, index) => emptyServiceCard(index)),
    },
    regionalPresence: { units: [] },
    trackingCta: {
      buttons: [
        {
          label: "Rastrear agora",
          url: "https://rodogarcia.eslcloud.com.br/recipient_tracking",
          enabled: true,
          color: "#1d4ed8",
          variant: "solid",
        },
        {
          label: "Como consultar",
          url: "/central-ajuda",
          enabled: true,
          color: "#ffffff",
          variant: "outline",
        },
      ],
    },
    socialProof: { title: "", feedbacks: [] },
    quickActions: DEFAULT_QUICK_ACTIONS.map((action) => ({ ...action })),
  };
}

function emptyMedia(type: HomeMedia["type"] = "image"): HomeMedia {
  return { ...EMPTY_MEDIA, type };
}

function emptyHeroSlide(): HomeHeroSlide {
  return {
    id: createId("home-hero"),
    title: "",
    description: "",
    media: emptyMedia(),
    active: true,
    mode: "text-media-buttons",
    buttons: [
      { ...EMPTY_BUTTON, enabled: true },
      { ...EMPTY_BUTTON, color: "#ffffff", variant: "outline" },
    ],
  };
}

function emptySection1Item(index: number): HomeInteractiveItem {
  return {
    id: `section1-${index + 1}`,
    order: index + 1,
    title: "",
    description: "",
    media: emptyMedia(),
  };
}

function emptySection2Item(): HomeOperationItem {
  return {
    id: createId("section2"),
    title: "",
    description: "",
    media: emptyMedia(),
    active: true,
  };
}

function emptyServiceCard(index: number): HomeServiceCard {
  return {
    id: index < 3 ? `section3-card-${index + 1}` : createId("section3-card"),
    order: index + 1,
    media: emptyMedia(),
    badge: "",
    title: "",
    description: "",
    ctaLabel: "",
    ctaUrl: "",
  };
}

function emptyFeedback(): HomeFeedback {
  return {
    id: createId("home-feedback"),
    name: "",
    role: "",
    context: "",
    testimonial: "",
    photo: "",
    rating: 5,
    active: true,
  };
}

function emptyRegionalUnit(): HomeRegionalUnit {
  return {
    id: createId("home-unit"),
    name: "",
    state: "SP",
    description: "",
    linkedUnitId: "",
    address: "",
    phone: "",
    email: "",
    additionalEmail: "",
    buttonLabel: "Falar com esta unidade",
    contactUrl: "/fale-conosco",
    active: true,
  };
}

function emptyQuickAction(index: number): QuickAction {
  return {
    id: createId("quick-action"),
    order: index + 1,
    label: "",
    href: "",
    icon: "FileText",
    type: "link",
    enabled: true,
    downloadFile: "",
  };
}

function normalizeTrackingButtons(buttons?: HomeHeroButton[]) {
  const fallback = emptyHomePage().trackingCta.buttons;
  return Array.from({ length: 2 }, (_, index) => ({
    ...fallback[index],
    ...(buttons?.[index] ?? {}),
    enabled: buttons?.[index]?.enabled ?? true,
  }));
}

function normalizeQuickActions(actions?: QuickAction[]) {
  const source = Array.isArray(actions) ? actions : DEFAULT_QUICK_ACTIONS;
  return source.slice(0, 12).map((action, index) => ({
    ...emptyQuickAction(index),
    ...action,
    order: Number(action.order ?? index + 1),
    enabled: action.enabled ?? true,
    downloadFile: action.downloadFile ?? "",
  }));
}

function normalizeHomePage(data?: HomePageContent): HomePageContent {
  const fallback = emptyHomePage();
  if (!data) return fallback;
  return {
    hero: {
      slides: Array.isArray(data.hero?.slides) ? data.hero.slides : [],
    },
    section1: {
      ...fallback.section1,
      ...data.section1,
      items: Array.from({ length: 3 }, (_, index) => {
        const item = data.section1?.items?.[index];
        return item ? { ...emptySection1Item(index), ...item } : emptySection1Item(index);
      }),
    },
    section2: {
      title: data.section2?.title ?? "",
      items: Array.isArray(data.section2?.items) ? data.section2.items.slice(0, 5) : [],
    },
    section3: {
      ...fallback.section3,
      ...data.section3,
      cards:
        Array.isArray(data.section3?.cards) && data.section3.cards.length > 0
          ? data.section3.cards.map((card, index) => ({ ...emptyServiceCard(index), ...card }))
          : fallback.section3.cards,
    },
    regionalPresence: {
      units: Array.isArray(data.regionalPresence?.units)
        ? data.regionalPresence.units
        : [],
    },
    trackingCta: {
      buttons: normalizeTrackingButtons(data.trackingCta?.buttons),
    },
    socialProof: {
      title: data.socialProof?.title ?? "",
      feedbacks: Array.isArray(data.socialProof?.feedbacks)
        ? data.socialProof.feedbacks
        : [],
    },
    quickActions: normalizeQuickActions(data.quickActions),
  };
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [selected] = next.splice(index, 1);
  next.splice(target, 0, selected);
  return next;
}

function CountHint({
  value,
  maxLength,
  maxWords,
}: {
  value: string;
  maxLength?: number;
  maxWords?: number;
}) {
  const words = wordCount(value);
  return (
    <span className="mt-1 block text-[11px] text-[var(--color-muted-raw)]">
      {maxWords ? `${words}/${maxWords} palavras` : null}
      {maxWords && maxLength ? " - " : null}
      {maxLength ? `${value.length}/${maxLength} caracteres` : null}
    </span>
  );
}

function InlineFieldMeta({
  value,
  maxLength,
  guidance,
}: {
  value: string;
  maxLength: number;
  guidance: string;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] leading-5 text-[var(--color-muted-raw)]">
      <span>{value.length}/{maxLength} caracteres</span>
      <span>{guidance}</span>
    </div>
  );
}

const homeFormGroupClassName =
  "cms-home-form-group rounded-[22px] border border-[#93c5fd] bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_48%,#f8fbff_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_rgba(29,78,216,0.1)] ring-1 ring-[var(--primary)]/8 sm:p-5";

const homeNestedPanelClassName =
  "cms-home-nested-panel rounded-[20px] border border-[var(--primary)]/12 bg-white/84 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_6px_16px_rgba(29,78,216,0.025)]";

const homeHighlightPanelClassName =
  "cms-home-highlight-panel rounded-[20px] border border-[#93c5fd] bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_56%,#f8fbff_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(29,78,216,0.09)] ring-1 ring-[var(--primary)]/7";

const homeCtaPanelClassName =
  "cms-home-cta-panel rounded-[20px] border border-[var(--primary)]/18 bg-white p-4 shadow-[0_8px_18px_rgba(29,78,216,0.05)]";

function homeEditableCardClassName(active = true) {
  return cn(
    "cms-home-editable-card overflow-hidden rounded-[24px] border p-4 shadow-[0_12px_28px_rgba(15,23,42,0.045)] transition-colors sm:p-5",
    active
      ? "border-[var(--primary)]/26 bg-[linear-gradient(145deg,rgba(255,255,255,0.94)_0%,rgba(239,246,255,0.86)_100%)]"
      : "border-slate-200/90 bg-slate-50/68"
  );
}

function HomeItemHeader({
  label,
  title,
  description,
  active,
  actions,
}: {
  label: string;
  title: string;
  description: string;
  active?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/70 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--primary)]/14 bg-[var(--primary)]/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
            {label}
          </span>
          {typeof active === "boolean" ? <DeveloperStatusPill active={active} /> : null}
        </div>
        <h3 className="mt-3 text-base font-semibold tracking-[-0.015em] text-[var(--foreground)]">
          {title}
        </h3>
        <p className="mt-1 max-w-[68ch] text-sm leading-6 text-[var(--color-muted-raw)]">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function HomeAccordionCard({
  label,
  title,
  description,
  active,
  open,
  onToggle,
  actions,
  children,
}: {
  label: string;
  title: string;
  description: string;
  active?: boolean;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-[24px] border transition-all duration-300",
        open
          ? "border-[var(--primary)]/34 bg-white shadow-[0_16px_36px_rgba(29,78,216,0.12)] ring-4 ring-[var(--primary)]/8"
          : "border-slate-200/90 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.035)] hover:border-[var(--primary)]/18"
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3 px-4 py-4 transition-colors sm:px-5 lg:flex-row lg:items-start lg:justify-between",
          open ? "bg-[var(--primary)]/6" : ""
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--primary)]/14 bg-[var(--primary)]/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
              {label}
            </span>
            {typeof active === "boolean" ? <DeveloperStatusPill active={active} /> : null}
          </div>
          <h3 className="mt-3 truncate text-base font-semibold tracking-[-0.015em] text-[var(--foreground)]">
            {title}
          </h3>
          <p className="mt-1 max-w-[68ch] text-sm leading-6 text-[var(--color-muted-raw)]">
            {description}
          </p>
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)] bg-white text-[var(--color-muted-raw)] transition-transform duration-300",
              open ? "rotate-180 text-[var(--primary)]" : ""
            )}
            aria-label={open ? "Fechar item" : "Abrir item"}
          >
            <CaretDown size={16} weight="bold" />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-[var(--primary)]/14 bg-white p-4 sm:p-5">{children}</div>
        </div>
      </div>
    </article>
  );
}

function HomeMediaEditor({
  label,
  media,
  onChange,
  required,
  emphasis = false,
}: {
  label: string;
  media: HomeMedia;
  onChange: (media: HomeMedia) => void;
  required?: boolean;
  emphasis?: boolean;
}) {
  const current = { ...EMPTY_MEDIA, ...media };
  const MediaIcon = current.type === "video" ? VideoCamera : ImageSquare;
  const [framingOpen, setFramingOpen] = useState(false);
  return (
    <div
      className={cn(
        "rounded-[22px] border p-4 sm:p-5",
        emphasis
          ? "border-[#93c5fd] bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_52%,#f8fbff_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_26px_rgba(29,78,216,0.1)] ring-1 ring-[var(--primary)]/7"
          : "border-[var(--primary)]/14 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--primary)]/16 bg-[var(--primary)]/8 text-[var(--primary)]">
          <MediaIcon size={20} weight="bold" />
        </span>
        <div>
          <h4 className="text-sm font-semibold text-[var(--foreground)]">{label}</h4>
          <p className="mt-1 max-w-[72ch] text-xs leading-5 text-[var(--color-muted-raw)]">
            Escolha imagem ou vídeo. Vídeos ficam sem conversão; imagens enviadas pela biblioteca viram WebP.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <div className="order-2 lg:order-1">
          <DeveloperMediaPreview
            value={current.src}
            previewAlt={current.alt || label}
            mediaType={current.type}
            onFrame={() => setFramingOpen(true)}
          />
        </div>

        <div className={cn(homeNestedPanelClassName, "order-1 space-y-3 p-3.5 lg:order-2")}>
          <div className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)]">
            <DeveloperField label="Tipo" required={required}>
              <select
                value={current.type}
                onChange={(event) =>
                  onChange({ ...current, type: event.target.value as HomeMedia["type"] })
                }
                className={developerInputClassName}
              >
                <option value="image">Imagem</option>
                <option value="video">Vídeo</option>
              </select>
            </DeveloperField>
            <DeveloperMediaField
              label="Arquivo"
              required={required}
              mediaType={current.type}
              value={current.src}
              onChange={(src) => onChange({ ...current, src })}
              hint="Onde aparece: area visual desta parte da Home."
              previewAlt={current.alt || label}
              showPreview={false}
            />
          </div>
          <div className="grid gap-3 border-t border-[var(--primary)]/10 pt-3 md:grid-cols-2">
            <DeveloperField label="Texto alternativo" className="md:col-span-2">
              <input
                value={current.alt ?? ""}
                onChange={(event) => onChange({ ...current, alt: event.target.value })}
                maxLength={140}
                className={developerInputClassName}
              />
            </DeveloperField>
            <DeveloperMediaField
              label="Midia desktop"
              mediaType={current.type}
              value={current.desktopSrc ?? ""}
              onChange={(desktopSrc) => onChange({ ...current, desktopSrc })}
              hint="Opcional. Substitui o arquivo principal no desktop."
              showPreview={false}
            />
            <DeveloperMediaField
              label="Midia mobile"
              mediaType={current.type}
              value={current.mobileSrc ?? ""}
              onChange={(mobileSrc) => onChange({ ...current, mobileSrc })}
              hint="Opcional. Substitui o arquivo principal no mobile."
              showPreview={false}
            />
          </div>

          {current.type === "video" ? (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/72 p-3">
              <DeveloperMediaField
                label="Poster do video"
                mediaType="image"
                value={current.poster ?? ""}
                onChange={(poster) => onChange({ ...current, poster })}
                hint="Opcional. Imagem exibida antes do video carregar."
                showPreview={false}
              />
            </div>
          ) : null}
        </div>
      </div>
      <MediaPlacementEditor
        label={label}
        src={current.src}
        alt={current.alt || label}
        mediaType={current.type}
        value={current.presentation}
        onChange={(presentation) => onChange({ ...current, presentation })}
        open={framingOpen}
        onOpenChange={setFramingOpen}
        hideTrigger
      />
    </div>
  );
}

function SaveButton({
  saving,
  children,
}: {
  saving: boolean;
  children: string;
}) {
  return (
    <button type="submit" disabled={saving} className={developerPrimaryButtonClassName}>
      <CheckCircle size={18} weight="bold" />
      {saving ? "Salvando..." : children}
    </button>
  );
}

export default function DeveloperHomePage() {
  const { apiRequest } = useApiRequest();
  const [home, setHome] = useState<HomePageContent>(emptyHomePage);
  const [availableUnits, setAvailableUnits] = useState<OperationalUnit[]>([]);
  const [unitsReferenceAvailable, setUnitsReferenceAvailable] = useState<boolean | null>(null);
  const [activeStep, setActiveStep] = useState<HomeStepKey>("hero");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SaveKey | "">("");
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [openHeroSlide, setOpenHeroSlide] = useState<number | null>(null);
  const [openQuickAction, setOpenQuickAction] = useState<number | null>(null);
  const [openSection1Item, setOpenSection1Item] = useState<number | null>(null);
  const [openSection2Item, setOpenSection2Item] = useState<number | null>(null);
  const [openSection3Card, setOpenSection3Card] = useState<number | null>(null);
  const [openRegionalUnit, setOpenRegionalUnit] = useState<number | null>(null);
  const [openFeedback, setOpenFeedback] = useState<number | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const [response, unitsResponse] = await Promise.all([
        apiRequest<{ homePage?: HomePageContent }>(api.admin.home),
        apiRequest<{ items?: OperationalUnit[] }>(api.admin.entity("units")),
      ]);
      if (!alive) return;
      if (response.success) {
        setHome(normalizeHomePage(response.data?.homePage));
        if (unitsResponse.success) {
          setAvailableUnits(unitsResponse.data?.items ?? []);
          setUnitsReferenceAvailable(true);
          setStatus(null);
        } else if (unitsResponse.status === 403) {
          setAvailableUnits([]);
          setUnitsReferenceAvailable(false);
          setStatus({
            tone: "info",
            text: "Seu perfil não pode consultar a lista de Unidades. Os cards da Home continuam disponíveis; vínculos já existentes são preservados.",
          });
        } else {
          setStatus({
            tone: "error",
            text: "Não foi possível carregar as referências de Unidades. Tente novamente.",
          });
        }
      } else {
        setStatus({ tone: "error", text: response.error ?? "Falha ao carregar a Home." });
      }
      setLoading(false);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [apiRequest]);

  const summary = useMemo(
    () => ({
      hero: home.hero.slides.length,
      quickActions: (home.quickActions ?? []).filter((item) => item.enabled !== false).length,
      section2: home.section2.items.length,
      units: home.regionalPresence.units.filter((item) => item.active !== false).length,
      feedbacks: home.socialProof.feedbacks.filter((item) => item.active !== false).length,
    }),
    [home]
  );
  const activeStepIndex = Math.max(
    0,
    HOME_STEPS.findIndex((step) => step.key === activeStep)
  );
  const activeStepInfo = HOME_STEPS[activeStepIndex] ?? HOME_STEPS[0];

  function selectStep(step: HomeStepKey) {
    setActiveStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function moveStep(direction: -1 | 1) {
    const nextStep = HOME_STEPS[activeStepIndex + direction];
    if (nextStep) selectStep(nextStep.key);
  }

  async function saveSection(section: SaveKey, endpoint: string, payload: unknown) {
    setSaving(section);
    setStatus(null);
    const response = await apiRequest<{ homePage?: HomePageContent }>(endpoint, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setSaving("");

    if (!response.success) {
      setStatus({ tone: "error", text: response.error ?? "Falha ao salvar a Home." });
      return;
    }

    setHome(normalizeHomePage(response.data?.homePage));
    setPreviewRevision((revision) => revision + 1);
    setStatus({ tone: "success", text: "Bloco salvo com sucesso." });
    invalidateAdminResource([adminResourceKeys.dashboard, adminResourceKeys.images]);
  }

  function updateHeroSlide(index: number, patch: Partial<HomeHeroSlide>) {
    setHome((current) => ({
      ...current,
      hero: {
        slides: current.hero.slides.map((slide, slideIndex) =>
          slideIndex === index ? { ...slide, ...patch } : slide
        ),
      },
    }));
  }

  function updateQuickAction(index: number, patch: Partial<QuickAction>) {
    setHome((current) => {
      const quickActions = normalizeQuickActions(current.quickActions);
      quickActions[index] = { ...quickActions[index], ...patch };
      return {
        ...current,
        quickActions,
      };
    });
  }

  function addQuickAction() {
    setHome((current) => {
      const quickActions = [
        ...normalizeQuickActions(current.quickActions),
        emptyQuickAction(normalizeQuickActions(current.quickActions).length),
      ];
      setOpenQuickAction(quickActions.length - 1);
      return {
        ...current,
        quickActions,
      };
    });
  }

  function removeQuickAction(index: number) {
    setHome((current) => {
      const quickActions = normalizeQuickActions(current.quickActions).filter(
        (_, actionIndex) => actionIndex !== index
      );
      setOpenQuickAction((open) => {
        if (open === null) return null;
        return Math.max(0, Math.min(open, quickActions.length - 1));
      });
      return {
        ...current,
        quickActions,
      };
    });
  }

  function updateSection1Item(index: number, patch: Partial<HomeInteractiveItem>) {
    setHome((current) => ({
      ...current,
      section1: {
        ...current.section1,
        items: current.section1.items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item
        ),
      },
    }));
  }

  function updateSection2Item(index: number, patch: Partial<HomeOperationItem>) {
    setHome((current) => ({
      ...current,
      section2: {
        ...current.section2,
        items: current.section2.items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item
        ),
      },
    }));
  }

  function updateSection3Card(index: number, patch: Partial<HomeServiceCard>) {
    setHome((current) => ({
      ...current,
      section3: {
        ...current.section3,
        cards: current.section3.cards.map((card, cardIndex) =>
          cardIndex === index ? { ...card, ...patch } : card
        ),
      },
    }));
  }

  function addSection3Card() {
    setHome((current) => {
      const cards = [...current.section3.cards, emptyServiceCard(current.section3.cards.length)];
      setOpenSection3Card(cards.length - 1);
      return {
        ...current,
        section3: {
          ...current.section3,
          cards,
        },
      };
    });
  }

  function removeSection3Card(index: number) {
    setHome((current) => {
      const cards = current.section3.cards.filter((_, cardIndex) => cardIndex !== index);
      setOpenSection3Card((open) => {
        if (open === null) return null;
        return Math.max(0, Math.min(open, cards.length - 1));
      });
      return {
        ...current,
        section3: {
          ...current.section3,
          cards,
        },
      };
    });
  }

  function updateRegionalUnit(index: number, patch: Partial<HomeRegionalUnit>) {
    setHome((current) => ({
      ...current,
      regionalPresence: {
        units: current.regionalPresence.units.map((unit, unitIndex) =>
          unitIndex === index ? { ...unit, ...patch } : unit
        ),
      },
    }));
  }

  function addRegionalUnit() {
    setHome((current) => {
      const units = [...current.regionalPresence.units, emptyRegionalUnit()];
      setOpenRegionalUnit(units.length - 1);
      return {
        ...current,
        regionalPresence: { units },
      };
    });
  }

  function removeRegionalUnit(index: number) {
    setHome((current) => {
      const units = current.regionalPresence.units.filter((_, unitIndex) => unitIndex !== index);
      setOpenRegionalUnit((open) => {
        if (open === null || open === index) return null;
        return open > index ? open - 1 : open;
      });
      return {
        ...current,
        regionalPresence: { units },
      };
    });
  }

  function applyLinkedUnit(index: number, linkedUnitId: string) {
    const linked = availableUnits.find((unit) => unit.id === linkedUnitId);
    if (!linked) {
      updateRegionalUnit(index, { linkedUnitId });
      return;
    }
    updateRegionalUnit(index, {
      linkedUnitId,
      name: linked.name || "",
      state: (linked.state || "SP").toUpperCase(),
      description: linked.description || linked.type || "",
      address: linked.address || "",
      phone: linked.phone || "",
      email: linked.email || "",
      additionalEmail: linked.additionalEmail || "",
      contactUrl: linked.contactUrl || "/fale-conosco",
    });
  }

  function updateTrackingButton(index: number, patch: Partial<HomeHeroButton>) {
    setHome((current) => {
      const buttons = normalizeTrackingButtons(current.trackingCta.buttons);
      buttons[index] = { ...buttons[index], ...patch };
      return {
        ...current,
        trackingCta: { buttons },
      };
    });
  }

  function updateFeedback(index: number, patch: Partial<HomeFeedback>) {
    setHome((current) => ({
      ...current,
      socialProof: {
        ...current.socialProof,
        feedbacks: current.socialProof.feedbacks.map((feedback, feedbackIndex) =>
          feedbackIndex === index ? { ...feedback, ...patch } : feedback
        ),
      },
    }));
  }

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="Home — Página Inicial"
        title="Editor completo da Home."
        description="Edite os blocos principais da página."
        stats={[
          { label: "Hero", value: summary.hero },
          { label: "Atalhos", value: summary.quickActions },
          { label: "Seção 2", value: summary.section2 },
          { label: "Unidades", value: summary.units },
          { label: "Feedbacks", value: summary.feedbacks },
        ]}
      />

      {loading ? (
        <div className="mt-5">
          <DeveloperMessage tone="info">Carregando configuracao da Home...</DeveloperMessage>
        </div>
      ) : null}
      {status ? (
        <div className="mt-5">
          <DeveloperMessage tone={status.tone}>{status.text}</DeveloperMessage>
        </div>
      ) : null}
      <div className="mt-5">
        <DeveloperResponsivePreview href={site.home} title="Preview Home" revision={previewRevision} />
      </div>

      <section className="mt-5 rounded-[22px] border border-[var(--primary)]/16 bg-[linear-gradient(135deg,rgba(219,234,254,0.9)_0%,rgba(239,246,255,0.86)_54%,rgba(224,242,254,0.78)_100%)] p-3.5 shadow-[0_12px_28px_rgba(29,78,216,0.08)] backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Editar etapa {activeStepIndex + 1} de {HOME_STEPS.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[var(--foreground)]">
              {activeStepInfo.title}
            </h2>
            <p className="mt-0.5 max-w-[68ch] text-xs leading-5 text-[var(--color-muted-raw)]">
              {activeStepInfo.description}
            </p>
          </div>
          <div className="inline-flex w-fit items-center rounded-full border border-[var(--primary)]/14 bg-white/72 p-1 shadow-[0_8px_20px_rgba(29,78,216,0.07)]">
            <button
              type="button"
              onClick={() => moveStep(-1)}
              disabled={activeStepIndex === 0}
              className={cn(
                "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              <CaretLeft size={16} weight="bold" />
              Anterior
            </button>
            <button
              type="button"
              onClick={() => moveStep(1)}
              disabled={activeStepIndex === HOME_STEPS.length - 1}
              className={cn(
                "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              Proximo
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        </div>

        <nav className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8" aria-label="Etapas do editor da Home">
          {HOME_STEPS.map((step, index) => {
            const active = step.key === activeStep;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => selectStep(step.key)}
                aria-current={active ? "step" : undefined}
                title={`Etapa ${index + 1}: ${step.title}`}
                className={cn(
                  "group inline-flex min-h-10 min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-300",
                  active
                    ? "border-[var(--primary)]/38 bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(219,234,254,0.92)_100%)] text-[var(--foreground)] shadow-[0_6px_16px_rgba(29,78,216,0.12)]"
                    : "border-slate-200/90 bg-white text-[var(--foreground)] shadow-[0_4px_10px_rgba(15,23,42,0.025)] hover:-translate-y-0.5 hover:border-[var(--primary)]/30 hover:shadow-[0_8px_16px_rgba(15,23,42,0.06)]"
                )}
              >
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold", active ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_3px_8px_rgba(29,78,216,0.18)]" : "border-[var(--primary)]/14 bg-[var(--primary)]/7 text-[var(--primary)]")}>
                  {index + 1}
                </span>
                <span className="truncate text-xs font-semibold leading-4">{step.title}</span>
              </button>
            );
          })}
        </nav>
      </section>

      <div className="mt-5 grid gap-5">
        {activeStep === "hero" ? (
        <DeveloperCard id="hero" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="Etapa 1 - topo da Home"
            title="Hero principal"
            description="Controla o carrossel inicial. Use 'somente mídia completa' para banners sem texto nem botões."
            action={
              <button
                type="button"
                onClick={() =>
                  setHome((current) => ({
                    ...current,
                    hero: { slides: [...current.hero.slides, emptyHeroSlide()] },
                  }))
                }
                className={developerSecondaryButtonClassName}
              >
                <Plus size={16} weight="bold" />
                Novo slide
              </button>
            }
          />
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSection("hero", api.admin.homeHero, home.hero);
            }}
          >
            {home.hero.slides.length === 0 ? (
              <DeveloperMessage tone="info">Nenhum slide cadastrado. A Home oculta o hero ate existir um slide valido.</DeveloperMessage>
            ) : null}
            {home.hero.slides.map((slide, index) => (
              <HomeAccordionCard
                key={slide.id}
                label={`Slide ${index + 1}`}
                title={slide.title || "Slide sem titulo"}
                description="Mídia, textos e botões exibidos no carrossel principal da Home."
                active={slide.active !== false}
                open={openHeroSlide === index}
                onToggle={() => setOpenHeroSlide(openHeroSlide === index ? null : index)}
                actions={
                  <>
                  <button type="button" onClick={() => setHome((current) => ({ ...current, hero: { slides: moveItem(current.hero.slides, index, -1) } }))} className={developerGhostButtonClassName}>
                    <ArrowUp size={16} weight="bold" />
                    Subir
                  </button>
                  <button type="button" onClick={() => setHome((current) => ({ ...current, hero: { slides: moveItem(current.hero.slides, index, 1) } }))} className={developerGhostButtonClassName}>
                    <ArrowDown size={16} weight="bold" />
                    Descer
                  </button>
                  <button type="button" onClick={() => setHome((current) => ({ ...current, hero: { slides: current.hero.slides.filter((_, itemIndex) => itemIndex !== index) } }))} className={developerDangerButtonClassName}>
                    <Trash size={16} weight="bold" />
                    Remover
                  </button>
                  </>
                }
              >
                <div className={cn(homeHighlightPanelClassName, "grid gap-5 lg:grid-cols-3")}>
                  <DeveloperField label="Modo de exibicao" required hint="Define os elementos exibidos no slide do hero.">
                    <select value={slide.mode} onChange={(event) => updateHeroSlide(index, { mode: event.target.value as HomeHeroMode })} className={developerInputClassName}>
                      <option value="text-media-buttons">Texto + mídia + botões</option>
                      <option value="text-media">Texto + mídia sem botões</option>
                      <option value="media-only">Somente mídia completa</option>
                    </select>
                  </DeveloperField>
                  <DeveloperField label="Título" required={slide.mode !== "media-only"} hint="Onde aparece: chamada principal do hero. Máximo esperado: 2 linhas.">
                    <input value={slide.title} onChange={(event) => updateHeroSlide(index, { title: event.target.value })} maxLength={120} className={developerInputClassName} />
                    <CountHint value={slide.title} maxLength={120} />
                  </DeveloperField>
                  <DeveloperField label="Status do slide" hint="Desative para ocultar este slide no carrossel.">
                    <span className="flex min-h-10 items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
                      <input type="checkbox" checked={slide.active !== false} onChange={(event) => updateHeroSlide(index, { active: event.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
                      Slide ativo
                    </span>
                  </DeveloperField>
                </div>
                {slide.mode !== "media-only" ? (
                  <div className={cn(homeCtaPanelClassName, "mt-4")}>
                    <DeveloperField label="Descrição" required hint="Onde aparece: parágrafo abaixo do título. Máximo esperado: 3 linhas.">
                      <textarea value={slide.description} onChange={(event) => updateHeroSlide(index, { description: event.target.value })} maxLength={420} rows={3} className={`${developerInputClassName} resize-none`} />
                      <CountHint value={slide.description} maxLength={420} />
                    </DeveloperField>
                  </div>
                ) : null}
                <div className="mt-4">
                  <HomeMediaEditor label="Mídia do hero" media={slide.media} required emphasis onChange={(media) => updateHeroSlide(index, { media })} />
                </div>
                {slide.mode === "text-media-buttons" ? (
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    {[0, 1].map((buttonIndex) => {
                      const button = slide.buttons[buttonIndex] ?? EMPTY_BUTTON;
                      const buttons = [...slide.buttons];
                      const updateButton = (patch: Partial<HomeHeroButton>) => {
                        buttons[buttonIndex] = { ...button, ...patch };
                        updateHeroSlide(index, { buttons });
                      };
                      return (
                        <div key={buttonIndex} className={homeCtaPanelClassName}>
                          <DeveloperSectionHeading title={`Botao ${buttonIndex + 1}`} description="Texto e link do CTA exibido sobre o hero." />
                          <div className="grid gap-5 sm:grid-cols-2">
                            <DeveloperField label="Texto">
                              <input value={button.label} onChange={(event) => updateButton({ label: event.target.value })} maxLength={40} className={developerInputClassName} />
                            </DeveloperField>
                            <DeveloperField label="Link">
                              <input value={button.url} onChange={(event) => updateButton({ url: event.target.value })} className={developerInputClassName} />
                            </DeveloperField>
                            <DeveloperColorField label="Cor" value={button.color || "#1d4ed8"} onChange={(color) => updateButton({ color })} />
                            <DeveloperField label="Visual">
                              <select value={button.variant ?? "solid"} onChange={(event) => updateButton({ variant: event.target.value as HomeHeroButton["variant"] })} className={developerInputClassName}>
                                <option value="solid">Solido</option>
                                <option value="outline">Outline</option>
                              </select>
                            </DeveloperField>
                          </div>
                          <label className="mt-4 flex min-h-10 items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
                            <input type="checkbox" checked={button.enabled} onChange={(event) => updateButton({ enabled: event.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
                            Botao ativo
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </HomeAccordionCard>
            ))}
            <SaveButton saving={saving === "hero"}>Salvar Hero</SaveButton>
          </form>
        </DeveloperCard>
        ) : null}

        {activeStep === "quickActions" ? (
        <DeveloperCard id="quick-actions" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="Etapa 2 - atalhos abaixo do hero"
            title="Atalhos rápidos e botão de Taxas"
            description="Controle os botões compactos exibidos logo abaixo do hero. Downloads só aparecem no site quando estiverem ativos e com URL configurada; ao ocultar Taxas, os atalhos restantes são centralizados automaticamente."
            action={
              <button type="button" onClick={addQuickAction} className={developerSecondaryButtonClassName}>
                <Plus size={16} weight="bold" />
                Novo atalho
              </button>
            }
          />
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSection("quickActions", api.admin.homeQuickActions, {
                quickActions: normalizeQuickActions(home.quickActions),
              });
            }}
          >
            {normalizeQuickActions(home.quickActions).map((action, index) => {
              const target = action.type === "download" ? action.downloadFile || action.href : action.href;
              return (
                <HomeAccordionCard
                  key={action.id}
                  label={`Atalho ${index + 1}`}
                  title={action.label || "Atalho sem texto"}
                  description={
                    action.type === "download"
                      ? target
                        ? "Download configurado para a faixa de atalhos."
                        : "Download oculto no site até receber uma URL."
                      : target
                        ? "Atalho configurado para a faixa abaixo do hero."
                        : "Atalho oculto no site até receber um destino."
                  }
                  active={action.enabled !== false && Boolean(action.label && target)}
                  open={openQuickAction === index}
                  onToggle={() => setOpenQuickAction(openQuickAction === index ? null : index)}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setHome((current) => ({
                            ...current,
                            quickActions: moveItem(normalizeQuickActions(current.quickActions), index, -1),
                          }))
                        }
                        className={developerGhostButtonClassName}
                      >
                        <ArrowUp size={16} weight="bold" />
                        Subir
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setHome((current) => ({
                            ...current,
                            quickActions: moveItem(normalizeQuickActions(current.quickActions), index, 1),
                          }))
                        }
                        className={developerGhostButtonClassName}
                      >
                        <ArrowDown size={16} weight="bold" />
                        Descer
                      </button>
                      <button type="button" onClick={() => removeQuickAction(index)} className={developerDangerButtonClassName}>
                        <Trash size={16} weight="bold" />
                        Remover
                      </button>
                    </>
                  }
                >
                  <div className={cn(homeNestedPanelClassName, "grid gap-5 md:grid-cols-3")}>
                    <DeveloperField label="Texto do botão" required>
                      <input
                        value={action.label}
                        onChange={(event) => updateQuickAction(index, { label: event.target.value })}
                        maxLength={40}
                        className={developerInputClassName}
                      />
                    </DeveloperField>
                    <DeveloperField label="Tipo" required>
                      <select
                        value={action.type}
                        onChange={(event) =>
                          updateQuickAction(index, {
                            type: event.target.value as QuickAction["type"],
                          })
                        }
                        className={developerInputClassName}
                      >
                        {QUICK_ACTION_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </DeveloperField>
                    <DeveloperField label="Ícone" required>
                      <select
                        value={action.icon}
                        onChange={(event) => updateQuickAction(index, { icon: event.target.value })}
                        className={developerInputClassName}
                      >
                        {QUICK_ACTION_ICON_OPTIONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {icon}
                          </option>
                        ))}
                      </select>
                    </DeveloperField>
                  </div>

                  <div className={cn(homeNestedPanelClassName, "mt-4 grid gap-5 md:grid-cols-3")}>
                    <DeveloperField label={action.type === "modal" ? "Âncora" : "Link"} required={action.type !== "download"}>
                      <input
                        value={action.href}
                        onChange={(event) => updateQuickAction(index, { href: event.target.value })}
                        className={developerInputClassName}
                        placeholder={action.type === "modal" ? "#mapa-regional" : "/cotacao"}
                      />
                    </DeveloperField>
                    <DeveloperField
                      label="Arquivo para download"
                      required={action.type === "download"}
                      hint="Use uma URL interna ou externa do PDF. Este campo alimenta o botão Taxas."
                    >
                      <input
                        value={action.downloadFile ?? ""}
                        onChange={(event) => updateQuickAction(index, { downloadFile: event.target.value })}
                        className={developerInputClassName}
                        placeholder="/uploads/taxas.pdf"
                      />
                    </DeveloperField>
                    <DeveloperField label="Visibilidade" helpKey="visibilidade-do-atalho" hint="Desative para ocultar este atalho no site.">
                      <span className="inline-flex min-h-10 w-fit items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={action.enabled !== false}
                          onChange={(event) => updateQuickAction(index, { enabled: event.target.checked })}
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        Atalho ativo
                      </span>
                    </DeveloperField>
                  </div>

                  {action.type === "download" && action.enabled !== false && !target ? (
                    <div className="mt-4">
                      <DeveloperMessage tone="info">
                        Este download está ativo, mas ficará oculto no site até receber uma URL de arquivo ou link.
                      </DeveloperMessage>
                    </div>
                  ) : null}
                </HomeAccordionCard>
              );
            })}
            <SaveButton saving={saving === "quickActions"}>Salvar atalhos</SaveButton>
          </form>
        </DeveloperCard>
        ) : null}

        {activeStep === "section1" ? (
        <DeveloperCard id="section-1" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="Etapa 3 - primeira seção após os atalhos"
            title="Previsibilidade para crescer"
            description="Exatamente 3 itens clicáveis. A descrição é truncada visualmente em 2 linhas no site."
          />
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void saveSection("section1", api.admin.homeSection1, home.section1); }}>
            <div className={cn(homeFormGroupClassName, "grid gap-5 md:grid-cols-3")}>
              <DeveloperField label="Título principal" required hint="Onde aparece: topo da Seção 1. Máximo esperado: 2 linhas.">
                <input value={home.section1.title} onChange={(event) => setHome((current) => ({ ...current, section1: { ...current.section1, title: event.target.value } }))} maxLength={140} className={developerInputClassName} />
                <CountHint value={home.section1.title} maxLength={140} />
              </DeveloperField>
              <DeveloperField label="Texto do botão final" required>
                <input value={home.section1.ctaLabel} onChange={(event) => setHome((current) => ({ ...current, section1: { ...current.section1, ctaLabel: event.target.value } }))} maxLength={40} className={developerInputClassName} />
              </DeveloperField>
              <DeveloperField label="Link do botão final" required>
                <input value={home.section1.ctaUrl} onChange={(event) => setHome((current) => ({ ...current, section1: { ...current.section1, ctaUrl: event.target.value } }))} className={developerInputClassName} />
              </DeveloperField>
            </div>
            {home.section1.items.map((item, index) => (
              <HomeAccordionCard
                key={item.id}
                label={`Item ${index + 1}`}
                title={item.title || "Item clicavel sem titulo"}
                description="Ao clicar, troca a mídia exibida no lado esquerdo da seção."
                open={openSection1Item === index}
                onToggle={() => setOpenSection1Item(openSection1Item === index ? null : index)}
              >
                <div className={cn(homeHighlightPanelClassName, "grid gap-5 md:grid-cols-2")}>
                  <DeveloperField label="Título curto" required hint="Limite forte: máximo 3 a 5 palavras.">
                    <input value={item.title} onChange={(event) => updateSection1Item(index, { title: event.target.value })} maxLength={60} className={developerInputClassName} />
                    <CountHint value={item.title} maxWords={5} maxLength={60} />
                  </DeveloperField>
                  <DeveloperField label="Descrição curta" required hint="No site será cortada com reticências se passar de 2 linhas.">
                    <textarea value={item.description} onChange={(event) => updateSection1Item(index, { description: event.target.value })} maxLength={180} rows={3} className={`${developerInputClassName} resize-none`} />
                    <CountHint value={item.description} maxLength={180} />
                  </DeveloperField>
                </div>
                <div className="mt-4">
                  <HomeMediaEditor label={`Mídia do item ${index + 1}`} media={item.media} required emphasis onChange={(media) => updateSection1Item(index, { media })} />
                </div>
              </HomeAccordionCard>
            ))}
            <SaveButton saving={saving === "section1"}>Salvar Seção 1</SaveButton>
          </form>
        </DeveloperCard>
        ) : null}

        {activeStep === "section2" ? (
        <DeveloperCard id="section-2" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="Etapa 4 - área de operação"
            title="Todas as frentes da operação se encontram aqui"
            description="Máximo de 5 itens. A ordem aqui define a ordem desktop e mobile."
            action={
              <button
                type="button"
                disabled={home.section2.items.length >= 5}
                onClick={() => setHome((current) => ({ ...current, section2: { ...current.section2, items: [...current.section2.items, emptySection2Item()] } }))}
                className={developerSecondaryButtonClassName}
              >
                <Plus size={16} weight="bold" />
                Novo item
              </button>
            }
          />
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveSection("section2", api.admin.homeSection2, home.section2); }}>
            <div className={homeFormGroupClassName}>
              <DeveloperField label="Título principal" required hint="Onde aparece: título da faixa escura da Seção 2.">
                <input value={home.section2.title} onChange={(event) => setHome((current) => ({ ...current, section2: { ...current.section2, title: event.target.value } }))} maxLength={160} className={developerInputClassName} />
                <CountHint value={home.section2.title} maxLength={160} />
              </DeveloperField>
            </div>
            {home.section2.items.map((item, index) => (
              <HomeAccordionCard
                key={item.id}
                label={`Item ${index + 1}`}
                title={item.title || "Item sem titulo"}
                description="Título e descrição aparecem sobre a mídia no card ativo."
                active={item.active !== false}
                open={openSection2Item === index}
                onToggle={() => setOpenSection2Item(openSection2Item === index ? null : index)}
                actions={
                  <>
                  <button type="button" data-cms-collection-action="up" onClick={() => setHome((current) => ({ ...current, section2: { ...current.section2, items: moveItem(current.section2.items, index, -1) } }))} className={developerGhostButtonClassName}><ArrowUp size={16} weight="bold" />Subir</button>
                  <button type="button" data-cms-collection-action="down" onClick={() => setHome((current) => ({ ...current, section2: { ...current.section2, items: moveItem(current.section2.items, index, 1) } }))} className={developerGhostButtonClassName}><ArrowDown size={16} weight="bold" />Descer</button>
                  <DeveloperConfirmButton actionType="remove" message={`O item “${item.title || "sem título"}” será removido da seção.`} onConfirm={() => setHome((current) => ({ ...current, section2: { ...current.section2, items: current.section2.items.filter((_, itemIndex) => itemIndex !== index) } }))}><Trash size={16} weight="bold" />Remover</DeveloperConfirmButton>
                  </>
                }
              >
                <div className={cn(homeHighlightPanelClassName, "grid gap-5 md:grid-cols-2")}>
                  <DeveloperField label="Título" required hint="Máximo esperado: 3 linhas.">
                    <input value={item.title} onChange={(event) => updateSection2Item(index, { title: event.target.value })} maxLength={120} className={developerInputClassName} />
                    <CountHint value={item.title} maxLength={120} />
                  </DeveloperField>
                  <DeveloperField label="Descrição" required hint="Máximo esperado: 3 linhas.">
                    <textarea value={item.description} onChange={(event) => updateSection2Item(index, { description: event.target.value })} maxLength={260} rows={3} className={`${developerInputClassName} resize-none`} />
                    <CountHint value={item.description} maxLength={260} />
                  </DeveloperField>
                </div>
                <label className="my-4 flex min-h-10 items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
                  <input type="checkbox" checked={item.active !== false} onChange={(event) => updateSection2Item(index, { active: event.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
                  Item ativo
                </label>
                <HomeMediaEditor label={`Mídia do item ${index + 1}`} media={item.media} required emphasis onChange={(media) => updateSection2Item(index, { media })} />
              </HomeAccordionCard>
            ))}
            <SaveButton saving={saving === "section2"}>Salvar Seção 2</SaveButton>
          </form>
        </DeveloperCard>
        ) : null}

        {activeStep === "section3" ? (
        <DeveloperCard id="section-3" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="Etapa 5 — linhas de serviço"
            title="Soluções para a complexidade da sua operação"
            description="O site mostra 3 cards por página, com paginação visual e rotação automática."
            action={
              <button type="button" onClick={addSection3Card} className={developerSecondaryButtonClassName}>
                <Plus size={16} weight="bold" />
                Novo card
              </button>
            }
          />
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void saveSection("section3", api.admin.homeSection3, home.section3); }}>
            <div className={cn(homeFormGroupClassName, "space-y-3 p-3.5 sm:p-4")}>
              <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
                <DeveloperField label="Badge" required>
                  <input value={home.section3.badge} onChange={(event) => setHome((current) => ({ ...current, section3: { ...current.section3, badge: event.target.value } }))} maxLength={60} className={developerInputClassName} />
                </DeveloperField>
                <DeveloperField label="Título principal" required>
                  <input value={home.section3.title} onChange={(event) => setHome((current) => ({ ...current, section3: { ...current.section3, title: event.target.value } }))} maxLength={180} className={developerInputClassName} />
                  <InlineFieldMeta value={home.section3.title} maxLength={180} guidance="Máximo esperado: 3 linhas." />
                </DeveloperField>
                <DeveloperField label="Texto do botão" required>
                  <input value={home.section3.ctaLabel} onChange={(event) => setHome((current) => ({ ...current, section3: { ...current.section3, ctaLabel: event.target.value } }))} maxLength={40} className={developerInputClassName} />
                </DeveloperField>
                <DeveloperField label="Link do botão" required>
                  <input value={home.section3.ctaUrl} onChange={(event) => setHome((current) => ({ ...current, section3: { ...current.section3, ctaUrl: event.target.value } }))} className={developerInputClassName} />
                </DeveloperField>
              </div>
              <DeveloperField label="Descrição principal" required>
                <textarea value={home.section3.description} onChange={(event) => setHome((current) => ({ ...current, section3: { ...current.section3, description: event.target.value } }))} maxLength={420} rows={3} className={`${developerInputClassName} resize-none`} />
                <InlineFieldMeta value={home.section3.description} maxLength={420} guidance="Máximo esperado: 4 linhas." />
              </DeveloperField>
            </div>
            {home.section3.cards.map((card, index) => (
              <HomeAccordionCard
                key={card.id}
                label={`Card ${index + 1}`}
                title={card.title || "Card fixo sem titulo"}
                description="Card da Seção 3. O título tem limite forte de 2 palavras."
                open={openSection3Card === index}
                onToggle={() => setOpenSection3Card(openSection3Card === index ? null : index)}
                actions={
                  <>
                    <button type="button" data-cms-collection-action="up" onClick={() => setHome((current) => ({ ...current, section3: { ...current.section3, cards: moveItem(current.section3.cards, index, -1) } }))} className={developerGhostButtonClassName}><ArrowUp size={16} weight="bold" />Subir</button>
                    <button type="button" data-cms-collection-action="down" onClick={() => setHome((current) => ({ ...current, section3: { ...current.section3, cards: moveItem(current.section3.cards, index, 1) } }))} className={developerGhostButtonClassName}><ArrowDown size={16} weight="bold" />Descer</button>
                    <DeveloperConfirmButton actionType="remove" message={`O card “${card.title || "sem título"}” será removido da seção.`} onConfirm={() => removeSection3Card(index)}><Trash size={16} weight="bold" />Remover</DeveloperConfirmButton>
                  </>
                }
              >
                <div className={cn(homeHighlightPanelClassName, "grid gap-5 md:grid-cols-3")}>
                  <DeveloperField label="Badge pequeno" required>
                    <input value={card.badge} onChange={(event) => updateSection3Card(index, { badge: event.target.value })} maxLength={60} className={developerInputClassName} />
                  </DeveloperField>
                  <DeveloperField label="Título do card" required>
                    <input value={card.title} onChange={(event) => updateSection3Card(index, { title: event.target.value })} maxLength={80} className={developerInputClassName} />
                    <CountHint value={card.title} maxWords={2} maxLength={80} />
                  </DeveloperField>
                  <DeveloperField label="Texto do botão interno" required>
                    <input value={card.ctaLabel} onChange={(event) => updateSection3Card(index, { ctaLabel: event.target.value })} maxLength={40} className={developerInputClassName} />
                  </DeveloperField>
                </div>
                <div className={cn(homeCtaPanelClassName, "mt-4 grid gap-5 md:grid-cols-2")}>
                  <DeveloperField label="Descrição do card" required hint="Máximo esperado: 5 linhas.">
                    <textarea value={card.description} onChange={(event) => updateSection3Card(index, { description: event.target.value })} maxLength={320} rows={4} className={`${developerInputClassName} resize-none`} />
                    <CountHint value={card.description} maxLength={320} />
                  </DeveloperField>
                  <DeveloperField label="Link do botão interno" required>
                    <input value={card.ctaUrl} onChange={(event) => updateSection3Card(index, { ctaUrl: event.target.value })} className={developerInputClassName} />
                  </DeveloperField>
                </div>
                <div className="mt-4">
                  <HomeMediaEditor label={`Mídia do card ${index + 1}`} media={card.media} required emphasis onChange={(media) => updateSection3Card(index, { media })} />
                </div>
              </HomeAccordionCard>
            ))}
            <SaveButton saving={saving === "section3"}>Salvar Seção 3</SaveButton>
          </form>
        </DeveloperCard>
        ) : null}

        {activeStep === "regionalPresence" ? (
        <DeveloperCard id="regional-presence" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="Etapa 6 - Presença Regional"
            title="Unidades exibidas na Página Inicial"
            description="Cada card é salvo dentro da Home. A lista antiga de unidades serve apenas como referência para preencher campos."
            action={
              <button type="button" onClick={addRegionalUnit} className={developerSecondaryButtonClassName}>
                <Plus size={16} weight="bold" />
                Adicionar unidade
              </button>
            }
          />
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSection("regionalPresence", api.admin.homeRegionalPresence, home.regionalPresence);
            }}
          >
            {home.regionalPresence.units.length === 0 ? (
              <DeveloperMessage tone="info">
                Nenhuma unidade cadastrada para a Home. Adicione a primeira unidade para exibir a seção no site.
              </DeveloperMessage>
            ) : null}

            {home.regionalPresence.units.map((unit, index) => (
              <HomeAccordionCard
                key={unit.id}
                label={`Unidade ${index + 1}`}
                title={unit.name || "Unidade sem nome"}
                description={unit.description || "Card da seção Presença Regional."}
                active={unit.active !== false}
                open={openRegionalUnit === index}
                onToggle={() => setOpenRegionalUnit(openRegionalUnit === index ? null : index)}
                actions={
                  <>
                    <button
                      type="button"
                      data-cms-collection-action="up"
                      onClick={() => {
                        setHome((current) => ({ ...current, regionalPresence: { units: moveItem(current.regionalPresence.units, index, -1) } }));
                        setOpenRegionalUnit((open) => {
                          if (index === 0 || open === null) return open;
                          if (open === index) return index - 1;
                          if (open === index - 1) return index;
                          return open;
                        });
                      }}
                      className={developerGhostButtonClassName}
                    >
                      <ArrowUp size={16} weight="bold" />
                      Subir
                    </button>
                    <button
                      type="button"
                      data-cms-collection-action="down"
                      onClick={() => {
                        setHome((current) => ({ ...current, regionalPresence: { units: moveItem(current.regionalPresence.units, index, 1) } }));
                        setOpenRegionalUnit((open) => {
                          if (index === home.regionalPresence.units.length - 1 || open === null) return open;
                          if (open === index) return index + 1;
                          if (open === index + 1) return index;
                          return open;
                        });
                      }}
                      className={developerGhostButtonClassName}
                    >
                      <ArrowDown size={16} weight="bold" />
                      Descer
                    </button>
                    <DeveloperConfirmButton
                      actionType="remove"
                      message={`A unidade “${unit.name || "sem nome"}” será removida da Página Inicial.`}
                      onConfirm={() => removeRegionalUnit(index)}
                    >
                      <Trash size={16} weight="bold" />
                      Remover
                    </DeveloperConfirmButton>
                  </>
                }
              >

                  <div className={cn(homeNestedPanelClassName, "grid gap-5 lg:grid-cols-3")}>
                    {unitsReferenceAvailable === false ? (
                      <DeveloperField label="Vínculo com unidade cadastrada" hint="O vínculo existente é preservado ao salvar a Home.">
                        <p className="rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm leading-6 text-[var(--color-muted-raw)]">
                          Seu perfil não tem acesso à lista de Unidades. Você ainda pode editar somente os dados deste card da Página Inicial.
                        </p>
                      </DeveloperField>
                    ) : (
                      <DeveloperField label="Vínculo com unidade cadastrada" hint="Opcional. Ao selecionar, os campos principais são preenchidos como ponto de partida.">
                        <select
                          value={unit.linkedUnitId ?? ""}
                          onChange={(event) => applyLinkedUnit(index, event.target.value)}
                          className={developerInputClassName}
                          disabled={unitsReferenceAvailable === null}
                        >
                          <option value="">{unitsReferenceAvailable === null ? "Carregando unidades..." : "Sem vínculo"}</option>
                          {availableUnits.map((availableUnit) => (
                            <option key={availableUnit.id} value={availableUnit.id}>
                              {availableUnit.name} - {(availableUnit.state || "").toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </DeveloperField>
                    )}
                    <DeveloperField label="Nome da unidade" required>
                      <input
                        value={unit.name}
                        onChange={(event) => updateRegionalUnit(index, { name: event.target.value })}
                        maxLength={90}
                        className={developerInputClassName}
                        placeholder="Matriz Agudos"
                      />
                    </DeveloperField>
                    <DeveloperField label="UF" required>
                      <select
                        value={(unit.state || "SP").toUpperCase()}
                        onChange={(event) => updateRegionalUnit(index, { state: event.target.value })}
                        className={developerInputClassName}
                      >
                        {BRAZIL_UFS.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </DeveloperField>
                  </div>

                  <div className={cn(homeNestedPanelClassName, "mt-4 grid gap-5 lg:grid-cols-2")}>
                    <DeveloperField label="Descrição curta" required hint="Máximo recomendado: 2 linhas.">
                      <textarea
                        value={unit.description}
                        onChange={(event) => updateRegionalUnit(index, { description: event.target.value })}
                        maxLength={220}
                        rows={2}
                        className={`${developerInputClassName} resize-none`}
                        placeholder="Base central"
                      />
                      <CountHint value={unit.description} maxLength={220} />
                    </DeveloperField>
                    <DeveloperField label="Endereço" required>
                      <textarea
                        value={unit.address}
                        onChange={(event) => updateRegionalUnit(index, { address: event.target.value })}
                        maxLength={220}
                        rows={2}
                        className={`${developerInputClassName} resize-none`}
                      />
                    </DeveloperField>
                  </div>

                  <div className={cn(homeNestedPanelClassName, "mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-5")}>
                    <DeveloperField label="Telefone">
                      <input
                        value={unit.phone}
                        onChange={(event) => updateRegionalUnit(index, { phone: event.target.value })}
                        maxLength={60}
                        className={developerInputClassName}
                      />
                    </DeveloperField>
                    <DeveloperField label="E-mail">
                      <input
                        type="email"
                        value={unit.email}
                        onChange={(event) => updateRegionalUnit(index, { email: event.target.value })}
                        maxLength={120}
                        className={developerInputClassName}
                      />
                    </DeveloperField>
                    <DeveloperField label="E-mail adicional" required>
                      <input
                        type="email"
                        required
                        value={unit.additionalEmail ?? ""}
                        onChange={(event) => updateRegionalUnit(index, { additionalEmail: event.target.value })}
                        maxLength={120}
                        className={developerInputClassName}
                      />
                    </DeveloperField>
                    <DeveloperField label="Texto do botão">
                      <input
                        value={unit.buttonLabel ?? ""}
                        onChange={(event) => updateRegionalUnit(index, { buttonLabel: event.target.value })}
                        maxLength={40}
                        className={developerInputClassName}
                      />
                    </DeveloperField>
                    <DeveloperField label="Link do botão" required>
                      <input
                        value={unit.contactUrl}
                        onChange={(event) => updateRegionalUnit(index, { contactUrl: event.target.value })}
                        className={developerInputClassName}
                        placeholder="/fale-conosco"
                      />
                    </DeveloperField>
                  </div>

                  <label className="mt-4 flex min-h-10 items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={unit.active !== false}
                      onChange={(event) => updateRegionalUnit(index, { active: event.target.checked })}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    Unidade ativa no site
                  </label>
              </HomeAccordionCard>
            ))}

            <SaveButton saving={saving === "regionalPresence"}>Salvar Presença Regional</SaveButton>
          </form>
        </DeveloperCard>
        ) : null}

        {activeStep === "trackingCta" ? (
        <DeveloperCard id="tracking-cta" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="Etapa 7 - Rastreie sua carga"
            title="Botões da seção de rastreio"
            description="Edite somente texto e link dos dois botões exibidos na Página Inicial."
          />
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSection("trackingCta", api.admin.homeTrackingCta, home.trackingCta);
            }}
          >
            <div className="grid gap-5 lg:grid-cols-2">
              {normalizeTrackingButtons(home.trackingCta.buttons).map((button, index) => (
                <div key={index} className={homeEditableCardClassName(button.enabled !== false)}>
                  <HomeItemHeader
                    label={`Botão ${index + 1}`}
                    title={button.label || `Botão ${index + 1}`}
                    description={index === 0 ? "Botão principal de acesso ao rastreio." : "Botão secundário de orientação."}
                    active={button.enabled !== false}
                  />
                  <div className={cn(homeNestedPanelClassName, "grid gap-5 sm:grid-cols-2")}>
                    <DeveloperField label="Texto do botão" required>
                      <input
                        value={button.label}
                        onChange={(event) => updateTrackingButton(index, { label: event.target.value })}
                        maxLength={40}
                        className={developerInputClassName}
                      />
                    </DeveloperField>
                    <DeveloperField label="Link do botão" required>
                      <input
                        value={button.url}
                        onChange={(event) => updateTrackingButton(index, { url: event.target.value })}
                        className={developerInputClassName}
                      />
                    </DeveloperField>
                  </div>
                  <label className="mt-4 flex min-h-10 items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={button.enabled !== false}
                      onChange={(event) => updateTrackingButton(index, { enabled: event.target.checked })}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    Botão ativo
                  </label>
                </div>
              ))}
            </div>
            <SaveButton saving={saving === "trackingCta"}>Salvar botões de rastreio</SaveButton>
          </form>
        </DeveloperCard>
        ) : null}

        {activeStep === "socialProof" ? (
        <DeveloperCard id="social-proof" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="Etapa 8 - carrossel de depoimentos"
            title="Prova Social da Home"
            description="Lista livre de relatos autorizados. A ordem aqui é a ordem exibida no carrossel da Home; empresas não são publicadas."
            action={
              <button type="button" onClick={() => setHome((current) => ({ ...current, socialProof: { ...current.socialProof, feedbacks: [...current.socialProof.feedbacks, emptyFeedback()] } }))} className={developerSecondaryButtonClassName}>
                <Plus size={16} weight="bold" />
                Novo feedback
              </button>
            }
          />
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveSection("socialProof", api.admin.homeSocialProof, home.socialProof); }}>
            <div className={homeFormGroupClassName}>
              <DeveloperField label="Título principal" required hint="Onde aparece: topo da Prova Social. Máximo esperado: 2 linhas.">
                <input value={home.socialProof.title} onChange={(event) => setHome((current) => ({ ...current, socialProof: { ...current.socialProof, title: event.target.value } }))} maxLength={160} className={developerInputClassName} />
                <CountHint value={home.socialProof.title} maxLength={160} />
              </DeveloperField>
            </div>
            {home.socialProof.feedbacks.map((feedback, index) => (
              <HomeAccordionCard
                key={feedback.id}
                label={`Feedback ${index + 1}`}
                title={feedback.name || "Feedback sem nome"}
                description="Foto autorizada, contexto da operação, depoimento e avaliação exibidos no card."
                active={feedback.active !== false}
                open={openFeedback === index}
                onToggle={() => setOpenFeedback(openFeedback === index ? null : index)}
                actions={
                  <>
                  <button type="button" data-cms-collection-action="up" onClick={() => setHome((current) => ({ ...current, socialProof: { ...current.socialProof, feedbacks: moveItem(current.socialProof.feedbacks, index, -1) } }))} className={developerGhostButtonClassName}><ArrowUp size={16} weight="bold" />Subir</button>
                  <button type="button" data-cms-collection-action="down" onClick={() => setHome((current) => ({ ...current, socialProof: { ...current.socialProof, feedbacks: moveItem(current.socialProof.feedbacks, index, 1) } }))} className={developerGhostButtonClassName}><ArrowDown size={16} weight="bold" />Descer</button>
                  <DeveloperConfirmButton actionType="remove" title="Confirmar exclusão" message={`O depoimento de ${feedback.name || "esta pessoa"} será excluído.`} onConfirm={() => setHome((current) => ({ ...current, socialProof: { ...current.socialProof, feedbacks: current.socialProof.feedbacks.filter((_, feedbackIndex) => feedbackIndex !== index) } }))}><Trash size={16} weight="bold" />Excluir</DeveloperConfirmButton>
                  </>
                }
              >
                <div className={cn(homeCtaPanelClassName, "grid gap-5 md:grid-cols-4")}>
                  <DeveloperField label="Nome da pessoa" required hint="Use somente o nome de uma pessoa que autorizou a publicação do relato.">
                    <input value={feedback.name} onChange={(event) => updateFeedback(index, { name: event.target.value })} maxLength={80} className={developerInputClassName} />
                  </DeveloperField>
                  <DeveloperField label="Cargo ou perfil" required hint="Exemplo: Coordenadora de logística. Não informe a empresa da pessoa.">
                    <input value={feedback.role} onChange={(event) => updateFeedback(index, { role: event.target.value })} maxLength={80} className={developerInputClassName} />
                  </DeveloperField>
                  <DeveloperField label="Contexto da operação" required hint="Descreva o tema com palavras úteis para busca, como “Distribuição nacional” ou “Logística industrial”, sem citar empresas.">
                    <input value={feedback.context} onChange={(event) => updateFeedback(index, { context: event.target.value })} maxLength={120} className={developerInputClassName} />
                  </DeveloperField>
                  <DeveloperField label="Estrelas" required>
                    <input type="number" min={1} max={5} value={feedback.rating} onChange={(event) => updateFeedback(index, { rating: Math.min(5, Math.max(1, Number(event.target.value) || 1)) })} className={developerInputClassName} />
                  </DeveloperField>
                </div>
                <div className={cn(homeHighlightPanelClassName, "mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)] lg:items-start")}>
                  <DeveloperField label="Depoimento" required>
                    <textarea value={feedback.testimonial} onChange={(event) => updateFeedback(index, { testimonial: event.target.value })} maxLength={800} rows={6} className={`${developerInputClassName} min-h-44 resize-none`} />
                    <CountHint value={feedback.testimonial} maxLength={800} />
                  </DeveloperField>
                  <div className="min-w-0">
                    <DeveloperMediaField
                      label="Foto da pessoa (opcional)"
                      mediaType="image"
                      value={feedback.photo ?? ""}
                      onChange={(photo) => updateFeedback(index, { photo })}
                      previewAlt={feedback.name}
                      stackControls={Boolean(feedback.photo)}
                      showPreview={Boolean(feedback.photo)}
                      hint="Use apenas foto autorizada da pessoa. Sem foto, a Home mostra as iniciais do nome; logos de empresas não são usados nesta seção."
                      afterControls={
                        <label className="inline-flex min-h-10 items-center gap-3 self-start rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
                          <input type="checkbox" checked={feedback.active !== false} onChange={(event) => updateFeedback(index, { active: event.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
                          Feedback ativo
                        </label>
                      }
                    />
                  </div>
                </div>
              </HomeAccordionCard>
            ))}
            <SaveButton saving={saving === "socialProof"}>Salvar Prova Social</SaveButton>
          </form>
        </DeveloperCard>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[var(--border)] bg-white/82 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)]">
        <button
          type="button"
          onClick={() => moveStep(-1)}
          disabled={activeStepIndex === 0}
          className={cn(
            developerSecondaryButtonClassName,
            "rounded-full px-5 disabled:cursor-not-allowed disabled:opacity-45"
          )}
        >
          <CaretLeft size={16} weight="bold" />
          Anterior
        </button>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-raw)]">
          Pagina {activeStepIndex + 1} de {HOME_STEPS.length}
        </span>
        <button
          type="button"
          onClick={() => moveStep(1)}
          disabled={activeStepIndex === HOME_STEPS.length - 1}
          className={cn(
            developerSecondaryButtonClassName,
            "rounded-full px-5 disabled:cursor-not-allowed disabled:opacity-45"
          )}
        >
          Proximo
          <CaretRight size={16} weight="bold" />
        </button>
      </div>
    </DeveloperPage>
  );
}
