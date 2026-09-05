"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type SyntheticEvent,
} from "react";
import type { ResponsiveMediaPresentation } from "@shared/types/media";
import { mediaObjectPosition, mediaPlacement } from "@/lib/mediaPresentation";

type PresentedVideoProps = Omit<
  ComponentPropsWithoutRef<"video">,
  "src" | "children" | "onEnded" | "onLoadedMetadata" | "onTimeUpdate"
> & {
  src: string;
  mobileSrc?: string;
  presentation?: ResponsiveMediaPresentation;
  /** Pausa e volta ao início quando um slide/carrossel deixa de estar visível. */
  active?: boolean;
  /** Largura máxima que deve usar a fonte e o enquadramento de celular. */
  mobileBreakpoint?: number;
};

const END_TOLERANCE_SECONDS = 0.04;

function safeTime(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Reproduz a mídia configurada para um quadro público. O arquivo não é
 * recortado: ao terminar o intervalo escolhido o player retorna ao início
 * dele. Sem intervalo configurado mantém o loop nativo já usado pelo site.
 */
export function PresentedVideo({
  src,
  mobileSrc,
  presentation,
  active = true,
  mobileBreakpoint = 767,
  autoPlay = true,
  muted = true,
  loop = true,
  playsInline = true,
  className,
  style,
  preload = "metadata",
  ...props
}: PresentedVideoProps) {
  const [mobile, setMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewport = mobile ? "mobile" : "desktop";
  const selectedSrc = mobile && mobileSrc ? mobileSrc : src;
  const playback = mediaPlacement(presentation, viewport)?.playback;
  const start = safeTime(playback?.startSeconds);
  const configuredDuration = safeTime(playback?.durationSeconds, 0);
  const hasPlaybackRange = start > 0 || configuredDuration > 0;
  const canAutoPlay = autoPlay && muted && active && !reducedMotion;
  const objectPosition = mediaObjectPosition(presentation, viewport);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [mobileBreakpoint]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!canAutoPlay) {
      video.pause();
      if (!active) setCurrentTime(video, 0);
      return;
    }
    const begin = () => {
      setCurrentTime(video, start);
      void video.play().catch(() => undefined);
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) begin();
    else video.addEventListener("loadedmetadata", begin, { once: true });
    return () => video.removeEventListener("loadedmetadata", begin);
  }, [active, canAutoPlay, selectedSrc, start]);

  function restartSelection(video: HTMLVideoElement) {
    setCurrentTime(video, start);
    if (canAutoPlay) void video.play().catch(() => undefined);
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (canAutoPlay) restartSelection(video);
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (!hasPlaybackRange || configuredDuration <= 0 || !Number.isFinite(video.duration)) return;
    const end = Math.min(video.duration, start + configuredDuration);
    if (video.currentTime >= end - END_TOLERANCE_SECONDS) restartSelection(video);
  }

  function handleEnded(event: SyntheticEvent<HTMLVideoElement>) {
    if (hasPlaybackRange && loop) restartSelection(event.currentTarget);
  }

  const combinedStyle: CSSProperties = { ...style, objectPosition };

  return (
    <video
      {...props}
      ref={videoRef}
      src={selectedSrc}
      autoPlay={canAutoPlay}
      muted={muted}
      loop={!hasPlaybackRange && loop}
      playsInline={playsInline}
      preload={preload}
      className={className}
      style={combinedStyle}
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    />
  );
}

function setCurrentTime(video: HTMLVideoElement, requested: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  const maximum = Math.max(0, video.duration - END_TOLERANCE_SECONDS);
  try {
    video.currentTime = Math.min(Math.max(0, requested), maximum);
  } catch {
    // Alguns navegadores ainda não permitem seek no primeiro evento de metadata.
  }
}
