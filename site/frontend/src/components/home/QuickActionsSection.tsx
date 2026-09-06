"use client";

import { useId, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { QuickAction } from "@/types/content";
import { useSiteSearch } from "@/components/search/SiteSearchProvider";
import { cn } from "@/lib/utils";
import { QuickActionButton } from "./QuickActionButton";

interface QuickActionsSectionProps {
  actions: QuickAction[];
}

interface SearchHeroProps {
  placeholder: string;
  isOpen: boolean;
  onOpen: () => void;
}

interface ActionsListProps {
  actions: QuickAction[];
  compactDesktop?: boolean;
}

const primaryActionsVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.065,
      delayChildren: 0.08,
    },
  },
};

const primaryActionVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: "easeOut" },
  },
};

function hasActionTarget(action: QuickAction) {
  const rawAction = action as QuickAction & {
    taxasPdfUrl?: string;
    pdfUrl?: string;
    fileUrl?: string;
    url?: string;
  };
  if (action.type === "download") {
    return Boolean(
      action.downloadFile ||
        action.href ||
        rawAction.taxasPdfUrl ||
        rawAction.pdfUrl ||
        rawAction.fileUrl ||
        rawAction.url
    );
  }
  return Boolean(action.href || rawAction.url);
}

function isRatesAction(action: QuickAction) {
  const normalizedLabel = normalizeSearch(action.label);
  return action.id === "qa-taxas" || normalizedLabel.includes("taxas");
}

