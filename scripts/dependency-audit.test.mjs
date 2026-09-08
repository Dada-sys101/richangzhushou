import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAuditExecution,
  evaluateAuditReport,
  parseAuditReport,
  validateExceptionConfig,
} from "./dependency-audit.mjs";

const noExceptions = Object.freeze({ schemaVersion: 1, exceptions: [] });
const packageLock = Object.freeze({ lockfileVersion: 3, packages: {} });

function report(vulnerabilities = {}) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const entry of Object.values(vulnerabilities))
    counts[entry.severity] += 1;
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: {
      vulnerabilities: {
        ...counts,
        total: Object.keys(vulnerabilities).length,
      },
      dependencies: {
        prod: 1,
        dev: 0,
        optional: 0,
        peer: 0,
        peerOptional: 0,
        total: 1,
      },
    },
  };
}

function vulnerability(name, severity) {
  return {
    name,
    severity,
    isDirect: false,
    via: [
      {
        source: 1,
        name,
        dependency: name,
        title: `${name} advisory`,
        url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
        severity,
        range: "<99.0.0",
      },
    ],
    effects: [],
    range: "<99.0.0",
    nodes: [`node_modules/${name}`],
    fixAvailable: true,
  };
}

function evaluate(auditReport) {
  return evaluateAuditReport({
    auditReport,
    exceptionConfig: noExceptions,
    packageLock,
  });
}

test("a safe dependency tree passes without an exception", () => {
  assert.deepEqual(evaluate(report()), {
    passed: true,
    appliedException: false,
    errors: [],
  });
});

test("low and moderate vulnerabilities do not fail the high threshold", () => {
  const result = evaluate(
    report({
      lowPackage: vulnerability("lowPackage", "low"),
      moderatePackage: vulnerability("moderatePackage", "moderate"),
    }),
  );
  assert.equal(result.passed, true);
  assert.equal(result.appliedException, false);
});

for (const severity of ["high", "critical"]) {
  test(`${severity} vulnerabilities are rejected without exception`, () => {
    const result = evaluate(
      report({
        vulnerablePackage: vulnerability("vulnerablePackage", severity),
      }),
    );
    assert.equal(result.passed, false);
    assert.equal(result.appliedException, false);
    assert.match(result.errors.join("\n"), /unapproved high\/critical package/);
  });
}

test("a high advisory hidden behind a lower-severity parent is still rejected", () => {
  const leaf = vulnerability("leaf", "high");
  const parent = { ...vulnerability("parent", "moderate"), via: ["leaf"] };
  const result = evaluate(report({ parent, leaf }));
  assert.equal(result.passed, false);
  assert.match(result.errors.join("\n"), /parent/);
  assert.match(result.errors.join("\n"), /leaf/);
});

test("audit execution failures fail closed", () => {
  const result = evaluateAuditExecution({
    stdout: "",
    code: null,
    commandError: new Error("spawn failed"),
    exceptionConfig: noExceptions,
    packageLock,
  });
  assert.equal(result.passed, false);
  assert.match(result.errors.join("\n"), /failed to execute/);
});

test("empty, malformed, and structurally invalid audit output fail closed", () => {
  for (const stdout of [
    "",
    "not json",
    JSON.stringify({ auditReportVersion: 2 }),
  ]) {
    const result = evaluateAuditExecution({
      stdout,
      code: 1,
      exceptionConfig: noExceptions,
      packageLock,
    });
    assert.equal(result.passed, false);
  }
});

test("a valid non-zero npm audit exit is evaluated instead of ignored", () => {
  const result = evaluateAuditExecution({
    stdout: JSON.stringify(
      report({
        vulnerablePackage: vulnerability("vulnerablePackage", "high"),
      }),
    ),
    code: 1,
    exceptionConfig: noExceptions,
    packageLock,
  });
  assert.equal(result.passed, false);
});

test("non-empty, malformed, or unexpected exception config cannot mask findings", () => {
  for (const exceptionConfig of [
    { schemaVersion: 1, exceptions: [{}] },
    { schemaVersion: 1, exceptions: [], unexpected: true },
    { schemaVersion: 2, exceptions: [] },
  ]) {
    assert.equal(validateExceptionConfig(exceptionConfig).valid, false);
    assert.equal(
      evaluateAuditReport({
        auditReport: report(),
        exceptionConfig,
        packageLock,
      }).passed,
      false,
    );
  }
});

test("parseAuditReport rejects inconsistent vulnerability metadata", () => {
  const invalid = report();
  invalid.metadata.vulnerabilities.high = 1;
  assert.equal(parseAuditReport(JSON.stringify(invalid)).valid, false);
});
