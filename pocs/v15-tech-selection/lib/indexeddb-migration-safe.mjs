import {
  MIGRATION_ID,
  STORES,
  migrateV1ToV2 as migrateWithResilientEngine,
} from "./indexeddb-migration-resilient.mjs";

export * from "./indexeddb-migration-resilient.mjs";

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new DOMException("IndexedDB transaction failed", "AbortError"),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ??
          new DOMException("IndexedDB transaction aborted", "AbortError"),
      );
  });
}

function isNullTransactionErrorFailure(error) {
  return (
    error instanceof TypeError &&
    /Cannot read properties of null.*message/u.test(error.message)
  );
}

async function forceSafeRollback(indexedDB, databaseName) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
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
      reason: "INDEXEDDB_TRANSACTION_ABORTED_WITHOUT_ERROR_OBJECT",
      activeSchema: "v1",
      updatedAt: new Date().toISOString(),
    });
    transaction.objectStore(STORES.kv).put({
      key: "activeSchema",
      value: "v1",
    });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function migrateV1ToV2(options) {
  try {
    return await migrateWithResilientEngine(options);
  } catch (error) {
    if (!isNullTransactionErrorFailure(error)) throw error;
    await forceSafeRollback(options.indexedDB, options.databaseName);
    return {
      status: "ROLLED_BACK",
      error: "INDEXEDDB_TRANSACTION_ABORTED_WITHOUT_ERROR_OBJECT",
      errorName: "AbortError",
      errorCode: "TRANSACTION_ABORTED",
      userAction: "RETRY",
      recoverable: true,
    };
  }
}
