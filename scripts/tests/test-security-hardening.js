const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const { createRequire } = require("module");
const net = require("net");
const os = require("os");
const path = require("path");

const FRONTEND_PORT = Number(process.env.SECURITY_TEST_FRONTEND_PORT ?? 42511);
const BACKEND_PORT = Number(process.env.SECURITY_TEST_BACKEND_PORT ?? 42010);
const CMS_BACKEND_PORT = Number(process.env.SECURITY_TEST_CMS_BACKEND_PORT ?? 42514);
const CMS_PORT = Number(process.env.SECURITY_TEST_CMS_PORT ?? 42513);
const LANDING_BUILDER_FIXTURE_PORT = Number(
  process.env.SECURITY_TEST_LANDING_BUILDER_PORT ?? 42515
);
const BROWSER_DEBUG_PORT = Number(process.env.SECURITY_TEST_BROWSER_DEBUG_PORT ?? 42516);
const HOST = "127.0.0.1";
const FRONTEND_URL = `http://${HOST}:${FRONTEND_PORT}`;
const BACKEND_URL = `http://${HOST}:${BACKEND_PORT}`;
const CMS_BACKEND_URL = `http://${HOST}:${CMS_BACKEND_PORT}`;
const CMS_URL = `http://${HOST}:${CMS_PORT}`;
const LANDING_BUILDER_FIXTURE_URL = `http://${HOST}:${LANDING_BUILDER_FIXTURE_PORT}`;
const ROOT_DIR = path.resolve(__dirname, "../..");
const CAMPAIGN_FIXTURE_PATH = "/publicidade-hardening";

function requiredTestArtifactDirectory(environmentName, relativePath) {
  const configuredPath = process.env[environmentName]?.trim();
  if (!configuredPath) {
    throw new Error(
      `${environmentName} e obrigatoria; use o artefato isolado ${relativePath.replace(/\\/g, "/")}.`
    );
  }

  const normalizedConfiguredPath = configuredPath.replace(/\\/g, "/");
  const normalizedExpectedPath = relativePath.replace(/\\/g, "/");
  if (normalizedConfiguredPath !== normalizedExpectedPath) {
    throw new Error(
      `${environmentName} deve apontar exatamente para ${normalizedExpectedPath} durante o hardening.`
    );
  }

  return path.join(ROOT_DIR, relativePath);
}

const BACKEND_ARTIFACT_DIR = requiredTestArtifactDirectory(
  "SECURITY_TEST_BACKEND_ARTIFACT_DIR",
  path.join("site", "backend", "dist.test")
);
const CMS_BACKEND_ARTIFACT_DIR = requiredTestArtifactDirectory(
  "SECURITY_TEST_CMS_BACKEND_ARTIFACT_DIR",
  path.join("cms", "backend", "dist.test")
);
const FRONTEND_ARTIFACT_DIR = requiredTestArtifactDirectory(
  "SECURITY_TEST_FRONTEND_ARTIFACT_DIR",
  path.join("site", "frontend", "dist-prod.test")
);
const CMS_ARTIFACT_DIR = requiredTestArtifactDirectory(
  "SECURITY_TEST_CMS_ARTIFACT_DIR",
  path.join("cms", "frontend", "dist-prod.test")
);

const SETUP_CODE = "test-setup-code-2026-safe";
const OWNER_EMAIL = "security-owner@rodogarcia.test";
const OWNER_PASSWORD = "SecurityOwner2026";
const LIMITED_ADMIN_EMAIL = "security-limited@rodogarcia.test";
const LIMITED_ADMIN_TEMPORARY_PASSWORD = "SecurityTemporary2026";
const LIMITED_ADMIN_PASSWORD = "SecurityUpdated2026";
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64"
);

const PROCESS_ENV_ALLOWLIST = new Set([
  "APPDATA",
  "COMSPEC",
  "HOME",
  "JAVA_HOME",
  "LANG",
  "LC_ALL",
  "LOCALAPPDATA",
  "NUMBER_OF_PROCESSORS",
  "OS",
  "PATH",
  "PATHEXT",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "USERPROFILE",
  "WINDIR",
]);

function isolatedProcessEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) =>
      PROCESS_ENV_ALLOWLIST.has(name.toUpperCase())
    )
  );
}

const BLOCKED_PATHS = [
  "/.env",
  "/README.md",
  "/docs/checklist-tecnico.md",
  "/scripts/tests/test-security-hardening.js",
  "/site/frontend/src/app/page.tsx",
  "/site/backend/storage/content.json",
  "/site/backend/.env",
  "/admin/.env",
];

const PUBLIC_PATHS = ["/", "/admin/auth/entrar", "/api/public/content", "/api/popup-config"];
const AUTH_PATHS = [
  "/api/admin/content",
  "/api/analytics/config",
  "/api/leads",
  "/api/popup-events",
  "/api/contact",
  "/api/quote",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const hardeningPorts = [
  { name: "backend", port: BACKEND_PORT },
  { name: "backend do CMS", port: CMS_BACKEND_PORT },
  { name: "site", port: FRONTEND_PORT },
  { name: "CMS", port: CMS_PORT },
  { name: "fixture do Landing Builder", port: LANDING_BUILDER_FIXTURE_PORT },
  { name: "depuracao do navegador", port: BROWSER_DEBUG_PORT },
];

function standaloneServerPath(artifactDir, label) {
  const serverPath = path.join(artifactDir, "server.js");
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Artefato standalone de ${label} ausente: ${serverPath}`);
  }
  return serverPath;
}

function springServerCommand(artifactDir, label) {
  const serverPath = path.join(artifactDir, "server.jar");
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Artefato Spring de ${label} ausente: ${serverPath}`);
  }
  return { command: "java", args: ["-jar", serverPath] };
}

