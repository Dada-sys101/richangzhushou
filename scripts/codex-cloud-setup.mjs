#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);
const mode = process.argv[2] ?? "setup";
if (!["setup", "verify", "run"].includes(mode))
  throw new Error("Use setup, verify, or run <check-script>");
const checkScripts = new Set([
  "quality",
  "check:context",
  "format:check",
  "lint",
  "typecheck",
  "test",
  "build",
  "validate:prisma",
  "validate:openapi",
  "validate:migration",
  "audit:dependencies",
  "test:governance",
]);
if (
  mode === "run" &&
  (!checkScripts.has(process.argv[3]) || process.argv.length !== 4)
)
  throw new Error("Only repository check scripts are supported");
if (Number(process.versions.node.split(".")[0]) !== 24)
  throw new Error("Select Node.js 24 in the Cloud environment before setup");
if (manifest.packageManager !== "npm@11.18.0")
  throw new Error("Toolchain declaration changed; review this setup script");
for (const directory of ["", "apps/api", "apps/web", "apps/admin"]) {
  for (const name of readdirSync(path.join(root, directory)).filter(
    (entry) =>
      (entry === ".env" || entry.startsWith(".env.")) &&
      !entry.endsWith(".example"),
  )) {
    if (existsSync(path.join(root, directory, name)))
      throw new Error("Use a clean checkout without runtime .env files");
  }
}

// Inherit only OS/tool discovery values. Never pass application credentials.
const env = {};
for (const name of [
  "PATH",
  "Path",
  "HOME",
  "USERPROFILE",
  "SystemRoot",
  "SYSTEMROOT",
  "COMSPEC",
  "PATHEXT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LOCALAPPDATA",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
]) {
  if (process.env[name] !== undefined) env[name] = process.env[name];
}
Object.assign(env, {
  CI: "true",
  DATABASE_URL:
    "mysql://cloud:local-validation-only@127.0.0.1:3306/cloud_unused",
  DOTENV_CONFIG_PATH: path.join(tmpdir(), "codex-cloud-no-dotenv"),
  V15_AI_ALLOWED: "false",
  V15_LIVE_PUSH_ALLOWED: "false",
  V15_WEB_PUSH_ALLOWED: "false",
  REMINDER_SCHEDULER_ENABLED: "false",
  STORAGE_PROVIDER: "local",
  npm_config_registry: "https://registry.npmjs.org/",
});
const toolRoot = path.join(
  tmpdir(),
  `daily-assistant-npm-${createHash("sha256").update(root).digest("hex").slice(0, 12)}`,
);
mkdirSync(toolRoot, { recursive: true });
const emptyConfig = path.join(toolRoot, "empty.npmrc");
writeFileSync(emptyConfig, "");
env.npm_config_userconfig = emptyConfig;
const emptyGlobalConfig = path.join(toolRoot, "empty-global.npmrc");
writeFileSync(emptyGlobalConfig, "");
env.npm_config_globalconfig = emptyGlobalConfig;

function run(cli, args, cwd = root) {
  console.log(`> ${path.basename(cli)} ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    env,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npmCli = path.join(toolRoot, "node_modules/npm/bin/npm-cli.js");
const version = existsSync(npmCli)
  ? spawnSync(process.execPath, [npmCli, "--version"], {
      env,
      encoding: "utf8",
      windowsHide: true,
    })
  : null;
if (version?.stdout.trim() !== "11.18.0") {
  const candidates = [
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    ),
    path.resolve(
      path.dirname(process.execPath),
      "../lib/node_modules/npm/bin/npm-cli.js",
    ),
  ];
  const bootstrapCli = candidates.find((candidate) => existsSync(candidate));
  if (!bootstrapCli)
    throw new Error("A Node installation with bundled npm is required");
  run(
    bootstrapCli,
    [
      "install",
      "--prefix",
      toolRoot,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--engine-strict=false",
      "--package-lock=false",
      "npm@11.18.0",
    ],
    toolRoot,
  );
}
const pathKey =
  Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
env[pathKey] = [
  path.join(toolRoot, "node_modules/.bin"),
  path.dirname(process.execPath),
  env[pathKey] ?? "",
].join(path.delimiter);
run(npmCli, ["--version"]);
console.log(`Node ${process.version}; repository ${root}`);
if (mode === "setup") {
  run(npmCli, ["run", "install:locked"]);
  run(npmCli, [
    "run",
    "prisma:generate",
    "--workspace",
    "@daily-assistant/api",
  ]);
  run(npmCli, [
    "run",
    "build",
    "--workspace",
    "@daily-assistant/api-contracts",
  ]);
  run(npmCli, ["run", "build", "--workspace", "@daily-assistant/config"]);
} else if (mode === "verify") {
  run(npmCli, ["run", "test:governance"]);
  run(npmCli, ["run", "quality"]);
} else {
  run(npmCli, ["run", process.argv[3]]);
}
