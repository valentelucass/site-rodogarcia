"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ArrowSquareOut, Eye, FloppyDisk, RocketLaunch } from "@phosphor-icons/react";
import type { LandingMedia } from "@/components/developer/LandingVisualEditor";
import { CampaignV1Editor, type CampaignV1Landing } from "@/components/developer/landing-templates/CampaignV1Editor";
import {
  DeveloperCard,
  DeveloperCarouselPagination,
  DeveloperField,
  DeveloperHelp,
  DeveloperHero,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  DeveloperStatusPill,
  developerInputClassName,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
} from "@/components/developer/ui";
import { useApiRequest } from "@/hooks/useApiRequest";
import { adminResourceKeys, invalidateAdminResource, useAdminResource } from "@/hooks/useAdminResource";
import { api, siteUrl } from "@/lib/routes";

type LandingStatus = "draft" | "published" | "unpublished" | "archived";

type LandingRevision = { id: string; operation: string; createdAt: string };

type LandingForm = {
  id?: string;
  template: "campaign-v1";
  name: string;
  slug: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    font: "system" | "space-grotesk" | "plus-jakarta";
  };
  analytics: {
    ga4MeasurementId: string;
  };
  seo: {
    title: string;
    description: string;
    index: boolean;
  };
  hero: {
    phone: string;
    email: string;
    logo: string;
    backgroundImage: string;
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel: string;
    ctaUrl: string;
    highlights: Array<{ title: string; description: string }>;
  };
} & CampaignV1Landing & {
  status?: LandingStatus;
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
  revisionCount?: number;
};

type LandingMediaListResponse = { media?: LandingMedia[] };

type LandingTemplate = LandingForm["template"];
type NewProjectStep = "template" | "name";

const LANDING_TEMPLATES: ReadonlyArray<{
  id: LandingTemplate;
  name: string;
  summary: string;
  details: string;
}> = [{
  id: "campaign-v1",
  name: "Landing comercial",
  summary: "Estrutura completa para apresentar uma solução e captar oportunidades.",
  details: "Inclui Hero, cobertura, serviços, números, mídia, soluções, feedbacks, FAQ e CTA final.",
}];

const LANDING_TEMPLATES_PER_PAGE = 8;
const LANDING_PROJECTS_PER_PAGE = 8;

const createBlankLanding = (template: LandingTemplate = "campaign-v1"): LandingForm => ({
  template,
  name: "Novo projeto",
  slug: "novo-projeto",
  theme: { primaryColor: "#111111", secondaryColor: "#2A2A2A", backgroundColor: "#FFFFFF", textColor: "#171717", font: "system" },
  analytics: { ga4MeasurementId: "" },
  seo: { title: "", description: "", index: true },
  hero: {
    phone: "",
    email: "",
    logo: "",
    backgroundImage: "",
    eyebrow: "Campanha em destaque",
    title: "Uma solução preparada para o seu desafio",
    description: "Apresente a proposta principal da campanha com uma mensagem direta, clara e orientada à ação.",
    ctaLabel: "Fale com nossa equipe",
    ctaUrl: "",
    highlights: [
      { title: "Diferencial 01", description: "Apresente um benefício relevante para o público." },
      { title: "Diferencial 02", description: "Explique por que esta solução faz sentido." },
      { title: "Diferencial 03", description: "Destaque um ponto que ajude na decisão." },
    ],
  },
  lowerSection: {
    visible: true,
    title: "Conectamos os maiores polos industriais do Brasil",
    description: "Operamos com soluções de alta performance em todo o território nacional para operações dedicadas e posições de armazenagem e distribuição.",
    formTitle: "Fale com um especialista em logística B2B",
    formDescription: "Preencha o formulário abaixo. Nossa equipe analisará sua demanda e entrará em contato.",
    submitLabel: "Receber solução personalizada",
    mapBaseColor: "#A9D4EF",
    mapBranchColor: "#2E2882",
    mapBorderColor: "#FFFFFF",
    ctaLabel: "",
    ctaUrl: "",
  },
  benefits: { visible: true, eyebrow: "Nossos serviços", title: "Soluções inteligentes de armazenagem e gestão de estoque", description: "", items: [{ title: "Recebimento e preparação de pedidos", description: "Entrada rigorosa da mercadoria, conferência cega, separação e picking otimizados para cada pedido." }, { title: "Picking e packing", description: "Armazenagem, etiquetagem e organização do estoque com separação, montagem de kits e expedição ágil." }, { title: "Controle de estoque e rastreabilidade", description: "Gestão integrada com inventário cíclico, acuracidade e controle por lote ou validade." }, { title: "Armazenagem estruturada e flexível", description: "Infraestrutura para absorver picos sazonais e apoiar diferentes necessidades da operação." }] },
  story: { visible: true, eyebrow: "Por que escolher esta estrutura", title: "Infraestrutura, segurança e tecnologia de ponta", description: "Mostre como a operação se organiza para atender a demanda com consistência e escala.", image: "", items: [{ title: "Operação preparada", description: "Organize a estrutura e os processos que sustentam a sua rotina logística." }, { title: "Visibilidade em tempo real", description: "Apresente os recursos que mantêm a operação acompanhada em cada etapa." }, { title: "Segurança e escala", description: "Destaque como a estrutura acompanha o crescimento do seu negócio." }], ctaLabel: "", ctaUrl: "" },
  metrics: { visible: true, eyebrow: "", title: "", items: [{ value: "10.850 m²", label: "Área de armazenagem", description: "Infraestrutura e capacidade instalada para uma operação segura, uniforme e eficiente." }, { value: "8", label: "Centros de distribuição", description: "Hubs e unidades estratégicas para conectar operações em diferentes regiões." }, { value: "+36", label: "Anos de mercado", description: "Experiência e solidez para conduzir operações com confiança." }] },
  showcase: { visible: true, eyebrow: "Soluções sob medida", title: "Soluções de armazenagem para diversos produtos", description: "Apresente a estrutura, os processos e a capacidade que tornam esta operação preparada para diferentes demandas.", backgroundImage: "", ctaLabel: "Fazer cotação", ctaUrl: "", items: [{ title: "Cargas e produtos industriais", description: "Estrutura preparada para receber e gerenciar fluxos industriais de grande porte." }, { title: "Matéria-prima", description: "Infraestrutura flexível para recebimento, controle e armazenagem de insumos essenciais." }, { title: "Bens de distribuição geral", description: "Movimentação eficiente com suporte para acelerar o abastecimento dos seus canais." }] },
  testimonial: { visible: true, eyebrow: "Nossa história", title: "Solidez, tradição e inovação estruturada na gestão do seu estoque", description: "A confiança de quem acompanha a nossa operação mostra o cuidado que levamos para cada etapa da logística.", items: [{ name: "Cliente atendido", detail: "Operação industrial", quote: "Inclua aqui uma avaliação autorizada que descreva a experiência com a operação.", rating: 5 }, { name: "Cliente atendido", detail: "Distribuição nacional", quote: "Use feedbacks reais para reforçar a confiança antes do próximo contato.", rating: 5 }, { name: "Cliente atendido", detail: "Operação dedicada", quote: "Apresente uma fala curta, objetiva e aprovada pelo cliente.", rating: 5 }], quote: "", author: "", role: "" },
  faq: { visible: true, eyebrow: "Dúvidas frequentes", title: "Tudo o que você precisa saber", items: [{ question: "Como funciona esta solução?", answer: "Descreva de forma direta como a pessoa começa e o que pode esperar." }, { question: "Como solicitar atendimento?", answer: "Use o botão principal para orientar o próximo passo da campanha." }, { question: "Onde encontro mais informações?", answer: "Inclua nesta resposta os canais ou condições importantes para o público." }] },
  finalCta: { visible: true, eyebrow: "Próximo passo", title: "Vamos conversar sobre a sua necessidade?", description: "Finalize a campanha com uma chamada direta e um único destino de conversão.", backgroundImage: "", ctaLabel: "Entrar em contato", ctaUrl: "" },
  footer: { brand: "Sua empresa", description: "Uma mensagem curta para encerrar a campanha.", phone: "", email: "", legalText: "Todos os direitos reservados." },
});

