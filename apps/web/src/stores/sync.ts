import { defineStore } from "pinia";

import {
  flushPending,
  getPendingCounts,
  getSyncStatusForUser,
  initSync,
  listPendingForUser,
  resolveConflict,
  stopSync,
  type PendingMutation,
  type SyncStatus,
} from "../offline/sync";

interface SyncState {
  conflictCount: number;
  conflicts: PendingMutation[];
  initialized: boolean;
  lastUserId: string | null;
  offline: boolean;
  pendingCount: number;
  status: SyncStatus;
}

export const useSyncStore = defineStore("sync", {
  state: (): SyncState => ({
    conflictCount: 0,
    conflicts: [],
    initialized: false,
    lastUserId: null,
    offline: !navigator.onLine,
    pendingCount: 0,
    status: "SYNCED",
  }),
  actions: {
    async start(userId: string) {
      this.lastUserId = userId;
      await initSync(userId);
      this.initialized = true;
      await this.refresh(userId);
    },
    async refresh(userId?: string) {
      const id = userId ?? this.lastUserId;
      if (!id) {
        return;
      }
      this.offline = !navigator.onLine;
      this.status = await getSyncStatusForUser(id);
      const counts = await getPendingCounts(id);
      this.pendingCount = counts.pending;
      this.conflictCount = counts.conflict;
      const all = await listPendingForUser(id);
      this.conflicts = all.filter((item) => item.status === "CONFLICT");
    },
    stop() {
      stopSync();
      this.initialized = false;
      this.lastUserId = null;
    },
    async retry(userId?: string) {
      const id = userId ?? this.lastUserId;
      if (!id) {
        return;
      }
      await flushPending(id);
      await this.refresh(id);
    },
    async resolve(
      userId: string,
      mutationId: string,
      choice: "local" | "server",
    ) {
      await resolveConflict(userId, mutationId, choice);
      await this.refresh(userId);
    },
    async markOnline() {
      this.offline = false;
      if (this.lastUserId) {
        await this.retry(this.lastUserId);
      }
    },
    async markOffline() {
      this.offline = true;
    },
  },
});
