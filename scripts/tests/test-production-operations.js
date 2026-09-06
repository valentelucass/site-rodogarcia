const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "../..");

function writeFile(target, contents = "// test artifact\n") {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function remove(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copySharpFixtureDependencies(projectRoot) {
  const sourceNodeModules = path.join(ROOT_DIR, "site", "frontend", "node_modules");
  const runtimePackages = ["sharp", "detect-libc", "semver", "@img"];

  writeFile(path.join(projectRoot, "package.json"), '{"private":true}\n');
  for (const relativePackagePath of runtimePackages) {
    const source = path.join(sourceNodeModules, relativePackagePath);
    assert.ok(
      fs.existsSync(source),
      `Dependencia do Sharp ausente para a fixture: ${source}`
    );
    fs.cpSync(source, path.join(projectRoot, "node_modules", relativePackagePath), {
      recursive: true,
    });
  }
}

function assertPreparedSharpWorksWithoutSourceNodeModules(preparedArtifact, fixtureRoot) {
  const isolatedArtifact = path.join(fixtureRoot, "isolated-sharp-runtime");
  fs.cpSync(preparedArtifact, isolatedArtifact, { recursive: true });

  const probe = spawnSync(
    process.execPath,
    [
      "-e",
      [
        "const sharp = require(require.resolve('sharp', { paths: [process.cwd()] }));",
        "const input = Buffer.alloc(32 * 32 * 3, 127);",
        "sharp(input, { raw: { width: 32, height: 32, channels: 3 } })",
        "  .resize(8, 8).webp({ quality: 75 }).toBuffer({ resolveWithObject: true })",
        "  .then(({ data, info }) => {",
        "    if (info.format !== 'webp' || info.width !== 8 || info.height !== 8 || data.length >= input.length) process.exit(2);",
        "  })",
        "  .catch((error) => { console.error(error); process.exit(1); });",
      ].join("\n"),
    ],
    { cwd: isolatedArtifact, encoding: "utf8" }
  );

  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
}

function createPromotionFixture() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "rodogarcia-promotion-test-"));
  fs.mkdirSync(path.join(fixture, "scripts"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT_DIR, "scripts", "promote-production-artifacts.js"),
    path.join(fixture, "scripts", "promote-production-artifacts.js")
  );

  const artifacts = [
    ["site/backend", "dist", "server.jar"],
    ["cms/backend", "dist", "server.jar"],
    ["site/frontend", "dist-prod", "server.js"],
    ["cms/frontend", "dist-prod", "server.js"],
    ["landing-builder/backend", "dist", "server.jar"],
    ["landing-builder/frontend", "dist-prod", "server.js"],
  ];
  for (const [project, active, entrypoint] of artifacts) {
    writeFile(path.join(fixture, project, active, entrypoint));
    writeFile(path.join(fixture, project, `${active}.next`, entrypoint));
  }
  return fixture;
}

function runPromotion(fixture, command, ...flags) {
  return spawnSync(
    process.execPath,
    [path.join(fixture, "scripts", "promote-production-artifacts.js"), command, ...flags],
    { cwd: fixture, encoding: "utf8" }
  );
}

function testVerifyRequiresActiveSpringArtifacts() {
  const fixture = createPromotionFixture();
  try {
    remove(path.join(fixture, "site/backend/dist"));
    const result = runPromotion(fixture, "--verify");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Artefato ativo para rollback ausente/);
  } finally {
    remove(fixture);
  }
}

