import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  AUDIT_ARGUMENTS,
  MAX_AUDIT_STDERR_BYTES,
  MAX_AUDIT_STDOUT_BYTES,
  evaluateAuditExecution,
  evaluateAuditReport,
  parseAuditReport,
  parseExceptionConfig,
  resolveNpmInvocation,
  runNpmAudit,
  validateExceptionConfig,
  validateNanoidResolution,
} from "./dependency-audit.mjs";

const NOW_BEFORE_EXPIRY = new Date("2026-08-18T12:00:00+08:00");
const NOW_AT_EXPIRY = new Date("2026-09-01T15:59:00.000Z");
const NOW_AFTER_EXPIRY = new Date("2026-09-02T00:00:00+08:00");
const EXCEPTIONS_PATH = new URL(
  "./dependency-audit-exceptions.json",
  import.meta.url,
);

// Keep this fixture independent from dependency-audit.mjs. It is the test's
// fixed security approval, not an implementation-derived expected value.
const APPROVED_EXCEPTION_FIXTURE = Object.freeze({
  package: "deepmerge-ts",
  advisory: "GHSA-ggr8-5vv4-36mx",
  cve: "CVE-2026-40345",
  severity: "high",
  affectedRange: "<8.0.0",
  currentVersion: "7.1.5",
  chain: "prisma@7.9.1 -> @prisma/config@7.9.1 -> deepmerge-ts@7.1.5",
  coveredFindings: Object.freeze(["deepmerge-ts", "@prisma/config", "prisma"]),
  expiresAt: "2026-09-01T23:59:00+08:00",
  ownerRole: "V1 Private Preview release-security owner",
  reviewDate: "2026-08-25",
  reviewCondition:
    "Review immediately when a supported stable Prisma fix becomes available; no later than expiry.",
  reason:
    "Main-derived V1 Private Preview dependency-security baseline; the Prisma build/config chain is not reachable from the deployed API runtime or browser bundles.",
});

const SAFE_NPM_EXEC_PATH = path.join(
  path.parse(process.execPath).root,
  "test-node",
  "node_modules",
  "npm",
  "bin",
  "npm-cli.js",
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validExceptionConfig() {
  return {
    schemaVersion: 1,
    exceptions: [clone(APPROVED_EXCEPTION_FIXTURE)],
  };
}

function validPackageLock() {
  return {
    lockfileVersion: 3,
    packages: {
      "node_modules/prisma": {
        version: "7.9.1",
        dependencies: {
          "@prisma/config": "7.9.1",
        },
      },
      "node_modules/@prisma/config": {
        version: "7.9.1",
        dependencies: {
          "deepmerge-ts": "7.1.5",
        },
      },
      "node_modules/deepmerge-ts": {
        version: "7.1.5",
      },
      "node_modules/nanoid": {
        version: "3.3.18",
      },
    },
  };
}

function advisory({
  id = APPROVED_EXCEPTION_FIXTURE.advisory,
  name = APPROVED_EXCEPTION_FIXTURE.package,
  dependency = APPROVED_EXCEPTION_FIXTURE.package,
  severity = "high",
  range = APPROVED_EXCEPTION_FIXTURE.affectedRange,
} = {}) {
  return {
    source: 1145093,
    name,
    dependency,
    title:
      "DeepmergeTS has stack exhaustion when merging recursive object graphs",
    url: `https://github.com/advisories/${id}`,
    severity,
    cwe: ["CWE-674"],
    cvss: { score: 0, vectorString: null },
    range,
  };
}

function vulnerability({
  name,
  severity = "high",
  via,
  effects = [],
  nodes,
  range = APPROVED_EXCEPTION_FIXTURE.affectedRange,
  isDirect = false,
}) {
  return {
    name,
    severity,
    isDirect,
    via,
    effects,
    range,
    nodes,
  };
}

function metadataFor(vulnerabilities) {
  const counts = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
  };
  for (const entry of Object.values(vulnerabilities)) {
    counts[entry.severity] += 1;
  }
  return {
    vulnerabilities: {
      ...counts,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    },
    dependencies: {
      prod: 1,
      dev: 3,
      optional: 0,
      peer: 0,
      peerOptional: 0,
      total: 4,
    },
  };
}