function isQuickIconAction(action: QuickAction) {
  const normalizedLabel = normalizeSearch(action.label);
  return (
    ["qa-cotacao", "qa-whatsapp", "qa-telefone", "qa-email", "qa-cidades"].includes(action.id) ||
    ["cotacao", "whatsapp", "telefone", "email", "e-mail", "cidades"].includes(normalizedLabel)
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildSearchPlaceholder(labels: string[]) {
  if (labels.length === 0) {
    return "Buscar cotação, rastreamento, cidades e taxas";
  }

  return "Buscar por cotação, rastreamento e taxas";
}

function isDisabledAction(action: QuickAction) {
  return !hasActionTarget(action);
}

export default function QuickActionsSection({ actions }: QuickActionsSectionProps) {
  const { isOpen: searchOpen, openSearch } = useSiteSearch();
  const visible = useMemo(
    () =>
      actions
        .filter(
          (action) =>
            action.enabled !== false && action.label.trim() && hasActionTarget(action)
        )
        .slice()
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    [actions]
  );
  const labelId = useId();

  const cmsLabels = useMemo(
    () => visible.map((action) => action.label.trim()).filter(Boolean),
    [visible]
  );
  const sectionTitle = "Busca e atalhos rápidos";
  const searchPlaceholder = buildSearchPlaceholder(cmsLabels);
  const iconActions = useMemo(() => visible.filter(isQuickIconAction), [visible]);
  const cardActions = useMemo(
    () => visible.filter((action) => !isQuickIconAction(action)),
    [visible]
  );
  const shouldCenterRemainingActions =
    !visible.some(isRatesAction) && iconActions.length > 0 && cardActions.length === 2;

  if (visible.length === 0) return null;

  return (
    <section
      aria-labelledby={labelId}
      className={[
        "relative z-10 overflow-hidden border-y border-[var(--border)] px-4 py-8 sm:px-5 sm:py-10 lg:py-12",
        "bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--background)_100%)]",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(6,182,212,0.08),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(29,78,216,0.08),transparent_26%)]" />
      <div className="decorative-grid absolute inset-0" data-theme="light" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(29,78,216,0.22),rgba(6,182,212,0.16),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(15,23,42,0.08),transparent)]" />

      <h2 id={labelId} className="sr-only">
        {sectionTitle}
      </h2>

      <div className="relative mx-auto max-w-[1216px]">
        <SearchHero placeholder={searchPlaceholder} isOpen={searchOpen} onOpen={openSearch} />

        {cardActions.length > 0 ? (
          <div className="mt-5 h-px w-full bg-[linear-gradient(90deg,transparent,rgba(15,23,42,0.09),rgba(29,78,216,0.11),transparent)] sm:mt-6" />
        ) : null}

        <div className={cn("mt-5 flex flex-col sm:mt-6 lg:flex-row lg:items-center lg:gap-6", shouldCenterRemainingActions ? "lg:justify-center" : "lg:justify-between")}>
          <div className="w-full order-2 lg:order-1 mt-5 lg:mt-0 lg:w-auto lg:shrink-0">
            <QuickActions actions={iconActions} />
          </div>
          <div className={cn("order-1 w-full lg:order-2", shouldCenterRemainingActions ? "lg:w-[calc(43.333%_-_0.333rem)] lg:shrink-0 xl:w-[calc(46.667%_-_0.333rem)]" : "lg:flex-1 lg:max-w-[65%] xl:max-w-[70%]")}>
            <PrimaryActionsGrid actions={cardActions} compactDesktop={shouldCenterRemainingActions} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function SearchHero({ placeholder, isOpen, onOpen }: SearchHeroProps) {
  return (
    <div className="group/search relative">
      <div className="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-[calc(var(--radius-search)_+_12px)] bg-[radial-gradient(circle_at_50%_50%,rgba(29,78,216,0.18),transparent_66%)] opacity-0 blur-2xl transition-opacity duration-300 ease-out group-hover/search:opacity-100 group-focus-within/search:opacity-100" />

      <div className="relative rounded-[calc(var(--radius-search)_+_1px)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,255,255,0.52)_48%,rgba(29,78,216,0.18))] p-px shadow-[var(--shadow-search)] transition-shadow duration-300 ease-out group-hover/search:shadow-[var(--shadow-search-hover)] group-focus-within/search:shadow-[var(--shadow-search-hover)]">
        <MagnifyingGlass
          size={22}
          weight="bold"
          aria-hidden="true"
          className="pointer-events-none absolute left-5 top-1/2 z-[2] -translate-y-1/2 text-[var(--primary)] sm:left-6"
        />

        <button
          type="button"
          onClick={onOpen}
          aria-label="Abrir busca do site"
          aria-controls="site-search-panel"
          aria-expanded={isOpen}
          className={[
            "peer flex h-[62px] w-full cursor-pointer items-center rounded-[var(--radius-search)] border border-[var(--color-action-border)] bg-[var(--color-action-surface)] py-0 pl-[54px] pr-12 text-left text-sm font-extrabold text-[var(--color-muted-raw)]/70 shadow-[inset_0_1px_0_var(--color-action-highlight)] outline-none ring-1 ring-[var(--color-action-ring)] backdrop-blur-xl transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out sm:h-[68px] sm:pl-[62px] sm:pr-14 sm:text-base",
            "hover:-translate-y-px hover:border-[var(--primary)]/22 hover:bg-[var(--color-action-surface-hover)]",
            "focus:border-[var(--primary)]/42 focus:bg-[var(--color-action-surface-hover)] focus:ring-4 focus:ring-[var(--primary)]/14",
            "focus-visible:outline-none",
          ].join(" ")}
        >
          <span className="truncate">{placeholder}</span>
        </button>

        <span className="pointer-events-none absolute right-5 top-1/2 z-[2] h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--primary)]/50 shadow-[0_0_0_6px_rgba(29,78,216,0.08)] transition-transform duration-300 ease-out peer-hover:scale-110 peer-focus:scale-125 sm:right-6" />
      </div>
    </div>
  );
}

export function QuickActions({ actions }: ActionsListProps) {
  if (actions.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 lg:justify-start"
      role="list"
      aria-label="Atalhos rápidos"
    >
      {actions.map((action) => (
        <div key={action.id} role="listitem">
          <QuickActionButton
            action={action}
            variant="icon"
            disabled={isDisabledAction(action)}
          />
        </div>
      ))}
    </div>
  );
}

export function PrimaryActionsGrid({ actions, compactDesktop = false }: ActionsListProps) {
  if (actions.length === 0) return null;

  return (
    <motion.div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:gap-4",
        compactDesktop ? "lg:grid-cols-2" : "lg:grid-cols-3",
        actions.length === 1 ? "mx-auto max-w-sm sm:grid-cols-1" : ""
      )}
      role="list"
      aria-label="Ações principais"
      variants={primaryActionsVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {actions.map((action) => (
        <motion.div key={action.id} role="listitem" className="min-w-0" variants={primaryActionVariants}>
          <QuickActionButton
            action={action}
            variant="primary"
            disabled={isDisabledAction(action)}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
