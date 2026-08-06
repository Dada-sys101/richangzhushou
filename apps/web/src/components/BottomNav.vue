<script setup lang="ts">
import { RouterLink } from "vue-router";

import AppIcon from "./AppIcon.vue";
</script>

<template>
  <nav class="bottom-nav" aria-label="底部导航">
    <RouterLink class="bottom-nav-item" to="/">
      <AppIcon name="home" :size="22" />
      <span>首页</span>
    </RouterLink>
    <RouterLink class="bottom-nav-item" to="/calendar">
      <AppIcon name="calendar" :size="22" />
      <span>日程</span>
    </RouterLink>
    <RouterLink
      class="bottom-nav-fab"
      to="/transactions/new"
      aria-label="记一笔"
    >
      <AppIcon name="plus" :size="26" />
    </RouterLink>
    <RouterLink class="bottom-nav-item" to="/tasks">
      <AppIcon name="tasks" :size="22" />
      <span>待办</span>
    </RouterLink>
    <RouterLink class="bottom-nav-item" to="/account">
      <AppIcon name="user" :size="22" />
      <span>我的</span>
    </RouterLink>
  </nav>
</template>
