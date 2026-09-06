import type { Metadata } from "next";
import { fetchPublicContent } from "@/lib/api";
import type { HomePageContent } from "@/types/content";
import BrazilMapWrapper from "@/components/home/BrazilMapWrapper";
import OperationsCarousel from "@/components/home/OperationsCarousel";
import FinalQuoteCtaSection from "@/components/home/FinalQuoteCtaSection";
import HeroCarousel from "@/components/home/HeroCarousel";
import PostHeroInteractiveShowcase from "@/components/home/PostHeroInteractiveShowcase";
import QuickActionsSection from "@/components/home/QuickActionsSection";
import ServiceLinesRebrand from "@/components/home/ServiceLinesRebrand";
import TestimonialsCarousel from "@/components/home/TestimonialsCarousel";
import TrackingLookupSection from "@/components/home/TrackingLookupSection";
import { external, seo, site } from "@/lib/routes";
import { buildCmsMetadata, fetchMediaSlots, mediaSlot } from "@/lib/cmsPublic";

export const dynamic = "force-dynamic";

const fallbackMetadata: Metadata = {
  title: {
    absolute: "Rodogarcia Transportes | Logística com previsibilidade nacional",
  },
  description:
    "Rodogarcia Transportes: logística nacional com segurança, previsibilidade operacional e rastreabilidade em toda a jornada.",
  alternates: { canonical: seo.absoluteUrl(site.home) },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: seo.siteName,
    title: "Rodogarcia Transportes | Logística com previsibilidade nacional",
    description:
      "Frete, distribuição, operações dedicadas e rastreabilidade para empresas que precisam de consistência em escala.",
    url: seo.absoluteUrl(site.home),
    images: [{ url: seo.absoluteUrl(seo.defaultOgImage) }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rodogarcia Transportes | Logística com previsibilidade nacional",
    description:
      "Operação nacional com segurança, eficiência e uma experiência digital moderna para cotação e rastreio.",
    images: [seo.absoluteUrl(seo.defaultOgImage)],
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
  return buildCmsMetadata(site.home, fallbackMetadata);
}

const EMPTY_HOME_PAGE: HomePageContent = {
  hero: { slides: [] },
  section1: { title: "", ctaLabel: "", ctaUrl: "", items: [] },
  section2: { title: "", items: [] },
  section3: {
    badge: "",
    title: "",
    description: "",
    ctaLabel: "",
    ctaUrl: "",
    cards: [],
  },
  regionalPresence: { units: [] },
  trackingCta: {
    buttons: [
      { label: "Rastrear agora", url: external.tracking, enabled: true },
      { label: "Como consultar", url: site.help, enabled: true, variant: "outline" },
    ],
  },
  socialProof: { title: "", feedbacks: [] },
  quickActions: [
    { id: "qa-taxas", order: 1, label: "Taxas", href: "", icon: "FilePdf", type: "download", enabled: false, downloadFile: "" },
    { id: "qa-cotacao", order: 2, label: "Cotação", href: site.quote, icon: "Calculator", type: "link", enabled: true },
    { id: "qa-rastreamento", order: 3, label: "Rastreamento", href: external.tracking, icon: "MagnifyingGlass", type: "external", enabled: true },
    { id: "qa-coleta", order: 4, label: "Solicitar Coleta", href: site.collections, icon: "Truck", type: "link", enabled: true },
    { id: "qa-cidades", order: 5, label: "Cidades", href: "#mapa-regional", icon: "MapPin", type: "modal", enabled: true },
    { id: "qa-whatsapp", order: 6, label: "WhatsApp", href: site.contact, icon: "WhatsappLogo", type: "link", enabled: true },
    { id: "qa-telefone", order: 7, label: "Telefone", href: external.phoneHref, icon: "Phone", type: "external", enabled: true },
    { id: "qa-email", order: 8, label: "E-mail", href: external.commercialEmail, icon: "Envelope", type: "external", enabled: true },
  ],
};

const CERTS = [
  {
    src: "/certificados/iso-9001.9371c4a6c19f.webp",
    alt: "ISO 9001",
    title: "ISO 9001",
    slot: "home.cert.iso",
  },
  {
    src: "/certificados/certificado-sassmaq.webp",
    alt: "SASSMAQ",
    title: "SASSMAQ",
    slot: "home.cert.sassmaq",
  },
  {
    src: "/certificados/ecovadis.webp",
    alt: "EcoVadis",
    title: "EcoVadis",
    slot: "home.cert.ecovadis",
  },
  {
    src: "/certificados/pf.webp",
    alt: "Policia Federal",
    title: "Licenca PF",
    slot: "home.cert.pf",
  },
  {
    src: "/certificados/policia-civil-sp.57269b3e1bdd.webp",
    alt: "Policia Civil SP",
    title: "Policia Civil SP",
    slot: "home.cert.pcsp",
  },
  {
    src: "/certificados/exercito-br.webp",
    alt: "Exercito Brasileiro",
    title: "Exercito Brasileiro",
    slot: "home.cert.exercito",
  },
  {
    src: "/certificados/ibama.7198f261a1ee.webp",
    alt: "IBAMA",
    title: "IBAMA",
    slot: "home.cert.ibama",
  },
] as const;

export default async function HomePage() {
  let homePage = EMPTY_HOME_PAGE;
  const [mediaSlots, contentResponse] = await Promise.all([
    fetchMediaSlots(),
    fetchPublicContent().catch(() => null),
  ]);

  if (contentResponse?.success && contentResponse.data) {
    homePage = contentResponse.data.homePage ?? EMPTY_HOME_PAGE;
  }

  const certs = CERTS.map((cert) => ({
    ...cert,
    src: mediaSlot(mediaSlots, cert.slot, cert.src),
  }));

  return (
    <div>
      <HeroCarousel slides={homePage.hero.slides} />
      <QuickActionsSection
        actions={homePage.quickActions ?? []}
      />
      <PostHeroInteractiveShowcase section={homePage.section1} />

      <section className="py-12 sm:py-16">
        <div className="mx-auto mb-10 flex max-w-[1440px] flex-col items-center px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/10 bg-[var(--color-primary-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            Compliance e qualidade
          </span>
          <h2 className="mt-3 max-w-[26ch] text-[clamp(1.5rem,2.4vw,2.15rem)] font-extrabold leading-tight tracking-[-0.035em] text-[var(--foreground)]">
            Certificações que reforçam nossa operação.
          </h2>
        </div>

        <div className="mx-auto max-w-[1440px] px-6">
          <div
            className="certifications-marquee-viewport group relative overflow-hidden py-4"
            style={{ WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}
          >
            <div
              className="certifications-marquee flex w-max items-center gap-6 group-hover:[animation-play-state:paused] sm:gap-8"
              style={{ animation: "certifications-marquee 35s linear infinite" }}
              aria-label="Certificações e licenças operacionais"
            >
              {[...certs, ...certs].map((cert, index) => (
                <div
                  key={`${cert.title}-${index}`}
                  className={`group/card flex w-[170px] shrink-0 flex-col items-center justify-center gap-3 transition-all duration-500 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-[200px] lg:w-[220px] ${index >= CERTS.length ? "certifications-marquee-copy" : ""}`}
                  aria-hidden={index >= CERTS.length ? true : undefined}
                >
                  <img
                    src={cert.src}
                    alt={index < CERTS.length ? cert.alt : ""}
                    width={170}
                    height={88}
                    className="h-[72px] w-[150px] grayscale object-contain opacity-55 transition-all duration-500 group-hover/card:scale-[1.08] group-hover/card:grayscale-0 group-hover/card:opacity-100 motion-reduce:transition-none motion-reduce:group-hover/card:scale-100 sm:h-[82px] sm:w-[170px] lg:h-[88px]"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="text-[13px] font-semibold tracking-[0.02em] text-slate-400 transition-colors duration-500 group-hover/card:text-[var(--primary)]">
                    {cert.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <OperationsCarousel section={homePage.section2} />
      <ServiceLinesRebrand section={homePage.section3} />

      {homePage.regionalPresence.units.length > 0 ? (
        <section id="mapa-regional" className="relative overflow-hidden bg-slate-950 py-20 xl:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
          <div className="decorative-grid absolute inset-0" data-theme="dark" />

          <div className="relative mx-auto max-w-[1440px] px-6">
            <BrazilMapWrapper units={homePage.regionalPresence.units} />
          </div>
        </section>
      ) : null}

      <TrackingLookupSection buttons={homePage.trackingCta.buttons} />
      <TestimonialsCarousel section={homePage.socialProof} />
      <FinalQuoteCtaSection />
    </div>
  );
}