function testPromotionAndRollbackPreserveSpringArtifacts() {
  const fixture = createPromotionFixture();
  try {
    let result = runPromotion(fixture, "--promote");
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(fixture, "site/backend/dist/server.jar")));
    assert.ok(fs.existsSync(path.join(fixture, "site/backend/dist.previous/server.jar")));
    assert.ok(fs.existsSync(path.join(fixture, "cms/backend/dist/server.jar")));
    assert.ok(fs.existsSync(path.join(fixture, "cms/backend/dist.previous/server.jar")));

    result = runPromotion(fixture, "--rollback");
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(fixture, "site/backend/dist/server.jar")));
    assert.ok(fs.existsSync(path.join(fixture, "cms/backend/dist/server.jar")));
    assert.ok(fs.existsSync(path.join(fixture, "site/backend/dist.failed/server.jar")));
    assert.ok(fs.existsSync(path.join(fixture, "cms/backend/dist.failed/server.jar")));
  } finally {
    remove(fixture);
  }
}

function testInitialRolloutAllowsMissingActiveArtifacts() {
  const fixture = createPromotionFixture();
  try {
    remove(path.join(fixture, "site/backend/dist"));
    remove(path.join(fixture, "cms/backend/dist"));
    const result = runPromotion(fixture, "--verify", "--initial-rollout");
    assert.equal(result.status, 0, result.stderr);
  } finally {
    remove(fixture);
  }
}

function testExternalBackupManifestTargetsItsOriginalSource() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "rodogarcia-backup-test-"));
  try {
    const source = path.join(fixture, "external storage");
    const output = path.join(fixture, "backups");
    writeFile(path.join(source, "content.json"), "{}\n");
    const result = spawnSync(
      process.execPath,
      [
        path.join(ROOT_DIR, "scripts", "backup-storage.js"),
        "--source", source,
        "--out", output,
        "--name", "fixture",
      ],
      { cwd: ROOT_DIR, encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(output, "fixture", "manifest.json"), "utf8")
    );
    assert.equal(manifest.source, path.resolve(source));
    assert.match(manifest.restoreCommand, /--target/);
    assert.ok(manifest.restoreCommand.includes(`"${path.resolve(source)}"`));
  } finally {
    remove(fixture);
  }
}

