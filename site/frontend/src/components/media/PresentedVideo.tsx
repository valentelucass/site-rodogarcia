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
  /** Pausa e volta ao início do trecho quando o card deixa de ser o ativo. */
  active?: boolean;
  /** Largura máxima que usa a fonte e o enquadramento de celular. */
  mobileBreakpoint?: number;
  /** Não anexa fontes ao elemento antes de ele entrar na viewport. */
  deferUntilNearViewport?: boolean;
  /** Autoplay visual: sempre silencioso, fora da árvore acessível e sem controles. */
  decorative?: boolean;
};

type PresentedMediaStyle = CSSProperties & {
  "--presented-media-position-desktop"?: string;
  "--presented-media-position-mobile"?: string;
};

interface NetworkInformation extends EventTarget {
  saveData?: boolean;
}

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
};

const END_TOLERANCE_SECONDS = 0.04;

function safeTime(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Reproduz a mídia configurada para um quadro público. A seleção da fonte é
 * nativa (`source media`), evitando baixar primeiro o arquivo desktop. Loops
 * visuais adiados mantêm apenas o poster até ficarem próximos e permanecem
 * parados em redução de movimento ou economia de dados. Sem poster, carregam
 * somente metadados perto da viewport para não deixar um quadro vazio.
 */
export function PresentedVideo({
  src,
  mobileSrc,
  presentation,
  active = true,
  mobileBreakpoint = 767,
  deferUntilNearViewport = false,
  decorative = true,
  autoPlay = true,
  muted = true,
  loop = true,
  playsInline = true,
  className,
  style,
  poster,
  preload = "none",
  controls,
  tabIndex,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  ...props
}: PresentedVideoProps) {
  const [mobile, setMobile] = useState(false);
  const [inViewport, setInViewport] = useState(false);
  const [wasInViewport, setWasInViewport] = useState(!deferUntilNearViewport);
  const [playbackPolicy, setPlaybackPolicy] = useState({
    ready: false,
    reducedMotion: true,
    saveData: true,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewport = mobile ? "mobile" : "desktop";
  const playback = mediaPlacement(presentation, viewport)?.playback;
  const start = safeTime(playback?.startSeconds);
  const configuredDuration = safeTime(playback?.durationSeconds, 0);
  const hasPlaybackRange = start > 0 || configuredDuration > 0;
  const effectiveMuted = decorative ? true : muted;
  const desktopSrc = internalMediaUrl(src);
  const responsiveMobileSrc = internalMediaUrl(mobileSrc);
  const effectivePoster = internalMediaUrl(poster);
  const shouldAttachDeferredSource = playbackPolicy.ready
    && (
      !autoPlay
      || !effectiveMuted
      || (!playbackPolicy.reducedMotion && !playbackPolicy.saveData)
      || !effectivePoster
    );
  const sourcesAttached = !deferUntilNearViewport
    || (wasInViewport && shouldAttachDeferredSource);
  const canAutoPlay = sourcesAttached
    && playbackPolicy.ready
    && autoPlay
    && effectiveMuted
    && active
    && inViewport
    && !playbackPolicy.reducedMotion
    && !playbackPolicy.saveData;
  const effectivePreload = sourcesAttached
    ? (effectivePoster ? preload : "metadata")
    : "none";
  const { objectPosition: _objectPosition, ...callerStyle } = style ?? {};
  const combinedStyle: PresentedMediaStyle = {
    ...callerStyle,
    "--presented-media-position-desktop": mediaObjectPosition(presentation, "desktop"),
    "--presented-media-position-mobile": mediaObjectPosition(presentation, "mobile"),
  };
  const breakpointClass = mobileBreakpoint > 767
    ? "presented-media-position--mobile-lg"
    : "presented-media-position--mobile-sm";

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [mobileBreakpoint]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as NavigatorWithConnection).connection;
    const sync = () => setPlaybackPolicy({
      ready: true,
      reducedMotion: query.matches,
      saveData: connection?.saveData === true,
    });
    sync();
    query.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!("IntersectionObserver" in window)) {
      setInViewport(true);
      setWasInViewport(true);
      return;
    }
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting === true;
        setInViewport(visible);
      },
      { threshold: 0.01 }
    );
    const proximityObserver = deferUntilNearViewport
      ? new IntersectionObserver(
          ([entry]) => {
            if (!entry?.isIntersecting) return;
            setWasInViewport(true);
            proximityObserver?.disconnect();
          },
          { rootMargin: "500px 0px", threshold: 0 }
        )
      : null;

    visibilityObserver.observe(video);
    proximityObserver?.observe(video);
    return () => {
      visibilityObserver.disconnect();
      proximityObserver?.disconnect();
    };
  }, [deferUntilNearViewport]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourcesAttached) return;
    video.load();
  }, [desktopSrc, mobile, responsiveMobileSrc, sourcesAttached]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!canAutoPlay) {
      video.pause();
      if (!active) setCurrentTime(video, start);
      return;
    }
    const begin = () => {
      if (video.currentTime < start || video.currentTime >= selectedEnd(video, start, configuredDuration)) {
        setCurrentTime(video, start);
      }
      void video.play().catch(() => undefined);
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) begin();
    else video.addEventListener("loadedmetadata", begin, { once: true });
    return () => video.removeEventListener("loadedmetadata", begin);
  }, [active, canAutoPlay, configuredDuration, start]);

  function restartSelection(video: HTMLVideoElement) {
    setCurrentTime(video, start);
    if (canAutoPlay) void video.play().catch(() => undefined);
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (hasPlaybackRange) setCurrentTime(video, start);
    if (canAutoPlay) void video.play().catch(() => undefined);
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (!hasPlaybackRange || configuredDuration <= 0 || !Number.isFinite(video.duration)) return;
    if (video.currentTime >= selectedEnd(video, start, configuredDuration) - END_TOLERANCE_SECONDS) {
      restartSelection(video);
    }
  }

  function handleEnded(event: SyntheticEvent<HTMLVideoElement>) {
    if (hasPlaybackRange && loop) restartSelection(event.currentTarget);
  }

  return (
    <video
      {...props}
      ref={videoRef}
      autoPlay={canAutoPlay}
      muted={effectiveMuted}
      loop={!hasPlaybackRange && loop}
      playsInline={playsInline}
      poster={effectivePoster || undefined}
      preload={effectivePreload}
      controls={decorative ? false : controls}
      tabIndex={decorative ? -1 : tabIndex}
      aria-hidden={decorative ? true : ariaHidden}
      aria-label={decorative ? undefined : ariaLabel}
      className={["presented-media-position", breakpointClass, className]
        .filter(Boolean)
        .join(" ")}
      style={combinedStyle}
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    >
      {sourcesAttached && responsiveMobileSrc && responsiveMobileSrc !== desktopSrc ? (
        <source
          src={responsiveMobileSrc}
          type={mediaType(responsiveMobileSrc)}
          media={`(max-width: ${mobileBreakpoint}px)`}
        />
      ) : null}
      {sourcesAttached && desktopSrc ? (
        <source src={desktopSrc} type={mediaType(desktopSrc)} />
      ) : null}
    </video>
  );
}

function selectedEnd(video: HTMLVideoElement, start: number, configuredDuration: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return Number.POSITIVE_INFINITY;
  return configuredDuration > 0
    ? Math.min(video.duration, start + configuredDuration)
    : video.duration;
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

function internalMediaUrl(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

function mediaType(src: string): string | undefined {
  const path = src.split("?", 1)[0]?.toLowerCase() ?? "";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".ogg")) return "video/ogg";
  return undefined;
}
