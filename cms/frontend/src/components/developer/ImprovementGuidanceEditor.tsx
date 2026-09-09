"use client";

import { useDeveloperNotifier } from "@/components/developer/DeveloperNotifications";

import { useEffect, useState } from "react";
import { DeveloperCmsAccordion } from "@/components/developer/DeveloperCmsAccordion";
import { DeveloperMessage, DeveloperSectionHeading, developerInputClassName, developerPrimaryButtonClassName } from "@/components/developer/ui";
import { useApiRequest } from "@/hooks/useApiRequest";
import { api } from "@/lib/routes";
import type { OperationGuidanceContent, PageFaqItem } from "@/types/content";

const fallback: OperationGuidanceContent = { eyebrow: "", title: "", description: "", items: [] };

export function ImprovementGuidanceEditor() {
  const { apiRequest } = useApiRequest();
  const [guidance, setGuidance] = useState<OperationGuidanceContent>(fallback);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "saving">("loading");
  const notify = useDeveloperNotifier();

  useEffect(() => { void (async () => {
    const response = await apiRequest<{ page?: { operationGuidance?: OperationGuidanceContent } }>(api.admin.page("improvements"));
    if (!response.success || !response.data?.page?.operationGuidance) { setStatus("idle"); notify({ tone: "error", text: response.error ?? "Não foi possível carregar as orientações." }); return; }
    setGuidance(response.data.page.operationGuidance); setStatus("idle");
  })(); }, [apiRequest, notify]);

  function updateItem(index: number, patch: Partial<PageFaqItem>) { setGuidance((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })); }
  async function save() {
    setStatus("saving"); notify(null);
    const response = await apiRequest(api.admin.pageSection("improvements", "operationGuidance"), { method: "PUT", body: JSON.stringify(guidance) });
    if (!response.success) { setStatus("idle"); notify({ tone: "error", text: response.error ?? "Não foi possível salvar as orientações." }); return; }
    setStatus("idle"); notify({ tone: "success", text: "Orientações salvas. A página pública já exibirá o novo conteúdo." });
  }

  return <div className="mt-5"><DeveloperSectionHeading eyebrow="Acordeão público" title="Dicas abaixo do formulário" description="Edite o título e as perguntas que aparecem ao final da página /melhoria-continua." />
    {status === "loading" ? <DeveloperMessage tone="info">Carregando orientações...</DeveloperMessage> : <div className="mt-4 space-y-4"><div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"><div className="space-y-4"><label className="block text-sm font-medium">Chamada<input value={guidance.eyebrow} onChange={(event) => setGuidance((current) => ({ ...current, eyebrow: event.target.value }))} className={`${developerInputClassName} mt-1.5`} /></label><label className="block text-sm font-medium">Título<input value={guidance.title} onChange={(event) => setGuidance((current) => ({ ...current, title: event.target.value }))} className={`${developerInputClassName} mt-1.5`} /></label></div><label className="block text-sm font-medium">Descrição<textarea value={guidance.description} onChange={(event) => setGuidance((current) => ({ ...current, description: event.target.value }))} rows={5} className={`${developerInputClassName} mt-1.5 h-[calc(100%-1.625rem)] resize-y`} /></label></div><DeveloperCmsAccordion items={guidance.items} openIndex={openIndex} onOpenChange={setOpenIndex} getEyebrow={(_, index) => `Pergunta ${index + 1}`} getTitle={(item) => item.question || "Pergunta sem título"} renderItem={(item, index) => <div className="space-y-3"><label className="block text-sm font-medium">Pergunta<input value={item.question} onChange={(event) => updateItem(index, { question: event.target.value })} className={`${developerInputClassName} mt-1.5`} /></label><label className="block text-sm font-medium">Resposta<textarea value={item.answer} onChange={(event) => updateItem(index, { answer: event.target.value })} rows={4} className={`${developerInputClassName} mt-1.5 resize-y`} /></label></div>} /><button type="button" onClick={() => void save()} disabled={status === "saving"} className={developerPrimaryButtonClassName}>{status === "saving" ? "Salvando..." : "Salvar acordeão"}</button></div>}
  </div>;
}
