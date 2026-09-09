"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import Image from "next/image";
import { CaretLeft, CaretRight, Quotes, Star } from "@phosphor-icons/react";
import type { HomeFeedback, HomeSocialProof } from "@/types/content";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { canonicalPublicMediaUrl } from "@/lib/publicMedia";

interface TestimonialsCarouselProps {
  section: HomeSocialProof;
}

interface DisplayedFeedback {
  feedback: HomeFeedback;
  position: "previous" | "current" | "next";
}

function clampRating(value: unknown): number {
  const numeric = Number(value ?? 5);
  if (!Number.isFinite(numeric)) return 5;
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function normalizeFeedbacks(feedbacks: HomeFeedback[]): HomeFeedback[] {
  return feedbacks
    .filter((item) => item.active !== false)
    .map((item, index) => ({
      ...item,
      id: item.id || `feedback-${index + 1}`,
      rating: clampRating(item.rating),
    }))
    .filter((item) => item.name && item.role && item.context && item.testimonial);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function wrapIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

function displayFeedbacks(items: HomeFeedback[], currentIndex: number): DisplayedFeedback[] {
  if (items.length === 1) return [{ feedback: items[0], position: "current" }];
  if (items.length === 2) {
    return items.map((feedback, index) => ({
      feedback,
      position: index === currentIndex ? "current" : "next",
    }));
  }

  return [
    { feedback: items[wrapIndex(currentIndex - 1, items.length)], position: "previous" as const },
    { feedback: items[currentIndex], position: "current" as const },
    { feedback: items[wrapIndex(currentIndex + 1, items.length)], position: "next" as const },
  ];
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }).map((_, index) => {
    const filled = index < rating;
    return (
      <Star
        key={`star-${index}`}
        size={15}
        weight={filled ? "fill" : "regular"}
        className={filled ? "text-amber-400" : "text-slate-300"}
        aria-hidden="true"
      />
    );
  });
}

