#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const EXPECTED_NPM_VERSION = "11.18.0";

function resolveNpmCli() {
  const candidate = process.env.npm_execpath;
  if (!candidate)
    throw new Error("npm_execpath is unavailable; run through npm");
  const resolved = path.resolve(candidate);
  if (
    path.basename(resolved).toLowerCase() !== "npm-cli.js" ||
    path.basename(path.dirname(resolved)).toLowerCase() !== "bin" ||
    path.basename(path.dirname(path.dirname(resolved))).toLowerCase() !== "npm"
  ) {
    throw new Error(
      "npm_execpath does not resolve to a trusted npm/bin/npm-cli.js path",
    );
  }
  return resolved;
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    env,
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

let npmCli;
try {
  npmCli = resolveNpmCli();
  const version = spawnSync(process.execPath, [npmCli, "--version"], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (version.error) throw version.error;
  if (version.status !== 0 || version.stdout.trim() !== EXPECTED_NPM_VERSION) {
    throw new Error(
      `npm ${EXPECTED_NPM_VERSION} is required; received ${version.stdout.trim() || "no version"}`,
    );
  }
} catch (error) {
  process.stderr.write(
    `Locked install failed closed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}

run(process.execPath, [npmCli, "ci", "--ignore-scripts"]);
run(process.execPath, [path.resolve("scripts/install-script-policy.mjs")], {
  ...process.env,
  npm_execpath: npmCli,
});
run(process.execPath, [npmCli, "rebuild"]);
