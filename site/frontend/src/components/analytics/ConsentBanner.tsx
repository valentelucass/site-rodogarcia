"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const CONSENT_KEY = "rg_analytics_consent";
const CATEGORIES_PER_PAGE = 3;
export const OPEN_CONSENT_PREFERENCES_EVENT = "rg:open-consent-preferences";

export interface ConsentCategory {
  key: string;
  label: string;
  description: string;
  required: boolean;
  enabledByDefault: boolean;
}

export interface ConsentSettings {
  enabled: boolean;
  version: number;
  title: string;
  description: string;
  acceptAllLabel: string;
  rejectLabel: string;
  preferencesLabel: string;
  saveLabel: string;
  desktop?: { position?: string; compact?: boolean };
  mobile?: { position?: string; compact?: boolean };
  behavior?: {
    requireExplicitChoice?: boolean;
    blockAnalyticsUntilConsent?: boolean;
    reopenOnVersionChange?: boolean;
  };
  categories: ConsentCategory[];
}

export interface StoredConsent {
  version: number;
  decision: "accepted" | "rejected" | "custom";
  categories: Record<string, boolean>;
}

export function getStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (
      !Number.isInteger(record.version) ||
      !["accepted", "rejected", "custom"].includes(String(record.decision)) ||
      !record.categories ||
      typeof record.categories !== "object" ||
      Array.isArray(record.categories)
    ) {
      return null;
    }
    const categories = Object.fromEntries(
      Object.entries(record.categories as Record<string, unknown>).flatMap(([key, category]) =>
        key.length > 0 && key.length <= 40 && typeof category === "boolean"
          ? [[key, category] as [string, boolean]]
          : []
      )
    );
    return {
      version: record.version as number,
      decision: record.decision as StoredConsent["decision"],
      categories,
    };
  } catch {
    return null;
  }
}

export function setStoredConsent(value: StoredConsent) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function clearOptionalCookie(name: string) {
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  const hostParts = window.location.hostname.split(".");
  const domains = [
    window.location.hostname,
    hostParts.length > 1 ? `.${hostParts.slice(-2).join(".")}` : "",
  ].filter(Boolean);

  document.cookie = `${name}=; expires=${expires}; path=/; SameSite=Lax`;
  for (const domain of domains) {
    document.cookie = `${name}=; expires=${expires}; path=/; domain=${domain}; SameSite=Lax`;
  }
}

export function clearOptionalConsentStorage() {
  if (typeof window === "undefined") return;
  const cookieNames = document.cookie
    .split(";")
    .map((item) => item.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name))
    .filter((name) => /^(_ga|_gid|_gat|_gcl|_clck|_clsk|fbp|fr)/i.test(name));

  cookieNames.forEach(clearOptionalCookie);

  try {
    sessionStorage.removeItem("rg_analytics_session_id");
    sessionStorage.removeItem("rg_popup_session_id");
    sessionStorage.removeItem("rg_exit_popup_shows_in_session");
    localStorage.removeItem("rg_exit_popup_last_shown_at");
    localStorage.removeItem("rg_exit_popup_submitted_at");
  } catch {
    /* ignore */
  }
}

interface ConsentBannerProps {
  settings: ConsentSettings;
  onConsent: (value: StoredConsent) => void;
}

