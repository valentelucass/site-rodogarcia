"use client";

import { type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { DeveloperHelp } from "./ui";

export function DeveloperCmsAccordion({
  items,
  openIndex,
  onOpenChange,
  getTitle,
  getEyebrow,
  renderItem,
  renderActions,
  variant = "default",
  indexOffset = 0,
  compact = false,
}: {
  items: any[];
  openIndex: number | null;
  onOpenChange: (index: number | null) => void;
  getTitle: (item: any, index: number) => string;
  getEyebrow: (item: any, index: number) => string;
  renderItem: (item: any, index: number) => ReactNode;
  renderActions?: (item: any, index: number) => ReactNode;
  variant?: "default" | "services";
  indexOffset?: number;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const itemIndex = indexOffset + index;
        const isOpen = openIndex === itemIndex;
        return (
          <article
            key={`${getEyebrow(item, index)}-${index}`}
            className={cn(
              "overflow-hidden rounded-[22px] border transition-all duration-300",
              isOpen
                ? variant === "services"
                  ? "border-[#93c5fd] shadow-[0_14px_34px_rgba(29,78,216,0.12)] ring-1 ring-[var(--primary)]/7"
                  : "border-[var(--primary)]/24 bg-slate-50/86 shadow-[0_14px_34px_rgba(15,23,42,0.07)]"
                : variant === "services"
                  ? "border-slate-300/90 bg-slate-100/90 shadow-[0_8px_20px_rgba(15,23,42,0.055)]"
                  : "border-[var(--border)]/80 bg-slate-50/86 shadow-[0_8px_20px_rgba(15,23,42,0.035)]"
            )}
          >
            <div
              className={cn(
                "flex w-full items-center justify-between gap-4 text-left transition-colors",
                compact ? "px-3 py-3 sm:px-4" : "px-4 py-4 sm:px-5",
                variant === "services"
                  ? isOpen
                    ? "bg-[#eff6ff]"
                    : "bg-slate-100/90 hover:bg-slate-200/80"
                  : "hover:bg-white/72"
              )}
            >
              <button
                type="button"
                onClick={() => onOpenChange(isOpen ? null : itemIndex)}
                className="min-w-0 flex-1 text-left"
                aria-expanded={isOpen}
              >
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[11px] font-semibold uppercase tracking-[0.16em]",
                      variant === "services" && isOpen
                        ? "text-[var(--primary)]"
                        : "text-[var(--color-muted-raw)]"
                    )}
                  >
                    {getEyebrow(item, index)}
                  </span>
                  <span className="mt-1 block truncate text-sm font-semibold text-[var(--foreground)]">
                    {getTitle(item, index)}
                  </span>
                </span>
              </button>
              {renderActions ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {renderActions(item, index)}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenChange(isOpen ? null : itemIndex)}
                aria-label={isOpen ? `Fechar ${getTitle(item, index)}` : `Abrir ${getTitle(item, index)}`}
                className={cn(
                  "shrink-0 items-center justify-center rounded-2xl border bg-white transition-transform duration-300",
                  compact ? "flex h-8 w-8" : "flex h-9 w-9",
                  isOpen
                    ? variant === "services"
                      ? "rotate-180 border-[var(--primary)]/22 text-[var(--primary)] shadow-[0_6px_14px_rgba(29,78,216,0.1)]"
                      : "rotate-180 border-[var(--border)] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--color-muted-raw)]"
                )}
              >
                <CaretDown size={16} weight="bold" />
              </button>
              <DeveloperHelp label={getTitle(item, index)} kind="accordion" />
            </div>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  className={cn(
                    "border-t",
                    compact ? "p-3 sm:p-4" : "p-4 sm:p-5",
                    variant === "services" ? "border-[#bfdbfe] bg-white" : "border-slate-200/70"
                  )}
                >
                  {renderItem(item, index)}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
