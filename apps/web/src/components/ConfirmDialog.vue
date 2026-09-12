<script setup lang="ts">
import AppDialog from "./AppDialog.vue";

withDefaults(
  defineProps<{
    cancelLabel?: string;
    confirmLabel?: string;
    description: string;
    destructive?: boolean;
    open: boolean;
    title?: string;
  }>(),
  {
    cancelLabel: "取消",
    confirmLabel: "确认",
    destructive: false,
    title: "请确认",
  },
);
const emit = defineEmits<{ cancel: []; confirm: [] }>();
const titleId = "app-confirm-title";
</script>

<template>
  <AppDialog :labelledby="titleId" :open="open" @close="emit('cancel')">
    <h2 :id="titleId">{{ title }}</h2>
    <p class="app-dialog-description">{{ description }}</p>
    <div class="app-dialog-actions">
      <button type="button" class="secondary" @click="emit('cancel')">
        {{ cancelLabel }}
      </button>
      <button
        type="button"
        :class="destructive ? 'danger' : 'primary'"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </AppDialog>
</template>
