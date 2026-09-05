"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  DotsThreeVertical,
  IdentificationBadge,
  Key,
  PencilSimple,
  ShieldCheck,
  Trash,
  UserCirclePlus,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { useApiRequest } from "@/hooks/useApiRequest";
import { useCarouselPagination } from "@/hooks/useCarouselPagination";
import { useSession } from "@/hooks/useSession";
import {
  adminResourceKeys,
  invalidateAdminResource,
  useAdminResource,
} from "@/hooks/useAdminResource";
import { api } from "@/lib/routes";
import type { CmsPermission } from "@/lib/cmsAccess";
import {
  DeveloperCard,
  DeveloperField,
  DeveloperHero,
  DeveloperCarouselPagination,
  DeveloperMessage,
  DeveloperPage,
  DeveloperSectionHeading,
  developerInputClassName,
  developerPrimaryButtonClassName,
  developerSecondaryButtonClassName,
} from "@/components/developer/ui";

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: "admin" | "user";
  cmsPermissions: CmsPermission[];
  accessProfileId?: string;
  createdAt: string;
  active: boolean;
  protected?: boolean;
  isSupreme?: boolean;
  passwordChangeRequired?: boolean;
  passwordResetRequestedAt?: string;
  permissions?: ("createUsers" | "deleteUsers")[];
}

interface UsersResponse {
  user?: AdminUser;
  users?: AdminUser[];
}

interface AccessProfile {
  id: string;
  name: string;
  active: boolean;
}

interface AccessProfilesResponse {
  profiles?: AccessProfile[];
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: "admin" | "user";
  accessProfileId: string;
}

const EMPTY_FORM: UserFormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "admin",
  accessProfileId: "",
};

const USERS_PER_PAGE = 4;