function approvedAuditReport() {
  const vulnerabilities = {
    "@prisma/config": vulnerability({
      name: "@prisma/config",
      via: ["deepmerge-ts"],
      effects: ["prisma"],
      nodes: ["node_modules/@prisma/config"],
    }),
    "deepmerge-ts": vulnerability({
      name: "deepmerge-ts",
      via: [advisory()],
      effects: ["@prisma/config"],
      nodes: ["node_modules/deepmerge-ts"],
    }),
    prisma: vulnerability({
      name: "prisma",
      via: ["@prisma/config"],
      effects: [],
      nodes: ["node_modules/prisma"],
      isDirect: true,
    }),
  };
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: metadataFor(vulnerabilities),
  };
}

function lowModerateOnlyAuditReport() {
  const vulnerabilities = {
    "low-package": vulnerability({
      name: "low-package",
      severity: "low",
      via: [advisory({ id: "GHSA-aaaa-bbbb-cccc", severity: "low" })],
      nodes: ["node_modules/low-package"],
    }),
    "moderate-package": vulnerability({
      name: "moderate-package",
      severity: "moderate",
      via: [advisory({ id: "GHSA-dddd-eeee-ffff", severity: "moderate" })],
      nodes: ["node_modules/moderate-package"],
    }),
  };
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: metadataFor(vulnerabilities),
  };
}

function evaluate(report = approvedAuditReport(), overrides = {}) {
  return evaluateAuditReport({
    auditReport: report,
    exceptionConfig: validExceptionConfig(),
    packageLock: validPackageLock(),
    now: NOW_BEFORE_EXPIRY,
    ...overrides,
  });
}

function singleVulnerabilityReport({
  name = "unapproved-package",
  topSeverity = "low",
  viaSeverity = "critical",
} = {}) {
  const vulnerabilities = {
    [name]: vulnerability({
      name,
      severity: topSeverity,
      via: [
        advisory({
          id: "GHSA-1111-2222-3333",
          name,
          dependency: name,
          severity: viaSeverity,
        }),
      ],
      nodes: [`node_modules/${name}`],
    }),
  };
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: metadataFor(vulnerabilities),
  };
}

function fakeChildProcess() {
  const child = new EventEmitter();
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  stdout.setEncoding = () => {};
  stderr.setEncoding = () => {};
  child.stdout = stdout;
  child.stderr = stderr;
  child.killSignals = [];
  child.kill = (signal) => {
    child.killSignals.push(signal);
    return true;
  };
  return child;
}

function fakeSpawn({
  stdout = "",
  stderr = "",
  code = 0,
  signal = null,
  close = true,
} = {}) {
  const state = { command: null, args: null, options: null, child: null };
  const spawnImpl = (command, args, options) => {
    const child = fakeChildProcess();
    state.command = command;
    state.args = args;
    state.options = options;
    state.child = child;
    if (close) {
      queueMicrotask(() => {
        if (stdout !== "") child.stdout.emit("data", stdout);
        if (stderr !== "") child.stderr.emit("data", stderr);
        child.emit("close", code, signal);
      });
    }
    return child;
  };
  return { spawnImpl, state };
}

function auditRunOptions(spawnImpl, overrides = {}) {
  return {
    cwd: process.cwd(),
    env: { npm_execpath: SAFE_NPM_EXEC_PATH },
    spawnImpl,
    ...overrides,
  };
}

