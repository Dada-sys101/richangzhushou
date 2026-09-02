import { defineStore } from "pinia";

import { api, isOfflineError } from "../api/client";
import {
  flushPending,
  getPendingCounts,
  getSyncStateForUser,
  initSync,
  isSyncRateLimitedError,
  isSyncing,
  listPendingForUser,
  markSyncFailed,
  pullChanges,
  resolveConflict,
  stopSync,
  type PendingMutation,
  type SyncEntityType,
  type SyncStatus,
} from "../offline/sync";
import { useAuthStore } from "./auth";
import { useDraftsStore } from "./drafts";
import { useFinanceStore } from "./finance";
import { usePlannerStore } from "./planner";
import { useTripsStore } from "./trips";

export const SYNC_POLL_INTERVAL_MS = 7_000;
export const SYNC_FAILURE_BACKOFF_INITIAL_MS = 5_000;
export const SYNC_FAILURE_BACKOFF_MAX_MS = 60_000;
export const SYNC_RATE_LIMIT_COOLDOWN_MS = 60_000;

type SyncTrigger =
  | "focus"
  | "login"
  | "manual"
  | "mutation"
  | "online"
  | "poll"
  | "route"
  | "visibility";

interface SyncState {
  conflictCount: number;
  conflicts: PendingMutation[];
  errorMessage: string | null;
  failedCount: number;
  initialized: boolean;
  lastAppliedAt: string | null;
  lastSyncedAt: string | null;
  lastUserId: string | null;
  offline: boolean;
  pendingCount: number;
  syncing: boolean;
  status: SyncStatus;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastCycleAt = 0;
let coordinatorGeneration = 0;
let nextAutomaticRetryAt = 0;
let failureBackoffMs = SYNC_FAILURE_BACKOFF_INITIAL_MS;
let activeCycle: {
  generation: number;
  promise: Promise<void>;
  store: SyncStore;
  userId: string;
} | null = null;

export const useSyncStore = defineStore("sync", {
  state: (): SyncState => ({
    conflictCount: 0,
    conflicts: [],
    errorMessage: null,
    failedCount: 0,
    initialized: false,
    lastAppliedAt: null,
    lastSyncedAt: null,
    lastUserId: null,
    offline: !navigator.onLine,
    pendingCount: 0,
    syncing: false,
    status: "SYNCED",
  }),
  actions: {
    async start(userId: string) {
      if (this.lastUserId !== userId) {
        coordinatorGeneration += 1;
        stopPolling();
        stopSync();
        resetFailureBackoff();
        this.initialized = false;
        this.lastUserId = userId;
      }
      if (!this.initialized) {
        await initSync(userId);
        this.initialized = true;
      }
      installPolling(this);
      await this.requestSync("login", true);
    },
    async requestSync(trigger: SyncTrigger = "manual", force = false) {
      const userId = this.lastUserId;
      if (!userId || !this.initialized) {
        return;
      }
      if (
        trigger === "poll" &&
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const auth = useAuthStore();
      if (!navigator.onLine || auth.offlineMode || !auth.accessToken) {
        this.offline = true;
        await this.refresh(userId, { fetchServer: false });
        return;
      }

      const existing = activeCycle;
      if (
        existing &&
        existing.userId === userId &&
        existing.store === this &&
        existing.generation === coordinatorGeneration
      ) {
        await existing.promise;
        return;
      }
      if (existing) {
        await existing.promise;
      }
      if (this.lastUserId !== userId || !this.initialized) {
        return;
      }
      const now = Date.now();
      if (!isUserInitiatedSync(trigger) && now < nextAutomaticRetryAt) {
        return;
      }
      if (!force && now - lastCycleAt < 750) {
        return;
      }

      const generation = coordinatorGeneration;
      const promise = runSyncCycle(this, userId, generation);
      activeCycle = { generation, promise, store: this, userId };
      try {
        await promise;
      } finally {
        if (activeCycle?.promise === promise) {
          activeCycle = null;
          lastCycleAt = Date.now();
        }
      }
    },
    async syncNow(options: { force?: boolean; reason?: SyncTrigger } = {}) {
      await this.requestSync(options.reason ?? "manual", options.force ?? true);
    },
    async refresh(userId?: string, options: { fetchServer?: boolean } = {}) {
      const id = userId ?? this.lastUserId;
      if (!id) {
        return;
      }
      this.offline = !navigator.onLine;
      const localState = await getSyncStateForUser(id);
      const counts = await getPendingCounts(id);
      this.status =
        counts.conflict > 0
          ? "CONFLICT"
          : counts.pending > 0 && localState.status === "SYNCED"
            ? "PENDING_SYNC"
            : localState.status;
      this.lastSyncedAt = localState.lastSyncedAt;
      this.pendingCount = counts.pending;
      this.conflictCount = counts.conflict;
      const all = await listPendingForUser(id);
      this.conflicts = all.filter((item) => item.status === "CONFLICT");

      const auth = useAuthStore();
      if (
        options.fetchServer !== false &&
        navigator.onLine &&
        !auth.offlineMode &&
        auth.accessToken
      ) {
        try {
          const serverStatus = await api.getSyncStatus();
          this.failedCount = serverStatus.failedCount;
          this.lastAppliedAt = serverStatus.lastAppliedAt;
        } catch (error) {
          if (!isOfflineError(error)) {
            noteSyncFailure(error);
            this.errorMessage = messageOf(error);
            this.status = "SYNC_FAILED";
          }
        }
      }
      this.syncing = this.syncing || isSyncing();
    },
    async handleChange() {
      const userId = this.lastUserId;
      if (!userId) {
        return;
      }
      await this.refresh(userId, { fetchServer: false });
      if (navigator.onLine && !useAuthStore().offlineMode && !this.syncing) {
        void this.requestSync("mutation", true);
      }
    },
    stop() {
      coordinatorGeneration += 1;
      stopPolling();
      stopSync();
      resetFailureBackoff();
      this.initialized = false;
      this.lastUserId = null;
      this.syncing = false;
    },
    async retry(userId?: string) {
      const id = userId ?? this.lastUserId;
      if (!id) {
        return;
      }
      if (this.lastUserId !== id) {
        this.lastUserId = id;
      }
      await this.requestSync("manual", true);
    },
    async resolve(
      userId: string,
      mutationId: string,
      choice: "local" | "server",
    ) {
      await resolveConflict(userId, mutationId, choice);
      await this.requestSync("manual", true);
    },
    async markOnline() {
      this.offline = false;
      await this.requestSync("online", true);
    },
    async markOffline() {
      this.offline = true;
      await this.refresh(this.lastUserId ?? undefined, { fetchServer: false });
    },
  },
});

type SyncStore = ReturnType<typeof useSyncStore>;

async function runSyncCycle(
  store: SyncStore,
  userId: string,
  generation: number,
): Promise<void> {
  store.syncing = true;
  store.errorMessage = null;
  try {
    const pulled = await pullChanges(userId, undefined, {
      throwOnError: true,
    });
    if (!isCurrent(store, userId, generation)) {
      return;
    }
    const flushed = await flushPending(userId, undefined, {
      throwOnError: true,
    });
    if (!isCurrent(store, userId, generation)) {
      return;
    }

    const changed = new Set<SyncEntityType>([
      ...pulled.changedEntityTypes,
      ...flushed.changedEntityTypes,
    ]);
    if (changed.size > 0) {
      await refreshStores(changed);
    }
    if (!isCurrent(store, userId, generation)) {
      return;
    }
    const storeError = firstStoreError(changed);
    if (storeError) {
      noteSyncFailure(new Error(storeError));
      await markSyncFailed(userId);
      store.errorMessage = storeError;
    } else {
      resetFailureBackoff();
    }
  } catch (error) {
    if (isCurrent(store, userId, generation)) {
      noteSyncFailure(error);
      await markSyncFailed(userId);
      store.errorMessage = messageOf(error);
    }
  } finally {
    if (isCurrent(store, userId, generation)) {
      store.syncing = false;
      await store.refresh(userId, { fetchServer: true });
    }
  }
}

async function refreshStores(changed: Set<SyncEntityType>): Promise<void> {
  const plannerTypes = new Set<SyncEntityType>([
    "CALENDAR_EVENT",
    "TASK",
    "REMINDER",
  ]);
  const financeTypes = new Set<SyncEntityType>([
    "TRANSACTION",
    "CATEGORY",
    "FINANCIAL_ACCOUNT",
    "BUDGET",
  ]);

  const requests: Promise<unknown>[] = [];
  if ([...changed].some((type) => plannerTypes.has(type))) {
    requests.push(usePlannerStore().refreshForSync([...changed]));
  }
  if ([...changed].some((type) => financeTypes.has(type))) {
    requests.push(useFinanceStore().refreshForSync([...changed]));
  }
  if (changed.has("DRAFT_RECORD")) {
    requests.push(useDraftsStore().refreshForSync());
  }
  if (
    changed.has("TRIP") ||
    changed.has("TRIP_ITEM") ||
    changed.has("PACKING_ITEM")
  ) {
    requests.push(useTripsStore().refreshForSync());
  }
  await Promise.all(requests);
}

function firstStoreError(changed: Set<SyncEntityType>): string | null {
  if (
    [...changed].some((type) =>
      ["CALENDAR_EVENT", "TASK", "REMINDER"].includes(type),
    )
  ) {
    const error = usePlannerStore().errorMessage;
    if (error) return error;
  }
  if (
    [...changed].some((type) =>
      ["TRANSACTION", "CATEGORY", "FINANCIAL_ACCOUNT", "BUDGET"].includes(type),
    )
  ) {
    const error = useFinanceStore().errorMessage;
    if (error) return error;
  }
  if (changed.has("DRAFT_RECORD")) {
    const error = useDraftsStore().errorMessage;
    if (error) return error;
  }
  if (
    changed.has("TRIP") ||
    changed.has("TRIP_ITEM") ||
    changed.has("PACKING_ITEM")
  ) {
    const error = useTripsStore().errorMessage;
    if (error) return error;
  }
  return null;
}

function isCurrent(
  store: SyncStore,
  userId: string,
  generation: number,
): boolean {
  return (
    activeCycle?.store === store &&
    activeCycle.userId === userId &&
    generation === coordinatorGeneration &&
    store.lastUserId === userId &&
    store.initialized
  );
}

function installPolling(store: SyncStore): void {
  stopPolling();
  pollTimer = setInterval(() => {
    void store.requestSync("poll");
  }, SYNC_POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function isUserInitiatedSync(trigger: SyncTrigger): boolean {
  return trigger === "login" || trigger === "manual";
}

function noteSyncFailure(error: unknown): void {
  const delay = isSyncRateLimitedError(error)
    ? SYNC_RATE_LIMIT_COOLDOWN_MS
    : failureBackoffMs;
  nextAutomaticRetryAt = Math.max(nextAutomaticRetryAt, Date.now() + delay);
  failureBackoffMs = Math.min(
    failureBackoffMs * 2,
    SYNC_FAILURE_BACKOFF_MAX_MS,
  );
}

function resetFailureBackoff(): void {
  nextAutomaticRetryAt = 0;
  failureBackoffMs = SYNC_FAILURE_BACKOFF_INITIAL_MS;
}

function messageOf(error: unknown): string {
  if (isSyncRateLimitedError(error)) {
    return "同步请求过于频繁，已暂停自动重试，请稍后重试";
  }
  return error instanceof Error ? error.message : "同步失败，请稍后重试";
}
