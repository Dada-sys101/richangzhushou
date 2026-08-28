<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: "sm" | "md" | "lg";
  }>(),
  { size: "md" },
);
</script>

<template>
  <span
    class="assistant-mark"
    :class="`assistant-mark--${size}`"
    aria-hidden="true"
  >
    <span class="assistant-mark__spark"></span>
    <span class="assistant-mark__face"><i></i><i></i><b></b></span>
  </span>
</template>
