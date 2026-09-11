<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

import AppIcon from "./AppIcon.vue";
import { navigate } from "../navigation-policy";

const router = useRouter();
const route = useRoute();

const items = [
  { icon: "home", label: "首页", to: "/" },
  { icon: "receipt", label: "记录", to: "/records" },
  { icon: "calendar", label: "计划", to: "/plan" },
  { icon: "user", label: "我的", to: "/account" },
] as const;

function isActive(target: string) {
  return route.path === target;
}

function go(target: string) {
  void navigate(router, target);
}
</script>

<template>
  <nav class="bottom-nav" aria-label="底部导航">
    <a
      v-for="item in items.slice(0, 2)"
      :key="item.to"
      class="bottom-nav-item"
      :class="{ 'router-link-active': isActive(item.to) }"
      :href="router.resolve(item.to).href"
      @click.prevent="go(item.to)"
    >
      <AppIcon :name="item.icon" :size="22" />
      <span>{{ item.label }}</span>
    </a>
    <a
      class="bottom-nav-fab"
      :href="router.resolve('/capture').href"
      aria-label="快速新增"
      @click.prevent="go('/capture')"
    >
      <AppIcon name="plus" :size="26" />
    </a>
    <a
      v-for="item in items.slice(2)"
      :key="item.to"
      class="bottom-nav-item"
      :class="{ 'router-link-active': isActive(item.to) }"
      :href="router.resolve(item.to).href"
      @click.prevent="go(item.to)"
    >
      <AppIcon :name="item.icon" :size="22" />
      <span>{{ item.label }}</span>
    </a>
  </nav>
</template>