function testProductionLauncherUsesExternalBatchHelpers() {
  const launcher = fs.readFileSync(path.join(ROOT_DIR, "iniciar-prod.bat"), "utf8");
  assert.doesNotMatch(launcher, /\bcall\s+:/i);
  assert.match(launcher, /set\s+"ERRORLEVEL="/i);
  assert.match(launcher, /validate-production-inputs\.ps1/i);
  assert.match(launcher, /assert-production-preflight-isolated\.bat/i);
  assert.match(launcher, /DEV_PREFLIGHT_EXIT_CODE=%ERRORLEVEL%/i);
  assert.match(launcher, /if not "%DEV_PREFLIGHT_EXIT_CODE%"=="0" goto :preflight_failed/i);
  assert.match(launcher, /build-production-frontend-artifact\.bat" "site\\frontend" "site" "\.next\.test" "dist-prod\.test" "1"/i);
  assert.match(launcher, /build-production-frontend-artifact\.bat" "cms\\frontend" "CMS" "\.next\.test" "dist-prod\.test" "1"/i);
  assert.match(
    launcher,
    /set "LANDING_BUILDER_PUBLIC_URL=http:\/\/127\.0\.0\.1:42515"/i
  );
  assert.match(
    launcher,
    /node --experimental-websocket scripts\\tests\\test-security-hardening\.js/i
  );
  assert.match(launcher, /validate-production-rollout-mode\.bat/i);
  assert.match(launcher, /verify-production-spring-backend\.bat/i);
  assert.match(launcher, /RODOGARCIA_INITIAL_PROD_ROLLOUT/i);

  const installer = fs.readFileSync(
    path.join(ROOT_DIR, "scripts", "install-production-frontend-dependencies.bat"),
    "utf8"
  );
  assert.match(installer, /set\s+"COMMAND_EXIT_CODE=%ERRORLEVEL%"/i);
  assert.match(installer, /if not "%COMMAND_EXIT_CODE%"=="0"/i);

  const isolatedBuild = fs.readFileSync(
    path.join(ROOT_DIR, "scripts", "build-production-frontend-artifact.bat"),
    "utf8"
  );
  assert.match(isolatedBuild, /set "NEXT_BUILD_DIST_DIR=%~3"/i);
  assert.match(isolatedBuild, /set "PROD_ARTIFACT_DIR=%~4"/i);
  assert.match(isolatedBuild, /set "RODOGARCIA_ISOLATED_PREFLIGHT=%~5"/i);

  const ciWorkflow = fs.readFileSync(path.join(ROOT_DIR, ".github", "workflows", "ci.yml"), "utf8");
  assert.match(
    ciWorkflow,
    /LANDING_BUILDER_PUBLIC_URL:\s*http:\/\/127\.0\.0\.1:42515/i
  );
  assert.match(
    ciWorkflow,
    /node --experimental-websocket scripts\/tests\/test-security-hardening\.js/i
  );
}

function testPublicHomeVideoPolicy() {
  const content = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "site", "backend", "storage", "content.json"), "utf8")
  );
  const publicRoot = path.join(ROOT_DIR, "site", "frontend", "public");
  const mediaEntries = [];

  function collect(value) {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.type === "video" && typeof value.src === "string") {
      mediaEntries.push(value);
    }
    Object.values(value).forEach(collect);
  }

  collect(content.homePage);
  assert.ok(mediaEntries.length > 0, "A Home canonica deve manter suas midias de video.");

  for (const media of mediaEntries) {
    assert.match(media.src, /\.[a-f0-9]{12}\.webm$/i, `Video sem hash de conteudo: ${media.src}`);
    assert.equal(
      typeof media.poster === "string" && media.poster.length > 0,
      true,
      `Video adiado sem poster: ${media.src}`
    );

    for (const [kind, publicUrl] of [["video", media.src], ["poster", media.poster]]) {
      assert.equal(publicUrl.startsWith("/") && !publicUrl.startsWith("//"), true);
      const normalizedUrl = publicUrl.startsWith("/public/")
        ? publicUrl.slice("/public".length)
        : publicUrl;
      const assetPath = path.join(publicRoot, normalizedUrl.replace(/^\/+/, ""));
      assert.ok(fs.existsSync(assetPath), `${kind} publico ausente: ${publicUrl}`);

      if (kind === "video") {
        const bytes = fs.readFileSync(assetPath);
        assert.equal(
          bytes.includes(Buffer.from("OpusHead")),
          false,
          `Loop decorativo ainda contem faixa Opus: ${publicUrl}`
        );
      }
    }
  }
}

function testNegativeNpmExitStopsTheInstallHelper() {
  if (process.platform !== "win32") return;

  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "rodogarcia-npm-exit-test-"));
  try {
    writeFile(path.join(fixture, "npm.cmd"), "@echo off\r\nexit /b -4048\r\n");
    const result = spawnSync(
      "cmd.exe",
      [
        "/d",
        "/c",
        `call "${path.join(ROOT_DIR, "scripts", "install-production-frontend-dependencies.bat")}" "${path.join(ROOT_DIR, "site", "frontend")}" fixture`,
      ],
      {
        cwd: ROOT_DIR,
        encoding: "utf8",
        env: { ...process.env, PATH: `${fixture};${process.env.PATH}` },
      }
    );
    assert.equal(result.status, 1, result.stderr);
  } finally {
    remove(fixture);
  }
}

