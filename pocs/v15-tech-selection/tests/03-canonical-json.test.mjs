import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

import {
  canonicalStringify,
  stableJsonSha256,
} from "../lib/canonical-json.mjs";
import { verifyEquivalentJson } from "../lib/indexeddb-migration.mjs";

test("canonical hash ignores top-level and nested object property order", async () => {
  const first = {
    title: "每周提醒",
    configuration: {
      enabled: true,
      schedule: {
        timeZoneId: "Asia/Shanghai",
        hour: 9,
        minute: 30,
      },
    },
    metadata: {
      emoji: "✅",
      note: "中文内容",
    },
  };

  const reordered = {
    metadata: {
      note: "中文内容",
      emoji: "✅",
    },
    configuration: {
      schedule: {
        minute: 30,
        hour: 9,
        timeZoneId: "Asia/Shanghai",
      },
      enabled: true,
    },
    title: "每周提醒",
  };

  assert.equal(canonicalStringify(first), canonicalStringify(reordered));
  assert.equal(
    await stableJsonSha256(first, webcrypto),
    await stableJsonSha256(reordered, webcrypto),
  );
  assert.equal(await verifyEquivalentJson(first, reordered, webcrypto), true);
});

test("canonical hash ignores property order inside array objects but preserves array element order", async () => {
  const first = {
    items: [
      { id: "a", value: 1, nested: { x: true, y: false } },
      { id: "b", value: 2, nested: { x: false, y: true } },
    ],
  };
  const reorderedKeys = {
    items: [
      { nested: { y: false, x: true }, value: 1, id: "a" },
      { value: 2, id: "b", nested: { y: true, x: false } },
    ],
  };
  const reorderedArray = {
    items: [reorderedKeys.items[1], reorderedKeys.items[0]],
  };

  assert.equal(
    await stableJsonSha256(first, webcrypto),
    await stableJsonSha256(reorderedKeys, webcrypto),
  );
  assert.notEqual(
    await stableJsonSha256(first, webcrypto),
    await stableJsonSha256(reorderedArray, webcrypto),
  );
});

test("canonical hash distinguishes missing fields and changed values", async () => {
  const baseline = { a: 1, b: { c: 2 }, d: [1, 2, 3] };
  const missingField = { a: 1, b: {}, d: [1, 2, 3] };
  const changedValue = { a: 1, b: { c: 3 }, d: [1, 2, 3] };

  assert.notEqual(
    await stableJsonSha256(baseline, webcrypto),
    await stableJsonSha256(missingField, webcrypto),
  );
  assert.notEqual(
    await stableJsonSha256(baseline, webcrypto),
    await stableJsonSha256(changedValue, webcrypto),
  );
});

test("canonical hash normalizes negative zero and rejects unsupported JSON values", async () => {
  assert.equal(
    await stableJsonSha256({ value: -0 }, webcrypto),
    await stableJsonSha256({ value: 0 }, webcrypto),
  );

  await assert.rejects(
    () => stableJsonSha256({ value: Number.NaN }, webcrypto),
    /NON_FINITE_NUMBER/u,
  );
  await assert.rejects(
    () => stableJsonSha256({ value: undefined }, webcrypto),
    /UNSUPPORTED_JSON_VALUE/u,
  );
  await assert.rejects(
    () => stableJsonSha256({ value: new Date() }, webcrypto),
    /NON_PLAIN_JSON_OBJECT/u,
  );

  const cyclic = {};
  cyclic.self = cyclic;
  await assert.rejects(
    () => stableJsonSha256(cyclic, webcrypto),
    /CYCLIC_JSON_VALUE/u,
  );
});

test("canonical hash is stable across 100 repeated calculations", async () => {
  const value = {
    z: 3,
    a: [{ y: 2, x: 1 }],
    nested: { beta: "二", alpha: "一" },
  };
  const expected = await stableJsonSha256(value, webcrypto);
  const hashes = await Promise.all(
    Array.from({ length: 100 }, () => stableJsonSha256(value, webcrypto)),
  );
  assert.equal(new Set(hashes).size, 1);
  assert.equal(hashes[0], expected);
});
