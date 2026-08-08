import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { indexedDB } from "fake-indexeddb";

import { decryptJson } from "../lib/local-crypto.mjs";
import {
  DATABASE_VERSION_V2,
  STORES,
  inspectMigrationState,
  migrateV1ToV2,
  openV1Database,
  openV2Database,
  rollbackToV1,
  verifyStoredKey,
} from "../lib/indexeddb-migration.mjs";

mkdirSync("results", { recursive: true });

const result = {
  strategy: "shadow copy + decrypt verification + atomic activeSchema switch",
  sourceRetention: "v1 stores remain intact through migration and rollback",
};

function databaseName(label) {
  return `daily-assistant-indexeddb-${label}-${randomUUID()}`;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("INDEXEDDB_TRANSACTION_ABORTED"));
  });
}

async function deleteDatabase(name) {
  await requestResult(indexedDB.deleteDatabase(name));
}

function createFixture() {
  const entities = Array.from({ length: 12 }, (_, index) => {
    const userId = index < 7 ? "user-a" : "user-b";
    const entityType = ["TASK", "REMINDER", "DRAFT_RECORD", "TRANSACTION"][
      index % 4
    ];
    return {
      userId,
      entityType,
      id: `entity-${index}`,
      data: {
        title: `本地项目-${index}`,
        note: `sensitive-note-${userId}-${index}`,
        amountMinor: index * 125,
        recurrence:
          entityType === "REMINDER"
            ? {
                ruleText: "RRULE:FREQ=WEEKLY;COUNT=4",
                timeMode: "WALL_CLOCK",
                timeZoneId: "Asia/Shanghai",
              }
            : null,
      },
      pending: index % 3 === 0,
      updatedAt: new Date(Date.UTC(2026, 7, index + 1)).toISOString(),
    };
  });

  const pending = Array.from({ length: 4 }, (_, index) => {
    const userId = index < 3 ? "user-a" : "user-b";
    return {
      id: `mutation-${index}`,
      userId,
      entityType: index % 2 === 0 ? "TASK" : "DRAFT_RECORD",
      action: index === 3 ? "UPDATE" : "CREATE",
      entityId: index === 3 ? "entity-8" : null,
      localId: index === 3 ? null : `local-${index}`,
      payload: {
        title: `待同步-${index}`,
        privateValue: `pending-secret-${userId}-${index}`,
      },
      version: index === 3 ? 2 : null,
      status: index === 2 ? "FAILED" : "PENDING",
      errorCode: index === 2 ? "NETWORK_TEMPORARY" : null,
      errorMessage: index === 2 ? "稍后重试" : null,
      current: index === 3 ? { version: 2, title: "server-current" } : null,
      createdAt: 1_786_000_000_000 + index,
    };
  });

  return { entities, pending };
}

async function seedV1(name, fixture = createFixture()) {
  const database = await openV1Database(indexedDB, name);
  const transaction = database.transaction(
    [STORES.kv, STORES.entitiesV1, STORES.pendingV1],
    "readwrite",
  );
  transaction.objectStore(STORES.kv).put({
    key: "activeSchema",
    value: "v1",
  });
  transaction.objectStore(STORES.kv).put({
    key: "cursor:user-a",
    value: "cursor-before-migration",
  });
  const entitiesStore = transaction.objectStore(STORES.entitiesV1);
  for (const entity of fixture.entities) entitiesStore.put(entity);
  const pendingStore = transaction.objectStore(STORES.pendingV1);
  for (const mutation of fixture.pending) pendingStore.put(mutation);
  await transactionComplete(transaction);
  database.close();
  return fixture;
}

function sortEntities(rows) {
  return [...rows].sort((left, right) =>
    `${left.userId}:${left.entityType}:${left.id}`.localeCompare(
      `${right.userId}:${right.entityType}:${right.id}`,
    ),
  );
}

function sortPending(rows) {
  return [...rows].sort((left, right) => left.id.localeCompare(right.id));
}

function assertSourceUnchanged(state, fixture) {
  assert.deepEqual(
    sortEntities(state.sourceEntities),
    sortEntities(fixture.entities),
  );
  assert.deepEqual(
    sortPending(state.sourcePending),
    sortPending(fixture.pending),
  );
}

