"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  developerDangerButtonClassName,
  developerGhostButtonClassName,
} from "./ui";

interface DeveloperConfirmButtonProps {
  children: ReactNode;
  message: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  actionType?: "remove";
  title?: string;
  confirmLabel?: string;
}

export function DeveloperConfirmButton({
  children,
  message,
  onConfirm,
  className,
  disabled,
  actionType,
  title = "Confirmar exclusão",
  confirmLabel = "Excluir",
}: DeveloperConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) setConfirming(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [confirming, submitting]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        data-cms-collection-action={actionType}
        onClick={() => setConfirming(true)}
        className={cn(developerDangerButtonClassName, className)}
      >
        {children}
      </button>
      {confirming ? createPortal(
        <div className="cms-content-dialog fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="developer-confirm-title" onMouseDown={() => !submitting && setConfirming(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.4)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="developer-confirm-title" className="text-base font-bold text-[var(--foreground)]">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted-raw)]">{message}</p>
              </div>
              <button type="button" disabled={submitting} onClick={() => setConfirming(false)} aria-label="Fechar confirmação" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-muted-raw)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--foreground)] disabled:opacity-50">
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={submitting} onClick={() => setConfirming(false)} className={developerGhostButtonClassName}>Cancelar</button>
              <button type="button" disabled={submitting} onClick={() => void handleConfirm()} className={developerDangerButtonClassName}>{submitting ? "Excluindo..." : confirmLabel}</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