function normalizeLanding(landing: LandingForm): LandingForm {
  const blank = createBlankLanding();
  return {
    ...blank,
    ...landing,
    theme: { ...blank.theme, ...landing.theme },
    analytics: { ...blank.analytics, ...landing.analytics },
    seo: { ...blank.seo, ...landing.seo },
    hero: {
      ...blank.hero,
      ...landing.hero,
      highlights: landing.hero?.highlights?.length ? landing.hero.highlights : blank.hero.highlights,
    },
    lowerSection: { ...blank.lowerSection, ...landing.lowerSection },
    benefits: { ...blank.benefits, ...landing.benefits, items: landing.benefits?.items?.length ? landing.benefits.items : blank.benefits.items },
    story: { ...blank.story, ...landing.story, items: landing.story?.items?.length ? landing.story.items : blank.story.items },
    metrics: { ...blank.metrics, ...landing.metrics, items: landing.metrics?.items?.length ? landing.metrics.items : blank.metrics.items },
    showcase: { ...blank.showcase, ...landing.showcase, items: landing.showcase?.items?.length ? landing.showcase.items : blank.showcase.items },
    testimonial: { ...blank.testimonial, ...landing.testimonial, items: landing.testimonial?.items?.length ? landing.testimonial.items : blank.testimonial.items },
    faq: { ...blank.faq, ...landing.faq, items: landing.faq?.items?.length ? landing.faq.items : blank.faq.items },
    finalCta: { ...blank.finalCta, ...landing.finalCta },
    footer: { ...blank.footer, ...landing.footer },
  };
}

function labelForStatus(status?: LandingStatus) {
  return status === "published" ? "Publicada" : status === "unpublished" ? "Despublicada" : status === "archived" ? "Arquivada" : "Rascunho";
}

function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function projectSlugFromName(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
  return slug || "projeto";
}

function availableProjectSlug(name: string, landings: LandingForm[]) {
  const base = projectSlugFromName(name);
  const occupied = new Set(landings.map((landing) => landing.slug));
  if (!occupied.has(base)) return base;

  for (let suffix = 2; ; suffix += 1) {
    const appendix = `-${suffix}`;
    const candidate = `${base.slice(0, 80 - appendix.length).replace(/-+$/g, "")}${appendix}`;
    if (!occupied.has(candidate)) return candidate;
  }
}

