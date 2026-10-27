<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";

defineProps<{ disabled?: boolean; label?: string }>();
const disclosure = ref<HTMLDetailsElement | null>(null);
const trigger = ref<HTMLElement | null>(null);

function close(restoreFocus = false) {
  if (!disclosure.value?.open) return;
  disclosure.value.open = false;
  if (restoreFocus) trigger.value?.focus();
}
function actionClick(event: MouseEvent) {
  if ((event.target as Element)?.closest("button, a")) close(true);
}
function outsideClick(event: PointerEvent) {
  if (!disclosure.value?.contains(event.target as Node)) close();
}
onMounted(() => document.addEventListener("pointerdown", outsideClick));
onBeforeUnmount(() =>
  document.removeEventListener("pointerdown", outsideClick),
);
</script>

<template>
  <details
    ref="disclosure"
    class="record-more"
    @keydown.esc.stop.prevent="close(true)"
  >
    <summary
      ref="trigger"
      :aria-label="label ?? '更多操作'"
      :aria-disabled="disabled || undefined"
      @click="disabled && $event.preventDefault()"
    >
      <AppIcon name="more" :size="22" />
    </summary>
    <div
      class="record-more__items"
      role="group"
      :aria-label="label ?? '更多操作'"
      @click.capture="actionClick"
    >
      <slot />
    </div>
  </details>
</template>
