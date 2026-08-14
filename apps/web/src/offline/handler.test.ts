// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => ({
  currentUser: vi.fn(() => "user-1"),
  enqueueChange: vi.fn(),
  enqueueCreate: vi.fn(),
  newLocalEntityId: vi.fn(() => "local-1"),
}));

vi.mock("./sync", () => sync);

import { handleOffline, matchOfflineRoute } from "./handler";
import type { LocalRepository } from "./repository";

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

describe("offline handler repository injection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes a create placeholder through the injected repository", async () => {
    const repository = repositoryDouble();
    const route = matchOfflineRoute("POST", "/tasks");
    expect(route).not.toBeNull();

    const result = await handleOffline(
      route!,
      "/tasks",
      { title: "offline" },
      repository,
    );

    expect(repository.entityPut).toHaveBeenCalledWith(
      "user-1",
      "TASK",
      expect.objectContaining({ id: "local-1", userId: "user-1" }),
    );
    expect(sync.enqueueCreate).toHaveBeenCalledWith(
      "user-1",
      "TASK",
      { title: "offline" },
      "local-1",
      repository,
    );
    expect(result).toEqual(expect.objectContaining({ id: "local-1" }));
  });

  it("propagates repository failures", async () => {
    const repository = repositoryDouble();
    vi.mocked(repository.entityPut).mockRejectedValue(
      new Error("storage failed"),
    );
    const route = matchOfflineRoute("POST", "/tasks");
    await expect(
      handleOffline(route!, "/tasks", { title: "offline" }, repository),
    ).rejects.toThrow("storage failed");
  });
});
