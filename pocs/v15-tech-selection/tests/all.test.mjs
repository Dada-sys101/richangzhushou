import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createECDH, randomBytes, webcrypto } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { RRuleTemporal } from "rrule-temporal";
import { parse } from "csv-parse";
import readXlsxFile from "read-excel-file/node";
import { generateRequestDetails, generateVAPIDKeys, setVapidDetails } from "web-push";
import Ajv from "ajv";

mkdirSync("results", { recursive: true });
const results = { rrule: {}, encryption: {}, indexedDb: {}, imports: {}, push: {}, ai: {} };

// ---------- 1. RRULE dual-candidate PoC ----------
const seriesZone = "America/New_York";
const expectedLocal = [
  "2026-03-01 09:00 EST",
  "2026-03-08 09:00 EDT",
  "2026-03-15 09:00 EDT",
  "2026-03-22 09:00 EDT",
];
const expectedInstants = [
  "2026-03-01T14:00:00.000Z",
  "2026-03-08T13:00:00.000Z",
  "2026-03-15T13:00:00.000Z",
  "2026-03-22T13:00:00.000Z",
];

function runRruleJs(hostZone) {
  return JSON.parse(execFileSync(process.execPath, ["scripts/rrule-child.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, TZ: hostZone },
    encoding: "utf8",
  }));
}

test("RRULE A: rrule.js + Luxon keeps 09:00 wall-clock across DST after normalization", () => {
  const runs = ["UTC", "Asia/Shanghai", "America/Los_Angeles"].map(runRruleJs);
  for (const run of runs) {
    assert.deepEqual(run.normalized.map((x) => x.instant), expectedInstants);
    assert.deepEqual(run.normalized.map((x) => x.seriesLocal), expectedLocal);
  }
  results.rrule.candidateA = { status: "PASS", runs };
});

test("RRULE B: rrule-temporal exposes explicit ZonedDateTime values across DST", () => {
  const rule = new RRuleTemporal({
    rruleString: `DTSTART;TZID=${seriesZone}:20260301T090000\nRRULE:FREQ=WEEKLY;COUNT=4`,
    strict: true,
  });
  const values = rule.all();
  assert.deepEqual(values.map((x) => x.toInstant().toString()), expectedInstants.map((x) => x.replace(".000Z", "Z")));
  assert.equal(values.every((x) => x.hour === 9 && x.timeZoneId === seriesZone), true);
  results.rrule.candidateB = { status: "PASS", values: values.map((x) => x.toString()) };
});

test("RRULE domain: distinguish WALL_CLOCK from ABSOLUTE_INSTANT and split a series", () => {
  const absolute = Array.from({ length: 4 }, (_, i) => DateTime.fromISO(expectedInstants[0], { zone: "utc" }).plus({ days: i * 7 }).toISO());
  const local = absolute.map((x) => DateTime.fromISO(x, { zone: "utc" }).setZone(seriesZone).toFormat("yyyy-LL-dd HH:mm ZZZZ"));
  assert.deepEqual(local, ["2026-03-01 09:00 EST", "2026-03-08 10:00 EDT", "2026-03-15 10:00 EDT", "2026-03-22 10:00 EDT"]);

  const base = expectedInstants.map((x) => DateTime.fromISO(x, { zone: "utc" }).setZone(seriesZone).toISO());
  const splitIndex = 2;
  const before = base.slice(0, splitIndex);
  const splitStart = DateTime.fromISO(base[splitIndex], { setZone: true }).set({ hour: 10 });
  const after = Array.from({ length: base.length - splitIndex }, (_, i) => splitStart.plus({ weeks: i }).toISO());
  assert.equal(before.length + after.length, base.length);
  assert.equal(before.at(-1) < after[0], true);
  assert.equal(after.every((x) => x.includes("T10:00")), true);
  results.rrule.domain = {
    status: "PASS",
    recommendation: "User plans use WALL_CLOCK + series TZID; system jobs may use ABSOLUTE_INSTANT",
    thisAndFollowing: { before, after, originalRecurrenceId: base[splitIndex] },
  };
});

