<script setup lang="ts">
withDefaults(defineProps<{ message: string; tone?: "error" | "success" }>(), {
  tone: "success",
});
</script>

<template>
  <p
    class="app-toast"
    :class="`app-toast-${tone}`"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    {{ message }}
  </p>
</template>
