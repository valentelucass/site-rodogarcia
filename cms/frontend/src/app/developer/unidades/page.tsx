"use client";

import { useState } from "react";
import {
  CheckCircle,
  MapPinLine,
  PencilSimple,
  Plus,
  SortAscending,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useAdminCollection } from "@/hooks/useAdminCollection";
import { useCarouselPagination } from "@/hooks/useCarouselPagination";
import { DeveloperConfirmButton } from "@/components/developer/DeveloperConfirmButton";
import {
  DeveloperCard,
  DeveloperField,
  DeveloperHero,
  DeveloperCarouselPagination,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  DeveloperStatusPill,
  developerSplitLayoutClassName,
  developerGhostButtonClassName,
  developerInputClassName,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
} from "@/components/developer/ui";

interface UnitFormState {
  name: string;
  type: string;
  state: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  additionalEmail: string;
  contactUrl: string;
  description: string;
  logisticsInfo: string;
  quoteCnpj: string;
  genericPostalCode: string;
  isDefault: boolean;
  active: boolean;
}

interface UnitItem extends UnitFormState {
  id: string;
  order?: number;
}

const EMPTY_FORM: UnitFormState = {
  name: "",
  type: "filial",
  state: "",
  city: "",
  address: "",
  phone: "",
  email: "",
  additionalEmail: "",
  contactUrl: "/fale-conosco",
  description: "",
  logisticsInfo: "",
  quoteCnpj: "",
  genericPostalCode: "",
  isDefault: false,
  active: true,
};

const UNIT_TYPES = ["matriz", "filial", "ponto de apoio"] as const;
const BRAZILIAN_STATE_CODES = [
  "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg",
  "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to",
] as const;
const compactUnitInputClassName = `${developerInputClassName} py-2`;

function normalizeUnit(item: Record<string, unknown>): UnitItem {
  return {
    id: String(item.id ?? ""),
    order: Number(item.order ?? 0),
    name: String(item.name ?? item.nome ?? ""),
    type: String(item.type ?? item.tipo ?? "filial"),
    state: String(item.state ?? item.estado ?? "").toLowerCase(),
    city: String(item.city ?? item.cidade ?? ""),
    address: String(item.address ?? item.endereco ?? ""),
    phone: String(item.phone ?? item.telefone ?? ""),
    email: String(item.email ?? ""),
    additionalEmail: String(item.additionalEmail ?? ""),
    contactUrl: String(item.contactUrl ?? item.linkContato ?? "/fale-conosco"),
    description: String(item.description ?? item.descricao ?? ""),
    logisticsInfo: String(item.logisticsInfo ?? item.infoLogistica ?? ""),
    quoteCnpj: String(item.quoteCnpj ?? ""),
    genericPostalCode: String(item.genericPostalCode ?? ""),
    isDefault: Boolean(item.isDefault ?? item.matriz),
    active: Boolean(item.active ?? item.ativo ?? true),
  };
}

