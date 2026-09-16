<script setup lang="ts">
import { ref } from "vue";

withDefaults(
  defineProps<{
    actionLabel?: string;
    description: string;
    title?: string;
  }>(),
  { actionLabel: undefined, title: "暂时无法加载" },
);

const emit = defineEmits<{ retry: [] }>();
const retryEmitted = ref(false);

function handleRetry() {
  if (retryEmitted.value) return;
  retryEmitted.value = true;
  emit("retry");
}
</script>

<template>
  <section class="feedback-state feedback-error-state" role="alert">
    <span aria-hidden="true" class="feedback-state-indicator">!</span>
    <h2 class="feedback-state-title">{{ title }}</h2>
    <p class="feedback-state-description">{{ description }}</p>
    <button
      v-if="actionLabel"
      class="feedback-state-action secondary-button"
      type="button"
      @click="handleRetry"
    >
      {{ actionLabel }}
    </button>
  </section>
</template>
