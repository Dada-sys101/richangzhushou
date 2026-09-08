<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";

import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";

const auth = useAuthStore();
const sync = useSyncStore();
const installPrompt = ref<{ prompt: () => Promise<void> } | null>(null);

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

onMounted(() => {
  window.addEventListener("beforeinstallprompt", handleInstallPrompt);
  window.addEventListener("appinstalled", handleInstalled);
});

onUnmounted(() => {
  window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  window.removeEventListener("appinstalled", handleInstalled);
});

function handleInstallPrompt(event: Event) {
  event.preventDefault();
  installPrompt.value = event as unknown as {
    prompt: () => Promise<void>;
  };
}

function handleInstalled() {
  installPrompt.value = null;
}

async function install() {
  if (!installPrompt.value) {
    return;
  }
  await installPrompt.value.prompt();
  installPrompt.value = null;
}
</script>

<template>
  <div class="sync-area">
    <button
      v-if="installPrompt"
      class="install-button"
      type="button"
      @click="install"
    >
      安装应用
    </button>
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