async function decryptTarget(state, targetRow) {
  const keyRow = state.keys.find(
    (candidate) => candidate.keyId === targetRow.envelope.keyId,
  );
  assert.ok(keyRow, "encrypted row must reference an existing local key");
  return decryptJson({
    cryptoProvider: webcrypto,
    key: keyRow.key,
    envelope: targetRow.envelope,
  });
}

function mutateBase64Url(value) {
  const firstCharacter = value.at(0);
  return `${firstCharacter === "A" ? "B" : "A"}${value.slice(1)}`;
}

async function corruptFirstEncryptedEntity(database) {
  const readTransaction = database.transaction(STORES.entitiesV2, "readonly");
  const rows = await requestResult(
    readTransaction.objectStore(STORES.entitiesV2).getAll(),
  );
  await transactionComplete(readTransaction);
  assert.ok(rows.length > 0);

  const corrupted = {
    ...rows[0],
    envelope: {
      ...rows[0].envelope,
      ciphertext: mutateBase64Url(rows[0].envelope.ciphertext),
    },
  };
  const writeTransaction = database.transaction(STORES.entitiesV2, "readwrite");
  writeTransaction.objectStore(STORES.entitiesV2).put(corrupted);
  await transactionComplete(writeTransaction);
}

async function schemaSnapshot(name) {
  const database = await openV2Database(indexedDB, name);
  try {
    const transaction = database.transaction(
      [
        STORES.entitiesV2,
        STORES.pendingV2,
        STORES.keys,
        STORES.recurrenceSeries,
        STORES.recurrenceExceptions,
      ],
      "readonly",
    );
    const snapshot = {
      version: database.version,
      stores: Array.from(database.objectStoreNames),
      indexes: {
        entitiesV2: Array.from(
          transaction.objectStore(STORES.entitiesV2).indexNames,
        ),
        pendingV2: Array.from(
          transaction.objectStore(STORES.pendingV2).indexNames,
        ),
        keys: Array.from(transaction.objectStore(STORES.keys).indexNames),
        recurrenceSeries: Array.from(
          transaction.objectStore(STORES.recurrenceSeries).indexNames,
        ),
        recurrenceExceptions: Array.from(
          transaction.objectStore(STORES.recurrenceExceptions).indexNames,
        ),
      },
    };
    await transactionComplete(transaction);
    return snapshot;
  } finally {
    database.close();
  }
}

test("v2 schema upgrade creates shadow, key, journal and recurrence stores without activating", async () => {
  const name = databaseName("schema");
  const fixture = await seedV1(name);
  const schema = await schemaSnapshot(name);
  const state = await inspectMigrationState({ indexedDB, databaseName: name });

  assert.equal(schema.version, DATABASE_VERSION_V2);
  for (const storeName of Object.values(STORES)) {
    assert.ok(schema.stores.includes(storeName), `missing store ${storeName}`);
  }
  assert.deepEqual(schema.indexes.entitiesV2.sort(), [
    "keyId",
    "userEntityType",
  ]);
  assert.deepEqual(schema.indexes.pendingV2.sort(), [
    "createdAt",
    "keyId",
    "userId",
  ]);
  assert.deepEqual(schema.indexes.keys, ["userId"]);
  assert.deepEqual(schema.indexes.recurrenceSeries.sort(), [
    "parentSeries",
    "userId",
  ]);
  assert.deepEqual(schema.indexes.recurrenceExceptions, ["series"]);
  assert.equal(state.activeSchema, "v1");
  assert.equal(state.targetEntities.length, 0);
  assert.equal(state.targetPending.length, 0);
  assertSourceUnchanged(state, fixture);

  result.schemaUpgrade = {
    status: "PASS",
    databaseVersion: schema.version,
    storesCreated: schema.stores,
    activeSchema: state.activeSchema,
    sourceRowsPreserved: true,
  };
  await deleteDatabase(name);
});

