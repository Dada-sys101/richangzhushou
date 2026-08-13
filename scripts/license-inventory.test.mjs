import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventory,
  classifyLicense,
  derivePackageName,
  MANUAL_REVIEW_REQUIRED,
  METADATA_RECORDED,
  serializeInventory,
} from "./license-inventory.mjs";

test("records valid declared license metadata with neutral semantics", () => {
  assert.deepEqual(classifyLicense("MIT"), {
    license: "MIT",
    reviewStatus: METADATA_RECORDED,
    reviewReasons: [],
  });
  assert.equal(classifyLicense("Apache-2.0").reviewStatus, METADATA_RECORDED);
});

test("marks missing, unresolved, non-string, and malformed licenses for manual review", () => {
  assert.equal(classifyLicense(undefined).reviewStatus, MANUAL_REVIEW_REQUIRED);
  assert.equal(classifyLicense(undefined).license, null);

  assert.equal(classifyLicense("").reviewStatus, MANUAL_REVIEW_REQUIRED);
  assert.equal(
    classifyLicense("UNLICENSED").reviewStatus,
    MANUAL_REVIEW_REQUIRED,
  );
  assert.equal(
    classifyLicense("SEE LICENSE IN LICENSE.txt").reviewStatus,
    MANUAL_REVIEW_REQUIRED,
  );
  assert.equal(
    classifyLicense(["MIT", "Apache2"]).reviewStatus,
    MANUAL_REVIEW_REQUIRED,
  );
  assert.equal(classifyLicense("MIT OR").reviewStatus, MANUAL_REVIEW_REQUIRED);
});

test("flags compound and copyleft-family metadata for human policy review", () => {
  for (const license of [
    "MIT OR Apache-2.0",
    "Apache-2.0 WITH LLVM-exception",
    "MPL-2.0",
    "LGPL-2.1-or-later",
    "EPL-2.0",
  ]) {
    const result = classifyLicense(license);
    assert.equal(result.reviewStatus, MANUAL_REVIEW_REQUIRED, license);
    assert.ok(result.reviewReasons.length > 0, license);
  }

  assert.equal(classifyLicense("MIT").reviewStatus, METADATA_RECORDED);
  assert.equal(classifyLicense("Apache-2.0").reviewStatus, METADATA_RECORDED);
});

test("derives nested and scoped package names from package-lock paths", () => {
  assert.equal(
    derivePackageName("node_modules/@angular-devkit/core/node_modules/ajv"),
    "ajv",
  );
  assert.equal(
    derivePackageName("node_modules/@scope/package"),
    "@scope/package",
  );
  assert.equal(
    derivePackageName("node_modules/plain-package"),
    "plain-package",
  );
});

test("produces deterministic sorted output for the same package-lock input", () => {
  const packagesMap = {
    "node_modules/z-last": { version: "1.0.0", license: "MIT" },
    "node_modules/a-first": { version: "2.0.0", license: "Apache-2.0" },
    "node_modules/@scope/package": { version: "3.0.0", license: "MIT" },
  };

  const first = serializeInventory(buildInventory(packagesMap));
  const second = serializeInventory(buildInventory(packagesMap));
  assert.equal(first, second);

  const inventory = JSON.parse(first);
  assert.deepEqual(
    inventory.packages.map((entry) => entry.package),
    ["@scope/package", "a-first", "z-last"],
  );
});

test("output contains no automatic approval or legal-approval phrases", () => {
  const inventory = buildInventory({
    "node_modules/a": { version: "1.0.0", license: "MIT" },
    "node_modules/b": { version: "1.0.0", license: "UNLICENSED" },
  });
  const output = serializeInventory(inventory);

  assert.doesNotMatch(output, /APPROVED/i);
  assert.doesNotMatch(output, /LEGAL_APPROVED/i);
  assert.doesNotMatch(output, /AUTO[- ]APPROVAL/i);
});

test("summary distinguishes missing/unresolved metadata from manual review", () => {
  const inventory = buildInventory({
    "node_modules/a": { version: "1.0.0", license: "MIT" },
    "node_modules/b": { version: "1.0.0", license: "MIT OR" },
    "node_modules/c": { version: "1.0.0", license: undefined },
  });

  assert.equal(inventory.summary.packageCount, 3);
  assert.equal(inventory.summary.missingOrUnresolvedCount, 1);
  assert.equal(inventory.summary.manualReviewCount, 2);
  assert.equal(inventory.summary.uniqueLicenseExpressionCount, 2);
});
