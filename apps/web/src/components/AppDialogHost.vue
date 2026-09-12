<script setup lang="ts">
import {
  appConfirmState,
  resolveAppConfirm,
} from "../composables/useAppConfirm";
import ConfirmDialog from "./ConfirmDialog.vue";
</script>

<template>
  <ConfirmDialog
    :cancel-label="appConfirmState.cancelLabel"
    :confirm-label="appConfirmState.confirmLabel"
    :description="appConfirmState.description"
    :destructive="appConfirmState.destructive"
    :open="appConfirmState.open"
    :title="appConfirmState.title"
    @cancel="resolveAppConfirm(false)"
    @confirm="resolveAppConfirm(true)"
  />
</template>
