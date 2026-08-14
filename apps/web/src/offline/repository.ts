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

export interface LocalRepository {
  metadataGet<T>(key: string): Promise<T | null>;
  metadataSet(key: string, value: unknown): Promise<void>;
  metadataDelete(key: string): Promise<void>;
  entityGet(
    userId: string,
    entityType: SyncEntityType,
    id: string,
  ): Promise<StoredEntity | null>;
  entityList(
    userId: string,
    entityType: SyncEntityType,
  ): Promise<StoredEntity[]>;
  entityPut(
    userId: string,
    entityType: SyncEntityType,
    entity: StoredEntity,
  ): Promise<void>;
  entityDelete(
    userId: string,
    entityType: SyncEntityType,
    id: string,
  ): Promise<void>;
  pendingGet(userId: string, id: string): Promise<PendingMutation | null>;
  pendingList(
    userId: string,
    statuses?: PendingStatus[],
  ): Promise<PendingMutation[]>;
  pendingPut(userId: string, mutation: PendingMutation): Promise<void>;
  pendingUpdate(
    userId: string,
    id: string,
    patch: Partial<Omit<PendingMutation, "id" | "userId">>,
  ): Promise<void>;
  pendingDelete(userId: string, id: string): Promise<void>;
  clearUserData(userId: string): Promise<void>;
  /** Preserves the legacy global (not user-scoped) availability check. */
  hasAnyStoredData(): Promise<boolean>;
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
