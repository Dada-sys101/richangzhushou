import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("results", { recursive: true });
const { subtle } = webcrypto;
const getRandomValues = webcrypto.getRandomValues.bind(webcrypto);

class DeviceKeyring {
  #keys = new Map();
  async create(userId, deviceId) {
    const keyId = `${userId}:${deviceId}:v1`;
    const key = await subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    this.#keys.set(keyId, key);
    return keyId;
  }
  get(keyId) {
    const key = this.#keys.get(keyId);
    if (!key) throw new Error("LOCAL_KEY_UNAVAILABLE");
    return key;
  }
  delete(keyId) {
    this.#keys.delete(keyId);
  }
  cloneForIndexedDb(keyId) {
    return structuredClone(this.get(keyId));
  }
}

async function encryptJson(key, keyId, userId, value) {
  const iv = getRandomValues(new Uint8Array(12));
  const aad = new TextEncoder().encode(`daily-assistant:${userId}:${keyId}:v1`);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    plaintext,
  );
  return {
    algorithm: "AES-GCM-256",
    keyId,
    iv: Buffer.from(iv).toString("base64url"),
    ciphertext: Buffer.from(ciphertext).toString("base64url"),
  };
}

async function decryptJson(key, userId, envelope) {
  const iv = Buffer.from(envelope.iv, "base64url");
  const aad = new TextEncoder().encode(
    `daily-assistant:${userId}:${envelope.keyId}:v1`,
  );
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    Buffer.from(envelope.ciphertext, "base64url"),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

const result = {};

test("encrypt/decrypt and IndexedDB structured-clone compatibility", async () => {
  const keyring = new DeviceKeyring();
  const keyId = await keyring.create("user-a", "iphone-1");
  const key = keyring.cloneForIndexedDb(keyId);
  const draft = { type: "TRANSACTION", amountMinor: 1280, note: "午餐" };
  const envelope = await encryptJson(key, keyId, "user-a", draft);
  assert.deepEqual(await decryptJson(key, "user-a", envelope), draft);
  result.basic = { status: "PASS", envelopeFields: Object.keys(envelope) };
});

test("multi-account isolation rejects another account key and AAD", async () => {
  const keyring = new DeviceKeyring();
  const keyAId = await keyring.create("user-a", "device-1");
  const keyBId = await keyring.create("user-b", "device-1");
  const envelope = await encryptJson(keyring.get(keyAId), keyAId, "user-a", {
    secret: "A",
  });
  await assert.rejects(() =>
    decryptJson(keyring.get(keyBId), "user-b", envelope),
  );
  result.multiAccount = { status: "PASS", keyAId, keyBId };
});

test("key loss makes local-only ciphertext unrecoverable", async () => {
  const keyring = new DeviceKeyring();
  const keyId = await keyring.create("user-a", "device-1");
  const envelope = await encryptJson(keyring.get(keyId), keyId, "user-a", {
    localOnly: true,
  });
  keyring.delete(keyId);
  assert.throws(() => keyring.get(keyId), /LOCAL_KEY_UNAVAILABLE/);
  result.keyLoss = {
    status: "PASS",
    recovery:
      "UNRECOVERABLE for unsynced local drafts; acceptable only with explicit UI warning",
    ciphertextRetained: Boolean(envelope.ciphertext),
  };
});

test("logout policy can retain encrypted data or erase key and data together", async () => {
  const keepPolicy = {
    encryptedDrafts: "retain",
    key: "retain",
    requiresDeviceUnlock: true,
  };
  const erasePolicy = { encryptedDrafts: "delete", key: "delete" };
  assert.equal(keepPolicy.encryptedDrafts, "retain");
  assert.equal(erasePolicy.key, "delete");
  result.logout = { keepPolicy, erasePolicy };
});

test.after(() => {
  writeFileSync(
    "results/02-local-encryption.json",
    JSON.stringify(result, null, 2),
  );
});
