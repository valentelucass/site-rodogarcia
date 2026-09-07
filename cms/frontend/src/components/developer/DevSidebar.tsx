"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  Briefcase,
  Buildings,
  CaretDown,
  CaretLeft,
  CaretUp,
  ChartBar,
  Cookie,
  CursorClick,
  EnvelopeSimple,
  House,
  ImagesSquare,
  ListMagnifyingGlass,
  Lightbulb,
  MagnifyingGlass,
  MapPin,
  Phone,
  SignOut,
  Sparkle,
  Stack,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useApiRequest } from "@/hooks/useApiRequest";
import { adminNavigationGroups, api, auth, normalizeCmsPathname, site, siteUrl } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { permissionForAdminPath } from "@/lib/cmsAccess";
import { useSession } from "@/hooks/useSession";

interface DevSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

type SidebarIcon = ComponentType<{
  size?: number;
  weight?: "duotone" | "fill" | "regular" | "bold" | "light" | "thin";
  className?: string;
}>;

const iconMap: Record<string, SidebarIcon> = {
  dashboard: House,
  home: Sparkle,
  services: Stack,
  "about-page": Buildings,
  "business-page": Buildings,
  "contact-page": Phone,
  "careers-page": Briefcase,
  "quote-page": EnvelopeSimple,
  improvements: Lightbulb,
  images: ImagesSquare,
  popup: CursorClick,
  cookies: Cookie,
  "cookie-monitoring": Cookie,
  analytics: ChartBar,
  tracking: ListMagnifyingGlass,
  leads: EnvelopeSimple,
  seo: MagnifyingGlass,
  users: UsersThree,
  units: MapPin,
  "landing-pages": Sparkle,
};

