import {
  assertSupportedDeviceKey,
  buildKeyId,
  decryptJson,
  encryptJson,
  generateDeviceKey,
} from "./local-crypto.mjs";

export const DATABASE_VERSION_V1 = 1;
export const DATABASE_VERSION_V2 = 2;
export const MIGRATION_ID = "v1-to-v2";

export const STORES = Object.freeze({
  kv: "kv",
  entitiesV1: "entities",
  pendingV1: "pending",
  entitiesV2: "entities_v2",
  pendingV2: "pending_v2",
  keys: "crypto_keys",
  journal: "migration_journal",
  recurrenceSeries: "recurrence_series_v2",
  recurrenceExceptions: "recurrence_exceptions_v2",
});

const ACTIVE_SCHEMA_KEY = "activeSchema";
const TERMINAL_JOURNAL_STATES = new Set([
  "ACTIVE",
  "ROLLED_BACK",
  "ROLLED_BACK_AFTER_ACTIVATION",
]);

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

function openRequest(indexedDB, name, version, { onUpgrade, onBlocked } = {}) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = (event) => onUpgrade?.(request.result, event);
    request.onblocked = () => onBlocked?.();
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error);
  });
}

function createV1Stores(database) {
  if (!database.objectStoreNames.contains(STORES.kv)) {
    database.createObjectStore(STORES.kv, { keyPath: "key" });
  }
  if (!database.objectStoreNames.contains(STORES.entitiesV1)) {
    const store = database.createObjectStore(STORES.entitiesV1, {
      keyPath: ["userId", "entityType", "id"],
    });
    store.createIndex("entityId", "id", { unique: false });
    store.createIndex("userEntityType", ["userId", "entityType"], {
      unique: false,
    });
  }
  if (!database.objectStoreNames.contains(STORES.pendingV1)) {
    const store = database.createObjectStore(STORES.pendingV1, {
      keyPath: "id",
    });
    store.createIndex("userId", "userId", { unique: false });
    store.createIndex("createdAt", "createdAt", { unique: false });
  }
}

function createV2Stores(database) {
  if (!database.objectStoreNames.contains(STORES.entitiesV2)) {
    const store = database.createObjectStore(STORES.entitiesV2, {
      keyPath: ["userId", "entityType", "id"],
    });
    store.createIndex("userEntityType", ["userId", "entityType"], {
      unique: false,
    });
    store.createIndex("keyId", "envelope.keyId", { unique: false });
  }
  if (!database.objectStoreNames.contains(STORES.pendingV2)) {
    const store = database.createObjectStore(STORES.pendingV2, {
      keyPath: "id",
    });
    store.createIndex("userId", "userId", { unique: false });
    store.createIndex("createdAt", "createdAt", { unique: false });
    store.createIndex("keyId", "envelope.keyId", { unique: false });
  }
  if (!database.objectStoreNames.contains(STORES.keys)) {
    const store = database.createObjectStore(STORES.keys, {
      keyPath: "keyId",
    });
    store.createIndex("userId", "userId", { unique: false });
  }
  if (!database.objectStoreNames.contains(STORES.journal)) {
    database.createObjectStore(STORES.journal, { keyPath: "id" });
  }
  if (!database.objectStoreNames.contains(STORES.recurrenceSeries)) {
    const store = database.createObjectStore(STORES.recurrenceSeries, {
      keyPath: ["userId", "id"],
    });
    store.createIndex("userId", "userId", { unique: false });
    store.createIndex("parentSeries", ["userId", "parentSeriesId"], {
      unique: false,
    });
  }
  if (!database.objectStoreNames.contains(STORES.recurrenceExceptions)) {
    const store = database.createObjectStore(STORES.recurrenceExceptions, {
      keyPath: ["userId", "seriesId", "originalRecurrenceId"],
    });
    store.createIndex("series", ["userId", "seriesId"], {
      unique: false,
    });
  }
}

export function openV1Database(indexedDB, name, options = {}) {
  return openRequest(indexedDB, name, DATABASE_VERSION_V1, {
    ...options,
    onUpgrade(database) {
      createV1Stores(database);
      options.onUpgrade?.(database);
    },
  });
}

