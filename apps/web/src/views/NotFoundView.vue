<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section class="hero" aria-labelledby="not-found-title">
    <p class="eyebrow">404</p>
    <h1 id="not-found-title">这个页面还不存在。</h1>
    <p class="lede">当前仅有 WP1 工程空壳。</p>
    <RouterLink class="home-link" to="/">返回首页</RouterLink>
  </section>
</template>
