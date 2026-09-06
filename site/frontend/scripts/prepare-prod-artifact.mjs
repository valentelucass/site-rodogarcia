import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const nextBuildDirectoryName = process.env.NEXT_BUILD_DIST_DIR?.trim() || ".next";
const allowedNextBuildDirectories = new Set([".next", ".next.test"]);
const isolatedPreflight = process.env.RODOGARCIA_ISOLATED_PREFLIGHT?.trim() === "1";

if (!allowedNextBuildDirectories.has(nextBuildDirectoryName)) {
  throw new Error("NEXT_BUILD_DIST_DIR deve ser .next ou .next.test.");
}
if (isolatedPreflight && nextBuildDirectoryName !== ".next.test") {
  throw new Error("Pre-flight isolado exige NEXT_BUILD_DIST_DIR=.next.test.");
}

const nextDir = path.join(frontendRoot, nextBuildDirectoryName);
const standaloneDir = path.join(nextDir, "standalone");
const workspaceRoot = path.resolve(frontendRoot, "..", "..");
const standaloneAppDir = path.join(standaloneDir, path.relative(workspaceRoot, frontendRoot));
const staticDir = path.join(nextDir, "static");
const publicDir = path.join(frontendRoot, "public");
const artifactDirectoryName = process.env.PROD_ARTIFACT_DIR?.trim()
  || (isolatedPreflight || nextBuildDirectoryName === ".next.test" ? "dist-prod.test" : "dist-prod");
const allowedArtifactDirectories = new Set(["dist-prod", "dist-prod.next", "dist-prod.test"]);

if (!allowedArtifactDirectories.has(artifactDirectoryName)) {
  throw new Error(
    "PROD_ARTIFACT_DIR deve ser dist-prod, dist-prod.next ou dist-prod.test."
  );
}
if ((isolatedPreflight || nextBuildDirectoryName === ".next.test") && artifactDirectoryName !== "dist-prod.test") {
  throw new Error("Build isolado so pode preparar dist-prod.test.");
}

const outputDir = path.join(frontendRoot, artifactDirectoryName);
const outputNextDir = path.join(outputDir, nextBuildDirectoryName);
const sourceRequire = createRequire(path.join(frontendRoot, "package.json"));
const sourceNodeModules = path.join(frontendRoot, "node_modules");
const SHARP_PROBE_WIDTH = 32;
const SHARP_PROBE_HEIGHT = 32;

async function requireDirectory(directory, label) {
  try {
    await access(directory);
  } catch {
    throw new Error(`${label} ausente. Execute \"npm run build\" antes de preparar o artefato.`);
  }
}

function isInsideDirectory(directory, candidate) {
  const relativePath = path.relative(directory, candidate);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

async function findPackageRoot(packageName, packageRequire, required) {
  const resolutionCandidates = [
    `${packageName}/package.json`,
    `${packageName}/package`,
    `${packageName}/sharp.node`,
    `${packageName}/lib`,
    packageName,
  ];

  for (const candidate of resolutionCandidates) {
    let resolvedPath;
    try {
      resolvedPath = packageRequire.resolve(candidate);
    } catch {
      continue;
    }

    let currentDirectory = path.dirname(resolvedPath);
    while (isInsideDirectory(frontendRoot, currentDirectory)) {
      const manifestPath = path.join(currentDirectory, "package.json");
      let manifest = null;
      try {
        manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(`Manifesto invalido para ${packageName}: ${manifestPath}.`);
        }
      }

      if (manifest?.name === packageName) {
        if (!isInsideDirectory(sourceNodeModules, currentDirectory)) {
          throw new Error(`Pacote ${packageName} foi resolvido fora de node_modules do frontend.`);
        }
        return { manifest, root: currentDirectory };
      }

      const parentDirectory = path.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) break;
      currentDirectory = parentDirectory;
    }
  }

  if (required) {
    throw new Error(
      `Dependencia ${packageName} do Sharp ausente. Execute "npm ci" antes de preparar o artefato.`
    );
  }
  return null;
}