test("successful migration encrypts entity and pending payloads, isolates accounts and activates atomically", async () => {
  const name = databaseName("success");
  const fixture = await seedV1(name);
  const migration = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-poc",
    batchSize: 3,
  });
  const state = await inspectMigrationState({ indexedDB, databaseName: name });

  assert.deepEqual(migration, {
    status: "COMPLETED",
    recoveredInterruptedMigration: false,
    entityCount: fixture.entities.length,
    pendingCount: fixture.pending.length,
  });
  assert.equal(state.activeSchema, "v2");
  assert.equal(state.journal.status, "ACTIVE");
  assert.equal(state.targetEntities.length, fixture.entities.length);
  assert.equal(state.targetPending.length, fixture.pending.length);
  assertSourceUnchanged(state, fixture);

  assert.equal(state.keys.length, 2);
  assert.equal(new Set(state.keys.map((row) => row.userId)).size, 2);
  assert.equal(new Set(state.keys.map((row) => row.keyId)).size, 2);
  for (const keyRow of state.keys) {
    assert.equal(await verifyStoredKey(keyRow), true);
    assert.equal(keyRow.key.extractable, false);
  }

  const targetEntity = state.targetEntities.find(
    (row) => row.userId === "user-a" && row.id === "entity-0",
  );
  const sourceEntity = fixture.entities.find(
    (row) => row.userId === "user-a" && row.id === "entity-0",
  );
  assert.ok(targetEntity);
  assert.ok(sourceEntity);
  assert.equal("data" in targetEntity, false);
  assert.equal(
    JSON.stringify(targetEntity).includes(sourceEntity.data.note),
    false,
  );
  assert.deepEqual(await decryptTarget(state, targetEntity), {
    data: sourceEntity.data,
  });

  const targetPending = state.targetPending.find(
    (row) => row.id === "mutation-2",
  );
  const sourcePending = fixture.pending.find((row) => row.id === "mutation-2");
  assert.ok(targetPending);
  assert.ok(sourcePending);
  assert.equal("payload" in targetPending, false);
  assert.equal(
    JSON.stringify(targetPending).includes(sourcePending.payload.privateValue),
    false,
  );
  assert.deepEqual(await decryptTarget(state, targetPending), {
    payload: sourcePending.payload,
    errorCode: sourcePending.errorCode,
    errorMessage: sourcePending.errorMessage,
    current: sourcePending.current,
  });

  assert.deepEqual(
    await migrateV1ToV2({
      indexedDB,
      cryptoProvider: webcrypto,
      databaseName: name,
      deviceId: "device-poc",
    }),
    { status: "ALREADY_ACTIVE" },
  );

  result.success = {
    status: "PASS",
    entityCount: state.targetEntities.length,
    pendingCount: state.targetPending.length,
    accountKeys: state.keys.length,
    sourceStoresRetained: true,
    plaintextPayloadAbsentFromV2Rows: true,
    secondRun: "ALREADY_ACTIVE",
  };
  await deleteDatabase(name);
});

test("copy failure clears shadow data and keys while preserving all v1 records", async () => {
  const name = databaseName("copy-failure");
  const fixture = await seedV1(name);
  const migration = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-poc",
    batchSize: 1,
    failAfterCopies: 5,
  });
  const state = await inspectMigrationState({ indexedDB, databaseName: name });

  assert.equal(migration.status, "ROLLED_BACK");
  assert.equal(migration.error, "INJECTED_MIGRATION_FAILURE");
  assert.equal(state.activeSchema, "v1");
  assert.equal(state.journal.status, "ROLLED_BACK");
  assert.equal(state.targetEntities.length, 0);
  assert.equal(state.targetPending.length, 0);
  assert.equal(state.keys.length, 0);
  assertSourceUnchanged(state, fixture);

  result.copyFailureRollback = {
    status: "PASS",
    injectedAfterCopies: 5,
    activeSchema: state.activeSchema,
    shadowRowsAfterRollback: 0,
    keysAfterRollback: 0,
    sourceRowsPreserved: true,
  };
  await deleteDatabase(name);
});

test("ciphertext corruption during verification prevents activation and rolls back", async () => {
  const name = databaseName("verification-failure");
  const fixture = await seedV1(name);
  const migration = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-poc",
    mutateBeforeVerification: corruptFirstEncryptedEntity,
  });
  const state = await inspectMigrationState({ indexedDB, databaseName: name });

  assert.equal(migration.status, "ROLLED_BACK");
  assert.equal(state.activeSchema, "v1");
  assert.equal(state.targetEntities.length, 0);
  assert.equal(state.targetPending.length, 0);
  assert.equal(state.keys.length, 0);
  assertSourceUnchanged(state, fixture);

  result.verificationFailureRollback = {
    status: "PASS",
    corruptionRejected: true,
    activationPrevented: true,
    sourceRowsPreserved: true,
  };
  await deleteDatabase(name);
});

