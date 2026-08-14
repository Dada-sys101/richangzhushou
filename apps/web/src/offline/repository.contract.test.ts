import { describe, expect, it } from "vitest";

import type {
  LocalRepository,
  PendingMutation,
  StoredEntity,
  SyncEntityType,
} from "./repository";

class ContractRepository implements LocalRepository {
  readonly entities = new Map<string, StoredEntity>();
  readonly metadata = new Map<string, unknown>();
  readonly pending = new Map<string, PendingMutation>();

  metadataGet<T>(key: string): Promise<T | null> {
    return Promise.resolve((this.metadata.get(key) as T | undefined) ?? null);
  }
  metadataSet(key: string, value: unknown): Promise<void> {
    this.metadata.set(key, value);
    return Promise.resolve();
  }
  metadataDelete(key: string): Promise<void> {
    this.metadata.delete(key);
    return Promise.resolve();
  }
  entityGet(userId: string, entityType: SyncEntityType, id: string) {
    return Promise.resolve(
      this.entities.get(`${userId}:${entityType}:${id}`) ?? null,
    );
  }
  entityList(userId: string, entityType: SyncEntityType) {
    return Promise.resolve(
      [...this.entities.values()].filter(
        (row) => row.userId === userId && row.entityType === entityType,
      ),
    );
  }
  entityPut(userId: string, entityType: SyncEntityType, entity: StoredEntity) {
    if (entity.userId !== userId || entity.entityType !== entityType) {
      return Promise.reject(new Error("scope mismatch"));
    }
    this.entities.set(`${userId}:${entityType}:${entity.id}`, entity);
    return Promise.resolve();
  }
  entityDelete(userId: string, entityType: SyncEntityType, id: string) {
    this.entities.delete(`${userId}:${entityType}:${id}`);
    return Promise.resolve();
  }
  pendingGet(userId: string, id: string) {
    const row = this.pending.get(id);
    return Promise.resolve(row?.userId === userId ? row : null);
  }
  pendingList(userId: string) {
    return Promise.resolve(
      [...this.pending.values()]
        .filter((row) => row.userId === userId)
        .sort((left, right) => left.createdAt - right.createdAt),
    );
  }
  pendingPut(userId: string, mutation: PendingMutation) {
    if (mutation.userId !== userId) {
      return Promise.reject(new Error("scope mismatch"));
    }
    this.pending.set(mutation.id, mutation);
    return Promise.resolve();
  }
  async pendingUpdate(
    userId: string,
    id: string,
    patch: Partial<Omit<PendingMutation, "id" | "userId">>,
  ) {
    const row = await this.pendingGet(userId, id);
    if (row) this.pending.set(id, { ...row, ...patch });
  }
  async pendingDelete(userId: string, id: string) {
    if (await this.pendingGet(userId, id)) this.pending.delete(id);
  }
  async clearUserData(userId: string) {
    for (const row of await this.entityList(userId, "TASK")) {
      await this.entityDelete(userId, row.entityType, row.id);
    }
    for (const row of await this.pendingList(userId))
      this.pending.delete(row.id);
  }
  hasAnyStoredData() {
    return Promise.resolve(this.entities.size > 0 || this.pending.size > 0);
  }
}

const entity = (userId: string, id: string): StoredEntity => ({
  data: { id },
  entityType: "TASK",
  id,
  pending: false,
  updatedAt: "2026-08-13T00:00:00.000Z",
  userId,
});

const mutation = (
  userId: string,
  id: string,
  createdAt: number,
): PendingMutation => ({
  action: "UPDATE",
  createdAt,
  current: null,
  entityId: id,
  entityType: "TASK",
  errorCode: null,
  errorMessage: null,
  id,
  localId: null,
  payload: {},
  status: "PENDING",
  userId,
  version: 1,
});

describe("LocalRepository contract", () => {
  it("requires explicit entity scope and isolates users", async () => {
    const repository = new ContractRepository();
    await repository.entityPut("user-a", "TASK", entity("user-a", "same"));
    await repository.entityPut("user-b", "TASK", entity("user-b", "same"));

    expect(
      (await repository.entityList("user-a", "TASK")).map((row) => row.userId),
    ).toEqual(["user-a"]);
    await expect(
      repository.entityPut("user-a", "TASK", entity("user-b", "bad")),
    ).rejects.toThrow("scope mismatch");
  });

  it("orders pending mutations and scopes ID operations", async () => {
    const repository = new ContractRepository();
    await repository.pendingPut("user-a", mutation("user-a", "later", 2));
    await repository.pendingPut("user-a", mutation("user-a", "earlier", 1));
    await repository.pendingPut("user-b", mutation("user-b", "other", 0));

    expect(
      (await repository.pendingList("user-a")).map((row) => row.id),
    ).toEqual(["earlier", "later"]);
    expect(await repository.pendingGet("user-a", "other")).toBeNull();
    await repository.pendingDelete("user-a", "other");
    expect(await repository.pendingGet("user-b", "other")).not.toBeNull();
  });

  it("preserves global local-data availability", async () => {
    const repository = new ContractRepository();
    await repository.entityPut("user-b", "TASK", entity("user-b", "one"));
    expect(await repository.hasAnyStoredData()).toBe(true);
    expect(await repository.entityList("user-a", "TASK")).toEqual([]);
  });
});
