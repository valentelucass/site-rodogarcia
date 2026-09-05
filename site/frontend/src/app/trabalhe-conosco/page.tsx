import type { ReactNode } from "react";
import type { Metadata } from "next";
import {
  Briefcase,
  CheckCircle,
  ShieldCheck,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import {
  ActionLink,
  PageContainer,
  PageSection,
  PageShell,
  SectionHeader,
} from "@/components/internal/PageContent";
import { CareersJobsList } from "@/components/internal/CareersJobsList";
import { CareersApplicationSelector } from "@/components/internal/CareersApplicationSelector";
import { fetchPublicContent } from "@/lib/api";
import { buildCmsMetadata } from "@/lib/cmsPublic";
import { PresentedImage } from "@/components/media/PresentedImage";
import { external, seo, site } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { CareersPageContent } from "@/types/content";

export const dynamic = "force-dynamic";

const fallbackMetadata: Metadata = {
  title: "Carreiras",
  description:
    "Conheça as oportunidades da Rodogarcia e envie sua candidatura para uma empresa que cresce com disciplina e foco operacional.",
  alternates: { canonical: seo.absoluteUrl(site.careers) },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: seo.siteName,
    title: "Carreiras | Rodogarcia Transportes",
    description:
      "Veja as vagas em destaque e como a Rodogarcia organiza sua frente de recrutamento.",
    url: seo.absoluteUrl(site.careers),
    images: [{ url: seo.absoluteUrl("/caminhoneiro1.webp") }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Carreiras | Rodogarcia Transportes",
    description:
      "Trabalhe em uma operação nacional orientada por consistência, crescimento e excelência.",
    images: [seo.absoluteUrl("/caminhoneiro1.webp")],
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
  return buildCmsMetadata(site.careers, fallbackMetadata);
}

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "Plano de saúde",
    description: "Cobertura para você e sua família com foco em bem-estar.",
  },
  {
    icon: Trophy,
    title: "Desenvolvimento",
    description: "Espaço para aprender e crescer junto com a operação.",
  },
  {
    icon: Briefcase,
    title: "Remuneração competitiva",
    description: "Pacote alinhado ao mercado e à responsabilidade do cargo.",
  },
  {
    icon: UsersThree,
    title: "Ambiente colaborativo",
    description: "Time próximo, cultura de ajuda e responsabilidade compartilhada.",
  },
];

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Candidatura",
    description: "Escolha a filial de interesse e envie seu currículo por e-mail, com a vaga no assunto e telefone para retorno.",
  },
  {
    step: "02",
    title: "Triagem",
    description: "O time de RH analisa o perfil e entra em contato dentro de 5 dias úteis.",
  },
  {
    step: "03",
    title: "Entrevista",
    description: "Conversa com RH e liderança da área para alinhar expectativas e fit cultural.",
  },
  {
    step: "04",
    title: "Boas-vindas",
    description: "Onboarding estruturado para garantir uma entrada tranquila na operação.",
  },
];

type JobCard = {
  title: string;
  badge: string;
  badgeVariant: "new" | "default";
  location: string;
  workType: string;
  contractType: string;
  description: string;
  applyUrl?: string;
};

const STATIC_JOBS: JobCard[] = [
  {
    title: "Motorista Categoria C/D/E",
    badge: "Novo",
    badgeVariant: "new",
    location: "Agudos/SP",
    workType: "Presencial",
    contractType: "Integral",
    description:
      "Experiência mínima de 2 anos em transporte de cargas e foco em segurança operacional.",
  },
  {
    title: "Analista de Logística",
    badge: "Disponível",
    badgeVariant: "default",
    location: "Campinas/SP",
    workType: "Híbrido",
    contractType: "Integral",
    description: "Gestão de rotas, leitura de indicadores e melhoria de processo logístico.",
  },
  {
    title: "Assistente Administrativo",
    badge: "Disponível",
    badgeVariant: "default",
    location: "Osasco/SP",
    workType: "Presencial",
    contractType: "Integral",
    description: "Apoio a rotinas administrativas, documentação e interface com a operação.",
  },
];

