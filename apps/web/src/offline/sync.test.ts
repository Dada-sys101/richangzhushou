// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type { LocalRepository } from "./repository";
import { applyChange, listLocal } from "./sync";

function repositoryDouble(): LocalRepository {
  return {
    clearUserData: vi.fn(),
    entityDelete: vi.fn(),
    entityGet: vi.fn().mockResolvedValue(null),
    entityList: vi.fn().mockResolvedValue([]),
    entityPut: vi.fn(),
    hasAnyStoredData: vi.fn().mockResolvedValue(false),
    metadataDelete: vi.fn(),
    metadataGet: vi.fn().mockResolvedValue(null),
    metadataSet: vi.fn(),
    pendingDelete: vi.fn(),
    pendingGet: vi.fn().mockResolvedValue(null),
    pendingList: vi.fn().mockResolvedValue([]),
    pendingPut: vi.fn(),
    pendingUpdate: vi.fn(),
  };
}

describe("sync repository injection", () => {
  it("applies pulled changes through the injected repository", async () => {
    const repository = repositoryDouble();
    await applyChange(
      "user-1",
      {
        changeType: "UPDATE",
        data: { id: "task-1", title: "server" },
        deletedAt: null,
        entityId: "task-1",
        entityType: "TASK",
        id: "change-1",
        updatedAt: "2026-08-13T00:00:00.000Z",
        version: 2,
      },
      repository,
    );
    expect(repository.entityPut).toHaveBeenCalledWith(
      "user-1",
      "TASK",
      expect.objectContaining({ id: "task-1", pending: false }),
    );
  });

  it("maps injected entity rows without touching IndexedDB", async () => {
    const repository = repositoryDouble();
    vi.mocked(repository.entityList).mockResolvedValue([
      {
        data: { id: "task-1" },
        entityType: "TASK",
        id: "task-1",
        pending: false,
        updatedAt: "2026-08-13T00:00:00.000Z",
        userId: "user-1",
      },
    ]);
    expect(await listLocal("user-1", "TASK", repository)).toEqual([
      { id: "task-1" },
    ]);
  });
});
