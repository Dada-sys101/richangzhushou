import { createHash } from "node:crypto";

export const LICENSE_POLICY = Object.freeze({
  allow: Object.freeze([
    "0BSD",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "CC0-1.0",
    "ISC",
    "MIT",
    "Unlicense",
  ]),
  review: Object.freeze([
    "EPL-1.0",
    "EPL-2.0",
    "LGPL-2.0-only",
    "LGPL-2.0-or-later",
    "LGPL-2.1-only",
    "LGPL-2.1-or-later",
    "LGPL-3.0-only",
    "LGPL-3.0-or-later",
    "MPL-2.0",
  ]),
  denyPatterns: Object.freeze([
    /^AGPL-/u,
    /^BUSL-/u,
    /^Commons-Clause/iu,
    /^Elastic-2\.0$/u,
    /^GPL-/u,
    /(?:^|-)NC(?:-|$)/u,
    /^SSPL-/u,
  ]),
});

export const GOVERNANCE_STATES = Object.freeze({
  pass: "PASS",
  review: "REVIEW",
  block: "BLOCK",
  exception: "EXCEPTION",
});

export class GovernanceError extends Error {
  constructor(code, details = {}, options = undefined) {
    super(code, options);
    this.name = "GovernanceError";
    this.code = code;
    this.details = details;
  }
}

function governanceError(code, details = {}, options = undefined) {
  return new GovernanceError(code, details, options);
}

function nonEmpty(name, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw governanceError("GOVERNANCE_REQUIRED_VALUE_MISSING", { name });
  }
  return value.trim();
}

function packageIdentity(item) {
  return `${nonEmpty("package.name", item?.name)}@${nonEmpty("package.version", item?.version)}`;
}

function licenseText(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" ? item : String(item?.type ?? "").trim(),
      )
      .filter(Boolean)
      .join(" OR ");
  }
  if (value && typeof value === "object") {
    return String(value.type ?? "").trim();
  }
  return "";
}

export function normalizeLicenseExpression(value) {
  return licenseText(value)
    .replace(/\s+/gu, " ")
    .replace(/^\((.*)\)$/u, "$1")
    .trim();
}

function classifyAtomicLicense(identifier, policy) {
  if (policy.allow.includes(identifier)) {
    return { state: GOVERNANCE_STATES.pass, reason: "ALLOW_LIST" };
  }
  if (policy.review.includes(identifier)) {
    return { state: GOVERNANCE_STATES.review, reason: "REVIEW_LIST" };
  }
  if (policy.denyPatterns.some((pattern) => pattern.test(identifier))) {
    return { state: GOVERNANCE_STATES.block, reason: "DENY_PATTERN" };
  }
  return { state: GOVERNANCE_STATES.review, reason: "UNCLASSIFIED_LICENSE" };
}

export function classifyLicense(value, policy = LICENSE_POLICY) {
  const expression = normalizeLicenseExpression(value);
  if (!expression || expression === "UNKNOWN" || expression === "UNLICENSED") {
    return {
      expression: expression || "UNKNOWN",
      state: GOVERNANCE_STATES.block,
      reason: "LICENSE_UNKNOWN",
    };
  }
  if (/\s+(?:OR|AND)\s+/u.test(expression)) {
    const operator = expression.includes(" OR ") ? "OR" : "AND";
    const parts = expression.split(new RegExp(`\\s+${operator}\\s+`, "u"));
    const classifications = parts.map((part) =>
      classifyAtomicLicense(part.replace(/[()]/gu, "").trim(), policy),
    );
    if (
      operator === "OR" &&
      classifications.some((item) => item.state === GOVERNANCE_STATES.pass)
    ) {
      return {
        expression,
        state: GOVERNANCE_STATES.review,
        reason: "MULTI_LICENSE_CHOICE_REVIEW",
        parts: classifications,
      };
    }
    const state = classifications.some(
      (item) => item.state === GOVERNANCE_STATES.block,
    )
      ? GOVERNANCE_STATES.block
      : classifications.some((item) => item.state === GOVERNANCE_STATES.review)
        ? GOVERNANCE_STATES.review
        : GOVERNANCE_STATES.pass;
    return {
      expression,
      state,
      reason: `MULTI_LICENSE_${operator}`,
      parts: classifications,
    };
  }
  return { expression, ...classifyAtomicLicense(expression, policy) };
}

