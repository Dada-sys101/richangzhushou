<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { RouterView } from "vue-router";

import BottomNav from "./components/BottomNav.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { router } from "./router";
import { useAuthStore } from "./stores/auth";
import { useSyncStore } from "./stores/sync";

const auth = useAuthStore();
const sync = useSyncStore();
const removeRouteHook = router.afterEach(() => {
  void sync.requestSync("route");
});

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
  window.addEventListener("focus", handleFocus);
  window.addEventListener("daily-sync-changed", handleSyncChanged);
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  window.removeEventListener("focus", handleFocus);
  window.removeEventListener("daily-sync-changed", handleSyncChanged);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  removeRouteHook();
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

function handleFocus() {
  void sync.requestSync("focus");
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    void sync.requestSync("visibility");
  }
}

function handleSyncChanged(event: Event) {
  const reason =
    event instanceof CustomEvent && event.detail?.reason === "mutation"
      ? "mutation"
      : "state";
  if (reason === "mutation") {
    void sync.handleChange();
    return;
  }
  void sync.refresh(undefined, { fetchServer: false });
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
