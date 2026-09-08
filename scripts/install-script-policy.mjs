#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function evaluateInstallScriptListing({
  stdout,
  code,
  commandError = null,
}) {
  if (commandError) {
    return {
      passed: false,
      errors: [`install-script listing failed: ${commandError.message}`],
    };
  }
  if (code !== 0) {
    return {
      passed: false,
      errors: [`install-script listing exited with code ${String(code)}`],
    };
  }
  if (typeof stdout !== "string" || stdout.trim() === "") {
    return {
      passed: false,
      errors: ["install-script listing returned empty output"],
    };
  }
  let document;
  try {
    document = JSON.parse(stdout);
  } catch (error) {
    return {
      passed: false,
      errors: [
        `install-script listing is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  if (
    !document ||
    typeof document !== "object" ||
    Array.isArray(document) ||
    Object.keys(document).length !== 1 ||
    !Array.isArray(document.allowScripts)
  ) {
    return {
      passed: false,
      errors: ["install-script listing has an unexpected structure"],
    };
  }
  if (document.allowScripts.length > 0) {
    const pending = document.allowScripts
      .map((entry) => entry?.name)
      .filter((name) => typeof name === "string" && name !== "");
    return {
      passed: false,
      errors: [
        `unreviewed install scripts remain: ${pending.join(", ") || "unknown package"}`,
      ],
    };
  }
  return { passed: true, errors: [] };
}

function resolveNpmCli() {
  const candidate = process.env.npm_execpath;
  if (!candidate)
    throw new Error("npm_execpath is unavailable; run through npm 11.18.0");
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

function main() {
  let execution;
  try {
    execution = spawnSync(
      process.execPath,
      [resolveNpmCli(), "install-scripts", "ls", "--json"],
      { encoding: "utf8", shell: false, windowsHide: true },
    );
  } catch (error) {
    execution = { stdout: "", status: null, error };
  }
  const result = evaluateInstallScriptListing({
    stdout: execution.stdout ?? "",
    code: execution.status,
    commandError: execution.error ?? null,
  });
  if (!result.passed) {
    process.stderr.write("Install-script policy failed closed.\n");
    for (const error of result.errors)
      process.stderr.write(`Install-script policy error: ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    "Install-script policy passed: no unreviewed install scripts.\n",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