function evaluateExecution(execution) {
  return evaluateAuditExecution({
    stdout: execution.stdout,
    code: execution.code,
    commandError: execution.commandError,
    exceptionConfig: validExceptionConfig(),
    packageLock: validPackageLock(),
    now: NOW_BEFORE_EXPIRY,
  });
}

test("the exception config matches an independent fixed security fixture", async () => {
  const text = await readFile(EXCEPTIONS_PATH, "utf8");
  const config = JSON.parse(text);
  assert.deepEqual(config, validExceptionConfig());

  const parsed = parseExceptionConfig(text);
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.exception, APPROVED_EXCEPTION_FIXTURE);
});

test("Windows-safe npm invocation uses Node plus npm-cli.js with shell false", async () => {
  const { spawnImpl, state } = fakeSpawn({
    stdout: JSON.stringify({}),
  });
  const execution = await runNpmAudit(auditRunOptions(spawnImpl));

  assert.equal(execution.commandError, null);
  assert.equal(state.command, process.execPath);
  assert.deepEqual(state.args, [SAFE_NPM_EXEC_PATH, ...AUDIT_ARGUMENTS]);
  assert.equal(state.options.shell, false);

  const invocation = resolveNpmInvocation({
    env: {},
    execPath: process.execPath,
    cwd: process.cwd(),
  });
  assert.equal(invocation.command, process.execPath);
  assert.ok(invocation.args[0].toLowerCase().endsWith(`${path.sep}npm-cli.js`));
});

test("only the approved GHSA chain passes and applies the temporary exception", () => {
  const result = evaluate();
  assert.equal(result.passed, true);
  assert.equal(result.appliedException, true);
});

test("an exact affectedRange match passes", () => {
  const report = approvedAuditReport();
  assert.equal(
    report.vulnerabilities["deepmerge-ts"].range,
    APPROVED_EXCEPTION_FIXTURE.affectedRange,
  );
  assert.equal(
    report.vulnerabilities["deepmerge-ts"].via[0].range,
    APPROVED_EXCEPTION_FIXTURE.affectedRange,
  );
  assert.equal(evaluate(report).passed, true);
});

test("a missing audit finding affectedRange fails closed", () => {
  const report = approvedAuditReport();
  delete report.vulnerabilities["deepmerge-ts"].via[0].range;
  assert.equal(evaluate(report).passed, false);
});

test("an audit finding affectedRange mismatch fails closed", () => {
  const report = approvedAuditReport();
  report.vulnerabilities["deepmerge-ts"].via[0].range = "<7.0.0";
  assert.equal(evaluate(report).passed, false);
});

test("a leaf finding affectedRange mismatch fails closed", () => {
  const report = approvedAuditReport();
  report.vulnerabilities["deepmerge-ts"].range = "<7.0.0";
  assert.equal(evaluate(report).passed, false);
});

test("an empty exception affectedRange fails closed", () => {
  const config = validExceptionConfig();
  config.exceptions[0].affectedRange = "";
  assert.equal(validateExceptionConfig(config).valid, false);
  assert.equal(
    evaluate(approvedAuditReport(), { exceptionConfig: config }).passed,
    false,
  );
});

test("an exception contract missing affectedRange fails closed", () => {
  const config = validExceptionConfig();
  delete config.exceptions[0].affectedRange;
  assert.equal(validateExceptionConfig(config).valid, false);
  assert.equal(
    evaluate(approvedAuditReport(), { exceptionConfig: config }).passed,
    false,
  );
});

test("the approved exception requires the complete audit dependency chain", () => {
  const report = approvedAuditReport();
  delete report.vulnerabilities.prisma;
  report.metadata = metadataFor(report.vulnerabilities);
  const result = evaluate(report);
  assert.equal(result.passed, false);
});

test("no high or critical vulnerabilities passes without applying an exception", () => {
  const vulnerabilities = {};
  const report = {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: metadataFor(vulnerabilities),
  };
  const result = evaluate(report);
  assert.equal(result.passed, true);
  assert.equal(result.appliedException, false);
});

