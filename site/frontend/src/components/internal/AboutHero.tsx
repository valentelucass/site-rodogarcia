"use client";

import { motion } from "framer-motion";
import { ActionLink, PageContainer, type PageAction } from "./PageContent";
import { site } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { PresentedImage } from "@/components/media/PresentedImage";
import type { PageMedia } from "@/types/content";

interface StatItem {
  value: string;
  label: string;
}

interface AboutHeroProps {
  eyebrow?: string;
  title: string;
  description: string;
  stats: StatItem[];
  image: PageMedia;
  buttons?: PageAction[];
}

export function AboutHero({
  eyebrow,
  title,
  description,
  stats,
  image,
  buttons,
}: AboutHeroProps) {
  const heroButtons = buttons?.length
    ? buttons
    : [
        { label: "Solicitar cotação", href: site.quote },
        { label: "Conhecer serviços", href: site.services, variant: "secondary" as const },
      ];

  return (
    <section className="relative overflow-hidden bg-[#020617] pb-16 pt-32 text-white sm:pb-20 sm:pt-40 lg:pb-24 lg:pt-48">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.15)_0%,rgba(2,6,23,1)_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,transparent_60%)]" />
      <div className="decorative-grid absolute inset-0" data-theme="dark" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent opacity-80" />

      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 0.03, x: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="pointer-events-none absolute -bottom-10 -left-10 z-0 select-none whitespace-nowrap text-[clamp(8rem,22vw,24rem)] font-bold tracking-tighter sm:-bottom-20 sm:-left-20"
      >
        DESDE 1989
      </motion.div>

      <PageContainer className="relative z-10">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="flex max-w-[780px] flex-col">
            {eyebrow ? (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/82 backdrop-blur-sm"
              >
                <span className="h-2 w-2 rounded-full bg-sky-300" />
                {eyebrow}
              </motion.span>
            ) : null}

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-[15ch] text-[clamp(3rem,6vw,5.8rem)] font-bold leading-[0.92] tracking-[-0.07em] text-white"
            >
              {title}
            </motion.h1>

            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 0.8, ease: "circOut" }}
              className="mt-5 h-1 w-28 origin-left bg-sky-400"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="mt-6 max-w-[60ch] sm:mt-8"
            >
              <p className="text-sm leading-7 text-white/68 sm:text-base">
                {description}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="mt-8 grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-row sm:flex-wrap"
            >
              {heroButtons.slice(0, 2).map((button, index) => (
                <ActionLink
                  key={`${button.href}-${index}`}
                  action={{
                    ...button,
                    variant: index === 1 ? "secondary" : button.variant,
                  }}
                  tone="dark"
                  className="w-full min-w-0 sm:w-auto"
                />
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="relative mx-auto mt-12 w-full max-w-[320px] sm:max-w-[420px] lg:ml-auto lg:mt-0 lg:max-w-[480px]"
          >
            <div className="pointer-events-none absolute -inset-2 z-0 rounded-[28px] border border-white/10 sm:-inset-4 sm:rounded-[38px]" />

            <div className="relative z-10 aspect-[4/3] overflow-hidden rounded-[24px] border border-white/10 bg-[#0f172a] shadow-2xl sm:aspect-[3/2] sm:rounded-[34px]">
              <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(2,6,23,0.1)_100%)]" />
              <motion.div
                initial={{ scale: 1.05, filter: "blur(2px)" }}
                animate={{ scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full w-full"
              >
                <PresentedImage
                  {...image}
                  alt={image.alt || title}
                  sizes="(max-width: 1023px) 100vw, 42vw"
                  className="h-full w-full object-cover opacity-80 mix-blend-luminosity"
                />
              </motion.div>
              <div className="pointer-events-none absolute inset-0 z-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZUZpbHRlciI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuNjUiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgjbm9pc2VGaWx0ZXIpIi8+PC9zdmc+')] opacity-[0.1] mix-blend-overlay" />
              <div className="absolute inset-0 z-10 bg-gradient-to-t from-[var(--foreground)] via-transparent to-transparent" />
            </div>
          </motion.div>
        </div>

        {stats.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-16 grid grid-cols-2 items-center gap-x-4 gap-y-10 border-t border-white/10 pt-8 sm:mt-24 sm:flex sm:flex-wrap sm:justify-center sm:gap-16 lg:justify-start"
          >
            {stats.map((item, idx) => (
              <div
                key={item.label}
                className={cn(
                  "flex items-center gap-4 sm:justify-start sm:gap-10",
                  idx === stats.length - 1
                    ? "col-span-2 justify-center sm:col-span-1"
                    : "justify-center"
                )}
              >
                <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                  <span className="text-[2rem] font-bold leading-none tracking-[-0.05em] text-white sm:text-[2.5rem]">
                    {item.value}
                  </span>
                  <span className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/50 sm:text-[11px]">
                    {item.label}
                  </span>
                </div>
                {idx < stats.length - 1 ? (
                  <div className="hidden h-12 w-px bg-white/10 sm:block" />
                ) : null}
              </div>
            ))}
          </motion.div>
        ) : null}
      </PageContainer>
    </section>
  );
}
