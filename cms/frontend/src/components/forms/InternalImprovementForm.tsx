"use client";

import { useDeveloperNotifier } from "@/components/developer/DeveloperNotifications";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FileArrowUp, PaperPlaneTilt, X } from "@phosphor-icons/react";
import { DeveloperField, developerInputClassName } from "@/components/developer/ui";
import { useApiRequest } from "@/hooks/useApiRequest";
import { useSession } from "@/hooks/useSession";
import { api } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface InternalImprovementFormProps {
  endpoint?: string;
  onSubmitted?: () => void;
}

interface UserSuggestion {
  name?: string;
  email: string;
}

const categories = [
  ["process", "Melhoria de processo"],
  ["automation", "Automação"],
  ["system", "Sistema ou ferramenta"],
  ["operation", "Operação"],
  ["safety", "Segurança"],
  ["other", "Outro"],
] as const;

const acceptedFiles = "image/png,image/jpeg,image/webp,image/avif,.csv,.xls,.xlsx";
const maxAttachments = 5;
const maxAttachmentSize = 8 * 1024 * 1024;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

/** Fluxo administrativo: registra apenas sugestões internas de colaboradores autenticados. */
export default function InternalImprovementForm({
  endpoint = api.admin.improvements,
  onSubmitted,
}: InternalImprovementFormProps) {
  const { apiRequest } = useApiRequest();
  const { session } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState<UserSuggestion[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const notify = useDeveloperNotifier();

  useEffect(() => {
    setName((current) => current || session?.user?.name || "");
    setEmail((current) => current || session?.user?.email || "");
  }, [session?.user?.email, session?.user?.name]);

  useEffect(() => {
    let active = true;

    void apiRequest<{ users?: UserSuggestion[] }>(api.admin.users).then((response) => {
      if (active && response.success) setUsers(response.data?.users ?? []);
    });

    return () => {
      active = false;
    };
  }, [apiRequest]);

  function updateKnownUser(value: string, field: "name" | "email") {
    const candidate = users.find((user) => normalize(field === "name" ? user.name ?? "" : user.email) === normalize(value));
    if (field === "name") setName(value);
    else setEmail(value);
    if (!candidate) return;
    if (field === "name") setEmail(candidate.email);
    else setName(candidate.name ?? "");
  }

  function selectAttachments(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList);
    const oversizedFile = files.find((file) => file.size > maxAttachmentSize);
    if (oversizedFile) {
      notify({ tone: "error", text: `O arquivo ${oversizedFile.name} ultrapassa o limite de 8 MB.` });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setAttachments((current) => [...current, ...files].slice(0, maxAttachments));
    notify(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    payload.set("profile", "employee");
    attachments.forEach((attachment) => payload.append("attachments", attachment));

    setSaving(true);
    notify(null);

    const response = await apiRequest<{ message?: string }>(endpoint, {
      method: "POST",
      body: payload,
    });

    setSaving(false);
    if (!response.success) {
      notify({ tone: "error", text: response.error ?? "Não foi possível registrar a sugestão interna." });
      return;
    }

    form.reset();
    setAttachments([]);
    setName(session?.user?.name ?? "");
    setEmail(session?.user?.email ?? "");
    notify({ tone: "success", text: response.data?.message ?? "Sugestão interna registrada para triagem." });
    onSubmitted?.();
  }

  return (
    <form className="space-y-5 pt-1" onSubmit={(event) => void submit(event)} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <DeveloperField label="Nome" required hint="Identifica quem registrou a sugestão para a equipe responsável.">
          <input
            name="name"
            required
            autoComplete="name"
            list="internal-improvement-names"
            value={name}
            onChange={(event) => updateKnownUser(event.target.value, "name")}
            className={developerInputClassName}
            placeholder="Seu nome"
          />
        </DeveloperField>
        <DeveloperField label="E-mail" required hint="Usado apenas para identificar e acompanhar o registro interno.">
          <input
            name="email"
            required
            type="email"
            autoComplete="email"
            list="internal-improvement-emails"
            value={email}
            onChange={(event) => updateKnownUser(event.target.value, "email")}
            className={developerInputClassName}
            placeholder="voce@empresa.com"
          />
        </DeveloperField>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <DeveloperField label="Área" hint="Ex.: Operação, Comercial ou Tecnologia.">
            <input name="area" className={developerInputClassName} placeholder="Área responsável ou envolvida" />
          </DeveloperField>
          <DeveloperField label="Tipo de melhoria" required>
            <select name="category" required defaultValue="" className={developerInputClassName}>
              <option value="" disabled>Selecione uma opção</option>
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </DeveloperField>
        </div>
        <DeveloperField label="Contexto e impacto" required hint="Descreva como é feito hoje, a dificuldade e por que vale a pena melhorar.">
          <textarea
            name="message"
            required
            minLength={10}
            rows={6}
            className={cn(developerInputClassName, "min-h-[172px] resize-y")}
            placeholder="Explique o cenário, as pessoas ou etapas afetadas e o impacto observado."
          />
        </DeveloperField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DeveloperField label="Resultado esperado" hint="Como seria a solução ou ganho ideal?">
          <input name="expectedResult" className={developerInputClassName} placeholder="Ex.: reduzir etapas manuais" />
        </DeveloperField>
        <DeveloperField label="Onde será aplicado" hint="Ex.: rotina de coleta, portal ou atendimento.">
          <input name="applicationPlace" className={developerInputClassName} placeholder="Local, processo ou ferramenta" />
        </DeveloperField>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-slate-50/75 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm leading-6 text-[var(--color-muted-raw)]">
            <span className="font-semibold text-[var(--foreground)]">Anexos opcionais.</span> Fotos, CSV, XLS ou XLSX; até {maxAttachments} arquivos de 8 MB.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold text-[var(--foreground)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <FileArrowUp size={16} weight="bold" />Adicionar arquivos
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={acceptedFiles}
            multiple
            className="sr-only"
            onChange={(event) => selectAttachments(event.target.files)}
          />
        </div>
        {attachments.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <li key={`${attachment.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm">
                <span className="truncate">{attachment.name}</span>
                <button
                  type="button"
                  aria-label={`Remover ${attachment.name}`}
                  onClick={() => setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                  className="text-slate-500 transition hover:text-red-600"
                >
                  <X size={14} weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex justify-end border-t border-[var(--border)] pt-4">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PaperPlaneTilt size={17} weight="bold" />{saving ? "Registrando..." : "Registrar sugestão"}
        </button>
      </div>

      <datalist id="internal-improvement-names">
        {users.filter((user) => user.name).map((user) => <option key={user.email} value={user.name} />)}
      </datalist>
      <datalist id="internal-improvement-emails">
        {users.map((user) => <option key={user.email} value={user.email} />)}
      </datalist>
    </form>
  );
}
