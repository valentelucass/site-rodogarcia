const fs = require("node:fs");
const path = require("node:path");
const { readEnvironmentFile } = require("./scripts/parse-environment-file");

const rootDir = __dirname;
const envFile = process.env.RODOGARCIA_ENV_FILE
  ? path.resolve(rootDir, process.env.RODOGARCIA_ENV_FILE)
  : path.join(rootDir, ".env.production.local");

const productionEnv = readEnvironmentFile(envFile);

function resolveJavaExecutable() {
  const configuredExecutable = process.env.RODOGARCIA_JAVA_EXECUTABLE?.trim();
  const javaHome = process.env.JAVA_HOME?.trim();
  const candidates = [
    configuredExecutable,
    javaHome && path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error("Java de producao nao encontrado. Configure RODOGARCIA_JAVA_EXECUTABLE ou JAVA_HOME.");
}

const JAVA_EXECUTABLE = resolveJavaExecutable();
const sharedEnv = {
  ...productionEnv,
  NODE_ENV: "production",
  BACKEND_INTERNAL_URL: "http://127.0.0.1:6050",
  CMS_BACKEND_INTERNAL_URL: "http://127.0.0.1:6051",
  CMS_INTERNAL_URL: "http://127.0.0.1:6061",
  CMS_BACKEND_PROXY_URL: "http://127.0.0.1:6051",
  LANDING_BUILDER_API_URL: "http://127.0.0.1:41110",
  LANDING_BUILDER_PUBLIC_URL: "http://127.0.0.1:41112",
  LANDING_BUILDER_ASSET_PREFIX:
    productionEnv.LANDING_BUILDER_ASSET_PREFIX || "/landing-assets",
  NEXT_PUBLIC_SITE_URL:
    productionEnv.NEXT_PUBLIC_SITE_URL || "https://site.rodogarcia.com.br",
};

const backendEnv = {
  ...sharedEnv,
  HOST: "127.0.0.1",
  PORT: "6050",
};

const frontendEnv = {
  ...sharedEnv,
  HOSTNAME: "127.0.0.1",
  PORT: "6060",
};

const cmsBackendEnv = {
  ...sharedEnv,
  HOST: "127.0.0.1",
  PORT: "6051",
};

const cmsEnv = {
  ...sharedEnv,
  HOSTNAME: "127.0.0.1",
  PORT: "6061",
};

const landingBuilderBackendEnv = {
  ...sharedEnv,
  HOST: "127.0.0.1",
  PORT: "41110",
  LANDING_BUILDER_HOST: "127.0.0.1",
  LANDING_BUILDER_PORT: "41110",
};

const landingBuilderEnv = {
  ...sharedEnv,
  HOSTNAME: "127.0.0.1",
  PORT: "41112",
  LANDING_BUILDER_BACKEND_URL: "http://127.0.0.1:41110",
  LANDING_BUILDER_SITE_URL:
    productionEnv.NEXT_PUBLIC_SITE_URL || "https://site.rodogarcia.com.br",
};

function requiredArtifact(label, targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Artefato ${label} não encontrado: ${targetPath}`);
  }
  return targetPath;
}

requiredArtifact(
  "Spring do backend público",
  path.join(rootDir, "site", "backend", "dist", "server.jar")
);
requiredArtifact(
  "Spring do backend do CMS",
  path.join(rootDir, "cms", "backend", "dist", "server.jar")
);
const landingBuilderBackendJar = requiredArtifact(
  "Spring do backend do Landing Builder",
  path.join(
    rootDir,
    "landing-builder",
    "backend",
    "dist",
    "server.jar"
  )
);
const landingBuilderFrontendScript = path.join(
  rootDir,
  "landing-builder",
  "frontend",
  "dist-prod",
  "server.js"
);
const hasLandingBuilderFrontendArtifact = fs.existsSync(landingBuilderFrontendScript);

module.exports = {
  apps: [
    {
      name: "site-api-prod",
      cwd: path.join(rootDir, "site", "backend"),
      script: JAVA_EXECUTABLE,
      args: ["-jar", path.join("dist", "server.jar")],
      interpreter: "none",
      env: backendEnv,
      env_production: backendEnv,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      time: true,
      out_file: path.join(rootDir, "logs", "rodogarcia-backend-out.log"),
      error_file: path.join(rootDir, "logs", "rodogarcia-backend-error.log"),
    },
    {
      name: "site-prod",
      cwd: path.join(rootDir, "site", "frontend", "dist-prod"),
      script: "server.js",
      interpreter: "node",
      env: frontendEnv,
      env_production: frontendEnv,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      time: true,
      out_file: path.join(rootDir, "logs", "rodogarcia-frontend-out.log"),
      error_file: path.join(rootDir, "logs", "rodogarcia-frontend-error.log"),
    },
    {
      name: "cms-api-prod",
      cwd: path.join(rootDir, "cms", "backend"),
      script: JAVA_EXECUTABLE,
      args: ["-jar", path.join("dist", "server.jar")],
      interpreter: "none",
      env: cmsBackendEnv,
      env_production: cmsBackendEnv,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      time: true,
      out_file: path.join(rootDir, "logs", "rodogarcia-cms-backend-out.log"),
      error_file: path.join(rootDir, "logs", "rodogarcia-cms-backend-error.log"),
    },
    {
      name: "cms-prod",
      cwd: path.join(rootDir, "cms", "frontend", "dist-prod"),
      script: "server.js",
      interpreter: "node",
      env: cmsEnv,
      env_production: cmsEnv,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      time: true,
      out_file: path.join(rootDir, "logs", "rodogarcia-cms-out.log"),
      error_file: path.join(rootDir, "logs", "rodogarcia-cms-error.log"),
    },
    {
      name: "landing-api-prod",
      cwd: path.join(rootDir, "landing-builder", "backend"),
      script: JAVA_EXECUTABLE,
      args: ["-jar", path.relative(path.join(rootDir, "landing-builder", "backend"), landingBuilderBackendJar)],
      interpreter: "none",
      env: landingBuilderBackendEnv,
      env_production: landingBuilderBackendEnv,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      time: true,
      out_file: path.join(rootDir, "logs", "rodogarcia-landing-builder-backend-out.log"),
      error_file: path.join(rootDir, "logs", "rodogarcia-landing-builder-backend-error.log"),
    },
    ...(hasLandingBuilderFrontendArtifact
      ? [
          {
            name: "landing-prod",
            cwd: path.join(rootDir, "landing-builder", "frontend", "dist-prod"),
            script: "server.js",
            interpreter: "node",
            env: landingBuilderEnv,
            env_production: landingBuilderEnv,
            autorestart: true,
            watch: false,
            max_restarts: 10,
            restart_delay: 3000,
            kill_timeout: 5000,
            time: true,
            out_file: path.join(rootDir, "logs", "rodogarcia-landing-builder-out.log"),
            error_file: path.join(rootDir, "logs", "rodogarcia-landing-builder-error.log"),
          },
        ]
      : []),
  ],
};
