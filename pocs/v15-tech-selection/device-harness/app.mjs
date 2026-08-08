import {
  STORES,
  inspectMigrationState,
  migrateV1ToV2,
  openV1Database,
} from "../lib/indexeddb-migration.mjs";

const databaseName = "daily-assistant-stage3-device-harness";
const output = document.querySelector("#output");
let evidence = null;

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

function fixture() {
  const entities = Array.from({ length: 50 }, (_, index) => ({
    userId: index < 30 ? "device-user-a" : "device-user-b",
    entityType: index % 3 === 0 ? "REMINDER" : "TASK",
    id: `entity-${index}`,
    data: {
      title: `真机迁移-${index}`,
      nested: {
        beta: index,
        alpha: `中文-${index}`,
      },
      items: [
        { id: "a", value: index },
        { id: "b", value: index + 1 },
      ],
    },
    pending: index % 4 === 0,
    updatedAt: new Date(Date.UTC(2026, 7, 8, 0, index)).toISOString(),
  }));
  const pending = Array.from({ length: 10 }, (_, index) => ({
    id: `mutation-${index}`,
    userId: index < 6 ? "device-user-a" : "device-user-b",
    entityType: "TASK",
    action: "CREATE",
    entityId: null,
    localId: `local-${index}`,
    payload: { title: `待同步-${index}`, secret: `secret-${index}` },
    version: null,
    status: "PENDING",
    errorCode: null,
    errorMessage: null,
    current: null,
    createdAt: Date.now() + index,
  }));
  return { entities, pending };
}

async function collectEnvironment() {
  const estimate = await navigator.storage?.estimate?.();
  const persisted = await navigator.storage?.persisted?.();
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    standaloneMedia: matchMedia("(display-mode: standalone)").matches,
    navigatorStandalone: navigator.standalone ?? null,
    online: navigator.onLine,
    storageEstimate: estimate
      ? { usage: estimate.usage ?? null, quota: estimate.quota ?? null }
      : null,
    storagePersisted: persisted ?? null,
  };
}

async function deleteDatabase() {
  await requestResult(indexedDB.deleteDatabase(databaseName));
}

async function seedV1() {
  const source = fixture();
  const database = await openV1Database(indexedDB, databaseName);
  const transaction = database.transaction(
    [STORES.kv, STORES.entitiesV1, STORES.pendingV1],
    "readwrite",
  );
  transaction.objectStore(STORES.kv).put({
    key: "activeSchema",
    value: "v1",
  });
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

function validateState(state, source) {
  const assertions = {
    activeSchemaV2: state.activeSchema === "v2",
    journalActive: state.journal?.status === "ACTIVE",
    sourceEntityCount: state.sourceEntities.length === source.entities.length,
    sourcePendingCount: state.sourcePending.length === source.pending.length,
    targetEntityCount: state.targetEntities.length === source.entities.length,
    targetPendingCount: state.targetPending.length === source.pending.length,
    accountKeyCount: state.keys.length === 2,
    encryptedEntityPayload:
      state.targetEntities.length > 0 &&
      state.targetEntities.every((row) => !("data" in row) && row.envelope),
    encryptedPendingPayload:
      state.targetPending.length > 0 &&
      state.targetPending.every((row) => !("payload" in row) && row.envelope),
  };
  return {
    assertions,
    passed: Object.values(assertions).every(Boolean),
  };
}

function render(value) {
  output.textContent = JSON.stringify(value, null, 2);
}

async function runMigration() {
  render({ status: "RUNNING" });
  await deleteDatabase();
  const source = await seedV1();
  const startedAt = performance.now();
  const migration = await migrateV1ToV2({
    indexedDB,
    cryptoProvider: crypto,
    databaseName,
    deviceId: "real-device-harness",
    batchSize: 5,
  });
  const durationMs = performance.now() - startedAt;
  const state = await inspectMigrationState({ indexedDB, databaseName });
  const validation = validateState(state, source);
  evidence = {
    test: "stage3-real-device-v1-to-v2",
    environment: await collectEnvironment(),
    migration,
    durationMs,
    validation,
    counts: {
      sourceEntities: state.sourceEntities.length,
      sourcePending: state.sourcePending.length,
      targetEntities: state.targetEntities.length,
      targetPending: state.targetPending.length,
      keys: state.keys.length,
    },
  };
  localStorage.setItem("stage3-device-evidence", JSON.stringify(evidence));
  render(evidence);
}

async function reopenVerification() {
  const state = await inspectMigrationState({ indexedDB, databaseName });
  const previous = JSON.parse(
    localStorage.getItem("stage3-device-evidence") ?? "null",
  );
  const result = {
    test: "stage3-real-device-reopen",
    environment: await collectEnvironment(),
    previousEvidencePresent: Boolean(previous),
    activeSchema: state.activeSchema,
    journalStatus: state.journal?.status ?? null,
    counts: {
      sourceEntities: state.sourceEntities.length,
      sourcePending: state.sourcePending.length,
      targetEntities: state.targetEntities.length,
      targetPending: state.targetPending.length,
      keys: state.keys.length,
    },
    passed:
      state.activeSchema === "v2" &&
      state.journal?.status === "ACTIVE" &&
      state.targetEntities.length === 50 &&
      state.targetPending.length === 10 &&
      state.keys.length === 2,
  };
  evidence = { ...previous, reopen: result };
  localStorage.setItem("stage3-device-evidence", JSON.stringify(evidence));
  render(evidence);
}

function exportEvidence() {
  const value = evidence ?? JSON.parse(
    localStorage.getItem("stage3-device-evidence") ?? "null",
  );
  if (!value) {
    render({ error: "NO_EVIDENCE_TO_EXPORT" });
    return;
  }
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `stage3-device-evidence-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelector("#run").addEventListener("click", () => {
  runMigration().catch((error) =>
    render({ status: "FAILED", name: error.name, message: error.message }),
  );
});

document.querySelector("#reopen").addEventListener("click", () => {
  reopenVerification().catch((error) =>
    render({ status: "FAILED", name: error.name, message: error.message }),
  );
});

document.querySelector("#clear").addEventListener("click", () => {
  deleteDatabase()
    .then(() => {
      localStorage.removeItem("stage3-device-evidence");
      evidence = null;
      render({ status: "CLEARED" });
    })
    .catch((error) =>
      render({ status: "FAILED", name: error.name, message: error.message }),
    );
});

document.querySelector("#export").addEventListener("click", exportEvidence);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

collectEnvironment().then((environment) => render({ environment }));
