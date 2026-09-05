"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LockKey, Moon, ShieldCheck, Sun, TrendUp } from "@phosphor-icons/react";
import { useSession } from "@/hooks/useSession";
import { admin, api, auth, cmsHref, external, normalizeCmsPathname, site } from "@/lib/routes";
import type { CmsTheme, User } from "@/types/auth";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

type FormValues = z.infer<typeof schema>;
type LoginResponse = {
  user?: Pick<User, "cmsTheme" | "passwordChangeRequired">;
  csrfToken?: string;
  error?: string;
};

const LOGIN_THEME_STORAGE_PREFIX = "rodogarcia.cms.login-theme.";

function resolveAdminNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return admin.root;
  const logicalPath = normalizeCmsPathname(value);
  return logicalPath === admin.root || logicalPath.startsWith(admin.prefix) ? logicalPath : admin.root;
}

function getStoredTheme(email: string): CmsTheme | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;
  const stored = window.localStorage.getItem(`${LOGIN_THEME_STORAGE_PREFIX}${normalizedEmail}`);
  return stored === "dark" || stored === "light" ? stored : null;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const { session, loading } = useSession();
  const nextPath = resolveAdminNextPath(searchParams.get("next"));
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [theme, setTheme] = useState<CmsTheme>("dark");
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const email = watch("email", "");
  const darkTheme = theme === "dark";

  useEffect(() => {
    const storedTheme = getStoredTheme(email);
    if (storedTheme) setTheme(storedTheme);
  }, [email]);

  useEffect(() => {
    if (!loading && session?.authenticated) {
      window.location.href = cmsHref(session.user?.passwordChangeRequired ? auth.changePassword : nextPath);
    }
  }, [loading, nextPath, session?.authenticated, session?.user?.passwordChangeRequired]);

  async function persistInitialTheme(selectedTheme: CmsTheme, response: LoginResponse) {
    if (response.user?.cmsTheme || !response.csrfToken) return;
    await fetch(api.auth.cmsTheme, {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": response.csrfToken,
      },
      body: JSON.stringify({ theme: selectedTheme }),
    });
  }

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    setServerError("");

    try {
      const res = await fetch(api.auth.login, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as LoginResponse;
      if (!res.ok) {
        setServerError(data.error ?? "Credenciais inválidas.");
        setIsLoading(false);
        return;
      }

      const accountTheme = data.user?.cmsTheme ?? theme;
      window.localStorage.setItem(`${LOGIN_THEME_STORAGE_PREFIX}${values.email.trim().toLowerCase()}`, accountTheme);
      await persistInitialTheme(accountTheme, data);

      if (data.user?.passwordChangeRequired) {
        window.location.href = cmsHref(auth.changePassword);
        return;
      }
      window.location.href = cmsHref(nextPath);
    } catch {
      setServerError("Erro de conexão. Tente novamente.");
      setIsLoading(false);
    }
  }

  async function submitPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    setResetError("");
    setResetMessage("");
    if (!resetEmail.trim()) {
      setResetError("Informe seu e-mail para solicitar a redefinição.");
      return;
    }
    setResetLoading(true);
    try {
      const response = await fetch(api.auth.passwordResetRequest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setResetError(data.error ?? "Não foi possível enviar a solicitação agora.");
        return;
      }
      setResetMessage(data.message ?? "Solicitação enviada ao administrador.");
    } catch {
      setResetError("Erro de conexão. Tente novamente.");
    } finally {
      setResetLoading(false);
    }
  }

  const inputClass = (hasError: boolean) => [
    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors duration-200",
    darkTheme
      ? "border-white/10 bg-white/[0.055] text-white placeholder:text-slate-500 focus:border-sky-400/55 focus:bg-white/[0.08] focus:ring-4 focus:ring-sky-400/10"
      : "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10",
    hasError ? "border-red-400/80 focus:border-red-400 focus:ring-red-400/10" : "",
  ].join(" ");

  return (
    <main
      data-login-theme={theme}
      className={`relative isolate min-h-screen overflow-hidden px-4 py-5 transition-colors duration-500 sm:px-6 ${darkTheme ? "bg-[#080f20] text-white" : "bg-slate-100 text-slate-950"}`}
    >
      <div className={`pointer-events-none absolute transition-opacity duration-500 ${darkTheme ? "-inset-3 blur-[2px] opacity-100" : "inset-0 opacity-40"}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(30,82,201,0.27),transparent_32%),radial-gradient(circle_at_84%_88%,rgba(14,165,233,0.13),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:36px_36px]" />
      </div>

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 py-2 sm:py-3">
        <a href={site.home} className="group flex items-center gap-3" aria-label="Voltar à página inicial">
          <img
            src="/logo.svg"
            alt="Rodogarcia"
            width={156}
            height={30}
            className={`h-auto w-[136px] transition duration-300 group-hover:opacity-80 sm:w-[156px] ${darkTheme ? "brightness-0 invert" : ""}`}
          />
          <span className={`hidden h-5 w-px sm:block ${darkTheme ? "bg-white/20" : "bg-slate-300"}`} />
          <span className={`hidden text-[10px] font-semibold uppercase tracking-[0.16em] sm:block ${darkTheme ? "text-sky-200" : "text-slate-500"}`}>CMS interno</span>
        </a>
        <button
          type="button"
          onClick={() => setTheme(darkTheme ? "light" : "dark")}
          aria-label={darkTheme ? "Ativar modo claro" : "Ativar modo noturno"}
          title={darkTheme ? "Ativar modo claro" : "Ativar modo noturno"}
          className={`cms-theme-toggle inline-flex h-11 w-11 items-center justify-center rounded-full border ${darkTheme ? "cms-theme-toggle--dark border-white/10 bg-white/5 !text-amber-200" : "border-slate-200 bg-white text-blue-600 shadow-sm"}`}
        >
          <span key={theme} className="cms-theme-toggle__icon">
            {darkTheme ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
          </span>
        </button>
      </header>

      <section className="relative mx-auto flex min-h-[calc(100vh-144px)] w-full max-w-4xl items-center justify-center py-10">
        <div className="grid w-full max-w-[860px] overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_80px_rgba(4,10,26,0.24)] md:grid-cols-[minmax(0,1.08fr)_minmax(280px,.72fr)]">
          <div className={`p-6 sm:p-8 ${darkTheme ? "bg-[#101a2c]/95" : "bg-white/95"}`}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${darkTheme ? "bg-blue-500/12 text-sky-300" : "bg-blue-50 text-blue-600"}`}><LockKey size={17} weight="bold" /></span>
              <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${darkTheme ? "text-sky-300" : "text-blue-600"}`}>Acesso restrito</span>
            </div>
            <h1 className="mt-6 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">Entrar no painel</h1>
            <p className={`mt-2 max-w-md text-sm leading-6 ${darkTheme ? "text-slate-300" : "text-slate-600"}`}>Use suas credenciais para administrar o conteúdo e acompanhar os indicadores do site.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.17em] ${darkTheme ? "text-slate-300" : "text-slate-600"}`}>E-mail</label>
                <input {...register("email")} id="email" type="email" autoComplete="username" placeholder="seu@rodogarcia.com.br" className={inputClass(Boolean(errors.email))} />
                {errors.email ? <p className="mt-1.5 text-xs font-medium text-red-500">{errors.email.message}</p> : null}
              </div>
              <div>
                <label htmlFor="password" className={`mb-2 block text-[10px] font-bold uppercase tracking-[0.17em] ${darkTheme ? "text-slate-300" : "text-slate-600"}`}>Senha</label>
                <input {...register("password")} id="password" type="password" autoComplete="current-password" placeholder="••••••••" className={inputClass(Boolean(errors.password))} />
                {errors.password ? <p className="mt-1.5 text-xs font-medium text-red-500">{errors.password.message}</p> : null}
              </div>
              {serverError ? <p role="alert" className={`rounded-xl border px-3 py-2.5 text-sm ${darkTheme ? "border-red-400/25 bg-red-400/10 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>{serverError}</p> : null}
              <button type="submit" disabled={isLoading} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.25)] transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:bg-blue-500 hover:shadow-[0_18px_34px_rgba(37,99,235,0.34)] disabled:cursor-not-allowed disabled:opacity-65">
                {isLoading ? "Entrando..." : "Acessar CMS"}
              </button>
            </form>
            <div className={`mt-4 text-center text-xs ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordReset((current) => !current);
                  setResetEmail((current) => current || email);
                  setResetError("");
                  setResetMessage("");
                }}
                className="font-medium transition-colors hover:text-blue-500"
              >
                Solicitar redefinição de senha
              </button>
            </div>
            {showPasswordReset ? (
              <form onSubmit={submitPasswordReset} className={`mt-3 rounded-xl border p-3 text-left ${darkTheme ? "border-white/10 bg-white/[0.035]" : "border-slate-200 bg-slate-50"}`}>
                <label htmlFor="reset-email" className={`block text-[10px] font-bold uppercase tracking-[0.15em] ${darkTheme ? "text-slate-300" : "text-slate-600"}`}>E-mail de acesso</label>
                <div className="mt-2 flex gap-2">
                  <input id="reset-email" type="email" autoComplete="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="seu@rodogarcia.com.br" className={inputClass(Boolean(resetError))} />
                  <button type="submit" disabled={resetLoading} className="shrink-0 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60">{resetLoading ? "..." : "Enviar"}</button>
                </div>
                {resetError ? <p role="alert" className="mt-2 text-xs font-medium text-red-500">{resetError}</p> : null}
                {resetMessage ? <p className={`mt-2 text-xs leading-5 ${darkTheme ? "text-emerald-300" : "text-emerald-700"}`}>{resetMessage}</p> : null}
              </form>
            ) : null}
            <div className={`mt-6 border-t pt-5 text-xs ${darkTheme ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-500"}`}>
              <a href={site.home} className="transition-colors hover:text-blue-500">← Voltar ao site</a>
            </div>
          </div>

          <aside className={`relative hidden overflow-hidden p-8 md:block ${darkTheme ? "bg-[#0b1425]" : "bg-slate-50"}`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(37,99,235,0.25),transparent_44%)]" />
            <div className="relative">
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${darkTheme ? "bg-blue-500/15 text-sky-300" : "bg-blue-100 text-blue-600"}`}><TrendUp size={22} weight="bold" /></span>
              <p className={`mt-8 text-[10px] font-bold uppercase tracking-[0.18em] ${darkTheme ? "text-sky-300" : "text-blue-600"}`}>Painel Rodogarcia</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight tracking-[-0.04em]">Conteúdo e indicadores em um só lugar.</h2>
              <p className={`mt-4 text-sm leading-6 ${darkTheme ? "text-slate-300" : "text-slate-600"}`}>Sua aparência preferida é mantida para cada usuário após o acesso.</p>
              <div className={`mt-8 border-t pt-5 ${darkTheme ? "border-white/10" : "border-slate-200"}`}>
                <div className="flex gap-2.5">
                  <ShieldCheck size={18} weight="bold" className={darkTheme ? "text-sky-300" : "text-blue-600"} />
                  <div><p className="text-xs font-semibold">Acesso seguro</p><p className={`mt-1 text-xs leading-5 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>As permissões são aplicadas conforme a sua conta.</p></div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
      <footer className={`relative mx-auto flex w-full max-w-6xl justify-center pb-3 text-center text-[11px] ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
        <p>
          Desenvolvido por{" "}
          <a
            href={external.developerProfile}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-500 transition-colors hover:text-blue-400"
          >
            @valentelucass
          </a>{" "}
          • Suporte: lucasmac.dev@gmail.com
        </p>
      </footer>
    </main>
  );
}

export default function EntrarPage() {
  return <Suspense><LoginForm /></Suspense>;
}