export default function ConsentBanner({ settings, onConsent }: ConsentBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesPage, setPreferencesPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const acceptAllRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const defaultCategories = useMemo(() => {
    return Object.fromEntries(
      settings.categories.map((category) => [
        category.key,
        category.required || category.enabledByDefault,
      ])
    );
  }, [settings.categories]);

  const rejectedCategories = useMemo(
    () =>
      Object.fromEntries(settings.categories.map((category) => [category.key, category.required])),
    [settings.categories]
  );
  const isConsentPreview =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("consent-preview");
  const preferencesPageCount = Math.max(1, Math.ceil(settings.categories.length / CATEGORIES_PER_PAGE));
  const visibleCategories = settings.categories.slice(
    preferencesPage * CATEGORIES_PER_PAGE,
    (preferencesPage + 1) * CATEGORIES_PER_PAGE
  );
  const mobilePositionClass =
    settings.mobile?.position === "center-modal"
      ? "max-sm:bottom-auto max-sm:top-1/2 max-sm:-translate-y-1/2"
      : "";

  useFocusTrap({
    active: visible && settings.enabled,
    containerRef: dialogRef,
    initialFocusRef: acceptAllRef,
    onEscape: settings.behavior?.requireExplicitChoice
      ? undefined
      : () => decide("rejected", rejectedCategories),
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const stored = getStoredConsent();
    setSelected(stored?.categories ?? defaultCategories);
    if (!settings.enabled) return;
    const shouldReopenForVersion =
      settings.behavior?.reopenOnVersionChange !== false &&
      stored?.version !== settings.version;
    if (isConsentPreview || !stored || shouldReopenForVersion) {
      setClosing(false);
      setVisible(true);
    }
  }, [
    defaultCategories,
    isConsentPreview,
    settings.behavior?.reopenOnVersionChange,
    settings.enabled,
    settings.version,
  ]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    function openPreferences() {
      if (!settings.enabled) return;
      const stored = getStoredConsent();
      setClosing(false);
      setPreferencesOpen(true);
      setPreferencesPage(0);
      setSelected(stored?.categories ?? defaultCategories);
      setVisible(true);
    }

    window.addEventListener(OPEN_CONSENT_PREFERENCES_EVENT, openPreferences);
    return () => window.removeEventListener(OPEN_CONSENT_PREFERENCES_EVENT, openPreferences);
  }, [defaultCategories, settings.enabled]);

  function decide(decision: StoredConsent["decision"], categories: Record<string, boolean>) {
    const normalized = {
      ...categories,
      ...Object.fromEntries(
        settings.categories.filter((category) => category.required).map((category) => [category.key, true])
      ),
    };
    const value = { version: settings.version, decision, categories: normalized };
    setStoredConsent(value);
    if (decision === "rejected" || normalized.analytics === false || normalized.marketing === false) {
      clearOptionalConsentStorage();
    }
    onConsent(value);
    window.dispatchEvent(new CustomEvent("rg:consent-updated", { detail: value }));
    if (isConsentPreview) {
      setPreferencesOpen(false);
      setPreferencesPage(0);
      return;
    }
    setClosing(true);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = window.setTimeout(
      () => {
        setVisible(false);
        setClosing(false);
      },
      shouldReduceMotion ? 0 : 180
    );
  }

  if (!mounted) {
    return null;
  }

  if (!visible || !settings.enabled) {
    return null;
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      className={
        preferencesOpen
          ? "fixed inset-0 z-[9998] grid place-items-center bg-slate-950/40 p-3 backdrop-blur-sm"
          : [
              "fixed inset-x-3 bottom-4 z-[9998] mx-auto max-w-[720px] overflow-hidden rounded-[22px]",
              "border border-[var(--border)] bg-[var(--color-surface-strong)] p-4 shadow-[0_18px_46px_rgba(2,6,23,0.14)]",
              "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:p-5",
              mobilePositionClass,
              closing ? "translate-y-3 scale-[0.98] opacity-0" : "translate-y-0 scale-100 opacity-100",
            ].join(" ")
      }
    >
      <div
        className={
          preferencesOpen
            ? "w-full max-w-[680px] overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--color-surface-strong)] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.3)] sm:p-5"
            : "contents"
        }
      >
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p id={titleId} className="text-sm font-extrabold tracking-[-0.01em] text-[var(--foreground)] sm:text-base">
            {settings.title}
          </p>
          <p id={descriptionId} className="mt-1.5 text-xs leading-5 text-slate-700 sm:text-[13px] sm:leading-6">
            {settings.description}
          </p>
        </div>
      </div>

      {preferencesOpen ? (
        <div className="relative mt-4">
          <div className="grid gap-2.5">
          {visibleCategories.map((category) => (
            <label
              key={category.key}
              className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--color-surface-2)] px-3.5 py-3 text-sm transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-strong)]"
            >
              <input
                type="checkbox"
                checked={Boolean(selected[category.key])}
                disabled={category.required}
                onChange={(event) =>
                  setSelected((current) => ({
                    ...current,
                    [category.key]: event.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 accent-[var(--primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20"
              />
              <span>
                <span className="block font-semibold text-[var(--foreground)]">{category.label}</span>
                <span className="block text-xs leading-5 text-slate-700">
                  {category.description}
                </span>
              </span>
            </label>
          ))}
          </div>
          {preferencesPageCount > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
              <p className="text-xs font-semibold text-[var(--color-muted-raw)]">
                Categorias {preferencesPage * CATEGORIES_PER_PAGE + 1}-{Math.min((preferencesPage + 1) * CATEGORIES_PER_PAGE, settings.categories.length)} de {settings.categories.length}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPreferencesPage((page) => Math.max(0, page - 1))} disabled={preferencesPage === 0} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-bold disabled:opacity-40">
                  Anterior
                </button>
                <button type="button" onClick={() => setPreferencesPage((page) => Math.min(preferencesPageCount - 1, page + 1))} disabled={preferencesPage === preferencesPageCount - 1} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-bold disabled:opacity-40">
                  Próxima
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
        <button
          ref={acceptAllRef}
          type="button"
          onClick={() =>
            decide(
              "accepted",
              Object.fromEntries(settings.categories.map((category) => [category.key, true]))
            )
          }
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-extrabold text-white shadow-[0_10px_22px_rgba(29,78,216,0.22)] transition-[background-color,box-shadow] duration-200 hover:bg-[var(--color-primary-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 motion-reduce:transition-none sm:order-3"
        >
          {settings.acceptAllLabel}
        </button>
        <button
          type="button"
          onClick={() => decide("rejected", rejectedCategories)}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--color-surface-strong)] px-5 py-2.5 text-xs font-bold text-[var(--color-foreground-soft)] transition-colors duration-200 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 sm:order-1"
        >
          {settings.rejectLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            if (preferencesOpen) {
              decide("custom", selected);
              return;
            }
            setPreferencesPage(0);
            setPreferencesOpen(true);
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--color-surface-strong)] px-5 py-2.5 text-xs font-bold text-[var(--color-foreground-soft)] transition-colors duration-200 hover:border-[var(--primary)]/24 hover:bg-[var(--color-primary-soft)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 sm:order-2"
        >
          {preferencesOpen ? settings.saveLabel : settings.preferencesLabel}
        </button>
      </div>
      </div>
    </div>
  );
}