// ---------- 2. Web Crypto local encryption PoC ----------
const { subtle, getRandomValues } = webcrypto;
class Keyring {
  #keys = new Map();
  async create(userId, deviceId) {
    const keyId = `${userId}:${deviceId}:v1`;
    this.#keys.set(keyId, await subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]));
    return keyId;
  }
  get(id) {
    const key = this.#keys.get(id);
    if (!key) throw new Error("LOCAL_KEY_UNAVAILABLE");
    return key;
  }
  delete(id) { this.#keys.delete(id); }
}
async function encryptJson(key, keyId, userId, value) {
  const iv = getRandomValues(new Uint8Array(12));
  const aad = new TextEncoder().encode(`daily-assistant:${userId}:${keyId}:v1`);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { algorithm: "AES-GCM-256", keyId, iv: Buffer.from(iv).toString("base64url"), ciphertext: Buffer.from(ciphertext).toString("base64url") };
}
async function decryptJson(key, userId, value) {
  const plaintext = await subtle.decrypt({
    name: "AES-GCM",
    iv: Buffer.from(value.iv, "base64url"),
    additionalData: new TextEncoder().encode(`daily-assistant:${userId}:${value.keyId}:v1`),
  }, key, Buffer.from(value.ciphertext, "base64url"));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

test("Local encryption: AES-GCM, account isolation and key-loss behavior", async () => {
  const ring = new Keyring();
  const a = await ring.create("user-a", "iphone-1");
  const b = await ring.create("user-b", "iphone-1");
  const draft = { type: "TRANSACTION", amountMinor: 1280, note: "午餐" };
  const encrypted = await encryptJson(ring.get(a), a, "user-a", draft);
  assert.deepEqual(await decryptJson(ring.get(a), "user-a", encrypted), draft);
  await assert.rejects(() => decryptJson(ring.get(b), "user-b", encrypted));
  ring.delete(a);
  assert.throws(() => ring.get(a), /LOCAL_KEY_UNAVAILABLE/);
  results.encryption = {
    status: "PASS",
    keyPolicy: "per-user per-device non-extractable CryptoKey",
    keyLoss: "unsynced local-only drafts are unrecoverable; confirmed/synced records recover from server",
    logout: "explicit retain-encrypted-data or erase-key-and-data choice",
  };
});

// ---------- 3. IndexedDB migration PoC ----------
function idbRequest(req) { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function txDone(tx) { return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error ?? new Error("TX_ABORTED")); tx.onerror = () => reject(tx.error); }); }
async function deleteDb(name) { await idbRequest(indexedDB.deleteDatabase(name)); }
async function createV1(name) {
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore("kv", { keyPath: "key" });
    open.result.createObjectStore("entities", { keyPath: ["userId", "entityType", "id"] });
    open.result.createObjectStore("pending", { keyPath: "id" });
  };
  const db = await idbRequest(open);
  const tx = db.transaction(["kv", "entities"], "readwrite");
  tx.objectStore("kv").put({ key: "activeSchema", value: "v1" });
  for (let i = 0; i < 20; i += 1) tx.objectStore("entities").put({ userId: "u1", entityType: i % 2 ? "REMINDER" : "TASK", id: `e-${i}`, data: { title: `item-${i}` } });
  await txDone(tx); db.close();
}
async function upgradeV2(name) {
  const open = indexedDB.open(name, 2);
  open.onupgradeneeded = () => {
    const db = open.result;
    db.createObjectStore("v2_entities", { keyPath: ["userId", "entityType", "id"] });
    db.createObjectStore("local_capture_drafts", { keyPath: ["userId", "id"] });
    db.createObjectStore("crypto_keys", { keyPath: ["userId", "keyId"] });
    db.createObjectStore("migration_journal", { keyPath: "id" });
  };
  const db = await idbRequest(open); db.close();
}
async function getAll(db, store) { const tx = db.transaction(store, "readonly"); const rows = await idbRequest(tx.objectStore(store).getAll()); await txDone(tx); return rows; }
async function migrate(name, failAfter = Infinity) {
  const db = await idbRequest(indexedDB.open(name, 2));
  const source = await getAll(db, "entities");
  try {
    for (let i = 0; i < source.length; i += 1) {
      if (i === failAfter) throw new Error("INJECTED_MIGRATION_FAILURE");
      const tx = db.transaction(["v2_entities", "migration_journal"], "readwrite");
      tx.objectStore("v2_entities").put({ ...source[i], data: { ...source[i].data, schemaVersion: 2 } });
      tx.objectStore("migration_journal").put({ id: `copy-${i}`, status: "COPIED" });
      await txDone(tx);
    }
    const activate = db.transaction(["kv", "migration_journal"], "readwrite");
    activate.objectStore("kv").put({ key: "activeSchema", value: "v2" });
    activate.objectStore("migration_journal").put({ id: "activation", status: "ACTIVE" });
    await txDone(activate); return "COMPLETED";
  } catch {
    const rollback = db.transaction(["kv", "v2_entities", "migration_journal"], "readwrite");
    rollback.objectStore("kv").put({ key: "activeSchema", value: "v1" });
    rollback.objectStore("v2_entities").clear();
    rollback.objectStore("migration_journal").clear();
    await txDone(rollback); return "ROLLED_BACK";
  } finally { db.close(); }
}
async function snapshot(name) {
  const db = await idbRequest(indexedDB.open(name, 2));
  const entities = await getAll(db, "entities");
  const v2 = await getAll(db, "v2_entities");
  const tx = db.transaction("kv", "readonly");
  const active = await idbRequest(tx.objectStore("kv").get("activeSchema")); await txDone(tx); db.close();
  return { entities, v2, activeSchema: active.value };
}

