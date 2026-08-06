export type SyncEntityType =
  | "TRANSACTION"
  | "CATEGORY"
  | "FINANCIAL_ACCOUNT"
  | "BUDGET"
  | "CALENDAR_EVENT"
  | "TASK"
  | "REMINDER"
  | "TRIP"
  | "TRIP_ITEM"
  | "PACKING_ITEM"
  | "DRAFT_RECORD";

export type SyncAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
export type PendingStatus = "PENDING" | "FAILED" | "CONFLICT";

export interface StoredEntity {
  id: string;
  userId: string;
  entityType: SyncEntityType;
  data: Record<string, unknown>;
  pending: boolean;
  updatedAt: string;
}

export interface SyncCurrentEntity {
  entityType: SyncEntityType;
  entityId: string;
  data: Record<string, unknown>;
}

export interface PendingMutation {
  id: string;
  userId: string;
  entityType: SyncEntityType;
  action: SyncAction;
  entityId: string | null;
  localId: string | null;
  payload: Record<string, unknown>;
  version: number | null;
  status: PendingStatus;
  errorCode: string | null;
  errorMessage: string | null;
  current: SyncCurrentEntity | null;
  createdAt: number;
}

export interface UserSyncState {
  status: "SYNCED" | "PENDING_SYNC" | "SYNC_FAILED" | "CONFLICT";
  lastSyncedAt: string | null;
}

const DB_NAME = "daily-assistant-sync";
const DB_VERSION = 1;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise;
  }
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("kv")) {
        database.createObjectStore("kv", { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains("entities")) {
        const entities = database.createObjectStore("entities", {
          keyPath: ["userId", "entityType", "id"],
        });
        entities.createIndex("entityId", "id", { unique: false });
        entities.createIndex("userEntityType", ["userId", "entityType"], {
          unique: false,
        });
      }
      if (!database.objectStoreNames.contains("pending")) {
        const pending = database.createObjectStore("pending", {
          keyPath: "id",
        });
        pending.createIndex("userId", "userId", { unique: false });
        pending.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = callback(store);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | null> {
  return withStore("kv", "readonly", async (store) => {
    const row = await requestResult(
      store.get(key) as IDBRequest<{ key: string; value: T } | undefined>,
    );
    return row?.value ?? null;
  });
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await withStore("kv", "readwrite", async (store) => {
    await requestResult(store.put({ key, value }));
  });
}

export async function kvDelete(key: string): Promise<void> {
  await withStore("kv", "readwrite", async (store) => {
    await requestResult(store.delete(key));
  });
}

export async function putEntity(entity: StoredEntity): Promise<void> {
  await withStore("entities", "readwrite", async (store) => {
    await requestResult(store.put(entity));
  });
}

export async function getEntity(
  userId: string,
  entityType: SyncEntityType,
  id: string,
): Promise<StoredEntity | null> {
  return withStore("entities", "readonly", async (store) => {
    const row = await requestResult(
      store.get([userId, entityType, id]) as IDBRequest<
        StoredEntity | undefined
      >,
    );
    return row ?? null;
  });
}

export async function listEntities(
  userId: string,
  entityType?: SyncEntityType,
): Promise<StoredEntity[]> {
  return withStore("entities", "readonly", async (store) => {
    const rows: StoredEntity[] = [];
    const index = entityType
      ? store.index("userEntityType")
      : store.index("entityId");
    const cursorRequest = entityType
      ? index.openCursor(IDBKeyRange.only([userId, entityType]))
      : index.openCursor();
    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }
        const value = cursor.value as StoredEntity;
        if (!entityType || value.userId === userId) {
          rows.push(value);
        }
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
    return rows;
  });
}

export async function deleteEntityRecord(
  userId: string,
  entityType: SyncEntityType,
  id: string,
): Promise<void> {
  await withStore("entities", "readwrite", async (store) => {
    await requestResult(store.delete([userId, entityType, id]));
  });
}

export async function putPending(mutation: PendingMutation): Promise<void> {
  await withStore("pending", "readwrite", async (store) => {
    await requestResult(store.put(mutation));
  });
}

export async function getPending(id: string): Promise<PendingMutation | null> {
  return withStore("pending", "readonly", async (store) => {
    const row = await requestResult(
      store.get(id) as IDBRequest<PendingMutation | undefined>,
    );
    return row ?? null;
  });
}

export async function listPending(
  userId: string,
  statuses?: PendingStatus[],
): Promise<PendingMutation[]> {
  return withStore("pending", "readonly", async (store) => {
    const rows: PendingMutation[] = [];
    const index = store.index("userId");
    const cursorRequest = index.openCursor(IDBKeyRange.only(userId));
    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }
        const value = cursor.value as PendingMutation;
        if (!statuses || statuses.includes(value.status)) {
          rows.push(value);
        }
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
    rows.sort((left, right) => left.createdAt - right.createdAt);
    return rows;
  });
}

export async function updatePending(
  id: string,
  patch: Partial<Omit<PendingMutation, "id">>,
): Promise<void> {
  await withStore("pending", "readwrite", async (store) => {
    const existing = await requestResult(
      store.get(id) as IDBRequest<PendingMutation | undefined>,
    );
    if (existing) {
      await requestResult(store.put({ ...existing, ...patch, id }));
    }
  });
}

export async function deletePending(id: string): Promise<void> {
  await withStore("pending", "readwrite", async (store) => {
    await requestResult(store.delete(id));
  });
}

export async function clearUserData(userId: string): Promise<void> {
  await withStore("entities", "readwrite", async (store) => {
    const index = store.index("userEntityType");
    const cursorRequest = index.openCursor(IDBKeyRange.only([userId]));
    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  });
  await withStore("pending", "readwrite", async (store) => {
    const index = store.index("userId");
    const cursorRequest = index.openCursor(IDBKeyRange.only(userId));
    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  });
  await kvDelete(cursorKey(userId));
  await kvDelete(stateKey(userId));
  await kvDelete(idMapKey(userId));
}

export async function hasAnyStoredData(): Promise<boolean> {
  const database = await openDatabase();
  return new Promise<boolean>((resolve, reject) => {
    const transaction = database.transaction(
      ["entities", "pending"],
      "readonly",
    );
    const entityCursor = transaction.objectStore("entities").openKeyCursor();
    let entityFound = false;
    entityCursor.onsuccess = () => {
      if (entityCursor.result) {
        entityFound = true;
        entityCursor.result.continue();
      }
    };
    const pendingCursor = transaction.objectStore("pending").openKeyCursor();
    let pendingFound = false;
    pendingCursor.onsuccess = () => {
      if (pendingCursor.result) {
        pendingFound = true;
        pendingCursor.result.continue();
      }
    };
    transaction.oncomplete = () => resolve(entityFound || pendingFound);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function cursorKey(userId: string): string {
  return `cursor:${userId}`;
}

export function stateKey(userId: string): string {
  return `state:${userId}`;
}

export function idMapKey(userId: string): string {
  return `idmap:${userId}`;
}
