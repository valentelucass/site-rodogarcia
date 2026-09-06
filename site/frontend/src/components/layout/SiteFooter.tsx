import { type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import type { FooterGlobalContent } from "@/types/content";
import { DEFAULT_FOOTER_LINKS } from "@/lib/footerLinksDefaults";
import { fetchPublicContent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { site } from "@/lib/routes";
import CookieSettingsButton from "@/components/CookieSettingsButton";
import { FooterSocialLink } from "./FooterSocialLink";

const CURRENT_YEAR = new Date().getFullYear();

function ordered<T extends { order?: number }>(items: T[] = []) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function SiteFooter() {
  const content = await fetchPublicContent();
  const footer: FooterGlobalContent = content.success && content.data
    ? content.data.footerLinks.footer
    : DEFAULT_FOOTER_LINKS.footer;
  const columns = ordered(footer.columns);
  const socialLinks = ordered(footer.socialLinks);
  const bottomLinks = ordered(footer.bottomLinks);

  return (
    <footer
      className="relative overflow-hidden bg-slate-950 pt-16 pb-8 text-[var(--color-surface)]"
      id="contato"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,78,216,0.15),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 border-b border-white/10 pb-12 sm:gap-10 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 flex flex-col gap-5 border-b border-white/10 pb-8 sm:col-span-2 lg:col-span-1 lg:border-b-0 lg:pb-0">
            <Link href={site.home} aria-label="Rodogarcia - Página inicial">
              <Image
                src="/logo.svg"
                alt="Rodogarcia"
                width={160}
                height={30}
                className="brightness-0 invert"
              />
            </Link>
            <p className="max-w-[34ch] text-sm leading-7 text-white/60">
              {footer.description}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <FooterButton href={footer.proposalButton.url} className="bg-[var(--primary)] font-semibold hover:bg-[var(--color-primary-strong)] hover:shadow-[0_16px_36px_rgba(29,78,216,0.22)]">
                {footer.proposalButton.label}
              </FooterButton>
              <FooterButton href={footer.supportButton.url} className="bg-emerald-700 font-medium shadow-[0_18px_44px_rgba(4,120,87,0.3)] hover:bg-emerald-800 hover:shadow-[0_22px_52px_rgba(6,95,70,0.34)] focus-visible:ring-emerald-700/24">
                {footer.supportButton.label}
              </FooterButton>
            </div>
          </div>

          {columns.map((column) => (
            <FooterColumn key={column.id} title={column.title}>
              {ordered(column.links).map((link) => (
                <FooterLink key={link.id} href={link.url} external={link.external}>
                  {link.label}
                </FooterLink>
              ))}
            </FooterColumn>
          ))}

          <FooterColumn title={footer.serviceHoursTitle}>
            {footer.serviceHours.map((hour) => (
              <li key={hour} className="text-sm leading-7 text-white/60">
                {hour}
              </li>
            ))}
          </FooterColumn>

          <FooterColumn
            title={footer.socialTitle}
            className="col-span-2 sm:col-span-1"
            listClassName="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-2.5"
          >
            {socialLinks.map((link) => {
              return (
                <FooterSocialLink
                  key={link.id}
                  href={link.url}
                  label={link.label}
                  icon={link.icon}
                />
              );
            })}
          </FooterColumn>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-xs text-white/55 sm:pt-8 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <span className="max-w-[32ch] shrink-0 leading-5">
            &copy; {CURRENT_YEAR} {footer.copyrightText}
          </span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-white/10 py-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:border-0 sm:py-0 lg:justify-center">
            {bottomLinks.map((link) => (
              <FooterInlineLink key={link.id} href={link.url} external={link.external}>
                {link.label}
              </FooterInlineLink>
            ))}
            <CookieSettingsButton />
          </div>
          <div className="flex shrink-0 flex-col gap-1 leading-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            <span>{footer.locationText}</span>
            <a href={footer.creditUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-white/70 transition-colors hover:text-white">{footer.creditText}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
  className,
  listClassName,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  listClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 pt-0 lg:pt-0",
        className
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
        {title}
      </h3>
      <ul className={cn("flex flex-col gap-2.5", listClassName)}>{children}</ul>
    </div>
  );
}

function isExternalHref(href: string, external?: boolean) {
  return (
    external ||
    href.startsWith("http") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function FooterButton({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const buttonClassName = cn(
    "inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 text-sm text-white transition-all duration-200 hover:-translate-y-0.5 sm:w-auto",
    className
  );

  if (isExternalHref(href)) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className={buttonClassName}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={buttonClassName}>
      {children}
    </Link>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  if (isExternalHref(href, external)) {
    return (
      <li>
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="block py-0.5 text-sm leading-7 text-white/60 transition-colors hover:text-white"
        >
          {children}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className="block py-0.5 text-sm leading-7 text-white/60 transition-colors hover:text-white"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterInlineLink({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const className = "transition-colors hover:text-white/70";

  if (isExternalHref(href, external)) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