export function openV2Database(indexedDB, name, options = {}) {
  return openRequest(indexedDB, name, DATABASE_VERSION_V2, {
    ...options,
    onUpgrade(database) {
      createV1Stores(database);
      createV2Stores(database);
      options.onUpgrade?.(database);
    },
  });
}

async function getRow(database, storeName, key) {
  const transaction = database.transaction(storeName, "readonly");
  const row = await requestResult(transaction.objectStore(storeName).get(key));
  await transactionComplete(transaction);
  return row ?? null;
}

async function getAllRows(database, storeName) {
  const transaction = database.transaction(storeName, "readonly");
  const rows = await requestResult(transaction.objectStore(storeName).getAll());
  await transactionComplete(transaction);
  return rows;
}

async function putRows(database, storeName, rows) {
  if (rows.length === 0) return;
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  for (const row of rows) store.put(row);
  await transactionComplete(transaction);
}

async function writeJournal(database, patch) {
  const existing = (await getRow(database, STORES.journal, MIGRATION_ID)) ?? {
    id: MIGRATION_ID,
  };
  const row = {
    ...existing,
    ...patch,
    id: MIGRATION_ID,
    updatedAt: new Date().toISOString(),
  };
  await putRows(database, STORES.journal, [row]);
  return row;
}

async function setActiveSchema(database, value, journalPatch) {
  const transaction = database.transaction(
    [STORES.kv, STORES.journal],
    "readwrite",
  );
  transaction.objectStore(STORES.kv).put({
    key: ACTIVE_SCHEMA_KEY,
    value,
  });
  const journalStore = transaction.objectStore(STORES.journal);
  const existing = await requestResult(journalStore.get(MIGRATION_ID));
  journalStore.put({
    ...(existing ?? { id: MIGRATION_ID }),
    ...journalPatch,
    id: MIGRATION_ID,
    activeSchema: value,
    updatedAt: new Date().toISOString(),
  });
  await transactionComplete(transaction);
}

async function clearShadowState(database, reason) {
  const transaction = database.transaction(
    [
      STORES.entitiesV2,
      STORES.pendingV2,
      STORES.keys,
      STORES.journal,
      STORES.kv,
    ],
    "readwrite",
  );
  transaction.objectStore(STORES.entitiesV2).clear();
  transaction.objectStore(STORES.pendingV2).clear();
  transaction.objectStore(STORES.keys).clear();
  transaction.objectStore(STORES.journal).put({
    id: MIGRATION_ID,
    status: "ROLLED_BACK",
    reason,
    activeSchema: "v1",
    updatedAt: new Date().toISOString(),
  });
  transaction.objectStore(STORES.kv).put({
    key: ACTIVE_SCHEMA_KEY,
    value: "v1",
  });
  await transactionComplete(transaction);
}

async function ensureUserKey(database, cryptoProvider, userId, deviceId) {
  const keyId = buildKeyId(userId, deviceId, 1);
  const existing = await getRow(database, STORES.keys, keyId);
  if (existing) return existing;
  const key = await generateDeviceKey(cryptoProvider);
  const row = {
    keyId,
    userId,
    deviceId,
    keyVersion: 1,
    key,
    createdAt: new Date().toISOString(),
  };
  await putRows(database, STORES.keys, [row]);
  return row;
}

function entitySensitiveValue(row) {
  return { data: row.data };
}

function pendingSensitiveValue(row) {
  return {
    payload: row.payload,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    current: row.current,
  };
}

function comparableJson(value) {
  return JSON.stringify(value);
}

async function encryptEntity(database, cryptoProvider, deviceId, row) {
  const keyRow = await ensureUserKey(
    database,
    cryptoProvider,
    row.userId,
    deviceId,
  );
  const envelope = await encryptJson({
    cryptoProvider,
    key: keyRow.key,
    keyId: keyRow.keyId,
    userId: row.userId,
    recordType: "SYNC_ENTITY",
    recordId: `${row.entityType}:${row.id}`,
    value: entitySensitiveValue(row),
  });
  return {
    userId: row.userId,
    entityType: row.entityType,
    id: row.id,
    pending: row.pending,
    updatedAt: row.updatedAt,
    envelope,
  };
}

