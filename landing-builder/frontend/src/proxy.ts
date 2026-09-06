import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const isDevelopment = process.env.NODE_ENV === "development";
const NONCE_PATTERN = /^[A-Za-z0-9+/_=-]{16,160}$/;

function gatewayNonce(request: NextRequest): string {
  const candidate = request.headers.get("x-nonce") ?? "";
  const policy = request.headers.get("content-security-policy") ?? "";
  return NONCE_PATTERN.test(candidate) && policy.includes(`'nonce-${candidate}'`)
    ? candidate
    : Buffer.from(crypto.randomUUID()).toString("base64");
}

function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      isDevelopment ? "'unsafe-eval'" : "",
      "https://www.googletagmanager.com",
    ],
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
    "img-src 'self' data: blob: https://www.google-analytics.com https://*.google-analytics.com",
    "media-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ]
    .map((directive) =>
      Array.isArray(directive) ? directive.filter(Boolean).join(" ") : directive
    )
    .join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = gatewayNonce(request);
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!(?:api|landing-media|landing-assets)(?:/|$)|_next/(?:static|image)(?:/|$)|(?:robots\\.txt|sitemap\\.xml)$|.*\\.(?:avif|css|gif|ico|jpe?g|js|json|map|mp4|ogg|png|svg|webm|webp|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
