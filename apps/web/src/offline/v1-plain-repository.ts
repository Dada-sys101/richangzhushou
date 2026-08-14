import {
  clearUserData,
  deleteEntityRecord,
  deletePending,
  getEntity,
  getPending,
  hasAnyStoredData,
  kvDelete,
  kvGet,
  kvSet,
  listEntities,
  listPending,
  putEntity,
  putPending,
  updatePending,
} from "./db";
import type {
  LocalRepository,
  PendingMutation,
  PendingStatus,
  StoredEntity,
  SyncEntityType,
} from "./repository";

export class V1PlainRepository implements LocalRepository {
  metadataGet<T>(key: string): Promise<T | null> {
    return kvGet<T>(key);
  }

  metadataSet(key: string, value: unknown): Promise<void> {
    return kvSet(key, value);
  }

  metadataDelete(key: string): Promise<void> {
    return kvDelete(key);
  }

  entityGet(userId: string, entityType: SyncEntityType, id: string) {
    return getEntity(userId, entityType, id);
  }

  entityList(userId: string, entityType: SyncEntityType) {
    return listEntities(userId, entityType);
  }

  entityPut(
    userId: string,
    entityType: SyncEntityType,
    entity: StoredEntity,
  ): Promise<void> {
    assertEntityScope(userId, entityType, entity);
    return putEntity(entity);
  }

  entityDelete(
    userId: string,
    entityType: SyncEntityType,
    id: string,
  ): Promise<void> {
    return deleteEntityRecord(userId, entityType, id);
  }

  async pendingGet(
    userId: string,
    id: string,
  ): Promise<PendingMutation | null> {
    const mutation = await getPending(id);
    return mutation?.userId === userId ? mutation : null;
  }

  pendingList(userId: string, statuses?: PendingStatus[]) {
    return listPending(userId, statuses);
  }

  pendingPut(userId: string, mutation: PendingMutation): Promise<void> {
    assertPendingScope(userId, mutation);
    return putPending(mutation);
  }

  async pendingUpdate(
    userId: string,
    id: string,
    patch: Partial<Omit<PendingMutation, "id" | "userId">>,
  ): Promise<void> {
    if (await this.pendingGet(userId, id)) {
      await updatePending(id, patch);
    }
  }

  async pendingDelete(userId: string, id: string): Promise<void> {
    if (await this.pendingGet(userId, id)) {
      await deletePending(id);
    }
  }

  clearUserData(userId: string): Promise<void> {
    return clearUserData(userId);
  }

  hasAnyStoredData(): Promise<boolean> {
    return hasAnyStoredData();
  }
}

function assertEntityScope(
  userId: string,
  entityType: SyncEntityType,
  entity: StoredEntity,
): void {
  if (entity.userId !== userId || entity.entityType !== entityType) {
    throw new Error("Repository entity scope mismatch");
  }
}

function assertPendingScope(userId: string, mutation: PendingMutation): void {
  if (mutation.userId !== userId) {
    throw new Error("Repository pending mutation scope mismatch");
  }
}
