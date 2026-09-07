import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const isDevelopment = process.env.NODE_ENV === "development";

function publicSiteOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:35180").origin;
  } catch {
    return "";
  }
}

function contentSecurityPolicy(nonce: string) {
  const siteOrigin = publicSiteOrigin();
  return [
    "default-src 'self'",
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      isDevelopment ? "'unsafe-eval'" : "",
    ],
    "connect-src 'self'",
    ["img-src", "'self'", "data:", "blob:", siteOrigin],
    ["media-src", "'self'", "blob:", siteOrigin],
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    ["frame-src", "'self'", siteOrigin],
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ]
    .map((directive) => Array.isArray(directive) ? directive.filter(Boolean).join(" ") : directive)
    .join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, max-age=0, must-revalidate, NO-TRANSFORM"
  );
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!(?:api|uploads)(?:/|$)|_next/(?:static|image)(?:/|$)|.*\\.(?:avif|css|gif|ico|jpe?g|js|json|map|mp4|ogg|png|svg|webm|webp|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
