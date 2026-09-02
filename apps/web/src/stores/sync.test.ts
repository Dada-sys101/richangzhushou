// @vitest-environment jsdom

import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  accessToken: "access-token" as string | null,
  offlineMode: false,
}));
const apiDouble = vi.hoisted(() => ({
  getSyncStatus: vi.fn(),
}));
const syncRuntime = vi.hoisted(() => ({
  flushPending: vi.fn(),
  getPendingCounts: vi.fn(),
  getSyncStateForUser: vi.fn(),
  initSync: vi.fn(),
  isSyncRateLimitedError: vi.fn(
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: unknown }).status === 429,
  ),
  isSyncing: vi.fn(),
  listPendingForUser: vi.fn(),
  markSyncFailed: vi.fn(),
  pullChanges: vi.fn(),
  resolveConflict: vi.fn(),
  stopSync: vi.fn(),
}));
const plannerStore = vi.hoisted(() => ({
  clearError: vi.fn(),
  errorMessage: null as string | null,
  refreshForSync: vi.fn(),
}));
const financeStore = vi.hoisted(() => ({
  clearError: vi.fn(),
  errorMessage: null as string | null,
  refreshForSync: vi.fn(),
}));
const draftsStore = vi.hoisted(() => ({
  clearError: vi.fn(),
  errorMessage: null as string | null,
  refreshForSync: vi.fn(),
}));
const tripsStore = vi.hoisted(() => ({
  clearError: vi.fn(),
  errorMessage: null as string | null,
  refreshForSync: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: apiDouble,
  isOfflineError: vi.fn(() => false),
}));
vi.mock("../offline/sync", () => syncRuntime);
vi.mock("./auth", () => ({ useAuthStore: () => authState }));
vi.mock("./planner", () => ({ usePlannerStore: () => plannerStore }));
vi.mock("./finance", () => ({ useFinanceStore: () => financeStore }));
vi.mock("./drafts", () => ({ useDraftsStore: () => draftsStore }));
vi.mock("./trips", () => ({ useTripsStore: () => tripsStore }));

import {
  SYNC_FAILURE_BACKOFF_INITIAL_MS,
  SYNC_POLL_INTERVAL_MS,
  useSyncStore,
} from "./sync";

const originalOnline = navigator.onLine;
const originalVisibility = document.visibilityState;

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

