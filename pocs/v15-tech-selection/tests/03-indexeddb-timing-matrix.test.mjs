import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { indexedDB } from "fake-indexeddb";

import {
  MIGRATION_PHASES,
  STORES,
  inspectMigrationState,
  migrateV1ToV2,
  openV1Database,
} from "../lib/indexeddb-migration.mjs";

mkdirSync("results", { recursive: true });

const statistics = {
  deterministic: [],
  randomized: {
    seed: 0x5a17c0de,
    runs: 0,
    recovered: 0,
    anomalies: 0,
    phaseCounts: {},
  },
  concurrency: null,
};

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
      reject(transaction.error ?? new Error("ABORTED"));
  });
}

function databaseName(label) {
  return `stage3-timing-${label}-${randomUUID()}`;
}

function fixture() {
  return {
    entities: Array.from({ length: 8 }, (_, index) => ({
      userId: index < 5 ? "user-a" : "user-b",
      entityType: index % 2 === 0 ? "TASK" : "REMINDER",
      id: `entity-${index}`,
      data: {
        title: `实体-${index}`,
        nested: { z: index, a: true },
        items: [{ b: 2, a: 1 }],
      },
      pending: index % 3 === 0,
      updatedAt: new Date(Date.UTC(2026, 7, 8, 1, index)).toISOString(),
    })),
    pending: Array.from({ length: 4 }, (_, index) => ({
      id: `mutation-${index}`,
      userId: index < 3 ? "user-a" : "user-b",
      entityType: "TASK",
      action: "CREATE",
      entityId: null,
      localId: `local-${index}`,
      payload: { title: `待同步-${index}`, nested: { b: index, a: false } },
      version: null,
      status: "PENDING",
      errorCode: null,
      errorMessage: null,
      current: null,
      createdAt: 1_786_000_200_000 + index,
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

function assertFinalState(state, source) {
  assert.equal(state.activeSchema, "v2");
  assert.equal(state.journal.status, "ACTIVE");
  assert.equal(state.sourceEntities.length, source.entities.length);
  assert.equal(state.sourcePending.length, source.pending.length);
  assert.equal(state.targetEntities.length, source.entities.length);
  assert.equal(state.targetPending.length, source.pending.length);
  assert.equal(
    new Set(
      state.targetEntities.map(
        (row) => `${row.userId}:${row.entityType}:${row.id}`,
      ),
    ).size,
    source.entities.length,
  );
  assert.equal(
    new Set(state.targetPending.map((row) => row.id)).size,
    source.pending.length,
  );
}

async function interruptAndRecover({ label, shouldFail, repeats = 10 }) {
  const outcomes = [];
  for (let run = 0; run < repeats; run += 1) {
    const name = databaseName(`${label}-${run}`);
    const source = await seed(name);
    let triggered = false;
    await assert.rejects(
      () =>
        migrateV1ToV2({
          indexedDB,
          cryptoProvider: webcrypto,
          databaseName: name,
          deviceId: "device-timing",
          batchSize: 2,
          useLock: false,
          leavePartialStateOnFailure: true,
          faultInjector(event) {
            if (!triggered && shouldFail(event)) {
              triggered = true;
              throw new Error(`SIMULATED_TERMINATION_${label}_${run}`);
            }
          },
        }),
      /SIMULATED_TERMINATION/u,
    );
    assert.equal(triggered, true);

    const interrupted = await inspectMigrationState({
      indexedDB,
      databaseName: name,
    });
    assert.equal(interrupted.activeSchema, "v1");
    assert.equal(interrupted.journal.status, "COPYING_INTERRUPTED");

    const retry = await migrateV1ToV2({
      indexedDB,
      cryptoProvider: webcrypto,
      databaseName: name,
      deviceId: "device-timing",
      batchSize: 3,
      useLock: false,
    });
    const recovered = await inspectMigrationState({
      indexedDB,
      databaseName: name,
    });
    assert.equal(retry.status, "COMPLETED");
    assert.equal(retry.recoveredInterruptedMigration, true);
    assertFinalState(recovered, source);
    outcomes.push({
      run,
      interruptedEntities: interrupted.targetEntities.length,
      interruptedPending: interrupted.targetPending.length,
      recovered: true,
    });
    await remove(name);
  }
  statistics.deterministic.push({ label, repeats, outcomes });
}

const deterministicScenarios = [
  {
    label: "entity-copy-50-percent",
    shouldFail: (event) =>
      event.phase === MIGRATION_PHASES.entityAfterComplete &&
      event.batchIndex === 1,
  },
  {
    label: "between-entity-and-pending-copy",
    shouldFail: (event) =>
      event.phase === MIGRATION_PHASES.pendingBeforeTransaction &&
      event.batchIndex === 0,
  },
  {
    label: "pending-copy-50-percent",
    shouldFail: (event) =>
      event.phase === MIGRATION_PHASES.pendingAfterComplete &&
      event.batchIndex === 0,
  },
  {
    label: "entity-verification-50-percent",
    shouldFail: (event) =>
      event.phase === MIGRATION_PHASES.verifyEntityAfter && event.index === 3,
  },
  {
    label: "pending-verification-50-percent",
    shouldFail: (event) =>
      event.phase === MIGRATION_PHASES.verifyPendingAfter && event.index === 1,
  },
  {
    label: "before-activation-transaction",
    shouldFail: (event) =>
      event.phase === MIGRATION_PHASES.activateBeforeTransaction,
  },
];

test("each critical migration stage recovers consistently across 10 repeated interruptions", async () => {
  for (const scenario of deterministicScenarios) {
    await interruptAndRecover(scenario);
  }
  assert.equal(statistics.deterministic.length, deterministicScenarios.length);
  assert.equal(
    statistics.deterministic.reduce(
      (sum, entry) => sum + entry.outcomes.length,
      0,
    ),
    deterministicScenarios.length * 10,
  );
});

function createRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

const randomFaultPoints = [
  ...Array.from({ length: 4 }, (_, batchIndex) => ({
    name: `entity-batch-${batchIndex}`,
    match: (event) =>
      event.phase === MIGRATION_PHASES.entityAfterComplete &&
      event.batchIndex === batchIndex,
  })),
  ...Array.from({ length: 2 }, (_, batchIndex) => ({
    name: `pending-batch-${batchIndex}`,
    match: (event) =>
      event.phase === MIGRATION_PHASES.pendingAfterComplete &&
      event.batchIndex === batchIndex,
  })),
  ...Array.from({ length: 8 }, (_, index) => ({
    name: `verify-entity-${index}`,
    match: (event) =>
      event.phase === MIGRATION_PHASES.verifyEntityAfter &&
      event.index === index,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    name: `verify-pending-${index}`,
    match: (event) =>
      event.phase === MIGRATION_PHASES.verifyPendingAfter &&
      event.index === index,
  })),
  {
    name: "before-activation",
    match: (event) =>
      event.phase === MIGRATION_PHASES.activateBeforeTransaction,
  },
];

test("60 seeded random interruption runs recover with zero anomalous states", async () => {
  const random = createRandom(statistics.randomized.seed);
  for (let run = 0; run < 60; run += 1) {
    const fault =
      randomFaultPoints[Math.floor(random() * randomFaultPoints.length)];
    statistics.randomized.phaseCounts[fault.name] =
      (statistics.randomized.phaseCounts[fault.name] ?? 0) + 1;
    const name = databaseName(`random-${run}`);
    const source = await seed(name);
    let triggered = false;
    try {
      await assert.rejects(
        () =>
          migrateV1ToV2({
            indexedDB,
            cryptoProvider: webcrypto,
            databaseName: name,
            deviceId: "device-random",
            batchSize: 2,
            useLock: false,
            leavePartialStateOnFailure: true,
            faultInjector(event) {
              if (!triggered && fault.match(event)) {
                triggered = true;
                throw new Error(`SIMULATED_TERMINATION_RANDOM_${run}`);
              }
            },
          }),
        /SIMULATED_TERMINATION/u,
      );
      assert.equal(triggered, true);
      const retry = await migrateV1ToV2({
        indexedDB,
        cryptoProvider: webcrypto,
        databaseName: name,
        deviceId: "device-random",
        batchSize: 3,
        useLock: false,
      });
      assert.equal(retry.status, "COMPLETED");
      assert.equal(retry.recoveredInterruptedMigration, true);
      const state = await inspectMigrationState({
        indexedDB,
        databaseName: name,
      });
      assertFinalState(state, source);
      statistics.randomized.recovered += 1;
    } catch (error) {
      statistics.randomized.anomalies += 1;
      throw error;
    } finally {
      statistics.randomized.runs += 1;
      await remove(name);
    }
  }
  assert.equal(statistics.randomized.runs, 60);
  assert.equal(statistics.randomized.recovered, 60);
  assert.equal(statistics.randomized.anomalies, 0);
});

class SerialLockManager {
  #tail = Promise.resolve();
  active = 0;
  maxActive = 0;
  entries = [];

  request(name, options, callback) {
    const execute = async () => {
      this.active += 1;
      this.maxActive = Math.max(this.maxActive, this.active);
      this.entries.push({ name, mode: options.mode, enteredAt: Date.now() });
      try {
        return await callback();
      } finally {
        this.active -= 1;
      }
    };
    const result = this.#tail.then(execute, execute);
    this.#tail = result.catch(() => {});
    return result;
  }
}

test("two concurrent migration callers are serialized by the lock manager", async () => {
  const name = databaseName("concurrent-lock");
  const source = await seed(name);
  const lockManager = new SerialLockManager();
  const options = {
    indexedDB,
    cryptoProvider: webcrypto,
    databaseName: name,
    deviceId: "device-lock",
    batchSize: 2,
    lockManager,
  };

  const [first, second] = await Promise.all([
    migrateV1ToV2({
      ...options,
      beforeMigration: () => new Promise((resolve) => setTimeout(resolve, 25)),
    }),
    migrateV1ToV2(options),
  ]);
  const statuses = [first.status, second.status].sort();
  assert.deepEqual(statuses, ["ALREADY_ACTIVE", "COMPLETED"]);
  assert.equal(lockManager.maxActive, 1);
  assert.equal(lockManager.entries.length, 2);
  const state = await inspectMigrationState({ indexedDB, databaseName: name });
  assertFinalState(state, source);
  statistics.concurrency = {
    callers: 2,
    statuses,
    maxConcurrentLockHolders: lockManager.maxActive,
    lockEntries: lockManager.entries.length,
  };
  await remove(name);
});

test.after(() => {
  writeFileSync(
    "results/03-indexeddb-timing-matrix.json",
    JSON.stringify(statistics, null, 2),
  );
});
