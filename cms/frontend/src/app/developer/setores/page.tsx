"use client";

import { useRef, useState } from "react";
import { CheckCircle, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { useApiRequest } from "@/hooks/useApiRequest";
import { adminResourceKeys, invalidateAdminResource, useAdminResource } from "@/hooks/useAdminResource";
import { useSession } from "@/hooks/useSession";
import { api } from "@/lib/routes";
import { CMS_PERMISSION_CATALOG, type CmsPermission } from "@/lib/cmsAccess";
import {
  DeveloperCard,
  DeveloperField,
  DeveloperHero,
  DeveloperHelp,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  DeveloperStatusPill,
  developerDangerButtonClassName,
  developerGhostButtonClassName,
  developerInputClassName,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
  developerSplitLayoutClassName,
} from "@/components/developer/ui";

interface Sector {
  id: string;
  name: string;
  description: string;
  permissions: CmsPermission[];
  active: boolean;
}

interface SectorsResponse { profiles?: Sector[]; }

const EMPTY_SECTOR = { name: "", description: "", permissions: [] as CmsPermission[], active: true };

export default function SetoresPage() {
  const { apiRequest } = useApiRequest();
  const { session, loading: sessionLoading } = useSession();
  const isSupreme = Boolean(session?.user?.isSupreme || session?.user?.isOwner);
  const { data, loading, error, refresh } = useAdminResource<SectorsResponse>({
    key: "admin:access-profiles",
    fetcher: (request) => request<SectorsResponse>(api.admin.accessProfiles),
    enabled: isSupreme && !sessionLoading,
  });
  const sectors = data?.profiles ?? [];
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_SECTOR);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formHighlighted, setFormHighlighted] = useState(false);
  const formPanelRef = useRef<HTMLDivElement>(null);

  function resetForm() { setEditingId(""); setForm(EMPTY_SECTOR); setMessage(""); setFormHighlighted(false); }
  function edit(sector: Sector) {
    if (!isSupreme) return;
    setEditingId(sector.id);
    setForm({ name: sector.name, description: sector.description, permissions: sector.permissions, active: sector.active });
    setMessage("");
    setFormHighlighted(true);
    window.requestAnimationFrame(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    window.setTimeout(() => setFormHighlighted(false), 1600);
  }
  function togglePermission(permission: CmsPermission, checked: boolean) {
    setForm((current) => ({ ...current, permissions: checked ? [...current.permissions, permission] : current.permissions.filter((item) => item !== permission) }));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!isSupreme) { setMessage("Somente o usuário supremo pode administrar setores."); return; }
    if (!form.name.trim()) { setMessage("Informe o nome do setor."); return; }
    setSaving(true); setMessage("");
    const payload = { ...form, name: form.name.trim(), description: form.description.trim() };
    const response = editingId
      ? await apiRequest(api.admin.accessProfile(editingId), { method: "PUT", body: JSON.stringify(payload) })
      : await apiRequest(api.admin.accessProfiles, { method: "POST", body: JSON.stringify(payload) });
    setSaving(false);
    if (!response.success) { setMessage(response.error ?? "Não foi possível salvar o setor."); return; }
    invalidateAdminResource(["admin:access-profiles", "admin:access-profiles-for-users", adminResourceKeys.users]);
    await refresh(); resetForm(); setMessage("Setor salvo com sucesso.");
  }
  async function remove(sector: Sector) {
    if (!isSupreme) { setMessage("Somente o usuário supremo pode administrar setores."); return; }
    if (!window.confirm(`Excluir o setor “${sector.name}”? Usuários vinculados perderão as permissões herdadas dele; somente exceções individuais explícitas continuarão válidas até receberem outro setor ativo.`)) return;
    const response = await apiRequest(api.admin.accessProfile(sector.id), { method: "DELETE" });
    if (!response.success) { setMessage(response.error ?? "Não foi possível excluir o setor."); return; }
    invalidateAdminResource(["admin:access-profiles", "admin:access-profiles-for-users"]);
    await refresh();
  }

  if (sessionLoading) {
    return <DeveloperPage>
      <DeveloperHero eyebrow="Administração - Setores" title="Setores e acessos" description="Verificando as permissões desta conta." />
      <div className="mt-5"><DeveloperMessage tone="info">Carregando permissões...</DeveloperMessage></div>
    </DeveloperPage>;
  }

  if (!isSupreme) {
    return <DeveloperPage>
      <DeveloperHero eyebrow="Administração - Setores" title="Perfis de acesso protegidos" description="Esta área é reservada ao usuário supremo do CMS." />
      <div className="mt-5 flex justify-center">
        <DeveloperCard className="w-full max-w-2xl text-center">
          <DeveloperSectionHeading
            eyebrow="Acesso restrito"
            title="Sua conta não pode administrar perfis"
            description="Somente o usuário supremo pode visualizar ou alterar setores, privilégios e perfis de acesso. Essa separação impede que uma conta comum amplie as próprias permissões."
            className="mb-4 items-center text-center sm:justify-center [&>div>div]:justify-center"
          />
          <DeveloperMessage tone="info">Peça ao usuário supremo qualquer ajuste de acesso necessário para o seu trabalho.</DeveloperMessage>
        </DeveloperCard>
      </div>
    </DeveloperPage>;
  }

  return <DeveloperPage>
    <DeveloperHero eyebrow="Administração - Setores" title="Setores e privilégios de acesso." description="Defina setores e acessos do CMS." stats={[{ label: "Setores", value: sectors.length }, { label: "Ativos", value: sectors.filter((sector) => sector.active).length }]} />
    <section className={developerSplitLayoutClassName}>
      <div ref={formPanelRef} className="scroll-mt-5">
      <DeveloperCard className={`transition-shadow duration-300 ${formHighlighted ? "ring-2 ring-[var(--primary)]/40 ring-offset-2 ring-offset-[var(--background)]" : ""}`}>
        <DeveloperSectionHeading eyebrow={editingId ? "Edição" : "Novo setor"} title={editingId ? "Atualizar setor" : "Criar setor"} description="O setor agrupa os privilégios. Ele pode ser selecionado no cadastro de novos administradores." />
        {editingId ? <p className="mb-4 rounded-lg border border-[var(--primary)]/15 bg-[var(--primary)]/[0.06] px-3 py-2 text-sm font-semibold text-[var(--foreground)]" role="status">Editando “{form.name}”. As opções deste setor foram carregadas abaixo.</p> : null}
        <form className="space-y-4" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <DeveloperField label="Nome do setor" required>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={80} required className={developerInputClassName} placeholder="Ex.: Recursos Humanos" />
            </DeveloperField>
            <DeveloperField label="Descrição" hint="Explique brevemente para quem este setor serve.">
              <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={220} className={developerInputClassName} />
            </DeveloperField>
          </div>
          <DeveloperField label="Privilégios do setor" required hint="As áreas marcadas ficam visíveis e podem ser alteradas por quem estiver neste setor.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CMS_PERMISSION_CATALOG.filter(([permission]) => permission !== "users").map(([permission, label]) => <label key={permission} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/75 px-2.5 py-1.5 text-sm font-semibold text-[var(--foreground)]"><input type="checkbox" checked={form.permissions.includes(permission)} onChange={(event) => togglePermission(permission, event.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--primary)]" /><span className="truncate">{label}</span></label>)}
            </div>
          </DeveloperField>
          <label className="flex items-center gap-3 text-sm font-semibold text-[var(--foreground)]"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /><span>Setor ativo</span><DeveloperHelp label="Status do setor" templateKey="status-do-setor" /></label>
          {message ? <DeveloperMessage tone={message.includes("sucesso") ? "success" : "error"}>{message}</DeveloperMessage> : null}
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving} className={developerPrimaryButtonClassName}><CheckCircle size={16} weight="bold" />{saving ? "Salvando..." : editingId ? "Salvar setor" : "Criar setor"}</button>{editingId ? <button type="button" onClick={resetForm} className={developerSecondaryButtonClassName}><X size={16} weight="bold" />Cancelar</button> : null}</div>
        </form>
      </DeveloperCard>
      </div>
      <DeveloperCard>
        <DeveloperSectionHeading eyebrow="Setores cadastrados" title="Perfis disponíveis" description="Os setores iniciais podem ser ajustados; também é possível adicionar quantos forem necessários." />
        {loading ? <DeveloperMessage tone="info">Carregando setores...</DeveloperMessage> : error ? <DeveloperMessage tone="error">{error}</DeveloperMessage> : <div className="grid gap-3 sm:grid-cols-2">{sectors.map((sector) => <article key={sector.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/55 p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold leading-5 text-[var(--foreground)]">{sector.name}</h3><DeveloperStatusPill active={sector.active} activeLabel="Ativo" inactiveLabel="Inativo" /></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-muted-raw)]">{sector.description || "Sem descrição."}</p><p className="mt-2 text-xs font-semibold text-[var(--color-muted-raw)]">{sector.permissions.length} áreas liberadas</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => edit(sector)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-950" aria-label={`Editar ${sector.name}`} title="Editar setor"><PencilSimple size={16} weight="bold" /></button><button type="button" onClick={() => void remove(sector)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 bg-red-50 text-red-600 transition hover:bg-red-100" aria-label={`Excluir ${sector.name}`} title="Excluir setor"><Trash size={16} weight="bold" /></button></div></div></article>)}{sectors.length === 0 ? <DeveloperMessage tone="info">Nenhum setor cadastrado.</DeveloperMessage> : null}</div>}
      </DeveloperCard>
    </section>
  </DeveloperPage>;
}