function readRoutesManifest(artifactDir) {
  // O fluxo normal usa `.next`; o hardening pode usar `.next.test` para não
  // concorrer com um `next dev` manual. Ambos continuam dentro do artefato
  // isolado cuja raiz já foi validada acima.
  const manifestPath = [".next", ".next.test"]
    .map((directory) => path.join(artifactDir, directory, "routes-manifest.json"))
    .find((candidate) => fs.existsSync(candidate)) ?? path.join(artifactDir, ".next", "routes-manifest.json");
  let manifest;

  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Manifesto de rotas do site de teste invalido: ${manifestPath} (${error instanceof Error ? error.message : String(error)}).`
    );
  }

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`Manifesto de rotas do site de teste invalido: ${manifestPath}.`);
  }

  const rewrites = manifest.rewrites;
  if (!rewrites || typeof rewrites !== "object" || Array.isArray(rewrites)) {
    throw new Error(`Rewrites ausentes no manifesto de rotas do site de teste: ${manifestPath}.`);
  }

  const entries = Object.values(rewrites).flatMap((section) => (Array.isArray(section) ? section : []));
  if (entries.length === 0) {
    throw new Error(`Rewrites ausentes no manifesto de rotas do site de teste: ${manifestPath}.`);
  }

  return {
    manifestPath,
    entries,
    fallbackEntries: Array.isArray(rewrites.fallback) ? rewrites.fallback : [],
  };
}

function assertRewriteDestination({ manifestPath, entries }, source, destination) {
  const matchingEntries = entries.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      entry.source === source
  );

  if (matchingEntries.length === 0) {
    throw new Error(`Rewrite obrigatorio ${source} ausente em ${manifestPath}.`);
  }

  const invalidDestinations = matchingEntries
    .map((entry) => entry.destination)
    .filter((configuredDestination) => configuredDestination !== destination);
  if (invalidDestinations.length > 0) {
    throw new Error(
      `Rewrite ${source} de ${manifestPath} deve apontar para ${destination}; recebeu ${invalidDestinations
        .map((value) => String(value))
        .join(", ")}.`
    );
  }
}

function assertRewritePrecedes({ manifestPath, entries }, source, laterSource) {
  const sourceIndex = entries.findIndex(
    (entry) => entry && typeof entry === "object" && !Array.isArray(entry) && entry.source === source
  );
  const laterIndex = entries.findIndex(
    (entry) => entry && typeof entry === "object" && !Array.isArray(entry) && entry.source === laterSource
  );

  if (sourceIndex === -1 || laterIndex === -1 || sourceIndex >= laterIndex) {
    throw new Error(
      `Rewrite ${source} precisa preceder ${laterSource} em ${manifestPath}.`
    );
  }
}

function validateTestGatewayRewrites() {
  const routesManifest = readRoutesManifest(FRONTEND_ARTIFACT_DIR);
  assertRewriteDestination(routesManifest, "/api/:path*", `${BACKEND_URL}/api/:path*`);
  assertRewriteDestination(routesManifest, "/admin", `${CMS_URL}/admin`);
  assertRewriteDestination(routesManifest, "/admin/:path*", `${CMS_URL}/admin/:path*`);
  const cmsApiSources = [
    "/api/auth/:path*",
    "/api/admin/:path*",
    "/api/public/content",
    "/api/public/seo",
    "/api/public/media-slots",
    "/api/consent-settings",
    "/api/consent-events",
    "/api/tracking/:path*",
    "/api/analytics/:path*",
    "/api/popup-config",
    "/api/popup-events",
    "/api/leads",
    "/api/contact",
    "/api/quote",
    "/api/improvements",
  ];
  cmsApiSources.forEach((source) => {
    assertRewriteDestination(routesManifest, source, `${CMS_BACKEND_URL}${source}`);
    assertRewritePrecedes(routesManifest, source, "/api/:path*");
  });
  assertRewriteDestination(routesManifest, "/uploads/:path*", `${CMS_BACKEND_URL}/uploads/:path*`);
  assertRewriteDestination(
    routesManifest,
    "/public/uploads/:path*",
    `${CMS_BACKEND_URL}/uploads/:path*`
  );
  assertRewritePrecedes(routesManifest, "/public/uploads/:path*", "/public/:path*");
  const campaignFallback = routesManifest.fallbackEntries.find(
    (entry) => entry && typeof entry === "object" && entry.source === "/:path*"
  );
  if (campaignFallback?.destination !== `${LANDING_BUILDER_FIXTURE_URL}/:path*`) {
    throw new Error(
      `Fallback de campanha deve apontar para ${LANDING_BUILDER_FIXTURE_URL}/:path* em ${routesManifest.manifestPath}; recebeu ${String(campaignFallback?.destination ?? "ausente")}.`
    );
  }
}

function validateHardeningConfiguration() {
  const seenPorts = new Set();
  for (const { name, port } of hardeningPorts) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Porta de hardening invalida para ${name}: ${String(port)}.`);
    }
    if (seenPorts.has(port)) {
      throw new Error(`Portas de hardening devem ser distintas; ${port} foi repetida.`);
    }
    seenPorts.add(port);
  }

  springServerCommand(BACKEND_ARTIFACT_DIR, "backend público");
  springServerCommand(CMS_BACKEND_ARTIFACT_DIR, "backend do CMS");
  standaloneServerPath(CMS_ARTIFACT_DIR, "CMS");
  standaloneServerPath(FRONTEND_ARTIFACT_DIR, "site");
  validateTestGatewayRewrites();
}

function isPathInside(directory, candidate) {
  const relativePath = path.relative(directory, candidate);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

let frontendArtifactSharp;

async function validateFrontendImageRuntime() {
  const artifactRequire = createRequire(path.join(FRONTEND_ARTIFACT_DIR, "server.js"));
  const sharpEntry = artifactRequire.resolve("sharp");
  if (!isPathInside(FRONTEND_ARTIFACT_DIR, sharpEntry)) {
    throw new Error("O hardening resolveu o Sharp fora do artefato isolado do site.");
  }

  frontendArtifactSharp = artifactRequire("sharp");
  const rawInput = Buffer.alloc(64 * 64 * 3, 127);
  const { data, info } = await frontendArtifactSharp(rawInput, {
    raw: { width: 64, height: 64, channels: 3 },
  })
    .resize(16, 16)
    .webp({ quality: 75 })
    .toBuffer({ resolveWithObject: true });

  if (info.format !== "webp" || info.width !== 16 || info.height !== 16 || data.length >= rawInput.length) {
    throw new Error("O Sharp do artefato isolado nao executou o redimensionamento nativo.");
  }
}

function listFilesRecursively(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursively(entryPath) : [entryPath];
  });
}

async function findImageOptimizationCandidate() {
  const publicDirectory = path.join(FRONTEND_ARTIFACT_DIR, "public");
  const rasterExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);
  const candidates = listFilesRecursively(publicDirectory)
    .filter((filePath) => rasterExtensions.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => ({ filePath, size: fs.statSync(filePath).size }))
    .sort((left, right) => right.size - left.size);

  for (const candidate of candidates) {
    try {
      const metadata = await frontendArtifactSharp(candidate.filePath).metadata();
      if (
        Number.isInteger(metadata.width) &&
        metadata.width > 256 &&
        Number.isInteger(metadata.height) &&
        metadata.height > 0 &&
        (metadata.pages ?? 1) === 1
      ) {
        return {
          ...candidate,
          publicPath: `/${path.relative(publicDirectory, candidate.filePath).replace(/\\/g, "/")}`,
        };
      }
    } catch {
      // Continua procurando outro raster válido no próprio artefato.
    }
  }

  throw new Error("O artefato isolado nao possui raster adequado para testar /_next/image.");
}

async function checkNextImageOptimization() {
  const candidate = await findImageOptimizationCandidate();
  const optimizerUrl = new URL("/_next/image", FRONTEND_URL);
  optimizerUrl.searchParams.set("url", candidate.publicPath);
  optimizerUrl.searchParams.set("w", "128");
  optimizerUrl.searchParams.set("q", "75");

  const response = await fetch(optimizerUrl, {
    headers: { Accept: "image/webp" },
    redirect: "manual",
  });
  const body = Buffer.from(await response.arrayBuffer());
  let metadata = {};
  try {
    metadata = await frontendArtifactSharp(body).metadata();
  } catch {
    // A falha será refletida nos critérios abaixo sem expor detalhes do host.
  }

  return result(
    "NEXT image optimization uses artifact Sharp",
    response.status === 200 &&
      String(response.headers.get("content-type") || "").startsWith("image/") &&
      metadata.width === 128 &&
      Number.isInteger(metadata.height) &&
      metadata.height > 0 &&
      body.length > 0 &&
      body.length < candidate.size,
    `status=${response.status}; width=${String(metadata.width ?? "invalid")}; bytes=${body.length}/${candidate.size}`
  );
}

const HTTP_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function splitHttpList(value) {
  const parts = [];
  let current = "";
  let quoted = false;
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (quoted && character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      current += character;
      quoted = !quoted;
      continue;
    }
    if (character === "," && !quoted) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (quoted || escaped) return null;
  parts.push(current.trim());
  return parts;
}

function parseCacheControl(response) {
  const raw = String(response.headers.get("cache-control") || "");
  const parts = splitHttpList(raw);
  const directives = new Map();
  const errors = [];

  if (!raw.trim()) errors.push("header ausente");
  if (!parts) {
    errors.push("quoted-string invalida");
    return { raw, directives, errors };
  }

  for (const part of parts) {
    if (!part) {
      errors.push("diretiva vazia");
      continue;
    }
    const separator = part.indexOf("=");
    const rawName = separator === -1 ? part : part.slice(0, separator).trim();
    const name = rawName.toLowerCase();
    const rawValue = separator === -1 ? null : part.slice(separator + 1).trim();

    if (!HTTP_TOKEN.test(rawName)) {
      errors.push(`nome invalido: ${rawName || "(vazio)"}`);
      continue;
    }
    if (rawValue === "") {
      errors.push(`valor ausente: ${name}`);
      continue;
    }
    if (
      rawValue !== null &&
      !HTTP_TOKEN.test(rawValue) &&
      !(rawValue.length >= 2 && rawValue.startsWith('"') && rawValue.endsWith('"'))
    ) {
      errors.push(`valor invalido: ${name}`);
      continue;
    }
    if (directives.has(name)) {
      errors.push(`diretiva duplicada: ${name}`);
      continue;
    }
    directives.set(name, rawValue);
  }

  return { raw, directives, errors };
}

function hasBareDirective(parsed, name) {
  return parsed.directives.has(name) && parsed.directives.get(name) === null;
}

function hasImmutableYearCache(response) {
  const parsed = parseCacheControl(response);
  return parsed.errors.length === 0 &&
    hasBareDirective(parsed, "public") &&
    parsed.directives.get("max-age") === "31536000" &&
    hasBareDirective(parsed, "immutable") &&
    !parsed.directives.has("private") &&
    !parsed.directives.has("no-cache") &&
    !parsed.directives.has("no-store");
}

