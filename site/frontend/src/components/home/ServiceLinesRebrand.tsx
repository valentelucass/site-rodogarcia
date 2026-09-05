"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { HomeSection3 } from "@/types/content";
import { cn } from "@/lib/utils";
import { PresentedVideo } from "@/components/media/PresentedVideo";
import { PresentedImage } from "@/components/media/PresentedImage";

const CARDS_PER_PAGE = 2;
const AUTO_ADVANCE_MS = 8500;

export default function ServiceLinesRebrand({
  section,
}: {
  section: HomeSection3;
}) {
  const cards = useMemo(
    () =>
      section.cards.filter(
        (card) =>
          card.media?.src &&
          card.badge &&
          card.title &&
          card.description &&
          card.ctaLabel &&
          card.ctaUrl
      ),
    [section.cards]
  );
  const pages = useMemo(() => {
    const chunks: typeof cards[] = [];
    for (let index = 0; index < cards.length; index += CARDS_PER_PAGE) {
      chunks.push(cards.slice(index, index + CARDS_PER_PAGE));
    }
    return chunks;
  }, [cards]);
  const [currentPage, setCurrentPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const totalPages = pages.length;

  useEffect(() => {
    if (currentPage < totalPages) return;
    setCurrentPage(0);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (totalPages <= 1 || paused) return;
    const timeout = window.setTimeout(() => {
      setCurrentPage((page) => (page + 1) % totalPages);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timeout);
  }, [currentPage, paused, totalPages]);

  if (
    !section.badge ||
    !section.title ||
    !section.description ||
    !section.ctaLabel ||
    !section.ctaUrl ||
    cards.length < 3
  ) {
    return null;
  }

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6fb_100%)] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(6,182,212,0.04),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(29,78,216,0.05),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(15,23,42,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.1)_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative mx-auto max-w-[1440px] px-6">
        <div className="grid gap-12 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)] xl:gap-16">
          <div className="flex flex-col justify-between gap-8 pt-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/10 bg-[var(--color-primary-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--primary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                {section.badge}
              </span>
              <h2 className="mt-6 text-[clamp(2rem,3.8vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--foreground)] [text-wrap:balance]">
                {section.title}
              </h2>
              <p className="mt-5 max-w-[32rem] text-[15px] leading-relaxed text-[var(--color-muted-raw)] sm:text-[17px]">
                {section.description}
              </p>
            </div>

            <Link
              href={section.ctaUrl}
              className="hidden w-fit items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(29,78,216,0.24)] transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--color-primary-strong)] hover:shadow-[0_16px_32px_rgba(29,78,216,0.32)] lg:inline-flex"
            >
              {section.ctaLabel}
              <ArrowRightIcon />
            </Link>
          </div>

          <div
            className="overflow-hidden"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <div
              className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `translate3d(-${currentPage * 100}%,0,0)` }}
            >
              {pages.map((page, pageIndex) => (
                <div
                  key={`service-page-${pageIndex}`}
                  className="grid w-full shrink-0 gap-5 sm:grid-cols-2"
                >
                  {page.map((card) => (
                    <ServiceCard key={card.id} card={card} />
                  ))}
                </div>
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-2">
                {pages.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Ver grupo ${index + 1} de soluções`}
                    onClick={() => setCurrentPage(index)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-500",
                      currentPage === index
                        ? "w-8 bg-[var(--primary)]"
                        : "w-2 bg-slate-300 hover:bg-slate-400"
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 lg:hidden">
          <Link
            href={section.ctaUrl}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(29,78,216,0.24)] transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--color-primary-strong)] hover:shadow-[0_16px_32px_rgba(29,78,216,0.32)]"
          >
            {section.ctaLabel}
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ServiceCard({
  card,
}: {
  card: HomeSection3["cards"][number];
}) {
  const mediaSrc = card.media.desktopSrc || card.media.src;
  const mobileMediaSrc = card.media.mobileSrc || mediaSrc;

  return (
    <article className="group flex min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-white bg-white/60 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-sky-100 hover:bg-white hover:shadow-[0_24px_50px_rgba(29,78,216,0.08)]">
      <div className="relative aspect-video overflow-hidden p-2 pb-0">
        <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-slate-100">
          {card.media.type === "video" || /\.(mp4|webm|ogg)$/i.test(mediaSrc) ? (
            <PresentedVideo
              src={mediaSrc}
              mobileSrc={mobileMediaSrc}
              presentation={card.media.presentation}
              preload="metadata"
              poster={card.media.poster}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
            />
          ) : (
            <PresentedImage src={mediaSrc} mobileSrc={mobileMediaSrc} presentation={card.media.presentation} alt={card.media.alt || card.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]" loading="lazy" decoding="async" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-transparent to-transparent opacity-80" />
          <div className="absolute left-4 top-4">
            <span className="inline-flex rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-sm backdrop-blur-md">
              {card.badge}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
        <h3 className="text-lg font-bold tracking-[-0.03em] text-[var(--foreground)] transition-colors duration-300 group-hover:text-[var(--primary)]">
          {card.title}
        </h3>
        <p className="mt-2.5 flex-1 text-[13px] leading-[1.6] text-[var(--color-muted-raw)]">
          {card.description}
        </p>
        <div className="mt-5 border-t border-slate-100/80 pt-4">
          <Link
            href={card.ctaUrl}
            className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--primary)] transition-all duration-300 hover:gap-3 hover:text-[var(--color-primary-strong)]"
          >
            {card.ctaLabel}
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.667 8h10.666M8.667 3.333 13.333 8l-4.666 4.667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
