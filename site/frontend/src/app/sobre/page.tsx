import type { Metadata } from "next";
import {
  MapPinLine,
  Trophy,
  LightbulbFilament,
} from "@phosphor-icons/react/dist/ssr";
import { PageContainer, PageSection, PageShell, SectionHeader, SemanticLink } from "@/components/internal/PageContent";
import { AboutHero } from "@/components/internal/AboutHero";
import { ValuesSection } from "@/components/internal/ValuesSection";
import { ComplianceSection } from "@/components/internal/ComplianceSection";
import { HistoryTimeline } from "@/components/internal/HistoryTimeline";
import { fetchPublicContent } from "@/lib/api";
import { buildCmsMetadata } from "@/lib/cmsPublic";
import { seo, site } from "@/lib/routes";
import type { AboutPageContent } from "@/types/content";

export const dynamic = "force-dynamic";

const fallbackMetadata: Metadata = {
  title: "Sobre a Rodogarcia",
  description:
    "Conheça a trajetória, os valores e a estrutura que sustentam a Rodogarcia como operação nacional de logística.",
  alternates: { canonical: seo.absoluteUrl(site.about) },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: seo.siteName,
    title: "Sobre a Rodogarcia | Logística com visão de longo prazo",
    description:
      "História, cultura, cobertura e disciplina operacional para crescer com consistência.",
    url: seo.absoluteUrl(site.about),
    images: [{ url: seo.absoluteUrl("/caminhoneiro1.webp") }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sobre a Rodogarcia | Logística com visão de longo prazo",
    description:
      "Veja como a Rodogarcia combina experiência operacional, capilaridade e consistência.",
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
  return buildCmsMetadata(site.about, fallbackMetadata);
}

const HIGHLIGHTS = [
  {
    icon: Trophy,
    title: "Disciplina operacional",
    description:
      "Prazo, previsibilidade e consistência tratados como parte central da entrega.",
  },
  {
    icon: MapPinLine,
    title: "Cobertura estratégica",
    description:
      "Capilaridade para atender diferentes rotas sem desmontar o padrão de resposta.",
  },
  {
    icon: LightbulbFilament,
    title: "Evolução contínua",
    description:
      "Processo, tecnologia e experiência digital melhorados sem criar ruído desnecessário.",
  },
];

const ABOUT_STATS = [
  { value: "35+", label: "Anos de experiência" },
  { value: "1.500+", label: "Pontos de coleta" },
  { value: "1M+", label: "Pacotes processados" },
];

const FALLBACK_ABOUT_PAGE: AboutPageContent = {
  hero: {
    title: "Mais de 35 anos conectando o Brasil",
    description:
      "Desde 1989, transformando a logística com excelência, tecnologia e compromisso com cada entrega.",
    media: { src: "/caminhoneiro1.webp", alt: "Operação Rodogarcia em movimento" },
    buttons: [
      { label: "Solicitar cotação", url: site.quote },
      { label: "Conhecer serviços", url: site.services },
    ],
  },
  compliance: {
    image: { src: "/certificados/certificado-sassmaq.webp", alt: "Certificado SASSMAQ" },
    title: "Governanca e Compliance",
    description:
      "Certificações, licenças e controles sustentam operações com mais segurança, rastreabilidade e previsibilidade.",
    certificateText: "SASSMAQ, ISO 9001 e licenças operacionais ativas.",
    certificateUrl: "",
    certifications: [
      { title: "ISO 9001", description: "Gestão da qualidade aplicada em cada camada da operação.", image: { src: "/certificados/LOGO ISO 9001.svg", alt: "Certificado ISO 9001" } },
      { title: "SASSMAQ", description: "Segurança, saúde e meio ambiente em processos sensíveis.", image: { src: "/certificados/certificado-sassmaq.webp", alt: "Certificado SASSMAQ" } },
      { title: "EcoVadis", description: "Maturidade em sustentabilidade e responsabilidade corporativa.", image: { src: "/certificados/ecovadis.webp", alt: "Certificação EcoVadis" } },
      { title: "Licença PF", description: "Autorização para operações que exigem controles adicionais.", image: { src: "/certificados/pf.webp", alt: "Licença Polícia Federal" } },
      { title: "Polícia Civil SP", description: "Habilitação estadual alinhada a operações com governança ampliada.", image: { src: "/certificados/pc-sp.webp", alt: "Licença Polícia Civil de São Paulo" } },
      { title: "Exército Brasileiro", description: "Autorização conectada a rotinas com requisitos extras de controle.", image: { src: "/certificados/exercito-br.webp", alt: "Certificado Exército Brasileiro" } },
      { title: "IBAMA", description: "Conformidade e controle rigoroso em operações com impacto e regulamentação ambiental.", image: { src: "/certificados/ibama.webp", alt: "Certificado IBAMA" } },
    ],
  },
  finalCta: {
    title: "Estruture sua operação com a Rodogarcia.",
    description: "Mais previsibilidade. Sem surpresas na sua malha logística.",
    buttons: [
      { label: "Solicitar cotação agora", url: site.quote },
      { label: "Falar com atendimento", url: site.contact },
    ],
  },
};

export default async function SobrePage() {
  const content = await fetchPublicContent();
  const aboutPage = content.data?.aboutPage ?? FALLBACK_ABOUT_PAGE;
  
  return (
    <PageShell>
      <AboutHero
        eyebrow="Nossa história"
        title={aboutPage.hero.title}
        description={aboutPage.hero.description}
        stats={ABOUT_STATS}
        image={aboutPage.hero.media.src}
        imageAlt={aboutPage.hero.media.alt}
        imagePresentation={aboutPage.hero.media.presentation}
        buttons={aboutPage.hero.buttons.map((button, index) => ({
          label: button.label,
          href: button.url,
          external: button.external,
          variant: index === 1 ? "secondary" : "primary",
        }))}
      />

      <PageSection className="relative overflow-hidden">
        <div className="decorative-grid absolute inset-0" data-theme="light" />

        <PageContainer className="relative z-10">
          <SectionHeader
            eyebrow="Base da marca"
            title="Três pilares sustentam a percepção de confiança."
            description="A diferença aparece na combinação entre disciplina operacional, presença estratégica e evolução consistente."
            align="center"
          />

          <div className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-3 md:gap-5 lg:gap-6">
            {HIGHLIGHTS.map((item, index) => (
              <div 
                key={item.title} 
                className="group relative isolate flex min-h-[240px] flex-col overflow-hidden rounded-[var(--radius-action-lg)] border border-[var(--color-action-border)] bg-[var(--color-action-surface)] p-5 shadow-[var(--shadow-action)] ring-1 ring-[var(--color-action-ring)] backdrop-blur-xl transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out before:pointer-events-none before:absolute before:inset-0 before:-z-[1] before:bg-[linear-gradient(135deg,rgba(29,78,216,0.09),rgba(6,182,212,0.045)_46%,transparent_76%)] before:opacity-0 before:transition-opacity before:duration-300 after:pointer-events-none after:absolute after:inset-x-5 after:top-0 after:h-px after:bg-[linear-gradient(90deg,transparent,var(--color-action-highlight),transparent)] hover:-translate-y-px hover:border-[var(--primary)]/26 hover:bg-[var(--color-action-surface-hover)] hover:shadow-[var(--shadow-action-hover)] hover:before:opacity-100 sm:p-6"
              >
                <div className="mb-6 flex items-center justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[calc(var(--radius-action)_-_2px)] border border-[var(--primary)]/10 bg-[var(--color-primary-soft)] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
                    <item.icon size={23} weight="duotone" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-[13px] font-extrabold tracking-[0.18em] text-[var(--primary)]/46 transition-colors duration-300 group-hover:text-[var(--primary)]/75">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-[15px] leading-7 text-[var(--color-muted-raw)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </PageContainer>
      </PageSection>

      <section className="relative overflow-hidden bg-[#020617] py-12 sm:py-16 lg:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.15)_0%,rgba(2,6,23,1)_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,transparent_60%)]" />
        <div className="decorative-grid absolute inset-0" data-theme="dark" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent opacity-80" />

        <PageContainer className="relative z-10">
          <div className="relative space-y-8">
            <SectionHeader
              eyebrow="História"
              title="Crescimento com método, não com improviso."
              description="Uma leitura direta da evolução da Rodogarcia ao longo do tempo."
              theme="dark"
              align="center"
            />

            <HistoryTimeline />
          </div>
        </PageContainer>
      </section>

      <PageSection className="relative overflow-hidden">
        <div className="decorative-grid absolute inset-0" data-theme="light" />

        <PageContainer className="relative z-10">
          <div className="mb-16 max-w-2xl">
            <div className="max-w-2xl">
              <SectionHeader
                eyebrow="Valores"
                title="Valores que sustentam a operação."
                description="Mesmo com crescimento, a leitura interna continua simples: segurança, pontualidade, respeito e excelência."
                align="left"
              />
            </div>
          </div>

          <ValuesSection />

          <div className="mt-8 flex justify-center">
            <SemanticLink
              href={site.business}
              className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--color-surface-strong)] px-6 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--foreground)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition-[background-color,border-color,transform] duration-200 hover:border-[var(--primary)]/20 hover:bg-[var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 active:scale-[0.99]"
            >
              Quero ser parceiro
            </SemanticLink>
          </div>
        </PageContainer>
      </PageSection>

      {/* SEÇÃO COMPLIANCE WALL (Scroll Reveal Mobile + Desktop Cinematic Carousel) */}
      <ComplianceSection content={aboutPage.compliance} />

      {/* SEÇÃO CTA FINAL SIMPLIFICADA */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="decorative-grid absolute inset-0" data-theme="light" />

        <PageContainer className="relative z-10">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--primary)] mb-4">
              Próximo passo
            </span>

            <h2 className="text-[clamp(2.25rem,5vw,4rem)] font-extrabold leading-[1.05] tracking-tight text-[var(--foreground)]">
              {aboutPage.finalCta.title}
            </h2>

            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              {aboutPage.finalCta.description}
            </p>

            <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-center sm:gap-5">
              <SemanticLink
                href={aboutPage.finalCta.buttons[0]?.url || site.quote}
                external={aboutPage.finalCta.buttons[0]?.external}
                className="group inline-flex min-h-[64px] w-full min-w-0 items-center justify-center rounded-full bg-[var(--primary)] px-4 text-[15px] font-extrabold tracking-tight text-white shadow-[0_12px_32px_rgba(2,132,199,0.25)] transition-all duration-200 hover:-translate-y-1 hover:bg-[var(--primary)]/90 hover:shadow-[0_20px_48px_rgba(2,132,199,0.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/30 sm:w-auto sm:min-w-[320px] sm:px-10"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="min-w-0 truncate">{aboutPage.finalCta.buttons[0]?.label || "Solicitar cotação agora"}</span>
                  <svg
                    className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </SemanticLink>

              <SemanticLink
                href={aboutPage.finalCta.buttons[1]?.url || site.contact}
                external={aboutPage.finalCta.buttons[1]?.external}
                className="inline-flex min-h-[64px] w-full min-w-0 items-center justify-center rounded-full bg-slate-900 px-4 text-[15px] font-bold tracking-tight text-white shadow-[0_12px_32px_rgba(15,23,42,0.15)] transition-all duration-200 hover:-translate-y-1 hover:bg-slate-800 hover:shadow-[0_20px_48px_rgba(15,23,42,0.25)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/30 sm:w-auto sm:min-w-[240px] sm:px-10"
              >
                <span className="min-w-0 truncate">{aboutPage.finalCta.buttons[1]?.label || "Falar com atendimento"}</span>
              </SemanticLink>
            </div>
          </div>
        </PageContainer>
      </section>
    </PageShell>
  );
}