const FALLBACK_CAREERS_PAGE: CareersPageContent = {
  hero: {
    buttons: [
      { label: "Ver vagas abertas", url: "#vagas" },
      { label: "Enviar curriculo", url: "#candidatura" },
    ],
  },
  cultureImage: {
    src: "/caminhoneiro1.webp",
    alt: "Time Rodogarcia em operação",
  },
  jobs: STATIC_JOBS.map((job, index) => ({
    id: `career-job-${index + 1}`,
    order: index + 1,
    title: job.title,
    location: job.location,
    type: job.contractType,
    description: job.description,
    applyUrl: job.applyUrl || "#candidatura",
    active: true,
  })),
  directApplication: {
    buttons: [
      { label: "Enviar curriculo por e-mail", url: external.careersEmailWithSubject, external: true },
      { label: "Abrir contato", url: site.contact },
    ],
  },
  finalCta: {
    buttons: [
      { label: "Enviar curriculo", url: external.careersEmailWithSubject, external: true },
      { label: "Falar com contato", url: site.contact },
    ],
  },
};

function CareersHeroSurface({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden bg-slate-950 py-12 sm:py-16 lg:py-20", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />

      <PageContainer>
        <div className={cn("relative", contentClassName)}>{children}</div>
      </PageContainer>
    </section>
  );
}