test("top-level low with a critical via advisory fails closed", () => {
  const result = evaluate(singleVulnerabilityReport());
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("unapproved")));
});

test("top-level moderate with a high via advisory fails closed", () => {
  const result = evaluate(
    singleVulnerabilityReport({ topSeverity: "moderate", viaSeverity: "high" }),
  );
  assert.equal(result.passed, false);
});

test("top-level low with only low/moderate via advisories passes", () => {
  const lowResult = evaluate(
    singleVulnerabilityReport({ topSeverity: "low", viaSeverity: "low" }),
  );
  const moderateResult = evaluate(
    singleVulnerabilityReport({
      topSeverity: "moderate",
      viaSeverity: "moderate",
    }),
  );
  assert.equal(lowResult.passed, true);
  assert.equal(moderateResult.passed, true);
  assert.equal(lowResult.appliedException, false);
  assert.equal(moderateResult.appliedException, false);
});

test("a new high vulnerability fails closed", () => {
  const report = approvedAuditReport();
  report.vulnerabilities.other = vulnerability({
    name: "other",
    via: [
      advisory({
        id: "GHSA-1111-2222-3333",
        name: "other",
        dependency: "other",
      }),
    ],
    nodes: ["node_modules/other"],
  });
  report.metadata = metadataFor(report.vulnerabilities);
  const result = evaluate(report);
  assert.equal(result.passed, false);
});

test("a new critical vulnerability fails closed", () => {
  const report = approvedAuditReport();
  report.vulnerabilities.other = vulnerability({
    name: "other",
    severity: "critical",
    via: [
      advisory({
        id: "GHSA-4444-5555-6666",
        name: "other",
        dependency: "other",
        severity: "critical",
      }),
    ],
    nodes: ["node_modules/other"],
  });
  report.metadata = metadataFor(report.vulnerabilities);
  const result = evaluate(report);
  assert.equal(result.passed, false);
});

test("an advisory ID mismatch fails closed", () => {
  const report = approvedAuditReport();
  report.vulnerabilities["deepmerge-ts"].via[0] = advisory({
    id: "GHSA-7777-8888-9999",
  });
  const result = evaluate(report);
  assert.equal(result.passed, false);
});

test("an exception CVE mismatch fails closed", () => {
  const config = validExceptionConfig();
  config.exceptions[0].cve = "CVE-2026-00000";
  const result = evaluate(approvedAuditReport(), {
    exceptionConfig: config,
  });
  assert.equal(result.passed, false);
});

test("an exception severity mismatch fails closed", () => {
  const config = validExceptionConfig();
  config.exceptions[0].severity = "critical";
  const result = evaluate(approvedAuditReport(), {
    exceptionConfig: config,
  });
  assert.equal(result.passed, false);
});

test("a coveredFindings mismatch fails closed", () => {
  const config = validExceptionConfig();
  config.exceptions[0].coveredFindings = ["deepmerge-ts", "@prisma/config"];
  const result = evaluate(approvedAuditReport(), {
    exceptionConfig: config,
  });
  assert.equal(result.passed, false);
});

test("a nanoid high finding is never covered by the exception", () => {
  const report = approvedAuditReport();
  report.vulnerabilities.nanoid = vulnerability({
    name: "nanoid",
    via: [
      advisory({
        id: "GHSA-2v37-7h3g-55p8",
        name: "nanoid",
        dependency: "nanoid",
      }),
    ],
    nodes: ["node_modules/nanoid"],
  });
  report.metadata = metadataFor(report.vulnerabilities);
  const result = evaluate(report);
  assert.equal(result.passed, false);
});

test("an advisory package mismatch fails closed", () => {
  const report = approvedAuditReport();
  report.vulnerabilities["deepmerge-ts"].via[0] = advisory({
    name: "other-package",
    dependency: "other-package",
  });
  const result = evaluate(report);
  assert.equal(result.passed, false);
});

