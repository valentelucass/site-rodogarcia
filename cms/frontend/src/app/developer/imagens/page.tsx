"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResponsiveImageSources } from "@shared/types/media";
import {
  CaretLeft,
  CaretRight,
  ImagesSquare,
  MagicWand,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { useApiRequest } from "@/hooks/useApiRequest";
import {
  adminResourceKeys,
  invalidateAdminResource,
  useAdminResource,
} from "@/hooks/useAdminResource";
import { useCarouselPagination } from "@/hooks/useCarouselPagination";
import { api, resolveCmsMediaUrl } from "@/lib/routes";
import {
  DeveloperCard,
  DeveloperField,
  DeveloperHero,
  DeveloperCarouselPagination,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  developerSplitLayoutClassName,
  developerInputClassName,
  developerDangerButtonClassName,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
} from "@/components/developer/ui";

interface AdminImageRecord extends ResponsiveImageSources {
  name: string;
  url: string;
  source: "upload" | "content" | "library";
  usedInContent: boolean;
  size: number;
  references: number;
  mediaType?: "image" | "video";
  format?: string;
  uploadedAt?: string;
  originalSize?: number;
  optimizedSize?: number;
  aspectRatio?: number;
  durationSeconds?: number;
}

const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 64 * 1024 * 1024;
const ACCEPTED_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/ogg",
] as const;
const MEDIA_SLOT_LABELS: Record<string, string> = {
  "home.cert.iso": "Home - Certificado ISO",
  "home.cert.sassmaq": "Home - Certificado SASSMAQ",
  "home.cert.ecovadis": "Home - Certificado EcoVadis",
  "home.cert.pf": "Home - Licenca PF",
  "home.cert.pcsp": "Home - Policia Civil SP",
  "home.cert.exercito": "Home - Exercito Brasileiro",
  "home.cert.ibama": "Home - IBAMA",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDimensions(media: AdminImageRecord) {
  if (!media.width || !media.height) return "Resolução não disponível";
  return `${media.width} × ${media.height} px`;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function formatAspectRatio(media: AdminImageRecord) {
  if (!media.width || !media.height) return "Proporção não disponível";
  const divisor = greatestCommonDivisor(media.width, media.height);
  return `${media.width / divisor}:${media.height / divisor}`;
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "Duração não disponível";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function mediaTypeFromUrl(value: string): "image" | "video" {
  return /\.(mp4|webm|ogg)$/i.test(value) ? "video" : "image";
}

function mediaTypeForSlot(slotKey: string): "image" | "video" {
  return slotKey.endsWith(".video") ? "video" : "image";
}

export default function ImagensPage() {
  const { apiRequest } = useApiRequest();
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fromUrl, setFromUrl] = useState("");
  const [toUrl, setToUrl] = useState("");
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [savingSlots, setSavingSlots] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState("");
  const [status, setStatus] = useState<"" | "success" | "error" | "info">("");
  const [message, setMessage] = useState("");
  const { data, loading, error, refresh } = useAdminResource<{
    images: AdminImageRecord[];
    slots: Record<string, string>;
  }>({
    key: adminResourceKeys.mediaManager,
    fetcher: async (request) => {
      const [imagesResponse, slotsResponse] = await Promise.all([
        request<{ images?: AdminImageRecord[] }>(api.admin.images),
        request<{ slots?: Record<string, string> }>(api.admin.mediaSlots),
      ]);

      if (!imagesResponse.success || !slotsResponse.success) {
        return {
          success: false,
          error:
            imagesResponse.error ??
            slotsResponse.error ??
            "Falha ao carregar imagens.",
        };
      }

      return {
        success: true,
        data: {
          images: imagesResponse.data?.images ?? [],
          slots: slotsResponse.data?.slots ?? {},
        },
      };
    },
  });
  const images = data?.images ?? [];
  const { pages, currentPage, totalPages, nextPage, prevPage } = useCarouselPagination(images, 12);
  const slotEntries = useMemo(() => Object.entries(MEDIA_SLOT_LABELS), []);
  const {
    pages: slotPages,
    currentPage: slotPage,
    totalPages: slotTotalPages,
    nextPage: nextSlotPage,
    prevPage: prevSlotPage,
  } = useCarouselPagination(slotEntries, 8);

  const summary = useMemo(
    () => ({
      total: images.length,
      uploads: images.filter((item) => item.source === "upload").length,
      videos: images.filter((item) => (item.mediaType ?? mediaTypeFromUrl(item.url)) === "video").length,
      used: images.filter((item) => item.usedInContent).length,
    }),
    [images]
  );

  useEffect(() => {
    if (data?.slots) {
      setSlots(
        Object.fromEntries(
          Object.keys(MEDIA_SLOT_LABELS).map((key) => [key, data.slots[key] ?? ""])
        )
      );
    }
  }, [data?.slots]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPreviewUrl("");
      setPreviewOpen(false);
      setUploadFile(null);
      setFileName("");
      return;
    }

    if (!ACCEPTED_MEDIA_TYPES.includes(file.type as (typeof ACCEPTED_MEDIA_TYPES)[number])) {
      setPreviewUrl("");
      setPreviewOpen(false);
      setUploadFile(null);
      setFileName("");
      setStatus("error");
      setMessage("Formato não suportado. Use PNG, JPG, WebP, AVIF, MP4, WebM ou Ogg.");
      event.target.value = "";
      return;
    }

    const maxBytes = file.type.startsWith("video/")
      ? MAX_VIDEO_UPLOAD_BYTES
      : MAX_IMAGE_UPLOAD_BYTES;
    if (file.size > maxBytes) {
      setPreviewUrl("");
      setPreviewOpen(false);
      setUploadFile(null);
      setFileName("");
      setStatus("error");
      setMessage(
        file.type.startsWith("video/")
          ? "Video acima de 64 MB. Reduza o arquivo antes de enviar."
          : "Imagem acima de 8 MB. Reduza o arquivo antes de enviar."
      );
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setPreviewUrl(result);
      setUploadFile(file);
      setFileName(file.name);
      setStatus("info");
      setMessage(`Arquivo pronto para upload: ${file.name}`);
    };
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!uploadFile || !fileName) {
      setStatus("error");
      setMessage("Selecione uma mídia antes de enviar.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("media", uploadFile);
    const response = await apiRequest(api.admin.images, {
      method: "POST",
      body: formData,
    });
    setUploading(false);

    if (!response.success) {
      setStatus("error");
      setMessage(response.error ?? "Falha ao enviar a imagem.");
      return;
    }

    setPreviewUrl("");
    setPreviewOpen(false);
    setUploadFile(null);
    setFileName("");
    setStatus("success");
    setMessage("Imagem enviada e otimizada com sucesso.");
    invalidateAdminResource([adminResourceKeys.images, adminResourceKeys.mediaManager, adminResourceKeys.dashboard]);
    await refresh();
  }

  async function handleReplace() {
    if (!fromUrl || !toUrl) {
      setStatus("error");
      setMessage("Preencha a URL atual e a nova URL.");
      return;
    }

    setReplacing(true);
    const response = await apiRequest(api.admin.replaceImageReference, {
      method: "POST",
      body: JSON.stringify({ fromUrl, toUrl }),
    });
    setReplacing(false);

    if (!response.success) {
      setStatus("error");
      setMessage(response.error ?? "Falha ao substituir referências.");
      return;
    }

    setStatus("success");
    setMessage("Referências atualizadas com sucesso.");
    invalidateAdminResource([adminResourceKeys.images, adminResourceKeys.mediaManager, adminResourceKeys.dashboard]);
    await refresh();
  }

  async function handleDelete(image: AdminImageRecord) {
    const confirmation = image.references > 0
      ? `Esta mídia está em uso em ${image.references} área(s) do site. Ao excluir, essas áreas usarão o fallback disponível. Deseja continuar?`
      : `Excluir permanentemente o arquivo ${image.name}?`;
    if (!window.confirm(confirmation)) return;

    setDeletingUrl(image.url);
    const response = await apiRequest(api.admin.images, {
      method: "DELETE",
      body: JSON.stringify({ url: image.url, confirmInUse: true }),
    });
    setDeletingUrl("");

    if (!response.success) {
      setStatus("error");
      setMessage(response.error ?? "Não foi possível excluir a mídia.");
      return;
    }

    setStatus("success");
    setMessage(image.references > 0 ? "Mídia excluída e referências removidas." : "Mídia excluída com sucesso.");
    invalidateAdminResource([adminResourceKeys.images, adminResourceKeys.mediaManager, adminResourceKeys.dashboard]);
    await refresh();
  }

  async function handleSaveSlots() {
    setSavingSlots(true);
    const response = await apiRequest(api.admin.mediaSlots, {
      method: "POST",
      body: JSON.stringify(slots),
    });
    setSavingSlots(false);

    if (!response.success) {
      setStatus("error");
      setMessage(response.error ?? "Falha ao salvar slots de mídia.");
      return;
    }

    setStatus("success");
    setMessage("Slots de mídia salvos com sucesso.");
    invalidateAdminResource([adminResourceKeys.images, adminResourceKeys.mediaManager, adminResourceKeys.mediaSlots, adminResourceKeys.dashboard]);
    await refresh();
  }

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="Mídia - Biblioteca"
        title="Biblioteca, otimização e slots de imagens."
        description="Envie mídias e controle os slots do site."
        stats={[
          { label: "Total", value: summary.total },
          { label: "Uploads", value: summary.uploads },
          { label: "Videos", value: summary.videos },
          { label: "Em uso", value: summary.used },
        ]}
      />

      {loading ? (
        <div className="mt-6">
          <DeveloperMessage tone="info">Carregando biblioteca de imagens...</DeveloperMessage>
        </div>
      ) : null}

      {status ? (
        <div className="mt-6">
          <DeveloperMessage
            tone={status === "success" ? "success" : status === "error" ? "error" : "info"}
          >
            {message}
          </DeveloperMessage>
        </div>
      ) : null}

      {error ? (
        <div className="mt-6">
          <DeveloperMessage tone="error">{error}</DeveloperMessage>
        </div>
      ) : null}

      <section className={developerSplitLayoutClassName}>
        <DeveloperCard>
          <DeveloperSectionHeading
            eyebrow="Upload"
            title="Enviar mídia"
            description="O backend valida imagens e vídeos; imagens recebem WebP e tamanhos responsivos."
            tooltip="A mídia é validada pela assinatura real. Imagens são otimizadas; vídeos compatíveis são preservados."
          />

          <div className="space-y-5">
            <DeveloperField label="Selecionar arquivo">
              <input
                type="file"
                accept={ACCEPTED_MEDIA_TYPES.join(",")}
                onChange={handleFileChange}
                className={developerInputClassName}
              />
            </DeveloperField>

            <div>
              {previewUrl ? (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="group block w-full max-w-[280px] overflow-hidden rounded-[18px] border border-[var(--border)] bg-white text-left focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <div className="relative h-32 overflow-hidden bg-slate-950">
                    {uploadFile?.type.startsWith("video/") ? (
                      <video
                        src={previewUrl}
                        muted
                        preload="metadata"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <img
                        src={previewUrl}
                        alt="Preview da imagem selecionada"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/78 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Ampliar
                    </span>
                  </div>
                  <div className="border-t border-[var(--border)] px-3 py-2">
                    <p className="text-xs font-semibold text-[var(--foreground)]">
                      Preview compacto
                    </p>
                    <p className="mt-1 truncate text-[11px] text-[var(--color-muted-raw)]">
                      {fileName}
                    </p>
                  </div>
                </button>
              ) : (
                <div className="flex h-32 max-w-[280px] items-center justify-center rounded-[18px] border border-dashed border-[var(--border)] bg-white/72 px-4 text-center text-sm text-[var(--color-muted-raw)]">
                  Selecione uma imagem ou video para visualizar o preview.
                </div>
              )}
            </div>

            {previewUrl && previewOpen ? (
              <div className="cms-content-dialog fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/76 p-4">
                <button
                  type="button"
                  aria-label="Fechar preview"
                  className="absolute inset-0 cursor-default"
                  onClick={() => setPreviewOpen(false)}
                />
                <div className="relative z-10 max-w-[92vw] rounded-[22px] border border-white/16 bg-white p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Preview do upload
                    </p>
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(false)}
                      className={`${developerSecondaryButtonClassName} min-h-9 rounded-xl px-3 py-2 text-xs`}
                    >
                      Fechar
                    </button>
                  </div>
                  {uploadFile?.type.startsWith("video/") ? (
                    <video
                      src={previewUrl}
                      controls
                      autoPlay
                      muted
                      className="max-h-[78vh] max-w-[86vw] rounded-[16px] bg-slate-950 object-contain"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Preview da imagem selecionada"
                      className="max-h-[78vh] max-w-[86vw] rounded-[16px] object-contain"
                    />
                  )}
                </div>
              </div>
            ) : null}

            <button type="button" onClick={handleUpload} disabled={uploading} className={`${developerPrimaryButtonClassName} mt-1`}>
              <UploadSimple size={18} weight="bold" />
              {uploading ? "Enviando..." : "Enviar mídia"}
            </button>
          </div>

          <div className="mt-8 border-t border-[var(--border)] pt-8">
            <DeveloperSectionHeading
              eyebrow="Substituição"
              title="Trocar referências no conteúdo"
              description="Atualiza caminhos em conteúdo, textos, slots, SEO e popup."
              tooltip="Substitui uma URL antiga por outra em todos os storages de conteúdo que usam mídia."
            />

            <div className="space-y-4">
              <DeveloperField label="URL atual">
                <select
                  value={fromUrl}
                  onChange={(event) => setFromUrl(event.target.value)}
                  className={developerInputClassName}
                >
                  <option value="">Selecione uma mídia da biblioteca</option>
                  {images.map((image) => (
                    <option key={image.url} value={image.url}>
                      {image.name} - {image.url}
                    </option>
                  ))}
                </select>
              </DeveloperField>

              <DeveloperField label="Nova URL">
                <select
                  value={toUrl}
                  onChange={(event) => setToUrl(event.target.value)}
                  className={developerInputClassName}
                >
                  <option value="">Selecione uma mídia da biblioteca</option>
                  {images.map((image) => (
                    <option key={image.url} value={image.url}>
                      {image.name} - {image.url}
                    </option>
                  ))}
                </select>
              </DeveloperField>

              <button
                type="button"
                onClick={handleReplace}
                disabled={replacing}
                title="Substitui referências de imagem nos conteúdos do CMS."
                className={developerSecondaryButtonClassName}
              >
                <MagicWand size={16} weight="bold" />
                {replacing ? "Substituindo..." : "Substituir referências"}
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-6">
            <DeveloperSectionHeading
              eyebrow="Slots"
              title="Imagens controladas pelo CMS"
              description="O site usa fallback quando um slot fica vazio."
              tooltip="Slots conectam uma imagem da biblioteca a uma área do site. Exemplo: Popup - Mobile usa a imagem no popup de celular."
            />

            <div className="rounded-[22px] border border-[var(--border)] bg-slate-50/70 p-4 sm:p-5">
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
                  style={{ transform: `translateX(-${slotPage * 100}%)` }}
                >
                  {slotPages.map((page, pageIndex) => (
                    <div key={pageIndex} className="w-full shrink-0 space-y-3">
                      {page.map(([slotKey, label]) => (
                        <div
                          key={slotKey}
                          className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white/82 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] lg:grid-cols-[minmax(190px,0.9fr)_minmax(0,1.1fr)] lg:items-center"
                        >
                          <span className="truncate px-1 text-xs font-semibold text-[var(--foreground)]" title={label}>
                            {label}
                          </span>
                          <select
                            value={slots[slotKey] ?? ""}
                            onChange={(event) =>
                              setSlots((current) => ({ ...current, [slotKey]: event.target.value }))
                            }
                            className={`${developerInputClassName} min-h-11 px-3 py-2 text-xs`}
                          >
                            <option value="">Usar fallback do site</option>
                            {images
                              .filter((image) => {
                                const itemType = image.mediaType ?? mediaTypeFromUrl(image.url);
                                return itemType === mediaTypeForSlot(slotKey);
                              })
                              .map((image) => (
                                <option key={image.url} value={image.url}>
                                  {image.name} - {image.url}
                                </option>
                              ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)]/80 pt-4 lg:flex-row lg:items-center lg:justify-between">
                {slotTotalPages > 1 ? (
                  <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white/78 p-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)] lg:min-w-[312px]">
                    <button
                      type="button"
                      onClick={prevSlotPage}
                      disabled={slotPage === 0}
                      className={`${developerSecondaryButtonClassName} min-h-9 rounded-xl px-3 py-2 text-xs`}
                    >
                      <CaretLeft size={15} weight="bold" />
                      Voltar
                    </button>
                    <div className="flex items-center gap-1.5" aria-label={`Página ${slotPage + 1} de ${slotTotalPages}`}>
                      {Array.from({ length: slotTotalPages }).map((_, index) => (
                        <span
                          key={index}
                          className={`h-1.5 rounded-full transition-all duration-300 ${slotPage === index ? "w-5 bg-[var(--primary)]" : "w-1.5 bg-[var(--border)]"}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={nextSlotPage}
                      disabled={slotPage === slotTotalPages - 1}
                      className={`${developerSecondaryButtonClassName} min-h-9 rounded-xl px-3 py-2 text-xs`}
                    >
                      Próximo
                      <CaretRight size={15} weight="bold" />
                    </button>
                  </div>
                ) : <span />}

                <button
                  type="button"
                  onClick={handleSaveSlots}
                  disabled={savingSlots}
                  className={`${developerPrimaryButtonClassName} min-h-11 justify-center px-5 lg:self-auto`}
                >
                  <MagicWand size={16} weight="bold" />
                  {savingSlots ? "Salvando..." : "Salvar configuração"}
                </button>
              </div>
            </div>
          </div>
        </DeveloperCard>

        <DeveloperCard className="flex flex-col">
          <DeveloperSectionHeading
            eyebrow="Biblioteca"
            title="Mídias encontradas no projeto"
            description="Lista da mídia mais recente para a mais antiga, com formato, tamanho, resolução e duração quando aplicável."
            tooltip="Arquivos enviados pelo CMS podem ser excluídos. Se estiverem em uso, a confirmação remove as referências e o site usa os fallbacks configurados; arquivos versionados do projeto não podem ser apagados por esta tela. Resolução e duração vêm do próprio arquivo e podem não estar disponíveis em mídias antigas ou inválidas."
          />

          <div className="flex-1 overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
              style={{ transform: `translateX(-${currentPage * 100}%)` }}
            >
              {pages.map((page, index) => (
                <div key={index} className="h-full w-full shrink-0 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {page.map((image) => {
                    const itemType = image.mediaType ?? mediaTypeFromUrl(image.url);
                    return (
                    <article
                      key={image.url}
                      className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                    >
                      {itemType === "video" ? (
                        <video
                          src={resolveCmsMediaUrl(image.url)}
                          className="h-32 w-full bg-slate-950 object-contain"
                          controls
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={resolveCmsMediaUrl(image.thumbnailUrl || image.url)}
                          alt={image.name}
                          className="h-32 w-full object-cover"
                          loading="lazy"
                        />
                      )}

                      <div className="p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                            {image.source} - {itemType}
                          </span>
                          {image.usedInContent ? (
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
                              Em uso
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-2.5 truncate text-sm font-medium text-[var(--foreground)]">
                          {image.name}
                        </p>
                        <p className="mt-1 break-all text-[11px] leading-5 text-[var(--color-muted-raw)]">
                          {image.url}
                        </p>
                        <p className="mt-1.5 text-[11px] text-[var(--color-muted-raw)]">
                          {formatBytes(image.optimizedSize ?? image.size)} · {image.format ?? "asset"} · {image.references} refs
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--color-muted-raw)]">
                          Resolução: {formatDimensions(image)} · Proporção: {formatAspectRatio(image)}
                          {itemType === "video" ? ` · Duração: ${formatDuration(image.durationSeconds)}` : ""}
                        </p>
                        {image.uploadedAt ? (
                          <p className="mt-1 text-[11px] text-[var(--color-muted-raw)]">
                            Upload: {new Date(image.uploadedAt).toLocaleDateString("pt-BR")}
                          </p>
                        ) : null}

                        <div className="mt-3 grid gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFromUrl(image.url);
                              setStatus("info");
                              setMessage(`Mídia preenchida como origem: ${image.url}`);
                            }}
                            className={`${developerSecondaryButtonClassName} min-h-10 rounded-xl px-3 py-2 text-xs`}
                          >
                            <ImagesSquare size={16} weight="bold" />
                            Usar como origem
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setToUrl(image.url);
                              setStatus("info");
                              setMessage(`Mídia preenchida como destino: ${image.url}`);
                            }}
                            className={`${developerSecondaryButtonClassName} min-h-10 rounded-xl px-3 py-2 text-xs`}
                          >
                            <ImagesSquare size={16} weight="bold" />
                            Usar como destino
                          </button>
                          {image.source === "upload" ? (
                            <button
                              type="button"
                              onClick={() => void handleDelete(image)}
                              disabled={deletingUrl === image.url}
                              className={`${developerDangerButtonClassName} min-h-10 rounded-xl px-3 py-2 text-xs`}
                            >
                              <Trash size={16} weight="bold" />
                              {deletingUrl === image.url ? "Excluindo..." : "Excluir arquivo"}
                            </button>
                          ) : (
                            <p className="px-1 text-[11px] leading-5 text-[var(--color-muted-raw)]">
                              Arquivo do projeto: não pode ser excluído pelo CMS.
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <DeveloperCarouselPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onNext={nextPage}
            onPrev={prevPage}
          />

          {!loading && images.length === 0 ? (
            <div className="mt-4">
              <DeveloperMessage tone="info">
                Nenhuma imagem foi encontrada na biblioteca atual.
              </DeveloperMessage>
            </div>
          ) : null}
        </DeveloperCard>
      </section>
    </DeveloperPage>
  );
}
