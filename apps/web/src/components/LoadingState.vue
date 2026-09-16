<script setup lang="ts">
withDefaults(
  defineProps<{
    description?: string;
    title?: string;
  }>(),
  { description: undefined, title: "加载中" },
);
</script>

<template>
  <section
    class="feedback-state feedback-loading-state"
    aria-busy="true"
    aria-live="polite"
    role="status"
  >
    <span aria-hidden="true" class="feedback-state-indicator" />
    <h2 class="feedback-state-title">{{ title }}</h2>
    <p v-if="description" class="feedback-state-description">
      {{ description }}
    </p>
  </section>
</template>
