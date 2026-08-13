import assert from "node:assert/strict";
import test from "node:test";

import { validateSbomDocument } from "./sbom-validate.mjs";
import { buildSbomChildEnvironment } from "./sbom-generate.mjs";

test("SBOM child environment excludes credentials and npm auth configuration", () => {
  const environment = buildSbomChildEnvironment({
    PATH: "/tools",
    TEMP: "/tmp",
    GITHUB_TOKEN: "secret",
    NODE_AUTH_TOKEN: "secret",
    NPM_CONFIG_USERCONFIG: "/secret/npmrc",
    PR6A_MYSQL_ADMIN_URL: "mysql://secret",
  });

  assert.deepEqual(environment, {
    PATH: "/tools",
    TEMP: "/tmp",
    NO_COLOR: "1",
  });
});

test("accepts a valid CycloneDX document with non-empty components", () => {
  const result = validateSbomDocument(
    JSON.stringify({
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      components: [{ type: "library", name: "example" }],
    }),
  );

  assert.equal(result.valid, true);
  assert.equal(result.componentCount, 1);
  assert.deepEqual(result.errors, []);
});

test("rejects empty input", () => {
  const result = validateSbomDocument("");
  assert.equal(result.valid, false);
  assert.equal(result.componentCount, 0);
  assert.ok(result.errors.length > 0);
});

test("rejects malformed JSON", () => {
  const result = validateSbomDocument("{not-json");
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /not valid JSON/);
});

test("rejects a document with the wrong bom format", () => {
  const result = validateSbomDocument(
    JSON.stringify({
      bomFormat: "SPDX",
      specVersion: "2.3",
      components: [{ type: "library", name: "example" }],
    }),
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("bomFormat")));
});

test("rejects a document without a specVersion or schema marker", () => {
  const result = validateSbomDocument(
    JSON.stringify({
      bomFormat: "CycloneDX",
      components: [{ type: "library", name: "example" }],
    }),
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("specVersion")));
});

test("rejects missing or empty components arrays", () => {
  const missing = validateSbomDocument(
    JSON.stringify({ bomFormat: "CycloneDX", specVersion: "1.6" }),
  );
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((error) => error.includes("components")));

  const empty = validateSbomDocument(
    JSON.stringify({
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      components: [],
    }),
  );
  assert.equal(empty.valid, false);
  assert.equal(empty.componentCount, 0);
  assert.ok(empty.errors.some((error) => error.includes("not be empty")));
});