export default function UnidadesPage() {
  const { items, loading, error, createItem, updateItem, removeItem, moveItem } =
    useAdminCollection<UnitItem>("units", { normalize: normalizeUnit });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UnitFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const { pages, currentPage, totalPages, nextPage, prevPage } =
    useCarouselPagination(items, 3);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setStatus("");
  }

  function editItem(item: UnitItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      type: item.type || "filial",
      state: item.state,
      city: item.city,
      address: item.address,
      phone: item.phone,
      email: item.email,
      additionalEmail: item.additionalEmail,
      contactUrl: item.contactUrl || "/fale-conosco",
      description: item.description,
      logisticsInfo: item.logisticsInfo,
      quoteCnpj: item.quoteCnpj,
      genericPostalCode: item.genericPostalCode,
      isDefault: item.isDefault,
      active: item.active,
    });
    setStatus("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      name: form.name.trim(),
      type: form.type.trim(),
      state: form.state.trim().toLowerCase(),
      city: form.city.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      additionalEmail: form.additionalEmail.trim(),
      contactUrl: form.contactUrl.trim(),
      description: form.description.trim(),
      logisticsInfo: form.logisticsInfo.trim(),
      quoteCnpj: form.quoteCnpj.replace(/\D/g, ""),
      genericPostalCode: form.genericPostalCode.replace(/\D/g, ""),
    };

    if (!payload.name || !BRAZILIAN_STATE_CODES.includes(payload.state as (typeof BRAZILIAN_STATE_CODES)[number]) || !payload.address) {
      setStatus("Preencha nome, uma UF brasileira válida e endereço.");
      return;
    }

    if (!payload.phone && !payload.email) {
      setStatus("Informe ao menos telefone ou e-mail da unidade.");
      return;
    }
    if (!payload.additionalEmail) {
      setStatus("Informe o e-mail adicional da unidade.");
      return;
    }

    setSaving(true);
    setStatus("");

    const response = editingId
      ? await updateItem(editingId, payload)
      : await createItem(payload);

    setSaving(false);

    if (!response.success) {
      setStatus(response.error ?? "Falha ao salvar a unidade.");
      return;
    }

    resetForm();
    setStatus("Unidade salva com sucesso.");
  }

  async function toggleItem(item: UnitItem) {
    const response = await updateItem(item.id, { ...item, active: !item.active });
    if (!response.success) {
      setStatus(response.error ?? "Falha ao atualizar a unidade.");
    }
  }

  async function deleteItem(id: string) {
    const response = await removeItem(id);
    if (!response.success) {
      setStatus(response.error ?? "Falha ao excluir a unidade.");
    }
  }

  async function move(id: string, direction: -1 | 1) {
    const response = await moveItem(id, direction);
    if (!response.success && response.error !== "Movimento invalido.") {
      setStatus(response.error ?? "Falha ao reordenar a unidade.");
    }
  }

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="Conteudo - Unidades"
        title="Editor de unidades, filiais e pontos de apoio."
        description="Gerencie unidades usadas na Home."
        stats={[
          { label: "Unidades", value: items.length },
          { label: "Ativas", value: items.filter((item) => item.active).length },
        ]}
      />

      <section className={developerSplitLayoutClassName}>
        <DeveloperCard>
          <DeveloperSectionHeading
            eyebrow={editingId ? "Edicao" : "Nova unidade"}
            title={editingId ? "Atualizar unidade" : "Cadastrar unidade"}
            description="Use UF com duas letras; depois selecione este registro na Presença Regional da Página Inicial para publicar um snapshot no mapa."
          />

          <form className="space-y-4" onSubmit={handleSubmit}>
            <fieldset className="space-y-3 border-b border-[var(--border)]/75 pb-4">
              <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-raw)]">
                Identificação e localização
              </legend>

              <div className="grid gap-x-4 gap-y-3 md:grid-cols-12">
                <DeveloperField label="Nome da unidade" required className="md:col-span-8">
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    maxLength={120}
                    className={compactUnitInputClassName}
                  />
                </DeveloperField>

                <DeveloperField label="Tipo" required className="md:col-span-4">
                  <select
                    required
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, type: event.target.value }))
                    }
                    className={compactUnitInputClassName}
                  >
                    {UNIT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </DeveloperField>

                <DeveloperField label="UF" required className="md:col-span-2">
                  <select
                    required
                    value={form.state}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, state: event.target.value }))
                    }
                    className={compactUnitInputClassName}
                  >
                    <option value="">Selecione</option>
                    {BRAZILIAN_STATE_CODES.map((state) => (
                      <option key={state} value={state}>{state.toUpperCase()}</option>
                    ))}
                  </select>
                </DeveloperField>

                <DeveloperField label="Cidade" className="md:col-span-4">
                  <input
                    value={form.city}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, city: event.target.value }))
                    }
                    maxLength={80}
                    className={compactUnitInputClassName}
                  />
                </DeveloperField>

                <DeveloperField label="Endereço" required className="md:col-span-6">
                  <input
                    required
                    value={form.address}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, address: event.target.value }))
                    }
                    maxLength={220}
                    className={compactUnitInputClassName}
                  />
                </DeveloperField>
              </div>
            </fieldset>

            <fieldset className="space-y-3 border-b border-[var(--border)]/75 pb-4">
              <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-raw)]">
                Contato e destino
              </legend>

              <div className="grid gap-x-4 gap-y-3 md:grid-cols-12">
                <DeveloperField label="Telefone" className="md:col-span-4">
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    maxLength={60}
                    className={compactUnitInputClassName}
                  />
                </DeveloperField>

                <DeveloperField label="E-mail" className="md:col-span-4">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    maxLength={160}
                    className={compactUnitInputClassName}
                  />
                </DeveloperField>

                <DeveloperField label="E-mail adicional" required className="md:col-span-4">
                  <input
                    type="email"
                    required
                    value={form.additionalEmail}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, additionalEmail: event.target.value }))
                    }
                    maxLength={160}
                    className={compactUnitInputClassName}
                  />
                </DeveloperField>

                <DeveloperField label="Link de contato" className="md:col-span-12">
                  <input
                    value={form.contactUrl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, contactUrl: event.target.value }))
                    }
                    className={compactUnitInputClassName}
                    maxLength={600}
                    placeholder="/fale-conosco"
                  />
                </DeveloperField>
              </div>
            </fieldset>

            <fieldset className="space-y-3 border-b border-[var(--border)]/75 pb-4">
              <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-raw)]">
                Informações exibidas
              </legend>

              <div className="grid items-start gap-x-4 gap-y-3 md:grid-cols-2">
                <DeveloperField label="Descrição">
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    maxLength={220}
                    className={`${compactUnitInputClassName} resize-none`}
                  />
                </DeveloperField>

                <DeveloperField label="Informação logística">
                  <textarea
                    rows={3}
                    value={form.logisticsInfo}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        logisticsInfo: event.target.value,
                      }))
                    }
                    maxLength={260}
                    className={`${compactUnitInputClassName} resize-none`}
                  />
                </DeveloperField>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-raw)]">
                Publicação
              </legend>

              <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/72 px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isDefault: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Unidade padrão da base
              </label>

              <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/72 px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, active: event.target.checked }))
                  }
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Unidade ativa
              </label>
              </div>
            </fieldset>

            {status ? (
              <DeveloperMessage tone={status.includes("sucesso") ? "success" : "error"}>
                {status}
              </DeveloperMessage>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={saving} className={developerPrimaryButtonClassName}>
                <CheckCircle size={18} weight="bold" />
                {saving ? "Salvando..." : "Salvar configuracao"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className={developerSecondaryButtonClassName}
              >
                <X size={18} weight="bold" />
                Limpar
              </button>
            </div>
          </form>
        </DeveloperCard>

        <DeveloperCard>
          <DeveloperSectionHeading
            eyebrow="Unidades cadastradas"
            title="Mapa operacional"
            description="Ordene, ative e ajuste a base de referência disponível no editor da Home."
            action={
              <button type="button" onClick={resetForm} className={developerSecondaryButtonClassName}>
                <Plus size={16} weight="bold" />
                Nova unidade
              </button>
            }
          />

          {loading ? <DeveloperMessage tone="info">Carregando unidades...</DeveloperMessage> : null}
          {error ? <DeveloperMessage tone="error">{error}</DeveloperMessage> : null}

          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
              style={{ transform: `translateX(-${currentPage * 100}%)` }}
            >
              {pages.map((page, pageIndex) => (
                <div key={pageIndex} className="w-full shrink-0 space-y-4">
                  {page.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[24px] border border-[var(--border)] bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-raw)]">
                            Ordem {item.order ?? 0}
                          </span>
                          <DeveloperStatusPill active={item.active} />
                          {item.isDefault ? (
                            <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                              Padrao
                            </span>
                          ) : null}
                          <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-raw)]">
                            {item.state.toUpperCase()}
                          </span>
                        </div>

                        <div>
                          <h3 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                            <MapPinLine size={18} weight="duotone" />
                            {item.name || "Unidade sem nome"}
                          </h3>
                          <p className="mt-2 text-sm leading-7 text-[var(--color-muted-raw)]">
                            {item.address || "Endereço não cadastrado."}
                          </p>
                          <p className="mt-2 text-xs leading-6 text-[var(--color-muted-raw)]">
                            {item.phone || "-"} - {item.email || "-"}{item.additionalEmail ? ` - ${item.additionalEmail}` : ""}
                          </p>
                          {item.logisticsInfo ? (
                            <p className="mt-2 text-sm leading-7 text-[var(--color-muted-raw)]">
                              {item.logisticsInfo}
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => editItem(item)}
                            className={developerSecondaryButtonClassName}
                          >
                            <PencilSimple size={16} weight="bold" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleItem(item)}
                            className={developerGhostButtonClassName}
                          >
                            <CheckCircle size={16} weight="bold" />
                            {item.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => move(item.id, -1)}
                            className={developerGhostButtonClassName}
                          >
                            <SortAscending size={16} weight="bold" />
                            Subir
                          </button>
                          <button
                            type="button"
                            onClick={() => move(item.id, 1)}
                            className={developerGhostButtonClassName}
                          >
                            <SortAscending size={16} weight="bold" className="rotate-180" />
                            Descer
                          </button>
                          <DeveloperConfirmButton
                            message="Confirmar exclusão"
                            onConfirm={() => deleteItem(item.id)}
                          >
                            <Trash size={16} weight="bold" />
                            Excluir
                          </DeveloperConfirmButton>
                        </div>
                      </div>
                    </article>
                  ))}
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

          {!loading && items.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-[var(--border)] bg-white/60 px-4 py-8 text-center">
              <MapPinLine size={28} weight="duotone" className="mx-auto text-[var(--primary)]" />
              <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                Nenhuma unidade cadastrada ainda.
              </p>
              <p className="mt-2 text-sm text-[var(--color-muted-raw)]">
                Cadastre a primeira unidade para disponibilizá-la como referência no editor da Home.
              </p>
            </div>
          ) : null}
        </DeveloperCard>
      </section>
    </DeveloperPage>
  );
}
