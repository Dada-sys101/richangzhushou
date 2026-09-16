<script setup lang="ts">
type ToastTone = "error" | "info" | "success" | "warning";

const props = withDefaults(
  defineProps<{ message: string; tone?: ToastTone }>(),
  { tone: "success" },
);
</script>

<template>
  <p
    class="app-toast"
    :class="`app-toast-${props.tone}`"
    :role="props.tone === 'error' ? 'alert' : 'status'"
    :aria-live="props.tone === 'error' ? 'assertive' : 'polite'"
    aria-atomic="true"
  >
    {{ props.message }}
  </p>
</template>