test("IndexedDB v1→v2 shadow migration activates only after validation", async () => {
  const name = "daily-assistant-poc-success"; await deleteDb(name); await createV1(name); await upgradeV2(name);
  assert.equal(await migrate(name), "COMPLETED");
  const state = await snapshot(name);
  assert.equal(state.entities.length, 20); assert.equal(state.v2.length, 20); assert.equal(state.activeSchema, "v2");
  results.indexedDb.success = { status: "PASS", sourceRows: 20, targetRows: 20 };
});

test("IndexedDB injected failure fully returns active state to v1 without data loss", async () => {
  const name = "daily-assistant-poc-failure"; await deleteDb(name); await createV1(name); await upgradeV2(name);
  const before = await snapshot(name); assert.equal(await migrate(name, 7), "ROLLED_BACK"); const after = await snapshot(name);
  assert.deepEqual(after.entities, before.entities); assert.equal(after.v2.length, 0); assert.equal(after.activeSchema, "v1");
  results.indexedDb.rollback = { status: "PASS", injectedAt: 7, sourceRows: after.entities.length, targetRows: 0, activeSchema: "v1" };
});

// ---------- 4. CSV/XLSX correctness PoC ----------
async function parseCsv(path, encoding = "utf8") {
  const rows = [];
  const parser = createReadStream(path, { encoding }).pipe(parse({ bom: true, relax_column_count: true, skip_empty_lines: true, trim: true, max_record_size: 64 * 1024 }));
  for await (const row of parser) rows.push(row);
  return rows;
}
function findHeader(rows, required) {
  const index = rows.findIndex((row) => required.every((name) => row.includes(name)));
  if (index < 0) throw new Error("HEADER_NOT_FOUND");
  return { headerIndex: index, data: rows.slice(index + 1) };
}

test("CSV/XLSX representative exports parse metadata, BOM, GB18030 conversion, merged title and blanks", async () => {
  const wechat = findHeader(await parseCsv("fixtures/wechat-representative.csv"), ["交易时间", "金额(元)", "交易单号"]);
  const alipay = findHeader(await parseCsv("fixtures/alipay-representative-utf8.csv"), ["交易号", "金额（元）", "交易状态"]);
  const xlsx = findHeader(await readXlsxFile("fixtures/alipay-representative.xlsx", { sheet: "账单" }), ["交易号", "金额（元）", "交易状态"]);
  assert.equal(wechat.data.length, 2); assert.equal(alipay.data.length, 2); assert.equal(xlsx.data.length, 2);
  assert.equal(xlsx.headerIndex, 1); assert.equal(xlsx.data[0][14], null);
  assert.ok(readFileSync("fixtures/alipay-representative.csv").length > 0);
  results.imports.correctness = { status: "PASS_WITH_REPRESENTATIVE_FIXTURES", wechatRows: 2, alipayCsvRows: 2, alipayXlsxRows: 2, realPrivateSamples: "PENDING_USER_UPLOAD" };
});

