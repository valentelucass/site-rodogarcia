import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { external, site } from "@/lib/routes";
import type { HomeHeroButton } from "@/types/content";

export default function TrackingLookupSection({ buttons }: { buttons?: HomeHeroButton[] }) {
  const primaryButton = buttons?.[0] ?? {
    label: "Rastrear agora",
    url: external.tracking,
    enabled: true,
  };
  const secondaryButton = buttons?.[1] ?? {
    label: "Como consultar",
    url: site.help,
    enabled: true,
  };
  return (
    <section
      className="relative overflow-hidden py-16 sm:py-20 lg:py-24"
      aria-labelledby="tracking-section-title"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.34),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.22),transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-12 h-44 w-[44rem] max-w-[92vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.18)_0%,rgba(56,189,248,0.1)_34%,transparent_72%)] blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-28 h-28 w-[30rem] max-w-[82vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0)_72%)]" />

      <div className="mx-auto max-w-[1440px] px-6">
        <div className="relative mx-auto flex max-w-[920px] flex-col items-center text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/72 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)] shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_rgba(6,182,212,0.12)]" />
            área de rastreio
          </p>

          <div className="mt-6 max-w-[760px]">
            <h2
              id="tracking-section-title"
              className="text-[clamp(2.6rem,5.4vw,4.8rem)] font-bold leading-[0.92] tracking-[-0.065em] text-[var(--foreground)]"
            >
              Rastreie sua carga agora.
            </h2>

            <p className="mx-auto mt-5 max-w-[46ch] text-sm leading-7 text-[var(--color-muted-raw)] sm:text-base">
              Entre direto no portal oficial para consultar o andamento da
              remessa.
            </p>
          </div>

          <div className="mt-10 flex w-full max-w-[620px] flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
            {primaryButton.enabled !== false ? (
              <a
                href={primaryButton.url || external.tracking}
                target={(primaryButton.url || "").startsWith("http") ? "_blank" : undefined}
                rel={(primaryButton.url || "").startsWith("http") ? "noopener noreferrer" : undefined}
                className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#1d4ed8_0%,#2563eb_54%,#38bdf8_100%)] px-5 pl-6 pr-5 text-sm font-semibold text-white shadow-[0_22px_52px_rgba(29,78,216,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_64px_rgba(29,78,216,0.34)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/18 sm:flex-1"
                aria-label="Acessar rastreio oficial"
              >
                <span>{primaryButton.label || "Rastrear agora"}</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/16 ring-1 ring-white/18 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                  <ArrowUpRight size={16} weight="bold" />
                </span>
              </a>
            ) : null}

            {secondaryButton.enabled !== false ? (
              <Link
                href={secondaryButton.url || site.help}
                target={(secondaryButton.url || "").startsWith("http") ? "_blank" : undefined}
                rel={(secondaryButton.url || "").startsWith("http") ? "noopener noreferrer" : undefined}
                className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border border-white/72 bg-white/76 px-5 pl-6 pr-5 text-sm font-semibold text-[var(--foreground)] shadow-[0_16px_34px_rgba(15,23,42,0.08)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[var(--primary)]/18 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/12 sm:flex-1"
              >
                <span>{secondaryButton.label || "Como consultar"}</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--primary)] transition-transform duration-300 group-hover:translate-x-0.5">
                  <ArrowRight size={16} weight="bold" />
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
