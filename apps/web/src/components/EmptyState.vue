<script setup lang="ts">
import { RouterLink } from "vue-router";

import AppIcon from "./AppIcon.vue";

defineProps<{
  action?: { label: string; to: string };
  description: string;
  icon: string;
  title: string;
}>();
</script>

<template>
  <div class="empty-state">
    <span class="empty-state-icon">
      <AppIcon :name="icon" :size="28" />
    </span>
    <strong class="empty-state-title">{{ title }}</strong>
    <p class="empty-state-copy">{{ description }}</p>
    <RouterLink v-if="action" class="secondary-button" :to="action.to">
      {{ action.label }}
    </RouterLink>
  </div>
</template>
