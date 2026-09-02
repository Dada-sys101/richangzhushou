// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  LocalRepository,
  PendingMutation,
  StoredEntity,
} from "./repository";
import {
  applyChange,
  enqueueCreate,
  flushPending,
  getSyncStateForUser,
  initSync,
  isSyncRateLimitedError,
  listLocal,
  pullChanges,
  stopSync,
} from "./sync";

const originalOnline = navigator.onLine;

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

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

function memoryRepository(initialPending: PendingMutation[] = []) {
  const metadata = new Map<string, unknown>();
  const entities = new Map<string, StoredEntity>();
  const pending = new Map(initialPending.map((item) => [item.id, item]));
  const key = (userId: string, entityType: string, id: string) =>
    `${userId}:${entityType}:${id}`;
  const repository: LocalRepository = {
    clearUserData: vi.fn(),
    entityDelete: vi.fn(async (userId, entityType, id) => {
      entities.delete(key(userId, entityType, id));
    }),
    entityGet: vi.fn(
      async (userId, entityType, id) =>
        entities.get(key(userId, entityType, id)) ?? null,
    ),
    entityList: vi.fn(async (userId, entityType) =>
      [...entities.values()].filter(
        (entity) =>
          entity.userId === userId && entity.entityType === entityType,
      ),
    ),
    entityPut: vi.fn(async (userId, entityType, entity) => {
      entities.set(key(userId, entityType, entity.id), entity);
    }),
    hasAnyStoredData: vi.fn(async () => entities.size > 0 || pending.size > 0),
    metadataDelete: vi.fn(async (key) => {
      metadata.delete(key);
    }),
    metadataGet: vi.fn(
      async (key: string) => metadata.get(key) ?? null,
    ) as unknown as LocalRepository["metadataGet"],
    metadataSet: vi.fn(async (key, value) => {
      metadata.set(key, value);
    }),
    pendingDelete: vi.fn(async (_userId, id) => {
      pending.delete(id);
    }),
    pendingGet: vi.fn(async (userId, id) => {
      const item = pending.get(id);
      return item && item.userId === userId ? item : null;
    }),
    pendingList: vi.fn(async (userId, statuses) =>
      [...pending.values()].filter(
        (item) =>
          item.userId === userId &&
          (!statuses || statuses.includes(item.status)),
      ),
    ),
    pendingPut: vi.fn(async (_userId, item) => {
      pending.set(item.id, item);
    }),
    pendingUpdate: vi.fn(async (userId, id, patch) => {
      const item = pending.get(id);
      if (item?.userId === userId) {
        pending.set(id, { ...item, ...patch });
      }
    }),
  };
  return { entities, metadata, pending, repository };
}

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function taskChange(
  overrides: Partial<Parameters<typeof applyChange>[1]> = {},
) {
  return {
    changeType: "UPDATE" as const,
    data: { id: "task-1", title: "server", version: 2 },
    deletedAt: null,
    entityId: "task-1",
    entityType: "TASK" as const,
    id: "TASK:task-1",
    updatedAt: "2026-08-29T01:00:00.000Z",
    version: 2,
    ...overrides,
  };
}

