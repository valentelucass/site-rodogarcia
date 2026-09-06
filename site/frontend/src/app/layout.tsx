import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteHeaderLoader } from "@/components/layout/SiteHeaderLoader";
import { DEFAULT_HEADER_NAVIGATION } from "@/lib/headerNavigationDefaults";
import { seo } from "@/lib/routes";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rodogarcia Transportes | Logística com previsibilidade nacional",
    template: `%s | ${seo.siteName}`,
  },
  description:
    "Há mais de 35 anos conectando o Brasil com soluções de logística fracionada, distribuição e transporte especializado.",
  metadataBase: new URL(seo.baseUrl),
  icons: {
    icon: [{ url: "/favicon-rodogarcia-20260718.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: seo.siteName,
    images: [{ url: seo.defaultOgImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  name: "Rodogarcia Transportes",
  url: seo.baseUrl,
  logo: seo.absoluteUrl("/logo.svg"),
  image: seo.absoluteUrl(seo.defaultOgImage),
  description:
    "Soluções logísticas nacionais com transporte fracionado, distribuição e cargas especiais.",
  telephone: "0800 591 4557",
  areaServed: "BR",
  sameAs: [seo.baseUrl],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${spaceGrotesk.variable} ${plusJakarta.variable}`}
    >
      <body className="min-h-dvh">
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ShellLayout
          footer={<SiteFooter />}
          header={
            <Suspense
              fallback={<SiteHeader initialNavigation={DEFAULT_HEADER_NAVIGATION} />}
            >
              <SiteHeaderLoader />
            </Suspense>
          }
        >
          {children}
        </ShellLayout>
      </body>
    </html>
  );
}
