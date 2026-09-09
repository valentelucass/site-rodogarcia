"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import { getCmsHelp } from "@/lib/cmsHelp";

export interface DeveloperNotice {
  tone: "success" | "error" | "info";
  text: string;
}

interface Notification extends DeveloperNotice {
  source: string;
  revision: number;
  route: symbol;
}

type PublishNotification = (source: string, notice: DeveloperNotice | null) => void;
const NotificationContext = createContext<PublishNotification | null>(null);

/** Uma única camada, fora da rolagem e dos cards, mantém os avisos visíveis também sobre os modais. */
export function DeveloperNotificationsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Uma nova visita à mesma URL não deve receber respostas atrasadas da visita anterior.
  const route = useMemo(() => Symbol(pathname), [pathname]);
  const currentRoute = useRef(route);
  currentRoute.current = route;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const revision = useRef(0);
  useEffect(() => {
    setNotifications((current) => current.filter((item) => item.route === route));
  }, [route]);
  const publish = useCallback<PublishNotification>((source, notice) => {
    if (currentRoute.current !== route) return;
    const next = notice?.text.trim()
      ? { ...notice, source, revision: ++revision.current, route }
      : null;
    setNotifications((current) => {
      const remaining = current.filter((item) => item.source !== source && item.route === route);
      return next ? [next, ...remaining] : remaining;
    });
  }, [route]);

  const dismiss = useCallback((id: number) => {
    setNotifications((current) => current.filter((item) => item.revision !== id));
  }, []);

  // Os avisos aguardando só iniciam seu prazo quando entram na área visível.
  const visible = notifications.filter((item) => item.route === route).slice(0, 3);

  return (
    <NotificationContext.Provider value={publish}>
      {children}
      <div className="cms-notifications" aria-label="Notificações do CMS">
        {visible.map((item) => (
          <NotificationCard key={item.revision} notification={item} onDismiss={dismiss} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

/** Chamar novamente renova o aviso, mesmo quando a mensagem é idêntica. null limpa o aviso desta origem. */
export function useDeveloperNotifier() {
  const publish = useContext(NotificationContext);
  const source = useId();
  if (!publish) throw new Error("As notificações do CMS exigem DeveloperNotificationsProvider.");
  return useCallback((notice: DeveloperNotice | null) => publish(source, notice), [publish, source]);
}

/** Ponte para avisos vindos da navegação ou de estados de consulta, sem disparar durante a renderização. */
export function DeveloperNotification({ tone, message }: { tone: DeveloperNotice["tone"]; message: string }) {
  const notify = useDeveloperNotifier();
  useEffect(() => {
    notify(message ? { tone, text: message } : null);
    return () => notify(null);
  }, [message, notify, tone]);
  return null;
}

function NotificationCard({ notification, onDismiss }: { notification: Notification; onDismiss: (id: number) => void }) {
  const { tone, text, revision } = notification;
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const messageId = useId();
  const remaining = useRef(Math.max(8000, Math.min(20000, text.length * 55)));
  const closeHelp = useMemo(() => getCmsHelp("/developer", "Fechar notificação", "field", "cms-notification-dismiss"), []);
  const Icon = tone === "success" ? CheckCircle : tone === "error" ? WarningCircle : Info;

  const close = useCallback(() => {
    // Somente um fechamento solicitado pelo usuário pode retirar um controle focado.
    closeRef.current?.blur();
    setLeaving(true);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageHidden(document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (tone === "error" || hovered || focused || pageHidden || leaving) return;
    const started = Date.now();
    const timer = window.setTimeout(close, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [close, focused, hovered, leaving, pageHidden, tone]);

  useEffect(() => {
    if (!leaving) return;
    // O prazo também conclui a saída com animações desativadas ou aba em segundo plano.
    const timer = window.setTimeout(() => onDismiss(revision), 180);
    return () => window.clearTimeout(timer);
  }, [leaving, onDismiss, revision]);

  return (
    <div
      className="cms-notification"
      data-tone={tone}
      data-leaving={leaving || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <Icon className="cms-notification__icon" size={22} weight="fill" aria-hidden="true" />
      <div role={tone === "error" ? "alert" : "status"} aria-atomic="true" className="cms-notification__content">
        <p className="cms-notification__title">{tone === "success" ? "Concluído" : tone === "error" ? "Não foi possível concluir" : "Atenção"}</p>
        <p id={messageId} className="cms-notification__text">{text}</p>
      </div>
      <button
        ref={closeRef}
        type="button"
        className="cms-notification__close"
        onClick={close}
        aria-label="Fechar notificação"
        aria-describedby={messageId}
        title={closeHelp.summary}
      >
        <X size={18} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}
