"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import type { HomeOperationItem, HomeSection2 } from "@/types/content";
import { PresentedVideo } from "@/components/media/PresentedVideo";
import { PresentedImage } from "@/components/media/PresentedImage";

interface OperationsCarouselProps {
  section: HomeSection2;
}

interface SpotlightSlide {
  id: string;
  title: string;
  text: string;
  desktopAsset: string;
  mobileAsset: string;
  alt: string;
  poster: string;
  presentation: HomeOperationItem["media"]["presentation"];
}

const AUTO_ADVANCE_MS = 5600;
const DESKTOP_QUERY = "(min-width: 1024px)";

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function resolveAssetPath(value: string | undefined): string {
  const normalized = normalizeText(value);

  if (!normalized) return "";
  if (normalized.startsWith("/public/")) {
    return normalized.slice("/public".length);
  }

  return normalized;
}

function isVideoAsset(src: string): boolean {
  return /\.(mp4|webm|ogg)$/i.test(src);
}

function buildSpotlightSlides(slides: HomeOperationItem[]): SpotlightSlide[] {
  return slides
    .filter((slide) => slide.active !== false)
    .map((slide, index) => {
      const title = normalizeText(slide.title);
      const text = normalizeText(slide.description);
      const desktopAsset = resolveAssetPath(
        slide.media.desktopSrc || slide.media.src
      );
      const mobileAsset = resolveAssetPath(
        slide.media.mobileSrc ||
          slide.media.desktopSrc ||
          slide.media.src
      );

      if (!title && !text && !desktopAsset && !mobileAsset) return null;

      return {
        id: slide.id || `operation-${index + 1}`,
        title,
        text,
        desktopAsset,
        mobileAsset: mobileAsset || desktopAsset,
        alt: normalizeText(slide.media.alt) || title,
        poster: resolveAssetPath(slide.media.poster),
        presentation: slide.media.presentation,
      } satisfies SpotlightSlide;
    })
    .filter((slide): slide is SpotlightSlide => Boolean(slide));
}

function SpotlightMedia({
  src,
  alt,
  active,
  className,
  poster,
  presentation,
}: {
  src: string;
  alt: string;
  active: boolean;
  className: string;
  poster?: string;
  presentation?: HomeOperationItem["media"]["presentation"];
}) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className={`${className} bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.28),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(29,78,216,0.25),transparent_28%),linear-gradient(180deg,#111c33_0%,#020617_100%)]`}
      />
    );
  }

  if (isVideoAsset(src)) {
    return (
      <PresentedVideo
        src={src}
        muted
        active={active}
        presentation={presentation}
        preload="metadata"
        poster={poster || undefined}
        className={className}
      />
    );
  }

  return <PresentedImage src={src} alt={alt} presentation={presentation} className={className} loading="lazy" decoding="async" />;
}