describe("sync coordinator", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setOnline(true);
    setVisibility("visible");
    authState.accessToken = "access-token";
    authState.offlineMode = false;
    apiDouble.getSyncStatus.mockResolvedValue({
      appliedCount: 4,
      conflictCount: 0,
      failedCount: 1,
      lastAppliedAt: "2026-08-29T08:00:00.000Z",
    });
    syncRuntime.flushPending.mockResolvedValue({
      changedEntityTypes: [],
      submittedCount: 0,
    });
    syncRuntime.getPendingCounts.mockResolvedValue({ conflict: 0, pending: 0 });
    syncRuntime.getSyncStateForUser.mockResolvedValue({
      lastSyncedAt: "2026-08-29T07:59:00.000Z",
      status: "SYNCED",
    });
    syncRuntime.initSync.mockResolvedValue(undefined);
    syncRuntime.isSyncing.mockReturnValue(false);
    syncRuntime.listPendingForUser.mockResolvedValue([]);
    syncRuntime.markSyncFailed.mockResolvedValue(undefined);
    syncRuntime.pullChanges.mockResolvedValue({
      changedEntityTypes: [],
      cursor: null,
    });
    syncRuntime.resolveConflict.mockResolvedValue(undefined);
    plannerStore.clearError.mockImplementation(() => undefined);
    financeStore.clearError.mockImplementation(() => undefined);
    draftsStore.clearError.mockImplementation(() => undefined);
    tripsStore.clearError.mockImplementation(() => undefined);
    plannerStore.refreshForSync.mockResolvedValue(undefined);
    financeStore.refreshForSync.mockResolvedValue(undefined);
    draftsStore.refreshForSync.mockResolvedValue(undefined);
    tripsStore.refreshForSync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    const store = useSyncStore();
    store.stop();
    vi.clearAllMocks();
    vi.useRealTimers();
    setOnline(originalOnline);
    setVisibility(originalVisibility);
  });

  it("runs one coordinated cycle and refreshes the affected store", async () => {
    syncRuntime.pullChanges.mockResolvedValue({
      changedEntityTypes: ["TASK"],
      cursor: "cursor-1",
    });
    const store = useSyncStore();

    await store.start("user-1");

    expect(syncRuntime.initSync).toHaveBeenCalledWith("user-1");
    expect(syncRuntime.pullChanges).toHaveBeenCalledWith("user-1", undefined, {
      throwOnError: true,
    });
    expect(syncRuntime.flushPending).toHaveBeenCalledWith("user-1", undefined, {
      throwOnError: true,
    });
    expect(plannerStore.refreshForSync).toHaveBeenCalledWith(["TASK"]);
    expect(financeStore.refreshForSync).not.toHaveBeenCalled();
    expect(draftsStore.refreshForSync).not.toHaveBeenCalled();
    expect(store.lastSyncedAt).toBe("2026-08-29T07:59:00.000Z");
    expect(store.lastAppliedAt).toBe("2026-08-29T08:00:00.000Z");
    expect(store.failedCount).toBe(1);
    expect(store.syncing).toBe(false);
  });

  it("refreshes finance and drafts when their entities arrive in one pull", async () => {
    syncRuntime.pullChanges.mockResolvedValue({
      changedEntityTypes: ["TRANSACTION", "DRAFT_RECORD"],
      cursor: "cursor-2",
    });
    const store = useSyncStore();

    await store.start("user-1");

    expect(financeStore.refreshForSync).toHaveBeenCalledWith([
      "TRANSACTION",
      "DRAFT_RECORD",
    ]);
    expect(draftsStore.refreshForSync).toHaveBeenCalledOnce();
    expect(plannerStore.refreshForSync).not.toHaveBeenCalled();
  });

  it("shares an in-flight cycle across route and poll triggers", async () => {
    let releasePull!: (value: { changedEntityTypes: []; cursor: null }) => void;
    syncRuntime.pullChanges.mockReturnValue(
      new Promise((resolve) => {
        releasePull = resolve;
      }),
    );
    const store = useSyncStore();
    const first = store.start("user-1");
    await Promise.resolve();
    await Promise.resolve();
    const second = store.requestSync("route", true);

    expect(syncRuntime.pullChanges).toHaveBeenCalledOnce();
    releasePull({ changedEntityTypes: [], cursor: null });
    await Promise.all([first, second]);
    expect(syncRuntime.flushPending).toHaveBeenCalledOnce();
  });

  it("polls every seven seconds only while the page is visible", async () => {
    vi.useFakeTimers();
    const store = useSyncStore();
    await store.start("user-1");
    syncRuntime.pullChanges.mockClear();

    await vi.advanceTimersByTimeAsync(SYNC_POLL_INTERVAL_MS);
    expect(syncRuntime.pullChanges).toHaveBeenCalledOnce();

    setVisibility("hidden");
    syncRuntime.pullChanges.mockClear();
    await vi.advanceTimersByTimeAsync(SYNC_POLL_INTERVAL_MS);
    expect(syncRuntime.pullChanges).not.toHaveBeenCalled();
  });

  it("does not pull while offline or in an offline session", async () => {
    const store = useSyncStore();
    await store.start("user-1");
    syncRuntime.pullChanges.mockClear();
    setOnline(false);

    await store.requestSync("focus", true);

    expect(syncRuntime.pullChanges).not.toHaveBeenCalled();
    expect(store.offline).toBe(true);
  });

  it("backs off automatic retries after rate limiting but keeps manual retry available", async () => {
    vi.useFakeTimers();
    syncRuntime.pullChanges.mockRejectedValue({
      message: "Too many requests",
      status: 429,
    });
    const store = useSyncStore();

    await store.start("user-1");
    vi.clearAllTimers();
    expect(syncRuntime.pullChanges).toHaveBeenCalledOnce();
    expect(store.errorMessage).toBe(
      "同步请求过于频繁，已暂停自动重试，请稍后重试",
    );

    syncRuntime.pullChanges.mockClear();
    await store.requestSync("route", true);
    await store.requestSync("poll", true);
    expect(syncRuntime.pullChanges).not.toHaveBeenCalled();

    await store.requestSync("manual", true);
    expect(syncRuntime.pullChanges).toHaveBeenCalledOnce();
  });

  it("uses exponential backoff for ordinary automatic failures", async () => {
    vi.useFakeTimers();
    syncRuntime.pullChanges.mockRejectedValue(new Error("network failed"));
    const store = useSyncStore();

    await store.start("user-1");
    vi.clearAllTimers();
    syncRuntime.pullChanges.mockClear();

    await store.requestSync("focus", true);
    expect(syncRuntime.pullChanges).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SYNC_FAILURE_BACKOFF_INITIAL_MS + 1);
    await store.requestSync("focus", true);
    expect(syncRuntime.pullChanges).toHaveBeenCalledOnce();
    syncRuntime.pullChanges.mockClear();

    await store.requestSync("route", true);
    expect(syncRuntime.pullChanges).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SYNC_FAILURE_BACKOFF_INITIAL_MS * 2 + 1);
    await store.requestSync("route", true);
    expect(syncRuntime.pullChanges).toHaveBeenCalledOnce();
  });
});
