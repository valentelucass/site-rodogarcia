"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretDown, CheckCircle, ImageSquare } from "@phosphor-icons/react";
import { useApiRequest } from "@/hooks/useApiRequest";
import {
  adminResourceKeys,
  invalidateAdminResource,
} from "@/hooks/useAdminResource";
import { DeveloperMediaField, DeveloperMediaPreview } from "@/components/developer/DeveloperMediaField";
import { MediaPlacementEditor } from "@/components/developer/MediaPlacementEditor";
import { DeveloperResponsivePreview } from "@/components/developer/DeveloperResponsivePreview";
import {
  DeveloperCard,
  DeveloperField,
  DeveloperHero,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  developerInputClassName,
  developerPrimaryButtonClassName,
} from "@/components/developer/ui";
import { api, external, site } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type {
  ServicesFaqItem,
  ServicesModule,
  ServicesPageContent,
} from "@/types/content";

type SaveKey = "modules" | "finalCta" | "faq";

const MODULE_IDS = ["distribution", "indoor", "special"] as const;
const MODULE_LABELS = [
  "Distribuição nacional",
  "Operação indoor",
  "Cargas especiais",
] as const;

const FAQ_COUNT = 5;

function emptyModule(index: number): ServicesModule {
  return {
    id: MODULE_IDS[index] ?? `module-${index + 1}`,
    order: index + 1,
    image: { src: "", alt: "", position: index === 1 ? "object-[50%_45%]" : "" },
    eyebrow: MODULE_LABELS[index] ?? `Modulo ${index + 1}`,
    title: "",
    description: "",
    details: ["", "", ""],
    ctaLabel: "",
    ctaUrl: "",
  };
}

function emptyFaqItem(index: number): ServicesFaqItem {
  return {
    id: `services-faq-${index + 1}`,
    order: index + 1,
    question: "",
    answer: "",
  };
}

function emptyServicesPage(): ServicesPageContent {
  return {
    modules: Array.from({ length: 3 }, (_, index) => emptyModule(index)),
    finalCta: {
      quoteUrl: site.quote,
      trackingUrl: external.tracking,
    },
    faq: {
      title: "",
      items: Array.from({ length: FAQ_COUNT }, (_, index) => emptyFaqItem(index)),
    },
  };
}

function normalizeServicesPage(data?: ServicesPageContent): ServicesPageContent {
  const fallback = emptyServicesPage();
  return {
    modules: Array.from({ length: 3 }, (_, index) => {
      const module = data?.modules?.[index];
      return module
        ? {
            ...emptyModule(index),
            ...module,
            image: { ...emptyModule(index).image, ...module.image },
            details: Array.from(
              { length: 3 },
              (_, detailIndex) => module.details?.[detailIndex] ?? ""
            ),
          }
        : emptyModule(index);
    }),
    finalCta: {
      ...fallback.finalCta,
      ...data?.finalCta,
    },
    faq: {
      title: data?.faq?.title ?? "",
      items: Array.from({ length: FAQ_COUNT }, (_, index) => {
        const item = data?.faq?.items?.[index];
        return item ? { ...emptyFaqItem(index), ...item } : emptyFaqItem(index);
      }),
    },
  };
}

function CountHint({ value, maxLength }: { value: string; maxLength: number }) {
  return (
    <span className="mt-1 block text-[11px] text-[var(--color-muted-raw)]">
      {value.length}/{maxLength} caracteres
    </span>
  );
}

const formGroupClassName =
  "rounded-[22px] border border-[var(--border)]/80 bg-white/86 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:p-5";

const priorityFormGroupClassName =
  "rounded-[22px] border border-[#93c5fd] bg-[linear-gradient(135deg,rgba(219,234,254,0.82)_0%,rgba(239,246,255,0.8)_54%,rgba(248,251,255,0.9)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(29,78,216,0.08)] ring-1 ring-[var(--primary)]/7 sm:p-5";

const editableCardClassName =
  "rounded-[24px] border border-slate-200 bg-slate-50/86 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.045)] sm:p-5";

