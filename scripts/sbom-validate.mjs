#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DEFAULT_INPUT_PATH = path.join(
  ROOT_DIRECTORY,
  "output",
  "pr6",
  "sbom.cdx.json",
);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function validateSbomDocument(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return {
      valid: false,
      componentCount: 0,
      errors: ["SBOM input must be a non-empty string"],
    };
  }

  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    return {
      valid: false,
      componentCount: 0,
      errors: [
        `SBOM input is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const errors = [];

  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return {
      valid: false,
      componentCount: 0,
      errors: ["SBOM document must be a JSON object"],
    };
  }

  if (document.bomFormat !== "CycloneDX") {
    errors.push('SBOM bomFormat must be exactly "CycloneDX".');
  }

  if (
    !isNonEmptyString(document.specVersion) &&
    !isNonEmptyString(document.$schema)
  ) {
    errors.push(
      "SBOM document must include a non-empty specVersion or $schema marker.",
    );
  }

  let componentCount = 0;
  if (!Array.isArray(document.components)) {
    errors.push("SBOM components must be an array.");
  } else {
    componentCount = document.components.length;
    if (componentCount === 0) {
      errors.push("SBOM components array must not be empty.");
    }
  }

  return {
    valid: errors.length === 0,
    componentCount,
    errors,
  };
}

async function main() {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT_PATH;
  let text;
  try {
    text = await readFile(inputPath, "utf8");
  } catch (error) {
    process.stderr.write(
      `SBOM validation failed to read ${inputPath}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
    return;
  }

  const result = validateSbomDocument(text);
  if (!result.valid) {
    for (const error of result.errors) {
      process.stderr.write(`SBOM validation error: ${error}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `SBOM validation passed with ${result.componentCount} components.\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(
      `SBOM validation failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
