"use client";

import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";
import ClientPopup from "./ClientPopup";
import { SiteSearchProvider } from "@/components/search/SiteSearchProvider";

/** Renders the public-site chrome. Administrative routes are served by the CMS process. */
export function ShellLayout({
  children,
  footer,
  header,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  header: React.ReactNode;
}) {
  return (
    <AnalyticsProvider>
      <SiteSearchProvider>
        {header}
        <main>{children}</main>
        {footer}
        <ClientPopup />
      </SiteSearchProvider>
    </AnalyticsProvider>
  );
}