async function encryptPending(database, cryptoProvider, deviceId, row) {
  const keyRow = await ensureUserKey(
    database,
    cryptoProvider,
    row.userId,
    deviceId,
  );
  const envelope = await encryptJson({
    cryptoProvider,
    key: keyRow.key,
    keyId: keyRow.keyId,
    userId: row.userId,
    recordType: "PENDING_MUTATION",
    recordId: row.id,
    value: pendingSensitiveValue(row),
  });
  return {
    id: row.id,
    userId: row.userId,
    entityType: row.entityType,
    action: row.action,
    entityId: row.entityId,
    localId: row.localId,
    version: row.version,
    status: row.status,
    createdAt: row.createdAt,
    envelope,
  };
}

async function verifyEncryptedRow(
  database,
  cryptoProvider,
  sourceValue,
  targetRow,
) {
  const keyRow = await getRow(database, STORES.keys, targetRow.envelope.keyId);
  if (!keyRow) throw new Error("MIGRATION_KEY_MISSING");
  const decrypted = await decryptJson({
    cryptoProvider,
    key: keyRow.key,
    envelope: targetRow.envelope,
  });
  if (comparableJson(decrypted) !== comparableJson(sourceValue)) {
    throw new Error("MIGRATION_DECRYPTED_VALUE_MISMATCH");
  }
}

async function verifyMigration(database, cryptoProvider, sourceEntities, sourcePending) {
  const targetEntities = await getAllRows(database, STORES.entitiesV2);
  const targetPending = await getAllRows(database, STORES.pendingV2);
  if (targetEntities.length !== sourceEntities.length) {
    throw new Error("MIGRATION_ENTITY_COUNT_MISMATCH");
  }
  if (targetPending.length !== sourcePending.length) {
    throw new Error("MIGRATION_PENDING_COUNT_MISMATCH");
  }

  const entityTargets = new Map(
    targetEntities.map((row) => [`${row.userId}:${row.entityType}:${row.id}`, row]),
  );
  for (const source of sourceEntities) {
    const target = entityTargets.get(
      `${source.userId}:${source.entityType}:${source.id}`,
    );
    if (!target) throw new Error("MIGRATION_ENTITY_MISSING");
    await verifyEncryptedRow(
      database,
      cryptoProvider,
      entitySensitiveValue(source),
      target,
    );
  }

  const pendingTargets = new Map(targetPending.map((row) => [row.id, row]));
  for (const source of sourcePending) {
    const target = pendingTargets.get(source.id);
    if (!target) throw new Error("MIGRATION_PENDING_MISSING");
    await verifyEncryptedRow(
      database,
      cryptoProvider,
      pendingSensitiveValue(source),
      target,
    );
  }

  return {
    entityCount: targetEntities.length,
    pendingCount: targetPending.length,
  };
}

