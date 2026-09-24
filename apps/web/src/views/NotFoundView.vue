<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section class="hero not-found-page" aria-labelledby="not-found-title">
    <p class="eyebrow">404 · 页面未找到</p>
    <h1 id="not-found-title">找不到这个页面</h1>
    <p class="lede">
      页面可能不存在，或地址输入有误。请检查地址，也可以返回首页。
    </p>
    <RouterLink class="primary-button not-found-home" to="/"
      >返回首页</RouterLink
    >
  </section>
</template>
