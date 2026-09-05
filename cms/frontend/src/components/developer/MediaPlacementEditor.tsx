"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  ArrowsOutCardinal,
  Desktop,
  DeviceMobile,
  Play,
  Repeat,
  X,
} from "@phosphor-icons/react";
import type {
  MediaPlacement,
  ResponsiveMediaPresentation,
  VideoPlaybackRange,
} from "@shared/types/media";
import { resolveCmsMediaUrl } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  DeveloperField,
  DeveloperHelp,
  DeveloperMessage,
  developerGhostButtonClassName,
  developerSecondaryButtonClassName,
} from "./ui";

const CENTER: MediaPlacement = { focalPoint: { x: 50, y: 50 } };
const POSITION_PRESETS = [
  [0, 0, "Superior esquerdo"], [50, 0, "Superior"], [100, 0, "Superior direito"],
  [0, 50, "Esquerda"], [50, 50, "Centralizar"], [100, 50, "Direita"],
  [0, 100, "Inferior esquerdo"], [50, 100, "Inferior"], [100, 100, "Inferior direito"],
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizedPlacement(value: MediaPlacement | undefined, video: boolean): MediaPlacement {
  const focal = value?.focalPoint;
  const base: MediaPlacement = {
    focalPoint: {
      x: clamp(Number.isFinite(focal?.x) ? focal?.x ?? 50 : 50, 0, 100),
      y: clamp(Number.isFinite(focal?.y) ? focal?.y ?? 50 : 50, 0, 100),
    },
  };
  if (video && value?.playback) {
    base.playback = {
      startSeconds: Math.max(0, value.playback.startSeconds || 0),
      ...(value.playback.durationSeconds && value.playback.durationSeconds > 0
        ? { durationSeconds: value.playback.durationSeconds }
        : {}),
    };
  }
  return base;
}

function normalizedPresentation(
  value: ResponsiveMediaPresentation | undefined,
  video: boolean
): ResponsiveMediaPresentation {
  const desktop = normalizedPlacement(value?.desktop, video);
  return value?.mobile
    ? { desktop, mobile: normalizedPlacement(value.mobile, video) }
    : { desktop };
}

function formatSeconds(value: number) {
  const rounded = Math.max(0, Math.round(value));
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}

export function MediaPlacementEditor({
  label,
  src,
  alt,
  mediaType,
  value,
  onChange,
  frameAspectRatio,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  label: string;
  src: string;
  alt?: string;
  mediaType: "image" | "video";
  value?: ResponsiveMediaPresentation;
  onChange: (value: ResponsiveMediaPresentation) => void;
  /** Relação real do quadro quando aquela tela do CMS a conhece. */
  frameAspectRatio?: string;
  /** Permite acionar o modal diretamente a partir da prévia da mídia. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [localOpen, setLocalOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const stageRef = useRef<HTMLButtonElement>(null);
  const video = mediaType === "video";
  const presentation = normalizedPresentation(value, video);
  const active = viewport === "mobile" && presentation.mobile
    ? presentation.mobile
    : presentation.desktop;
  const usesOwnMobile = Boolean(presentation.mobile);
  const previewSrc = src.trim() ? resolveCmsMediaUrl(src) : "";
  const dialogOpen = open ?? localOpen;

  useEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>("[data-admin-shell='true']"));
  }, []);

  function updateActive(next: MediaPlacement) {
    if (viewport === "mobile" && presentation.mobile) {
      onChange({ ...presentation, mobile: next });
      return;
    }
    onChange({ ...presentation, desktop: next });
  }

  function setFocalPoint(x: number, y: number) {
    updateActive({ ...active, focalPoint: { x: clamp(x, 0, 100), y: clamp(y, 0, 100) } });
  }

  function handleStagePointer(event: PointerEvent<HTMLButtonElement>) {
    if (!stageRef.current || !src.trim()) return;
    const rect = stageRef.current.getBoundingClientRect();
    setFocalPoint(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100
    );
  }

  function setDialogOpen(nextOpen: boolean) {
    if (open === undefined) setLocalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function openDialog() {
    setViewport("desktop");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  useEffect(() => {
    if (!dialogOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeDialog();
    }
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [dialogOpen]);

  return (
    <>
      {!hideTrigger ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/76 px-3 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
            Enquadramento
            <DeveloperHelp label="Enquadramento no quadro" templateKey="media-placement" />
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--color-muted-raw)]">Defina a parte visível desta {video ? "vídeo" : "foto"} sem ocupar espaço no editor.</p>
        </div>
        <button type="button" disabled={!previewSrc} onClick={openDialog} className={cn(developerSecondaryButtonClassName, "shrink-0 rounded-xl px-3 py-2 text-xs")}>
          <ArrowsOutCardinal size={16} weight="bold" /> Enquadrar {video ? "vídeo" : "foto"}
        </button>
      </div> : null}

      {dialogOpen && portalTarget ? createPortal(
        <div data-media-placement-dialog="true" className="cms-content-dialog fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={`Enquadrar ${video ? "vídeo" : "foto"}`} onMouseDown={closeDialog}>
          <div className="media-placement-dialog__surface flex h-[calc(100dvh-1.5rem)] max-h-[48rem] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_24px_80px_rgba(2,6,23,0.4)] sm:p-5" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-base font-bold text-[var(--foreground)]">
                  Enquadrar {video ? "vídeo" : "foto"}
                  <DeveloperHelp label="Enquadramento no quadro" templateKey="media-placement" />
                </p>
                <p className="mt-1 max-w-[70ch] text-xs leading-5 text-[var(--color-muted-raw)]">
                  Clique ou arraste o alvo até a parte que precisa continuar visível em {label}.
                  {frameAspectRatio ? ` O quadro desta área usa a proporção aproximada ${frameAspectRatio}.` : " O quadro é responsivo; não existe um tamanho fixo em pixels."}
                </p>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-start">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                  <button type="button" onClick={() => setViewport("desktop")} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold", viewport === "desktop" ? "bg-[var(--primary)] text-white" : "text-slate-600")}>
                    <Desktop size={15} weight="bold" /> Desktop
                  </button>
                  <button type="button" onClick={() => setViewport("mobile")} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold", viewport === "mobile" ? "bg-[var(--primary)] text-white" : "text-slate-600")}>
                    <DeviceMobile size={15} weight="bold" /> Celular
                  </button>
                </div>
                <button type="button" onClick={closeDialog} aria-label="Fechar enquadramento" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-muted-raw)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--foreground)]"><X size={20} weight="bold" /></button>
              </div>
            </div>

            <div className="mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-stretch">
              <button ref={stageRef} type="button" onPointerDown={handleStagePointer} onPointerMove={(event) => { if (event.buttons === 1) handleStagePointer(event); }} className="relative min-h-[230px] w-full touch-none overflow-hidden rounded-[16px] border border-slate-300 bg-slate-950 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/20 max-lg:aspect-video lg:h-full" aria-label="Definir ponto principal da mídia">
                {video ? <video src={previewSrc} muted preload="metadata" className="h-full w-full object-cover" style={{ objectPosition: `${active.focalPoint.x}% ${active.focalPoint.y}%` }} /> : <img src={previewSrc} alt={alt ?? "Prévia para enquadramento"} className="h-full w-full object-cover" style={{ objectPosition: `${active.focalPoint.x}% ${active.focalPoint.y}%` }} />}
                <span className="pointer-events-none absolute inset-0 bg-slate-950/8" />
                <span className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--primary)]/75 shadow-[0_0_0_4px_rgba(15,23,42,0.26)]" style={{ left: `${active.focalPoint.x}%`, top: `${active.focalPoint.y}%` }} />
              </button>

              <div className="space-y-2.5 self-start">
                <div className="grid grid-cols-3 gap-1.5" aria-label="Atalhos de posição">
                  {POSITION_PRESETS.map(([x, y, name]) => (
                    <button key={name} type="button" title={name} onClick={() => setFocalPoint(x, y)} className={cn(developerGhostButtonClassName, "h-9 min-h-0 rounded-lg p-0", active.focalPoint.x === x && active.focalPoint.y === y && "border border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]")}>
                      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                      <span className="sr-only">{name}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setFocalPoint(50, 50)} className={cn(developerSecondaryButtonClassName, "min-h-9 w-full rounded-xl px-3 py-1.5 text-xs")}>
                  <ArrowsOutCardinal size={15} weight="bold" /> Centralizar
                </button>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs leading-5 text-slate-600">
                  <input type="checkbox" checked={usesOwnMobile} onChange={(event) => onChange(event.target.checked ? { ...presentation, mobile: normalizedPlacement(presentation.desktop, video) } : { desktop: presentation.desktop })} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
                  <span><strong className="text-slate-800">Ajustar celular separadamente</strong><br />Sem marcar, o celular herda o enquadramento do desktop.</span>
                </label>
              </div>
            </div>

            {video ? <VideoPlaybackRangeEditor src={src} value={active.playback} onChange={(playback) => updateActive({ ...active, playback })} /> : null}
          </div>
        </div>,
        portalTarget
      ) : null}
    </>
  );
}

export function VideoPlaybackRangeEditor({
  src,
  value,
  onChange,
}: {
  src: string;
  value?: VideoPlaybackRange;
  onChange: (value: VideoPlaybackRange) => void;
}) {
  const [duration, setDuration] = useState<number | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const start = Math.max(0, value?.startSeconds ?? 0);
  const selectedDuration = value?.durationSeconds;
  const end = duration == null ? null : Math.min(duration, start + (selectedDuration ?? duration - start));

  function updateStart(next: number) {
    const maximum = duration == null ? next : Math.max(0, duration - (selectedDuration ?? 0));
    onChange({ startSeconds: clamp(next, 0, maximum), ...(selectedDuration ? { durationSeconds: selectedDuration } : {}) });
  }

  function chooseDuration(next: number | undefined) {
    if (!next || duration == null) {
      onChange({ startSeconds: start });
      return;
    }
    const available = Math.max(0.1, duration - start);
    onChange({ startSeconds: start, durationSeconds: Math.min(next, available) });
  }

  function playSelection() {
    const video = previewRef.current;
    if (!video) return;
    video.currentTime = start;
    void video.play().catch(() => undefined);
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <DeveloperField label="Trecho do vídeo" hint="O visitante verá somente este intervalo quando a área pública passar a usar reprodução por trecho." helpKey="video-range">
        {src.trim() ? <video ref={previewRef} src={resolveCmsMediaUrl(src)} muted controls preload="metadata" className="mb-3 max-h-56 w-full rounded-xl bg-slate-950 object-contain" onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : null)} onTimeUpdate={(event) => { if (end != null && event.currentTarget.currentTime >= end) { event.currentTarget.currentTime = start; void event.currentTarget.play().catch(() => undefined); } }} /> : null}
        {duration == null ? <DeveloperMessage tone="info">Escolha um vídeo para carregar a duração e definir o trecho.</DeveloperMessage> : <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"><span>Duração do arquivo: <strong className="text-slate-900">{formatSeconds(duration)}</strong></span><span>Início: <strong className="text-slate-900">{formatSeconds(start)}</strong></span></div>
          <input type="range" min="0" max={Math.max(0, duration - (selectedDuration ?? 0))} step="0.1" value={Math.min(start, Math.max(0, duration - (selectedDuration ?? 0)))} onChange={(event) => updateStart(Number(event.target.value))} className="w-full accent-[var(--primary)]" aria-label="Segundo inicial do trecho" />
          <div className="flex flex-wrap gap-2">{[5, 10, 15, 20, 30].map((seconds) => <button key={seconds} type="button" onClick={() => chooseDuration(seconds)} className={cn(developerGhostButtonClassName, "min-h-9 rounded-lg px-3 text-xs", selectedDuration === Math.min(seconds, Math.max(0.1, duration - start)) && "border border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]")}>{seconds}s</button>)}<button type="button" onClick={() => chooseDuration(undefined)} className={cn(developerGhostButtonClassName, "min-h-9 rounded-lg px-3 text-xs", !selectedDuration && "border border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]")}><Repeat size={14} weight="bold" /> Até o fim</button><button type="button" onClick={playSelection} className={cn(developerSecondaryButtonClassName, "min-h-9 rounded-lg px-3 text-xs")}><Play size={14} weight="fill" /> Ver trecho</button></div>
          <p className="text-xs leading-5 text-slate-600">{selectedDuration ? `Vai de ${formatSeconds(start)} até ${formatSeconds(Math.min(duration, start + selectedDuration))}.` : `Vai de ${formatSeconds(start)} até o fim do arquivo.`}</p>
        </div>}
      </DeveloperField>
    </div>
  );
}