function SidebarScrollArea({
  children,
  expanded,
}: {
  children: ReactNode;
  expanded: boolean;
}) {
  const scrollRef = useRef<HTMLElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  function scrollByPage(direction: -1 | 1) {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollBy({
      top: direction * Math.max(180, Math.round(scrollElement.clientHeight * 0.7)),
      behavior: "smooth",
    });
  }

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const updateIndicators = () => {
      const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
      setCanScrollUp(scrollElement.scrollTop > 2);
      setCanScrollDown(scrollElement.scrollTop < maxScrollTop - 2);
    };

    updateIndicators();
    const frameId = window.requestAnimationFrame(updateIndicators);
    scrollElement.addEventListener("scroll", updateIndicators, { passive: true });
    window.addEventListener("resize", updateIndicators);

    let resizeObserver: ResizeObserver | null = null;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(updateIndicators);
      resizeObserver.observe(scrollElement);
      if (scrollElement.firstElementChild) {
        resizeObserver.observe(scrollElement.firstElementChild);
      }
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      scrollElement.removeEventListener("scroll", updateIndicators);
      window.removeEventListener("resize", updateIndicators);
      resizeObserver?.disconnect();
    };
  }, [expanded]);

  return (
    <div className="relative min-h-0 flex-1">
      <nav
        ref={scrollRef}
        aria-label="Navegação do painel"
        data-admin-sidebar-scroll
        className="h-full min-h-0 overflow-x-hidden overflow-y-auto py-3"
      >
        {children}
      </nav>

      {canScrollUp ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-16 items-start justify-center bg-[linear-gradient(to_bottom,rgba(2,6,23,0.98)_0%,rgba(2,6,23,0.9)_30%,rgba(2,6,23,0.5)_66%,rgba(2,6,23,0)_100%)] pt-2">
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            aria-label="Rolar menu para cima"
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-sky-200 shadow-[0_8px_18px_rgba(2,6,23,0.35)] outline-none transition hover:border-sky-300/50 hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <CaretUp size={expanded ? 14 : 12} weight="bold" />
          </button>
        </div>
      ) : null}

      {canScrollDown ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex h-16 items-end justify-center bg-[linear-gradient(to_top,rgba(2,6,23,0.98)_0%,rgba(2,6,23,0.9)_30%,rgba(2,6,23,0.5)_66%,rgba(2,6,23,0)_100%)] pb-2">
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            aria-label="Rolar menu para baixo"
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-sky-200 shadow-[0_8px_18px_rgba(2,6,23,0.35)] outline-none transition hover:border-sky-300/50 hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <CaretDown size={expanded ? 14 : 12} weight="bold" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SidebarItem({
  href,
  label,
  active,
  icon: Icon,
  onClick,
  expanded,
  destructive = false,
  showTooltip,
  activating = false,
  nativeNavigation = false,
}: {
  href?: string;
  label: string;
  active?: boolean;
  icon: SidebarIcon;
  onClick?: () => void;
  expanded: boolean;
  destructive?: boolean;
  showTooltip: boolean;
  activating?: boolean;
  nativeNavigation?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn(
          "cms-sidebar-item__icon inline-flex h-10 w-10 shrink-0 items-center justify-center transition-[color,transform,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          active
            ? "text-sky-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.3)]"
            : destructive
              ? "text-rose-400/80 group-hover:text-rose-300"
              : "text-slate-400 group-hover:text-slate-200"
        )}
      >
        <Icon size={expanded ? 18 : 20} weight={active ? "fill" : "duotone"} className="transition-all duration-500" />
      </span>
      <span
        className={cn(
          "cms-sidebar-item__label min-w-0 overflow-hidden truncate whitespace-nowrap text-[13px] tracking-[0.01em] transition-[color,transform,opacity,max-width,margin] duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
          expanded ? "ml-2.5 max-w-[180px] translate-x-0 opacity-100" : "ml-0 max-w-0 -translate-x-2 opacity-0",
          active ? "font-semibold text-white" : destructive ? "font-medium text-rose-300/80 group-hover:text-rose-200" : "font-medium text-slate-300 group-hover:text-white"
        )}
      >
        {label}
      </span>
      {showTooltip ? (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white opacity-0 shadow-xl transition-all duration-200 group-hover:opacity-100 lg:block">
          {label}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "cms-sidebar-item group relative flex min-w-0 items-center outline-none transition-[background-color,border-color,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-sky-500",
    "mx-2.5 h-9 rounded-lg border",
    expanded ? "justify-start" : "justify-center",
    active
      ? "border-sky-500/20 bg-sky-500/10 shadow-[0_2px_10px_rgba(14,165,233,0.08)]"
      : destructive
        ? "border-transparent bg-transparent hover:bg-rose-500/10"
        : "border-transparent bg-transparent hover:bg-white/[0.06]"
    ,
    activating && "cms-sidebar-item--activating"
  );

  if (href) {
    if (nativeNavigation) {
      return (
        <a
          href={href}
          onClick={onClick}
          title={label}
          aria-label={label}
          className={className}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        href={href}
        onClick={onClick}
        title={label}
        aria-label={label}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={className}
    >
      {content}
    </button>
  );
}

export default function DevSidebar({
  mobileOpen,
  onCloseMobile,
  expanded,
  onToggleExpanded,
}: DevSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { apiRequest } = useApiRequest();
  const { session } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activatingHref, setActivatingHref] = useState<string | null>(null);
  const publicHomeUrl = siteUrl(site.home);

  function handleNavigation(href: string) {
    setActivatingHref(href);
    window.setTimeout(() => setActivatingHref(null), 460);
    onCloseMobile();
  }

  async function handleLogout() {
    setLoggingOut(true);
    await apiRequest(api.auth.logout, { method: "POST" });
    router.replace(auth.login);
  }

  function isActive(item: { href: string; exact?: boolean }) {
    const logicalPathname = normalizeCmsPathname(pathname);
    if (item.exact) return logicalPathname === item.href;
    return logicalPathname.startsWith(item.href);
  }

  function renderNavigation({
    navigationExpanded,
  }: {
    navigationExpanded: boolean;
  }) {
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <div className="flex h-[62px] w-full shrink-0 items-center border-b border-white/5 transition-colors duration-500">
          <div className="flex w-full items-center justify-between px-3">
            <a
              href={publicHomeUrl}
              onClick={onCloseMobile}
              aria-label="Rodogarcia"
              className="group flex min-w-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <span
                className={cn(
                  "flex flex-col justify-center overflow-hidden whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
                  navigationExpanded ? "max-w-[180px] translate-x-0 opacity-100" : "max-w-0 -translate-x-4 opacity-0"
                )}
              >
                <span className="block text-[15px] font-bold tracking-tight text-white transition-colors duration-200 group-hover:text-white/80">
                  Rodogarcia
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-sky-400/80">
                  CMS
                </span>
              </span>
            </a>

            <button
              type="button"
              onClick={onToggleExpanded}
              aria-label="Alternar sidebar"
              className={cn(
                "cms-sidebar-toggle group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-white/5 hover:text-white active:scale-95",
                navigationExpanded ? "bg-transparent" : "bg-white/[0.04] text-white hover:bg-white/[0.08]"
              )}
            >
              <CaretLeft
                size={18}
                weight="bold"
                className={cn(
                  "transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
                  navigationExpanded ? "rotate-0" : "rotate-180"
                )}
              />
            </button>
          </div>
        </div>

        <SidebarScrollArea expanded={navigationExpanded}>
          <div className={cn("flex flex-col transition-[gap] duration-500 ease-[cubic-bezier(0.2,0,0,1)]", navigationExpanded ? "gap-3" : "gap-2")}>
            {adminNavigationGroups.map((group, groupIndex) => {
              const visibleItems = group.items.filter((item) => {
                const permission = permissionForAdminPath(item.href);
                return !permission || !session?.user?.cmsPermissions || session.user.cmsPermissions.includes(permission);
              });
              if (visibleItems.length === 0) return null;
              return (
              <div
                key={group.key}
                className={cn(
                  "flex w-full flex-col transition-[gap] duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
                  navigationExpanded ? "gap-0.5" : "gap-1.5"
                )}
              >
                {navigationExpanded ? (
                  <p className="mx-5 mb-1 mt-1 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {group.label}
                  </p>
                ) : null}
                {visibleItems.map((item) => {
                  const Icon = iconMap[item.key] ?? Stack;
                  return (
                    <SidebarItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={Icon}
                      active={isActive(item)}
                      onClick={() => handleNavigation(item.href)}
                      expanded={navigationExpanded}
                      showTooltip={!navigationExpanded}
                      activating={activatingHref === item.href}
                    />
                  );
                })}
                {groupIndex < adminNavigationGroups.length - 1 ? (
                  <div
                    className={cn(
                      "shrink-0 rounded-full bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
                      navigationExpanded ? "mx-5 mt-3 h-px" : "mx-auto my-1 h-1 w-1"
                    )}
                  />
                ) : null}
              </div>
              );
            })}
          </div>
        </SidebarScrollArea>

        <div className="w-full shrink-0 border-t border-white/5 py-3">
          <div className={cn("flex w-full flex-col transition-[gap] duration-500 ease-[cubic-bezier(0.2,0,0,1)]", navigationExpanded ? "gap-1" : "gap-2")}>
            <SidebarItem
              href={publicHomeUrl}
              label="Voltar ao site"
              icon={ArrowSquareOut}
              onClick={() => handleNavigation(publicHomeUrl)}
              expanded={navigationExpanded}
              showTooltip={!navigationExpanded}
              activating={activatingHref === publicHomeUrl}
              nativeNavigation
            />
            <SidebarItem
              label={loggingOut ? "Saindo..." : "Encerrar sessão"}
              icon={SignOut}
              onClick={handleLogout}
              expanded={navigationExpanded}
              destructive
              showTooltip={!navigationExpanded}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <aside
        data-admin-sidebar-panel="true"
        className={cn(
          "relative z-20 hidden h-dvh shrink-0 overflow-hidden border-r border-white/5 text-white transition-[width] duration-500 ease-[cubic-bezier(0.2,0,0,1)] lg:flex",
          expanded ? "w-[230px]" : "w-[64px]"
        )}
      >
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative flex h-full w-full flex-col">
          {renderNavigation({ navigationExpanded: expanded })}
        </div>
      </aside>

      {mobileOpen ? (
        <div data-developer-mobile-navigation="true" className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar navegação"
            className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm"
            onClick={onCloseMobile}
          />

          <aside className="relative flex h-dvh w-[280px] flex-col overflow-hidden border-r border-white/5 text-white shadow-[0_32px_80px_rgba(15,23,42,0.32)]">
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />

            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Fechar menu"
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white shadow-sm backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/10 active:scale-95"
            >
              <X size={18} weight="bold" />
            </button>

            <div className="relative flex h-full flex-col">
              {renderNavigation({ navigationExpanded: true })}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