function hasExplicitRevalidationCache(response) {
  const parsed = parseCacheControl(response);
  return parsed.errors.length === 0 &&
    hasBareDirective(parsed, "public") &&
    parsed.directives.get("max-age") === "0" &&
    !parsed.directives.has("immutable") &&
    !parsed.directives.has("s-maxage");
}

async function checkVersionedPublicAssetDelivery() {
  const imagePath = "/certificados/iso-9001.9371c4a6c19f.webp";
  const videoPath = "/home-caminhoes-silent.3bee1a633929.webm";
  const legacyPath = "/foto2.webp";
  const videoFilePath = path.join(
    FRONTEND_ARTIFACT_DIR,
    "public",
    videoPath.slice(1)
  );
  const videoSize = fs.statSync(videoFilePath).size;

  const [image, video, legacy] = await Promise.all([
    fetch(`${FRONTEND_URL}${imagePath}`, { method: "HEAD", redirect: "manual" }),
    fetch(`${FRONTEND_URL}${videoPath}`, { method: "HEAD", redirect: "manual" }),
    fetch(`${FRONTEND_URL}${legacyPath}`, { method: "HEAD", redirect: "manual" }),
  ]);
  const range = await fetch(`${FRONTEND_URL}${videoPath}`, {
    headers: { Range: "bytes=0-63" },
    redirect: "manual",
  });
  const rangeBody = Buffer.from(await range.arrayBuffer());
  const videoEtag = String(video.headers.get("etag") || "");

  return [
    result(
      "VERSIONED image uses immutable one-year cache",
      image.status === 200 &&
        String(image.headers.get("content-type") || "").startsWith("image/webp") &&
        hasImmutableYearCache(image),
      `status=${image.status}; cache=${image.headers.get("cache-control") || "(ausente)"}`
    ),
    result(
      "VERSIONED video preserves ETag and byte ranges",
      video.status === 200 &&
        videoEtag.length > 0 &&
        String(video.headers.get("accept-ranges") || "").toLowerCase() === "bytes" &&
        hasImmutableYearCache(video) &&
        range.status === 206 &&
        String(range.headers.get("content-range") || "") === `bytes 0-63/${videoSize}` &&
        String(range.headers.get("accept-ranges") || "").toLowerCase() === "bytes" &&
        String(range.headers.get("etag") || "") === videoEtag &&
        rangeBody.length === 64,
      `head=${video.status}; range=${range.status}; bytes=${rangeBody.length}; etag=${videoEtag ? "present" : "missing"}; cache=${video.headers.get("cache-control") || "(ausente)"}`
    ),
    result(
      "LEGACY static asset remains available and revalidatable",
      legacy.status === 200 &&
        String(legacy.headers.get("content-type") || "").startsWith("image/webp") &&
        String(legacy.headers.get("etag") || "").length > 0 &&
        hasExplicitRevalidationCache(legacy),
      `status=${legacy.status}; cache=${legacy.headers.get("cache-control") || "(ausente)"}`
    ),
  ];
}

