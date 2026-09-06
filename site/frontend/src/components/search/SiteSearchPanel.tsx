"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowElbowDownLeft,
  ArrowUp,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { drawerNavigation, external, site } from "@/lib/routes";

export interface SearchItem {
  title: string;
  description?: string;
  href: string;
  isExternal?: boolean;
  category?: string;
}

function labelForRoute(href: string, fallback: string) {
  return drawerNavigation.find((item) => item.href === href)?.label ?? fallback;
}

const SEARCH_INDEX: SearchItem[] = [
  { title: labelForRoute(site.quote, "Cotação"), href: site.quote, category: "Serviços" },
  { title: "Rastreamento", description: external.tracking, href: external.tracking, isExternal: true, category: "Serviços" },
  { title: "Solicitar Coleta", href: site.collections, category: "Serviços" },
  { title: labelForRoute(site.services, "Serviços"), href: site.services, category: "Páginas" },
  { title: labelForRoute(site.business, "Empresas"), href: site.business, category: "Páginas" },
  { title: labelForRoute(site.contact, "Contato"), href: site.contact, category: "Páginas" },
  { title: "Central de Ajuda", href: site.help, category: "Páginas" },
  { title: labelForRoute(site.about, "Sobre"), href: site.about, category: "Páginas" },
  { title: labelForRoute(site.careers, "Carreiras"), href: site.careers, category: "Páginas" },
  { title: "Imprensa", href: site.press, category: "Institucional" },
  { title: labelForRoute(site.voice, "Sua Voz"), href: site.voice, category: "Institucional" },
  { title: "Termos de Uso", href: site.terms, category: "Institucional" },
  { title: "Privacidade", href: site.privacy, category: "Institucional" },
  { title: "WhatsApp", description: external.phoneDisplay, href: external.whatsappCommercial, isExternal: true, category: "Contato" },
  { title: "Telefone", description: external.phoneDisplay, href: external.phoneHref, isExternal: true, category: "Contato" },
  { title: "E-mail", description: external.commercialEmailAddress, href: external.commercialEmail, isExternal: true, category: "Contato" },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filterResults(query: string): SearchItem[] {
  if (!query.trim()) return SEARCH_INDEX.slice(0, 8);
  const normalizedQuery = normalize(query.trim());
  return SEARCH_INDEX.filter(
    (item) =>
      normalize(item.title).includes(normalizedQuery) ||
      normalize(item.description ?? "").includes(normalizedQuery) ||
      normalize(item.category ?? "").includes(normalizedQuery) ||
      normalize(item.href).includes(normalizedQuery)
  ).slice(0, 10);
}

interface SiteSearchPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SiteSearchPanel({ open, onClose }: SiteSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  const results = useMemo(() => filterResults(query), [query]);
  const placeholder = useMemo(
    () => SEARCH_INDEX.slice(0, 4).map((item) => item.title).join(" / "),
    []
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 90);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex < results.length) return;
    setActiveIndex(Math.max(0, results.length - 1));
  }, [activeIndex, results.length]);

  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const navigate = useCallback(
    (item: SearchItem) => {
      onClose();
      if (item.isExternal) {
        window.open(item.href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(item.href);
    },
    [onClose, router]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (results.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % results.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + results.length) % results.length);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const item = results[activeIndex];
        if (item) navigate(item);
      }
    },
    [activeIndex, navigate, onClose, results]
  );

  return (
    <div
      id="site-search-panel"
      role="search"
      aria-hidden={!open}
      inert={!open}
      className={[
        "absolute inset-x-0 top-[4.5rem] overflow-hidden border-t border-[var(--border)] bg-white/95 shadow-[0_18px_42px_rgba(15,23,42,0.07)] backdrop-blur-md",
        "transition-all duration-[400ms] ease-out transform origin-top",
        open
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-4 pointer-events-none",
      ].join(" ")}
    >
      <div className="mx-auto max-w-[980px] px-4 pb-10 pt-4 sm:px-8 sm:pb-12 sm:pt-5 lg:px-10">
          <div
            className={[
              "flex items-center gap-3 rounded-2xl border border-[var(--primary)]/18 bg-[var(--color-surface-strong)] px-3.5 py-3.5",
              "shadow-[0_10px_24px_rgba(15,23,42,0.06)] sm:px-4 sm:py-4",
            ].join(" ")}
          >
            <MagnifyingGlass
              size={22}
              weight="bold"
              className="shrink-0 text-[var(--primary)]"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="search"
              id="site-search-input"
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              className={[
                "min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--foreground)] outline-none sm:text-base",
                "placeholder:text-[var(--color-muted-raw)]/70",
                "focus-visible:shadow-none focus-visible:ring-0",
              ].join(" ")}
              aria-label="Buscar no site"
              aria-autocomplete="list"
              aria-controls="site-search-results"
              aria-expanded={open}
              aria-activedescendant={
                results[activeIndex] ? `site-search-result-${activeIndex}` : undefined
              }
            />
            <button
              type="button"
              aria-label="Fechar busca"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-raw)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          {results.length > 0 ? (
            <ul
              id="site-search-results"
              ref={listRef}
              role="listbox"
              aria-label="Resultados da busca"
              className="scrollbar-ds mt-3 max-h-[320px] overflow-y-auto pr-2 sm:max-h-[360px]"
            >
              {results.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <li
                    key={`${item.href}-${index}`}
                    id={`site-search-result-${index}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                  >
                    <SearchResultLink
                      item={item}
                      active={isActive}
                      onClose={onClose}
                      prefetch={open}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-3 rounded-xl bg-[var(--color-surface-2)] px-5 py-8 text-center text-sm font-semibold text-[var(--color-muted-raw)]">
              Nenhum resultado para "{query}"
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3 text-[10px] font-semibold text-[var(--color-muted-raw)]">
            <span className="inline-flex items-center gap-1">
              <ArrowDown size={11} aria-hidden="true" />
              <ArrowUp size={11} aria-hidden="true" />
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowElbowDownLeft size={11} aria-hidden="true" />
            </span>
            <span className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[9px]">
              ESC
            </span>
          </div>
      </div>
    </div>
  );
}

function SearchResultLink({
  item,
  active,
  onClose,
  prefetch,
}: {
  item: SearchItem;
  active: boolean;
  onClose: () => void;
  prefetch: boolean;
}) {
  const className = [
    "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-[background-color,color,box-shadow] duration-150 sm:px-4",
    active
      ? "bg-[var(--color-primary-soft)] text-[var(--primary)] shadow-[inset_0_0_0_1px_rgba(29,78,216,0.08)]"
      : "text-[var(--foreground)] hover:bg-[var(--color-surface-2)]",
  ].join(" ");

  const content = <ResultContent item={item} active={active} />;

  if (item.isExternal) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      prefetch={prefetch}
      onClick={onClose}
      className={className}
    >
      {content}
    </Link>
  );
}

function ResultContent({ item, active }: { item: SearchItem; active: boolean }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-extrabold leading-snug">{item.title}</span>
          {item.category ? (
            <span
              className={[
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
                active
                  ? "bg-white/80 text-[var(--primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted-raw)]",
              ].join(" ")}
            >
              {item.category}
            </span>
          ) : null}
        </div>
        {item.description ? (
          <p className="mt-1 truncate text-xs font-medium leading-snug text-[var(--color-muted-raw)]">
            {item.description}
          </p>
        ) : null}
      </div>
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--primary)] transition-opacity duration-150",
          active ? "opacity-70" : "opacity-0",
        ].join(" ")}
        aria-hidden="true"
      >
        <ArrowElbowDownLeft size={15} weight="bold" />
      </span>
    </>
  );
}
