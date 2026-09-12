<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";

const auth = useAuthStore();
const sync = useSyncStore();

const label = computed(() => {
  if (sync.syncing) {
    return "同步中";
  }
  switch (sync.status) {
    case "PENDING_SYNC":
      return "同步中";
    case "SYNC_FAILED":
      return "同步失败";
    case "CONFLICT":
      return "有冲突";
    default:
      return "已同步";
  }
});

const lastSyncLabel = computed(() => {
  if (!sync.lastSyncedAt) {
    return "未同步";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(sync.lastSyncedAt));
});
</script>

<template>
  <div class="sync-area">
    <div
      v-if="auth.isAuthenticated"
      class="sync-badge"
      :class="`status-${sync.status}`"
      role="status"
    >
      <span class="sync-dot" aria-hidden="true"></span>
      <span>{{ label }}</span>
      <span class="sync-last">最近同步 {{ lastSyncLabel }}</span>
      <span v-if="sync.pendingCount > 0" class="sync-count">{{
        sync.pendingCount
      }}</span>
      <span v-if="sync.failedCount > 0" class="sync-failed-count"
        >失败 {{ sync.failedCount }}</span
      >
      <RouterLink
        v-if="sync.conflictCount > 0"
        class="conflict-link"
        to="/sync/conflicts"
      >
        冲突 {{ sync.conflictCount }}
      </RouterLink>
      <button
        v-if="sync.status === 'SYNC_FAILED'"
        class="retry-button"
        type="button"
        @click="sync.retry()"
      >
        重试
      </button>
    </div>
    <p v-if="auth.isAuthenticated && sync.errorMessage" class="sync-error">
      {{ sync.errorMessage }}
    </p>
  </div>
</template>
