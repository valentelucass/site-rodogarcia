import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const repositoryRoot = path.resolve(frontendRoot, "..", "..");
const publicRoot = path.join(frontendRoot, "public");
const require = createRequire(import.meta.url);

const assets = [
  {
    url: "/certificados/iso-9001.9371c4a6c19f.webp",
    legacyUrl: "/certificados/LOGO ISO 9001.svg",
    width: 841,
    height: 800,
    maxBytes: 80_000,
    minPsnr: 38,
    sha256: "9371c4a6c19f27f9e85c67424e74b933a67a5ff83da2e1c2aa645619492bfbcb",
  },
  {
    url: "/certificados/policia-civil-sp.57269b3e1bdd.webp",
    legacyUrl: "/certificados/pc-sp.webp",
    width: 619,
    height: 800,
    maxBytes: 80_000,
    minPsnr: 33,
    sha256: "57269b3e1bdd1a719a4c819c8b8c335f94ac81a796e78b02140b2e8eb2a63847",
  },
  {
    url: "/certificados/ibama.7198f261a1ee.webp",
    legacyUrl: "/certificados/ibama.webp",
    width: 822,
    height: 800,
    maxBytes: 50_000,
    minPsnr: 38,
    sha256: "7198f261a1ee696d01212fe091ca2eeb724acdd9b44c087428f3c40e11300713",
  },
  {
    url: "/36-anos-rodogarcia.4c43a61efb46.webp",
    legacyUrl: "/foto2.webp",
    width: 1440,
    height: 785,
    maxBytes: 90_000,
    minPsnr: 35,
    sha256: "4c43a61efb46746710dcc4cfd343368ab281a0595bad681254b52f2f07d44883",
  },
  {
    url: "/operacao-indoor-rodogarcia.d6f36f33e258.webp",
    legacyUrl: "/foto4.webp",
    width: 1280,
    height: 1280,
    maxBytes: 85_000,
    minPsnr: 35,
    sha256: "d6f36f33e2580f846d7f913b8dd884bf6d1b36f0f92b0f9affe8d42cbf570acd",
  },
  {
    url: "/motorista-rodogarcia.abbf7875cfae.webp",
    legacyUrl: "/caminhoneiro1.webp",
    width: 1600,
    height: 679,
    maxBytes: 85_000,
    minPsnr: 35,
    sha256: "abbf7875cfae6a21a6716fe33528f243a4a8dff29f05f1248f73bafcf2cc49b2",
  },
];

const referenceFiles = [
  "site/backend/storage/content.json",
  "site/backend/storage/site-texts.json",
  "site/frontend/src/app/page.tsx",
  "site/frontend/src/app/para-empresas/page.tsx",
  "site/frontend/src/app/sobre/page.tsx",
  "site/frontend/src/app/trabalhe-conosco/page.tsx",
  "site/frontend/src/components/internal/ComplianceSection.tsx",
];

const additionalImmutableAssets = [
  { url: "/favicon-rodogarcia-20260718.svg", sha256: "e48f60dc912be33b9c4af9bfecf4529f33e2abb5868616c1d4c7a25c314b3de1" },
  { url: "/home-atendimento-poster.741b9476c78e.webp", sha256: "741b9476c78ebfbf8c0fbdec8149ca0f472b073cde9001f31c51540badbb88b5" },
  { url: "/home-atendimento-silent.c9c72d26fc63.webm", sha256: "c9c72d26fc636ebbca1d66efd81f6a845d118c022dfbe852c101527566cbc58b" },
  { url: "/home-caminhoes-poster.f5746017ec72.webp", sha256: "f5746017ec72d30f33ba3f871ebbbe99bd5f573f86259671405062f1511410b2" },
  { url: "/home-caminhoes-silent.3bee1a633929.webm", sha256: "3bee1a633929f38f160ba147943bfb6e068259732c4b21a0f879e73bc66a39aa" },
  { url: "/home-caminhoneiro-poster.521ac36f8173.webp", sha256: "521ac36f8173f6ed99c7a279538e2f2b95c223fcc99299364fd837860c13c649" },
  { url: "/home-caminhoneiro-silent.537fea4cb953.webm", sha256: "537fea4cb953f2d9190618e31d83cf02f4cf9e0ae536e5104ace4a2cb1ec1011" },
  { url: "/home-operacao-poster.5f976502a5c8.webp", sha256: "5f976502a5c8b77666f59a2ce89c99cae7be1b06428ab3317088eb9e7142d60c" },
  { url: "/home-operacao-silent.6e2fa78ac5d9.webm", sha256: "6e2fa78ac5d9a6324fa253c4759a54f78032a1c8445e77f9a681e56135fdb424" },
  { url: "/media/canonical/1-1772986684149.webp", sha256: "bcb408d72886d19b6313bcb991b8dc41ae79411b7d0c88a82b0e42720ac75ed2" },
  { url: "/media/canonical/2-1772986687188.webp", sha256: "f03440983b991aaef06b9a58109ffa6c42c270a08d6860e150d7681586410fc4" },
  { url: "/media/canonical/3-1772986690224.webp", sha256: "bb8ee45160b36a6805c7a9c828914023d491e1260533d110033e374ae59f6665" },
  { url: "/media/canonical/gemini_generated_image_43k01d43k01d43k0-1772734949859.webp", sha256: "89ba6a3f2853447e71a8cb8e69d3b00634ace55173c1a040d1ea016ae3e21501" },
];