function assertPortAvailable({ name, port }) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        reject(new Error(`Porta de hardening ocupada para ${name}: ${port}.`));
        return;
      }
      reject(
        new Error(
          `Nao foi possivel reservar a porta de hardening para ${name} (${port}): ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
    });
    probe.listen({ host: HOST, port, exclusive: true }, () => {
      probe.close((error) => {
        if (error) {
          reject(
            new Error(
              `Nao foi possivel liberar a porta de hardening para ${name} (${port}): ${error.message}`
            )
          );
          return;
        }
        resolve();
      });
    });
  });
}

async function assertHardeningPortsAvailable() {
  for (const item of hardeningPorts) {
    await assertPortAvailable(item);
  }
}

function copyFixture(relativePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, relativePath), targetPath);
}

function copyDirectoryFixture(relativePath, targetPath) {
  const sourcePath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(sourcePath)) return;
  fs.mkdirSync(targetPath, { recursive: true });
  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    const sourceEntry = path.join(sourcePath, entry.name);
    const targetEntry = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryFixture(path.relative(ROOT_DIR, sourceEntry), targetEntry);
    } else {
      fs.copyFileSync(sourceEntry, targetEntry);
    }
  }
}

function startLandingBuilderFixture() {
  const requests = [];
  const server = http.createServer((incoming, response) => {
    const requestUrl = new URL(incoming.url || "/", LANDING_BUILDER_FIXTURE_URL);
    requests.push({
      method: incoming.method || "GET",
      pathname: requestUrl.pathname,
      nonce: String(incoming.headers["x-nonce"] || ""),
      csp: String(incoming.headers["content-security-policy"] || ""),
    });

    if (requestUrl.pathname !== CAMPAIGN_FIXTURE_PATH) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    const nonce = String(incoming.headers["x-nonce"] || "");
    const receivedStrictCsp = String(
      incoming.headers["content-security-policy"] || ""
    ).includes("'strict-dynamic'");
    if (!/^[A-Za-z0-9+/_=-]+$/.test(nonce)) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Nonce ausente ou invalido");
      return;
    }

    const body = `<!doctype html>
<html lang="pt-BR" data-campaign-hydrated="false">
  <head><meta charset="utf-8"><title>Campanha de hardening</title></head>
  <body>
    <main><h1>Campanha de hardening</h1><button id="campaign-action" type="button" aria-pressed="false">Interagir</button></main>
    <script nonce="${nonce}">
      document.documentElement.dataset.campaignHydrated = "true";
      document.getElementById("campaign-action").addEventListener("click", function () {
        this.setAttribute("aria-pressed", "true");
      });
    </script>
  </body>
</html>`;
    response.writeHead(200, {
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": String(incoming.headers["content-security-policy"] || ""),
      "Content-Length": Buffer.byteLength(body),
      "Content-Type": "text/html; charset=utf-8",
      "X-Hardening-Landing-Fixture": "1",
      "X-Hardening-Received-Csp": receivedStrictCsp ? "strict" : "missing",
    });
    response.end(body);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(
      { host: HOST, port: LANDING_BUILDER_FIXTURE_PORT, exclusive: true },
      () => {
        server.removeListener("error", reject);
        resolve({ server, requests });
      }
    );
  });
}

function closeHttpServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

function startStandaloneBuild({ artifactDir, env, label, command }) {
  const serverCommand = command ?? {
    command: process.execPath,
    args: [standaloneServerPath(artifactDir, label)],
  };

  const child = spawn(serverCommand.command, serverCommand.args, {
    cwd: artifactDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  return { child, getLogs: () => logs };
}

async function waitFor(url, timeoutMs = 90000, expectedStatus) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (expectedStatus === undefined
        ? response.status >= 200 && response.status < 500
        : response.status === expectedStatus) return;
    } catch {
      // wait
    }
    await sleep(500);
  }
  throw new Error(`Servidor nao ficou pronto: ${url}`);
}

function killProcessTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  child.kill();
}

function startServers(storeDir) {
  const publicStoreDir = path.join(storeDir, "public-backend");
  const cmsStoreDir = path.join(storeDir, "cms-backend");
  const contentStorePath = path.join(cmsStoreDir, "content.json");
  const siteTextsStorePath = path.join(cmsStoreDir, "site-texts.json");

  copyFixture("site/backend/storage/content.json", contentStorePath);
  copyFixture("site/backend/storage/site-texts.json", siteTextsStorePath);
  copyDirectoryFixture("site/backend/storage/uploads", path.join(cmsStoreDir, "uploads"));
  fs.mkdirSync(publicStoreDir, { recursive: true });

  const baseProcessEnvironment = isolatedProcessEnvironment();
  const backendEnv = {
    ...baseProcessEnvironment,
    HOST,
    PORT: String(BACKEND_PORT),
    NODE_ENV: "test",
    FRONTEND_ORIGIN: FRONTEND_URL,
    ADMIN_SETUP_CODE: SETUP_CODE,
    SESSION_SECRET: "test-session-secret-with-more-than-32-characters",
    ESL_OPERATION_SECRET: "test-esl-operation-secret-with-more-than-32-characters",
    STORAGE_ROOT: publicStoreDir,
    RATE_LIMITS_STORE_PATH: path.join(publicStoreDir, "private", "rate-limits.json"),
    UPLOADS_DIR: path.join(publicStoreDir, "uploads"),
    CORS_ORIGINS: `${FRONTEND_URL},${CMS_URL}`,
    TRUST_PROXY: "false",
    ESL_TENANT: "test",
    ESL_GRAPHQL_URL: "https://127.0.0.1:1/graphql",
    GRAPHQL_API_KEY: "test-graphql-api-key",
  };

  const cmsBackendEnv = {
    ...baseProcessEnvironment,
    HOST,
    PORT: String(CMS_BACKEND_PORT),
    NODE_ENV: "test",
    FRONTEND_ORIGIN: FRONTEND_URL,
    CMS_INTERNAL_URL: CMS_URL,
    ADMIN_SETUP_CODE: SETUP_CODE,
    JWT_SECRET: "test-session-secret-with-more-than-32-characters",
    SESSION_SECRET: "test-session-secret-with-more-than-32-characters",
    STORAGE_ROOT: cmsStoreDir,
    CMS_STORAGE_ROOT: cmsStoreDir,
    CONTENT_STORE_PATH: contentStorePath,
    SITE_TEXTS_STORE_PATH: siteTextsStorePath,
    USERS_STORE_PATH: path.join(cmsStoreDir, "users.json"),
    CMS_ACCESS_PROFILES_STORE_PATH: path.join(cmsStoreDir, "cms-access-profiles.json"),
    SESSIONS_STORE_PATH: path.join(cmsStoreDir, "sessions.json"),
    CONTACTS_STORE_PATH: path.join(cmsStoreDir, "contacts.json"),
    QUOTES_STORE_PATH: path.join(cmsStoreDir, "quotes.json"),
    POPUP_CONFIG_STORE_PATH: path.join(cmsStoreDir, "popup-config.json"),
    POPUP_LEADS_STORE_PATH: path.join(cmsStoreDir, "popup-leads.json"),
    POPUP_EVENTS_STORE_PATH: path.join(cmsStoreDir, "popup-events.json"),
    ANALYTICS_STORE_PATH: path.join(cmsStoreDir, "analytics.json"),
    ANALYTICS_CONFIG_PATH: path.join(cmsStoreDir, "analytics-config.json"),
    SEO_SETTINGS_STORE_PATH: path.join(cmsStoreDir, "seo-settings.json"),
    CONSENT_SETTINGS_STORE_PATH: path.join(cmsStoreDir, "consent-settings.json"),
    COOKIE_CONSENTS_STORE_PATH: path.join(cmsStoreDir, "cookie-consents.json"),
    LEADS_STORE_PATH: path.join(cmsStoreDir, "leads.json"),
    IMPROVEMENTS_STORE_PATH: path.join(cmsStoreDir, "improvements.json"),
    IMPROVEMENT_ATTACHMENTS_PATH: path.join(cmsStoreDir, "improvement-attachments"),
    TRACKING_EVENTS_STORE_PATH: path.join(cmsStoreDir, "tracking-events.json"),
    AUDIT_LOG_STORE_PATH: path.join(cmsStoreDir, "audit-log.json"),
    MEDIA_LIBRARY_STORE_PATH: path.join(cmsStoreDir, "media-library.json"),
    MEDIA_SLOTS_STORE_PATH: path.join(cmsStoreDir, "media-slots.json"),
    MEDIA_REPLACE_TRANSACTION_PATH: path.join(cmsStoreDir, "media-replace-transaction.json"),
    CMS_RATE_LIMITS_STORE_PATH: path.join(cmsStoreDir, "cms-rate-limits.json"),
    UPLOADS_DIR: path.join(cmsStoreDir, "uploads"),
    CMS_UPLOADS_DIR: path.join(cmsStoreDir, "uploads"),
    FRONTEND_PUBLIC_DIR: path.join(ROOT_DIR, "site", "frontend", "public"),
    CORS_ORIGINS: `${FRONTEND_URL},${CMS_URL}`,
    TRUST_PROXY: "false",
    LANDING_BUILDER_API_URL: "http://127.0.0.1:1",
    LANDING_BUILDER_SERVICE_TOKEN: "test-landing-builder-service-token-with-32-characters",
  };

  const cmsEnv = {
    ...baseProcessEnvironment,
    NODE_ENV: "production",
    PORT: String(CMS_PORT),
    HOSTNAME: HOST,
    CMS_BACKEND_INTERNAL_URL: CMS_BACKEND_URL,
    CMS_BACKEND_PROXY_URL: CMS_BACKEND_URL,
    NEXT_PUBLIC_SITE_URL: FRONTEND_URL,
  };

  const frontendEnv = {
    ...baseProcessEnvironment,
    NODE_ENV: "production",
    PORT: String(FRONTEND_PORT),
    HOSTNAME: HOST,
    BACKEND_PROXY_URL: "",
    NEXT_PUBLIC_BACKEND_PROXY_URL: "",
    BACKEND_INTERNAL_URL: BACKEND_URL,
    NEXT_PUBLIC_BACKEND_URL: BACKEND_URL,
    CMS_INTERNAL_URL: CMS_URL,
    CMS_BACKEND_INTERNAL_URL: CMS_BACKEND_URL,
    NEXT_PUBLIC_SITE_URL: FRONTEND_URL,
  };

  const started = [];
  try {
    const backend = startStandaloneBuild({
      artifactDir: BACKEND_ARTIFACT_DIR,
      env: backendEnv,
      label: "backend Spring público",
      command: springServerCommand(BACKEND_ARTIFACT_DIR, "backend público"),
    });
    started.push(backend);
    const cmsBackend = startStandaloneBuild({
      artifactDir: CMS_BACKEND_ARTIFACT_DIR,
      env: cmsBackendEnv,
      label: "backend Spring do CMS",
      command: springServerCommand(CMS_BACKEND_ARTIFACT_DIR, "backend do CMS"),
    });
    started.push(cmsBackend);
    const cms = startStandaloneBuild({ artifactDir: CMS_ARTIFACT_DIR, env: cmsEnv, label: "CMS" });
    started.push(cms);
    const frontend = startStandaloneBuild({ artifactDir: FRONTEND_ARTIFACT_DIR, env: frontendEnv, label: "site" });
    started.push(frontend);
    return { backend, cmsBackend, cms, frontend };
  } catch (error) {
    started.forEach(({ child }) => killProcessTree(child));
    throw error;
  }
}

async function request(pathname, options = {}) {
  const response = await fetch(`${FRONTEND_URL}${pathname}`, {
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body,
    redirect: options.redirect || "manual",
  });

  const contentType = String(response.headers.get("content-type") || "");
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;

  return { response, payload };
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const setCookie = response.headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
}

function getCookieHeader(response) {
  return getSetCookieHeaders(response)
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

function requestHeaders({ cookie = "", csrfToken = "", json = false } = {}) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Origin: FRONTEND_URL,
    ...(cookie ? { Cookie: cookie } : {}),
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
  };
}

function result(name, pass, detail) {
  return { name, pass, detail };
}

function executableFromPath(command) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  const located = spawnSync(locator, [command], {
    encoding: "utf8",
    env: isolatedProcessEnvironment(),
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (located.status !== 0) return "";
  return String(located.stdout || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry && fs.existsSync(entry)) || "";
}

function findBrowserExecutable() {
  const configured = process.env.SECURITY_TEST_BROWSER_PATH?.trim();
  if (configured) {
    if (!path.isAbsolute(configured) || !fs.existsSync(configured)) {
      throw new Error(
        "SECURITY_TEST_BROWSER_PATH deve apontar para um executavel absoluto e existente do Chrome, Edge ou Chromium."
      );
    }
    return configured;
  }

  const fileCandidates = process.platform === "win32"
    ? [
        path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
      ]
    : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : [];
  const fileCandidate = fileCandidates.find(
    (candidate) => candidate && fs.existsSync(candidate)
  );
  if (fileCandidate) return fileCandidate;

  const commandCandidate = [
    "google-chrome-stable",
    "google-chrome",
    "microsoft-edge-stable",
    "microsoft-edge",
    "chromium",
    "chromium-browser",
    "chrome",
    "msedge",
  ]
    .map(executableFromPath)
    .find(Boolean);
  if (commandCandidate) return commandCandidate;

  throw new Error(
    "Smoke de navegador exige Chrome, Edge ou Chromium; instale um deles ou defina SECURITY_TEST_BROWSER_PATH com o caminho absoluto."
  );
}

class CdpWebSocketClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.eventListeners = new Set();

    socket.addEventListener("message", (event) => this.onMessage(event.data));
    socket.addEventListener("error", () => {
      this.rejectPending(new Error("Conexao WebSocket do Chrome DevTools Protocol falhou."));
    });
    socket.addEventListener("close", () => {
      this.rejectPending(new Error("Conexao WebSocket do Chrome DevTools Protocol foi encerrada."));
    });
  }

  static connect(endpoint) {
    if (typeof WebSocket !== "function") {
      throw new Error(
        "O smoke requer WebSocket global: use Node 22+ ou execute Node 20 com --experimental-websocket."
      );
    }
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("Timeout ao conectar ao Chrome DevTools Protocol."));
      }, 10000);
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve(new CdpWebSocketClient(socket));
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Nao foi possivel conectar ao Chrome DevTools Protocol."));
      }, { once: true });
    });
  }

  onMessage(serialized) {
    let message;
    try {
      message = JSON.parse(String(serialized));
    } catch (error) {
      this.rejectPending(
        new Error(`Resposta CDP invalida: ${error instanceof Error ? error.message : String(error)}`)
      );
      return;
    }
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) {
        pending.reject(new Error(`CDP ${pending.method}: ${message.error.message || "erro"}`));
      } else {
        pending.resolve(message.result || {});
      }
      return;
    }
    if (message.method) {
      for (const listener of this.eventListeners) listener(message);
    }
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout no comando CDP ${method}.`));
      }, 20000);
      this.pending.set(id, { method, resolve, reject, timeout });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  onEvent(listener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }
}

