import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const repositoryRoot = path.resolve(frontendRoot, "..", "..");
const publicRoot = path.join(frontendRoot, "public");

async function source(relativePath) {
  return fs.readFile(path.join(frontendRoot, relativePath), "utf8");
}

function count(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

async function verifyCanonicalVideos() {
  const content = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "site", "backend", "storage", "content.json"), "utf8")
  );
  const videos = [];

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.type === "video" && typeof value.src === "string") videos.push(value);
    Object.values(value).forEach(visit);
  }

  visit(content.homePage);
  assert.ok(videos.length > 0, "A Home precisa manter as mídias de vídeo canônicas.");

  for (const video of videos) {
    assert.match(video.src, /\.[a-f0-9]{12}\.webm$/i, `Vídeo sem hash de conteúdo: ${video.src}`);
    assert.match(video.poster ?? "", /\.(?:avif|jpe?g|png|webp)$/i, `Poster ausente: ${video.src}`);

    for (const url of [video.src, video.poster]) {
      const normalized = url.startsWith("/public/") ? url.slice("/public".length) : url;
      const file = path.join(publicRoot, normalized.replace(/^\/+/, ""));
      const bytes = await fs.readFile(file);
      if (url === video.src) {
        assert.equal(bytes.includes(Buffer.from("OpusHead")), false, `Loop com áudio: ${url}`);
      }
    }
  }
}

async function verifyLoadingAndDomContracts() {
  const [
    hero,
    operations,
    services,
    mapWrapper,
    header,
    search,
    home,
    presentedVideo,
    rootLayout,
    headerLoader,
  ] = await Promise.all([
    source("src/components/home/HeroCarousel.tsx"),
    source("src/components/home/OperationsCarousel.tsx"),
    source("src/components/home/ServiceLinesRebrand.tsx"),
    source("src/components/home/BrazilMapWrapper.tsx"),
    source("src/components/layout/SiteHeader.tsx"),
    source("src/components/search/SiteSearchPanel.tsx"),
    source("src/app/page.tsx"),
    source("src/components/media/PresentedVideo.tsx"),
    source("src/app/layout.tsx"),
    source("src/components/layout/SiteHeaderLoader.tsx"),
  ]);

  assert.match(hero, /preparedSlides/);
  assert.match(hero, /<HeroBackdrop\b/);
  assert.match(hero, /sizes="384px"/);
  assert.equal(count(hero, /<HeroMedia\b/g), 2, "Hero voltou a duplicar árvores de mídia.");
  assert.match(hero, /imageSizes="100vw"/);
  assert.match(hero, /imageSizes="\(max-width: 1023px\) 100vw, 52vw"/);
  assert.match(hero, /fetchPriority="low"/);
  assert.doesNotMatch(hero, /preload="metadata"/);

  assert.equal(
    count(operations, /spotlightSlides\.map\(/g),
    1,
    "Operações deve manter uma única árvore responsiva."
  );
  assert.match(operations, /sizes=\{active\s*\?/);
  assert.match(services, /visiblePage\.map\(/);
  assert.doesNotMatch(services, /pages\.map\(\(page/);

  assert.match(mapWrapper, /IntersectionObserver/);
  assert.match(mapWrapper, /rootMargin:\s*"600px 0px"/);
  assert.match(mapWrapper, /min-h-\[1340px\].*lg:min-h-\[900px\]/);
  assert.match(mapWrapper, /shouldRender\s*\?\s*<BrazilMap/);
  assert.doesNotMatch(header, /fetch\s*\(/);
  assert.match(header, /prefetch=\{[^\n]*drawerOpen/);
  assert.match(search, /prefetch=\{open\}/);
  assert.match(home, /Promise\.all\(/);
  assert.match(home, /src=\{cert\.src\}[\s\S]{0,180}width=\{170\}[\s\S]{0,80}height=\{88\}/);
  assert.match(home, /certifications-marquee-copy/);
  assert.match(rootLayout, /<Suspense/);
  assert.doesNotMatch(rootLayout, /fetchPublicContent/);
  assert.match(headerLoader, /await fetchPublicContent\(\)/);

  assert.match(presentedVideo, /preload\s*=\s*"none"/);
  assert.match(presentedVideo, /sourcesAttached\s*&&\s*responsiveMobileSrc/);
  assert.match(presentedVideo, /effectivePoster\s*\?\s*preload\s*:\s*"metadata"/);
  assert.match(presentedVideo, /shouldAttachDeferredSource[\s\S]{0,300}\|\|\s*!effectivePoster/);
  assert.match(presentedVideo, /prefers-reduced-motion:\s*reduce/);
  assert.match(presentedVideo, /saveData/);
}

async function verifyAccessibilityContracts() {
  const [quickActions, testimonials, consent, hero, services, header] = await Promise.all([
    source("src/components/home/QuickActionsSection.tsx"),
    source("src/components/home/TestimonialsCarousel.tsx"),
    source("src/components/analytics/ConsentBanner.tsx"),
    source("src/components/home/HeroCarousel.tsx"),
    source("src/components/home/ServiceLinesRebrand.tsx"),
    source("src/components/layout/SiteHeader.tsx"),
  ]);

  assert.doesNotMatch(quickActions, /\breadOnly\b/);
  assert.match(quickActions, /type="button"/);
  assert.match(testimonials, /role="img"\s+aria-label=\{`\$\{feedback\.rating\} de 5 estrelas`\}/);
  assert.doesNotMatch(testimonials, /h-6 w-6/);
  assert.match(consent, /transition-\[background-color,box-shadow\]/);
  assert.match(hero, /inert=\{!isCurrent\}/);
  assert.match(hero, /h-11 w-11/);
  assert.match(services, /h-11 w-11/);
  assert.match(header, /inert=\{!drawerOpen\}/);
}

await Promise.all([
  verifyCanonicalVideos(),
  verifyLoadingAndDomContracts(),
  verifyAccessibilityContracts(),
]);

console.log("[home-contracts] OK: mídia, carregamento, DOM e acessibilidade validados.");
