<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    tone?: "default" | "muted" | "danger";
  }>(),
  { description: undefined, title: undefined, tone: "default" },
);
</script>

<template>
  <section class="section-card" :class="`section-card-${tone}`">
    <header v-if="title || description" class="section-card-header">
      <h2 v-if="title">{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </header>
    <div class="section-card-body"><slot /></div>
  </section>
</template>
