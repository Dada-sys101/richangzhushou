import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import { indexedDB } from "fake-indexeddb";

import {
  MIGRATION_PHASES,
  STORES,
  inspectMigrationState,
  migrateV1ToV2,
  openV1Database,
} from "../lib/indexeddb-migration.mjs";

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
      reject(transaction.error ?? new DOMException("Aborted", "AbortError"));
  });
}

function databaseName(label) {
  return `stage3-fault-${label}-${randomUUID()}`;
}

function fixture() {
  return {
    entities: Array.from({ length: 8 }, (_, index) => ({
      userId: index < 5 ? "user-a" : "user-b",
      entityType: index % 2 === 0 ? "TASK" : "REMINDER",
      id: `entity-${index}`,
      data: { title: `实体-${index}`, nested: { b: index, a: true } },
      pending: index % 3 === 0,
      updatedAt: new Date(Date.UTC(2026, 7, 8, 0, index)).toISOString(),
    })),
    pending: Array.from({ length: 4 }, (_, index) => ({
      id: `mutation-${index}`,
      userId: index < 3 ? "user-a" : "user-b",
      entityType: "TASK",
      action: "CREATE",
      entityId: null,
      localId: `local-${index}`,
      payload: { title: `待同步-${index}` },
      version: null,
      status: "PENDING",
      errorCode: null,
      errorMessage: null,
      current: null,
      createdAt: 1_786_000_100_000 + index,
    })),
  };
}

async function seed(name, source = fixture()) {
  const database = await openV1Database(indexedDB, name);
  const transaction = database.transaction(
    [STORES.kv, STORES.entitiesV1, STORES.pendingV1],
    "readwrite",
  );
  transaction.objectStore(STORES.kv).put({ key: "activeSchema", value: "v1" });
  for (const row of source.entities) {
    transaction.objectStore(STORES.entitiesV1).put(row);
  }
  for (const row of source.pending) {
    transaction.objectStore(STORES.pendingV1).put(row);
  }
  await transactionComplete(transaction);
  database.close();
  return source;
}

async function remove(name) {
  await requestResult(indexedDB.deleteDatabase(name));
}

function assertCleanRollback(state, source) {
  assert.equal(state.activeSchema, "v1");
  assert.equal(state.targetEntities.length, 0);
  assert.equal(state.targetPending.length, 0);
  assert.equal(state.keys.length, 0);
  assert.equal(state.sourceEntities.length, source.entities.length);
  assert.equal(state.sourcePending.length, source.pending.length);
}

function quotaError(transaction, message) {
  transaction?.abort();
  throw new DOMException(message, "QuotaExceededError");
}

test("QuotaExceededError during the first entity batch keeps v1 and returns a clear-space action", async () => {
  const name = databaseName("quota-entity");
  const source = await seed(name);
  const result = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-fault",
    batchSize: 2,
    useLock: false,
    faultInjector(event) {
      if (event.phase === MIGRATION_PHASES.entityBeforeComplete) {
        quotaError(event.transaction, "Simulated entity quota exhaustion");
      }
    },
  });
  const state = await inspectMigrationState({ indexedDB, databaseName: name });

  assert.equal(result.status, "ROLLED_BACK");
  assert.equal(result.errorName, "QuotaExceededError");
  assert.equal(result.errorCode, "INSUFFICIENT_STORAGE");
  assert.equal(result.userAction, "CLEAR_SPACE_AND_RETRY");
  assertCleanRollback(state, source);
  await remove(name);
});

test("QuotaExceededError after pending puts removes previously committed entity batches", async () => {
  const name = databaseName("quota-pending");
  const source = await seed(name);
  const result = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-fault",
    batchSize: 2,
    useLock: false,
    faultInjector(event) {
      if (
        event.phase === MIGRATION_PHASES.pendingAfterPut &&
        event.batchIndex === 0 &&
        event.rowIndex === 0
      ) {
        quotaError(event.transaction, "Simulated pending quota exhaustion");
      }
    },
  });
  const state = await inspectMigrationState({ indexedDB, databaseName: name });

  assert.equal(result.status, "ROLLED_BACK");
  assert.equal(result.errorCode, "INSUFFICIENT_STORAGE");
  assertCleanRollback(state, source);
  await remove(name);
});

