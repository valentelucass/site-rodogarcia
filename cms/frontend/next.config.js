const path = require("path");
const backendUrl = (
  process.env.CMS_BACKEND_INTERNAL_URL ||
  // Mantido enquanto ambientes de desenvolvimento antigos ainda definem este nome.
  process.env.CMS_BACKEND_PROXY_URL ||
  "http://127.0.0.1:31013"
).replace(/\/+$/, "");
const isProduction = process.env.NODE_ENV === "production";
const landingBuilderPublicUrl = process.env.LANDING_BUILDER_PUBLIC_URL?.trim().replace(/\/+$/, "") ?? "";
const nextBuildDistDir = process.env.NEXT_BUILD_DIST_DIR?.trim() || ".next";

if (![".next", ".next.test"].includes(nextBuildDistDir)) {
  throw new Error("NEXT_BUILD_DIST_DIR deve ser .next ou .next.test.");
}

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
    : []),
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  basePath: "/admin",
  // O hardening usa .next.test para não tocar no cache do next dev iniciado
  // manualmente. Em todos os fluxos normais o diretório continua sendo .next.
  distDir: nextBuildDistDir,
  output: "standalone",
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    externalDir: true,
    // O backend aceita vídeos de até 64 MB; reservamos margem para multipart.
    proxyClientMaxBodySize: "70mb",
  },
  turbopack: { root: path.join(__dirname, "../..") },
  async headers() {
    return [{
      source: "/:path*",
      headers: securityHeaders,
    }];
  },
  async rewrites() {
    return {
      beforeFiles: isProduction ? [] : [
        ...(landingBuilderPublicUrl
          ? [{
              source: "/landing-media/:path*",
              destination: `${landingBuilderPublicUrl}/landing-media/:path*`,
              basePath: false,
            }]
          : []),
        // Chamadas do app usam caminhos raiz. Pelo gateway /admin elas chegam ao
        // frontend público; ao abrir o CMS diretamente no DEV, este proxy local
        // mantém a mesma superfície sem expor a URL privada ao navegador.
        { source: "/api/:path*", destination: `${backendUrl}/api/:path*`, basePath: false },
        { source: "/uploads/:path*", destination: `${backendUrl}/uploads/:path*`, basePath: false },
      ],
    };
  },
};

module.exports = nextConfig;