const mutableAssetUrls = [
  "/caminhoes1.webm",
  "/caminhoneiro.webm",
  "/caminhoneiro1.webp",
  "/certificados/LOGO ISO 9001.svg",
  "/certificados/ibama.webp",
  "/certificados/pc-sp.webp",
  "/foto2.webp",
  "/foto4.webp",
  "/Vídeo_de_Operação_Gerado.webm",
];

function publicPath(url) {
  return path.join(publicRoot, ...url.split("/").filter(Boolean));
}

function psnr(reference, candidate) {
  assert.equal(reference.length, candidate.length, "Buffers comparados precisam ter o mesmo tamanho");

  let squaredError = 0;
  for (let index = 0; index < reference.length; index += 1) {
    const delta = reference[index] - candidate[index];
    squaredError += delta * delta;
  }

  const meanSquaredError = squaredError / reference.length;
  return meanSquaredError === 0
    ? Number.POSITIVE_INFINITY
    : 10 * Math.log10((255 * 255) / meanSquaredError);
}

async function flattenedRgb(filePath, width, height, background) {
  return sharp(filePath, { failOn: "error" })
    .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .flatten({ background })
    .removeAlpha()
    .raw()
    .toBuffer();
}

async function verifyAsset(asset) {
  const optimizedPath = publicPath(asset.url);
  const legacyPath = publicPath(asset.legacyUrl);
  const [optimizedBytes, legacyStats] = await Promise.all([
    fs.readFile(optimizedPath),
    fs.stat(legacyPath),
  ]);
  const metadata = await sharp(optimizedBytes, { failOn: "error" }).metadata();

  assert.equal(metadata.format, "webp", `${asset.url} precisa continuar em WebP`);
  assert.equal(metadata.width, asset.width, `${asset.url} mudou de largura`);
  assert.equal(metadata.height, asset.height, `${asset.url} mudou de altura`);
  assert.ok(optimizedBytes.length <= asset.maxBytes, `${asset.url} excedeu ${asset.maxBytes} bytes`);
  assert.ok(optimizedBytes.length < legacyStats.size, `${asset.url} não reduziu o arquivo legado`);

  const digest = crypto.createHash("sha256").update(optimizedBytes).digest("hex");
  assert.equal(digest, asset.sha256, `${asset.url} mudou sem receber um novo nome versionado`);
  assert.ok(asset.url.includes(digest.slice(0, 12)), `${asset.url} não contém o hash do conteúdo`);

  for (const background of ["#ffffff", "#020617"]) {
    const [reference, candidate] = await Promise.all([
      flattenedRgb(legacyPath, asset.width, asset.height, background),
      flattenedRgb(optimizedPath, asset.width, asset.height, background),
    ]);
    const measuredPsnr = psnr(reference, candidate);
    assert.ok(
      measuredPsnr >= asset.minPsnr,
      `${asset.url} perdeu fidelidade em ${background}: PSNR ${measuredPsnr.toFixed(2)} dB`
    );
  }
}

async function verifyReferences() {
  const sources = await Promise.all(
    referenceFiles.map(async (relativePath) => ({
      relativePath,
      content: await fs.readFile(path.join(repositoryRoot, relativePath), "utf8"),
    }))
  );
  const combined = sources.map(({ content }) => content).join("\n");

  for (const asset of assets) {
    assert.ok(combined.includes(asset.url), `Nenhum fallback ou conteúdo referencia ${asset.url}`);
    const lingeringReferences = sources
      .filter(({ content }) => content.includes(asset.legacyUrl))
      .map(({ relativePath }) => relativePath);
    assert.deepEqual(
      lingeringReferences,
      [],
      `A URL legada ${asset.legacyUrl} ainda é usada por ${lingeringReferences.join(", ")}`
    );
  }
}

async function verifyCacheHeaders() {
  const nextConfig = require(path.join(frontendRoot, "next.config.js"));
  const configuredHeaders = await nextConfig.headers();
  const cacheHeaderBySource = new Map(
    configuredHeaders.map((entry) => [
      entry.source,
      entry.headers.find(({ key }) => key.toLowerCase() === "cache-control")?.value,
    ])
  );
  const immutableValue = "public, max-age=31536000, immutable";

  for (const immutableAsset of [
    ...assets.map(({ url, sha256 }) => ({ url, sha256 })),
    ...additionalImmutableAssets,
  ]) {
    const { url, sha256 } = immutableAsset;
    const bytes = await fs.readFile(publicPath(url));
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, sha256, `${url} mudou sem receber uma nova versão`);
    assert.equal(cacheHeaderBySource.get(url), immutableValue, `${url} precisa de cache imutável`);
  }

  for (const url of mutableAssetUrls) {
    assert.equal(cacheHeaderBySource.get(url), undefined, `${url} precisa continuar revalidável`);
  }
}

await Promise.all(assets.map(verifyAsset));
await Promise.all([verifyReferences(), verifyCacheHeaders()]);

const legacyBytes = (
  await Promise.all(assets.map(({ legacyUrl }) => fs.stat(publicPath(legacyUrl))))
).reduce((total, stats) => total + stats.size, 0);
const optimizedBytes = (
  await Promise.all(assets.map(({ url }) => fs.stat(publicPath(url))))
).reduce((total, stats) => total + stats.size, 0);

console.log(
  `[static-assets] OK: ${assets.length} derivados, ${legacyBytes} -> ${optimizedBytes} bytes (${Math.round(
    (1 - optimizedBytes / legacyBytes) * 100
  )}% de redução), referências e cache validados.`
);
