"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "@phosphor-icons/react";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { api } from "@/lib/routes";
import { mediaObjectPosition } from "@/lib/mediaPresentation";
import { getStoredConsent, type StoredConsent } from "@/components/analytics/ConsentBanner";
import { DEFAULT_POPUP_CONFIG, type PopupConfig } from "@shared/lib/popupDefaults";

const DEFAULT_CONFIG: PopupConfig = DEFAULT_POPUP_CONFIG;

const STORAGE = {
  lastShownAt: "rg_exit_popup_last_shown_at",
  submittedAt: "rg_exit_popup_submitted_at",
};
const SESSION_SHOWS = "rg_exit_popup_shows_in_session";
const POPUP_SESSION_KEY = "rg_popup_session_id";

function readLocal(key: string): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
function writeLocal(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}
function getSessionShows(): number {
  try {
    return Number(sessionStorage.getItem(SESSION_SHOWS)) || 0;
  } catch {
    return 0;
  }
}
function incSessionShows() {
  try {
    sessionStorage.setItem(SESSION_SHOWS, String(getSessionShows() + 1));
  } catch {
    /* ignore */
  }
}
function clearFrequency() {
  try {
    localStorage.removeItem(STORAGE.lastShownAt);
    localStorage.removeItem(STORAGE.submittedAt);
    sessionStorage.removeItem(SESSION_SHOWS);
  } catch {
    /* ignore */
  }
}

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  const previewViewport = new URLSearchParams(window.location.search).get("viewport");
  if (previewViewport === "mobile") return true;
  if (previewViewport === "desktop" || previewViewport === "tablet") return false;
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  return touch && narrow;
}

function isMobilePopupLayout() {
  if (typeof window === "undefined") return false;
  const previewViewport = new URLSearchParams(window.location.search).get("viewport");
  if (previewViewport === "mobile") return true;
  if (previewViewport === "desktop" || previewViewport === "tablet") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function isCmsPopupPreview() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("preview") === "cms" && params.get("popup-preview") === "1";
}

