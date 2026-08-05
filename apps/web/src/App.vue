<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <span class="wordmark">Daily Assistant</span>
      <span class="badge">WP1</span>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