async function evaluateInPage(cdp, sessionId, expression) {
  const response = await cdp.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  );
  if (response.exceptionDetails) {
    throw new Error(
      `JavaScript do smoke falhou: ${response.exceptionDetails.exception?.description || response.exceptionDetails.text || "erro desconhecido"}`
    );
  }
  return response.result?.value;
}

async function waitForPageCondition(cdp, sessionId, expression, timeoutMs = 20000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await evaluateInPage(cdp, sessionId, expression)) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(
    `Condicao do smoke nao foi atendida: ${expression}${lastError ? ` (${lastError.message})` : ""}`
  );
}

function findDeferredMapChunkNames() {
  const buildInfoPath = path.join(FRONTEND_ARTIFACT_DIR, "build-info.json");
  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
  const staticAssets = String(buildInfo.staticAssets || "");
  const staticDirectory = path.resolve(FRONTEND_ARTIFACT_DIR, staticAssets);
  const relativeStaticDirectory = path.relative(FRONTEND_ARTIFACT_DIR, staticDirectory);
  if (
    !staticAssets ||
    relativeStaticDirectory.startsWith("..") ||
    path.isAbsolute(relativeStaticDirectory)
  ) {
    throw new Error(`Diretorio estatico invalido em ${buildInfoPath}: ${staticAssets || "ausente"}`);
  }
  const chunksDirectory = path.join(staticDirectory, "chunks");
  if (!fs.existsSync(chunksDirectory)) {
    throw new Error(`Chunks estaticos ausentes no artefato: ${chunksDirectory}`);
  }
  const matches = listFilesRecursively(chunksDirectory)
    .filter((filePath) => path.extname(filePath).toLowerCase() === ".js")
    .filter((filePath) => {
      const contents = fs.readFileSync(filePath, "utf8");
      return contents.includes('/map.svg') && contents.includes("svg-wrapper");
    })
    .map((filePath) => path.basename(filePath));
  if (matches.length === 0) {
    throw new Error("Chunk adiado do mapa regional nao foi identificado no artefato do site.");
  }
  return new Set(matches);
}

function browserArguments(profileDirectory) {
  return [
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    `--remote-debugging-address=${HOST}`,
    `--remote-debugging-port=${BROWSER_DEBUG_PORT}`,
    `--user-data-dir=${profileDirectory}`,
    "--window-size=1365,768",
    ...(process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0
      ? ["--no-sandbox"]
      : []),
    "about:blank",
  ];
}