test("a vulnerable version mismatch fails closed", () => {
  const lock = validPackageLock();
  lock.packages["node_modules/deepmerge-ts"].version = "7.1.6";
  const result = evaluate(approvedAuditReport(), { packageLock: lock });
  assert.equal(result.passed, false);
});

test("nanoid must resolve exactly once at version 3.3.18", () => {
  const validResult = validateNanoidResolution(validPackageLock());
  assert.equal(validResult.valid, true);

  const vulnerableLock = validPackageLock();
  vulnerableLock.packages["node_modules/nanoid"].version = "3.3.17";
  const vulnerableResult = validateNanoidResolution(vulnerableLock);
  assert.equal(vulnerableResult.valid, false);

  const duplicateLock = validPackageLock();
  duplicateLock.packages["node_modules/tool/node_modules/nanoid"] = {
    version: "3.3.18",
  };
  const duplicateResult = validateNanoidResolution(duplicateLock);
  assert.equal(duplicateResult.valid, false);
});

test("a missing package-lock fails closed for the approved exception", () => {
  const result = evaluate(approvedAuditReport(), { packageLock: null });
  assert.equal(result.passed, false);
});

test("a Prisma package version mismatch fails closed", () => {
  const lock = validPackageLock();
  lock.packages["node_modules/prisma"].version = "7.9.2";
  const result = evaluate(approvedAuditReport(), { packageLock: lock });
  assert.equal(result.passed, false);
});

test("an @prisma/config package version mismatch fails closed", () => {
  const lock = validPackageLock();
  lock.packages["node_modules/@prisma/config"].version = "7.9.2";
  const result = evaluate(approvedAuditReport(), { packageLock: lock });
  assert.equal(result.passed, false);
});

test("a Prisma dependency-chain mismatch fails closed", () => {
  const lock = validPackageLock();
  lock.packages["node_modules/prisma"].dependencies["@prisma/config"] = "7.9.2";
  const result = evaluate(approvedAuditReport(), { packageLock: lock });
  assert.equal(result.passed, false);
});

test("an expired exception fails closed", () => {
  const result = evaluate(approvedAuditReport(), { now: NOW_AFTER_EXPIRY });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("expired")));
});

test("an exception remains usable strictly before expiry", () => {
  const result = evaluate(approvedAuditReport(), {
    now: new Date("2026-09-01T15:58:59.999Z"),
  });
  assert.equal(result.passed, true);
  assert.equal(result.appliedException, true);
});

test("an exception is expired at the exact expiry instant", () => {
  const result = evaluate(approvedAuditReport(), { now: NOW_AT_EXPIRY });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("expired")));
});

test("malformed, incomplete, and multiple exception configurations fail closed", () => {
  assert.equal(parseExceptionConfig("{not-json").valid, false);

  const incomplete = validExceptionConfig();
  delete incomplete.exceptions[0].reason;
  assert.equal(validateExceptionConfig(incomplete).valid, false);

  const multiple = validExceptionConfig();
  multiple.exceptions.push(clone(APPROVED_EXCEPTION_FIXTURE));
  assert.equal(validateExceptionConfig(multiple).valid, false);

  const nanoidException = validExceptionConfig();
  nanoidException.exceptions[0].package = "nanoid";
  nanoidException.exceptions[0].currentVersion = "3.3.17";
  nanoidException.exceptions[0].advisory = "GHSA-2v37-7h3g-55p8";
  assert.equal(validateExceptionConfig(nanoidException).valid, false);
});

test("malformed and structurally invalid audit JSON fails closed", () => {
  assert.equal(parseAuditReport("{not-json").valid, false);

  const malformed = approvedAuditReport();
  delete malformed.metadata.vulnerabilities;
  assert.equal(parseAuditReport(JSON.stringify(malformed)).valid, false);
});

