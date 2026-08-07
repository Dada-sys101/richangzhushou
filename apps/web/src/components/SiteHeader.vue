<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import AppIcon from "./AppIcon.vue";
import SyncBadge from "./SyncBadge.vue";

const auth = useAuthStore();
const route = useRoute();
const sync = useSyncStore();
const moreOpen = ref(false);
const moreRef = ref<HTMLElement | null>(null);

const moreItems = computed(() => {
  const items = [
    { icon: "pen", label: "快捷记录", to: "/capture" },
    { icon: "file", label: "草稿中心", to: "/drafts" },
    { icon: "zap", label: "快捷指令", to: "/shortcuts" },
    { icon: "bell", label: "提醒", to: "/reminders" },
    { icon: "budget", label: "预算", to: "/finance/budgets" },
    { icon: "tags", label: "分类", to: "/finance/categories" },
    { icon: "card", label: "资金账户", to: "/finance/accounts" },
    { icon: "settings", label: "个人设置", to: "/account" },
  ];
  if (sync.conflictCount > 0) {
    items.push({ icon: "alert", label: "同步冲突", to: "/sync/conflicts" });
  }
  return items;
});

function toggleMore() {
  moreOpen.value = !moreOpen.value;
}

function onDocumentClick(event: MouseEvent) {
  if (moreRef.value && !moreRef.value.contains(event.target as Node)) {
    moreOpen.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    moreOpen.value = false;
  }
}

watch(
  () => route.fullPath,
  () => {
    moreOpen.value = false;
  },
);

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <header class="site-header">
    <RouterLink class="wordmark" to="/">日常助手</RouterLink>
    <div class="header-right">
      <nav v-if="auth.isAuthenticated" class="site-nav" aria-label="主导航">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/calendar">日程</RouterLink>
        <RouterLink to="/tasks">待办</RouterLink>
        <RouterLink to="/transactions">财务</RouterLink>
        <RouterLink to="/trips">行程</RouterLink>
      </nav>
      <div v-if="auth.isAuthenticated" ref="moreRef" class="more-menu">
        <button
          class="more-trigger"
          :aria-expanded="moreOpen"
          aria-haspopup="menu"
          type="button"
          @click="toggleMore"
        >
          更多
          <AppIcon name="chevron-down" :size="14" />
        </button>
        <div v-if="moreOpen" class="more-panel" role="menu">
          <RouterLink
            v-for="item in moreItems"
            :key="item.to"
            class="more-item"
            :to="item.to"
            role="menuitem"
          >
            <AppIcon :name="item.icon" :size="18" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </div>
      <SyncBadge />
    </div>
  </header>
</template>