test("aborting an entity write transaction leaves no rows from that transaction or earlier batches", async () => {
  const name = databaseName("abort-entity");
  const source = await seed(name);
  const result = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-fault",
    batchSize: 2,
    useLock: false,
    faultInjector(event) {
      if (
        event.phase === MIGRATION_PHASES.entityBeforeComplete &&
        event.batchIndex === 1
      ) {
        event.transaction.abort();
      }
    },
  });
  const state = await inspectMigrationState({ indexedDB, databaseName: name });

  assert.equal(result.status, "ROLLED_BACK");
  assert.equal(result.errorCode, "TRANSACTION_ABORTED");
  assertCleanRollback(state, source);
  await remove(name);
});

test("aborting the activation transaction cannot leave activeSchema=v2", async () => {
  const name = databaseName("abort-activation");
  const source = await seed(name);
  const result = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-fault",
    batchSize: 2,
    useLock: false,
    faultInjector(event) {
      if (event.phase === MIGRATION_PHASES.activateBeforeComplete) {
        event.transaction.abort();
      }
    },
  });
  const state = await inspectMigrationState({ indexedDB, databaseName: name });

  assert.equal(result.status, "ROLLED_BACK");
  assert.equal(result.errorCode, "TRANSACTION_ABORTED");
  assertCleanRollback(state, source);
  await remove(name);
});

async function runInterruptionRecovery(phase, predicate, label) {
  const name = databaseName(label);
  const source = await seed(name);
  let triggered = false;
  await assert.rejects(
    () =>
      migrateV1ToV2({
        indexedDB,
        cryptoProvider: webcrypto,
        databaseName: name,
        deviceId: "device-fault",
        batchSize: 2,
        useLock: false,
        leavePartialStateOnFailure: true,
        faultInjector(event) {
          if (!triggered && event.phase === phase && predicate(event)) {
            triggered = true;
            throw new Error(`SIMULATED_TERMINATION_${label}`);
          }
        },
      }),
    /SIMULATED_TERMINATION/u,
  );

  const interrupted = await inspectMigrationState({
    indexedDB,
    databaseName: name,
  });
  assert.equal(interrupted.activeSchema, "v1");
  assert.equal(interrupted.journal.status, "COPYING_INTERRUPTED");
  assert.equal(interrupted.journal.errorCode, "INTERRUPTED");
  assert.ok(
    interrupted.targetEntities.length + interrupted.targetPending.length > 0,
  );

  const retry = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-fault",
    batchSize: 3,
    useLock: false,
  });
  const recovered = await inspectMigrationState({
    indexedDB,
    databaseName: name,
  });

  assert.equal(retry.status, "COMPLETED");
  assert.equal(retry.recoveredInterruptedMigration, true);
  assert.equal(recovered.activeSchema, "v2");
  assert.equal(recovered.targetEntities.length, source.entities.length);
  assert.equal(recovered.targetPending.length, source.pending.length);
  assert.equal(
    new Set(
      recovered.targetEntities.map(
        (row) => `${row.userId}:${row.entityType}:${row.id}`,
      ),
    ).size,
    source.entities.length,
  );
  assert.equal(
    new Set(recovered.targetPending.map((row) => row.id)).size,
    source.pending.length,
  );
  await remove(name);
}

test("termination after an entity batch commit is recovered without loss or duplicates", async () => {
  await runInterruptionRecovery(
    MIGRATION_PHASES.entityAfterComplete,
    (event) => event.batchIndex === 0,
    "after-entity-commit",
  );
});

test("termination after a pending batch commit is recovered without loss or duplicates", async () => {
  await runInterruptionRecovery(
    MIGRATION_PHASES.pendingAfterComplete,
    (event) => event.batchIndex === 0,
    "after-pending-commit",
  );
});