export default async function TrabalheConoscoPage() {
  const content = await fetchPublicContent();
  const careersPage = content.data?.careersPage ?? FALLBACK_CAREERS_PAGE;
  const cultureImage = careersPage.cultureImage;
  const units = content.data?.units ?? [];

  return (
    <PageShell>
      {/* HERO — azul escuro, padrão /servicos */}
      <div className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />

        <section className="relative pt-20 sm:pt-24 lg:pt-28" aria-labelledby="carreiras-hero-title">
          <PageContainer>
            <div className="mx-auto max-w-[920px] py-10 text-center sm:py-12 lg:py-16">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80 backdrop-blur-sm">
                Carreiras
              </span>

              <h1
                id="carreiras-hero-title"
                className="mx-auto mt-6 max-w-[16ch] text-[clamp(3rem,8vw,6rem)] font-bold leading-[0.9] tracking-[-0.05em] sm:max-w-[18ch] sm:tracking-[-0.07em]"
              >
                <span className="block bg-[linear-gradient(180deg,#a5f3fc_0%,#dbeafe_100%)] bg-clip-text text-transparent">
                  Construa aqui
                </span>
                <span className="mt-1 block text-white">sua carreira.</span>
              </h1>

              <p className="mx-auto mt-5 max-w-[42rem] text-sm leading-7 text-white/68 sm:text-base">
                35 anos de história, operação nacional e um time que cresce com método. Se você quer mais do que uma vaga, a Rodogarcia tem o ambiente certo.
              </p>

              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-row sm:items-center sm:justify-center">
                <ActionLink
                  action={{
                    label: careersPage.hero.buttons[0]?.label || "Ver vagas abertas",
                    href: careersPage.hero.buttons[0]?.url || "#vagas",
                    external: careersPage.hero.buttons[0]?.external,
                  }}
                  tone="dark"
                  className="w-full min-w-0 sm:w-auto"
                />
                <ActionLink
                  action={{
                    label: careersPage.hero.buttons[1]?.label || "Enviar curriculo",
                    href: careersPage.hero.buttons[1]?.url || "#candidatura",
                    external: careersPage.hero.buttons[1]?.external,
                    variant: "secondary",
                  }}
                  tone="dark"
                  className="w-full min-w-0 sm:w-auto"
                />
              </div>

            </div>
          </PageContainer>
        </section>
      </div>

      {/* SEÇÃO 2 — clara: benefícios */}
      <PageSection>
        <PageContainer>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeader
                eyebrow="Cultura e benefícios"
                title="Mais do que preencher vagas, queremos construir carreiras."
                description="O ambiente é colaborativo, o crescimento é real e os benefícios acompanham o nível de responsabilidade de cada função."
              />

              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {BENEFITS.map((item) => (
                  <div key={item.title} className="group flex flex-col gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] transition-all duration-300 group-hover:bg-[var(--primary)] group-hover:text-white">
                      <item.icon size={22} weight="duotone" />
                    </span>
                    <div>
                      <p className="font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm leading-7 text-[var(--color-muted-raw)]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[#dce7f7] shadow-[0_24px_64px_rgba(15,23,42,0.12)]">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(2,6,23,0.08)_100%)]" />
              <PresentedImage
                src={cultureImage.src}
                alt={cultureImage.alt}
                className="aspect-[4/3] w-full object-cover"
                presentation={cultureImage.presentation}
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </PageContainer>
      </PageSection>

      {/* SEÇÃO 3 — azul escuro: processo seletivo */}
      <CareersHeroSurface contentClassName="space-y-12">
        <SectionHeader
          eyebrow="Processo seletivo"
          title="Como funciona a jornada de entrada."
          description="Quatro etapas simples, diretas e sem burocracia desnecessária."
          theme="dark"
          align="center"
        />

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {PROCESS_STEPS.map((item) => (
            <div key={item.title} className="flex flex-col gap-3 border-l border-white/10 pl-6">
              <span className="text-[2.8rem] font-bold leading-none tracking-[-0.06em] text-white/10">
                {item.step}
              </span>
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
                {item.title}
              </h3>
              <p className="text-sm leading-7 text-white/62">{item.description}</p>
            </div>
          ))}
        </div>
      </CareersHeroSurface>

      {/* SEÇÃO 4 — clara: vagas abertas */}
      <PageSection>
        <PageContainer>
          <div id="vagas" className="scroll-mt-28">
            <SectionHeader
              eyebrow="Vagas em destaque"
              title="Oportunidades abertas para a próxima etapa."
              description="Posições ativas na operação. Candidature-se diretamente ou envie seu perfil para a base de talentos."
              align="center"
            />

            <CareersJobsList jobs={careersPage.jobs} />
          </div>
        </PageContainer>
      </PageSection>

      {/* SEÇÃO 5 — azul escuro: candidatura direta */}
      <section id="candidatura" className="relative overflow-hidden bg-slate-950 py-16 sm:py-20 scroll-mt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />

        <PageContainer className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300 backdrop-blur-sm">
                Candidatura direta
            </span>
            <h2 className="mt-5 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight tracking-[-0.04em] text-white">
              Envie seu currículo para a filial desejada.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-slate-300 sm:text-base">
              Selecione a filial e abra seu e-mail já direcionado para ela.
            </p>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-left shadow-xl backdrop-blur-sm sm:p-6">
              <CareersApplicationSelector units={units} />
              <div className="mt-4 border-t border-white/10 pt-4">
                <ActionLink
                  action={{
                    label: careersPage.directApplication.buttons[1]?.label || "Abrir contato",
                    href: careersPage.directApplication.buttons[1]?.url || site.contact,
                    external: careersPage.directApplication.buttons[1]?.external,
                    variant: "ghost",
                  }}
                  tone="dark"
                  className="min-h-9 px-0 py-1 text-sm text-sky-300 hover:text-white"
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6fb_100%)] py-20 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(29,78,216,0.07),transparent_20%),radial-gradient(circle_at_82%_18%,rgba(6,182,212,0.06),transparent_18%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/10 to-transparent" />
        
        <PageContainer className="relative">
          <div className="flex flex-col items-center justify-between gap-12 rounded-[2rem] border border-[var(--border)] bg-white/60 p-8 shadow-sm backdrop-blur-md lg:flex-row lg:p-12 xl:p-16">
            
            <div className="flex max-w-2xl flex-col items-start text-left">
              <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--primary)]/10 bg-[var(--primary)]/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)] backdrop-blur-sm sm:px-4 sm:tracking-[0.24em]">
                Não encontrou a vaga certa?
              </span>
              
              <h2 className="mt-6 text-[clamp(2rem,3.5vw,2.8rem)] font-extrabold leading-[1.08] tracking-[-0.04em] text-[var(--foreground)]">
                Entre na base de talentos da Rodogarcia.
              </h2>
              
              <p className="mt-5 text-[15px] leading-8 text-[var(--color-muted-raw)] sm:text-base">
                Se o seu perfil faz sentido para a operação, o RH pode avaliar sua candidatura mesmo fora das vagas em destaque.
              </p>
              
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
                {[
                  "Base de talentos ativa",
                  "Contato direto com RH",
                  "Processo estruturado"
                ].map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]/80">
                    <CheckCircle size={18} weight="fill" className="text-[var(--primary)]" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="grid w-full shrink-0 grid-cols-1 gap-3 sm:flex sm:flex-row sm:gap-4 lg:w-auto lg:flex-col">
              <ActionLink
                action={{
                  label: careersPage.finalCta.buttons[0]?.label || "Enviar curriculo",
                  href: "#candidatura",
                }}
                className="min-h-[64px] w-full min-w-0 shadow-[0_12px_32px_rgba(29,78,216,0.22)] sm:min-w-[260px]"
              />
              <ActionLink
                action={{
                  label: careersPage.finalCta.buttons[1]?.label || "Falar com contato",
                  href: careersPage.finalCta.buttons[1]?.url || site.contact,
                  external: careersPage.finalCta.buttons[1]?.external,
                  variant: "contrast",
                }}
                className="min-h-[64px] w-full min-w-0 text-[15px] sm:min-w-[260px]"
              />
            </div>
            
          </div>
        </PageContainer>
      </section>
    </PageShell>
  );
}