async function collectSharpRuntimePackages() {
  const packages = new Map();

  async function visit(packageName, packageRequire, required) {
    const resolvedPackage = await findPackageRoot(packageName, packageRequire, required);
    if (!resolvedPackage) return;
    const resolvedRoot = path.resolve(resolvedPackage.root);
    const packageKey = process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot;
    if (packages.has(packageKey)) return;

    const relativeSource = path.relative(sourceNodeModules, resolvedPackage.root);
    if (!relativeSource || relativeSource.startsWith("..") || path.isAbsolute(relativeSource)) {
      throw new Error(`Pacote ${packageName} possui localizacao invalida no runtime do Sharp.`);
    }
    packages.set(packageKey, {
      name: packageName,
      source: resolvedPackage.root,
      relativeSource,
    });

    const childRequire = createRequire(path.join(resolvedPackage.root, "package.json"));
    const dependencies = Object.keys(resolvedPackage.manifest.dependencies ?? {});
    const optionalDependencies = Object.keys(resolvedPackage.manifest.optionalDependencies ?? {});

    for (const dependency of dependencies) {
      await visit(dependency, childRequire, true);
    }
    for (const dependency of optionalDependencies) {
      await visit(dependency, childRequire, false);
    }
  }

  await visit("sharp", sourceRequire, true);
  return packages;
}

async function copySharpRuntime() {
  const packages = await collectSharpRuntimePackages();
  const outputNodeModules = path.join(outputDir, "node_modules");

  for (const runtimePackage of packages.values()) {
    const destination = path.join(outputNodeModules, runtimePackage.relativeSource);
    await rm(destination, { recursive: true, force: true });
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(runtimePackage.source, destination, { recursive: true });
    runtimePackage.destination = destination;
  }

  return [...packages.values()];
}

async function verifySharpRuntime(packages) {
  const artifactRequire = createRequire(path.join(outputDir, "server.js"));

  for (const runtimePackage of packages) {
    await requireDirectory(
      runtimePackage.destination,
      `Pacote ${runtimePackage.name} no artefato standalone`
    );
  }

  const sharpEntry = artifactRequire.resolve("sharp");
  if (!isInsideDirectory(outputDir, sharpEntry)) {
    throw new Error("O Sharp do artefato standalone foi resolvido fora do proprio artefato.");
  }

  const sharp = artifactRequire("sharp");
  const rawInput = Buffer.alloc(SHARP_PROBE_WIDTH * SHARP_PROBE_HEIGHT * 3, 127);
  const { data, info } = await sharp(rawInput, {
    raw: { width: SHARP_PROBE_WIDTH, height: SHARP_PROBE_HEIGHT, channels: 3 },
  })
    .resize(8, 8)
    .webp({ quality: 75 })
    .toBuffer({ resolveWithObject: true });

  if (info.format !== "webp" || info.width !== 8 || info.height !== 8 || data.length >= rawInput.length) {
    throw new Error("O Sharp do artefato standalone nao concluiu o redimensionamento de verificacao.");
  }
}

await requireDirectory(standaloneDir, "Build standalone do Next");
await requireDirectory(standaloneAppDir, "Raiz standalone do site");
await requireDirectory(staticDir, "Assets estaticos do Next");

const buildId = (await readFile(path.join(nextDir, "BUILD_ID"), "utf8")).trim();

await rm(outputDir, { recursive: true, force: true });
// Com `externalDir`, o Next preserva o caminho `site/frontend` dentro de
// `.next/standalone`. O artefato operacional precisa manter `server.js` na
// raiz para coincidir com o processo PM2 e com os testes de hardening.
await cp(standaloneAppDir, outputDir, { recursive: true });
const sharpRuntimePackages = await copySharpRuntime();
await mkdir(outputNextDir, { recursive: true });
await cp(staticDir, path.join(outputNextDir, "static"), {
  recursive: true,
  filter: (source) => !source.endsWith(".map"),
});

try {
  await access(publicDir);
  await cp(publicDir, path.join(outputDir, "public"), { recursive: true });
} catch {
  // O diretório public é opcional em projetos Next.
}

await verifySharpRuntime(sharpRuntimePackages);

await writeFile(
  path.join(outputDir, "build-info.json"),
  `${JSON.stringify(
    {
      format: "next-standalone",
      buildId,
      generatedAt: new Date().toISOString(),
      staticAssets: `${nextBuildDirectoryName}/static`,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`Artefato produtivo atualizado: ${path.relative(frontendRoot, outputDir)}`);
