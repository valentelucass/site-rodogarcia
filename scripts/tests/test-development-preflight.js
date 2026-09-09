const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PROJECTS = ["site", "cms", "landing-builder"];
const STEPS = [
  ...PROJECTS.map((project) => `${project}/backend`),
  ...PROJECTS.map((project) => `${project}/frontend`),
];

function writeFixture(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents.replace(/\r?\n/g, "\r\n"));
}

function testDevelopmentPreflight() {
  if (process.platform !== "win32") return;

  const launcher = fs.readFileSync(path.join(ROOT_DIR, "iniciar-dev.bat"), "utf8");
  const cleanupIndex = launcher.indexOf("rem A limpeza do DEV");
  const failureLabelIndex = launcher.indexOf("\n:preparation_failed");
  assert.ok(cleanupIndex > 0 && failureLabelIndex > cleanupIndex);

  // Executa somente a preparacao em uma fixture. Limpeza e start nao entram no batch de teste.
  const preparation = launcher.slice(0, cleanupIndex);
  assert.doesNotMatch(preparation, /\b(?:pm2|powershell|taskkill|rmdir|start|Stop-Process)\b/i);
  const testBatch = `${preparation}\necho APPROVED>>"%FIXTURE_TRACE%"\nexit /b 0\n${launcher.slice(failureLabelIndex)}`;
  const scenarios = [
    { failedStep: "", exitCode: 0 },
    { failedStep: "", exitCode: 0, installed: true },
    ...STEPS.flatMap((failedStep) => [1, -4048].map((exitCode) => ({ failedStep, exitCode }))),
  ];

  for (const scenario of scenarios) {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "rodogarcia-dev-preflight-"));
    try {
      const trace = path.join(fixture, "trace.txt");
      const batch = path.join(fixture, "preflight-only.bat");
      writeFixture(batch, testBatch);
      writeFixture(path.join(fixture, ".env"), "LANDING_BUILDER_SERVICE_TOKEN=fixture-only\n");
      writeFixture(path.join(fixture, "java.cmd"), "@echo off\nexit /b 0\n");
      for (const helper of ["load-root-env.bat", "compile-spring-dev-backend.bat", "install-dev-frontend-dependencies.bat"]) {
        writeFixture(
          path.join(fixture, "scripts", helper),
          fs.readFileSync(path.join(ROOT_DIR, "scripts", helper), "utf8")
        );
      }
      const npmStub = ["@echo off"];
      for (const project of PROJECTS) {
        const backend = `${project}/backend`;
        const frontend = `${project}/frontend`;
        writeFixture(path.join(fixture, backend, "mvnw.cmd"), [
          "@echo off",
          `echo ${backend}>>"%FIXTURE_TRACE%"`,
          `exit /b ${scenario.failedStep === backend ? scenario.exitCode : 0}`,
        ].join("\n"));
        writeFixture(path.join(fixture, frontend, "package-lock.json"), "{}\n");
        npmStub.push(
          `if /I "%CD%"=="${path.join(fixture, frontend)}" (`,
          `  echo ${frontend}>>"%FIXTURE_TRACE%"`,
          `  exit /b ${scenario.failedStep === frontend ? scenario.exitCode : 0}`,
          ")"
        );
        if (scenario.installed) fs.mkdirSync(path.join(fixture, frontend, "node_modules"));
      }
      npmStub.push("exit /b 99");
      writeFixture(path.join(fixture, "npm.cmd"), npmStub.join("\n"));

      const result = spawnSync("cmd.exe", ["/d", "/c", `call "${batch}"`], {
        cwd: fixture,
        encoding: "utf8",
        windowsVerbatimArguments: true,
        timeout: 15000,
        // Nao herda configuracoes, segredos nem ferramentas reais de build do ambiente operacional.
        env: {
          SystemRoot: process.env.SystemRoot,
          ComSpec: process.env.ComSpec,
          PATH: `${fixture};${path.join(process.env.SystemRoot, "System32")}`,
          PATHEXT: ".COM;.EXE;.BAT;.CMD",
          TEMP: fixture,
          TMP: fixture,
          FIXTURE_TRACE: trace,
          ERRORLEVEL: "0",
        },
      });
      assert.equal(result.error, undefined);
      const actualSteps = fs.existsSync(trace)
        ? fs.readFileSync(trace, "utf8").trim().split(/\r?\n/)
        : [];
      const failureIndex = STEPS.indexOf(scenario.failedStep);
      const expectedSteps = failureIndex >= 0
        ? STEPS.slice(0, failureIndex + 1)
        : [...(scenario.installed ? STEPS.slice(0, 3) : STEPS), "APPROVED"];
      assert.equal(result.status, failureIndex >= 0 ? 1 : 0, result.stderr || result.stdout);
      assert.deepEqual(actualSteps, expectedSteps, `${scenario.failedStep || "success"}/${scenario.exitCode}`);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  }
}

module.exports = { testDevelopmentPreflight };
