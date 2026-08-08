import test from "node:test";
import assert from "node:assert/strict";
import {
  GOVERNANCE_STATES,
  GovernanceError,
  buildGovernanceSummary,
  classifyLicense,
  evaluateLicenseMatrix,
  evaluateNpmAudit,
  renderThirdPartyNotices,
  validateCycloneDxSbom,
  validateGeneratedNotices,
  validateGovernanceExceptions,
} from "../lib/dependency-governance.mjs";

function packageRow(name, version, license, scope = "production") {
  return { name, version, license, scope, repository: null, homepage: null };
}

function sbomFor(packages) {
  const rootRef = "root@1.0.0";
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      component: { "bom-ref": rootRef, name: "root", version: "1.0.0" },
    },
    components: packages.map((item) => ({
      type: "library",
      name: item.name,
      version: item.version,
      "bom-ref": `${item.name}@${item.version}`,
    })),
    dependencies: [
      {
        ref: rootRef,
        dependsOn: packages.map((item) => `${item.name}@${item.version}`),
      },
      ...packages.map((item) => ({
        ref: `${item.name}@${item.version}`,
        dependsOn: [],
      })),
    ],
  };
}

function audit(vulnerabilities = {}) {
  const counts = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };
  for (const item of Object.values(vulnerabilities)) {
    counts[item.severity] += 1;
    counts.total += 1;
  }
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: { vulnerabilities: counts, dependencies: { total: 1 } },
  };
}

const futureException = {
  id: "exception-1",
  kind: "license",
  packageName: "blocked",
  packageVersion: "1.0.0",
  selector: "GPL-3.0-only",
  owner: "security-owner",
  reason: "Temporary isolated evaluation only",
  expiresAt: "2027-01-01T00:00:00.000Z",
};

test("license policy allows permissive licenses, reviews weak copyleft and blocks unknown or deny-listed licenses", () => {
  assert.equal(classifyLicense("MIT").state, GOVERNANCE_STATES.pass);
  assert.equal(classifyLicense("MPL-2.0").state, GOVERNANCE_STATES.review);
  assert.equal(
    classifyLicense("GPL-3.0-only").state,
    GOVERNANCE_STATES.block,
  );
  assert.equal(classifyLicense("UNKNOWN").state, GOVERNANCE_STATES.block);
  assert.equal(
    classifyLicense("MIT OR GPL-3.0-only").state,
    GOVERNANCE_STATES.review,
  );
});

test("license matrix gates production packages and reports development scope separately", () => {
  const result = evaluateLicenseMatrix([
    packageRow("allowed", "1.0.0", "MIT"),
    packageRow("review", "1.0.0", "MPL-2.0"),
    packageRow("dev-only", "1.0.0", "UNKNOWN", "development"),
  ]);
  assert.equal(result.state, GOVERNANCE_STATES.review);
  assert.equal(result.totalInstalled, 3);
  assert.equal(result.totalGated, 2);
  assert.equal(result.counts.BLOCK, 0);
});

test("exceptions require exact package, selector, owner, reason and future expiry", () => {
  const nowMs = Date.parse("2026-08-09T00:00:00.000Z");
  assert.equal(
    validateGovernanceExceptions({ exceptions: [futureException] }, nowMs)
      .length,
    1,
  );
  assert.throws(
    () =>
      validateGovernanceExceptions(
        { exceptions: [{ ...futureException, expiresAt: "2026-01-01" }] },
        nowMs,
      ),
    (error) =>
      error instanceof GovernanceError &&
      error.code === "GOVERNANCE_EXCEPTION_EXPIRED",
  );
  const result = evaluateLicenseMatrix(
    [packageRow("blocked", "1.0.0", "GPL-3.0-only")],
    { exceptions: { exceptions: [futureException] }, nowMs },
  );
  assert.equal(result.state, GOVERNANCE_STATES.pass);
  assert.equal(result.entries[0].state, GOVERNANCE_STATES.exception);
});

