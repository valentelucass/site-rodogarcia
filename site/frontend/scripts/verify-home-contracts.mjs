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
    presentedImage,
    publicMedia,
    finalCta,
    tracking,
    testimonials,
    quickActions,
    proxy,
    rootLayout,
    headerLoader,
    globalStyles,
  ] = await Promise.all([
    source("src/components/home/HeroCarousel.tsx"),
    source("src/components/home/OperationsCarousel.tsx"),
    source("src/components/home/ServiceLinesRebrand.tsx"),
    source("src/components/home/BrazilMapWrapper.tsx"),
    source("src/components/layout/SiteHeader.tsx"),
    source("src/components/search/SiteSearchPanel.tsx"),
    source("src/app/page.tsx"),
    source("src/components/media/PresentedVideo.tsx"),
    source("src/components/media/PresentedImage.tsx"),
    source("src/lib/publicMedia.ts"),
    source("src/components/home/FinalQuoteCtaSection.tsx"),
    source("src/components/home/TrackingLookupSection.tsx"),
    source("src/components/home/TestimonialsCarousel.tsx"),
    source("src/components/home/QuickActionsSection.tsx"),
    source("src/proxy.ts"),
    source("src/app/layout.tsx"),
    source("src/components/layout/SiteHeaderLoader.tsx"),
    source("src/app/globals.css"),
  ]);

  assert.match(hero, /preparedSlides/);
  assert.match(hero, /<HeroBackdrop\b/);
  assert.match(hero, /PREPARE_NEXT_SLIDE_MS\s*=\s*5000/);
  assert.match(hero, /media\.thumbnailUrl\s*\|\|\s*media\.mediumUrl/);
  assert.match(hero, /sizes="128px"/);
  assert.match(hero, /quality=\{45\}/);
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
  assert.match(
    operations,
    /useState\([\s\S]{0,180}window\.matchMedia\(DESKTOP_QUERY\)\.matches/,
    "Desktop deve iniciar no layout correto sem uma medição móvel transitória."
  );
  assert.match(services, /visiblePage\.map\(/);
  assert.doesNotMatch(services, /pages\.map\(\(page/);

  assert.match(mapWrapper, /IntersectionObserver/);
  assert.match(mapWrapper, /rootMargin:\s*"600px 0px"/);
  assert.match(mapWrapper, /min-h-\[1340px\].*lg:min-h-\[900px\]/);
  assert.match(mapWrapper, /shouldRender\s*\?\s*<BrazilMap/);
  assert.doesNotMatch(header, /fetch\s*\(/);
  assert.match(header, /prefetch=\{[^\n]*drawerOpen/);
  assert.match(search, /prefetch=\{open\}/);
  assert.match(home, /fetchPublicContent\(\)\.catch/);
  assert.match(home, /homePage\.certifications/);
  assert.doesNotMatch(home, /fetchMediaSlots|mediaSlot\(|canonicalHomeCertificationUrl/);
  assert.match(home, /src=\{cert\.src\}[\s\S]{0,180}width=\{340\}[\s\S]{0,80}height=\{176\}/);
  assert.match(home, /certifications-marquee-copy/);
  assert.match(globalStyles, /@keyframes certifications-marquee/);
  assert.doesNotMatch(
    globalStyles,
    /\.certifications-marquee\s*\{[\s\S]{0,240}animation:\s*none\s*!important/,
    "A faixa de certificações não pode voltar a ser convertida em grade estática."
  );
  assert.match(rootLayout, /<Suspense/);
  assert.doesNotMatch(rootLayout, /fetchPublicContent/);
  assert.match(headerLoader, /await fetchPublicContent\(\)/);

  assert.match(presentedVideo, /preload\s*=\s*"none"/);
  assert.match(presentedVideo, /sourcesAttached\s*&&\s*responsiveMobileSrc/);
  assert.match(presentedVideo, /effectivePoster\s*\?\s*preload\s*:\s*"metadata"/);
  assert.match(presentedVideo, /shouldAttachDeferredSource[\s\S]{0,300}\|\|\s*!effectivePoster/);
  assert.match(
    presentedVideo,
    /attachedPoster\s*=\s*!deferUntilNearViewport\s*\|\|\s*wasInViewport[\s\S]{0,100}\?\s*effectivePoster\s*:\s*""/,
    "Vídeos adiados não devem baixar o poster antes de alcançar a viewport."
  );
  assert.match(presentedVideo, /poster=\{attachedPoster\s*\|\|\s*undefined\}/);
  assert.match(presentedVideo, /prefers-reduced-motion:\s*reduce/);
  assert.match(presentedVideo, /saveData/);
  assert.match(presentedVideo, /rootMargin:\s*"0px"/);
  assert.match(presentedVideo, /resolvePublicVideoPoster/);
  assert.match(presentedImage, /thumbnailUrl/);
  assert.match(presentedImage, /buildOptimizedSrcSet/);
  assert.match(
    presentedImage,
    /VERIFIED_DERIVATIVE_BRIDGE_WIDTHS\s*=\s*\[640\]/,
    "Imagens com derivadas devem cobrir a lacuna móvel entre 420w e 960w."
  );
  assert.match(
    presentedImage,
    /const sourceUrl\s*=\s*canonicalPublicMediaUrl\(optimizerSourceUrl\)/,
    "A origem usada pelo otimizador precisa continuar restrita a mídia interna."
  );
  assert.match(
    presentedImage,
    /nextOptimizedImageUrl\([\s\S]{0,120}sourceUrl,[\s\S]{0,80}candidateWidth,[\s\S]{0,120}VERIFIED_DERIVATIVE_BRIDGE_QUALITY/,
    "O candidato intermediário deve passar pelo otimizador somente após normalizar a URL interna."
  );
  assert.match(presentedImage, /preload\(/);
  assert.match(presentedImage, /imageSrcSet:\s*srcSet\s*\|\|\s*undefined/);
  assert.match(publicMedia, /"\/foto2\.webp":\s*"\/36-anos-rodogarcia/);
  assert.match(publicMedia, /VIDEO_POSTERS/);
  assert.doesNotMatch(
    [finalCta, tracking, testimonials, quickActions].join("\n"),
    /framer-motion/,
    "A Home não deve carregar Framer Motion para transições simples."
  );
  assert.match(
    proxy,
    /"private, no-store, no-cache, max-age=0, must-revalidate, NO-TRANSFORM"/,
    "Documentos devem manter no-store e permitir gzip na origem sem liberar transformações intermediárias."
  );
  assert.match(proxy, /'strict-dynamic'/);
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
  assert.match(testimonials, /onTouchStart=\{handleTouchStart\}/);
  assert.match(testimonials, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(testimonials, /touch-pan-y/);
  assert.match(testimonials, /hidden h-11 w-11[\s\S]{0,600}sm:flex/);
  assert.match(consent, /transition-\[background-color\]/);
  assert.doesNotMatch(
    consent,
    /transition-colors[^\"]*\"\s*>\s*\{settings\.acceptAllLabel\}/,
    "Aceitar todos não deve animar outline-color."
  );
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