test("an npm audit command error fails closed", () => {
  const result = evaluateAuditExecution({
    stdout: "",
    code: null,
    commandError: new Error("spawn failed"),
    exceptionConfig: validExceptionConfig(),
    packageLock: validPackageLock(),
    now: NOW_BEFORE_EXPIRY,
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("command failed")));
});

test("an npm audit spawn ENOENT fails closed", async () => {
  const execution = await runNpmAudit(
    auditRunOptions(() => {
      throw new Error("spawn ENOENT");
    }),
  );
  const result = evaluateExecution(execution);
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("ENOENT")));
});

test("an npm audit process terminated by signal fails closed", async () => {
  const { spawnImpl } = fakeSpawn({ code: null, signal: "SIGTERM" });
  const execution = await runNpmAudit(auditRunOptions(spawnImpl));
  const result = evaluateExecution(execution);
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("signal")));
});

test("empty npm audit stdout fails closed", () => {
  const result = evaluateExecution({
    stdout: "",
    code: 0,
    commandError: null,
  });
  assert.equal(result.passed, false);
});

test("non-JSON npm audit stdout fails closed", () => {
  const result = evaluateExecution({
    stdout: "not-json",
    code: 0,
    commandError: null,
  });
  assert.equal(result.passed, false);
});

test("stdout over the limit terminates the audit and fails closed", async () => {
  const { spawnImpl, state } = fakeSpawn({
    stdout: "x".repeat(MAX_AUDIT_STDOUT_BYTES + 1),
  });
  const execution = await runNpmAudit(auditRunOptions(spawnImpl));
  const result = evaluateExecution(execution);

  assert.equal(execution.outputLimitExceeded, "stdout");
  assert.ok(execution.commandError.message.includes("stdout exceeded"));
  assert.deepEqual(state.child.killSignals, ["SIGTERM"]);
  assert.equal(result.passed, false);
});

test("stderr over the limit terminates the audit and fails closed", async () => {
  const { spawnImpl, state } = fakeSpawn({
    stderr: "x".repeat(MAX_AUDIT_STDERR_BYTES + 1),
  });
  const execution = await runNpmAudit(auditRunOptions(spawnImpl));
  const result = evaluateExecution(execution);

  assert.equal(execution.outputLimitExceeded, "stderr");
  assert.ok(execution.commandError.message.includes("stderr exceeded"));
  assert.deepEqual(state.child.killSignals, ["SIGTERM"]);
  assert.equal(result.passed, false);
});

test("npm audit timeout terminates the process and fails closed", async () => {
  const { spawnImpl, state } = fakeSpawn({ close: false });
  let timeoutCallback;
  const executionPromise = runNpmAudit(
    auditRunOptions(spawnImpl, {
      timeoutMs: 1,
      setTimeoutImpl: (callback) => {
        timeoutCallback = callback;
        return 1;
      },
      clearTimeoutImpl: () => {},
    }),
  );

  assert.equal(typeof timeoutCallback, "function");
  timeoutCallback();
  const execution = await executionPromise;
  const result = evaluateExecution(execution);

  assert.equal(execution.timedOut, true);
  assert.equal(execution.commandError.message, "npm audit timed out");
  assert.deepEqual(state.child.killSignals, ["SIGTERM"]);
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.includes("timed out")));
});

test("a non-zero npm audit exit is evaluated from valid JSON", () => {
  const result = evaluateAuditExecution({
    stdout: JSON.stringify(approvedAuditReport()),
    code: 1,
    exceptionConfig: validExceptionConfig(),
    packageLock: validPackageLock(),
    now: NOW_BEFORE_EXPIRY,
  });
  assert.equal(result.passed, true);
  assert.equal(result.appliedException, true);
});

test("low and moderate vulnerabilities do not trigger high/critical failure", () => {
  const result = evaluate(lowModerateOnlyAuditReport());
  assert.equal(result.passed, true);
  assert.equal(result.appliedException, false);
});
