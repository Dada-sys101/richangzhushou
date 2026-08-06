<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { RouterView } from "vue-router";

import SyncBadge from "./components/SyncBadge.vue";
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
    <header class="site-header">
      <span class="wordmark">Daily Assistant</span>
      <nav class="site-nav">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/capture">快捷记录</RouterLink>
        <RouterLink to="/drafts">草稿</RouterLink>
        <RouterLink to="/shortcuts">快捷指令</RouterLink>
        <RouterLink to="/transactions">记账</RouterLink>
        <RouterLink to="/finance/budgets">预算</RouterLink>
        <RouterLink to="/finance/categories">分类</RouterLink>
        <RouterLink to="/finance/accounts">账户</RouterLink>
        <RouterLink to="/account">账号</RouterLink>
        <SyncBadge />
      </nav>
    </header>
    <p
      v-if="sync.offline && auth.isAuthenticated"
      class="offline-banner"
      role="status"
    >
      当前离线，新记录将保存在本地并在联网后同步。
    </p>
    <main>
      <RouterView />
    </main>
  </div>
</template>
