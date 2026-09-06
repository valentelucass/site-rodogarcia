import type { Metadata } from "next";
import { PresentedImage } from "@/components/media/PresentedImage";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fetchPublicContent } from "@/lib/api";
import { external, seo, site } from "@/lib/routes";
import { buildCmsMetadata } from "@/lib/cmsPublic";
import type { ServicesModule, ServicesPageContent } from "@/types/content";

const fallbackMetadata: Metadata = {
  title: "Serviços",
  description:
    "Distribuição nacional, operação indoor e cargas especiais com uma apresentação mais limpa, premium e orientada a decisão.",
  alternates: { canonical: seo.absoluteUrl(site.services) },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: seo.siteName,
    title: "Serviços | Rodogarcia Transportes",
    description:
      "Conheça a estrutura de serviços da Rodogarcia com foco em distribuição, operação indoor e cargas especiais.",
    url: seo.absoluteUrl(site.services),
    images: [{ url: seo.absoluteUrl("/Gemini_Generated_Image_h09yu8h09yu8h09y.webp") }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Serviços | Rodogarcia Transportes",
    description:
      "Módulos de serviço organizados para leitura rápida, com operação premium e rastreio oficial.",
    images: [seo.absoluteUrl("/Gemini_Generated_Image_h09yu8h09yu8h09y.webp")],
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
  return buildCmsMetadata(site.services, fallbackMetadata);
}

const MODULE_CTA_CLASS_NAME =
  "mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(29,78,216,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] hover:shadow-[0_22px_46px_rgba(29,78,216,0.24)] sm:w-auto";

const EMPTY_SERVICES_PAGE: ServicesPageContent = {
  modules: [],
  finalCta: { quoteUrl: "", trackingUrl: "" },
  faq: { title: "", items: [] },
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function ModuleCta({ module }: { module: ServicesModule }) {
  const content = (
    <>
      {module.ctaLabel}
      <ArrowUpRight size={16} weight="bold" />
    </>
  );

  if (isExternalHref(module.ctaUrl)) {
    return (
      <a
        href={module.ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={MODULE_CTA_CLASS_NAME}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={module.ctaUrl} className={MODULE_CTA_CLASS_NAME}>
      {content}
    </Link>
  );
}

function FinalQuoteCta({ href }: { href: string }) {
  const content = (
    <>
      <span className="min-w-0 truncate">Solicitar cotação</span>
      <ArrowUpRight size={16} weight="bold" className="shrink-0" />
    </>
  );
  const className =
    "inline-flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_22px_54px_rgba(2,6,23,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 sm:px-7";

  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export default async function ServicosPage() {
  let servicesPage = EMPTY_SERVICES_PAGE;
  const contentResponse = await fetchPublicContent();
  if (contentResponse.success) {
    servicesPage = contentResponse.data?.servicesPage ?? EMPTY_SERVICES_PAGE;
  }

  const serviceModules = servicesPage.modules.length === 3 ? servicesPage.modules : [];
  const quoteUrl = servicesPage.finalCta.quoteUrl || site.quote;
  const trackingUrl = servicesPage.finalCta.trackingUrl || external.tracking;
  const faqItems = servicesPage.faq.items;
  const hasFaq = Boolean(servicesPage.faq.title && faqItems.length > 0);

  return (
    <div className="relative overflow-x-clip pb-16 sm:pb-20 lg:pb-24">
      <div className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />

        <section className="relative pt-20 sm:pt-24 lg:pt-28" aria-labelledby="serviços-hero-title">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
            <div className="mx-auto max-w-[920px] py-10 text-center sm:py-12 lg:py-16">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80 backdrop-blur-sm">
                Soluções Rodogarcia
              </span>

              <h1
                id="serviços-hero-title"
                className="mx-auto mt-6 max-w-[16ch] text-[clamp(3rem,8vw,6rem)] font-bold leading-[0.9] tracking-[-0.05em] sm:max-w-[18ch] sm:tracking-[-0.07em]"
              >
                <span className="block bg-[linear-gradient(180deg,#a5f3fc_0%,#dbeafe_100%)] bg-clip-text text-transparent">
                  Operação desenhada
                </span>
                <span className="mt-1 block text-white">para manter o fluxo.</span>
              </h1>

              <p className="mx-auto mt-5 max-w-[42rem] text-sm leading-7 text-white/68 sm:text-base">
                Há mais de 35 anos, a Rodogarcia estrutura distribuição, indoor
                e cargas especiais com leitura técnica, resposta rápida e
                rastreabilidade oficial.
              </p>

              <div className="mt-8 flex justify-center">
                <Link
                  href={site.quote}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_44px_rgba(2,6,23,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100"
                >
                  Solicitar cotação
                  <ArrowUpRight size={16} weight="bold" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {serviceModules.length === 3 ? (
        <section
          className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6fb_100%)] py-14 sm:py-16 lg:py-20"
          aria-label="Módulos de serviço"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(29,78,216,0.08),transparent_22%),radial-gradient(circle_at_82%_16%,rgba(6,182,212,0.08),transparent_20%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/60 to-transparent" />

          <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
            <div className="pt-2 sm:pt-4">
              <div className="space-y-14 sm:space-y-16 lg:space-y-18">
                {serviceModules.map((module, index) => {
                  const isInverted = index % 2 === 1;
                  const legacyObjectPosition = {
                    "object-top": "center top",
                    "object-bottom": "center bottom",
                    "object-left": "left center",
                    "object-right": "right center",
                    "object-[50%_45%]": "50% 45%",
                  }[module.image.position ?? ""] ?? "center center";
                  const presentation = module.image.presentation ?? {
                    desktop: { focalPoint: legacyObjectPosition === "center top" ? { x: 50, y: 0 } : legacyObjectPosition === "center bottom" ? { x: 50, y: 100 } : legacyObjectPosition === "left center" ? { x: 0, y: 50 } : legacyObjectPosition === "right center" ? { x: 100, y: 50 } : { x: 50, y: 50 } },
                  };

                  return (
                    <article
                      key={module.id}
                      className="grid gap-6 border-t border-[var(--border)] pt-10 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-center lg:gap-12"
                    >
                      <div
                        className={`order-1 relative min-h-[280px] overflow-hidden rounded-[30px] bg-[#dbe7f3] shadow-[0_24px_64px_rgba(15,23,42,0.12)] sm:min-h-[360px] lg:min-h-[430px] ${
                          isInverted ? "lg:order-2" : "lg:order-1"
                        }`}
                      >
                        <PresentedImage
                          src={module.image.src}
                          alt={module.image.alt}
                          presentation={presentation}
                          width={module.image.width}
                          height={module.image.height}
                          thumbnailUrl={module.image.thumbnailUrl}
                          thumbnailWidth={module.image.thumbnailWidth}
                          thumbnailHeight={module.image.thumbnailHeight}
                          mediumUrl={module.image.mediumUrl}
                          mediumWidth={module.image.mediumWidth}
                          mediumHeight={module.image.mediumHeight}
                          largeUrl={module.image.largeUrl}
                          largeWidth={module.image.largeWidth}
                          largeHeight={module.image.largeHeight}
                          sizes="(max-width: 1023px) calc(100vw - 3rem), 52vw"
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04)_0%,rgba(15,23,42,0.18)_100%)]" />
                      </div>

                      <div className={`order-2 ${isInverted ? "lg:order-1" : "lg:order-2"}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                          {module.eyebrow}
                        </p>
                        <h3 className="mt-3 max-w-[13ch] text-[clamp(2rem,4vw,3.4rem)] font-bold leading-[0.95] tracking-[-0.05em] text-[var(--foreground)]">
                          {module.title}
                        </h3>
                        <p className="mt-4 max-w-[54ch] text-sm leading-7 text-[var(--color-muted-raw)] sm:text-base">
                          {module.description}
                        </p>

                        <ul className="mt-6 space-y-3">
                          {module.details.map((detail) => (
                            <li
                              key={detail}
                              className="flex items-start gap-3 text-sm leading-6 text-[var(--color-foreground-soft)]"
                            >
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>

                        <ModuleCta module={module} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#07111f_0%,#050b16_100%)] py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(56,189,248,0.1),transparent_22%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:34px_34px]" />

        <div className="relative mx-auto max-w-[960px] px-5 text-center sm:px-8">
          <h2 className="mx-auto max-w-[16ch] text-[clamp(2.5rem,5vw,5rem)] font-bold leading-[0.92] tracking-[-0.06em] text-white">
            Abra sua cotação com mais clareza.
          </h2>
          <p className="mx-auto mt-4 max-w-[42rem] text-sm leading-7 text-white/68 sm:text-base">
            Se a demanda já está definida, seguimos para a proposta. Se ainda
            precisa calibrar o desenho logístico, o time direciona o próximo
            passo.
          </p>

          <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-row sm:justify-center">
            <FinalQuoteCta href={quoteUrl} />

            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/12 sm:px-7"
            >
              <span className="min-w-0 truncate">Rastreio oficial</span>
              <ArrowUpRight size={16} weight="bold" className="shrink-0" />
            </a>
          </div>
        </div>
      </section>

      {hasFaq ? (
        <section
          className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6fb_100%)] py-14 sm:py-16 lg:py-20"
          aria-labelledby="faq-title"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(29,78,216,0.07),transparent_20%),radial-gradient(circle_at_82%_18%,rgba(6,182,212,0.06),transparent_18%)]" />

          <div className="relative mx-auto max-w-[980px] px-5 sm:px-8">
            <div className="max-w-[680px]">
              <h2
                id="faq-title"
                className="text-[clamp(2.1rem,4vw,3.8rem)] font-bold leading-[0.96] tracking-[-0.05em] text-[var(--foreground)]"
              >
                {servicesPage.faq.title}
              </h2>
            </div>

            <Accordion className="mt-8">
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={item.id || item.question}
                  value={`faq-${index}`}
                  className="border-b border-[var(--border)]"
                >
                  <AccordionTrigger className="py-6 text-left text-base font-semibold tracking-[-0.02em] text-[var(--foreground)] hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-[62ch] pb-6 pr-8 text-sm leading-7 text-[var(--color-muted-raw)]">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      ) : null}
    </div>
  );
}
