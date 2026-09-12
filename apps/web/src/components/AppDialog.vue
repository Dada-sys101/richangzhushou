<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  closeOnBackdrop?: boolean;
  labelledby: string;
  open: boolean;
}>();
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null;
      document.documentElement.classList.add("app-dialog-open");
      await nextTick();
      focusableElements()[0]?.focus();
      return;
    }
    cleanup();
  },
  { immediate: true },
);

onBeforeUnmount(cleanup);

function cleanup() {
  document.documentElement.classList.remove("app-dialog-open");
  previousFocus?.focus();
  previousFocus = null;
}

function focusableElements(): HTMLElement[] {
  return Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  );
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }
  if (event.key !== "Tab") return;
  const elements = focusableElements();
  if (elements.length === 0) {
    event.preventDefault();
    panel.value?.focus();
    return;
  }
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-dialog-backdrop"
      @mousedown.self="closeOnBackdrop && emit('close')"
    >
      <section
        ref="panel"
        class="app-dialog-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="labelledby"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <slot />
      </section>
    </div>
  </Teleport>
</template>