function testIsolatedNextArtifactNeverTouchesTheActiveArtifact() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "rodogarcia-next-artifact-test-"));
  const frontends = [
    {
      project: ["site", "frontend"],
      standaloneApp: ["site", "frontend"],
      requiresSharpRuntime: true,
    },
    { project: ["cms", "frontend"], standaloneApp: ["cms", "frontend"] },
    { project: ["landing-builder", "frontend"], standaloneApp: [] },
  ];

  try {
    for (const frontend of frontends) {
      const projectRoot = path.join(fixture, ...frontend.project);
      const sourceScript = path.join(
        ROOT_DIR,
        ...frontend.project,
        "scripts",
        "prepare-prod-artifact.mjs"
      );
      const script = path.join(projectRoot, "scripts", "prepare-prod-artifact.mjs");
      const nextTestRoot = path.join(projectRoot, ".next.test");
      const standaloneRoot = path.join(nextTestRoot, "standalone", ...frontend.standaloneApp);

      fs.mkdirSync(path.dirname(script), { recursive: true });
      fs.copyFileSync(sourceScript, script);
      writeFile(path.join(standaloneRoot, "server.js"), "// isolated artifact\n");
      writeFile(path.join(nextTestRoot, "static", "chunk.js"), "// static\n");
      writeFile(path.join(nextTestRoot, "BUILD_ID"), "isolated-test\n");
      writeFile(path.join(projectRoot, "dist-prod", "server.js"), "// active artifact\n");
      if (frontend.requiresSharpRuntime) {
        copySharpFixtureDependencies(projectRoot);
      }

      const blocked = spawnSync(process.execPath, [script], {
        cwd: projectRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NEXT_BUILD_DIST_DIR: ".next.test",
          PROD_ARTIFACT_DIR: "dist-prod",
        },
      });
      assert.notEqual(blocked.status, 0);
      assert.match(blocked.stderr, /Build isolado so pode preparar dist-prod\.test/);
      assert.equal(
        fs.readFileSync(path.join(projectRoot, "dist-prod", "server.js"), "utf8"),
        "// active artifact\n"
      );

      const missingIsolatedEnvironment = spawnSync(process.execPath, [script], {
        cwd: projectRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NEXT_BUILD_DIST_DIR: ".next",
          PROD_ARTIFACT_DIR: "dist-prod",
          RODOGARCIA_ISOLATED_PREFLIGHT: "1",
        },
      });
      assert.notEqual(missingIsolatedEnvironment.status, 0);
      assert.match(
        missingIsolatedEnvironment.stderr,
        /Pre-flight isolado exige NEXT_BUILD_DIST_DIR=\.next\.test/
      );
      assert.equal(
        fs.readFileSync(path.join(projectRoot, "dist-prod", "server.js"), "utf8"),
        "// active artifact\n"
      );

      const prepared = spawnSync(process.execPath, [script], {
        cwd: projectRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NEXT_BUILD_DIST_DIR: ".next.test",
          PROD_ARTIFACT_DIR: "",
        },
      });
      assert.equal(prepared.status, 0, prepared.stderr);
      assert.ok(fs.existsSync(path.join(projectRoot, "dist-prod.test", "server.js")));
      assert.ok(
        fs.existsSync(
          path.join(projectRoot, "dist-prod.test", ".next.test", "static", "chunk.js")
        ),
        `${frontend.project.join("/")} nao preservou o distDir compilado no artefato isolado.`
      );
      const buildInfo = JSON.parse(
        fs.readFileSync(path.join(projectRoot, "dist-prod.test", "build-info.json"), "utf8")
      );
      assert.equal(buildInfo.staticAssets, ".next.test/static");
      assert.equal(
        fs.readFileSync(path.join(projectRoot, "dist-prod", "server.js"), "utf8"),
        "// active artifact\n"
      );
      if (frontend.requiresSharpRuntime) {
        assertPreparedSharpWorksWithoutSourceNodeModules(
          path.join(projectRoot, "dist-prod.test"),
          fixture
        );
      }
    }
  } finally {
    remove(fixture);
  }
}

testVerifyRequiresActiveSpringArtifacts();
testPromotionAndRollbackPreserveSpringArtifacts();
testInitialRolloutAllowsMissingActiveArtifacts();
testExternalBackupManifestTargetsItsOriginalSource();
testProductionLauncherUsesExternalBatchHelpers();
testPublicHomeVideoPolicy();
testNegativeNpmExitStopsTheInstallHelper();
testIsolatedNextArtifactNeverTouchesTheActiveArtifact();
console.log("ALL PRODUCTION OPERATION TESTS PASS");
