<script setup lang="ts">
import { RouterLink } from "vue-router";

import AppIcon from "./AppIcon.vue";

const props = defineProps<{
  action?: { label: string; onClick?: () => void; to?: string };
  description: string;
  icon: string;
  title: string;
}>();

const instanceId = Math.random().toString(36).slice(2, 10);
const titleId = `empty-state-title-${instanceId}`;
const descriptionId = `empty-state-description-${instanceId}`;
</script>

<template>
  <section
    class="empty-state"
    :aria-describedby="descriptionId"
    :aria-labelledby="titleId"
  >
    <span aria-hidden="true" class="empty-state-icon">
      <AppIcon :name="icon" :size="28" />
    </span>
    <h2 :id="titleId" class="empty-state-title">{{ props.title }}</h2>
    <p :id="descriptionId" class="empty-state-copy">
      {{ props.description }}
    </p>
    <div v-if="props.action" class="empty-state-action">
      <RouterLink
        v-if="props.action.to"
        class="secondary-button"
        :to="props.action.to"
      >
        {{ props.action.label }}
      </RouterLink>
      <button
        v-else
        class="secondary-button"
        type="button"
        @click="props.action.onClick?.()"
      >
        {{ props.action.label }}
      </button>
    </div>
  </section>
</template>