function LandingTemplatePreview() {
  return <div aria-hidden="true" className="relative h-full overflow-hidden rounded-lg border border-slate-200 bg-[#f5f7fb] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
    <div className="absolute inset-x-0 top-0 h-[52%] overflow-hidden bg-[#112c4b] px-[9%] pt-[8%]"><div className="flex items-center justify-between"><span className="h-1.5 w-[18%] rounded-full bg-white/75" /><span className="h-1 w-[30%] rounded-full bg-white/30" /></div><div className="mt-[12%] h-1.5 w-[35%] rounded-full bg-sky-200/80" /><div className="mt-[5%] h-3 w-[70%] rounded-full bg-white" /><div className="mt-[3%] h-3 w-[52%] rounded-full bg-white" /><div className="mt-[8%] h-1.5 w-[66%] rounded-full bg-white/45" /><div className="mt-[3%] h-1.5 w-[51%] rounded-full bg-white/45" /><span className="mt-[9%] block h-4 w-[32%] rounded bg-[#2a55d9]" /><div className="absolute -right-[15%] -top-[28%] size-[68%] rounded-full border-[18px] border-sky-300/10" /></div>
    <div className="absolute inset-x-0 top-[52%] grid h-[48%] grid-rows-[0.9fr_0.65fr_0.8fr] gap-[5%] px-[9%] py-[7%]"><div className="grid grid-cols-[1.1fr_0.9fr] gap-[7%]"><div><span className="block h-2 w-[74%] rounded-full bg-slate-700" /><span className="mt-[10%] block h-1.5 w-full rounded-full bg-slate-300" /><span className="mt-[7%] block h-1.5 w-[76%] rounded-full bg-slate-300" /></div><div className="rounded bg-sky-100"><span className="m-[13%] block h-[74%] rounded bg-[#2e2882]/75" /></div></div><div className="grid grid-cols-3 gap-[6%]"><span className="rounded bg-[#172b46]" /><span className="rounded bg-[#172b46]" /><span className="rounded bg-[#172b46]" /></div><div className="rounded bg-slate-100 p-[8%]"><span className="block h-1.5 w-[55%] rounded-full bg-slate-600" /><span className="mt-[8%] block h-1 w-full rounded-full bg-slate-300" /><span className="mt-[6%] block h-1 w-[78%] rounded-full bg-slate-300" /></div></div>
  </div>;
}

function LandingProjectPreview({ landing }: { landing: LandingForm }) {
  const primary = landing.theme.primaryColor || "#2a55d9";
  const secondary = landing.theme.secondaryColor || "#172b46";
  const background = landing.theme.backgroundColor || "#f5f7fb";
  const title = landing.hero.title.trim() || landing.name;

  return <div aria-hidden="true" className="relative h-full overflow-hidden" style={{ background }}>
    <div className="absolute inset-x-0 top-0 h-[56%] px-[9%] pt-[8%]" style={{ background: secondary }}>
      <div className="flex items-center justify-between"><span className="h-1.5 w-[18%] rounded-full bg-white/80" /><span className="h-1 w-[28%] rounded-full bg-white/30" /></div>
      <span className="mt-[12%] block h-1.5 w-[28%] rounded-full bg-white/55" />
      <p className="mt-[4%] max-w-[72%] overflow-hidden text-[clamp(6px,1.15vw,11px)] font-bold leading-[1.1] text-white" style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3 }}>{title}</p>
      <span className="mt-[8%] block h-4 w-[32%] rounded" style={{ background: primary }} />
      <span className="absolute -right-[15%] -top-[45%] size-[75%] rounded-full border-[18px] border-white/10" />
    </div>
    <div className="absolute inset-x-0 bottom-0 grid h-[44%] grid-rows-[1fr_0.72fr] gap-[12%] px-[9%] py-[7%]">
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-[8%]"><div><span className="block h-1.5 w-[72%] rounded-full bg-slate-700" /><span className="mt-[9%] block h-1 w-full rounded-full bg-slate-300" /><span className="mt-[7%] block h-1 w-[76%] rounded-full bg-slate-300" /></div><div className="rounded" style={{ background: `${primary}24` }}><span className="m-[13%] block h-[74%] rounded" style={{ background: primary }} /></div></div>
      <div className="grid grid-cols-3 gap-[7%]"><span className="rounded" style={{ background: secondary }} /><span className="rounded" style={{ background: secondary }} /><span className="rounded" style={{ background: secondary }} /></div>
    </div>
  </div>;
}

function LandingProjectCard({ landing, active, onOpen }: { landing: LandingForm; active: boolean; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className={`group flex h-full min-h-[216px] w-full flex-col overflow-hidden rounded-xl border text-left shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.11)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 ${active ? "border-[var(--primary)] bg-[var(--primary)]/[0.06] ring-1 ring-[var(--primary)]/15" : "border-[var(--border)] bg-white/80 hover:border-[var(--primary)]/45"}`}>
    <div className="relative aspect-[16/7] w-full shrink-0 border-b border-[var(--border)]/70 bg-slate-100"><LandingProjectPreview landing={landing} /><span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.13em] text-white">Prévia</span></div>
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--primary)]">Landing comercial</p><h3 className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">{landing.name}</h3></div><DeveloperStatusPill active={landing.status === "published"} activeLabel="Publicada" inactiveLabel={labelForStatus(landing.status)} /></div>
      <p className="mt-2 truncate font-mono text-[10px] text-[var(--color-muted-raw)]">/{landing.slug}</p>
      <span className="mt-auto flex items-center justify-between border-t border-[var(--border)]/75 pt-2.5 text-[11px] font-bold text-[var(--primary)]">Editar projeto <ArrowRight size={14} weight="bold" className="transition-transform duration-200 group-hover:translate-x-0.5" /></span>
    </div>
  </button>;
}

