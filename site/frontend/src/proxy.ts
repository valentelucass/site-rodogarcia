import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const isDevelopment = process.env.NODE_ENV === "development";

function contentSecurityPolicy(nonce: string, frameAncestors: "'none'" | "'self'") {
  return [
    "default-src 'self'",
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      isDevelopment ? "'unsafe-eval'" : "",
      "https://www.googletagmanager.com",
      "https://www.clarity.ms",
    ],
    [
      "connect-src",
      "'self'",
      "https://www.google-analytics.com",
      "https://*.google-analytics.com",
      "https://www.googletagmanager.com",
      "https://*.clarity.ms",
    ],
    [
      "img-src",
      "'self'",
      "data:",
      "blob:",
      "https://www.google-analytics.com",
      "https://*.google-analytics.com",
      "https://*.clarity.ms",
    ],
    ["media-src", "'self'", "blob:"],
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src 'self'",
    `frame-ancestors ${frameAncestors}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ]
    .map((directive) =>
      Array.isArray(directive)
        ? directive.filter(Boolean).join(" ")
        : directive
    )
    .join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isCmsPreview = request.nextUrl.searchParams.get("preview") === "cms";
  const policy = contentSecurityPolicy(nonce, isCmsPreview ? "'self'" : "'none'");
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set(
    "Cache-Control",
    // Diretivas de Cache-Control ignoram maiusculas/minusculas. O casing evita
    // apenas o falso positivo do compactador embutido no Next 16.3.3, cujo
    // filtro procura literalmente `no-transform`. Assim o servidor de origem
    // ainda entrega gzip, enquanto intermediarios como a Cloudflare continuam
    // proibidos de alterar o HTML e de injetar o decodificador de e-mail.
    "private, no-store, no-cache, max-age=0, must-revalidate, NO-TRANSFORM"
  );
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!(?:api|admin|uploads|public)(?:/|$)|_next/(?:static|image)(?:/|$)|(?:robots\\.txt|sitemap\\.xml)$|.*\\.(?:avif|css|gif|ico|jpe?g|js|json|map|mp4|ogg|png|svg|webm|webp|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
