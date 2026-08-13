#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const OUTPUT_PATH = path.join(ROOT_DIRECTORY, "output", "pr6", "sbom.cdx.json");

export const SBOM_ARGUMENTS = [
  "sbom",
  "--package-lock-only",
  "--sbom-format",
  "cyclonedx",
  "--sbom-type",
  "application",
  "--workspaces",
];

function resolveNpmCli() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error(
      "npm_execpath is unavailable; run sbom:generate through npm.",
    );
  }
  return npmCli;
}

const CHILD_ENVIRONMENT_KEYS = [
  "COMSPEC",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LOCALAPPDATA",
  "PATH",
  "PATHEXT",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "USERPROFILE",
  "WINDIR",
];

export function buildSbomChildEnvironment(source = process.env) {
  const environment = {};
  for (const key of CHILD_ENVIRONMENT_KEYS) {
    if (typeof source[key] === "string" && source[key] !== "") {
      environment[key] = source[key];
    }
  }
  environment.NO_COLOR = "1";
  return environment;
}

export async function runSbomGenerate({
  npmCli = resolveNpmCli(),
  cwd = ROOT_DIRECTORY,
  args = SBOM_ARGUMENTS,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, ...args], {
      cwd,
      env: buildSbomChildEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      reject(new Error(`Could not start npm sbom: ${error.message}`));
    });
    child.once("close", (code) => {
      if (code !== 0) {
        const detail = stderr.trim() ? `: ${stderr.trim()}` : "";
        reject(new Error(`npm sbom exited with code ${String(code)}${detail}`));
        return;
      }
      if (!stdout.trim()) {
        reject(new Error("npm sbom produced an empty output."));
        return;
      }
      resolve(stdout);
    });
  });
}

async function main() {
  const stdout = await runSbomGenerate();
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, stdout, { encoding: "utf8", flag: "w" });
  process.stdout.write(`SBOM written to ${OUTPUT_PATH}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(
      `SBOM generation failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