function formatDate(value?: string) {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getPasswordChecks(password: string) {
  return [
    { label: "10 caracteres", valid: password.length >= 10 },
    { label: "Até 72 caracteres", valid: password.length <= 72 },
    { label: "Letra minúscula", valid: /[a-z]/.test(password) },
    { label: "Letra maiúscula", valid: /[A-Z]/.test(password) },
    { label: "Número", valid: /[0-9]/.test(password) },
  ];
}

export default function UsuariosPage() {
  const { apiRequest } = useApiRequest();
  const { session, loading: sessionLoading } = useSession();
  const isSupreme = Boolean(session?.user?.isSupreme || session?.user?.isOwner);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editingId, setEditingId] = useState("");
  const [editing, setEditing] = useState<Partial<AdminUser>>({});
  const [permissionsMenuId, setPermissionsMenuId] = useState("");
  const [resettingId, setResettingId] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [mutatingId, setMutatingId] = useState("");
  const [status, setStatus] = useState<"" | "success" | "error">("");
  const [statusMessage, setStatusMessage] = useState("");
  const { data, loading, error, refresh } = useAdminResource<AdminUser[]>({
    key: adminResourceKeys.users,
    fetcher: async (request) => {
      const response = await request<UsersResponse>(api.admin.users);

      if (!response.success) {
        return {
          success: false,
          error: response.error ?? "Falha ao carregar usuários.",
        };
      }

      return {
        success: true,
        data: response.data?.users ?? [],
      };
    },
    enabled: isSupreme && !sessionLoading,
  });

  useEffect(() => {
    if (!data) return;
    setUsers(data);
  }, [data]);

  async function loadUsers() {
    if (!isSupreme) return;
    const response = await apiRequest<UsersResponse>(api.admin.users);
    if (response.success) {
      setUsers(response.data?.users ?? []);
    }
  }

  useEffect(() => {
    if (sessionLoading || !isSupreme) return;
    void loadUsers();
  }, [isSupreme, sessionLoading]);

  const passwordChecks = useMemo(
    () => getPasswordChecks(form.password),
    [form.password]
  );
  const adminCount = users.filter((user) => user.role === "admin" && user.active).length;
  const activeCount = users.filter((user) => user.active).length;
  const canCreateUsers = isSupreme;
  const canDeleteUsers = isSupreme;
  const { data: accessProfilesData } = useAdminResource<AccessProfilesResponse>({
    key: "admin:access-profiles-for-users",
    fetcher: (request) => request<AccessProfilesResponse>(api.admin.accessProfiles),
    enabled: isSupreme && !sessionLoading,
  });
  const activeProfiles = (accessProfilesData?.profiles ?? []).filter((profile) => profile.active);
  const {
    pages: userPages,
    currentPage: usersPage,
    totalPages: usersTotalPages,
    nextPage: nextUsersPage,
    prevPage: prevUsersPage,
  } = useCarouselPagination(users, USERS_PER_PAGE);

  function resetForm() {
    setForm(EMPTY_FORM);
    setStatus("");
    setStatusMessage("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!isSupreme) {
      setStatus("error");
      setStatusMessage("Somente o usuário supremo pode criar usuários.");
      return;
    }

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setStatus("error");
      setStatusMessage("Preencha nome, e-mail e senha antes de criar o usuário.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setStatus("error");
      setStatusMessage("As senhas não conferem.");
      return;
    }

    if (passwordChecks.some((check) => !check.valid)) {
      setStatus("error");
      setStatusMessage("A senha ainda não atende aos requisitos mínimos.");
      return;
    }

    setSaving(true);
    setStatus("");
    setStatusMessage("");

    const response = await apiRequest<UsersResponse>(api.admin.users, {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: form.role,
        accessProfileId: form.role === "admin" ? form.accessProfileId : "",
      }),
    });

    setSaving(false);

    if (!response.success) {
      setStatus("error");
      setStatusMessage(response.error ?? "Falha ao criar usuário.");
      return;
    }

    setUsers(response.data?.users ?? users);
    invalidateAdminResource([adminResourceKeys.users, adminResourceKeys.dashboard]);
    setStatus("success");
    setStatusMessage("Usuário criado. No primeiro acesso, a pessoa precisará criar a própria senha.");
    setForm(EMPTY_FORM);
    await refresh();
    await loadUsers();
  }

  function beginEdit(user: AdminUser) {
    setEditingId(user.id);
    setEditing({
      name: user.name ?? "",
      email: user.email,
      role: user.role,
      active: user.active,
    });
  }

  async function saveUser(user: AdminUser) {
    if (!isSupreme) {
      setStatus("error");
      setStatusMessage("Somente o usuário supremo pode editar usuários.");
      return;
    }
    setMutatingId(user.id);
    setStatus("");
    setStatusMessage("");
    const response = await apiRequest<UsersResponse>(`${api.admin.users}/${user.id}`, {
      method: "PUT",
      body: JSON.stringify(editing),
    });
    setMutatingId("");
    if (!response.success) {
      setStatus("error");
      setStatusMessage(response.error ?? "Falha ao atualizar usuário.");
      return;
    }
    setUsers(response.data?.users ?? users);
    setEditingId("");
    setEditing({});
    setStatus("success");
    setStatusMessage("Usuário atualizado com sucesso.");
    invalidateAdminResource([adminResourceKeys.users, adminResourceKeys.dashboard]);
    await refresh();
    await loadUsers();
  }

  async function removeUser(user: AdminUser) {
    if (!isSupreme) {
      setStatus("error");
      setStatusMessage("Somente o usuário supremo pode excluir usuários.");
      return;
    }
    if (!window.confirm(`Excluir o acesso de ${user.email}?`)) return;
    setMutatingId(user.id);
    setStatus("");
    setStatusMessage("");
    const response = await apiRequest<UsersResponse>(`${api.admin.users}/${user.id}`, {
      method: "DELETE",
    });
    setMutatingId("");
    if (!response.success) {
      setStatus("error");
      setStatusMessage(response.error ?? "Falha ao excluir usuário.");
      return;
    }
    setUsers(response.data?.users ?? users);
    setStatus("success");
    setStatusMessage("Usuário removido com sucesso.");
    invalidateAdminResource([adminResourceKeys.users, adminResourceKeys.dashboard]);
    await refresh();
    await loadUsers();
  }

  async function updatePermissions(user: AdminUser, permission: "createUsers" | "deleteUsers", enabled: boolean) {
    if (!isSupreme) {
      setStatus("error");
      setStatusMessage("Somente o usuário supremo pode alterar permissões.");
      return;
    }
    const permissions = new Set(user.permissions ?? []);
    if (enabled) permissions.add(permission);
    else permissions.delete(permission);
    setMutatingId(user.id);
    const response = await apiRequest<UsersResponse>(`${api.admin.users}/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ permissions: [...permissions] }),
    });
    setMutatingId("");
    if (!response.success) {
      setStatus("error");
      setStatusMessage(response.error ?? "Falha ao atualizar permissões.");
      return;
    }
    setUsers(response.data?.users ?? users);
    setStatus("success");
    setStatusMessage("Permissões atualizadas com sucesso.");
    invalidateAdminResource([adminResourceKeys.users]);
    await refresh();
    await loadUsers();
  }

  async function resetUserPassword(user: AdminUser) {
    if (!isSupreme) {
      setStatus("error");
      setStatusMessage("Somente o usuário supremo pode redefinir senhas.");
      return;
    }
    if (temporaryPassword !== confirmTemporaryPassword) {
      setStatus("error");
      setStatusMessage("As senhas temporárias não conferem.");
      return;
    }
    if (getPasswordChecks(temporaryPassword).some((check) => !check.valid)) {
      setStatus("error");
      setStatusMessage("A senha temporária ainda não atende aos requisitos mínimos.");
      return;
    }

    setMutatingId(user.id);
    const response = await apiRequest<UsersResponse>(`${api.admin.users}/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ password: temporaryPassword, confirmPassword: confirmTemporaryPassword }),
    });
    setMutatingId("");
    if (!response.success) {
      setStatus("error");
      setStatusMessage(response.error ?? "Falha ao redefinir a senha.");
      return;
    }
    setUsers(response.data?.users ?? users);
    setResettingId("");
    setTemporaryPassword("");
    setConfirmTemporaryPassword("");
    setStatus("success");
    setStatusMessage(`Senha temporária definida para ${user.email}. No próximo acesso, a pessoa precisará criar uma nova senha.`);
    invalidateAdminResource([adminResourceKeys.users, adminResourceKeys.dashboard]);
    await refresh();
    await loadUsers();
  }

  if (sessionLoading) {
    return <DeveloperPage>
      <DeveloperHero eyebrow="Segurança - Usuários" title="Usuários do CMS" description="Verificando as permissões desta conta." />
      <div className="mt-5"><DeveloperMessage tone="info">Carregando permissões...</DeveloperMessage></div>
    </DeveloperPage>;
  }

  if (!isSupreme) {
    return <DeveloperPage>
      <DeveloperHero eyebrow="Segurança - Usuários" title="Gestão de usuários protegida" description="Esta área é reservada ao usuário supremo do CMS." />
      <div className="mt-5 flex justify-center">
        <DeveloperCard className="w-full max-w-2xl text-center">
          <DeveloperSectionHeading
            eyebrow="Acesso restrito"
            title="Sua conta não pode administrar identidades"
            description="Para proteger as contas administrativas, somente o usuário supremo pode visualizar usuários, criar acessos, editar perfis, redefinir senhas ou excluir contas."
            className="mb-4 items-center text-center sm:justify-center [&>div>div]:justify-center"
          />
          <DeveloperMessage tone="info">Se você precisa de um novo acesso ou de uma alteração de permissão, solicite-a ao usuário supremo.</DeveloperMessage>
        </DeveloperCard>
      </div>
    </DeveloperPage>;
  }

  return (
    <DeveloperPage>
      <DeveloperHero
        eyebrow="Segurança - Usuários"
        title="Criação de usuários do CMS."
        description="Cadastre e gerencie acessos internos."
        stats={[
          { label: "Usuários", value: users.length },
          { label: "Admins ativos", value: adminCount },
          { label: "Ativos", value: activeCount },
        ]}
      />

      {loading ? (
        <div className="mt-6">
          <DeveloperMessage tone="info">Carregando usuários...</DeveloperMessage>
        </div>
      ) : null}

      {error ? (
        <div className="mt-6">
          <DeveloperMessage tone="error">{error}</DeveloperMessage>
        </div>
      ) : null}

      <section className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(480px,560px)_minmax(0,1fr)]">
        <DeveloperCard className="p-5 xl:sticky xl:top-5">
          <DeveloperSectionHeading
            eyebrow="Novo acesso"
            title="Criar usuário"
            description="Cadastre os dados, defina a senha temporária e então escolha o acesso que a pessoa terá no CMS."
            tooltip="Usuário interno é uma conta criada para operar o CMS. Exemplo: admin@empresa.com.br."
          />

          {!canCreateUsers ? <DeveloperMessage tone="info">Sua conta pode visualizar os acessos, mas não tem permissão para criar usuários.</DeveloperMessage> : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
            <DeveloperField label="Nome" required>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                maxLength={80}
                required
                autoComplete="name"
                className={developerInputClassName}
              />
            </DeveloperField>

            <DeveloperField label="E-mail" required>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                maxLength={160}
                required
                autoComplete="email"
                className={developerInputClassName}
              />
            </DeveloperField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DeveloperField label="Senha temporária" required>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  maxLength={72}
                  required
                  autoComplete="new-password"
                  className={developerInputClassName}
                />
              </DeveloperField>

              <DeveloperField label="Confirmar senha" required>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  maxLength={72}
                  required
                  autoComplete="new-password"
                  className={developerInputClassName}
                />
              </DeveloperField>
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-slate-50/78 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                Requisitos da senha temporária
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-muted-raw)]">
                No primeiro acesso, a pessoa deverá criar a própria senha antes de entrar no painel.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {passwordChecks.map((check) => (
                  <span
                    key={check.label}
                    className="inline-flex items-center gap-2 text-sm text-[var(--color-muted-raw)]"
                  >
                    {check.valid ? (
                      <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                    ) : (
                      <X size={16} weight="bold" className="text-slate-400" />
                    )}
                    {check.label}
                  </span>
                ))}
              </div>
            </div>

            <DeveloperField
              label="Perfil de acesso"
              required
              hint="Escolha o tipo de conta que será criado."
              tooltip="Administrador acessa o CMS. Usuário comum não acessa o painel administrativo."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    value: "admin" as const,
                    label: "Administrador",
                    description: "Pode acessar o CMS, sem gerenciar outros usuários.",
                  },
                  {
                    value: "user" as const,
                    label: "Usuário",
                    description: "Conta comum, sem permissão de admin no painel atual.",
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex min-h-14 items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/78 px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="role"
                      checked={form.role === option.value}
                      onChange={() =>
                        setForm((current) => ({ ...current, role: option.value }))
                      }
                      className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="block font-semibold text-[var(--foreground)]">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-[var(--color-muted-raw)]">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </DeveloperField>

            {form.role === "admin" ? (
              <DeveloperField
                label="Setor de acesso"
                required
                hint="O setor define as telas que esta pessoa poderá ver e alterar. Você pode criar ou ajustar setores em Setores e acessos."
              >
                <select value={form.accessProfileId} onChange={(event) => setForm((current) => ({ ...current, accessProfileId: event.target.value }))} required className={developerInputClassName}>
                  <option value="">Selecione um setor</option>
                  {activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                </select>
              </DeveloperField>
            ) : null}

            {status ? (
              <DeveloperMessage tone={status === "success" ? "success" : "error"}>
                {statusMessage}
              </DeveloperMessage>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className={developerPrimaryButtonClassName}
              >
                <UserCirclePlus size={18} weight="bold" />
                {saving ? "Criando..." : "Criar usuário"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                title="Limpa os campos do formulário sem apagar usuários salvos."
                className={developerSecondaryButtonClassName}
              >
                <X size={18} weight="bold" />
                Limpar
              </button>
            </div>
          </form>
          )}
        </DeveloperCard>

        <DeveloperCard className="self-start p-5">
          <DeveloperSectionHeading
            eyebrow="Acessos cadastrados"
            title="Usuários do painel"
            description="Lista de contas persistidas no storage privado de usuários."
            tooltip="Lista de usuários internos autorizados no CMS, com status e função de acesso."
          />

          <div className="space-y-2">
            {users.length > 0 ? (
              (userPages[usersPage] ?? []).map((user) => {
                const editingThis = editingId === user.id;
                const locked = Boolean(user.protected || !isSupreme);
                const canConfigurePermissions = isSupreme && !user.protected && user.role === "admin";
                return (
                <article
                  key={user.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                >
                  <div className="grid gap-2.5 lg:grid-cols-[minmax(280px,1fr)_auto_auto] lg:items-center">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                        {user.role === "admin" ? (
                          <ShieldCheck size={20} weight="duotone" />
                        ) : (
                          <IdentificationBadge size={20} weight="duotone" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                          {user.name || "Usuário sem nome"}
                        </h3>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-[var(--color-muted-raw)]">
                          <span className="truncate">{user.email}</span>
                          <span className="hidden text-slate-300 sm:inline" aria-hidden="true">•</span>
                          <span className="text-xs whitespace-nowrap">Criado em {formatDate(user.createdAt)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                      {user.passwordResetRequestedAt ? (
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                          Redefinição solicitada
                        </span>
                      ) : null}
                      {user.protected ? (
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                          Supremo
                        </span>
                      ) : null}
                      <span
                        className={`inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                          user.active
                            ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-500"
                        }`}
                      >
                        {user.active ? <CheckCircle size={13} weight="fill" /> : <X size={13} weight="bold" />}
                        {user.active ? "Ativo" : "Inativo"}
                      </span>
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--primary)]/10 bg-[var(--primary)]/[0.08] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--primary)]">
                        {user.role === "admin" ? <ShieldCheck size={13} weight="fill" /> : <IdentificationBadge size={13} weight="fill" />}
                        {user.role === "admin" ? "Admin" : "Usuário"}
                      </span>
                      {canConfigurePermissions ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setPermissionsMenuId((current) => current === user.id ? "" : user.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-[0_4px_10px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-[var(--primary)]/25 hover:bg-[var(--primary)]/[0.06] hover:text-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/10"
                            aria-label={`Gerenciar permissões de ${user.name || user.email}`}
                            title="Gerenciar permissões"
                          >
                            <DotsThreeVertical size={18} weight="bold" />
                          </button>
                          {permissionsMenuId === user.id ? (
                            <div className="absolute right-0 z-20 mt-3 w-[min(23rem,calc(100vw-3rem))] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_20px_45px_rgba(15,23,42,0.16)] ring-1 ring-slate-950/[0.03] sm:p-5">
                              <div className="flex items-start gap-3">
                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                                  <ShieldCheck size={20} weight="duotone" />
                                </span>
                                <div>
                                  <p className="text-sm font-bold text-[var(--foreground)]">Permissões de usuários</p>
                                  <p className="mt-1 text-xs leading-5 text-[var(--color-muted-raw)]">Defina o que este administrador pode fazer com outras contas.</p>
                                </div>
                              </div>
                              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                              {([
                                ["createUsers", "Criar usuários"],
                                ["deleteUsers", "Excluir usuários"],
                              ] as const).map(([permission, label]) => (
                                <label key={permission} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/20 hover:bg-[var(--primary)]/[0.045]">
                                  <input
                                    type="checkbox"
                                    checked={user.permissions?.includes(permission) ?? false}
                                    disabled={mutatingId === user.id}
                                    onChange={(event) => void updatePermissions(user, permission, event.target.checked)}
                                    className="h-4 w-4 accent-[var(--primary)]"
                                  />
                                  {label}
                                </label>
                              ))}
                              </div>
                              <p className="mt-4 text-xs leading-5 text-[var(--color-muted-raw)]">Somente o administrador supremo pode alterar essas permissões.</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                      {editingThis ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveUser(user)}
                            disabled={mutatingId === user.id}
                            className={developerPrimaryButtonClassName}
                          >
                            <CheckCircle size={16} weight="bold" />
                            {mutatingId === user.id ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId("");
                              setEditing({});
                            }}
                            className={developerSecondaryButtonClassName}
                          >
                            <X size={16} weight="bold" />
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => beginEdit(user)}
                            disabled={locked}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                            title={locked ? "Edição restrita ao usuário supremo." : "Editar usuário"}
                          >
                            <PencilSimple size={16} weight="bold" />
                            <span className="sr-only">Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResettingId((current) => current === user.id ? "" : user.id);
                              setTemporaryPassword("");
                              setConfirmTemporaryPassword("");
                            }}
                            disabled={!isSupreme || user.protected}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                            title={user.protected ? "A conta suprema não recebe senha temporária." : !isSupreme ? "Ação restrita ao usuário supremo." : "Definir senha temporária"}
                          >
                            <Key size={16} weight="bold" />
                            <span className="sr-only">Redefinir senha</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeUser(user)}
                            disabled={user.protected || !canDeleteUsers || mutatingId === user.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            title={
                              user.protected
                                ? "O usuário supremo não pode ser excluído."
                                : !canDeleteUsers
                                  ? "Sua conta não tem permissão para excluir usuários."
                                  : "Excluir usuário"
                            }
                          >
                            <Trash size={16} weight="bold" />
                            <span className="sr-only">Excluir</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingThis ? (
                  <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white/82 p-3 lg:grid-cols-2">
                      <DeveloperField label="Nome" required>
                        <input
                          value={String(editing.name ?? "")}
                          onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))}
                          maxLength={80}
                          required
                          className={developerInputClassName}
                        />
                      </DeveloperField>
                      <DeveloperField label="E-mail" required>
                        <input
                          type="email"
                          value={String(editing.email ?? "")}
                          onChange={(event) => setEditing((current) => ({ ...current, email: event.target.value }))}
                          maxLength={160}
                          required
                          className={developerInputClassName}
                        />
                      </DeveloperField>
                      <DeveloperField label="Perfil">
                        <select
                          value={(editing.role as AdminUser["role"]) ?? user.role}
                          disabled={user.protected}
                          onChange={(event) => setEditing((current) => ({ ...current, role: event.target.value as AdminUser["role"] }))}
                          className={developerInputClassName}
                        >
                          <option value="admin">Administrador</option>
                          <option value="user">Usuário</option>
                        </select>
                      </DeveloperField>
                      <label className="flex min-h-10 items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={Boolean(editing.active ?? user.active)}
                          disabled={user.protected}
                          onChange={(event) => setEditing((current) => ({ ...current, active: event.target.checked }))}
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        Usuário ativo
                      </label>
                    </div>
                  ) : null}

                  {resettingId === user.id ? (
                    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                      <p className="text-xs font-semibold text-[var(--foreground)]">Definir senha temporária</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-muted-raw)]">A pessoa deverá trocar esta senha no próximo acesso.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} autoComplete="new-password" placeholder="Senha temporária" maxLength={72} className={developerInputClassName} />
                        <input type="password" value={confirmTemporaryPassword} onChange={(event) => setConfirmTemporaryPassword(event.target.value)} autoComplete="new-password" placeholder="Confirmar senha" maxLength={72} className={developerInputClassName} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void resetUserPassword(user)} disabled={mutatingId === user.id} className={developerPrimaryButtonClassName}>
                          <Key size={16} weight="bold" />
                          {mutatingId === user.id ? "Redefinindo..." : "Salvar senha temporária"}
                        </button>
                        <button type="button" onClick={() => { setResettingId(""); setTemporaryPassword(""); setConfirmTemporaryPassword(""); }} className={developerSecondaryButtonClassName}>Cancelar</button>
                      </div>
                    </div>
                  ) : null}

                </article>
                );
              })
            ) : (
              <DeveloperMessage tone="info">
                Nenhum usuário encontrado no storage atual.
              </DeveloperMessage>
            )}
          </div>

          {users.length > 0 ? (
            <DeveloperCarouselPagination
              currentPage={usersPage}
              totalPages={usersTotalPages}
              onNext={nextUsersPage}
              onPrev={prevUsersPage}
              compact
              alwaysVisible
            />
          ) : null}

          <div className="mt-4 rounded-[18px] border border-[#bfdbfe] bg-[#eff6ff]/72 p-4">
            <div className="flex items-start gap-3">
              <UsersThree
                size={22}
                weight="duotone"
                className="mt-0.5 shrink-0 text-[var(--primary)]"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Política atual
                </p>
                <p className="mt-1 text-sm leading-7 text-[var(--color-muted-raw)]">
                  O usuário supremo tem acesso total e é o único autorizado a criar,
                  editar, excluir ou alterar perfis. Essa conta não pode ser excluída,
                  desativada nem rebaixada.
                </p>
              </div>
            </div>
          </div>
        </DeveloperCard>
      </section>
    </DeveloperPage>
  );
}
