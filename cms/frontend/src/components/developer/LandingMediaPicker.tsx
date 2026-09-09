"use client";

import { useState, type ChangeEvent } from "react";
import { ImageSquare, Trash, UploadSimple, VideoCamera } from "@phosphor-icons/react";
import { DeveloperHelp, developerInputClassName, developerPrimaryButtonClassName, developerSecondaryButtonClassName } from "./ui";

export type LandingMediaPickerItem = {
  id: string;
  url: string;
  kind: "image" | "video" | string;
  alt?: string;
  poster?: string;
  createdAt: string;
};

export type LandingMediaKind = "image" | "video";

function isInternalMediaPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

function mediaLabel(kind: LandingMediaKind) {
  return kind === "video" ? "vídeo" : "foto";
}

/** Biblioteca local da campanha, usada nos pontos de mídia do editor visual. */
export function LandingMediaPicker({
  label,
  helpKey,
  currentUrl,
  media,
  uploading,
  compact = false,
  allowedKinds = ["image"],
  emptyLabel,
  onSelect,
  onUpload,
  onDelete,
}: {
  label: string;
  helpKey?: string;
  currentUrl: string;
  media: LandingMediaPickerItem[];
  uploading: boolean;
  compact?: boolean;
  allowedKinds?: readonly LandingMediaKind[];
  emptyLabel: string;
  onSelect: (url: string) => void;
  onUpload: (file: File, alt?: string) => Promise<LandingMediaPickerItem | null>;
  onDelete: (item: LandingMediaPickerItem) => Promise<void>;
}) {
  const [alt, setAlt] = useState("");
  const selected = media.find((item) => item.url === currentUrl);
  const choices = media.filter((item): item is LandingMediaPickerItem & { kind: LandingMediaKind } => allowedKinds.includes(item.kind as LandingMediaKind));
  const acceptsVideo = allowedKinds.includes("video");
  const uploadLabel = acceptsVideo ? "Enviar foto ou vídeo" : "Enviar foto";
  const acceptedTypes = acceptsVideo
    ? "image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm,video/ogg"
    : "image/png,image/jpeg,image/webp,image/avif";

  async function uploadSelectedFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const uploaded = await onUpload(file, alt);
    if (!uploaded || !allowedKinds.includes(uploaded.kind as LandingMediaKind)) return;
    onSelect(uploaded.url);
    setAlt("");
  }

  return <section className={`rounded-xl border border-[var(--border)] bg-slate-50/70 ${compact ? "space-y-3 p-3" : "space-y-4 p-4"}`}>
    <div className={`flex flex-wrap items-start justify-between ${compact ? "gap-2" : "gap-3"}`}>
      <div>
        <div className="flex items-center gap-1.5"><p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>{helpKey ? <DeveloperHelp label={label} templateKey={helpKey} /> : null}</div>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--color-muted-raw)]">Envie o arquivo por aqui ou escolha uma mídia já tratada desta campanha. Depois do envio, a mídia fica selecionada nesta área.</p>
      </div>
      <button type="button" onClick={() => onSelect("")} disabled={!currentUrl} className={`${developerSecondaryButtonClassName} min-h-9 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50`}>{emptyLabel}</button>
    </div>

    <div className={`rounded-xl border border-[var(--border)] bg-white ${compact ? "p-2.5 sm:flex sm:items-end sm:gap-2.5" : "p-3"}`}>
      <label className={`block text-xs font-semibold text-[var(--foreground)] ${compact ? "min-w-0 flex-1" : ""}`}>Descrição da mídia (alt)
        <input value={alt} onChange={(event) => setAlt(event.target.value)} maxLength={160} placeholder="Descreva o que aparece nesta mídia" className={`${developerInputClassName} mt-1.5`} />
      </label>
      <label className={`${developerPrimaryButtonClassName} ${compact ? "mt-2 shrink-0 sm:mt-0" : "mt-3"} cursor-pointer ${uploading ? "cursor-wait opacity-60" : ""}`}>
        <UploadSimple size={17} weight="bold" />
        {uploading ? "Enviando e preparando..." : uploadLabel}
        <input type="file" accept={acceptedTypes} disabled={uploading} onChange={(event) => void uploadSelectedFile(event)} className="sr-only" />
      </label>
    </div>

    {currentUrl && isInternalMediaPath(currentUrl) ? <div className={`rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/[0.05] ${compact ? "p-2.5" : "p-3"}`}>
      <p className="text-xs font-semibold text-[var(--foreground)]">Selecionado nesta área</p>
      {selected?.kind === "video" ? <div className="mt-2 flex min-h-24 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-slate-950 text-xs font-semibold text-white"><VideoCamera size={18} weight="fill" />Vídeo selecionado</div> : <img src={currentUrl} alt={selected?.alt || "Mídia selecionada"} className={`mt-2 w-full rounded-lg border border-[var(--border)] bg-white object-contain ${compact ? "h-24" : "h-32"}`} />}
    </div> : null}

    <div>
      <p className="text-sm font-semibold text-[var(--foreground)]">Mídias desta campanha</p>
      {choices.length === 0 ? <p className="mt-1 text-sm text-[var(--color-muted-raw)]">Envie a primeira {acceptsVideo ? "foto ou vídeo" : "foto"} para usar neste ponto.</p> : <div className={`mt-2 grid gap-2 overflow-y-auto sm:grid-cols-2 ${compact ? "max-h-52" : "max-h-72"}`}>
        {choices.map((item) => {
          const isSelected = item.url === currentUrl;
          const kind = item.kind as LandingMediaKind;
          return <article key={item.id} className={`overflow-hidden rounded-xl border bg-white ${isSelected ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/15" : "border-[var(--border)]"}`}>
            <button type="button" onClick={() => onSelect(item.url)} className="block w-full text-left" aria-pressed={isSelected}>
              {kind === "image" ? <img src={item.url} alt={item.alt || "Foto da campanha"} className="h-28 w-full bg-slate-100 object-cover" /> : <div className="flex h-28 items-center justify-center gap-2 bg-slate-950 text-xs font-semibold text-white"><VideoCamera size={19} weight="fill" />Vídeo da campanha</div>}
              <span className="flex items-center gap-1.5 truncate px-2.5 py-2 text-xs font-semibold text-[var(--foreground)]">{kind === "image" ? <ImageSquare size={15} weight="fill" /> : <VideoCamera size={15} weight="fill" />}{item.alt || `${mediaLabel(kind)} sem descrição`}</span>
            </button>
            <div className="flex items-center justify-between border-t border-[var(--border)] px-2.5 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-raw)]">{isSelected ? "Em uso" : "Selecionar"}</span>
              <button type="button" onClick={() => { if (window.confirm(`Excluir esta ${mediaLabel(kind)} da campanha?`)) void onDelete(item); }} className="inline-flex size-7 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50" aria-label={`Excluir ${item.alt || mediaLabel(kind)}`} title="Excluir arquivo"><Trash size={15} weight="bold" /></button>
            </div>
          </article>;
        })}
      </div>}
    </div>
  </section>;
}