function getPopupSessionId() {
  try {
    const existing = sessionStorage.getItem(POPUP_SESSION_KEY);
    if (existing) return existing;
    const id = `popup_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    sessionStorage.setItem(POPUP_SESSION_KEY, id);
    return id;
  } catch {
    return `popup_${Date.now()}`;
  }
}

function trackEvent(name: string, meta: Record<string, unknown> = {}) {
  if (isCmsPopupPreview()) return;
  const payload = JSON.stringify({
    event: name,
    source: "exit-intent-popup",
    pagePath: window.location.pathname,
    sessionId: getPopupSessionId(),
    mobile: isMobileDevice(),
    metadata: meta,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      api.popup.events,
      new Blob([payload], { type: "application/json" })
    );
  } else {
    fetch(api.popup.events, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: payload,
    }).catch(() => {
      /* silent */
    });
  }
}

export default function ExitPopup() {
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [formStatus, setFormStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [mobileLayout, setMobileLayout] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingAllowed, setMarketingAllowed] = useState(false);
  const { maskPhone } = usePhoneMask();

  const hasShown = useRef(false);
  const loadedAt = useRef(Date.now());
  const isMobile = useRef(false);
  const lastDesktopY = useRef<number | null>(null);
  const cameFromBelow = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const closePopup = useCallback((closeType: string) => {
    if (closing) return;
    if (closeType !== "auto_after_submit" && formStatus !== "success") {
      trackEvent("popup_ignored", { closeType });
    }
    trackEvent("popup_closed", { closeType });
    setClosing(true);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = window.setTimeout(
      () => {
        setOpen(false);
        setRendered(false);
        setClosing(false);
      },
      shouldReduceMotion ? 0 : 180
    );
  }, [closing, formStatus]);

  const handleEscape = useCallback(() => closePopup("esc"), [closePopup]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const syncLayout = () => setMobileLayout(isMobilePopupLayout());
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    const syncConsent = (event?: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as StoredConsent | undefined) : undefined;
      const consent = detail ?? getStoredConsent();
      const allowed = consent?.categories.marketing === true;
      setMarketingAllowed(allowed);
      if (!allowed) {
        clearFrequency();
        setOpen(false);
        setRendered(false);
      }
    };
    syncConsent();
    window.addEventListener("rg:consent-updated", syncConsent);
    return () => window.removeEventListener("rg:consent-updated", syncConsent);
  }, []);

  useFocusTrap({
    active: open && rendered,
    containerRef: dialogRef,
    initialFocusRef: firstFieldRef,
    onEscape: handleEscape,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testMode = params.get("popup_test") === "1";
    const previewMode = isCmsPopupPreview();
    if (!marketingAllowed && !previewMode) return;

    fetch(api.popup.config)
      .then((r) => r.json())
      .then((data) => {
        const raw = (data as { config?: Partial<PopupConfig> }).config ?? {};
        const merged: PopupConfig = {
          ...DEFAULT_CONFIG,
          ...raw,
          desktop: { ...DEFAULT_CONFIG.desktop, ...(raw.desktop ?? {}) },
          mobile: { ...DEFAULT_CONFIG.mobile, ...(raw.mobile ?? {}) },
        };
        if (!merged.enabled && !previewMode) return;
        setConfig(merged);
        if (testMode || previewMode) {
          if (previewMode) {
            hasShown.current = true;
            setTimeout(() => {
              setRendered(true);
              setClosing(false);
              setOpen(true);
            }, 300);
            return;
          }
          clearFrequency();
          setTimeout(() => triggerShow(merged), 900);
        }
      })
      .catch(() => {
        setConfig(null);
      });
  }, [marketingAllowed]); // eslint-disable-line react-hooks/exhaustive-deps

  const shouldShow = useCallback((cfg: PopupConfig) => {
    if (hasShown.current) return false;
    if (Date.now() - loadedAt.current < cfg.delaySeconds * 1000) return false;
    if (getSessionShows() >= cfg.maxShowsPerSession) return false;
    const cooldownMs = cfg.cooldownHours * 3_600_000;
    if (
      readLocal(STORAGE.submittedAt) > 0 &&
      Date.now() - readLocal(STORAGE.submittedAt) < cooldownMs
    )
      return false;
    if (
      readLocal(STORAGE.lastShownAt) > 0 &&
      Date.now() - readLocal(STORAGE.lastShownAt) < cooldownMs
    )
      return false;
    return true;
  }, []);

  const triggerShow = useCallback(
    (cfg: PopupConfig) => {
      if (!shouldShow(cfg)) return;
      hasShown.current = true;
      writeLocal(STORAGE.lastShownAt, Date.now());
      incSessionShows();
      setRendered(true);
      setClosing(false);
      setOpen(true);
      trackEvent("popup_shown", { trigger: "exit_intent" });
    },
    [shouldShow]
  );

  useEffect(() => {
    if (!config) return;
    isMobile.current = isMobileDevice();
    if (isMobile.current) return;

    function onMouseMove(e: MouseEvent) {
      if (e.clientY > 80) cameFromBelow.current = true;
      lastDesktopY.current = e.clientY;
    }
    function onMouseOut(e: MouseEvent) {
      if (!config || e.clientY > 0) return;
      if (!cameFromBelow.current) return;
      triggerShow(config);
    }

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseout", onMouseOut);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, [config, triggerShow]);

  useEffect(() => {
    if (!config) return;
    if (!isMobile.current) return;
    if (!config.mobileScrollTrigger) return;

    let lastScrollY = window.scrollY;
    let lastScrollAt = Date.now();

    function onScroll() {
      if (!config) return;
      const now = Date.now();
      const currentY = window.scrollY;
      const deltaY = lastScrollY - currentY;
      const deltaTime = now - lastScrollAt;

      if (deltaTime > 0 && deltaTime <= 240 && deltaY >= 140 && currentY <= 24) {
        triggerShow(config);
      }
      lastScrollY = currentY;
      lastScrollAt = now;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [config, triggerShow]);

  useEffect(() => {
    if (!config) return;
    if (!isMobile.current) return;
    if (!config.mobileBackButtonTrigger) return;
    const state = { rgPopupGuard: true };
    try {
      window.history.pushState(state, "", window.location.href);
    } catch {
      return;
    }
    function onPopState() {
      if (!config) return;
      triggerShow(config);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [config, triggerShow]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePopup("esc");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function dispatchPopupFormTracking(status: "success" | "fail", reason = "") {
    window.dispatchEvent(
      new CustomEvent(status === "success" ? "rg:form-success" : "rg:form-fail", {
        detail: { form: "exit-intent-popup", reason },
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;

    if (config.enableName && !name.trim()) {
      setErrorMsg("Informe seu nome.");
      setFormStatus("error");
      dispatchPopupFormTracking("fail", "validation_name");
      return;
    }
    if (config.enableEmail && !email.trim()) {
      setErrorMsg("Informe um e-mail válido.");
      setFormStatus("error");
      dispatchPopupFormTracking("fail", "validation_email");
      return;
    }
    if (config.enableEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("Informe um e-mail válido.");
      setFormStatus("error");
      dispatchPopupFormTracking("fail", "validation_email");
      return;
    }
    if (config.enablePhone && phone.replace(/\D/g, "").length < 10) {
      setErrorMsg("Informe um telefone válido.");
      setFormStatus("error");
      dispatchPopupFormTracking("fail", "validation_phone");
      return;
    }

    setFormStatus("loading");
    setErrorMsg("");

    if (isCmsPopupPreview()) {
      setFormStatus("success");
      setTimeout(() => closePopup("auto_after_submit"), 1200);
      return;
    }

    try {
      const res = await fetch(api.popup.leads, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "exit-intent-popup",
        pagePath: window.location.pathname,
        sessionId: getPopupSessionId(),
        origin: isMobile.current ? "mobile" : "desktop",
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        lead?: { id: string };
      };
      if (!res.ok) {
        const reason = data.error ?? "Falha ao enviar dados.";
        setErrorMsg(reason);
        setFormStatus("error");
        dispatchPopupFormTracking("fail", reason);
        return;
      }
      writeLocal(STORAGE.submittedAt, Date.now());
      setFormStatus("success");
      dispatchPopupFormTracking("success");
      trackEvent("popup_submitted", { leadId: data.lead?.id ?? "" });
      setTimeout(() => closePopup("auto_after_submit"), 1200);
    } catch {
      const reason = "Erro de conexão. Tente novamente.";
      setErrorMsg(reason);
      setFormStatus("error");
      dispatchPopupFormTracking("fail", reason);
    }
  }

  if (!config || !rendered) return null;
  const modeConfig = mobileLayout ? config.mobile : config.desktop;
  const popupTitle = modeConfig?.title || config.title;
  const popupDescription = modeConfig?.description || config.description;
  const popupImage = modeConfig?.image || config.image;
  const popupImagePresentation = mobileLayout
    ? (config.mobile?.image ? config.mobile.imagePresentation : config.imagePresentation)
    : (config.desktop?.image ? config.desktop.imagePresentation : config.imagePresentation);
  const popupBadge = mobileLayout ? config.mobile?.sheetTitle || config.badgeText : config.badgeText;
  const sideBySideDetails = config.enableName && config.enablePhone;
  const cmsPreview = isCmsPopupPreview();

  return (
    <div
      className={[
        "fixed inset-0 z-[9999] flex",
        mobileLayout
          ? cmsPreview
            ? "items-center justify-center p-4"
            : "items-end justify-center p-0"
          : "items-center justify-center p-4 sm:p-6",
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-0 bg-slate-950/68 backdrop-blur-md transition-opacity duration-200 motion-reduce:transition-none",
          closing ? "opacity-0" : "opacity-100",
        ].join(" ")}
        onClick={() => closePopup("backdrop")}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rg-popup-title"
        aria-describedby="rg-popup-description"
        tabIndex={-1}
        className={[
          "relative w-full overflow-hidden border border-white/20 bg-[#f3f6fb] shadow-[0_24px_60px_rgba(2,6,23,0.22)]",
          "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          closing ? "translate-y-2 scale-[0.97] opacity-0" : "translate-y-0 scale-100 opacity-100",
          mobileLayout
            ? cmsPreview
              ? "max-h-[86dvh] max-w-[360px] overflow-y-auto rounded-[28px]"
              : "max-h-[90dvh] max-w-[680px] overflow-y-auto rounded-t-[28px]"
            : "max-w-[780px] rounded-[24px]",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => closePopup("button")}
          aria-label="Fechar popup"
          ref={closeButtonRef}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-[0_6px_16px_rgba(15,23,42,0.08)] transition-colors duration-200 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20"
        >
          <X size={18} weight="bold" aria-hidden="true" />
        </button>

        <div
          className={[
            "relative",
            mobileLayout
              ? ""
              : "grid grid-cols-[minmax(220px,0.85fr)_minmax(0,1.15fr)]",
          ].join(" ")}
        >
          <div
            className={mobileLayout
              ? "overflow-hidden bg-[#0b2247]"
              : "min-h-full overflow-hidden bg-[#0b2247]"}
          >
            {popupImage ? (
              <img
                src={popupImage}
                alt=""
                className={`${mobileLayout ? "h-44" : "h-full min-h-[390px]"} w-full object-cover`}
                style={{ objectPosition: mediaObjectPosition(popupImagePresentation, mobileLayout ? "mobile" : "desktop") }}
              />
            ) : (
              <div
                aria-hidden="true"
                className={`${mobileLayout ? "h-44 items-center justify-center px-5 py-4 text-center" : "min-h-[390px] justify-end p-7"} flex h-full flex-col bg-[radial-gradient(circle_at_24%_16%,rgba(99,151,221,0.55),transparent_30%),radial-gradient(circle_at_82%_86%,rgba(37,89,184,0.48),transparent_38%),linear-gradient(145deg,#07162f_0%,#0c2855_58%,#174695_100%)] text-white`}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-200/80">Rodogarcia</span>
                <span className="mt-1 max-w-[15ch] text-lg font-bold leading-tight tracking-[-0.03em]">Vamos simplificar sua operação.</span>
              </div>
            )}
          </div>

          <div
            className={mobileLayout
              ? "space-y-3 bg-[linear-gradient(145deg,#f8fbff_0%,#f1f5fb_100%)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 text-center"
              : "min-w-0 space-y-4.5 bg-[linear-gradient(145deg,#f8fbff_0%,#f1f5fb_100%)] p-7"}
          >

          {popupBadge ? (
            <span className={`${mobileLayout ? "mx-auto" : ""} inline-flex w-fit items-center gap-2 rounded-full border border-[var(--primary)]/14 bg-[var(--color-primary-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--primary)]`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
              {popupBadge}
            </span>
          ) : null}

          <div className={mobileLayout ? "" : "pr-8"}>
          <h2
            id="rg-popup-title"
              className={`${mobileLayout ? "text-[1.7rem]" : "text-[clamp(1.75rem,3vw,2.2rem)]"} font-extrabold leading-[1.06] tracking-[-0.04em] text-[var(--foreground)]`}
          >
            {popupTitle}
          </h2>
            <p
              id="rg-popup-description"
              className="mt-2 text-sm leading-6 text-[var(--color-muted-raw)]"
            >
            {popupDescription}
          </p>
          </div>

        {formStatus === "success" ? (
            <p className="rounded-[18px] border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm font-semibold leading-6 text-emerald-600">
            {config.successMessage}
          </p>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              <div className={`grid gap-2.5 ${sideBySideDetails ? "grid-cols-2" : ""}`}>
            {config.enableEmail && (
              <input
                type="email"
                placeholder="Seu e-mail"
                  aria-label="Seu e-mail"
                ref={firstFieldRef}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={160}
                  className={`h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--color-surface-strong)] px-3.5 text-left text-sm font-medium text-[var(--foreground)] outline-none transition-colors duration-200 placeholder:text-[var(--color-muted-raw)] hover:border-[var(--color-border-strong)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20 ${sideBySideDetails ? "col-span-2" : ""}`}
              />
            )}
            {config.enableName && (
              <input
                type="text"
                placeholder="Seu nome"
                  aria-label="Seu nome"
                  ref={!config.enableEmail ? firstFieldRef : undefined}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                  className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--color-surface-strong)] px-3.5 text-left text-sm font-medium text-[var(--foreground)] outline-none transition-colors duration-200 placeholder:text-[var(--color-muted-raw)] hover:border-[var(--color-border-strong)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
              />
            )}
            {config.enablePhone && (
              <input
                type="tel"
                placeholder="Seu telefone"
                  aria-label="Seu telefone"
                ref={!config.enableEmail && !config.enableName ? firstFieldRef : undefined}
                value={phone}
                onChange={(e) => {
                  maskPhone(e);
                  setPhone(e.target.value);
                }}
                maxLength={20}
                  className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--color-surface-strong)] px-3.5 text-left text-sm font-medium text-[var(--foreground)] outline-none transition-colors duration-200 placeholder:text-[var(--color-muted-raw)] hover:border-[var(--color-border-strong)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
              />
            )}
              </div>

            {formStatus === "error" && (
                <p className="rounded-[14px] border border-red-500/15 bg-red-500/10 px-3 py-2 text-xs font-semibold leading-5 text-red-500" aria-live="polite">
                  {errorMsg}
                </p>
            )}

              <div className="flex flex-col items-center gap-1.5 pt-1">
              <button
                type="submit"
                disabled={formStatus === "loading"}
                  aria-busy={formStatus === "loading"}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-white shadow-[0_10px_20px_rgba(29,78,216,0.2)] transition-colors duration-200 hover:bg-[var(--color-primary-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {formStatus === "loading" ? "Enviando..." : config.buttonText}
              </button>
              <button
                type="button"
                onClick={() => closePopup("cancel")}
                  className="inline-flex min-h-8 items-center justify-center px-3 py-1 text-xs font-semibold text-[var(--color-muted-raw)] underline-offset-4 transition-colors duration-200 hover:text-[var(--foreground)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20"
              >
                {config.closeText}
              </button>
            </div>
          </form>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