export default function TestimonialsCarousel({ section }: TestimonialsCarouselProps) {
  const items = useMemo(() => normalizeFeedbacks(section.feedbacks), [section.feedbacks]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalSlides = items.length;
  const prefersReducedMotion = usePrefersReducedMotion();
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const goToTestimonial = useCallback((index: number) => {
    setCurrentIndex(() => wrapIndex(index, totalSlides));
  }, [totalSlides]);

  useEffect(() => {
    setCurrentIndex((index) => (totalSlides === 0 ? 0 : wrapIndex(index, totalSlides)));
  }, [totalSlides]);

  useEffect(() => {
    if (totalSlides < 2 || prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => wrapIndex(index + 1, totalSlides));
    }, 7000);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, totalSlides]);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    touchStartXRef.current = touch?.clientX ?? null;
    touchStartYRef.current = touch?.clientY ?? null;
  }

  function clearTouchGesture() {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const touch = event.changedTouches[0];
    clearTouchGesture();

    if (startX === null || startY === null || !touch || totalSlides < 2) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    goToTestimonial(deltaX > 0 ? currentIndex - 1 : currentIndex + 1);
  }

  const displayedItems = displayFeedbacks(items, currentIndex);
  if (!section.title || displayedItems.length === 0) return null;

  return (
    <section
      className="relative overflow-hidden bg-[#0b1e3a] py-16 sm:py-20 lg:py-24"
      aria-labelledby="testimonials-title"
      aria-roledescription="carrossel"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_46%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,0.14),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_42%)]" />
      <div className="decorative-grid pointer-events-none absolute inset-0" data-theme="dark" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200 drop-shadow-md">Prova social</span>
          <h2 id="testimonials-title" className="mt-3 text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.05em] text-white drop-shadow-lg">
            {section.title}
          </h2>
        </div>

        <div
          className={`mx-auto mt-10 grid max-w-6xl touch-pan-y items-center gap-4 sm:mt-12 ${displayedItems.length === 1 ? "max-w-xl" : "sm:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)_minmax(0,1fr)] lg:gap-6"}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={clearTouchGesture}
        >
          {displayedItems.map(({ feedback, position }) => {
            const isCurrent = position === "current";
            const photoUrl = canonicalPublicMediaUrl(feedback.photo);
            return (
                <article
                  key={feedback.id}
                  className={`relative overflow-hidden rounded-[28px] border bg-white text-center shadow-[0_18px_44px_rgba(3,10,26,0.2)] transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${isCurrent ? "z-10 translate-y-0 scale-100 border-white p-6 opacity-100 sm:p-8 lg:p-9" : "hidden translate-y-3 scale-[0.86] border-white/80 p-5 opacity-75 sm:block sm:p-6"}`}
                >
                  <div className={`relative mx-auto flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-[linear-gradient(145deg,#eff6ff,#dbeafe)] text-[var(--primary)] shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${isCurrent ? "h-24 w-24 sm:h-28 sm:w-28" : "h-16 w-16 sm:h-20 sm:w-20"}`}>
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={`Foto de ${feedback.name}`}
                        fill
                        sizes={isCurrent ? "(max-width: 639px) 96px, 112px" : "(max-width: 639px) 64px, 80px"}
                        quality={65}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className={`font-bold tracking-[-0.08em] ${isCurrent ? "text-3xl" : "text-xl"}`} aria-hidden="true">{initials(feedback.name)}</span>
                    )}
                  </div>
                  <p className={`mt-3 inline-flex items-center justify-center gap-1.5 break-words font-semibold text-slate-700 ${isCurrent ? "text-sm sm:text-base" : "text-xs"}`}>
                    {feedback.context}
                  </p>
                  <div className={`relative mt-5 rounded-[22px] border border-slate-200 bg-slate-50 text-slate-800 ${isCurrent ? "p-5 sm:p-6" : "p-4"}`}>
                    <span className={`absolute left-1/2 inline-flex -translate-x-1/2 items-center justify-center rounded-2xl bg-white text-[var(--primary)] shadow-[0_8px_20px_rgba(15,23,42,0.08)] ${isCurrent ? "-top-5 h-10 w-10" : "-top-4 h-8 w-8"}`}>
                      <Quotes size={isCurrent ? 20 : 16} weight="fill" aria-hidden="true" />
                    </span>
                    <p className={`italic leading-relaxed ${isCurrent ? "mt-1 text-sm sm:text-base" : "mt-1 line-clamp-4 text-xs sm:text-sm"}`}>
                      “{feedback.testimonial}”
                    </p>
                  </div>
                  <div className={`mt-5 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 break-words ${isCurrent ? "text-sm sm:text-base" : "text-xs"}`}>
                    <h3 className="font-bold tracking-tight text-slate-950">{feedback.name}</h3>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <p className="text-slate-600">{feedback.role}</p>
                  </div>
                  <div className="mt-3 flex justify-center gap-1" role="img" aria-label={`${feedback.rating} de 5 estrelas`}>
                    {renderStars(feedback.rating)}
                  </div>
                </article>
            );
          })}
        </div>

        {totalSlides > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-1 sm:mt-10 sm:gap-4">
            <TestimonialNavButton label="Depoimento anterior" direction="previous" onClick={() => goToTestimonial(currentIndex - 1)} />
            <p className="sr-only sm:hidden">Deslize para a esquerda ou direita para trocar de depoimento.</p>
            <div className="flex min-w-0 items-center justify-center overflow-hidden" role="group" aria-label={`Depoimento ${currentIndex + 1} de ${totalSlides}`}>
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Exibir depoimento ${index + 1} de ${totalSlides}`}
                  aria-current={index === currentIndex ? "true" : undefined}
                  onClick={() => goToTestimonial(index)}
                  className="group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/35"
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${index === currentIndex ? "w-8 bg-sky-400" : "w-2.5 bg-white/25 group-hover:bg-white/45"}`}
                  />
                </button>
              ))}
            </div>
            <TestimonialNavButton label="Próximo depoimento" direction="next" onClick={() => goToTestimonial(currentIndex + 1)} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TestimonialNavButton({ label, direction, onClick }: { label: string; direction: "previous" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.075] text-white/85 shadow-[0_12px_28px_rgba(2,6,23,0.24)] backdrop-blur-md transition-[background-color,border-color,transform,color] duration-200 hover:-translate-y-px hover:border-white/25 hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:flex"
    >
      {direction === "previous" ? <CaretLeft size={20} weight="bold" aria-hidden="true" /> : <CaretRight size={20} weight="bold" aria-hidden="true" />}
    </button>
  );
}
