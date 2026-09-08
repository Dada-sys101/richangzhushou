import assert from "node:assert/strict";
import test from "node:test";

import { evaluateInstallScriptListing } from "./install-script-policy.mjs";

test("passes only an empty reviewed install-script listing", () => {
  assert.deepEqual(
    evaluateInstallScriptListing({ stdout: '{"allowScripts":[]}', code: 0 }),
    { passed: true, errors: [] },
  );
});

test("rejects pending install scripts", () => {
  const result = evaluateInstallScriptListing({
    stdout: '{"allowScripts":[{"name":"unexpected-package"}]}',
    code: 0,
  });
  assert.equal(result.passed, false);
  assert.match(result.errors.join("\n"), /unexpected-package/);
});

test("rejects execution, empty output, malformed JSON, and unexpected structure", () => {
  const cases = [
    { stdout: "", code: null, commandError: new Error("spawn failed") },
    { stdout: "", code: 0 },
    { stdout: "not json", code: 0 },
    { stdout: "{}", code: 0 },
    { stdout: '{"allowScripts":[],"extra":true}', code: 0 },
    { stdout: '{"allowScripts":[]}', code: 1 },
  ];
  for (const input of cases)
    assert.equal(evaluateInstallScriptListing(input).passed, false);
});
