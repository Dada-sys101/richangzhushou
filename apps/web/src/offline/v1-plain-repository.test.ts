import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  clearUserData: vi.fn(),
  deleteEntityRecord: vi.fn(),
  deletePending: vi.fn(),
  getEntity: vi.fn(),
  getPending: vi.fn(),
  hasAnyStoredData: vi.fn(),
  kvDelete: vi.fn(),
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  listEntities: vi.fn(),
  listPending: vi.fn(),
  putEntity: vi.fn(),
  putPending: vi.fn(),
  updatePending: vi.fn(),
}));

vi.mock("./db", () => db);

import type { PendingMutation, StoredEntity } from "./repository";
import { V1PlainRepository } from "./v1-plain-repository";

const stored: StoredEntity = {
  data: {},
  entityType: "TASK",
  id: "task-1",
  pending: false,
  updatedAt: "2026-08-13T00:00:00.000Z",
  userId: "user-1",
};
const pending: PendingMutation = {
  action: "UPDATE",
  createdAt: 1,
  current: null,
  entityId: "task-1",
  entityType: "TASK",
  errorCode: null,
  errorMessage: null,
  id: "mutation-1",
  localId: null,
  payload: {},
  status: "PENDING",
  userId: "user-1",
  version: 1,
};

describe("V1PlainRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates valid entity operations to existing v1 primitives", async () => {
    const repository = new V1PlainRepository();
    await repository.entityPut("user-1", "TASK", stored);
    expect(db.putEntity).toHaveBeenCalledWith(stored);
    expect(() => repository.entityPut("other", "TASK", stored)).toThrow(
      "scope mismatch",
    );
  });

  it("scopes pending operations before delegating", async () => {
    db.getPending.mockResolvedValue(pending);
    const repository = new V1PlainRepository();
    expect(await repository.pendingGet("other", pending.id)).toBeNull();
    await repository.pendingDelete("other", pending.id);
    expect(db.deletePending).not.toHaveBeenCalled();
    await repository.pendingUpdate("user-1", pending.id, { status: "FAILED" });
    expect(db.updatePending).toHaveBeenCalledWith(pending.id, {
      status: "FAILED",
    });
  });

  it("preserves primitive errors", async () => {
    db.listEntities.mockRejectedValue(new Error("transaction failed"));
    const repository = new V1PlainRepository();
    await expect(repository.entityList("user-1", "TASK")).rejects.toThrow(
      "transaction failed",
    );
  });
});
