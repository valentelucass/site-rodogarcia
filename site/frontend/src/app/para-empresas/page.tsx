import type { Metadata } from "next";
import {
  ChartLineUp,
  CheckCircle,
  Gear,
  Globe,
  Plus,
  ShieldCheck,
  Truck,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import {
  ActionLink,
  PageContainer,
  PageSection,
  PageShell,
  SectionHeader,
  SurfaceSection,
} from "@/components/internal/PageContent";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fetchPublicContent } from "@/lib/api";
import { buildCmsMetadata } from "@/lib/cmsPublic";
import { seo, site } from "@/lib/routes";

export const dynamic = "force-dynamic";

const fallbackMetadata: Metadata = {
  title: "Para Empresas",
  description:
    "Soluções logísticas para empresas que precisam de escala, previsibilidade operacional e atendimento consultivo.",
  alternates: { canonical: seo.absoluteUrl(site.business) },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: seo.siteName,
    title: "Para Empresas | Rodogarcia Transportes",
    description:
      "Operações B2B com cobertura nacional, compliance e implantação por etapas.",
    url: seo.absoluteUrl(site.business),
    images: [{ url: seo.absoluteUrl("/operacao-indoor-rodogarcia.d6f36f33e258.webp") }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Para Empresas | Rodogarcia Transportes",
    description:
      "Conheça a camada B2B da Rodogarcia para operações corporativas de maior escala.",
    images: [seo.absoluteUrl("/operacao-indoor-rodogarcia.d6f36f33e258.webp")],
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata(site.business, fallbackMetadata);
}

const SERVICES = [
  {
    icon: Truck,
    title: "Distribuição e transferência",
    description: "Operação nacional com janelas bem definidas e controle ponta a ponta.",
  },
  {
    icon: Globe,
    title: "Supply chain integrado",
    description: "Transporte, indoor e armazenagem como uma única frente de alta performance.",
  },
  {
    icon: ShieldCheck,
    title: "Projetos especiais",
    description: "Lotes dedicados e cargas sensíveis com rigoroso padrão de compliance.",
  },
  {
    icon: ChartLineUp,
    title: "Inteligência operacional",
    description: "Visibilidade total com indicadores de performance e SLA em tempo real.",
  },
  {
    icon: UsersThree,
    title: "Atendimento consultivo",
    description: "Time dedicado para mapear gargalos e garantir uma curva de entrada segura.",
  },
  {
    icon: Gear,
    title: "Evolução contínua",
    description: "Revisões periódicas focadas em proteger sua produtividade e reduzir custos.",
  },
];

const ROLLOUT = [
  {
    step: "01",
    title: "Diagnóstico",
    description:
      "Levantamos gargalos, SLA esperado, volume, risco e pontos de atrito da operação atual.",
  },
  {
    step: "02",
    title: "Proposta personalizada",
    description:
      "Escopo, cobertura e indicadores são ajustados conforme o contexto real do negócio.",
  },
  {
    step: "03",
    title: "Implantação assistida",
    description:
      "Entrada acompanhada, com ajustes de curto ciclo para sustentar a curva inicial sem surpresas.",
  },
  {
    step: "04",
    title: "Evolução contínua",
    description:
      "Revisões periódicas para proteger produtividade, custo e padrão de entrega.",
  },
];

const FAQ = [
  {
    question: "Quais tipos de carga a Rodogarcia transporta?",
    answer: "Trabalhamos com operações B2B de escala. Focamos em carga fracionada corporativa, lotação e projetos especiais com alta exigência de SLA e compliance."
  },
  {
    question: "Como funciona a visibilidade da operação?",
    answer: "Oferecemos inteligência operacional completa. Você terá acesso a indicadores de performance, SLA em tempo real e rastreabilidade de ponta a ponta para controle total."
  },
  {
    question: "A Rodogarcia atende todo o Brasil?",
    answer: "Sim. Possuímos malha logística estruturada e parceiros homologados para garantir cobertura, prazos e capilaridade em todas as regiões do país."
  },
  {
    question: "Como funciona a fase de implantação?",
    answer: "Atuamos de forma consultiva. Desenhamos a proposta, acompanhamos os primeiros envios de perto (implantação assistida) e ajustamos a operação em ciclos curtos para evitar gargalos."
  }
];

type PartnerLogo = {
  name: string;
  category: string;
  image: string;
};

const FALLBACK_PARTNERS: PartnerLogo[] = [
  { name: "Tigre", category: "Construcao Civil", image: "/feedbacks/tigre.webp" },
  { name: "PPG", category: "Industria de Tintas", image: "/feedbacks/PPG.webp" },
  { name: "Danfoss", category: "Tecnologia / Engenharia", image: "/feedbacks/danfoss.webp" },
  { name: "Corbion", category: "Ingredientes / Quimica", image: "/feedbacks/corbion-brasil.webp" },
  { name: "Capricche", category: "Industria Alimenticia", image: "/feedbacks/capricche.webp" },
  { name: "Frigelar", category: "Refrigeracao / Varejo", image: "/feedbacks/frigelar.webp" },
  { name: "HB Fuller", category: "Adesivos / Quimica", image: "/feedbacks/hbfuller.webp" },
  { name: "Hidrodomi", category: "Operacoes", image: "/feedbacks/hidrodomi.gif" },
  { name: "Kemira", category: "Industria Quimica", image: "/feedbacks/kemira.webp" },
];

export default async function ParaEmpresasPage() {
  const content = await fetchPublicContent();
  const partners = FALLBACK_PARTNERS;
  const businessPage = content.data?.businessPage;
  const scaleButtons = businessPage?.scaleCta.buttons ?? [
    { label: "Solicitar cotação", url: site.quote },
    { label: "Falar com especialista", url: site.contact },
  ];
  const faqItems = businessPage?.faq.items ?? FAQ;

  return (
    <PageShell>
      {/* HERO — azul escuro, padrão /servicos */}
      <div className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />

        <section className="relative pt-20 sm:pt-24 lg:pt-28" aria-labelledby="para-empresas-hero-title">
          <PageContainer>
            <div className="mx-auto max-w-[920px] py-10 text-center sm:py-12 lg:py-16">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80 backdrop-blur-sm">
                Soluções B2B
              </span>

              <h1
                id="para-empresas-hero-title"
                className="mx-auto mt-6 max-w-[16ch] text-[clamp(3rem,8vw,6rem)] font-bold leading-[0.9] tracking-[-0.05em] sm:max-w-[18ch] sm:tracking-[-0.07em]"
              >
                <span className="block bg-[linear-gradient(180deg,#a5f3fc_0%,#dbeafe_100%)] bg-clip-text text-transparent">
                  Logística B2B
                </span>
                <span className="mt-1 block text-white">com escala real.</span>
              </h1>

              <p className="mx-auto mt-5 max-w-[42rem] text-sm leading-7 text-white/68 sm:text-base">
                Estrutura operacional para empresas que precisam crescer sem perder o controle. Cobertura nacional, compliance e atendimento consultivo em uma única frente.
              </p>

              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-row sm:items-center sm:justify-center">
                <ActionLink
                  action={{ label: "Solicitar cotação", href: site.quote }}
                  tone="dark"
                  className="w-full min-w-0 sm:w-auto"
                />
                <ActionLink
                  action={{ label: "Falar com especialista", href: site.contact, variant: "secondary" }}
                  tone="dark"
                  className="w-full min-w-0 sm:w-auto"
                />
              </div>

            </div>
          </PageContainer>
        </section>
      </div>

      {/* NOVA SEÇÃO: Vitrine de Parceiros */}
      <PageSection className="relative overflow-hidden bg-[var(--background)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(29,78,216,0.04),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.04),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.01)_0%,transparent_40%)]" />

        <PageContainer className="relative">
          <div className="mx-auto flex max-w-[800px] flex-col items-center text-center">
            <span className="inline-flex items-center rounded-full border border-[var(--primary)]/10 bg-[var(--primary)]/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)] backdrop-blur-sm">
              Empresas que confiam
            </span>
            <h2 className="mt-6 text-3xl font-bold leading-tight tracking-[-0.04em] text-[var(--foreground)] sm:text-4xl md:text-5xl">
              Integrações e operações com líderes do mercado
            </h2>
            <p className="mt-5 max-w-[42rem] text-sm leading-7 text-[var(--color-muted-raw)] sm:text-base">
              A Rodogarcia atua com operações estruturadas B2B.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-[1380px] grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
            {partners.map((partner, index) => (
              <div
                key={index}
                tabIndex={0}
                className="group relative flex min-h-[138px] flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-white/40 p-6 text-center shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--primary)]/30 hover:bg-white/60 hover:shadow-[0_12px_40px_-12px_rgba(29,78,216,0.15)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              >
                <div className="absolute inset-0 -z-10 rounded-2xl bg-[var(--primary)]/0 opacity-0 blur-xl transition-all duration-300 group-hover:bg-[var(--primary)]/5 group-hover:opacity-100" />
                
                <div className="relative flex h-16 w-full items-center justify-center overflow-hidden">
                  <img
                    src={partner.image}
                    alt={`Logo da empresa ${partner.name}`}
                    className="h-full w-full object-contain filter transition-all duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                
                <div className="mt-5 flex flex-col items-center">
                  <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
                    {partner.name}
                  </h3>
                  <span className="mt-1 text-xs font-medium text-[var(--color-muted-raw)]">
                    {partner.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </PageContainer>
      </PageSection>

      {/* SESSÃO FUSIONADA: CTA Escura + Método de Implantação (AO MEIO) */}
      <section className="relative overflow-hidden bg-slate-950 py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />
        
        <PageContainer className="relative">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-12 xl:gap-20 items-center">
            {/* Esquerda: CTA e Copy */}
            <div className="flex flex-col items-start text-left">
              <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300 backdrop-blur-sm">
                Pronto para escalar?
              </span>
              
              <h2 className="mt-8 text-[clamp(2.2rem,4vw,3.2rem)] font-extrabold leading-[1.1] tracking-[-0.04em] text-white">
                Sua logística não pode depender de improviso.
              </h2>
              
              <p className="mt-6 text-[15px] leading-8 text-slate-300 sm:text-base">
                A Rodogarcia desenha e acompanha operações B2B com previsibilidade, execução consistente e controle real.
              </p>
              
              <ul className="mt-8 flex flex-col gap-4">
                {[
                  "Cobertura nacional com SLA",
                  "Estrutura sob medida",
                  "Time consultivo dedicado"
                ].map((bullet) => (
                  <li key={bullet} className="flex items-center gap-3 text-sm font-medium text-slate-200">
                    <CheckCircle size={20} weight="fill" className="text-sky-400" />
                    {bullet}
                  </li>
                ))}
              </ul>

              <div className="mt-12 grid w-full grid-cols-1 gap-3 sm:flex sm:flex-row sm:gap-4">
                <ActionLink
                  action={{
                    label: scaleButtons[0]?.label || "Solicitar cotação",
                    href: scaleButtons[0]?.url || site.quote,
                    external: scaleButtons[0]?.external,
                  }}
                  className="min-h-[60px] w-full min-w-0 flex-1 justify-center border-none bg-sky-500 text-[15px] text-white shadow-[0_12px_32px_rgba(14,165,233,0.25)] hover:bg-sky-400 hover:shadow-[0_20px_48px_rgba(14,165,233,0.35)] focus-visible:ring-sky-500/30 sm:w-auto"
                />
                <ActionLink
                  action={{
                    label: scaleButtons[1]?.label || "Falar com especialista",
                    href: scaleButtons[1]?.url || site.contact,
                    external: scaleButtons[1]?.external,
                    variant: "secondary",
                  }}
                  className="min-h-[60px] w-full min-w-0 flex-1 justify-center border border-slate-700 bg-transparent text-[15px] text-white hover:border-slate-500 hover:bg-slate-800 focus-visible:ring-slate-700/50 sm:w-auto"
                />
              </div>
            </div>

            {/* Direita: Método de implantação */}
            <div className="relative flex w-full flex-col gap-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-10 shadow-2xl backdrop-blur-md">
              <div className="mb-2">
                <h3 className="text-xl font-bold tracking-tight text-white">Método de Implantação</h3>
                <p className="mt-2 text-sm text-slate-400">Quatro etapas para uma entrada segura e com resultado rápido.</p>
              </div>

              <div className="flex flex-col gap-6">
                {ROLLOUT.map((item, index) => (
                  <div key={item.title} className="relative flex gap-5">
                    {/* Linha conectora */}
                    {index !== ROLLOUT.length - 1 && (
                      <div className="absolute top-10 bottom-[-1.5rem] left-[15px] w-px bg-white/10" />
                    )}
                    
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300 ring-1 ring-sky-500/40">
                      {item.step}
                    </div>
                    
                    <div className="flex flex-col pb-1">
                      <h4 className="text-[15px] font-semibold tracking-tight text-white">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* FRENTES DE ATUAÇÃO */}
      <PageSection className="relative bg-slate-50/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.03),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.03),transparent_40%)]" />
        <PageContainer className="relative">
          <div className="mx-auto max-w-[800px] text-center">
            <span className="inline-flex items-center rounded-full border border-[var(--primary)]/10 bg-[var(--primary)]/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)] backdrop-blur-sm">
              Frentes de atuação
            </span>
            <h2 className="mt-6 text-[clamp(1.8rem,4vw,2.5rem)] font-bold leading-tight tracking-[-0.04em] text-[var(--foreground)]">
              Seis pilares que reduzem gargalo desde o início.
            </h2>
            <p className="mx-auto mt-4 max-w-[48rem] text-sm leading-7 text-[var(--color-muted-raw)] sm:text-base">
              Cada frente tem um papel claro na operação: entrega, visibilidade, escopo e acompanhamento contínuo.
            </p>
            
            <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
              {["Menos gargalo", "Mais previsibilidade", "Escopo bem definido", "Cobertura nacional", "SLA real"].map((pill) => (
                <span key={pill} className="inline-flex items-center rounded-full border border-slate-200 bg-white/60 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md">
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((item) => (
              <div
                key={item.title}
                tabIndex={0}
                className="group relative flex flex-col rounded-2xl border border-white/60 bg-white/40 p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--primary)]/20 hover:bg-white/60 hover:shadow-[0_16px_40px_-12px_rgba(29,78,216,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
              >
                <div className="absolute inset-0 -z-10 rounded-2xl bg-[var(--primary)]/0 opacity-0 blur-xl transition-all duration-300 group-hover:bg-[var(--primary)]/5 group-hover:opacity-100" />
                
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100/80 text-slate-600 shadow-sm transition-all duration-300 group-hover:bg-[var(--primary)]/10 group-hover:text-[var(--primary)] group-hover:shadow-[0_0_20px_rgba(29,78,216,0.2)]">
                  <item.icon size={28} weight="duotone" />
                </div>
                
                <h3 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted-raw)] opacity-90 transition-opacity duration-300 group-hover:opacity-100">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </PageContainer>
      </PageSection>

      {/* FAQ / SANFONA (AO FINAL ANTES DO FOOTER) */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6fb_100%)] py-14 sm:py-16 lg:py-20" aria-labelledby="faq-title">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(29,78,216,0.07),transparent_20%),radial-gradient(circle_at_82%_18%,rgba(6,182,212,0.06),transparent_18%)]" />
        <div className="relative mx-auto max-w-[980px] px-5 sm:px-8">
          <div className="max-w-[680px]">
            <h2 id="faq-title" className="text-[clamp(2.1rem,4vw,3.8rem)] font-bold leading-[0.96] tracking-[-0.05em] text-[var(--foreground)]">
              {businessPage?.faq.title || "Perguntas Frequentes"}
            </h2>
            <p className="mt-4 text-base text-[var(--color-muted-raw)] sm:text-lg">
              Tire suas dúvidas sobre nosso modelo de atuação B2B.
            </p>
          </div>
          
          <Accordion className="mt-8 flex w-full flex-col">
            {faqItems.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="group border-b border-[var(--border)] last:border-b-0"
              >
                <AccordionTrigger className="py-6 text-left text-base font-semibold tracking-[-0.02em] text-[var(--foreground)] hover:text-[var(--primary)] hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 pr-12 text-base leading-relaxed text-[var(--color-muted-raw)]">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </PageShell>
  );
}