export default function LandingPagesPage() {
  const { apiRequest } = useApiRequest();
  const [form, setForm] = useState<LandingForm>(createBlankLanding);
  const [creatingNew, setCreatingNew] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<LandingTemplate | null>(null);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectStep, setNewProjectStep] = useState<NewProjectStep>("template");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTemplate, setNewProjectTemplate] = useState<LandingTemplate>("campaign-v1");
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [templatesPage, setTemplatesPage] = useState(0);
  const [projectsPage, setProjectsPage] = useState(0);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [openingPreview, setOpeningPreview] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [unpublishAt, setUnpublishAt] = useState("");
  const [revisions, setRevisions] = useState<LandingRevision[]>([]);
  const { data, loading, error, refresh } = useAdminResource<{ landings: LandingForm[] }>({
    key: adminResourceKeys.landings,
    fetcher: (request) => request<{ landings: LandingForm[] }>(api.admin.landings),
  });
  const { data: mediaData, loading: mediaLoading, error: mediaError, refresh: refreshMedia } = useAdminResource<LandingMediaListResponse>({
    key: "admin:landing-media",
    fetcher: (request) => request<LandingMediaListResponse>(api.admin.landingMedia),
  });
  const landings = useMemo(() => data?.landings?.map(normalizeLanding) ?? [], [data?.landings]);
  const media = mediaData?.media ?? [];
  const templatesTotalPages = Math.max(1, Math.ceil(LANDING_TEMPLATES.length / LANDING_TEMPLATES_PER_PAGE));
  const visibleTemplates = useMemo(() => LANDING_TEMPLATES.slice(templatesPage * LANDING_TEMPLATES_PER_PAGE, (templatesPage + 1) * LANDING_TEMPLATES_PER_PAGE), [templatesPage]);
  const projectsTotalPages = Math.max(1, Math.ceil(landings.length / LANDING_PROJECTS_PER_PAGE));
  const visibleProjects = useMemo(() => landings.slice(projectsPage * LANDING_PROJECTS_PER_PAGE, (projectsPage + 1) * LANDING_PROJECTS_PER_PAGE), [landings, projectsPage]);

  useEffect(() => {
    setTemplatesPage((current) => Math.min(current, templatesTotalPages - 1));
  }, [templatesTotalPages]);

  useEffect(() => {
    setProjectsPage((current) => Math.min(current, projectsTotalPages - 1));
  }, [projectsTotalPages]);

  useEffect(() => {
    if (!creatingNew && !form.id && landings.length > 0) {
      const next = landings[0]!;
      setForm(next);
      setSavedFingerprint(JSON.stringify(next));
      setPublishAt(localDateTime(next.scheduledPublishAt));
      setUnpublishAt(localDateTime(next.scheduledUnpublishAt));
    }
  }, [creatingNew, form.id, landings]);
  const hasUnsavedChanges = Boolean(form.id && savedFingerprint && JSON.stringify(form) !== savedFingerprint);

  function openNewProjectDialog() {
    setSelectedTemplate(null);
    setNewProjectStep("template");
    setTemplatesPage(0);
    setNewProjectName("");
    setNewProjectError(null);
    setNewProjectDialogOpen(true);
  }

  function chooseProjectTemplate(template: LandingTemplate) {
    setSelectedTemplate(template);
    setNewProjectTemplate(template);
    setNewProjectName("");
    setNewProjectError(null);
    setNewProjectStep("name");
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name) {
      setNewProjectError("Informe um nome para criar o projeto.");
      return;
    }

    setCreatingProject(true);
    setNewProjectError(null);
    const draft = createBlankLanding(newProjectTemplate);
    const result = await apiRequest<{ landing: LandingForm }>(api.admin.landings, {
      method: "POST",
      body: JSON.stringify({ ...draft, name, slug: availableProjectSlug(name, landings) }),
    });
    setCreatingProject(false);

    if (!result.success || !result.data?.landing) {
      setNewProjectError(result.error ?? "Não foi possível criar o projeto.");
      return;
    }

    const created = normalizeLanding(result.data.landing);
    setSelectedTemplate(newProjectTemplate);
    setForm(created);
    setCreatingNew(false);
    setSavedFingerprint(JSON.stringify(created));
    setPreviewPath(null);
    setRevisions([]);
    setPublishAt(localDateTime(created.scheduledPublishAt));
    setUnpublishAt(localDateTime(created.scheduledUnpublishAt));
    setNewProjectStep("template");
    setNewProjectDialogOpen(false);
    setMessage({ tone: "success", text: "Projeto criado como rascunho. Agora personalize o conteúdo e salve as próximas alterações." });
    invalidateAdminResource(adminResourceKeys.landings);
    await refresh();
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const endpoint = form.id ? api.admin.landing(form.id) : api.admin.landings;
    const result = await apiRequest<{ landing: LandingForm }>(endpoint, {
      method: form.id ? "PUT" : "POST",
      body: JSON.stringify(form),
    });
    setSaving(false);

    if (!result.success) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível salvar a landing." });
      return;
    }

    if (result.data?.landing) {
      const saved = normalizeLanding(result.data.landing);
      setForm(saved);
      setSavedFingerprint(JSON.stringify(saved));
      setPublishAt(localDateTime(saved.scheduledPublishAt));
      setUnpublishAt(localDateTime(saved.scheduledUnpublishAt));
    }
    setCreatingNew(false);
    setMessage({ tone: "success", text: "Landing page salva como rascunho. Agora você pode abrir a prévia privada." });
    invalidateAdminResource(adminResourceKeys.landings);
    await refresh();
  }

  async function changePublication(publish: boolean) {
    if (!form.id) {
      setMessage({ tone: "error", text: "Salve o rascunho antes de publicar." });
      return;
    }

    setSaving(true);
    setMessage(null);
    const result = await apiRequest<{ landing: LandingForm }>(
      publish ? api.admin.publishLanding(form.id) : api.admin.unpublishLanding(form.id),
      { method: "POST" },
    );
    setSaving(false);

    if (!result.success) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível alterar a publicação." });
      return;
    }

    if (result.data?.landing) setForm(normalizeLanding(result.data.landing));
    setMessage({ tone: "success", text: publish ? "Landing page publicada." : "Landing page despublicada." });
    invalidateAdminResource(adminResourceKeys.landings);
    await refresh();
  }

  async function openPreview() {
    if (!form.id) {
      setMessage({ tone: "error", text: "Salve o rascunho antes de abrir a prévia." });
      return;
    }
    if (hasUnsavedChanges) {
      setMessage({ tone: "error", text: "Salve o rascunho antes de abrir a prévia pública; ela sempre mostra a última versão persistida." });
      return;
    }

    setOpeningPreview(true);
    setMessage(null);
    const result = await apiRequest<{ previewPath: string }>(api.admin.landingPreview(form.id));
    setOpeningPreview(false);

    if (!result.success || !result.data?.previewPath) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível gerar a prévia privada." });
      return;
    }

    setPreviewPath(result.data.previewPath);
    window.open(siteUrl(result.data.previewPath), "_blank", "noopener,noreferrer");
  }

  async function uploadMedia(file: File, alt = ""): Promise<LandingMedia | null> {
    setUploadingMedia(true);
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    body.append("alt", alt);
    const result = await apiRequest<{ media: LandingMedia }>(api.admin.landingMedia, { method: "POST", body });
    setUploadingMedia(false);

    const uploaded = result.data?.media;
    if (!result.success || !uploaded) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível enviar a imagem." });
      return null;
    }

    invalidateAdminResource("admin:landing-media");
    await refreshMedia();
    setMessage({ tone: "success", text: "Mídia enviada, tratada e selecionada nesta área. Salve a landing para publicar a alteração." });
    return uploaded;
  }

  async function duplicateLanding() {
    if (!form.id) return;
    const result = await apiRequest<{ landing: LandingForm }>(api.admin.duplicateLanding(form.id), { method: "POST" });
    if (!result.success || !result.data?.landing) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível duplicar a campanha." });
      return;
    }
    const duplicated = normalizeLanding(result.data.landing);
    setCreatingNew(false);
    setForm(duplicated);
    setSavedFingerprint(JSON.stringify(duplicated));
    setPreviewPath(null);
    setMessage({ tone: "success", text: "Campanha duplicada como rascunho independente." });
    invalidateAdminResource(adminResourceKeys.landings);
    await refresh();
  }

  async function archiveLanding() {
    if (!form.id) return;
    const result = await apiRequest<{ landing: LandingForm }>(api.admin.archiveLanding(form.id), { method: "POST" });
    if (!result.success || !result.data?.landing) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível arquivar a campanha." });
      return;
    }
    const archived = normalizeLanding(result.data.landing);
    setForm(archived);
    setSavedFingerprint(JSON.stringify(archived));
    setMessage({ tone: "success", text: "Campanha arquivada. Ela pode ser excluída com segurança quando não for mais necessária." });
    invalidateAdminResource(adminResourceKeys.landings);
    await refresh();
  }

  async function deleteLanding() {
    if (!form.id || form.status !== "archived" || !window.confirm("Excluir definitivamente esta campanha arquivada? As mídias continuam preservadas na biblioteca.")) return;
    const result = await apiRequest(api.admin.landing(form.id), { method: "DELETE" });
    if (!result.success) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível excluir a campanha." });
      return;
    }
    setCreatingNew(true);
    setForm(createBlankLanding());
    setSavedFingerprint("");
    setPreviewPath(null);
    setRevisions([]);
    setMessage({ tone: "success", text: "Campanha removida. Nenhuma mídia compartilhada foi excluída." });
    invalidateAdminResource(adminResourceKeys.landings);
    await refresh();
  }

  async function saveSchedule() {
    if (!form.id) return;
    const result = await apiRequest<{ landing: LandingForm }>(api.admin.scheduleLanding(form.id), {
      method: "POST",
      body: JSON.stringify({ publishAt: isoDateTime(publishAt), unpublishAt: isoDateTime(unpublishAt) }),
    });
    if (!result.success || !result.data?.landing) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível programar a campanha." });
      return;
    }
    const scheduled = normalizeLanding(result.data.landing);
    setForm(scheduled);
    setSavedFingerprint(JSON.stringify(scheduled));
    setMessage({ tone: "success", text: "Programação salva. A campanha é publicada e despublicada automaticamente nos horários informados." });
    invalidateAdminResource(adminResourceKeys.landings);
    await refresh();
  }

  async function loadRevisions() {
    if (!form.id) return;
    const result = await apiRequest<{ revisions: LandingRevision[] }>(api.admin.landingRevisions(form.id));
    if (!result.success) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível carregar o histórico." });
      return;
    }
    setRevisions(result.data?.revisions ?? []);
  }

  async function rollback(revisionId: string) {
    if (!form.id || !window.confirm("Restaurar esta revisão? O estado atual ficará salvo no histórico antes da restauração.")) return;
    const result = await apiRequest<{ landing: LandingForm }>(api.admin.rollbackLanding(form.id, revisionId), { method: "POST" });
    if (!result.success || !result.data?.landing) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível restaurar a revisão." });
      return;
    }
    const restored = normalizeLanding(result.data.landing);
    setForm(restored);
    setSavedFingerprint(JSON.stringify(restored));
    setMessage({ tone: "success", text: "Revisão restaurada e o estado anterior foi mantido no histórico." });
    await loadRevisions();
    invalidateAdminResource(adminResourceKeys.landings);
    await refresh();
  }

  async function deleteMedia(item: LandingMedia) {
    const result = await apiRequest(api.admin.landingMediaItem(item.id), { method: "DELETE" });
    if (!result.success) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível excluir a imagem." });
      return;
    }

    setForm((current) => ({
      ...current,
      hero: {
        ...current.hero,
        logo: current.hero.logo === item.url ? "" : current.hero.logo,
        backgroundImage: current.hero.backgroundImage === item.url ? "" : current.hero.backgroundImage,
      },
      story: { ...current.story, image: current.story.image === item.url ? "" : current.story.image },
      showcase: { ...current.showcase, backgroundImage: current.showcase.backgroundImage === item.url ? "" : current.showcase.backgroundImage },
      finalCta: { ...current.finalCta, backgroundImage: current.finalCta.backgroundImage === item.url ? "" : current.finalCta.backgroundImage },
    }));
    invalidateAdminResource("admin:landing-media");
    await refreshMedia();
    setMessage({ tone: "success", text: "Imagem removida da biblioteca. Salve a landing se ela estava em uso." });
  }

  async function updateMedia(item: LandingMedia, update: { alt?: string; poster?: string }) {
    const result = await apiRequest<{ media: LandingMedia }>(api.admin.landingMediaItem(item.id), {
      method: "PUT",
      body: JSON.stringify(update),
    });
    if (!result.success) {
      setMessage({ tone: "error", text: result.error ?? "Não foi possível atualizar a acessibilidade da mídia." });
      return;
    }
    invalidateAdminResource("admin:landing-media");
    await refreshMedia();
  }

  return <DeveloperPage>
    <DeveloperHero eyebrow="Landing Pages" title="Projetos e sites" description="Crie projetos independentes, escolha um template de partida, revise em prévia privada e publique pela própria rota." stats={[{ label: "Projetos", value: landings.length }, { label: "Publicados", value: landings.filter((landing) => landing.status === "published").length }, { label: "Mídias", value: media.length }]} />
    {loading ? <DeveloperMessage tone="info">Carregando campanhas...</DeveloperMessage> : null}
    {error ? <DeveloperMessage tone="error">{error}</DeveloperMessage> : null}
    {mediaLoading ? <div className="mt-3"><DeveloperMessage tone="info">Carregando biblioteca da campanha...</DeveloperMessage></div> : null}
    {mediaError ? <div className="mt-3"><DeveloperMessage tone="error">{mediaError}</DeveloperMessage></div> : null}
    {message ? <div className="mt-5"><DeveloperMessage tone={message.tone}>{message.text}</DeveloperMessage></div> : null}

    <DeveloperCard className="mt-5 py-4">
      <DeveloperSectionHeading eyebrow="Projetos e sites" title="Seus projetos" action={<button type="button" onClick={openNewProjectDialog} className={`${developerPrimaryButtonClassName} min-h-9 px-3 py-2 text-xs`}>Iniciar novo projeto</button>} />
      {landings.length === 0 && !loading ? <p className="mt-2 text-sm text-[var(--color-muted-raw)]">Nenhum projeto criado. Clique em <strong className="font-semibold text-[var(--foreground)]">Iniciar novo projeto</strong> para escolher um template.</p> : null}
      {landings.length > 0 ? <><div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(12.5rem,14.5rem))] justify-start gap-3">
        {visibleProjects.map((landing) => <LandingProjectCard key={landing.id} landing={landing} active={form.id === landing.id} onOpen={() => { setCreatingNew(false); setForm(landing); setSavedFingerprint(JSON.stringify(landing)); setPublishAt(localDateTime(landing.scheduledPublishAt)); setUnpublishAt(localDateTime(landing.scheduledUnpublishAt)); setPreviewPath(null); setRevisions([]); setMessage(null); }} />)}
      </div><DeveloperCarouselPagination currentPage={projectsPage} totalPages={projectsTotalPages} onNext={() => setProjectsPage((current) => Math.min(current + 1, projectsTotalPages - 1))} onPrev={() => setProjectsPage((current) => Math.max(current - 1, 0))} compact /></> : null}
    </DeveloperCard>

    {media.length > 0 ? <DeveloperCard className="mt-5">
      <DeveloperSectionHeading eyebrow="Biblioteca" title="Acessibilidade e vídeo" description="Descreva cada mídia para leitores de tela. Vídeos usados na seção Imagem e conteúdo exibem controles; selecione uma imagem como poster quando quiser definir a capa antes da reprodução." />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{media.map((item) => <article key={item.id} className="rounded-xl border border-[var(--border)] p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm text-[var(--foreground)]">{item.kind === "video" ? "Vídeo" : "Imagem"}</strong><span className="text-xs text-[var(--color-muted-raw)]">{item.id}</span></div><DeveloperField label="Descrição alternativa" className="mt-3"><input defaultValue={item.alt ?? ""} maxLength={160} onBlur={(event) => { if (event.target.value !== (item.alt ?? "")) void updateMedia(item, { alt: event.target.value }); }} className={developerInputClassName} placeholder="O que a pessoa deve entender com esta mídia?" /></DeveloperField>{item.kind === "video" ? <DeveloperField label="Poster do vídeo" className="mt-3"><select value={item.poster ?? ""} onChange={(event) => void updateMedia(item, { poster: event.target.value })} className={developerInputClassName}><option value="">Usar primeiro quadro do vídeo</option>{media.filter((candidate) => candidate.kind === "image").map((candidate) => <option key={candidate.id} value={candidate.url}>{candidate.alt || candidate.id}</option>)}</select></DeveloperField> : null}</article>)}</div>
    </DeveloperCard> : null}

    {form.id ? <form onSubmit={save} className="mt-5 space-y-5">
      <CampaignV1Editor landing={form} media={media} uploadingMedia={uploadingMedia} onChange={(update) => setForm((current) => update(current))} onUploadMedia={uploadMedia} onDeleteMedia={deleteMedia} />
      <DeveloperCard>
        <DeveloperSectionHeading eyebrow="Configuração" title={form.id ? form.name : "Novo projeto"} description="A prévia usa o renderizador público e sempre mostra a última versão salva. A publicação valida SEO, CTAs e conteúdo de orientação do template." action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => void openPreview()} disabled={saving || openingPreview || hasUnsavedChanges} className={developerSecondaryButtonClassName}><ArrowSquareOut size={16} weight="bold" />{openingPreview ? "Abrindo..." : "Abrir prévia real"}</button><button type="submit" disabled={saving} className={developerSecondaryButtonClassName}><FloppyDisk size={16} weight="bold" />Salvar</button><button type="button" disabled={saving || form.status === "published" || form.status === "archived"} onClick={() => void changePublication(true)} className={developerPrimaryButtonClassName}><RocketLaunch size={16} weight="bold" />Publicar</button></div>} />
        <div className="grid gap-4 md:grid-cols-2"><DeveloperField label="Nome" required helpKey="landing-pages.field.nome"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={developerInputClassName} maxLength={120} /></DeveloperField><DeveloperField label="Rota" required helpKey="landing-pages.field.rota" hint="Exemplo: campanha-distribuicao. A página será aberta em /campanha-distribuicao."><input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className={developerInputClassName} maxLength={80} /></DeveloperField></div>
        {hasUnsavedChanges ? <p className="mt-3 text-sm font-medium text-amber-700">Há alterações não salvas. Salve para atualizar a prévia pública e habilitar a publicação.</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {form.status === "published" ? <button type="button" disabled={saving} onClick={() => void changePublication(false)} className={developerSecondaryButtonClassName}><Eye size={16} weight="bold" />Despublicar</button> : null}
          {form.id ? <button type="button" disabled={saving} onClick={() => void duplicateLanding()} className={developerSecondaryButtonClassName}>Duplicar</button> : null}
          {form.id && form.status !== "archived" ? <button type="button" disabled={saving} onClick={() => void archiveLanding()} className={developerSecondaryButtonClassName}>Arquivar</button> : null}
          {form.id && form.status === "archived" ? <button type="button" disabled={saving} onClick={() => void deleteLanding()} className={developerSecondaryButtonClassName}>Excluir definitivamente</button> : null}
        </div>
      </DeveloperCard>

      {previewPath ? <DeveloperCard>
        <DeveloperSectionHeading eyebrow="Prévia pública" title="Renderização real da campanha" description="Esta moldura usa a mesma rota privada e o mesmo frontend que a prévia aberta em outra aba. O link expira em sete dias e é renovado ao abrir novamente." />
        <iframe title="Prévia pública da campanha" src={siteUrl(previewPath)} className="mt-4 h-[760px] w-full rounded-xl border border-[var(--border)] bg-white" />
      </DeveloperCard> : null}

      {form.id ? <DeveloperCard>
        <DeveloperSectionHeading eyebrow="Ciclo de vida" title="Programação, histórico e recuperação" description="Defina publicação e despublicação futuras, duplique para uma nova variação e recupere versões anteriores sem apagar mídias que ainda possam estar referenciadas." action={<button type="button" onClick={() => void loadRevisions()} className={developerSecondaryButtonClassName}>Ver histórico</button>} />
        <div className="mt-4 grid gap-4 md:grid-cols-2"><DeveloperField label="Publicar em"><input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} className={developerInputClassName} /></DeveloperField><DeveloperField label="Despublicar em"><input type="datetime-local" value={unpublishAt} onChange={(event) => setUnpublishAt(event.target.value)} className={developerInputClassName} /></DeveloperField></div>
        <button type="button" disabled={saving || form.status === "archived"} onClick={() => void saveSchedule()} className={`${developerSecondaryButtonClassName} mt-4`}>Salvar programação</button>
        {revisions.length > 0 ? <div className="mt-5 space-y-2">{revisions.map((revision) => <div key={revision.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"><div><p className="text-sm font-semibold text-[var(--foreground)]">{revision.operation}</p><p className="text-xs text-[var(--color-muted-raw)]">{new Date(revision.createdAt).toLocaleString("pt-BR")}</p></div><button type="button" onClick={() => void rollback(revision.id)} className={developerSecondaryButtonClassName}>Restaurar</button></div>)}</div> : null}
      </DeveloperCard> : null}

      <DeveloperCard>
        <DeveloperSectionHeading eyebrow="Busca" title="SEO da campanha" description="Defina como a campanha aparece no Google e se ela pode ser indexada. A prévia privada nunca entra em resultados de busca." action={<span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${form.seo.index ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-amber-500/20 bg-amber-500/10 text-amber-700"}`}>{form.seo.index ? "Indexação ativa" : "Fora dos resultados"}</span>} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] xl:items-start">
          <DeveloperField label="Título SEO" helpKey="landing-pages.field.seo-title" hint="Se ficar vazio, a landing usa o título principal do Hero.">
            <input value={form.seo.title} onChange={(event) => setForm({ ...form, seo: { ...form.seo, title: event.target.value } })} className={developerInputClassName} maxLength={70} placeholder="Ex.: Soluções logísticas para indústrias" />
          </DeveloperField>
          <DeveloperField label="Descrição SEO" helpKey="landing-pages.field.seo-description" hint="Resumo curto usado por buscadores e compartilhamentos.">
            <textarea value={form.seo.description} onChange={(event) => setForm({ ...form, seo: { ...form.seo, description: event.target.value } })} className={`${developerInputClassName} min-h-24 resize-y`} maxLength={180} placeholder="Resuma a proposta de valor desta campanha." />
          </DeveloperField>
          <section className="xl:col-span-2 rounded-xl border border-[var(--border)] bg-white/[0.55] p-3 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="min-w-0"><div className="flex items-center gap-1.5"><p className="text-sm font-semibold text-[var(--foreground)]">Indexação</p><DeveloperHelp label="Indexação" templateKey="landing-pages.field.seo-index" /></div><p className="mt-1 text-xs leading-5 text-[var(--color-muted-raw)]">Campanhas de teste podem permanecer fora dos resultados de busca.</p></div>
            <label className="mt-3 flex min-h-10 shrink-0 items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold sm:mt-0">
              <input type="checkbox" checked={form.seo.index} onChange={(event) => setForm({ ...form, seo: { ...form.seo, index: event.target.checked } })} className="size-4 accent-[var(--primary)]" />
              Permitir indexação
            </label>
          </section>
        </div>
      </DeveloperCard>

      <DeveloperCard><DeveloperSectionHeading eyebrow="Medição" title="Analytics da campanha" description="O Measurement ID informado é isolado para esta campanha e só é carregado depois do consentimento de analytics. Integrações sem renderizador sujeito a consentimento não fazem parte deste template." /><DeveloperField label="Measurement ID GA4" helpKey="landing-pages.field.ga4"><input placeholder="G-XXXXXXXXXX" value={form.analytics.ga4MeasurementId} onChange={(event) => setForm({ ...form, analytics: { ga4MeasurementId: event.target.value.toUpperCase() } })} className={developerInputClassName} /></DeveloperField></DeveloperCard>
    </form> : null}
    {newProjectDialogOpen ? createPortal(<div data-new-landing-project-dialog="true" className="cms-content-dialog fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-landing-project-title" onMouseDown={() => !creatingProject && setNewProjectDialogOpen(false)}>
      <form className={`new-landing-project-dialog__surface max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.4)] sm:p-6 ${newProjectStep === "template" ? "max-w-5xl" : "max-w-lg"}`} onSubmit={(event) => { if (newProjectStep === "name") void createProject(event); else event.preventDefault(); }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--primary)]">{newProjectStep === "template" ? "Etapa 1 · template" : "Etapa 2 · nome do projeto"}</p><h2 id="new-landing-project-title" className="mt-1 text-xl font-bold text-[var(--foreground)]">{newProjectStep === "template" ? "Escolha um template para iniciar" : "Como este projeto será chamado?"}</h2><p className="mt-1 text-sm leading-6 text-[var(--color-muted-raw)]">{newProjectStep === "template" ? "Escolha o modelo que deseja usar. Depois, você dará um nome ao projeto antes de começar a edição." : "Você escolheu um template. Dê um nome para criar o rascunho e começar a edição."}</p></div><button type="button" aria-label="Fechar criação de projeto" onClick={() => setNewProjectDialogOpen(false)} disabled={creatingProject} className="rounded-lg px-2 py-1 text-xl leading-none text-[var(--color-muted-raw)] transition hover:bg-white hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50">×</button></div>
        {newProjectStep === "template" ? <><div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(10.5rem,13rem))] justify-start gap-3">{visibleTemplates.map((template) => { const selected = selectedTemplate === template.id; return <article key={template.id} className={`flex aspect-square flex-col rounded-xl border p-2.5 transition ${selected ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/10" : "border-[var(--border)] bg-white/70 hover:border-[var(--primary)]/40"}`}><div className="relative aspect-[16/10] shrink-0"><LandingTemplatePreview /><span className="absolute left-2 top-2 rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">Prévia</span><span className="absolute right-2 top-2 rounded-full border border-[var(--primary)]/30 bg-[var(--card)]/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--primary)]">{selected ? "Escolhido" : "Disponível"}</span></div><h3 className="mt-2 truncate text-sm font-semibold text-[var(--foreground)]">{template.name}</h3><p className="sr-only">{template.summary} {template.details}</p><button type="button" onClick={() => chooseProjectTemplate(template.id)} className={`${selected ? developerPrimaryButtonClassName : developerSecondaryButtonClassName} mt-auto min-h-8 w-full px-2 py-1.5 text-[11px]`}>Usar este template</button></article>; })}</div><DeveloperCarouselPagination currentPage={templatesPage} totalPages={templatesTotalPages} onNext={() => setTemplatesPage((current) => Math.min(current + 1, templatesTotalPages - 1))} onPrev={() => setTemplatesPage((current) => Math.max(current - 1, 0))} compact /><div className="mt-4 flex justify-end"><button type="button" onClick={() => setNewProjectDialogOpen(false)} className={developerSecondaryButtonClassName}>Cancelar</button></div></> : <><div className="mt-5 space-y-4"><DeveloperField label="Nome do projeto" required helpKey="landing-pages.field.project-name" hint="Este nome organiza seus projetos no CMS; você poderá mudá-lo depois."><input autoFocus required value={newProjectName} onChange={(event) => { setNewProjectName(event.target.value); setNewProjectError(null); }} className={developerInputClassName} maxLength={120} placeholder="Ex.: Campanha logística 2026" /></DeveloperField><section className="rounded-xl border border-[var(--border)] bg-white/[0.55] p-3"><div className="flex items-center gap-1.5"><p className="text-sm font-semibold text-[var(--foreground)]">Template de partida</p><DeveloperHelp label="Template do projeto" templateKey="landing-pages.field.template" /></div><p className="mt-1 text-sm font-medium text-[var(--foreground)]">{LANDING_TEMPLATES.find((template) => template.id === newProjectTemplate)?.name ?? "Landing comercial"}</p><p className="mt-1 text-xs leading-5 text-[var(--color-muted-raw)]">A estrutura será copiada para este projeto; alterações futuras não modificam o template original.</p></section><p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs leading-5 text-[var(--color-muted-raw)]">A rota inicial será <strong className="font-semibold text-[var(--foreground)]">/{availableProjectSlug(newProjectName || "projeto", landings)}</strong>. Você poderá editá-la antes de publicar.</p>{newProjectError ? <p role="alert" className="text-sm font-medium text-red-600">{newProjectError}</p> : null}</div><div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setNewProjectError(null); setNewProjectStep("template"); }} disabled={creatingProject} className={developerSecondaryButtonClassName}>Voltar aos templates</button><button type="submit" disabled={creatingProject || !newProjectName.trim()} className={developerPrimaryButtonClassName}>{creatingProject ? "Criando..." : "Criar projeto"}</button></div></>}
      </form>
    </div>, document.querySelector<HTMLElement>("[data-admin-shell='true']") ?? document.body) : null}
  </DeveloperPage>;
}