export async function migrateV1ToV2({
  indexedDB,
  cryptoProvider,
  databaseName,
  deviceId,
  batchSize = 25,
  failAfterCopies = Number.POSITIVE_INFINITY,
  leavePartialStateOnFailure = false,
  mutateBeforeVerification,
}) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new TypeError("batchSize must be a positive safe integer");
  }
  const database = await openV2Database(indexedDB, databaseName);
  try {
    const activeSchemaRow = await getRow(database, STORES.kv, ACTIVE_SCHEMA_KEY);
    const activeSchema = activeSchemaRow?.value ?? "v1";
    if (activeSchema === "v2") {
      return { status: "ALREADY_ACTIVE" };
    }

    const previousJournal = await getRow(database, STORES.journal, MIGRATION_ID);
    let recoveredInterruptedMigration = false;
    if (
      previousJournal &&
      !TERMINAL_JOURNAL_STATES.has(previousJournal.status)
    ) {
      await clearShadowState(database, "RECOVER_INTERRUPTED_MIGRATION");
      recoveredInterruptedMigration = true;
    }

    const sourceEntities = await getAllRows(database, STORES.entitiesV1);
    const sourcePending = await getAllRows(database, STORES.pendingV1);
    await clearShadowState(database, "PREPARE_NEW_ATTEMPT");
    await writeJournal(database, {
      status: "COPYING",
      activeSchema: "v1",
      sourceEntityCount: sourceEntities.length,
      sourcePendingCount: sourcePending.length,
      copiedEntityCount: 0,
      copiedPendingCount: 0,
      recoveredInterruptedMigration,
    });

    let copied = 0;
    for (let offset = 0; offset < sourceEntities.length; offset += batchSize) {
      const sourceBatch = sourceEntities.slice(offset, offset + batchSize);
      const targetBatch = [];
      for (const row of sourceBatch) {
        if (copied === failAfterCopies) {
          throw new Error("INJECTED_MIGRATION_FAILURE");
        }
        targetBatch.push(
          await encryptEntity(database, cryptoProvider, deviceId, row),
        );
        copied += 1;
      }
      await putRows(database, STORES.entitiesV2, targetBatch);
      await writeJournal(database, { copiedEntityCount: copied });
    }

    let copiedPending = 0;
    for (let offset = 0; offset < sourcePending.length; offset += batchSize) {
      const sourceBatch = sourcePending.slice(offset, offset + batchSize);
      const targetBatch = [];
      for (const row of sourceBatch) {
        if (copied === failAfterCopies) {
          throw new Error("INJECTED_MIGRATION_FAILURE");
        }
        targetBatch.push(
          await encryptPending(database, cryptoProvider, deviceId, row),
        );
        copied += 1;
        copiedPending += 1;
      }
      await putRows(database, STORES.pendingV2, targetBatch);
      await writeJournal(database, { copiedPendingCount: copiedPending });
    }

    await writeJournal(database, { status: "VERIFYING" });
    await mutateBeforeVerification?.(database, STORES);
    const verified = await verifyMigration(
      database,
      cryptoProvider,
      sourceEntities,
      sourcePending,
    );
    await setActiveSchema(database, "v2", {
      status: "ACTIVE",
      verified,
      activatedAt: new Date().toISOString(),
    });
    return {
      status: "COMPLETED",
      recoveredInterruptedMigration,
      ...verified,
    };
  } catch (error) {
    if (!leavePartialStateOnFailure) {
      await clearShadowState(database, error.message);
      return { status: "ROLLED_BACK", error: error.message };
    }
    await writeJournal(database, {
      status: "COPYING_INTERRUPTED",
      error: error.message,
    });
    throw error;
  } finally {
    database.close();
  }
}

export async function rollbackToV1({ indexedDB, databaseName, reason }) {
  const database = await openV2Database(indexedDB, databaseName);
  try {
    await setActiveSchema(database, "v1", {
      status: "ROLLED_BACK_AFTER_ACTIVATION",
      reason,
      rolledBackAt: new Date().toISOString(),
    });
    return { status: "ROLLED_BACK_TO_V1" };
  } finally {
    database.close();
  }
}

export async function inspectMigrationState({ indexedDB, databaseName }) {
  const database = await openV2Database(indexedDB, databaseName);
  try {
    const activeSchema = await getRow(database, STORES.kv, ACTIVE_SCHEMA_KEY);
    const journal = await getRow(database, STORES.journal, MIGRATION_ID);
    return {
      activeSchema: activeSchema?.value ?? "v1",
      sourceEntities: await getAllRows(database, STORES.entitiesV1),
      sourcePending: await getAllRows(database, STORES.pendingV1),
      targetEntities: await getAllRows(database, STORES.entitiesV2),
      targetPending: await getAllRows(database, STORES.pendingV2),
      keys: await getAllRows(database, STORES.keys),
      journal,
      stores: Array.from(database.objectStoreNames),
    };
  } finally {
    database.close();
  }
}

export async function verifyStoredKey(keyRow) {
  assertSupportedDeviceKey(keyRow.key);
  return true;
}