function SaveButton({
  saving,
  children,
}: {
  saving: boolean;
  children: string;
}) {
  return (
    <button type="submit" disabled={saving} className={developerPrimaryButtonClassName}>
      <CheckCircle size={18} weight="bold" />
      {saving ? "Salvando..." : children}
    </button>
  );
}

export default function DeveloperServicesPage() {
  const { apiRequest } = useApiRequest();
  const [services, setServices] = useState<ServicesPageContent>(emptyServicesPage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SaveKey | "">("");
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [moduleFramingOpen, setModuleFramingOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const response = await apiRequest<{ servicesPage?: ServicesPageContent }>(
        api.admin.servicesPage
      );
      if (!alive) return;
      if (response.success) {
        setServices(normalizeServicesPage(response.data?.servicesPage));
        setStatus(null);
      } else {
        setStatus({
          tone: "error",
          text: response.error ?? "Falha ao carregar a Página Serviços.",
        });
      }
      setLoading(false);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [apiRequest]);

  const summary = useMemo(
    () => ({
      modules: services.modules.length,
      faq: services.faq.items.length,
      cta: services.finalCta.quoteUrl && services.finalCta.trackingUrl ? "OK" : "Pendente",
    }),
    [services]
  );

  const activeModule = services.modules[activeModuleIndex] ?? emptyModule(activeModuleIndex);

  async function saveSection(section: SaveKey, endpoint: string, payload: unknown) {
    setSaving(section);
    setStatus(null);
    const response = await apiRequest<{ servicesPage?: ServicesPageContent }>(endpoint, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setSaving("");

    if (!response.success) {
      setStatus({
        tone: "error",
        text: response.error ?? "Falha ao salvar a Página Serviços.",
      });
      return;
    }

    setServices(normalizeServicesPage(response.data?.servicesPage));
    setPreviewRevision((revision) => revision + 1);
    setStatus({ tone: "success", text: "Bloco salvo com sucesso." });
    invalidateAdminResource([adminResourceKeys.dashboard, adminResourceKeys.images]);
  }

  function updateModule(index: number, patch: Partial<ServicesModule>) {
    setServices((current) => ({
      ...current,
      modules: current.modules.map((module, moduleIndex) =>
        moduleIndex === index ? { ...module, ...patch } : module
      ),
    }));
  }

  function updateModuleDetail(moduleIndex: number, detailIndex: number, value: string) {
    setServices((current) => ({
      ...current,
      modules: current.modules.map((module, index) => {
        if (index !== moduleIndex) return module;
        const details = [...module.details];
        details[detailIndex] = value;
        return { ...module, details };
      }),
    }));
  }

  function updateFaqItem(index: number, patch: Partial<ServicesFaqItem>) {
    setServices((current) => ({
      ...current,
      faq: {
        ...current.faq,
        items: current.faq.items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item
        ),
      },
    }));
  }

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="Serviços"
        title="Página Serviços."
        description="Edite as seções disponíveis no CMS."
        stats={[
          { label: "Módulos", value: summary.modules },
          { label: "FAQ", value: summary.faq },
          { label: "CTA", value: summary.cta },
        ]}
      />

      {loading ? (
        <div className="mt-5">
          <DeveloperMessage tone="info">Carregando configuração da Página Serviços...</DeveloperMessage>
        </div>
      ) : null}
      {status ? (
        <div className="mt-5">
          <DeveloperMessage tone={status.tone}>{status.text}</DeveloperMessage>
        </div>
      ) : null}

      <div className="mt-5">
        <DeveloperResponsivePreview href={site.services} title="Preview Serviços" revision={previewRevision} />
      </div>

      <div className="mt-5 grid gap-5">
        <DeveloperCard id="services-modules" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="Sessão Módulos"
            title="Módulos de serviço"
            description="Onde aparece no site: /servicos -> seção de módulos. Existem exatamente 3 cards fixos."
          />
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSection("modules", api.admin.servicesModules, {
                modules: services.modules,
              });
            }}
          >
            <div className="grid gap-2 rounded-[22px] border border-[var(--border)]/80 bg-white/70 p-2 sm:grid-cols-3">
              {services.modules.map((module, moduleIndex) => {
                const isActive = moduleIndex === activeModuleIndex;
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => {
                      setActiveModuleIndex(moduleIndex);
                      setModuleFramingOpen(false);
                    }}
                    className={cn(
                      "relative rounded-[18px] border px-4 py-3 text-left transition-all duration-200",
                      "hover:-translate-y-0.5 hover:border-[var(--primary)]/35 hover:bg-white",
                      isActive
                        ? "border-[var(--primary)]/38 bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(219,234,254,0.9)_100%)] shadow-[0_14px_34px_rgba(29,78,216,0.12)]"
                        : "border-transparent bg-transparent text-[var(--color-muted-raw)]"
                    )}
                  >
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em]">
                      Card fixo {moduleIndex + 1}
                    </span>
                    <span className="mt-1 block truncate text-sm font-semibold text-[var(--foreground)]">
                      {MODULE_LABELS[moduleIndex]}
                    </span>
                  </button>
                );
              })}
            </div>

            <article key={activeModule.id} className={editableCardClassName}>
                <div className="mb-5 flex items-start gap-3 rounded-[18px] border border-[var(--primary)]/16 bg-[linear-gradient(135deg,rgba(219,234,254,0.62)_0%,rgba(255,255,255,0.86)_70%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--primary)]/16 bg-[var(--primary)]/8 text-[var(--primary)]">
                    <ImageSquare size={20} weight="bold" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-raw)]">
                      Card fixo {activeModuleIndex + 1}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-[var(--foreground)]">
                      {MODULE_LABELS[activeModuleIndex]}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-muted-raw)]">
                      Conteúdo, imagem e botão do módulo exibido em /servicos.
                    </p>
                  </div>
                </div>

                <div className={priorityFormGroupClassName}>
                  <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                    Imagem principal <span className="text-[var(--primary)]">*</span>
                  </p>
                  <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)] md:items-start">
                    <DeveloperMediaPreview
                      value={activeModule.image.src}
                      previewAlt={activeModule.image.alt || activeModule.eyebrow}
                      mediaType="image"
                      onFrame={() => setModuleFramingOpen(true)}
                      align="start"
                    />
                    <div className="grid gap-4">
                      <DeveloperMediaField
                      label="Arquivo selecionado"
                      required
                      mediaType="image"
                      value={activeModule.image.src}
                      onChange={(src) =>
                        updateModule(activeModuleIndex, {
                          image: { ...activeModule.image, src },
                        })
                      }
                      hint="Upload ou seleção da biblioteca. A imagem aparece no card visual deste módulo."
                      showPreview={false}
                      equalControlWidths
                      />
                      <DeveloperField label="Texto alternativo da imagem" required>
                      <input
                        value={activeModule.image.alt}
                        onChange={(event) =>
                          updateModule(activeModuleIndex, {
                            image: { ...activeModule.image, alt: event.target.value },
                          })
                        }
                        maxLength={160}
                        className={developerInputClassName}
                      />
                      <CountHint value={activeModule.image.alt} maxLength={160} />
                      </DeveloperField>
                    </div>
                  </div>
                  <MediaPlacementEditor
                    label="a imagem deste módulo em /servicos"
                    src={activeModule.image.src}
                    alt={activeModule.image.alt}
                    mediaType="image"
                    value={activeModule.image.presentation}
                    frameAspectRatio="5:4 no desktop"
                    onChange={(presentation) => updateModule(activeModuleIndex, {
                      image: { ...activeModule.image, presentation },
                    })}
                    open={moduleFramingOpen}
                    onOpenChange={setModuleFramingOpen}
                    hideTrigger
                  />
                </div>

                <div className={cn(priorityFormGroupClassName, "mt-4 grid gap-5 lg:grid-cols-2")}>
                  <DeveloperField label="Título pequeno (tag superior)" required>
                    <input
                      value={activeModule.eyebrow}
                      onChange={(event) => updateModule(activeModuleIndex, { eyebrow: event.target.value })}
                      maxLength={80}
                      className={developerInputClassName}
                    />
                    <CountHint value={activeModule.eyebrow} maxLength={80} />
                  </DeveloperField>
                  <DeveloperField label="Título principal" required hint="Máximo esperado: 4 linhas.">
                    <input
                      value={activeModule.title}
                      onChange={(event) => updateModule(activeModuleIndex, { title: event.target.value })}
                      maxLength={180}
                      className={developerInputClassName}
                    />
                    <CountHint value={activeModule.title} maxLength={180} />
                  </DeveloperField>
                  <DeveloperField label="Descrição principal" required hint="Máximo esperado: 2 linhas." className="lg:col-span-2">
                    <textarea
                      value={activeModule.description}
                      onChange={(event) => updateModule(activeModuleIndex, { description: event.target.value })}
                      maxLength={260}
                      rows={3}
                      className={`${developerInputClassName} resize-none`}
                    />
                    <CountHint value={activeModule.description} maxLength={260} />
                  </DeveloperField>
                </div>

                <div className={cn(formGroupClassName, "mt-4 border-slate-300/85 bg-slate-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]")}>
                  <DeveloperSectionHeading
                    title="Tópicos fixos"
                    description="Cada tópico aparece como bullet point no módulo. Máximo esperado: 1 linha por item."
                  />
                  <div className="grid gap-4 lg:grid-cols-3">
                    {activeModule.details.map((detail, detailIndex) => (
                      <DeveloperField key={detailIndex} label={`Tópico ${detailIndex + 1}`} required>
                        <input
                          value={detail}
                          onChange={(event) =>
                            updateModuleDetail(activeModuleIndex, detailIndex, event.target.value)
                          }
                          maxLength={120}
                          className={developerInputClassName}
                        />
                        <CountHint value={detail} maxLength={120} />
                      </DeveloperField>
                    ))}
                  </div>
                </div>

                <div className={cn(formGroupClassName, "mt-4 grid gap-5 border-slate-300/85 bg-slate-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] md:grid-cols-2")}>
                  <DeveloperField label="Texto do botão" required>
                    <input
                      value={activeModule.ctaLabel}
                      onChange={(event) => updateModule(activeModuleIndex, { ctaLabel: event.target.value })}
                      maxLength={40}
                      className={developerInputClassName}
                    />
                  </DeveloperField>
                  <DeveloperField label="Link do botão" required>
                    <input
                      value={activeModule.ctaUrl}
                      onChange={(event) => updateModule(activeModuleIndex, { ctaUrl: event.target.value })}
                      className={developerInputClassName}
                    />
                  </DeveloperField>
                </div>
            </article>

            <SaveButton saving={saving === "modules"}>Salvar módulos</SaveButton>
          </form>
        </DeveloperCard>

        <DeveloperCard
          id="services-final-cta"
          className="border-[#93c5fd] bg-[linear-gradient(135deg,rgba(219,234,254,0.82)_0%,rgba(239,246,255,0.84)_54%,rgba(248,251,255,0.94)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_38px_rgba(29,78,216,0.1)] ring-1 ring-[var(--primary)]/7 sm:p-6"
        >
          <DeveloperSectionHeading
            eyebrow="CTA final"
            title="Abra sua cotação com mais clareza"
            description="Onde aparece no site: /servicos -> CTA final. O texto dos botões é fixo; aqui entram apenas os links."
          />
          <form
            className={cn(formGroupClassName, "grid gap-5 border-white/90 bg-white/92 shadow-[0_10px_26px_rgba(29,78,216,0.08)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]")}
            onSubmit={(event) => {
              event.preventDefault();
              void saveSection("finalCta", api.admin.servicesFinalCta, services.finalCta);
            }}
          >
            <DeveloperField label="Link do botão Solicitar cotação" required>
              <input
                value={services.finalCta.quoteUrl}
                onChange={(event) =>
                  setServices((current) => ({
                    ...current,
                    finalCta: { ...current.finalCta, quoteUrl: event.target.value },
                  }))
                }
                className={developerInputClassName}
              />
            </DeveloperField>
            <DeveloperField label="Link do botão Rastreio oficial" required>
              <input
                value={services.finalCta.trackingUrl}
                onChange={(event) =>
                  setServices((current) => ({
                    ...current,
                    finalCta: { ...current.finalCta, trackingUrl: event.target.value },
                  }))
                }
                className={developerInputClassName}
              />
            </DeveloperField>
            <div className="lg:justify-self-end">
              <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">Salvar alterações</p>
              <SaveButton saving={saving === "finalCta"}>Salvar CTA final</SaveButton>
            </div>
          </form>
        </DeveloperCard>

        <DeveloperCard id="services-faq" className="p-5 sm:p-6">
          <DeveloperSectionHeading
            eyebrow="FAQ"
            title="Perguntas Frequentes"
            description="Onde aparece no site: /servicos -> FAQ. A quantidade é fixa para preservar o layout e a animação."
          />
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSection("faq", api.admin.servicesFaq, services.faq);
            }}
          >
            <div className={formGroupClassName}>
              <DeveloperField label="Título principal da seção" required>
                <input
                  value={services.faq.title}
                  onChange={(event) =>
                    setServices((current) => ({
                      ...current,
                      faq: { ...current.faq, title: event.target.value },
                    }))
                  }
                  maxLength={120}
                  className={developerInputClassName}
                />
                <CountHint value={services.faq.title} maxLength={120} />
              </DeveloperField>
            </div>

            <div className="space-y-3">
              {services.faq.items.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <article
                    key={item.id}
                    className={cn(
                      "overflow-hidden rounded-[22px] border transition-all duration-300",
                      isOpen
                        ? "border-[#93c5fd] shadow-[0_14px_34px_rgba(29,78,216,0.12)] ring-1 ring-[var(--primary)]/7"
                        : "border-slate-300/90 bg-slate-100/90 shadow-[0_8px_20px_rgba(15,23,42,0.055)]"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors sm:px-5",
                        isOpen ? "bg-[#eff6ff]" : "bg-slate-100/90 hover:bg-slate-200/80"
                      )}
                      aria-expanded={isOpen}
                    >
                      <div className="min-w-0">
                        <p className={cn(
                          "text-[11px] font-semibold uppercase tracking-[0.16em]",
                          isOpen ? "text-[var(--primary)]" : "text-[var(--color-muted-raw)]"
                        )}>
                          Pergunta fixa {index + 1}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                          {item.question || "Pergunta sem texto"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-300",
                          isOpen
                            ? "rotate-180 border-[var(--primary)]/22 bg-white text-[var(--primary)] shadow-[0_6px_14px_rgba(29,78,216,0.1)]"
                            : "border-[var(--border)] bg-white text-[var(--color-muted-raw)]"
                        )}
                      >
                        <CaretDown size={16} weight="bold" />
                      </span>
                    </button>

                    <div
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="border-t border-[#bfdbfe] bg-white p-4 sm:p-5">
                          <p className="mb-4 text-sm leading-6 text-[var(--color-muted-raw)]">
                            Edite apenas os textos internos. Não há criação ou remoção de perguntas.
                          </p>
                          <div className="grid gap-5 md:grid-cols-2">
                            <DeveloperField label="Pergunta" required hint="Máximo esperado: 1 linha.">
                              <input
                                value={item.question}
                                onChange={(event) => updateFaqItem(index, { question: event.target.value })}
                                maxLength={180}
                                className={developerInputClassName}
                              />
                              <CountHint value={item.question} maxLength={180} />
                            </DeveloperField>
                            <DeveloperField label="Resposta" required hint="Máximo esperado: 2 linhas.">
                              <textarea
                                value={item.answer}
                                onChange={(event) => updateFaqItem(index, { answer: event.target.value })}
                                maxLength={320}
                                rows={3}
                                className={`${developerInputClassName} resize-none`}
                              />
                              <CountHint value={item.answer} maxLength={320} />
                            </DeveloperField>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <SaveButton saving={saving === "faq"}>Salvar FAQ</SaveButton>
          </form>
        </DeveloperCard>
      </div>
    </DeveloperPage>
  );
}
