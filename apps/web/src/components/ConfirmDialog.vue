<script setup lang="ts">
import { watch } from "vue";

import AppDialog from "./AppDialog.vue";

const props = withDefaults(
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
const descriptionId = "app-confirm-description";
let openCycleActive = false;
let actionEmitted = false;

watch(
  () => props.open,
  (open) => {
    if (open) {
      if (openCycleActive) return;
      openCycleActive = true;
      actionEmitted = false;
      return;
    }
    openCycleActive = false;
    actionEmitted = false;
  },
  { immediate: true },
);

function emitAction(action: "cancel" | "confirm") {
  if (!props.open || !openCycleActive || actionEmitted) return;
  actionEmitted = true;
  if (action === "cancel") {
    emit("cancel");
  } else {
    emit("confirm");
  }
}

function handleActionKeydown(
  event: KeyboardEvent,
  action: "cancel" | "confirm",
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  emitAction(action);
}
</script>

<template>
  <AppDialog
    :describedby="descriptionId"
    :labelledby="titleId"
    :open="open"
    @close="emitAction('cancel')"
  >
    <h2 :id="titleId">{{ title }}</h2>
    <p :id="descriptionId" class="app-dialog-description">
      {{ description }}
    </p>
    <div class="app-dialog-actions">
      <button
        type="button"
        class="secondary"
        data-dialog-initial-focus
        @click="emitAction('cancel')"
        @keydown="handleActionKeydown($event, 'cancel')"
      >
        {{ cancelLabel }}
      </button>
      <button
        type="button"
        :class="destructive ? 'danger' : 'primary'"
        @click="emitAction('confirm')"
        @keydown="handleActionKeydown($event, 'confirm')"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </AppDialog>
</template>
