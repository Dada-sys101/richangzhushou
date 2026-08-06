<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { RouterView } from "vue-router";

import BottomNav from "./components/BottomNav.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { useAuthStore } from "./stores/auth";
import { useSyncStore } from "./stores/sync";

const auth = useAuthStore();
const sync = useSyncStore();

watch(
  () => auth.isAuthenticated,
  async (authenticated) => {
    if (authenticated) {
      const userId = auth.userId;
      if (userId) {
        await sync.start(userId);
      }
    } else {
      sync.stop();
    }
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
});

onUnmounted(() => {
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
});

async function handleOnline() {
  if (!navigator.onLine) {
    return;
  }
  if (auth.offlineMode) {
    try {
      await auth.refresh();
    } catch {
      // still offline; keep local mode
    }
    if (auth.accessToken) {
      auth.exitOfflineMode();
    }
  }
  await sync.markOnline();
}

function handleOffline() {
  void sync.markOffline();
}
</script>

<template>
  <div class="app-shell">
    <SiteHeader />
    <p
      v-if="sync.offline && auth.isAuthenticated"
      class="offline-banner"
      role="status"
    >
      当前离线，新记录将保存在本地并在联网后同步。
    </p>
    <main class="app-main">
      <RouterView />
    </main>
    <BottomNav v-if="auth.isAuthenticated" />
  </div>
</template>