export default function OperationsCarousel({ section }: OperationsCarouselProps) {
  const spotlightSlides = buildSpotlightSlides(section.items);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const mobileCardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (current < spotlightSlides.length) return;
    setCurrent(0);
  }, [current, spotlightSlides.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const syncViewport = () => {
      setIsDesktop(mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  const advanceSlide = useEffectEvent(() => {
    setCurrent((previous) => (previous + 1) % spotlightSlides.length);
  });

  useEffect(() => {
    if (!isDesktop || spotlightSlides.length <= 1 || paused) return;

    const timeout = window.setTimeout(() => {
      advanceSlide();
    }, AUTO_ADVANCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [advanceSlide, current, isDesktop, paused, spotlightSlides.length]);

  useEffect(() => {
    if (isDesktop || spotlightSlides.length === 0) return;

    const observedCards = mobileCardRefs.current
      .slice(0, spotlightSlides.length)
      .filter((card): card is HTMLButtonElement => Boolean(card));

    if (observedCards.length === 0) return;

    const visibleCards = new Map<number, HTMLButtonElement>();

    const syncCurrentFromViewport = () => {
      if (visibleCards.size === 0) return;

      const viewportCenter = window.innerHeight / 2;
      let nextIndex: number | null = null;
      let smallestDistance = Number.POSITIVE_INFINITY;

      for (const [index, card] of visibleCards) {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const distance = Math.abs(cardCenter - viewportCenter);

        if (distance < smallestDistance) {
          smallestDistance = distance;
          nextIndex = index;
        }
      }

      if (nextIndex === null) return;

      setCurrent((previous) => (previous === nextIndex ? previous : nextIndex));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number(
            (entry.target as HTMLButtonElement).dataset.operationIndex ?? "-1"
          );

          if (index < 0) continue;

          if (entry.isIntersecting) {
            visibleCards.set(index, entry.target as HTMLButtonElement);
          } else {
            visibleCards.delete(index);
          }
        }

        syncCurrentFromViewport();
      },
      {
        root: null,
        rootMargin: "-42% 0px -42% 0px",
        threshold: 0,
      }
    );

    for (const card of observedCards) {
      observer.observe(card);
    }

    syncCurrentFromViewport();

    return () => {
      observer.disconnect();
      visibleCards.clear();
    };
  }, [isDesktop, spotlightSlides.length]);

  if (!section.title || spotlightSlides.length === 0) return null;

  function goTo(index: number) {
    setCurrent(
      ((index % spotlightSlides.length) + spotlightSlides.length) %
        spotlightSlides.length
    );
  }

  return (
    <section
      className="relative overflow-hidden bg-slate-950 py-16 sm:py-20"
      aria-roledescription="galeria"
      aria-label="Operacao conectada Rodogarcia"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="relative mx-auto max-w-[1440px] px-6">
        <div className="max-w-full text-center">
          <h2 className="text-[clamp(1.45rem,2.8vw,2.5rem)] font-bold leading-tight tracking-[-0.04em] text-white sm:whitespace-nowrap">
            {section.title}
          </h2>
        </div>

        <div className="mt-8 hidden overflow-hidden lg:flex lg:h-[520px] lg:items-stretch lg:justify-center lg:gap-4">
          {spotlightSlides.map((slide, index) => {
            const isActive = index === current;
            const hasTextContent = Boolean(slide.title || slide.text);

            return (
              <button
                key={slide.id}
                type="button"
                aria-label={
                  slide.title
                    ? `Ver ${slide.title}`
                    : `Ver item ${index + 1} da operacao conectada`
                }
                aria-pressed={isActive}
                onMouseEnter={() => {
                  goTo(index);
                  setPaused(true);
                }}
                onFocus={() => {
                  goTo(index);
                  setPaused(true);
                }}
                onClick={() => {
                  goTo(index);
                }}
                className={`group relative min-w-0 basis-0 self-end origin-center transform-gpu overflow-hidden rounded-[42px] border text-left transition-[flex-grow,width,transform,border-color,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,flex-grow,transform] ${
                  isActive
                    ? "h-[420px] grow-[3] border-white/18 opacity-100"
                    : "h-[420px] grow border-white/10 opacity-78"
                }`}
              >
                <div className="absolute inset-0">
                  <SpotlightMedia
                    src={slide.desktopAsset}
                    alt={slide.alt || "Operação conectada Rodogarcia"}
                    poster={slide.poster}
                    presentation={slide.presentation}
                    active={isActive}
                    className={`h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isActive ? "scale-[1.02]" : "scale-100"
                    }`}
                  />
                  <div
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      isActive
                        ? "bg-[linear-gradient(180deg,rgba(2,6,23,0.08)_0%,rgba(2,6,23,0.16)_22%,rgba(2,6,23,0.88)_100%)]"
                        : "bg-[linear-gradient(180deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.42)_44%,rgba(2,6,23,0.96)_100%)]"
                    }`}
                  />
                  <div
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      isActive
                        ? "bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_34%)] opacity-100"
                        : "bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_30%)] opacity-70"
                    }`}
                  />
                </div>

                {isActive && hasTextContent ? (
                  <div className="relative z-10 flex h-full flex-col justify-end p-7">
                    <div className="max-w-[24ch]">
                      {slide.title ? (
                        <h3 className="text-[1.8rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
                          {slide.title}
                        </h3>
                      ) : null}
                      {slide.text ? (
                        <p className="mt-3 max-w-[32ch] text-sm leading-6 text-white/74">
                          {slide.text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-8 lg:hidden">
          <div className="flex flex-col gap-3">
            {spotlightSlides.map((slide, index) => {
              const isActive = index === current;
              const hasTextContent = Boolean(slide.title || slide.text);

              return (
                <button
                  key={slide.id}
                  type="button"
                  ref={(node) => {
                    mobileCardRefs.current[index] = node;
                  }}
                  data-operation-index={index}
                  aria-label={
                    slide.title
                      ? `Ver ${slide.title}`
                      : `Ver item ${index + 1} da operacao conectada`
                  }
                  aria-pressed={isActive}
                  onClick={() => {
                    goTo(index);
                  }}
                  className={`relative w-full overflow-hidden rounded-[38px] border text-left transition-[height,transform,border-color,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive
                      ? "h-[250px] border-white/18 opacity-100"
                      : "h-[112px] border-white/10 opacity-70"
                  }`}
                >
                  <div className="absolute inset-0">
                    <SpotlightMedia
                      src={slide.mobileAsset}
                      alt={slide.alt || "Operação conectada Rodogarcia"}
                    poster={slide.poster}
                    presentation={slide.presentation}
                      active={isActive}
                      className={`h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isActive ? "scale-[1.02]" : "scale-100"
                      }`}
                    />
                    <div
                      className={`absolute inset-0 ${
                        isActive
                          ? "bg-[linear-gradient(180deg,rgba(2,6,23,0.14)_0%,rgba(2,6,23,0.22)_28%,rgba(2,6,23,0.9)_100%)]"
                          : "bg-[linear-gradient(180deg,rgba(2,6,23,0.24)_0%,rgba(2,6,23,0.5)_52%,rgba(2,6,23,0.96)_100%)]"
                      }`}
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_34%)]" />
                  </div>

                  {isActive && hasTextContent ? (
                    <div className="relative z-10 flex h-full flex-col justify-end p-5">
                      {slide.title ? (
                        <h3 className="max-w-[14ch] text-[1.55rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
                          {slide.title}
                        </h3>
                      ) : null}
                      {slide.text ? (
                        <p className="mt-3 max-w-[30ch] text-sm leading-6 text-white/74">
                          {slide.text}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
