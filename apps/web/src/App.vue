<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <span class="wordmark">Daily Assistant</span>
      <nav class="site-nav">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/transactions">记账</RouterLink>
        <RouterLink to="/finance/budgets">预算</RouterLink>
        <RouterLink to="/finance/categories">分类</RouterLink>
        <RouterLink to="/finance/accounts">账户</RouterLink>
        <RouterLink to="/account">账号</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
