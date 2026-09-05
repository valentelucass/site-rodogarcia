"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HomeSection1 } from "@/types/content";
import { PresentedVideo } from "@/components/media/PresentedVideo";
import { PresentedImage } from "@/components/media/PresentedImage";

interface PostHeroInteractiveShowcaseProps {
  section: HomeSection1;
}

const COOLDOWN_MS = 280;
const BLOCK_VH = 0.22;

function isVideoAsset(src: string): boolean {
  return /\.(mp4|webm|ogg)$/i.test(src);
}

export default function PostHeroInteractiveShowcase({
  section,
}: PostHeroInteractiveShowcaseProps) {
  const items = section.items.filter((item) => item.title && item.description && item.media?.src);
  const [current, setCurrent] = useState(0);
  const [mediaVisible, setMediaVisible] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const cooldownRef = useRef(false);
  const lastScrollY = useRef(0);
  const pendingIndexRef = useRef(0);

  const applyIndex = useCallback((newIndex: number) => {
    if (newIndex === pendingIndexRef.current) return;
    pendingIndexRef.current = newIndex;
    setMediaVisible(false);
    setTimeout(() => {
      setCurrent(newIndex);
      setMediaVisible(true);
    }, 220);
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const element = sectionRef.current;
    if (!element) return;

    const handleScroll = () => {
      if (cooldownRef.current) return;
      const rect = element.getBoundingClientRect();
      const vh = window.innerHeight;
      const scrollingDown = window.scrollY > lastScrollY.current;
      lastScrollY.current = window.scrollY;
      if (rect.bottom < 0 || rect.top > vh) return;
      const sectionCenterY = rect.top + rect.height / 2;
      const viewportCenter = vh / 2;
      const progress = Math.max(
        0,
        Math.min(1, (viewportCenter - sectionCenterY) / (rect.height / 2))
      );
      const rawTarget = Math.floor(progress / BLOCK_VH);
      const clampedTarget = Math.max(0, Math.min(items.length - 1, rawTarget));
      const delta = clampedTarget - pendingIndexRef.current;
      if (delta === 0) return;
      const nextIndex = scrollingDown
        ? Math.min(items.length - 1, pendingIndexRef.current + 1)
        : Math.max(0, pendingIndexRef.current - 1);
      cooldownRef.current = true;
      applyIndex(nextIndex);
      setTimeout(() => {
        cooldownRef.current = false;
      }, COOLDOWN_MS);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [applyIndex, items.length]);

  const handleClick = useCallback((index: number) => {
    pendingIndexRef.current = index;
    setMediaVisible(false);
    setTimeout(() => {
      setCurrent(index);
      setMediaVisible(true);
    }, 220);
  }, []);

  if (!section.title || !section.ctaLabel || !section.ctaUrl || items.length !== 3) {
    return null;
  }

  const activeItem = items[current] ?? items[0];
  const mediaSrc = activeItem.media.desktopSrc || activeItem.media.src;
  const mobileMediaSrc = activeItem.media.mobileSrc || mediaSrc;

  return (
    <section ref={sectionRef} className="bg-[var(--color-surface-2)] py-16">
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="mx-auto mb-10 max-w-[720px] text-center">
          <h2 className="text-[clamp(2.1rem,4vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.05em] text-[var(--foreground)]">
            {section.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="w-full">
            <div
              className="overflow-hidden rounded-[38px] bg-[#dce7f7] shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
              style={{
                opacity: mediaVisible ? 1 : 0,
                transform: mediaVisible ? "translateY(0px)" : "translateY(10px)",
                transition: "opacity 220ms cubic-bezier(0.4,0,0.2,1), transform 220ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              {isVideoAsset(mediaSrc) ? (
                <PresentedVideo
                  key={mediaSrc}
                  src={mediaSrc}
                  mobileSrc={mobileMediaSrc}
                  presentation={activeItem.media.presentation}
                  mobileBreakpoint={1023}
                  preload="metadata"
                  poster={activeItem.media.poster}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <PresentedImage key={mediaSrc} src={mediaSrc} mobileSrc={mobileMediaSrc} presentation={activeItem.media.presentation} mobileBreakpoint={1023} alt={activeItem.media.alt || activeItem.title} className="aspect-square w-full object-cover" loading="lazy" decoding="async" />
              )}
            </div>
          </div>

          <div>
            <div className="divide-y divide-[var(--border)]">
            {items.map((item, index) => {
              const isActive = index === current;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleClick(index)}
                  aria-pressed={isActive}
                  className={[
                    "group flex w-full items-start gap-4 py-6 text-left transition-all duration-200",
                    isActive ? "opacity-100" : "opacity-45 hover:opacity-80",
                  ].join(" ")}
                >
                  <span className={[
                    "mt-1 h-14 w-[6px] shrink-0 rounded-full transition-all duration-300",
                    isActive ? "bg-[linear-gradient(180deg,#1d4ed8_0%,#06b6d4_100%)] shadow-[0_0_0_1px_rgba(29,78,216,0.08)]" : "bg-[var(--border)]",
                  ].join(" ")} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-[1.6rem]">
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-[62ch] overflow-hidden text-sm leading-7 text-[var(--color-muted-raw)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:text-base">
                      {item.description}
                    </p>
                  </div>
                  <span
                    className={[
                      "mt-4 inline-flex h-4 w-4 shrink-0 rotate-45 items-center justify-center rounded-[3px] border transition-all duration-300",
                      isActive
                        ? "border-[var(--primary)] bg-[var(--primary)] shadow-[0_3px_8px_rgba(29,78,216,0.18)]"
                        : "border-slate-200 bg-white",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            </div>
            <div className="mt-8 flex justify-center">
              <Link
                href={section.ctaUrl}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)]"
              >
                <span>{section.ctaLabel}</span>
                <ArrowUpRightIcon />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4.667 11.333 11.333 4.667M6 4.667h5.333V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
