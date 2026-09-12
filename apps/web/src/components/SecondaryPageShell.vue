<script setup lang="ts">
import PageHeader from "./PageHeader.vue";

withDefaults(
  defineProps<{
    title: string;
    titleId: string;
    subtitle?: string;
  }>(),
  { subtitle: undefined },
);
</script>

<template>
  <section class="secondary-page" :aria-labelledby="titleId">
    <PageHeader :title="title" :title-id="titleId" :subtitle="subtitle">
      <template v-if="$slots.actions" #actions
        ><slot name="actions"
      /></template>
    </PageHeader>
    <div class="secondary-page-content"><slot /></div>
  </section>
</template>
