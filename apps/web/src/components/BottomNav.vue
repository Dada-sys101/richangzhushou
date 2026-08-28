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
    <RouterLink class="bottom-nav-item" to="/records">
      <AppIcon name="receipt" :size="22" />
      <span>记录</span>
    </RouterLink>
    <RouterLink class="bottom-nav-fab" to="/capture" aria-label="统一录入">
      <AppIcon name="plus" :size="26" />
    </RouterLink>
    <RouterLink class="bottom-nav-item" to="/plan">
      <AppIcon name="calendar" :size="22" />
      <span>计划</span>
    </RouterLink>
    <RouterLink class="bottom-nav-item" to="/account">
      <AppIcon name="user" :size="22" />
      <span>我的</span>
    </RouterLink>
  </nav>
</template>
