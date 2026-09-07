interface KnownImageDimensions {
  width: number;
  height: number;
}

const PUBLIC_MEDIA_ALIASES: Readonly<Record<string, string>> = {
  "/foto2.webp": "/36-anos-rodogarcia.4c43a61efb46.webp",
  "/foto4.webp": "/operacao-indoor-rodogarcia.d6f36f33e258.webp",
  "/foto5.webp": "/capilaridade-rodogarcia.d6d0bb115823.webp",
  "/caminhoneiro1.webp": "/motorista-rodogarcia.abbf7875cfae.webp",
  "/caminhoes1.webm": "/home-caminhoes-silent.3bee1a633929.webm",
  "/caminhoneiro.webm": "/home-caminhoneiro-silent.537fea4cb953.webm",
  "/Vídeo_de_Operação_Gerado.webm": "/home-operacao-silent.6e2fa78ac5d9.webm",
};

const VIDEO_POSTERS: Readonly<Record<string, string>> = {
  "/home-atendimento-silent.c9c72d26fc63.webm":
    "/home-atendimento-poster.741b9476c78e.webp",
  "/home-caminhoes-silent.3bee1a633929.webm":
    "/home-caminhoes-poster.f5746017ec72.webp",
  "/home-caminhoneiro-silent.537fea4cb953.webm":
    "/home-caminhoneiro-poster.521ac36f8173.webp",
  "/home-operacao-silent.6e2fa78ac5d9.webm":
    "/home-operacao-poster.5f976502a5c8.webp",
};

const HOME_CERTIFICATION_ALIASES: Readonly<Record<string, string>> = {
  "/certificados/LOGO ISO 9001.svg": "/certificados/iso-9001-marquee.96db5a941c71.webp",
  "/certificados/iso-9001.9371c4a6c19f.webp": "/certificados/iso-9001-marquee.96db5a941c71.webp",
  "/certificados/certificado-sassmaq.webp": "/certificados/sassmaq-marquee.2bd290b6d955.webp",
  "/certificados/ecovadis.webp": "/certificados/ecovadis-marquee.328117d0b616.webp",
  "/certificados/pf.webp": "/certificados/policia-federal-marquee.e06c0a6ec034.webp",
  "/certificados/pc-sp.webp": "/certificados/policia-civil-sp-marquee.cf85d95a8c02.webp",
  "/certificados/policia-civil-sp.57269b3e1bdd.webp": "/certificados/policia-civil-sp-marquee.cf85d95a8c02.webp",
  "/certificados/exercito-br.webp": "/certificados/exercito-brasileiro-marquee.25640e0eb885.webp",
  "/certificados/ibama.webp": "/certificados/ibama-marquee.4cdbe07db023.webp",
  "/certificados/ibama.7198f261a1ee.webp": "/certificados/ibama-marquee.4cdbe07db023.webp",
};

const KNOWN_IMAGE_DIMENSIONS: Readonly<Record<string, KnownImageDimensions>> = {
  "/36-anos-rodogarcia.4c43a61efb46.webp": { width: 1440, height: 785 },
  "/operacao-indoor-rodogarcia.d6f36f33e258.webp": { width: 1280, height: 1280 },
  "/capilaridade-rodogarcia.d6d0bb115823.webp": { width: 1280, height: 551 },
  "/motorista-rodogarcia.abbf7875cfae.webp": { width: 1600, height: 679 },
  "/home-atendimento-poster.741b9476c78e.webp": { width: 960, height: 540 },
  "/home-caminhoes-poster.f5746017ec72.webp": { width: 960, height: 540 },
  "/home-caminhoneiro-poster.521ac36f8173.webp": { width: 960, height: 540 },
  "/home-operacao-poster.5f976502a5c8.webp": { width: 960, height: 540 },
};

export function canonicalPublicMediaUrl(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "";

  const normalized = trimmed.startsWith("/public/")
    ? trimmed.slice("/public".length)
    : trimmed;
  const queryIndex = normalized.indexOf("?");
  const pathname = queryIndex >= 0 ? normalized.slice(0, queryIndex) : normalized;
  const suffix = queryIndex >= 0 ? normalized.slice(queryIndex) : "";
  const aliased = PUBLIC_MEDIA_ALIASES[pathname];
  return aliased ? `${aliased}${suffix}` : normalized;
}

export function resolvePublicImage(value: string | undefined): {
  url: string;
  width?: number;
  height?: number;
} {
  const url = canonicalPublicMediaUrl(value);
  const pathname = url.split("?", 1)[0] ?? "";
  return { url, ...KNOWN_IMAGE_DIMENSIONS[pathname] };
}

export function resolvePublicVideoPoster(
  videoSource: string | undefined,
  configuredPoster: string | undefined
): string {
  const poster = canonicalPublicMediaUrl(configuredPoster);
  if (poster) return poster;
  const video = canonicalPublicMediaUrl(videoSource).split("?", 1)[0] ?? "";
  return VIDEO_POSTERS[video] ?? "";
}

export function canonicalHomeCertificationUrl(
  value: string | undefined,
  fallback: string
): string {
  const normalized = canonicalPublicMediaUrl(value);
  return (HOME_CERTIFICATION_ALIASES[normalized] ?? normalized) || fallback;
}

export function nextOptimizedImageUrl(
  value: string | undefined,
  width: number,
  quality = 70
): string {
  const url = canonicalPublicMediaUrl(value);
  if (!url || url.startsWith("/_next/image")) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}
