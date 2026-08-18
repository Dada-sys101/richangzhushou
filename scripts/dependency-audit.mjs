#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const EXCEPTIONS_PATH = path.join(
  ROOT_DIRECTORY,
  "scripts",
  "dependency-audit-exceptions.json",
);
const PACKAGE_LOCK_PATH = path.join(ROOT_DIRECTORY, "package-lock.json");

export const AUDIT_ARGUMENTS = ["audit", "--json"];
export const AUDIT_TIMEOUT_MS = 30_000;
export const MAX_AUDIT_STDOUT_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIT_STDERR_BYTES = 256 * 1024;

export const EXPECTED_EXCEPTION = Object.freeze({
  package: "deepmerge-ts",
  advisory: "GHSA-ggr8-5vv4-36mx",
  currentVersion: "7.1.5",
  chain: "prisma@7.9.1 -> @prisma/config@7.9.1 -> deepmerge-ts@7.1.5",
  expiresAt: "2026-09-01T23:59:00+08:00",
  ownerRole: "PR18 owner / release-security owner",
  reviewDate: "2026-08-25",
  reason:
    "Prisma 7.9.1 upstream transitive dependency; installed but not API runtime reachable; no stable supported Prisma 7.x fix available at approval time.",
});

const EXCEPTION_CONFIG_KEYS = ["schemaVersion", "exceptions"];
const EXCEPTION_KEYS = [
  "package",
  "advisory",
  "currentVersion",
  "chain",
  "expiresAt",
  "ownerRole",
  "reviewDate",
  "reason",
];
const AUDIT_SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const HIGH_OR_CRITICAL = new Set(["high", "critical"]);
const METADATA_VULNERABILITY_KEYS = [
  "info",
  "low",
  "moderate",
  "high",
  "critical",
  "total",
];
const METADATA_DEPENDENCY_KEYS = [
  "prod",
  "dev",
  "optional",
  "peer",
  "peerOptional",
  "total",
];
const CHAIN = Object.freeze([
  Object.freeze({
    name: "prisma",
    version: "7.9.1",
    lockPath: "node_modules/prisma",
    nextName: "@prisma/config",
    nextRequestedVersion: "7.9.1",
  }),
  Object.freeze({
    name: "@prisma/config",
    version: "7.9.1",
    lockPath: "node_modules/@prisma/config",
    nextName: "deepmerge-ts",
    nextRequestedVersion: "7.1.5",
  }),
  Object.freeze({
    name: "deepmerge-ts",
    version: "7.1.5",
    lockPath: "node_modules/deepmerge-ts",
    nextName: null,
    nextRequestedVersion: null,
  }),
]);
const CHAIN_BY_NAME = new Map(CHAIN.map((entry) => [entry.name, entry]));

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseAdvisoryId(url) {
  if (typeof url !== "string") return null;
  const match =
    /\/(GHSA-[A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+)(?:[/?#]|$)/i.exec(url);
  return match ? match[1].toUpperCase() : null;
}

function packageNameFromLockPath(lockPath) {
  if (typeof lockPath !== "string" || !lockPath.startsWith("node_modules/")) {
    return null;
  }

  const nestedMarker = "/node_modules/";
  const finalNestedMarker = lockPath.lastIndexOf(nestedMarker);
  if (finalNestedMarker >= 0) {
    return lockPath.slice(finalNestedMarker + nestedMarker.length);
  }
  return lockPath.slice("node_modules/".length);
}

export function validateExceptionConfig(config) {
  const errors = [];

  if (!isPlainObject(config)) {
    errors.push("exceptions config must be a JSON object");
    return { valid: false, exception: null, errors };
  }

  if (!hasExactKeys(config, EXCEPTION_CONFIG_KEYS)) {
    errors.push("exceptions config has unexpected or missing root fields");
  }
  if (config.schemaVersion !== 1) {
    errors.push("exceptions config schemaVersion must be exactly 1");
  }
  if (!Array.isArray(config.exceptions)) {
    errors.push("exceptions config exceptions must be an array");
    return { valid: false, exception: null, errors };
  }
  if (config.exceptions.length !== 1) {
    errors.push("exceptions config must contain exactly one exception");
    return { valid: false, exception: null, errors };
  }

  const exception = config.exceptions[0];
  if (!isPlainObject(exception)) {
    errors.push("exception entry must be a JSON object");
    return { valid: false, exception: null, errors };
  }
  if (!hasExactKeys(exception, EXCEPTION_KEYS)) {
    errors.push("exception entry has unexpected or missing fields");
  }

  for (const key of EXCEPTION_KEYS) {
    if (!isNonEmptyString(exception[key])) {
      errors.push(`exception field ${key} must be a non-empty string`);
    }
  }

  for (const key of EXCEPTION_KEYS) {
    if (exception[key] !== EXPECTED_EXCEPTION[key]) {
      errors.push(`exception field ${key} does not match the approved value`);
    }
  }

  const expiresAt = Date.parse(exception.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    errors.push("exception expiresAt must be a valid timestamp");
  }

  return {
    valid: errors.length === 0,
    exception: errors.length === 0 ? exception : null,
    errors,
  };
}

export function parseExceptionConfig(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return {
      valid: false,
      exception: null,
      errors: ["exceptions config must be a non-empty JSON string"],
    };
  }

  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    return {
      valid: false,
      exception: null,
      errors: [`exceptions config is not valid JSON: ${errorText(error)}`],
    };
  }

  return validateExceptionConfig(config);
}

export function validateDependencyChain(packageLock) {
  const errors = [];

  if (!isPlainObject(packageLock)) {
    return {
      valid: false,
      errors: ["package-lock.json must be a JSON object"],
    };
  }
  if (packageLock.lockfileVersion !== 3) {
    errors.push("package-lock.json lockfileVersion must be exactly 3");
  }
  if (!isPlainObject(packageLock.packages)) {
    errors.push("package-lock.json packages must be an object");
    return { valid: false, errors };
  }

  for (const chainEntry of CHAIN) {
    const lockEntry = packageLock.packages[chainEntry.lockPath];
    if (!isPlainObject(lockEntry)) {
      errors.push(`missing lock entry ${chainEntry.lockPath}`);
      continue;
    }
    if (lockEntry.version !== chainEntry.version) {
      errors.push(
        `${chainEntry.name} lock version must be ${chainEntry.version}`,
      );
    }

    const matchingPaths = Object.keys(packageLock.packages).filter(
      (lockPath) => packageNameFromLockPath(lockPath) === chainEntry.name,
    );
    if (
      matchingPaths.length !== 1 ||
      matchingPaths[0] !== chainEntry.lockPath
    ) {
      errors.push(
        `${chainEntry.name} must have exactly one package-lock path at ${chainEntry.lockPath}`,
      );
    }

    if (chainEntry.nextName) {
      if (!isPlainObject(lockEntry.dependencies)) {
        errors.push(`${chainEntry.name} lock entry has no dependencies object`);
      } else if (
        lockEntry.dependencies[chainEntry.nextName] !==
        chainEntry.nextRequestedVersion
      ) {
        errors.push(
          `${chainEntry.name} must depend on ${chainEntry.nextName}@${chainEntry.nextRequestedVersion}`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateAdvisoryObject(advisory, context) {
  const errors = [];
  const requiredStringFields = [
    "name",
    "dependency",
    "title",
    "url",
    "severity",
    "range",
  ];

  if (!isPlainObject(advisory)) {
    return [`${context} must be an object`];
  }
  if (!Number.isInteger(advisory.source) || advisory.source <= 0) {
    errors.push(`${context}.source must be a positive integer`);
  }
  for (const field of requiredStringFields) {
    if (!isNonEmptyString(advisory[field])) {
      errors.push(`${context}.${field} must be a non-empty string`);
    }
  }
  if (!AUDIT_SEVERITIES.includes(advisory.severity)) {
    errors.push(`${context}.severity is not a supported audit severity`);
  }
  if (parseAdvisoryId(advisory.url) === null) {
    errors.push(`${context}.url must contain a GHSA advisory ID`);
  }
  if (advisory.cwe !== undefined && !Array.isArray(advisory.cwe)) {
    errors.push(`${context}.cwe must be an array when present`);
  }
  if (advisory.cvss !== undefined && !isPlainObject(advisory.cvss)) {
    errors.push(`${context}.cvss must be an object when present`);
  }
  return errors;
}

function validateVulnerabilityEntry(name, entry, knownNames) {
  const errors = [];
  const context = `vulnerability ${name}`;

  if (!isPlainObject(entry)) {
    return [`${context} must be an object`];
  }
  if (entry.name !== name) {
    errors.push(`${context}.name must match its vulnerability key`);
  }
  if (!AUDIT_SEVERITIES.includes(entry.severity)) {
    errors.push(`${context}.severity is not a supported audit severity`);
  }
  if (typeof entry.isDirect !== "boolean") {
    errors.push(`${context}.isDirect must be boolean`);
  }
  if (!Array.isArray(entry.via)) {
    errors.push(`${context}.via must be an array`);
  }
  if (!Array.isArray(entry.effects)) {
    errors.push(`${context}.effects must be an array`);
  } else if (entry.effects.some((effect) => !isNonEmptyString(effect))) {
    errors.push(`${context}.effects must contain only non-empty strings`);
  }
  if (!isNonEmptyString(entry.range)) {
    errors.push(`${context}.range must be a non-empty string`);
  }
  if (!Array.isArray(entry.nodes) || entry.nodes.length === 0) {
    errors.push(`${context}.nodes must be a non-empty array`);
  } else if (
    entry.nodes.some(
      (node) => !isNonEmptyString(node) || !node.startsWith("node_modules/"),
    )
  ) {
    errors.push(`${context}.nodes must contain package-lock paths`);
  }

  if (Array.isArray(entry.via)) {
    for (const [index, via] of entry.via.entries()) {
      const viaContext = `${context}.via[${String(index)}]`;
      if (typeof via === "string") {
        if (!isNonEmptyString(via)) {
          errors.push(`${viaContext} must be a non-empty string`);
        } else if (!knownNames.has(via)) {
          errors.push(`${viaContext} references an unknown vulnerability`);
        }
      } else {
        errors.push(...validateAdvisoryObject(via, viaContext));
      }
    }
  }

  return errors;
}

export function validateAuditReport(report) {
  const errors = [];

  if (!isPlainObject(report)) {
    return {
      valid: false,
      errors: ["npm audit report must be a JSON object"],
    };
  }
  if (report.auditReportVersion !== 2) {
    errors.push("npm audit report auditReportVersion must be exactly 2");
  }
  if (!isPlainObject(report.vulnerabilities)) {
    errors.push("npm audit report vulnerabilities must be an object");
  }
  if (!isPlainObject(report.metadata)) {
    errors.push("npm audit report metadata must be an object");
  }

  const metadataVulnerabilities = report.metadata?.vulnerabilities;
  if (!isPlainObject(metadataVulnerabilities)) {
    errors.push("npm audit metadata.vulnerabilities must be an object");
  } else {
    for (const key of METADATA_VULNERABILITY_KEYS) {
      if (!isNonNegativeInteger(metadataVulnerabilities[key])) {
        errors.push(
          `npm audit metadata.vulnerabilities.${key} must be a non-negative integer`,
        );
      }
    }
    if (
      METADATA_VULNERABILITY_KEYS.every((key) =>
        isNonNegativeInteger(metadataVulnerabilities[key]),
      ) &&
      metadataVulnerabilities.total !==
        metadataVulnerabilities.info +
          metadataVulnerabilities.low +
          metadataVulnerabilities.moderate +
          metadataVulnerabilities.high +
          metadataVulnerabilities.critical
    ) {
      errors.push(
        "npm audit metadata.vulnerabilities.total must equal its severity counts",
      );
    }
  }

  const metadataDependencies = report.metadata?.dependencies;
  if (!isPlainObject(metadataDependencies)) {
    errors.push("npm audit metadata.dependencies must be an object");
  } else {
    for (const key of METADATA_DEPENDENCY_KEYS) {
      if (!isNonNegativeInteger(metadataDependencies[key])) {
        errors.push(
          `npm audit metadata.dependencies.${key} must be a non-negative integer`,
        );
      }
    }
  }

  if (!isPlainObject(report.vulnerabilities)) {
    return { valid: false, errors };
  }

  const knownNames = new Set(Object.keys(report.vulnerabilities));
  const computedCounts = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
  };
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    errors.push(...validateVulnerabilityEntry(name, entry, knownNames));
    if (isPlainObject(entry) && AUDIT_SEVERITIES.includes(entry.severity)) {
      computedCounts[entry.severity] += 1;
    }
  }

  if (isPlainObject(metadataVulnerabilities)) {
    for (const severity of AUDIT_SEVERITIES) {
      if (
        isNonNegativeInteger(metadataVulnerabilities[severity]) &&
        metadataVulnerabilities[severity] !== computedCounts[severity]
      ) {
        errors.push(
          `npm audit metadata count for ${severity} does not match vulnerabilities`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function parseAuditReport(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return {
      valid: false,
      report: null,
      errors: ["npm audit output must be a non-empty JSON string"],
    };
  }

  let report;
  try {
    report = JSON.parse(text);
  } catch (error) {
    return {
      valid: false,
      report: null,
      errors: [`npm audit output is not valid JSON: ${errorText(error)}`],
    };
  }

  const validation = validateAuditReport(report);
  return { ...validation, report: validation.valid ? report : null };
}

function collectAdvisories(name, vulnerabilities, stack = []) {
  if (stack.includes(name)) {
    throw new Error(`cyclic npm audit via chain at ${name}`);
  }
  const entry = vulnerabilities[name];
  if (!isPlainObject(entry) || !Array.isArray(entry.via)) {
    throw new Error(`cannot resolve npm audit via chain for ${name}`);
  }

  const nextStack = [...stack, name];
  const advisories = [];
  for (const via of entry.via) {
    if (typeof via === "string") {
      advisories.push(...collectAdvisories(via, vulnerabilities, nextStack));
    } else {
      advisories.push(via);
    }
  }
  return advisories;
}

function collectSeverities(name, vulnerabilities, stack = []) {
  if (stack.includes(name)) {
    throw new Error(`cyclic npm audit via chain at ${name}`);
  }
  const entry = vulnerabilities[name];
  if (!isPlainObject(entry) || !Array.isArray(entry.via)) {
    throw new Error(`cannot resolve npm audit via chain for ${name}`);
  }

  const nextStack = [...stack, name];
  const severities = [entry.severity];
  for (const via of entry.via) {
    if (typeof via === "string") {
      severities.push(...collectSeverities(via, vulnerabilities, nextStack));
    } else {
      severities.push(via.severity);
    }
  }
  return severities;
}

function collectHighOrCriticalEntries(report) {
  const errors = [];
  const entries = [];
  const seenNames = new Set();

  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    let severities;
    try {
      severities = collectSeverities(name, report.vulnerabilities);
    } catch (error) {
      errors.push(`${name} audit via chain is invalid: ${errorText(error)}`);
      continue;
    }

    if (
      severities.some((severity) => HIGH_OR_CRITICAL.has(severity)) &&
      !seenNames.has(name)
    ) {
      seenNames.add(name);
      entries.push({ name, entry, severities });
    }
  }

  return { entries, errors };
}

function validateExceptionExpiry(exception, now) {
  const errors = [];
  const expiresAt = Date.parse(exception.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    return ["exception expiresAt is not a valid timestamp"];
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    return ["audit evaluation time is invalid"];
  }
  if (nowDate.getTime() >= expiresAt) {
    errors.push(`temporary exception expired at ${exception.expiresAt}`);
  }
  return errors;
}

function validateApprovedAuditChain({
  report,
  packageLock,
  exception,
  now,
  highOrCriticalEntries,
}) {
  const errors = [];
  const chainResult = validateDependencyChain(packageLock);
  errors.push(...chainResult.errors);
  errors.push(...validateExceptionExpiry(exception, now));

  if (highOrCriticalEntries.length === 0) {
    return { valid: errors.length === 0, errors };
  }

  const highNames = new Set(highOrCriticalEntries.map(({ name }) => name));
  for (const chainEntry of CHAIN) {
    if (!highNames.has(chainEntry.name)) {
      errors.push(
        `approved dependency chain entry ${chainEntry.name} must have a high/critical severity`,
      );
    }
  }
  for (const { name, entry, severities } of highOrCriticalEntries) {
    const chainEntry = CHAIN_BY_NAME.get(name);
    if (!chainEntry) {
      errors.push(`unapproved high/critical package ${name}`);
      continue;
    }
    if (HIGH_OR_CRITICAL.has(entry.severity) && entry.severity !== "high") {
      errors.push(
        `${name} is ${entry.severity}; the approved exception is limited to high severity`,
      );
    }
    if (!severities.some((severity) => HIGH_OR_CRITICAL.has(severity))) {
      errors.push(`${name} has no resolvable high/critical severity`);
    }
    if (entry.nodes.length !== 1 || entry.nodes[0] !== chainEntry.lockPath) {
      errors.push(
        `${name} high/critical nodes must be exactly ${chainEntry.lockPath}`,
      );
    }

    if (chainEntry.nextName) {
      if (entry.via.length !== 1 || entry.via[0] !== chainEntry.nextName) {
        errors.push(`${name} audit via must be exactly ${chainEntry.nextName}`);
      }
    } else if (entry.via.length !== 1 || !isPlainObject(entry.via[0])) {
      errors.push(
        "deepmerge-ts audit via must contain exactly one advisory object",
      );
    }

    try {
      const advisories = collectAdvisories(name, report.vulnerabilities);
      if (advisories.length === 0) {
        errors.push(`${name} has no resolvable advisory`);
      }
      for (const advisory of advisories) {
        const advisoryId = parseAdvisoryId(advisory.url);
        if (advisoryId !== EXPECTED_EXCEPTION.advisory.toUpperCase()) {
          errors.push(
            `${name} resolves to an advisory other than ${EXPECTED_EXCEPTION.advisory}`,
          );
        }
        if (advisory.name !== EXPECTED_EXCEPTION.package) {
          errors.push(
            `approved advisory package must be ${EXPECTED_EXCEPTION.package}`,
          );
        }
        if (advisory.dependency !== EXPECTED_EXCEPTION.package) {
          errors.push(
            `approved advisory dependency must be ${EXPECTED_EXCEPTION.package}`,
          );
        }
        if (advisory.severity !== "high") {
          errors.push("approved advisory severity must remain high");
        }
      }
    } catch (error) {
      errors.push(`${name} audit via chain is invalid: ${errorText(error)}`);
    }
  }

  const leafEntry = report.vulnerabilities[EXPECTED_EXCEPTION.package];
  if (!highNames.has(EXPECTED_EXCEPTION.package)) {
    errors.push("deepmerge-ts must remain a high/critical audit entry");
  }
  if (!isPlainObject(leafEntry)) {
    errors.push("approved deepmerge-ts vulnerability entry is missing");
  }

  return { valid: errors.length === 0, errors };
}

export function evaluateAuditReport({
  auditReport,
  exceptionConfig,
  packageLock,
  now = new Date(),
}) {
  const auditValidation = validateAuditReport(auditReport);
  const exceptionValidation = validateExceptionConfig(exceptionConfig);
  const initialErrors = [
    ...auditValidation.errors,
    ...exceptionValidation.errors,
  ];
  if (initialErrors.length > 0) {
    return {
      passed: false,
      appliedException: false,
      errors: initialErrors,
    };
  }

  const securityEntries = collectHighOrCriticalEntries(auditReport);
  if (securityEntries.errors.length > 0) {
    return {
      passed: false,
      appliedException: false,
      errors: securityEntries.errors,
    };
  }
  if (securityEntries.entries.length === 0) {
    return {
      passed: true,
      appliedException: false,
      errors: [],
    };
  }

  const approval = validateApprovedAuditChain({
    report: auditReport,
    packageLock,
    exception: exceptionValidation.exception,
    now,
    highOrCriticalEntries: securityEntries.entries,
  });
  if (!approval.valid) {
    return {
      passed: false,
      appliedException: false,
      errors: approval.errors,
    };
  }

  return {
    passed: true,
    appliedException: true,
    errors: [],
    exception: exceptionValidation.exception,
  };
}

export function evaluateAuditExecution({
  stdout,
  code,
  commandError = null,
  exceptionConfig,
  packageLock,
  now = new Date(),
}) {
  if (commandError) {
    return {
      passed: false,
      appliedException: false,
      errors: [
        `npm audit command failed to execute: ${errorText(commandError)}`,
      ],
    };
  }
  if (!Number.isInteger(code) || code < 0) {
    return {
      passed: false,
      appliedException: false,
      errors: ["npm audit command ended abnormally"],
    };
  }

  const parsed = parseAuditReport(stdout);
  if (!parsed.valid) {
    return {
      passed: false,
      appliedException: false,
      errors: parsed.errors,
    };
  }

  return evaluateAuditReport({
    auditReport: parsed.report,
    exceptionConfig,
    packageLock,
    now,
  });
}

function isSafeNpmCliPath(candidatePath) {
  if (!isNonEmptyString(candidatePath)) return false;
  const normalizedPath = path.normalize(candidatePath);
  return (
    path.basename(normalizedPath).toLowerCase() === "npm-cli.js" &&
    path.basename(path.dirname(normalizedPath)).toLowerCase() === "bin" &&
    path.basename(path.dirname(path.dirname(normalizedPath))).toLowerCase() ===
      "npm"
  );
}

function existingNpmCliPath(candidatePath) {
  if (!isSafeNpmCliPath(candidatePath)) return null;
  try {
    if (!existsSync(candidatePath) || !statSync(candidatePath).isFile()) {
      return null;
    }
    return path.resolve(candidatePath);
  } catch {
    return null;
  }
}

function npmCliCandidates(execPath) {
  const nodeDirectory = path.dirname(execPath);
  return [
    path.join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(
      nodeDirectory,
      "..",
      "lib",
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js",
    ),
  ];
}

export function resolveNpmInvocation({
  env = process.env,
  execPath = process.execPath,
  cwd = ROOT_DIRECTORY,
} = {}) {
  const configuredNpmCli = env?.npm_execpath;
  if (isNonEmptyString(configuredNpmCli)) {
    const npmCli = path.isAbsolute(configuredNpmCli)
      ? configuredNpmCli
      : path.resolve(cwd, configuredNpmCli);
    if (!isSafeNpmCliPath(npmCli)) {
      return {
        error: new Error(
          "npm_execpath does not resolve to a safe npm CLI JavaScript path",
        ),
      };
    }
    return { command: execPath, args: [npmCli, ...AUDIT_ARGUMENTS] };
  }

  const npmCli = npmCliCandidates(execPath)
    .map(existingNpmCliPath)
    .find((candidate) => candidate !== null);
  if (npmCli === undefined) {
    return {
      error: new Error(
        "could not safely resolve the npm CLI JavaScript path from the current Node installation",
      ),
    };
  }
  return { command: execPath, args: [npmCli, ...AUDIT_ARGUMENTS] };
}

function chunkByteLength(chunk) {
  if (typeof chunk === "string") return Buffer.byteLength(chunk, "utf8");
  if (Buffer.isBuffer(chunk)) return chunk.byteLength;
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  return Buffer.byteLength(String(chunk), "utf8");
}

function chunkToString(chunk) {
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString("utf8");
  }
  return String(chunk);
}

function isValidOutputLimit(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function runNpmAudit({
  cwd = ROOT_DIRECTORY,
  spawnImpl = spawn,
  env = process.env,
  execPath = process.execPath,
  timeoutMs = AUDIT_TIMEOUT_MS,
  maxStdoutBytes = MAX_AUDIT_STDOUT_BYTES,
  maxStderrBytes = MAX_AUDIT_STDERR_BYTES,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
} = {}) {
  let invocation;
  try {
    invocation = resolveNpmInvocation({ env, execPath, cwd });
  } catch (error) {
    return Promise.resolve({
      stdout: "",
      stderr: "",
      code: null,
      commandError: error,
    });
  }
  if (invocation.error) {
    return Promise.resolve({
      stdout: "",
      stderr: "",
      code: null,
      commandError: invocation.error,
    });
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    return Promise.resolve({
      stdout: "",
      stderr: "",
      code: null,
      commandError: new Error(
        "npm audit timeout must be a non-negative number",
      ),
    });
  }
  if (
    !isValidOutputLimit(maxStdoutBytes) ||
    !isValidOutputLimit(maxStderrBytes)
  ) {
    return Promise.resolve({
      stdout: "",
      stderr: "",
      code: null,
      commandError: new Error(
        "npm audit output limits must be positive safe integers",
      ),
    });
  }

  return new Promise((resolve) => {
    let child;
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timeoutHandle = null;

    const clearAuditTimeout = () => {
      if (timeoutHandle !== null) {
        clearTimeoutImpl(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const terminateChild = () => {
      try {
        if (child && typeof child.kill === "function") {
          child.kill("SIGTERM");
        }
      } catch {
        // The original fail-closed error is more actionable than a kill error.
      }
    };

    const finish = (result, { terminate = false } = {}) => {
      if (settled) return;
      settled = true;
      clearAuditTimeout();
      if (terminate) terminateChild();
      resolve(result);
    };

    const fail = (message, details = {}) => {
      finish(
        {
          stdout,
          stderr,
          code: null,
          commandError: new Error(message),
          ...details,
        },
        { terminate: true },
      );
    };

    try {
      child = spawnImpl(invocation.command, invocation.args, {
        cwd,
        env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      finish({ stdout, stderr, code: null, commandError: error });
      return;
    }

    if (
      !child ||
      !child.stdout ||
      !child.stderr ||
      typeof child.stdout.on !== "function" ||
      typeof child.stderr.on !== "function" ||
      typeof child.once !== "function"
    ) {
      fail("npm audit child process did not provide the required streams");
      return;
    }

    try {
      child.stdout.setEncoding?.("utf8");
      child.stderr.setEncoding?.("utf8");
      child.stdout.on("data", (chunk) => {
        if (settled) return;
        const chunkSize = chunkByteLength(chunk);
        if (stdoutBytes + chunkSize > maxStdoutBytes) {
          fail(
            `npm audit stdout exceeded the ${String(maxStdoutBytes)} byte limit`,
            { outputLimitExceeded: "stdout" },
          );
          return;
        }
        stdoutBytes += chunkSize;
        stdout += chunkToString(chunk);
      });
      child.stderr.on("data", (chunk) => {
        if (settled) return;
        const chunkSize = chunkByteLength(chunk);
        if (stderrBytes + chunkSize > maxStderrBytes) {
          fail(
            `npm audit stderr exceeded the ${String(maxStderrBytes)} byte limit`,
            { outputLimitExceeded: "stderr" },
          );
          return;
        }
        stderrBytes += chunkSize;
        stderr += chunkToString(chunk);
      });
      child.once("error", (error) => {
        finish({ stdout, stderr, code: null, commandError: error });
      });
      child.once("close", (code, signal) => {
        if (code === null) {
          finish({
            stdout,
            stderr,
            code: null,
            commandError: new Error(
              signal
                ? `npm audit terminated by signal ${signal}`
                : "npm audit terminated by signal",
            ),
          });
          return;
        }
        finish({ stdout, stderr, code, commandError: null });
      });
      timeoutHandle = setTimeoutImpl(() => {
        fail("npm audit timed out", { timedOut: true });
      }, timeoutMs);
    } catch (error) {
      fail(`npm audit process monitoring failed: ${errorText(error)}`);
    }
  });
}

async function readJsonFile(filePath, label) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`${label} could not be read: ${errorText(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${errorText(error)}`);
  }
}

function printExceptionLog(exception) {
  process.stdout.write(
    [
      "TEMPORARY SECURITY EXCEPTION applied",
      `GHSA: ${exception.advisory}`,
      `package/version: ${exception.package}@${exception.currentVersion}`,
      `chain: ${exception.chain}`,
      `reason: ${exception.reason}`,
      `ownerRole: ${exception.ownerRole}`,
      `reviewDate: ${exception.reviewDate}`,
      `expiresAt: ${exception.expiresAt}`,
    ].join("\n") + "\n",
  );
}

async function main() {
  let exceptionConfig = null;
  let packageLock = null;
  const inputErrors = [];

  try {
    const text = await readFile(EXCEPTIONS_PATH, "utf8");
    const parsed = parseExceptionConfig(text);
    exceptionConfig = parsed.valid ? JSON.parse(text) : null;
    if (!parsed.valid) inputErrors.push(...parsed.errors);
  } catch (error) {
    inputErrors.push(errorText(error));
  }

  try {
    packageLock = await readJsonFile(PACKAGE_LOCK_PATH, "package-lock.json");
  } catch (error) {
    inputErrors.push(errorText(error));
  }

  const execution = await runNpmAudit();
  const result = evaluateAuditExecution({
    stdout: execution.stdout,
    code: execution.code,
    commandError: execution.commandError,
    exceptionConfig,
    packageLock,
  });
  result.errors.unshift(...inputErrors);
  if (inputErrors.length > 0) {
    result.passed = false;
    result.appliedException = false;
  }

  if (!result.passed) {
    process.stderr.write("Dependency audit failed closed.\n");
    for (const error of result.errors) {
      process.stderr.write(`Dependency audit error: ${error}\n`);
    }
    process.exitCode = 1;
    return;
  }

  if (execution.code !== 0) {
    process.stdout.write(
      `npm audit exited with code ${String(execution.code)}; structured JSON was evaluated.\n`,
    );
  }
  if (result.appliedException) {
    printExceptionLog(result.exception);
  } else {
    process.stdout.write(
      "Dependency audit passed: no high/critical vulnerabilities.\n",
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(
      `Dependency audit failed closed: ${errorText(error)}\n`,
    );
    process.exitCode = 1;
  });
}