async function waitForBrowserTarget(child, timeoutMs = 15000) {
  const endpoint = `http://${HOST}:${BROWSER_DEBUG_PORT}/json/list`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Navegador encerrou antes de abrir o CDP (code=${String(child.exitCode)}, signal=${String(child.signalCode)}).`
      );
    }
    try {
      const response = await fetch(endpoint, { redirect: "manual" });
      if (response.status === 200) {
        const targets = await response.json();
        const page = Array.isArray(targets)
          ? targets.find(
              (target) => target?.type === "page" && typeof target.webSocketDebuggerUrl === "string"
            )
          : null;
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      // O browser ainda esta inicializando.
    }
    await sleep(100);
  }
  throw new Error(`Navegador nao abriu o Chrome DevTools Protocol em ${endpoint}.`);
}

async function stopBrowser(cdp, child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    await cdp?.send("Browser.close");
  } catch {
    // O encerramento forçado abaixo cobre browsers que já fecharam o pipe.
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(2000),
  ]);
  if (child.exitCode === null) killProcessTree(child);
}

async function runBrowserSmoke(tmpDir, browserExecutable) {
  const profileDirectory = path.join(tmpDir, "browser-profile");
  fs.mkdirSync(profileDirectory, { recursive: true });
  const child = spawn(browserExecutable, browserArguments(profileDirectory), {
    env: isolatedProcessEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let browserLogs = "";
  const appendLog = (chunk) => {
    browserLogs = `${browserLogs}${chunk.toString()}`.slice(-12000);
  };
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  let cdp;

  try {
    const browserTarget = await waitForBrowserTarget(child);
    cdp = await CdpWebSocketClient.connect(browserTarget);
    await cdp.send("Browser.getVersion");
    const sessionId = undefined;

    const requestedUrls = [];
    const exceptions = [];
    const securityErrors = [];
    const failedCriticalAssets = [];
    const removeEventListener = cdp.onEvent((message) => {
      if (message.method === "Network.requestWillBeSent") {
        requestedUrls.push(String(message.params?.request?.url || ""));
      }
      if (message.method === "Runtime.exceptionThrown") {
        exceptions.push(
          String(
            message.params?.exceptionDetails?.exception?.description ||
            message.params?.exceptionDetails?.text ||
            "erro JavaScript"
          )
        );
      }
      if (message.method === "Network.responseReceived") {
        const response = message.params?.response;
        const resourceType = String(message.params?.type || "");
        if (
          Number(response?.status || 0) >= 400 &&
          ["Script", "Stylesheet", "Font"].includes(resourceType)
        ) {
          failedCriticalAssets.push(`${resourceType}:${response.status}:${response.url}`);
        }
      }
      if (message.method === "Log.entryAdded") {
        const entry = message.params?.entry;
        const text = String(entry?.text || "");
        if (
          entry?.source === "security" ||
          /content security policy|refused to (?:load|execute|apply)/i.test(text)
        ) {
          securityErrors.push(text);
        }
      }
    });

    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
    await cdp.send("Log.enable", {}, sessionId);
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 1365, height: 768, deviceScaleFactor: 1, mobile: false },
      sessionId
    );

    await cdp.send("Page.navigate", { url: `${FRONTEND_URL}/` }, sessionId);
    await waitForPageCondition(
      cdp,
      sessionId,
      'document.readyState === "complete" && Boolean(document.getElementById("site-search-trigger"))'
    );
    await sleep(2500);

    const homeRequests = [...requestedUrls];
    const webmRequests = homeRequests.filter((url) => {
      try {
        return new URL(url).pathname.toLowerCase().endsWith(".webm");
      } catch {
        return false;
      }
    });
    const mapChunkNames = findDeferredMapChunkNames();
    const mapRequests = homeRequests.filter((url) => {
      try {
        const pathname = new URL(url).pathname;
        return pathname === "/map.svg" || mapChunkNames.has(path.basename(pathname));
      } catch {
        return false;
      }
    });

    await evaluateInPage(
      cdp,
      sessionId,
      `window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "k",
        code: "KeyK",
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      }))`
    );
    await sleep(500);
    const searchInteraction = await evaluateInPage(
      cdp,
      sessionId,
      `(() => ({
        expanded: Array.from(document.querySelectorAll("#site-search-trigger"))
          .some((candidate) => candidate.getAttribute("aria-expanded") === "true"),
        panelVisible: Array.from(document.querySelectorAll("#site-search-panel"))
          .some((candidate) => candidate.getAttribute("aria-hidden") === "false"),
        inputFocused: document.activeElement?.id === "site-search-input"
      }))()`
    );

    const campaignRequestStart = requestedUrls.length;
    await cdp.send(
      "Page.navigate",
      { url: `${FRONTEND_URL}${CAMPAIGN_FIXTURE_PATH}` },
      sessionId
    );
    await waitForPageCondition(
      cdp,
      sessionId,
      'document.readyState === "complete" && document.documentElement.dataset.campaignHydrated === "true"'
    );
    const campaignInteraction = await evaluateInPage(
      cdp,
      sessionId,
      `(() => {
        const action = document.getElementById("campaign-action");
        if (!action) return null;
        action.click();
        return action.getAttribute("aria-pressed");
      })()`
    );
    const campaignRequested = requestedUrls
      .slice(campaignRequestStart)
      .some((url) => {
        try {
          return new URL(url).pathname === CAMPAIGN_FIXTURE_PATH;
        } catch {
          return false;
        }
      });
    removeEventListener();

    return [
      result(
        "BROWSER public home hydrates and handles interaction",
        searchInteraction?.expanded === true && searchInteraction?.panelVisible === true,
        `expanded=${String(searchInteraction?.expanded)}; panel-visible=${String(searchInteraction?.panelVisible)}; input-focused=${String(searchInteraction?.inputFocused)}`
      ),
      result(
        "BROWSER initial viewport does not download WebM",
        webmRequests.length === 0,
        `requests=${webmRequests.length}${webmRequests.length ? `; urls=${webmRequests.join(",")}` : ""}`
      ),
      result(
        "BROWSER initial viewport defers regional map",
        mapRequests.length === 0,
        `requests=${mapRequests.length}${mapRequests.length ? `; urls=${mapRequests.join(",")}` : ""}`
      ),
      result(
        "BROWSER CSP executes without security violations",
        securityErrors.length === 0 && exceptions.length === 0 && failedCriticalAssets.length === 0,
        `security=${securityErrors.length}; exceptions=${exceptions.length}; critical-assets=${failedCriticalAssets.length}${failedCriticalAssets.length ? `; failures=${failedCriticalAssets.join(",")}` : ""}`
      ),
      result(
        "BROWSER campaign fallback executes its nonce script",
        campaignRequested && campaignInteraction === "true",
        `requested=${campaignRequested}; interaction=${String(campaignInteraction)}`
      ),
    ];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(browserLogs ? `${message}\nBrowser logs:\n${browserLogs}` : message);
  } finally {
    await stopBrowser(cdp, child);
  }
}

async function runPositiveAdminFlowChecks() {
  const results = [];

  const setupStatus = await request("/api/auth/setup");
  results.push(
    result(
      "AUTH setup status",
      setupStatus.response.status === 200 && setupStatus.payload?.setupRequired === true,
      `status=${setupStatus.response.status}; setupRequired=${String(setupStatus.payload?.setupRequired)}`
    )
  );

  const setup = await request("/api/auth/register", {
    method: "POST",
    headers: requestHeaders({ json: true }),
    body: JSON.stringify({
      name: "Security Owner",
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      confirmPassword: OWNER_PASSWORD,
      setupCode: SETUP_CODE,
    }),
  });
  results.push(
    result(
      "AUTH setup owner",
      setup.response.status === 201 && setup.payload?.user?.email === OWNER_EMAIL && setup.payload?.user?.isOwner === true,
      `status=${setup.response.status}`
    )
  );

  const ownerLogin = await request("/api/auth/login", {
    method: "POST",
    headers: requestHeaders({ json: true }),
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  });
  const ownerCookie = getCookieHeader(ownerLogin.response);
  const ownerCsrfToken = typeof ownerLogin.payload?.csrfToken === "string" ? ownerLogin.payload.csrfToken : "";
  const ownerCookieHeaders = getSetCookieHeaders(ownerLogin.response);
  const hasSafeSessionCookie = ownerCookieHeaders.some(
    (value) =>
      /^sid=[^;]+/i.test(value) &&
      /;\s*path=\//i.test(value) &&
      /;\s*httponly/i.test(value) &&
      /;\s*samesite=strict/i.test(value) &&
      !/;\s*max-age=/i.test(value)
  );
  results.push(
    result(
      "AUTH login and session cookie",
      ownerLogin.response.status === 200 && Boolean(ownerCookie) && Boolean(ownerCsrfToken) && hasSafeSessionCookie,
      `status=${ownerLogin.response.status}; cookie=${hasSafeSessionCookie ? "safe" : "invalid"}`
    )
  );

  const ownerSession = await request("/api/auth/session", {
    headers: ownerCookie ? { Cookie: ownerCookie } : {},
  });
  results.push(
    result(
      "AUTH session",
      ownerSession.response.status === 200 &&
        ownerSession.payload?.authenticated === true &&
        ownerSession.payload?.user?.email === OWNER_EMAIL &&
        ownerSession.payload?.csrfToken === ownerCsrfToken,
      `status=${ownerSession.response.status}; authenticated=${String(ownerSession.payload?.authenticated)}`
    )
  );

  const invalidCsrf = await request("/api/auth/cms-theme", {
    method: "PATCH",
    headers: requestHeaders({ cookie: ownerCookie, csrfToken: "invalid-csrf-token", json: true }),
    body: JSON.stringify({ theme: "dark" }),
  });
  results.push(
    result(
      "CSRF rejects invalid token",
      invalidCsrf.response.status === 403,
      `status=${invalidCsrf.response.status}`
    )
  );

  const validCsrf = await request("/api/auth/cms-theme", {
    method: "PATCH",
    headers: requestHeaders({ cookie: ownerCookie, csrfToken: ownerCsrfToken, json: true }),
    body: JSON.stringify({ theme: "dark" }),
  });
  results.push(
    result(
      "CSRF accepts valid token",
      validCsrf.response.status === 200 && validCsrf.payload?.user?.cmsTheme === "dark",
      `status=${validCsrf.response.status}`
    )
  );

  const createLimitedAdmin = await request("/api/admin/users", {
    method: "POST",
    headers: requestHeaders({ cookie: ownerCookie, csrfToken: ownerCsrfToken, json: true }),
    body: JSON.stringify({
      name: "Security Limited Admin",
      email: LIMITED_ADMIN_EMAIL,
      password: LIMITED_ADMIN_TEMPORARY_PASSWORD,
      confirmPassword: LIMITED_ADMIN_TEMPORARY_PASSWORD,
      role: "admin",
      cmsPermissions: ["dashboard", "popup"],
    }),
  });
  results.push(
    result(
      "ACL creates limited administrator",
      createLimitedAdmin.response.status === 201 &&
        createLimitedAdmin.payload?.createdUser?.email === LIMITED_ADMIN_EMAIL &&
        createLimitedAdmin.payload?.createdUser?.passwordChangeRequired === true,
      `status=${createLimitedAdmin.response.status}`
    )
  );

  const limitedLogin = await request("/api/auth/login", {
    method: "POST",
    headers: requestHeaders({ json: true }),
    body: JSON.stringify({ email: LIMITED_ADMIN_EMAIL, password: LIMITED_ADMIN_TEMPORARY_PASSWORD }),
  });
  const limitedCookie = getCookieHeader(limitedLogin.response);
  const limitedCsrfToken = typeof limitedLogin.payload?.csrfToken === "string" ? limitedLogin.payload.csrfToken : "";
  results.push(
    result(
      "AUTH temporary administrator login",
      limitedLogin.response.status === 200 &&
        Boolean(limitedCookie) &&
        Boolean(limitedCsrfToken) &&
        limitedLogin.payload?.user?.passwordChangeRequired === true,
      `status=${limitedLogin.response.status}`
    )
  );

  const beforePasswordChange = await request("/api/admin/content", {
    headers: limitedCookie ? { Cookie: limitedCookie } : {},
  });
  results.push(
    result(
      "AUTH password change gate",
      beforePasswordChange.response.status === 403,
      `status=${beforePasswordChange.response.status}`
    )
  );

  const changePassword = await request("/api/auth/change-password", {
    method: "POST",
    headers: requestHeaders({ cookie: limitedCookie, csrfToken: limitedCsrfToken, json: true }),
    body: JSON.stringify({
      currentPassword: LIMITED_ADMIN_TEMPORARY_PASSWORD,
      password: LIMITED_ADMIN_PASSWORD,
      confirmPassword: LIMITED_ADMIN_PASSWORD,
    }),
  });
  results.push(
    result(
      "AUTH changes temporary password",
      changePassword.response.status === 200 && changePassword.payload?.user?.passwordChangeRequired === false,
      `status=${changePassword.response.status}`
    )
  );

  const dashboardAllowed = await request("/api/admin/content", {
    headers: limitedCookie ? { Cookie: limitedCookie } : {},
  });
  results.push(
    result(
      "ACL allows assigned dashboard",
      dashboardAllowed.response.status === 200,
      `status=${dashboardAllowed.response.status}`
    )
  );

  const popupEventsAllowed = await request("/api/popup-events?days=30", {
    headers: limitedCookie ? { Cookie: limitedCookie } : {},
  });
  results.push(
    result(
      "ACL allows assigned popup events",
      popupEventsAllowed.response.status === 200,
      `status=${popupEventsAllowed.response.status}`
    )
  );

  const popupConfig = await request("/api/popup-config");
  const popupConfigUpdate = await request("/api/popup-config", {
    method: "POST",
    headers: requestHeaders({ cookie: limitedCookie, csrfToken: limitedCsrfToken, json: true }),
    body: JSON.stringify(popupConfig.payload?.config ?? {}),
  });
  results.push(
    result(
      "ACL allows assigned popup configuration",
      popupConfigUpdate.response.status === 200,
      `status=${popupConfigUpdate.response.status}`
    )
  );

  const popupLeadsDenied = await request("/api/leads", {
    headers: limitedCookie ? { Cookie: limitedCookie } : {},
  });
  const contactsDenied = await request("/api/contact", {
    headers: limitedCookie ? { Cookie: limitedCookie } : {},
  });
  const quotesDenied = await request("/api/quote", {
    headers: limitedCookie ? { Cookie: limitedCookie } : {},
  });
  results.push(
    result(
      "ACL denies unassigned lead data",
      [popupLeadsDenied, contactsDenied, quotesDenied].every(({ response }) => response.status === 403),
      `popup=${popupLeadsDenied.response.status}; contact=${contactsDenied.response.status}; quote=${quotesDenied.response.status}`
    )
  );

  const imagesDenied = await request("/api/admin/images", {
    headers: limitedCookie ? { Cookie: limitedCookie } : {},
  });
  results.push(
    result(
      "ACL denies unassigned images",
      imagesDenied.response.status === 403,
      `status=${imagesDenied.response.status}`
    )
  );

  const formData = new FormData();
  formData.append("image", new Blob([TEST_PNG], { type: "image/png" }), "security-check.png");
  const upload = await request("/api/admin/images", {
    method: "POST",
    headers: requestHeaders({ cookie: ownerCookie, csrfToken: ownerCsrfToken }),
    body: formData,
  });
  const uploadedUrl = typeof upload.payload?.image?.url === "string" ? upload.payload.image.url : "";
  results.push(
    result(
      "MEDIA upload image with CSRF",
      upload.response.status === 201 && uploadedUrl.startsWith("/uploads/") && uploadedUrl.endsWith(".webp"),
      `status=${upload.response.status}`
    )
  );

  const uploadedMedia = uploadedUrl ? await request(uploadedUrl) : null;
  results.push(
    result(
      "MEDIA uploaded image served by gateway",
      uploadedMedia?.response.status === 200 &&
        String(uploadedMedia.response.headers.get("content-type") || "").includes("image/webp"),
      `status=${uploadedMedia?.response.status ?? "not-requested"}`
    )
  );

  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: requestHeaders({ cookie: ownerCookie, csrfToken: ownerCsrfToken }),
  });
  const clearsSessionCookie = getSetCookieHeaders(logout.response).some(
    (value) => /^sid=;/i.test(value) && /;\s*max-age=0/i.test(value)
  );
  results.push(
    result(
      "AUTH logout",
      logout.response.status === 200 && clearsSessionCookie,
      `status=${logout.response.status}; cookie=${clearsSessionCookie ? "cleared" : "not-cleared"}`
    )
  );

  const sessionAfterLogout = await request("/api/auth/session", {
    headers: ownerCookie ? { Cookie: ownerCookie } : {},
  });
  results.push(
    result(
      "AUTH session revoked after logout",
      sessionAfterLogout.response.status === 200 && sessionAfterLogout.payload?.authenticated === false,
      `status=${sessionAfterLogout.response.status}; authenticated=${String(sessionAfterLogout.payload?.authenticated)}`
    )
  );

  return results;
}

async function runChecks(logsAccessor) {
  const results = [];

  for (const pathname of BLOCKED_PATHS) {
    const { response } = await request(pathname);
    results.push({
      name: `BLOCK ${pathname}`,
      pass: response.status === 404,
      detail: `status=${response.status}`,
    });
  }

  for (const pathname of PUBLIC_PATHS) {
    const { response } = await request(pathname);
    results.push({
      name: `PUBLIC ${pathname}`,
      pass: response.status === 200,
      detail: `status=${response.status}`,
    });
  }

  const { response: publicHome } = await request("/");
  const publicHomeBody = await publicHome.text();
  const publicCsp = String(publicHome.headers.get("content-security-policy") || "");
  const scriptDirective = publicCsp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src ")) || "";
  const publicNonce = scriptDirective.match(/'nonce-([^']+)'/)?.[1] || "";
  const leakedInternalOrigins = [BACKEND_URL, CMS_BACKEND_URL, CMS_URL].filter((origin) =>
    publicCsp.includes(origin)
  );
  results.push({
    name: "PUBLIC CSP hides internal origins",
    pass: publicHome.status === 200 && leakedInternalOrigins.length === 0,
    detail:
      leakedInternalOrigins.length === 0
        ? `status=${publicHome.status}; origins=hidden`
        : `status=${publicHome.status}; leaked=${leakedInternalOrigins.join(",")}`,
  });
  results.push({
    name: "PUBLIC CSP uses a strict per-request nonce",
    pass:
      publicHome.status === 200 &&
      Boolean(publicNonce) &&
      scriptDirective.includes("'strict-dynamic'") &&
      !scriptDirective.includes("'unsafe-inline'") &&
      !scriptDirective.includes("'unsafe-eval'"),
    detail: `nonce=${publicNonce ? "present" : "missing"}; strict=${scriptDirective.includes("'strict-dynamic'")}`,
  });

  const executableScripts = Array.from(publicHomeBody.matchAll(/<script\b([^>]*)>/gi));
  const scriptsWithoutNonce = executableScripts.filter((match) => {
    const nonce = match[1].match(/\bnonce=["']([^"']+)["']/i)?.[1] || "";
    return nonce !== publicNonce;
  });
  results.push({
    name: "PUBLIC HTML scripts receive the request nonce",
    pass: executableScripts.length > 0 && scriptsWithoutNonce.length === 0,
    detail: `scripts=${executableScripts.length}; without-matching-nonce=${scriptsWithoutNonce.length}`,
  });

  const secondHome = await fetch(`${FRONTEND_URL}/`, { redirect: "manual" });
  const secondScriptDirective = String(secondHome.headers.get("content-security-policy") || "")
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src ")) || "";
  const secondNonce = secondScriptDirective.match(/'nonce-([^']+)'/)?.[1] || "";
  results.push({
    name: "PUBLIC CSP rotates nonce for every document",
    pass: Boolean(secondNonce) && secondNonce !== publicNonce,
    detail: `rotated=${Boolean(secondNonce) && secondNonce !== publicNonce}`,
  });
  results.push(await checkNextImageOptimization());
  results.push(...(await checkVersionedPublicAssetDelivery()));

  const sitemap = await fetch(`${FRONTEND_URL}/sitemap.xml`, { redirect: "manual" });
  const sitemapBody = await sitemap.text();
  results.push({
    name: "SITEMAP uses configured public site URL",
    pass: sitemap.status === 200 && sitemapBody.includes(`${FRONTEND_URL}/sobre`),
    detail: `status=${sitemap.status}; configured-url=${sitemapBody.includes(FRONTEND_URL)}`,
  });

  for (const pathname of AUTH_PATHS) {
    const { response } = await request(pathname);
    results.push({
      name: `AUTH ${pathname}`,
      pass: response.status === 401,
      detail: `status=${response.status}`,
    });
  }

  for (const pathname of ["/coleta", "/solicitar-coleta"]) {
    const { response } = await request(pathname);
    const location = response.headers.get("location") || "";
    const destination = location ? new URL(location, FRONTEND_URL).pathname : "";
    results.push({
      name: `REDIRECT ${pathname}`,
      pass: [307, 308].includes(response.status) && destination === "/coletas",
      detail: `status=${response.status}; destination=${destination || "(ausente)"}`,
    });
  }

  const { response: cmsGatewayLogin } = await request("/admin/auth/entrar");
  const cmsGatewayCsp = String(cmsGatewayLogin.headers.get("content-security-policy") || "");
  results.push({
    name: "CMS GATEWAY noindex",
    pass: String(cmsGatewayLogin.headers.get("x-robots-tag") || "").includes("noindex"),
    detail: `x-robots-tag=${cmsGatewayLogin.headers.get("x-robots-tag") || "(ausente)"}`,
  });
  results.push({
    name: "CMS GATEWAY framing",
    pass:
      cmsGatewayLogin.headers.get("x-frame-options") === "DENY" &&
      cmsGatewayCsp.includes("frame-ancestors 'none'"),
    detail: `x-frame-options=${cmsGatewayLogin.headers.get("x-frame-options") || "(ausente)"}`,
  });

  const { response: preview } = await request("/?preview=cms");
  const previewBody = await preview.text();
  const previewCsp = String(preview.headers.get("content-security-policy") || "");
  const previewScriptDirective = previewCsp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src ")) || "";
  const previewNonce = previewScriptDirective.match(/'nonce-([^']+)'/)?.[1] || "";
  const previewScripts = Array.from(previewBody.matchAll(/<script\b([^>]*)>/gi));
  const invalidPreviewScripts = previewScripts.filter(
    (match) => (match[1].match(/\bnonce=["']([^"']+)["']/i)?.[1] || "") !== previewNonce
  );
  results.push({
    name: "CMS PREVIEW same-origin with executable nonce",
    pass:
      preview.status === 200 &&
      preview.headers.get("x-frame-options") === "SAMEORIGIN" &&
      previewCsp.includes("frame-ancestors 'self'") &&
      Boolean(previewNonce) &&
      previewScriptDirective.includes("'strict-dynamic'") &&
      previewScripts.length > 0 &&
      invalidPreviewScripts.length === 0,
    detail: `status=${preview.status}; x-frame-options=${preview.headers.get("x-frame-options") || "(ausente)"}; nonce=${previewNonce ? "present" : "missing"}; invalid-scripts=${invalidPreviewScripts.length}`,
  });

  const { response: campaignFallback } = await request(CAMPAIGN_FIXTURE_PATH);
  const campaignFallbackBody = await campaignFallback.text();
  const campaignFallbackCsp = String(
    campaignFallback.headers.get("content-security-policy") || ""
  );
  const campaignScriptDirective = campaignFallbackCsp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src ")) || "";
  const campaignNonce = campaignScriptDirective.match(/'nonce-([^']+)'/)?.[1] || "";
  const campaignHtmlNonce = campaignFallbackBody
    .match(/<script\b[^>]*\bnonce=["']([^"']+)["']/i)?.[1] || "";
  results.push({
    name: "CAMPAIGN fallback preserves gateway nonce and CSP",
    pass:
      campaignFallback.status === 200 &&
      campaignFallback.headers.get("x-hardening-landing-fixture") === "1" &&
      campaignFallback.headers.get("x-hardening-received-csp") === "strict" &&
      Boolean(campaignNonce) &&
      campaignHtmlNonce === campaignNonce &&
      campaignScriptDirective.includes("'strict-dynamic'") &&
      !campaignFallbackCsp.includes(LANDING_BUILDER_FIXTURE_URL),
    detail: `status=${campaignFallback.status}; nonce=${campaignNonce && campaignHtmlNonce === campaignNonce ? "matched" : "invalid"}; csp-nonce=${campaignNonce || "missing"}; html-nonce=${campaignHtmlNonce || "missing"}; upstream-csp=${campaignFallback.headers.get("x-hardening-received-csp") || "missing"}`,
  });

  const cmsDirect = await fetch(`${CMS_URL}/admin/auth/entrar`, { redirect: "manual" });
  const cmsDirectCsp = String(cmsDirect.headers.get("content-security-policy") || "");
  results.push({
    name: "CMS STANDALONE framing",
    pass:
      cmsDirect.status === 200 &&
      cmsDirect.headers.get("x-frame-options") === "DENY" &&
      cmsDirectCsp.includes("frame-ancestors 'none'"),
    detail: `status=${cmsDirect.status}; x-frame-options=${cmsDirect.headers.get("x-frame-options") || "(ausente)"}`,
  });

  const crossOriginLogin = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://evil.example",
    },
    body: JSON.stringify({ email: "a@a.com", password: "x" }),
  });
  results.push({
    name: "SAME-ORIGIN /api/auth/login",
    pass: crossOriginLogin.response.status === 403,
    detail: `status=${crossOriginLogin.response.status}`,
  });

  const wrongContentType = await request("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "nome=teste",
  });
  results.push({
    name: "CONTENT-TYPE /api/contact",
    pass: wrongContentType.response.status === 415,
    detail: `status=${wrongContentType.response.status}`,
  });

  const collectionUpdateWithoutCapability = await request("/api/collections/359397", {
    method: "PATCH",
    headers: requestHeaders({ json: true }),
    body: JSON.stringify({ comments: "Tentativa sem capability" }),
  });
  const collectionCancelWithoutCapability = await request("/api/collections/359397/cancel", {
    method: "POST",
    headers: requestHeaders({ json: true }),
    body: JSON.stringify({ reason: "CLIENTE_SOLICITOU" }),
  });
  results.push({
    name: "ESL collection maintenance requires capability",
    pass:
      collectionUpdateWithoutCapability.response.status === 403 &&
      collectionCancelWithoutCapability.response.status === 403,
    detail: `patch=${collectionUpdateWithoutCapability.response.status}; cancel=${collectionCancelWithoutCapability.response.status}`,
  });

  results.push(...(await runPositiveAdminFlowChecks()));

  const logs = logsAccessor().toLowerCase();
  const leakedPatterns = [SETUP_CODE.toLowerCase(), "passwordhash"].filter((pattern) =>
    logs.includes(pattern)
  );
  results.push({
    name: "LOGS startup",
    pass: leakedPatterns.length === 0,
    detail: leakedPatterns.length === 0 ? "clean" : `found=${leakedPatterns.join(",")}`,
  });

  return results;
}

async function main() {
  validateHardeningConfiguration();
  await validateFrontendImageRuntime();
  const browserExecutable = findBrowserExecutable();
  await assertHardeningPortsAvailable();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rodogarcia-security-test-"));
  const landingBuilderFixture = await startLandingBuilderFixture();
  let servers;

  try {
    servers = startServers(tmpDir);
    const logsAccessor = () =>
      `${servers.backend.getLogs()}\n${servers.cmsBackend.getLogs()}\n${servers.cms.getLogs()}\n${servers.frontend.getLogs()}`;
    try {
      await waitFor(`${BACKEND_URL}/health`, 90000, 200);
      await waitFor(`${BACKEND_URL}/ready`, 90000, 200);
      await waitFor(`${CMS_BACKEND_URL}/health`, 90000, 200);
      await waitFor(`${CMS_BACKEND_URL}/ready`, 90000, 200);
      await waitFor(`${CMS_URL}/admin/auth/entrar`);
      await waitFor(`${FRONTEND_URL}/api/auth/session`);
    } catch (error) {
      console.error(logsAccessor());
      throw error;
    }

    const results = await runChecks(logsAccessor);
    results.push(...(await runBrowserSmoke(tmpDir, browserExecutable)));
    const failed = results.filter((item) => !item.pass);

    results.forEach((item) => {
      console.log(`${item.pass ? "PASS" : "FAIL"} ${item.name} ${item.detail}`);
    });

    assert(
      failed.length === 0,
      `Falhas detectadas: ${failed.map((item) => item.name).join(", ")}`
    );
    console.log("ALL TESTS PASS");
  } finally {
    if (servers) {
      [
        servers.backend.child,
        servers.cmsBackend.child,
        servers.cms.child,
        servers.frontend.child,
      ].forEach(killProcessTree);
    }
    await closeHttpServer(landingBuilderFixture.server);
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
