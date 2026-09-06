import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

const artifactDirectoryName = process.env.PROD_ARTIFACT_DIR?.trim()
  || (isolatedPreflight || nextBuildDirectoryName === ".next.test" ? "dist-prod.test" : "dist-prod");
const allowedArtifactDirectories = new Set(["dist-prod", "dist-prod.next", "dist-prod.test"]);

if (!allowedArtifactDirectories.has(artifactDirectoryName)) {
  throw new Error("PROD_ARTIFACT_DIR deve ser dist-prod, dist-prod.next ou dist-prod.test.");
}
if ((isolatedPreflight || nextBuildDirectoryName === ".next.test") && artifactDirectoryName !== "dist-prod.test") {
  throw new Error("Build isolado so pode preparar dist-prod.test.");
}

const nextDir = path.join(frontendRoot, nextBuildDirectoryName);
const standaloneDir = path.join(nextDir, "standalone");
const staticDir = path.join(nextDir, "static");
const publicDir = path.join(frontendRoot, "public");
const outputDir = path.join(frontendRoot, artifactDirectoryName);
const outputNextDir = path.join(outputDir, nextBuildDirectoryName);

async function requireDirectory(directory, label) {
  try {
    await access(directory);
  } catch {
    throw new Error(`${label} ausente. Execute "npm run build" antes de preparar o artefato.`);
  }
}

await requireDirectory(standaloneDir, "Build standalone do Next do Landing Builder");
await requireDirectory(staticDir, "Assets estaticos do Next do Landing Builder");

const buildId = (await readFile(path.join(nextDir, "BUILD_ID"), "utf8")).trim();

await rm(outputDir, { recursive: true, force: true });
await cp(standaloneDir, outputDir, { recursive: true });
await mkdir(outputNextDir, { recursive: true });
await cp(staticDir, path.join(outputNextDir, "static"), {
  recursive: true,
  filter: (source) => !source.endsWith(".map"),
});

try {
  await access(publicDir);
  await cp(publicDir, path.join(outputDir, "public"), { recursive: true });
} catch {
  // O diretório public é opcional neste frontend.
}

await writeFile(
  path.join(outputDir, "build-info.json"),
  `${JSON.stringify({ format: "next-standalone", buildId, generatedAt: new Date().toISOString(), staticAssets: `${nextBuildDirectoryName}/static` }, null, 2)}\n`,
  "utf8"
);

console.log(`Artefato produtivo do Landing Builder atualizado: ${path.relative(frontendRoot, outputDir)}`);
