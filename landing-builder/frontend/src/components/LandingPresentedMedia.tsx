"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { LandingMediaDescriptor, LandingMediaPresentation } from "@/lib/landing";

function placementForViewport(presentation: LandingMediaPresentation) {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) return presentation.mobile ?? presentation.desktop;
  return presentation.desktop;
}

function usePlacement(presentation: LandingMediaPresentation) {
  const [placement, setPlacement] = useState(presentation.desktop);
  useEffect(() => {
    const update = () => setPlacement(placementForViewport(presentation));
    update();
    const query = window.matchMedia("(max-width: 767px)");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [presentation]);
  return placement;
}

export function LandingPresentedMedia({
  url, descriptor, presentation, fallbackAlt, style,
}: {
  url: string;
  descriptor?: LandingMediaDescriptor;
  presentation: LandingMediaPresentation;
  fallbackAlt: string;
  style: CSSProperties;
}) {
  const placement = usePlacement(presentation);
  const objectPosition = `${placement.focalPoint.x}% ${placement.focalPoint.y}%`;
  const playback = placement.playback;
  const start = playback?.startSeconds ?? 0;
  const end = playback?.durationSeconds ? start + playback.durationSeconds : null;
  if (descriptor?.kind === "video") {
    return <video controls playsInline preload="metadata" poster={descriptor.poster || undefined} aria-label={descriptor.alt || fallbackAlt} style={{ ...style, objectPosition }} onLoadedMetadata={(event) => { if (start > 0) event.currentTarget.currentTime = Math.min(start, event.currentTarget.duration || start); }} onTimeUpdate={(event) => { if (end != null && event.currentTarget.currentTime >= end) event.currentTarget.currentTime = start; }}>
      <source src={url} />Seu navegador não suporta este vídeo.
    </video>;
  }
  return <img src={url} alt={descriptor?.alt || fallbackAlt} style={{ ...style, objectPosition }} />;
}

export function LandingMediaBackground({
  as: Tag = "div", url, presentation, overlay, style, children,
}: {
  as?: "div" | "section";
  url: string;
  presentation: LandingMediaPresentation;
  overlay: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  const placement = usePlacement(presentation);
  return <Tag style={{ ...style, backgroundImage: url ? `${overlay}, url(${url})` : undefined, backgroundSize: "cover", backgroundPosition: `${placement.focalPoint.x}% ${placement.focalPoint.y}%` }}>{children}</Tag>;
}