function parseExpiry(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function validateGovernanceExceptions(input, nowMs = Date.now()) {
  const exceptions = Array.isArray(input)
    ? input
    : Array.isArray(input?.exceptions)
      ? input.exceptions
      : [];
  const ids = new Set();
  return exceptions.map((item, index) => {
    const id = nonEmpty(`exceptions[${index}].id`, item?.id);
    if (ids.has(id)) {
      throw governanceError("GOVERNANCE_EXCEPTION_DUPLICATE_ID", { id });
    }
    ids.add(id);
    const kind = nonEmpty(`exceptions[${index}].kind`, item.kind);
    if (!["license", "vulnerability"].includes(kind)) {
      throw governanceError("GOVERNANCE_EXCEPTION_KIND_INVALID", { id, kind });
    }
    const packageName = nonEmpty(
      `exceptions[${index}].packageName`,
      item.packageName,
    );
    const packageVersion = nonEmpty(
      `exceptions[${index}].packageVersion`,
      item.packageVersion,
    );
    const owner = nonEmpty(`exceptions[${index}].owner`, item.owner);
    const reason = nonEmpty(`exceptions[${index}].reason`, item.reason);
    const expiresAt = nonEmpty(
      `exceptions[${index}].expiresAt`,
      item.expiresAt,
    );
    const expiresAtMs = parseExpiry(expiresAt);
    if (expiresAtMs === null) {
      throw governanceError("GOVERNANCE_EXCEPTION_EXPIRY_INVALID", {
        id,
        expiresAt,
      });
    }
    if (expiresAtMs <= nowMs) {
      throw governanceError("GOVERNANCE_EXCEPTION_EXPIRED", {
        id,
        expiresAt,
      });
    }
    const selector = nonEmpty(`exceptions[${index}].selector`, item.selector);
    return {
      id,
      kind,
      packageName,
      packageVersion,
      selector,
      owner,
      reason,
      expiresAt,
      expiresAtMs,
    };
  });
}

function findException(exceptions, kind, item, selector) {
  return exceptions.find(
    (exception) =>
      exception.kind === kind &&
      exception.packageName === item.name &&
      exception.packageVersion === item.version &&
      exception.selector === selector,
  );
}

export function evaluateLicenseMatrix(
  packages,
  {
    policy = LICENSE_POLICY,
    exceptions = [],
    nowMs = Date.now(),
    productionOnly = true,
  } = {},
) {
  if (!Array.isArray(packages)) {
    throw governanceError("LICENSE_MATRIX_INVALID");
  }
  const validatedExceptions = validateGovernanceExceptions(exceptions, nowMs);
  const identities = new Set();
  const entries = packages.map((item) => {
    const identity = packageIdentity(item);
    if (identities.has(identity)) {
      throw governanceError("LICENSE_MATRIX_DUPLICATE_PACKAGE", { identity });
    }
    identities.add(identity);
    const scope = item.scope ?? "production";
    if (!["production", "development", "optional"].includes(scope)) {
      throw governanceError("LICENSE_MATRIX_SCOPE_INVALID", {
        identity,
        scope,
      });
    }
    const classification = classifyLicense(item.license, policy);
    const exception = findException(
      validatedExceptions,
      "license",
      item,
      classification.expression,
    );
    const governedState = exception
      ? GOVERNANCE_STATES.exception
      : classification.state;
    return {
      identity,
      name: item.name,
      version: item.version,
      scope,
      license: classification.expression,
      state: governedState,
      rawState: classification.state,
      reason: classification.reason,
      exception: exception ?? null,
    };
  });
  const gated = productionOnly
    ? entries.filter((entry) => entry.scope !== "development")
    : entries;
  return {
    state: gated.some((entry) => entry.state === GOVERNANCE_STATES.block)
      ? GOVERNANCE_STATES.block
      : gated.some((entry) => entry.state === GOVERNANCE_STATES.review)
        ? GOVERNANCE_STATES.review
        : GOVERNANCE_STATES.pass,
    counts: Object.fromEntries(
      Object.values(GOVERNANCE_STATES).map((state) => [
        state,
        gated.filter((entry) => entry.state === state).length,
      ]),
    ),
    totalInstalled: entries.length,
    totalGated: gated.length,
    entries,
  };
}

function sbomIdentity(component) {
  if (!component?.name || !component?.version) return null;
  return `${component.name}@${component.version}`;
}

export function validateCycloneDxSbom(sbom, packages) {
  if (!sbom || typeof sbom !== "object") {
    throw governanceError("SBOM_INVALID");
  }
  if (
    sbom.bomFormat !== "CycloneDX" ||
    !/^1\.[4-9]$/u.test(String(sbom.specVersion))
  ) {
    throw governanceError("SBOM_FORMAT_UNSUPPORTED", {
      bomFormat: sbom.bomFormat,
      specVersion: sbom.specVersion,
    });
  }
  if (!Number.isSafeInteger(sbom.version) || sbom.version < 1) {
    throw governanceError("SBOM_VERSION_INVALID", { version: sbom.version });
  }
  if (!Array.isArray(sbom.components) || !Array.isArray(sbom.dependencies)) {
    throw governanceError("SBOM_STRUCTURE_INVALID");
  }
  const components = new Map();
  for (const component of sbom.components) {
    const identity = sbomIdentity(component);
    const ref = component?.["bom-ref"];
    if (!identity || typeof ref !== "string" || ref.length === 0) {
      throw governanceError("SBOM_COMPONENT_INVALID", { component });
    }
    if (components.has(identity)) {
      throw governanceError("SBOM_COMPONENT_DUPLICATE", { identity });
    }
    components.set(identity, component);
  }
  const expected = packages.map(packageIdentity);
  const missingComponents = expected.filter(
    (identity) => !components.has(identity),
  );
  const rootRef = sbom.metadata?.component?.["bom-ref"];
  const refs = new Set(sbom.components.map((item) => item["bom-ref"]));
  if (rootRef) refs.add(rootRef);
  const danglingReferences = [];
  for (const dependency of sbom.dependencies) {
    if (!refs.has(dependency?.ref)) {
      danglingReferences.push(dependency?.ref ?? null);
    }
    for (const ref of dependency?.dependsOn ?? []) {
      if (!refs.has(ref)) danglingReferences.push(ref);
    }
  }
  return {
    state:
      missingComponents.length === 0 && danglingReferences.length === 0
        ? GOVERNANCE_STATES.pass
        : GOVERNANCE_STATES.block,
    specVersion: sbom.specVersion,
    componentCount: sbom.components.length,
    dependencyNodeCount: sbom.dependencies.length,
    expectedPackageCount: expected.length,
    missingComponents,
    danglingReferences: [...new Set(danglingReferences)],
  };
}

function severityRank(severity) {
  return { info: 0, low: 1, moderate: 2, high: 3, critical: 4 }[severity] ?? -1;
}

function auditSelectors(name, vulnerability) {
  const selectors = new Set([name]);
  for (const via of vulnerability?.via ?? []) {
    if (typeof via === "string") selectors.add(via);
    else if (via?.source !== undefined) selectors.add(String(via.source));
  }
  return [...selectors];
}

export function evaluateNpmAudit(
  audit,
  {
    exceptions = [],
    nowMs = Date.now(),
    blockAt = "high",
    reviewAt = "moderate",
  } = {},
) {
  if (
    !audit ||
    audit.auditReportVersion !== 2 ||
    !audit.vulnerabilities ||
    !audit.metadata?.vulnerabilities
  ) {
    throw governanceError("NPM_AUDIT_REPORT_INVALID");
  }
  const validatedExceptions = validateGovernanceExceptions(exceptions, nowMs);
  const entries = Object.entries(audit.vulnerabilities).map(
    ([name, vulnerability]) => {
      const severity = vulnerability?.severity;
      if (severityRank(severity) < 0) {
        throw governanceError("NPM_AUDIT_SEVERITY_INVALID", {
          name,
          severity,
        });
      }
      const version = String(vulnerability?.range ?? "UNKNOWN");
      const selectors = auditSelectors(name, vulnerability);
      const exception = validatedExceptions.find(
        (item) =>
          item.kind === "vulnerability" &&
          item.packageName === name &&
          item.packageVersion === version &&
          selectors.includes(item.selector),
      );
      const rawState =
        severityRank(severity) >= severityRank(blockAt)
          ? GOVERNANCE_STATES.block
          : severityRank(severity) >= severityRank(reviewAt)
            ? GOVERNANCE_STATES.review
            : GOVERNANCE_STATES.pass;
      return {
        name,
        version,
        severity,
        state: exception ? GOVERNANCE_STATES.exception : rawState,
        rawState,
        selectors,
        exception: exception ?? null,
      };
    },
  );
  const declared = audit.metadata.vulnerabilities;
  const declaredTotal = ["info", "low", "moderate", "high", "critical"].reduce(
    (sum, severity) => sum + Number(declared[severity] ?? 0),
    0,
  );
  if (declaredTotal !== Number(declared.total ?? 0)) {
    throw governanceError("NPM_AUDIT_COUNT_INCONSISTENT", {
      declaredTotal,
      metadataTotal: declared.total,
    });
  }
  return {
    state: entries.some((entry) => entry.state === GOVERNANCE_STATES.block)
      ? GOVERNANCE_STATES.block
      : entries.some((entry) => entry.state === GOVERNANCE_STATES.review)
        ? GOVERNANCE_STATES.review
        : GOVERNANCE_STATES.pass,
    counts: {
      info: Number(declared.info ?? 0),
      low: Number(declared.low ?? 0),
      moderate: Number(declared.moderate ?? 0),
      high: Number(declared.high ?? 0),
      critical: Number(declared.critical ?? 0),
      total: Number(declared.total ?? 0),
    },
    entries,
    policy: { blockAt, reviewAt },
  };
}

export function renderThirdPartyNotices(packages) {
  const sorted = [...packages].sort((left, right) =>
    packageIdentity(left).localeCompare(packageIdentity(right)),
  );
  return [
    "# THIRD-PARTY NOTICES — V1.5 Technology Selection PoC",
    "",
    "Generated from installed package manifests. This is not legal advice.",
    "",
    ...sorted.flatMap((item) => [
      `## ${packageIdentity(item)}`,
      `- Scope: ${item.scope ?? "production"}`,
      `- License: ${normalizeLicenseExpression(item.license) || "UNKNOWN"}`,
      `- Repository: ${item.repository ?? "Not declared"}`,
      `- Homepage: ${item.homepage ?? "Not declared"}`,
      "",
    ]),
  ].join("\n");
}

export function validateGeneratedNotices(notices, packages) {
  if (typeof notices !== "string" || notices.length === 0) {
    throw governanceError("NOTICES_INVALID");
  }
  const prohibitedPatterns = [
    /(?:^|\s)(?:\/home\/|\/Users\/|\/tmp\/)/u,
    /[A-Za-z]:\\(?:Users|Documents|Temp)\\/u,
    /BEGIN [A-Z ]*PRIVATE KEY/u,
    /(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{12,}/u,
    /[?&]token=[^\s]+/iu,
  ];
  const violations = prohibitedPatterns
    .filter((pattern) => pattern.test(notices))
    .map((pattern) => pattern.source);
  const missingPackages = packages
    .map(packageIdentity)
    .filter((identity) => !notices.includes(`## ${identity}`));
  const deterministic = notices === renderThirdPartyNotices(packages);
  return {
    state:
      violations.length === 0 && missingPackages.length === 0 && deterministic
        ? GOVERNANCE_STATES.pass
        : GOVERNANCE_STATES.block,
    deterministic,
    violations,
    missingPackages,
    sha256: createHash("sha256").update(notices, "utf8").digest("hex"),
  };
}

export function buildGovernanceSummary({
  packages,
  notices,
  sbom,
  audit,
  auditExitCode,
  exceptions = [],
  nowMs = Date.now(),
}) {
  const licenses = evaluateLicenseMatrix(packages, { exceptions, nowMs });
  const noticesResult = validateGeneratedNotices(notices, packages);
  const sbomResult = validateCycloneDxSbom(sbom, packages);
  const auditResult = evaluateNpmAudit(audit, { exceptions, nowMs });
  if (!Number.isSafeInteger(auditExitCode) || auditExitCode < 0) {
    throw governanceError("NPM_AUDIT_EXIT_CODE_INVALID", { auditExitCode });
  }
  const blockers = [];
  if (licenses.state === GOVERNANCE_STATES.block) {
    blockers.push("LICENSE_POLICY");
  }
  if (noticesResult.state === GOVERNANCE_STATES.block) {
    blockers.push("NOTICES");
  }
  if (sbomResult.state === GOVERNANCE_STATES.block) blockers.push("SBOM");
  if (auditResult.state === GOVERNANCE_STATES.block) {
    blockers.push("NPM_AUDIT");
  }
  const reviews = [];
  if (licenses.state === GOVERNANCE_STATES.review) {
    reviews.push("LICENSE_REVIEW");
  }
  if (auditResult.state === GOVERNANCE_STATES.review) {
    reviews.push("VULNERABILITY_REVIEW");
  }
  return {
    state:
      blockers.length > 0 ? GOVERNANCE_STATES.block : GOVERNANCE_STATES.pass,
    blockers,
    reviews,
    auditExitCode,
    licenses,
    notices: noticesResult,
    sbom: sbomResult,
    audit: auditResult,
  };
}