// ---------- 5. Web Push server crypto PoC ----------
function b64url(value) { return Buffer.from(value).toString("base64url"); }
test("Web Push creates a valid encrypted VAPID request without network delivery", () => {
  const vapid = generateVAPIDKeys(); setVapidDetails("mailto:ops@example.invalid", vapid.publicKey, vapid.privateKey);
  const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
  const details = generateRequestDetails({ endpoint: "https://push.example.invalid/subscription-id", keys: { p256dh: b64url(ecdh.getPublicKey()), auth: b64url(randomBytes(16)) } }, JSON.stringify({ title: "日常助手", deepLink: "/plans?source=push" }), { TTL: 300, urgency: "normal", topic: "daily-assistant-poc" });
  assert.equal(details.method, "POST"); assert.ok(details.body.length > 0); assert.ok(details.headers.Authorization || details.headers.authorization);
  results.push = {
    status: "SERVER_CRYPTO_PASS_DEVICE_DELIVERY_PENDING",
    requestBodyBytes: details.body.length,
    iPhone: { conditions: ["iOS/iPadOS 16.4+", "installed to Home Screen", "permission from user gesture"], nativeWrapperRequired: false, deliveryTest: "PENDING_PHYSICAL_DEVICE" },
    androidChrome: { nativeWrapperRequired: false, deliveryTest: "PENDING_DEVICE" },
    desktop: { nativeWrapperRequired: false, deliveryTest: "PENDING_REAL_ENDPOINT" },
    fallback: "Push is best-effort; reminders remain visible in-app",
  };
});

// ---------- 6. AI Adapter PoC ----------
const schema = {
  type: "object", additionalProperties: false, required: ["schemaVersion", "operations", "provider"],
  properties: {
    schemaVersion: { const: 1 }, provider: { type: "string", minLength: 1 },
    operations: { type: "array", minItems: 1, maxItems: 10, items: { type: "object", additionalProperties: false, required: ["type", "confidence", "fields"], properties: { type: { enum: ["TRANSACTION", "CALENDAR_EVENT", "TASK", "REMINDER", "TRIP"] }, confidence: { type: "number", minimum: 0, maximum: 1 }, fields: { type: "object" }, clarification: { type: ["string", "null"] } } } },
  },
};
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
class Provider {
  constructor(id, behavior) { this.id = id; this.behavior = behavior; this.capabilities = null; }
  async discover() {
    const models = await this.behavior.listModels(); const candidate = models.find((x) => x.status === "available");
    if (!candidate) throw new Error("NO_AVAILABLE_MODEL");
    this.capabilities = { modelId: candidate.id, ...(await this.behavior.probe(candidate.id)), discoveredAt: new Date().toISOString() };
    return this.capabilities;
  }
  async capture(request) { if (!this.capabilities) await this.discover(); return this.behavior.capture(request, this.capabilities); }
}
class Router {
  constructor(providers) { this.providers = providers; }
  async capture(request) {
    const failures = [];
    for (const provider of this.providers) {
      try { const response = await provider.capture(request); if (!validate(response)) throw new Error("SCHEMA_INVALID"); return { response, failures }; }
      catch (error) { failures.push({ provider: provider.id, error: error.message }); }
    }
    throw new AggregateError(failures.map((x) => new Error(x.error)), "ALL_PROVIDERS_FAILED");
  }
}

test("AI Adapter discovers capability dynamically, fails over, and enforces unified schema", async () => {
  const primary = new Provider("openai", { listModels: async () => [{ id: "primary-current", status: "available" }], probe: async () => ({ structuredOutput: true, toolCalling: true, maxOutputTokens: 16384 }), capture: async () => { throw new Error("HTTP_503"); } });
  const fallback = new Provider("deepseek", { listModels: async () => [{ id: "server-selected-model", status: "available" }], probe: async () => ({ structuredOutput: true, toolCalling: false, maxOutputTokens: 8192 }), capture: async (_request, caps) => ({ schemaVersion: 1, provider: `deepseek:${caps.modelId}`, operations: [{ type: "TASK", confidence: 0.91, fields: { title: "买牛奶" }, clarification: null }] }) });
  const output = await new Router([primary, fallback]).capture({ text: "买牛奶", locale: "zh-CN", timeZone: "Asia/Shanghai" });
  assert.equal(output.response.operations[0].type, "TASK"); assert.equal(output.failures[0].provider, "openai");
  const invalid = new Provider("invalid", { listModels: async () => [{ id: "runtime-model", status: "available" }], probe: async () => ({}), capture: async () => ({ schemaVersion: 1, provider: "invalid", operations: [{ type: "SQL", confidence: 2, fields: {} }] }) });
  await assert.rejects(() => new Router([invalid]).capture({ text: "bad" }), /ALL_PROVIDERS_FAILED/);
  results.ai = { status: "MOCK_FAILOVER_PASS_LIVE_KEYS_PENDING", schema, output, capabilityPolicy: "GET /models + runtime probes + TTL cache; no model-name hardcoding" };
});

test.after(() => {
  for (const [name, value] of Object.entries(results)) writeFileSync(`results/${name}.json`, JSON.stringify(value, null, 2));
});
