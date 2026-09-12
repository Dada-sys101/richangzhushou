<script setup lang="ts">
import AppDialog from "./AppDialog.vue";

defineProps<{ labelledby: string; open: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <AppDialog
    :labelledby="labelledby"
    :open="open"
    close-on-backdrop
    @close="emit('close')"
  >
    <div class="app-action-sheet"><slot /></div>
  </AppDialog>
</template>