describe("sync repository injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    stopSync();
    setOnline(true);
  });

  afterEach(() => {
    stopSync();
    vi.unstubAllGlobals();
    setOnline(originalOnline);
  });

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

  it("deduplicates concurrent pulls and commits the cursor monotonically", async () => {
    const { metadata, repository } = memoryRepository();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? response({ changes: [taskChange()], nextCursor: "cursor-1" })
          : response({ changes: [], nextCursor: "cursor-1" });
      }),
    );

    const [first, second] = await Promise.all([
      pullChanges("user-1", repository, { throwOnError: true }),
      pullChanges("user-1", repository, { throwOnError: true }),
    ]);

    expect(calls).toBe(2);
    expect(first.changedEntityTypes).toEqual(["TASK"]);
    expect(second).toEqual(first);
    expect(metadata.get("cursor:user-1")).toBe("cursor-1");
  });

  it("fails closed when a non-empty page has no next cursor", async () => {
    const { metadata, repository } = memoryRepository();
    await repository.metadataSet("cursor:user-1", "cursor-previous");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({ changes: [taskChange()], nextCursor: null }),
      ),
    );

    await expect(
      pullChanges("user-1", repository, { throwOnError: true }),
    ).rejects.toThrow("缺少非空变更页的下一游标");

    expect(metadata.get("cursor:user-1")).toBe("cursor-previous");
    expect(repository.entityPut).not.toHaveBeenCalled();
    expect(await getSyncStateForUser("user-1", repository)).toMatchObject({
      status: "SYNC_FAILED",
    });
  });

  it("preserves the rate-limit status for the coordinator to back off", async () => {
    const { repository } = memoryRepository();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ message: "Too many requests" }, 429)),
    );

    let caught: unknown;
    try {
      await pullChanges("user-1", repository, { throwOnError: true });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ status: 429 });
    expect(isSyncRateLimitedError(caught)).toBe(true);
  });

  it("distinguishes local mutation notifications from sync state notifications", async () => {
    const events: CustomEvent<{ reason: string }>[] = [];
    const listener = (event: Event) => {
      events.push(event as CustomEvent<{ reason: string }>);
    };
    window.addEventListener("daily-sync-changed", listener);
    const { repository } = memoryRepository();

    await enqueueCreate(
      "user-1",
      "TASK",
      { title: "offline task" },
      "local-task-1",
      repository,
    );
    expect(events.at(-1)?.detail.reason).toBe("mutation");

    events.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ changes: [], nextCursor: null })),
    );
    await pullChanges("user-1", repository, { throwOnError: true });

    expect(events.map((event) => event.detail.reason)).toEqual([
      "state",
      "state",
    ]);
    window.removeEventListener("daily-sync-changed", listener);
  });

  it("does not let pulled data overwrite a pending or newer local entity", async () => {
    const repository = repositoryDouble();
    vi.mocked(repository.entityGet)
      .mockResolvedValueOnce({
        data: { id: "task-1", title: "local pending", version: 1 },
        entityType: "TASK",
        id: "task-1",
        pending: true,
        updatedAt: "2026-08-29T02:00:00.000Z",
        userId: "user-1",
      })
      .mockResolvedValueOnce({
        data: { id: "task-1", title: "local newer", version: 4 },
        entityType: "TASK",
        id: "task-1",
        pending: false,
        updatedAt: "2026-08-29T04:00:00.000Z",
        userId: "user-1",
      });

    await applyChange("user-1", taskChange(), repository);
    await applyChange(
      "user-1",
      taskChange({ version: 3, data: { id: "task-1", version: 3 } }),
      repository,
    );

    expect(repository.entityPut).not.toHaveBeenCalled();
  });

  it("uses the server mutation timestamp and result when flushing a queue", async () => {
    const mutation: PendingMutation = {
      action: "UPDATE",
      createdAt: Date.now(),
      current: null,
      entityId: "task-1",
      entityType: "TASK",
      errorCode: null,
      errorMessage: null,
      id: "mutation-1234567890123456",
      localId: null,
      payload: { title: "server result" },
      status: "PENDING",
      userId: "user-1",
      version: 1,
    };
    const { entities, pending, repository } = memoryRepository([mutation]);
    entities.set("user-1:TASK:task-1", {
      data: { id: "task-1", title: "local", version: 1 },
      entityType: "TASK",
      id: "task-1",
      pending: true,
      updatedAt: "2026-08-29T00:00:00.000Z",
      userId: "user-1",
    });
    await initSync("user-1", repository);
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? response({
              results: [
                {
                  clientMutationId: mutation.id,
                  result: {
                    id: "task-1",
                    title: "server result",
                    updatedAt: "2026-08-29T08:09:10.000Z",
                    version: 2,
                  },
                  status: "OK",
                },
              ],
            })
          : response({ changes: [], nextCursor: null });
      }),
    );

    const result = await flushPending("user-1", repository, {
      throwOnError: true,
    });
    const stored = entities.get("user-1:TASK:task-1");

    expect(result.submittedCount).toBe(1);
    expect(stored?.data.title).toBe("server result");
    expect(stored?.updatedAt).toBe("2026-08-29T08:09:10.000Z");
    expect(pending.size).toBe(0);
  });

  it("keeps version conflicts visible in local sync state", async () => {
    const mutation: PendingMutation = {
      action: "UPDATE",
      createdAt: Date.now(),
      current: null,
      entityId: "task-1",
      entityType: "TASK",
      errorCode: null,
      errorMessage: null,
      id: "mutation-2234567890123456",
      localId: null,
      payload: { title: "local" },
      status: "PENDING",
      userId: "user-1",
      version: 1,
    };
    const { pending, repository } = memoryRepository([mutation]);
    await initSync("user-1", repository);
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? response({
              results: [
                {
                  clientMutationId: mutation.id,
                  error: {
                    code: "VERSION_CONFLICT",
                    current: {
                      data: { id: "task-1", title: "remote", version: 2 },
                      entityId: "task-1",
                      entityType: "TASK",
                    },
                    message: "版本冲突",
                  },
                  status: "ERROR",
                },
              ],
            })
          : response({ changes: [], nextCursor: null });
      }),
    );

    await flushPending("user-1", repository, { throwOnError: true });

    expect(pending.get(mutation.id)?.status).toBe("CONFLICT");
    expect((await getSyncStateForUser("user-1", repository)).status).toBe(
      "CONFLICT",
    );
  });
});
