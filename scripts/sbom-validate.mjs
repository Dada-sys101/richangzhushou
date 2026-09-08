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

export const PRISMA_CANDIDATE_COMPONENTS = Object.freeze({
  "@prisma/adapter-mariadb": "7.9.1",
  "@prisma/client": "7.9.1",
  "@prisma/config": "7.9.1",
  "deepmerge-ts": "8.0.2",
  mariadb: "3.4.7",
  mysql2: "3.24.3",
  prisma: "7.9.1",
});

const PRISMA_CANDIDATE_EDGES = Object.freeze({
  "@prisma/adapter-mariadb@7.9.1": "mariadb@3.4.7",
  "@prisma/config@7.9.1": "deepmerge-ts@8.0.2",
  "prisma@7.9.1": "mysql2@3.24.3",
});

function validatePrismaCandidate(document) {
  const errors = [];
  const components = Array.isArray(document.components)
    ? document.components
    : [];
  for (const [name, expectedVersion] of Object.entries(
    PRISMA_CANDIDATE_COMPONENTS,
  )) {
    const matches = components.filter((component) => component?.name === name);
    if (matches.length !== 1) {
      errors.push(`SBOM must contain exactly one ${name} component.`);
      continue;
    }
    if (matches[0].version !== expectedVersion) {
      errors.push(`SBOM ${name} version must be exactly ${expectedVersion}.`);
    }
  }

  const dependencyByRef = new Map(
    (Array.isArray(document.dependencies) ? document.dependencies : []).map(
      (entry) => [entry?.ref, entry],
    ),
  );
  for (const [parent, child] of Object.entries(PRISMA_CANDIDATE_EDGES)) {
    const dependency = dependencyByRef.get(parent);
    if (
      !dependency ||
      !Array.isArray(dependency.dependsOn) ||
      !dependency.dependsOn.includes(child)
    ) {
      errors.push(`SBOM dependency edge ${parent} -> ${child} is missing.`);
    }
  }
  return errors;
}

export function validateSbomDocument(
  text,
  { enforcePrismaCandidate = false } = {},
) {
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

  if (enforcePrismaCandidate) errors.push(...validatePrismaCandidate(document));

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

  const result = validateSbomDocument(text, { enforcePrismaCandidate: true });
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
