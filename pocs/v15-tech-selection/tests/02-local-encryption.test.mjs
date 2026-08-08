import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { indexedDB } from "fake-indexeddb";

import {
  IndexedDbLocalVault,
  assertSupportedDeviceKey,
  buildKeyId,
  decryptJson,
} from "../lib/local-crypto.mjs";

mkdirSync("results", { recursive: true });

const result = {
  algorithm: "AES-256-GCM",
  keyStorage: "non-extractable CryptoKey stored by IndexedDB structured clone",
  scope: "local drafts and cache only",
};

function databaseName(testName) {
  return `daily-assistant-local-crypto-${testName}-${crypto.randomUUID()}`;
}

function createVault(name) {
  return new IndexedDbLocalVault({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
  });
}

function mutateBase64Url(value) {
  const firstCharacter = value.at(0);
  return `${firstCharacter === "A" ? "B" : "A"}${value.slice(1)}`;
}

test("non-extractable AES key survives IndexedDB close and reopen", async () => {
  const name = databaseName("persistent-key");
  const firstVault = createVault(name);
  const keyId = buildKeyId("user-a", "iphone-1");
  const draft = {
    type: "TRANSACTION",
    amountMinor: 1280,
    note: "午餐",
  };

  await firstVault.encryptRecord({
    userId: "user-a",
    deviceId: "iphone-1",
    recordType: "DRAFT_RECORD",
    recordId: "draft-1",
    value: draft,
  });
  const firstKeyRow = await firstVault.getKeyRow(keyId);
  assertSupportedDeviceKey(firstKeyRow.key);
  await assert.rejects(
    () => webcrypto.subtle.exportKey("raw", firstKeyRow.key),
    /extractable|InvalidAccessException/u,
  );
  await firstVault.close();

  const reopenedVault = createVault(name);
  const reopenedKeyRow = await reopenedVault.getKeyRow(keyId);
  assertSupportedDeviceKey(reopenedKeyRow.key);
  assert.deepEqual(
    await reopenedVault.decryptRecord("user-a", "DRAFT_RECORD", "draft-1"),
    draft,
  );
  await reopenedVault.close();

  result.persistence = {
    status: "PASS",
    keyExtractable: reopenedKeyRow.key.extractable,
    keyUsages: reopenedKeyRow.key.usages,
    survivedDatabaseReopen: true,
  };
});

test("AES-GCM rejects ciphertext and record-identity tampering", async () => {
  const vault = createVault(databaseName("tampering"));
  await vault.encryptRecord({
    userId: "user-a",
    deviceId: "iphone-1",
    recordType: "DRAFT_RECORD",
    recordId: "draft-1",
    value: { secret: "A" },
  });

  const original = await vault.getEnvelope(
    "user-a",
    "DRAFT_RECORD",
    "draft-1",
  );
  const keyRow = await vault.getKeyRow(original.keyId);

  await assert.rejects(() =>
    decryptJson({
      cryptoProvider: webcrypto,
      key: keyRow.key,
      envelope: {
        ...original,
        ciphertext: mutateBase64Url(original.ciphertext),
      },
    }),
  );

  await assert.rejects(() =>
    decryptJson({
      cryptoProvider: webcrypto,
      key: keyRow.key,
      envelope: {
        ...original,
        recordId: "draft-2",
      },
    }),
  );

  result.integrity = {
    status: "PASS",
    ciphertextTamperingRejected: true,
    recordIdentityTamperingRejected: true,
    aadFields: ["userId", "keyId", "recordType", "recordId", "schemeVersion"],
  };
});

test("same device keeps different account keys and ciphertext isolated", async () => {
  const vault = createVault(databaseName("multi-account"));
  await vault.encryptRecord({
    userId: "user-a",
    deviceId: "shared-device",
    recordType: "DRAFT_RECORD",
    recordId: "draft-1",
    value: { owner: "A" },
  });
  await vault.encryptRecord({
    userId: "user-b",
    deviceId: "shared-device",
    recordType: "DRAFT_RECORD",
    recordId: "draft-1",
    value: { owner: "B" },
  });

  const envelopeA = await vault.getEnvelope(
    "user-a",
    "DRAFT_RECORD",
    "draft-1",
  );
  const envelopeB = await vault.getEnvelope(
    "user-b",
    "DRAFT_RECORD",
    "draft-1",
  );
  const keyA = await vault.getKeyRow(envelopeA.keyId);
  const keyB = await vault.getKeyRow(envelopeB.keyId);

  assert.notEqual(keyA.keyId, keyB.keyId);
  assert.deepEqual(
    await vault.decryptRecord("user-a", "DRAFT_RECORD", "draft-1"),
    { owner: "A" },
  );
  assert.deepEqual(
    await vault.decryptRecord("user-b", "DRAFT_RECORD", "draft-1"),
    { owner: "B" },
  );
  await assert.rejects(() =>
    decryptJson({
      cryptoProvider: webcrypto,
      key: keyB.key,
      envelope: envelopeA,
    }),
  );

  result.multiAccount = {
    status: "PASS",
    separateKeyIds: true,
    crossAccountDecryptRejected: true,
  };
});