test("interrupted migration is detected, cleaned and successfully retried", async () => {
  const name = databaseName("interrupted");
  const fixture = await seedV1(name);

  await assert.rejects(
    () =>
      migrateV1ToV2({
        indexedDB,
        cryptoProvider: webcrypto,
        databaseName: name,
        deviceId: "device-poc",
        batchSize: 1,
        failAfterCopies: 4,
        leavePartialStateOnFailure: true,
      }),
    /INJECTED_MIGRATION_FAILURE/u,
  );
  const interrupted = await inspectMigrationState({
    indexedDB,
    databaseName: name,
  });
  assert.equal(interrupted.activeSchema, "v1");
  assert.equal(interrupted.journal.status, "COPYING_INTERRUPTED");
  assert.ok(interrupted.targetEntities.length > 0);
  assertSourceUnchanged(interrupted, fixture);

  const retry = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-poc",
    batchSize: 2,
  });
  const recovered = await inspectMigrationState({
    indexedDB,
    databaseName: name,
  });
  assert.equal(retry.status, "COMPLETED");
  assert.equal(retry.recoveredInterruptedMigration, true);
  assert.equal(recovered.activeSchema, "v2");
  assert.equal(recovered.targetEntities.length, fixture.entities.length);
  assert.equal(recovered.targetPending.length, fixture.pending.length);
  assertSourceUnchanged(recovered, fixture);

  result.interruptedRecovery = {
    status: "PASS",
    interruptedShadowRows: interrupted.targetEntities.length,
    recoveredInterruptedMigration: retry.recoveredInterruptedMigration,
    activeSchemaAfterRetry: recovered.activeSchema,
  };
  await deleteDatabase(name);
});

test("post-activation rollback switches the pointer to v1 without deleting either copy", async () => {
  const name = databaseName("post-activation-rollback");
  const fixture = await seedV1(name);
  await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-poc",
  });

  assert.deepEqual(
    await rollbackToV1({
      indexedDB,
      databaseName: name,
      reason: "RELEASE_ROLLBACK_TEST",
    }),
    { status: "ROLLED_BACK_TO_V1" },
  );
  const state = await inspectMigrationState({ indexedDB, databaseName: name });
  assert.equal(state.activeSchema, "v1");
  assert.equal(state.journal.status, "ROLLED_BACK_AFTER_ACTIVATION");
  assert.equal(state.targetEntities.length, fixture.entities.length);
  assert.equal(state.targetPending.length, fixture.pending.length);
  assert.equal(state.keys.length, 2);
  assertSourceUnchanged(state, fixture);

  result.postActivationRollback = {
    status: "PASS",
    activeSchema: state.activeSchema,
    v1RowsRetained: true,
    v2RowsRetainedForDiagnosis: true,
  };
  await deleteDatabase(name);
});

test("an old tab can block schema upgrade until versionchange coordination closes it", async () => {
  const name = databaseName("blocked-upgrade");
  await seedV1(name);

  const legacyConnection = await requestResult(indexedDB.open(name, 1));
  legacyConnection.onversionchange = null;
  let blocked = false;
  let upgradeResolved = false;
  let resolveBlocked;
  const blockedEvent = new Promise((resolve) => {
    resolveBlocked = resolve;
  });
  const upgradePromise = openV2Database(indexedDB, name, {
    onBlocked() {
      blocked = true;
      resolveBlocked();
    },
  }).then((database) => {
    upgradeResolved = true;
    return database;
  });

  await Promise.race([
    blockedEvent,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("BLOCKED_EVENT_NOT_OBSERVED")), 500),
    ),
  ]);
  assert.equal(blocked, true);
  assert.equal(upgradeResolved, false);

  legacyConnection.close();
  const upgradedConnection = await upgradePromise;
  assert.equal(upgradedConnection.version, DATABASE_VERSION_V2);
  upgradedConnection.close();

  result.multiTabCoordination = {
    status: "PASS",
    blockedEventObserved: true,
    upgradeWaitedForOldConnection: true,
    upgradeCompletedAfterClose: true,
  };
  await deleteDatabase(name);
});

test.after(() => {
  writeFileSync(
    "results/03-indexeddb-migration.json",
    JSON.stringify(result, null, 2),
  );
});
