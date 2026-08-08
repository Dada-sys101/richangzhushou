import {
  assertSupportedDeviceKey,
  buildKeyId,
  decryptJson,
  encryptJson,
  generateDeviceKey,
} from "./local-crypto.mjs";
import { stableJsonSha256 } from "./canonical-json.mjs";

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

export const MIGRATION_PHASES = Object.freeze({
  lockAcquired: "LOCK_ACQUIRED",
  beforePrepare: "BEFORE_PREPARE",
  afterPrepare: "AFTER_PREPARE",
  entityBeforeTransaction: "ENTITY_BEFORE_TRANSACTION",
  entityBeforePut: "ENTITY_BEFORE_PUT",
  entityAfterPut: "ENTITY_AFTER_PUT",
  entityBeforeComplete: "ENTITY_BEFORE_COMPLETE",
  entityAfterComplete: "ENTITY_AFTER_COMPLETE",
  pendingBeforeTransaction: "PENDING_BEFORE_TRANSACTION",
  pendingBeforePut: "PENDING_BEFORE_PUT",
  pendingAfterPut: "PENDING_AFTER_PUT",
  pendingBeforeComplete: "PENDING_BEFORE_COMPLETE",
  pendingAfterComplete: "PENDING_AFTER_COMPLETE",
  verifyBefore: "VERIFY_BEFORE",
  verifyEntityBefore: "VERIFY_ENTITY_BEFORE",
  verifyEntityAfter: "VERIFY_ENTITY_AFTER",
  verifyPendingBefore: "VERIFY_PENDING_BEFORE",
  verifyPendingAfter: "VERIFY_PENDING_AFTER",
  activateBeforeTransaction: "ACTIVATE_BEFORE_TRANSACTION",
  activateBeforeComplete: "ACTIVATE_BEFORE_COMPLETE",
  activateAfterComplete: "ACTIVATE_AFTER_COMPLETE",
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
      reject(transaction.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
}

function invokeFault(faultInjector, event) {
  if (!faultInjector) return;
  const result = faultInjector(event);
  if (result && typeof result.then === "function") {
    throw new TypeError("FAULT_INJECTOR_MUST_BE_SYNCHRONOUS");
  }
}

function observePhase(phaseObserver, event) {
  phaseObserver?.(event);
}

function emit(options, phase, context = {}) {
  const event = { phase, ...context };
  observePhase(options.phaseObserver, event);
  invokeFault(options.faultInjector, event);
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

async function putRows(database, storeName, rows, options = {}) {
  if (rows.length === 0) return;
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  const phasePrefix = options.phasePrefix;
  const beforeTransaction = MIGRATION_PHASES[`${phasePrefix}BeforeTransaction`];
  const beforePut = MIGRATION_PHASES[`${phasePrefix}BeforePut`];
  const afterPut = MIGRATION_PHASES[`${phasePrefix}AfterPut`];
  const beforeComplete = MIGRATION_PHASES[`${phasePrefix}BeforeComplete`];
  const afterComplete = MIGRATION_PHASES[`${phasePrefix}AfterComplete`];
  const base = {
    storeName,
    batchIndex: options.batchIndex ?? null,
    transaction,
  };

  emit(options, beforeTransaction, base);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    emit(options, beforePut, { ...base, row, rowIndex });
    store.put(row);
    emit(options, afterPut, { ...base, row, rowIndex });
  }
  emit(options, beforeComplete, base);
  await transactionComplete(transaction);
  emit(options, afterComplete, { ...base, transaction: null });
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
  const transaction = database.transaction(STORES.journal, "readwrite");
  transaction.objectStore(STORES.journal).put(row);
  await transactionComplete(transaction);
  return row;
}

async function setActiveSchema(database, value, journalPatch, options = {}) {
  const transaction = database.transaction(
    [STORES.kv, STORES.journal],
    "readwrite",
  );
  emit(options, MIGRATION_PHASES.activateBeforeTransaction, { transaction });
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
  emit(options, MIGRATION_PHASES.activateBeforeComplete, { transaction });
  await transactionComplete(transaction);
  emit(options, MIGRATION_PHASES.activateAfterComplete, { transaction: null });
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
  const transaction = database.transaction(STORES.keys, "readwrite");
  transaction.objectStore(STORES.keys).put(row);
  await transactionComplete(transaction);
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

export async function verifyEquivalentJson(left, right, cryptoProvider) {
  const [leftHash, rightHash] = await Promise.all([
    stableJsonSha256(left, cryptoProvider),
    stableJsonSha256(right, cryptoProvider),
  ]);
  return leftHash === rightHash;
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
  if (!(await verifyEquivalentJson(decrypted, sourceValue, cryptoProvider))) {
    throw new Error("MIGRATION_DECRYPTED_VALUE_MISMATCH");
  }
}

async function verifyMigration(
  database,
  cryptoProvider,
  sourceEntities,
  sourcePending,
  options,
) {
  emit(options, MIGRATION_PHASES.verifyBefore);
  const targetEntities = await getAllRows(database, STORES.entitiesV2);
  const targetPending = await getAllRows(database, STORES.pendingV2);
  if (targetEntities.length !== sourceEntities.length) {
    throw new Error("MIGRATION_ENTITY_COUNT_MISMATCH");
  }
  if (targetPending.length !== sourcePending.length) {
    throw new Error("MIGRATION_PENDING_COUNT_MISMATCH");
  }

  const entityTargets = new Map(
    targetEntities.map((row) => [
      `${row.userId}:${row.entityType}:${row.id}`,
      row,
    ]),
  );
  for (let index = 0; index < sourceEntities.length; index += 1) {
    const source = sourceEntities[index];
    const target = entityTargets.get(
      `${source.userId}:${source.entityType}:${source.id}`,
    );
    if (!target) throw new Error("MIGRATION_ENTITY_MISSING");
    emit(options, MIGRATION_PHASES.verifyEntityBefore, { index, source, target });
    await verifyEncryptedRow(
      database,
      cryptoProvider,
      entitySensitiveValue(source),
      target,
    );
    emit(options, MIGRATION_PHASES.verifyEntityAfter, { index, source, target });
  }

  const pendingTargets = new Map(targetPending.map((row) => [row.id, row]));
  for (let index = 0; index < sourcePending.length; index += 1) {
    const source = sourcePending[index];
    const target = pendingTargets.get(source.id);
    if (!target) throw new Error("MIGRATION_PENDING_MISSING");
    emit(options, MIGRATION_PHASES.verifyPendingBefore, { index, source, target });
    await verifyEncryptedRow(
      database,
      cryptoProvider,
      pendingSensitiveValue(source),
      target,
    );
    emit(options, MIGRATION_PHASES.verifyPendingAfter, { index, source, target });
  }

  return {
    entityCount: targetEntities.length,
    pendingCount: targetPending.length,
  };
}

export function classifyMigrationError(error) {
  const name = error?.name ?? "Error";
  const message = error?.message ?? String(error);
  if (name === "QuotaExceededError") {
    return {
      errorCode: "INSUFFICIENT_STORAGE",
      userAction: "CLEAR_SPACE_AND_RETRY",
      recoverable: true,
    };
  }
  if (name === "AbortError" || message.includes("TRANSACTION_ABORTED")) {
    return {
      errorCode: "TRANSACTION_ABORTED",
      userAction: "RETRY",
      recoverable: true,
    };
  }
  if (message.includes("SIMULATED_TERMINATION")) {
    return {
      errorCode: "INTERRUPTED",
      userAction: "RETRY_ON_NEXT_START",
      recoverable: true,
    };
  }
  return {
    errorCode: "MIGRATION_FAILED",
    userAction: "RETRY_OR_REPORT",
    recoverable: true,
  };
}

async function migrateUnlocked(options) {
  const {
    indexedDB,
    cryptoProvider,
    databaseName,
    deviceId,
    batchSize = 25,
    failAfterCopies = Number.POSITIVE_INFINITY,
    leavePartialStateOnFailure = false,
    mutateBeforeVerification,
  } = options;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new TypeError("batchSize must be a positive safe integer");
  }
  const database = await openV2Database(indexedDB, databaseName);
  try {
    emit(options, MIGRATION_PHASES.beforePrepare);
    const activeSchemaRow = await getRow(
      database,
      STORES.kv,
      ACTIVE_SCHEMA_KEY,
    );
    const activeSchema = activeSchemaRow?.value ?? "v1";
    if (activeSchema === "v2") {
      return { status: "ALREADY_ACTIVE" };
    }

    const previousJournal = await getRow(
      database,
      STORES.journal,
      MIGRATION_ID,
    );
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
    emit(options, MIGRATION_PHASES.afterPrepare);

    let copied = 0;
    let entityBatchIndex = 0;
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
      await putRows(database, STORES.entitiesV2, targetBatch, {
        ...options,
        phasePrefix: "entity",
        batchIndex: entityBatchIndex,
      });
      await writeJournal(database, { copiedEntityCount: copied });
      entityBatchIndex += 1;
    }

    let copiedPending = 0;
    let pendingBatchIndex = 0;
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
      await putRows(database, STORES.pendingV2, targetBatch, {
        ...options,
        phasePrefix: "pending",
        batchIndex: pendingBatchIndex,
      });
      await writeJournal(database, { copiedPendingCount: copiedPending });
      pendingBatchIndex += 1;
    }

    await writeJournal(database, { status: "VERIFYING" });
    await mutateBeforeVerification?.(database, STORES);
    const verified = await verifyMigration(
      database,
      cryptoProvider,
      sourceEntities,
      sourcePending,
      options,
    );
    await setActiveSchema(
      database,
      "v2",
      {
        status: "ACTIVE",
        verified,
        activatedAt: new Date().toISOString(),
      },
      options,
    );
    return {
      status: "COMPLETED",
      recoveredInterruptedMigration,
      ...verified,
    };
  } catch (error) {
    const classification = classifyMigrationError(error);
    if (!leavePartialStateOnFailure) {
      await clearShadowState(database, error.message);
      return {
        status: "ROLLED_BACK",
        error: error.message,
        errorName: error.name ?? "Error",
        ...classification,
      };
    }
    await writeJournal(database, {
      status: "COPYING_INTERRUPTED",
      error: error.message,
      errorName: error.name ?? "Error",
      ...classification,
    });
    throw error;
  } finally {
    database.close();
  }
}

export async function migrateV1ToV2(options) {
  const lockManager = options.lockManager ?? globalThis.navigator?.locks;
  const run = async () => {
    emit(options, MIGRATION_PHASES.lockAcquired, {
      databaseName: options.databaseName,
    });
    await options.beforeMigration?.();
    return migrateUnlocked(options);
  };
  if (!lockManager?.request || options.useLock === false) {
    return run();
  }
  return lockManager.request(
    `daily-assistant:indexeddb-migration:${options.databaseName}`,
    { mode: "exclusive" },
    run,
  );
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
