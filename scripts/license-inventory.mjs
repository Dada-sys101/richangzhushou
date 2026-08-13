#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const METADATA_RECORDED = "METADATA_RECORDED";
export const MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED";

const ROOT_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const OUTPUT_PATH = path.join(
  ROOT_DIRECTORY,
  "output",
  "pr6",
  "license-inventory.json",
);

const UNRESOLVED_LICENSE_PATTERN = /^(?:UNKNOWN|UNLICENSED)$/i;
const SEE_LICENSE_PATTERN = /^SEE\s+LICENSE\s+IN(?:\s|$)/i;
const SPDX_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;
const MANUAL_POLICY_REVIEW_IDENTIFIER_PATTERN =
  /^(?:A?GPL|LGPL|MPL|EPL|EUPL|CDDL)(?:-|$)/i;

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeLicenseString(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function derivePackageName(lockPath) {
  if (typeof lockPath !== "string" || !lockPath.startsWith("node_modules/")) {
    throw new Error(`Unexpected package-lock path: ${String(lockPath)}`);
  }
  const parts = lockPath.split("/");
  const finalNodeModules = parts.lastIndexOf("node_modules");
  return parts.slice(finalNodeModules + 1).join("/");
}

function tokenizeSpdxExpression(value) {
  const tokens = [];
  const prepared = value.replace(/([()])/g, " $1 ").trim();
  if (!prepared) return { tokens: null, reason: "empty expression" };

  for (const rawToken of prepared.split(/\s+/)) {
    const upper = rawToken.toUpperCase();
    if (rawToken === "(") {
      tokens.push({ type: "open", value: rawToken });
    } else if (rawToken === ")") {
      tokens.push({ type: "close", value: rawToken });
    } else if (upper === "AND" || upper === "OR" || upper === "WITH") {
      tokens.push({ type: "operator", value: upper });
    } else if (SPDX_IDENTIFIER_PATTERN.test(rawToken)) {
      tokens.push({ type: "identifier", value: rawToken });
    } else {
      return { tokens: null, reason: `invalid token "${rawToken}"` };
    }
  }

  return { tokens, reason: null };
}

export function validateSpdxExpressionSyntax(value) {
  const normalized = normalizeLicenseString(value);
  if (!normalized) {
    return { valid: false, reason: "empty expression" };
  }

  const { tokens, reason } = tokenizeSpdxExpression(normalized);
  if (!tokens) {
    return { valid: false, reason };
  }
  if (tokens.length === 0) {
    return { valid: false, reason: "empty expression" };
  }

  let depth = 0;
  let previous = null;

  for (const token of tokens) {
    switch (token.type) {
      case "open":
        if (
          previous &&
          (previous.type === "identifier" ||
            previous.type === "close" ||
            (previous.type === "operator" && previous.value === "WITH"))
        ) {
          return {
            valid: false,
            reason: "unexpected opening parenthesis",
          };
        }
        depth += 1;
        previous = token;
        break;
      case "close":
        if (depth === 0) {
          return {
            valid: false,
            reason: "unbalanced closing parenthesis",
          };
        }
        if (
          !previous ||
          (previous.type !== "identifier" && previous.type !== "close")
        ) {
          return {
            valid: false,
            reason:
              "closing parenthesis must follow a license identifier or closing parenthesis",
          };
        }
        depth -= 1;
        previous = token;
        break;
      case "operator":
        if (token.value === "WITH") {
          if (!previous || previous.type !== "identifier") {
            return {
              valid: false,
              reason: "WITH must follow a license identifier",
            };
          }
        } else if (
          !previous ||
          (previous.type !== "identifier" && previous.type !== "close")
        ) {
          return {
            valid: false,
            reason: `${token.value} must follow a license identifier or closing parenthesis`,
          };
        }
        previous = token;
        break;
      case "identifier":
        if (
          previous &&
          (previous.type === "identifier" || previous.type === "close")
        ) {
          return {
            valid: false,
            reason: "consecutive license identifiers are not allowed",
          };
        }
        previous = token;
        break;
      default:
        return { valid: false, reason: "unknown expression token" };
    }
  }

  if (depth !== 0) {
    return { valid: false, reason: "unbalanced opening parenthesis" };
  }
  if (
    !previous ||
    (previous.type !== "identifier" && previous.type !== "close")
  ) {
    return {
      valid: false,
      reason:
        "expression must end with a license identifier or closing parenthesis",
    };
  }

  return { valid: true, reason: null };
}

function manualPolicyReviewReasons(license) {
  const { tokens } = tokenizeSpdxExpression(license);
  if (!tokens) return [];

  const reasons = [];
  if (
    tokens.some(
      (token) =>
        token.type === "operator" &&
        (token.value === "AND" ||
          token.value === "OR" ||
          token.value === "WITH"),
    )
  ) {
    reasons.push("compound license expression requires human policy review");
  }
  if (
    tokens.some(
      (token) =>
        token.type === "identifier" &&
        MANUAL_POLICY_REVIEW_IDENTIFIER_PATTERN.test(token.value),
    )
  ) {
    reasons.push(
      "copyleft-family license metadata requires human policy review",
    );
  }
  return reasons;
}

export function classifyLicense(rawLicense) {
  if (rawLicense === undefined || rawLicense === null) {
    return {
      license: null,
      reviewStatus: MANUAL_REVIEW_REQUIRED,
      reviewReasons: ["missing license metadata"],
    };
  }

  if (typeof rawLicense !== "string") {
    return {
      license: null,
      reviewStatus: MANUAL_REVIEW_REQUIRED,
      reviewReasons: ["license metadata is not a string"],
    };
  }

  const license = normalizeLicenseString(rawLicense);
  if (!license) {
    return {
      license: null,
      reviewStatus: MANUAL_REVIEW_REQUIRED,
      reviewReasons: ["empty license metadata"],
    };
  }

  if (
    UNRESOLVED_LICENSE_PATTERN.test(license) ||
    SEE_LICENSE_PATTERN.test(license)
  ) {
    return {
      license,
      reviewStatus: MANUAL_REVIEW_REQUIRED,
      reviewReasons: ["unresolved license expression"],
    };
  }

  const syntax = validateSpdxExpressionSyntax(license);
  if (!syntax.valid) {
    return {
      license,
      reviewStatus: MANUAL_REVIEW_REQUIRED,
      reviewReasons: [
        `syntactically ambiguous license expression: ${syntax.reason}`,
      ],
    };
  }

  const reviewReasons = manualPolicyReviewReasons(license);
  if (reviewReasons.length > 0) {
    return {
      license,
      reviewStatus: MANUAL_REVIEW_REQUIRED,
      reviewReasons,
    };
  }

  return {
    license,
    reviewStatus: METADATA_RECORDED,
    reviewReasons: [],
  };
}

export function isMissingOrUnresolvedLicense(entry) {
  if (entry.license === null) return true;
  return (
    UNRESOLVED_LICENSE_PATTERN.test(entry.license) ||
    SEE_LICENSE_PATTERN.test(entry.license)
  );
}

export function buildSummary(entries) {
  const uniqueLicenseExpressions = new Set(
    entries
      .filter((entry) => entry.license !== null)
      .map((entry) => entry.license),
  );

  return {
    packageCount: entries.length,
    uniqueLicenseExpressionCount: uniqueLicenseExpressions.size,
    missingOrUnresolvedCount: entries.filter(isMissingOrUnresolvedLicense)
      .length,
    manualReviewCount: entries.filter(
      (entry) => entry.reviewStatus === MANUAL_REVIEW_REQUIRED,
    ).length,
  };
}

export function buildInventory(packagesMap) {
  if (!packagesMap || typeof packagesMap !== "object") {
    throw new Error("package-lock.json packages map must be an object.");
  }

  const entries = [];
  for (const [lockPath, packageEntry] of Object.entries(packagesMap)) {
    if (!lockPath.startsWith("node_modules/")) continue;

    const classified = classifyLicense(packageEntry.license);
    entries.push({
      package: derivePackageName(lockPath),
      version:
        typeof packageEntry.version === "string" ? packageEntry.version : null,
      license: classified.license,
      reviewStatus: classified.reviewStatus,
      reviewReasons: classified.reviewReasons,
    });
  }

  entries.sort(
    (left, right) =>
      compareStrings(left.package, right.package) ||
      compareStrings(left.version ?? "", right.version ?? "") ||
      compareStrings(left.license ?? "", right.license ?? "") ||
      compareStrings(left.reviewStatus, right.reviewStatus),
  );

  return {
    schemaVersion: 1,
    source: "package-lock.json",
    summary: buildSummary(entries),
    packages: entries,
  };
}

export function serializeInventory(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

async function readPackagesMap() {
  const lockText = await readFile(
    path.join(ROOT_DIRECTORY, "package-lock.json"),
    "utf8",
  );
  const lock = JSON.parse(lockText);
  if (
    !lock ||
    typeof lock !== "object" ||
    !lock.packages ||
    typeof lock.packages !== "object"
  ) {
    throw new Error("package-lock.json does not contain a packages map.");
  }
  return lock.packages;
}

async function main() {
  const packagesMap = await readPackagesMap();
  const inventory = buildInventory(packagesMap);
  const report = serializeInventory(inventory);

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, report, { encoding: "utf8", flag: "w" });

  const summary = inventory.summary;
  process.stdout.write(
    `License inventory: ${summary.packageCount} packages, ${summary.uniqueLicenseExpressionCount} unique license expressions, ${summary.missingOrUnresolvedCount} missing/unresolved, ${summary.manualReviewCount} manual review required.\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(
      `License inventory failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