test("CycloneDX validation detects complete coverage and dangling references", () => {
  const packages = [packageRow("a", "1.0.0", "MIT")];
  assert.equal(
    validateCycloneDxSbom(sbomFor(packages), packages).state,
    GOVERNANCE_STATES.pass,
  );
  assert.equal(
    validateCycloneDxSbom(sbomFor([]), packages).state,
    GOVERNANCE_STATES.block,
  );
  const dangling = sbomFor(packages);
  dangling.dependencies[0].dependsOn.push("missing@1.0.0");
  const danglingResult = validateCycloneDxSbom(dangling, packages);
  assert.equal(danglingResult.state, GOVERNANCE_STATES.block);
  assert.deepEqual(danglingResult.danglingReferences, ["missing@1.0.0"]);
});

test("npm audit policy blocks high and critical, reviews moderate and passes zero findings", () => {
  assert.equal(evaluateNpmAudit(audit()).state, GOVERNANCE_STATES.pass);
  assert.equal(
    evaluateNpmAudit(
      audit({ moderate: { severity: "moderate", range: "<2", via: [123] } }),
    ).state,
    GOVERNANCE_STATES.review,
  );
  assert.equal(
    evaluateNpmAudit(
      audit({ high: { severity: "high", range: "<2", via: [456] } }),
    ).state,
    GOVERNANCE_STATES.block,
  );
});

test("vulnerability exception must exactly match package range and advisory selector", () => {
  const nowMs = Date.parse("2026-08-09T00:00:00.000Z");
  const report = audit({
    vulnerable: {
      severity: "high",
      range: "<2.0.0",
      via: [{ source: 999 }],
    },
  });
  const exception = {
    id: "vulnerability-exception",
    kind: "vulnerability",
    packageName: "vulnerable",
    packageVersion: "<2.0.0",
    selector: "999",
    owner: "security-owner",
    reason: "Temporary mitigation is documented",
    expiresAt: "2027-01-01T00:00:00.000Z",
  };
  const result = evaluateNpmAudit(report, {
    exceptions: { exceptions: [exception] },
    nowMs,
  });
  assert.equal(result.state, GOVERNANCE_STATES.pass);
  assert.equal(result.entries[0].state, GOVERNANCE_STATES.exception);
});

test("notices are deterministic, complete and reject secrets or absolute paths", () => {
  const packages = [
    packageRow("b", "1.0.0", "MIT"),
    packageRow("a", "1.0.0", "Apache-2.0"),
  ];
  const first = renderThirdPartyNotices(packages);
  const second = renderThirdPartyNotices([...packages].reverse());
  assert.equal(first, second);
  assert.equal(
    validateGeneratedNotices(first, packages).state,
    GOVERNANCE_STATES.pass,
  );
  assert.equal(
    validateGeneratedNotices(`${first}\n/home/runner/private`, packages).state,
    GOVERNANCE_STATES.block,
  );
  assert.equal(
    validateGeneratedNotices(`${first}\nghp_abcdefghijklmnop`, packages).state,
    GOVERNANCE_STATES.block,
  );
});

test("combined summary blocks release only for blockers while retaining review items", () => {
  const packages = [
    packageRow("allowed", "1.0.0", "MIT"),
    packageRow("review", "1.0.0", "MPL-2.0"),
  ];
  const summary = buildGovernanceSummary({
    packages,
    notices: renderThirdPartyNotices(packages),
    sbom: sbomFor(packages),
    audit: audit(),
    auditExitCode: 0,
    exceptions: { exceptions: [] },
    nowMs: Date.parse("2026-08-09T00:00:00.000Z"),
  });
  assert.equal(summary.state, GOVERNANCE_STATES.pass);
  assert.deepEqual(summary.blockers, []);
  assert.deepEqual(summary.reviews, ["LICENSE_REVIEW"]);
});