test("deleting a device key makes unsynced local ciphertext unrecoverable", async () => {
  const vault = createVault(databaseName("key-loss"));
  const envelope = await vault.encryptRecord({
    userId: "user-a",
    deviceId: "iphone-1",
    recordType: "DRAFT_RECORD",
    recordId: "draft-unsynced",
    value: { localOnly: true },
  });

  await vault.deleteKey(envelope.keyId);
  assert.equal(await vault.getKeyRow(envelope.keyId), null);
  await assert.rejects(
    () => vault.decryptRecord("user-a", "DRAFT_RECORD", "draft-unsynced"),
    /LOCAL_KEY_UNAVAILABLE/u,
  );
  assert.equal(
    (await vault.getEnvelope("user-a", "DRAFT_RECORD", "draft-unsynced"))
      .ciphertext,
    envelope.ciphertext,
  );

  result.keyLoss = {
    status: "PASS",
    recovery: "UNRECOVERABLE_WITHOUT_A_SEPARATE_WRAPPED_OR_SERVER_KEY",
    acceptableFor: ["server-synced cache", "explicitly disposable local cache"],
    unacceptableFor: ["the only copy of an unsynced user draft"],
    requiredMitigations: [
      "show a clear warning for unsynced encrypted drafts",
      "sync as soon as connectivity is restored",
      "offer export or recovery-key wrapping before high-value local-only use",
    ],
  };
});

test("explicit logout erases only the active account key and encrypted records", async () => {
  const vault = createVault(databaseName("logout"));
  for (const userId of ["user-a", "user-b"]) {
    await vault.encryptRecord({
      userId,
      deviceId: "shared-device",
      recordType: "DRAFT_RECORD",
      recordId: "draft-1",
      value: { userId },
    });
  }

  const envelopeA = await vault.getEnvelope(
    "user-a",
    "DRAFT_RECORD",
    "draft-1",
  );
  const envelopeB = await vault.getEnvelope(
    "user-b",
    "DRAFT_RECORD",
    "draft-1",
  );
  await vault.eraseUser("user-a");

  assert.equal(
    await vault.getEnvelope("user-a", "DRAFT_RECORD", "draft-1"),
    null,
  );
  assert.equal(await vault.getKeyRow(envelopeA.keyId), null);
  assert.notEqual(await vault.getKeyRow(envelopeB.keyId), null);
  assert.deepEqual(
    await vault.decryptRecord("user-b", "DRAFT_RECORD", "draft-1"),
    { userId: "user-b" },
  );

  result.explicitLogout = {
    status: "PASS",
    activeAccountData: "ERASED",
    otherAccountData: "RETAINED",
  };
});

test("temporary session loss retains encrypted data for offline mode", async () => {
  const name = databaseName("offline-session");
  const vault = createVault(name);
  await vault.encryptRecord({
    userId: "user-a",
    deviceId: "iphone-1",
    recordType: "DRAFT_RECORD",
    recordId: "draft-1",
    value: { availableOffline: true },
  });
  await vault.close();

  const afterSessionLoss = createVault(name);
  assert.deepEqual(
    await afterSessionLoss.decryptRecord(
      "user-a",
      "DRAFT_RECORD",
      "draft-1",
    ),
    { availableOffline: true },
  );

  result.sessionLoss = {
    status: "PASS",
    policy: "RETAIN_KEY_AND_CIPHERTEXT_FOR_OFFLINE_MODE",
    distinction: "session expiry is not the same as explicit logout",
  };
});

test.after(() => {
  writeFileSync(
    "results/02-local-encryption.json",
    JSON.stringify(result, null, 2),
  );
});
