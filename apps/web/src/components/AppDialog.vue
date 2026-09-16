<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  closeOnBackdrop?: boolean;
  describedby?: string;
  labelledby: string;
  open: boolean;
}>();
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);

const scrollLockStateKey = Symbol.for(
  "daily-assistant.app-dialog.scroll-lock-count",
);
type DialogDocument = Document & { [key: symbol]: number | undefined };
let previousFocus: HTMLElement | null = null;
let openCycleActive = false;
let closeEmitted = false;
let scrollLockHeld = false;

watch(
  () => props.open,
  (open) => {
    if (open) {
      if (openCycleActive) return;
      openCycleActive = true;
      closeEmitted = false;
      previousFocus = activeElement();
      acquireScrollLock();
      void focusInitialElement();
      return;
    }
    cleanup();
  },
  { immediate: true },
);

onBeforeUnmount(cleanup);

function activeElement(): HTMLElement | null {
  const element = document.activeElement;
  return element instanceof HTMLElement ? element : null;
}

function acquireScrollLock() {
  if (scrollLockHeld) return;
  const dialogDocument = document as DialogDocument;
  dialogDocument[scrollLockStateKey] =
    (dialogDocument[scrollLockStateKey] ?? 0) + 1;
  scrollLockHeld = true;
  document.documentElement.classList.add("app-dialog-open");
}

function releaseScrollLock() {
  if (!scrollLockHeld) return;
  const dialogDocument = document as DialogDocument;
  const count = Math.max(0, (dialogDocument[scrollLockStateKey] ?? 1) - 1);
  dialogDocument[scrollLockStateKey] = count;
  scrollLockHeld = false;
  if (count === 0) {
    delete dialogDocument[scrollLockStateKey];
    document.documentElement.classList.remove("app-dialog-open");
  }
}

function cleanup() {
  if (!openCycleActive) return;
  openCycleActive = false;
  closeEmitted = false;
  releaseScrollLock();
  const element = previousFocus;
  previousFocus = null;
  if (!element?.isConnected) return;
  try {
    element.focus();
  } catch {
    // A focus target can be detached by a concurrent unmount between the
    // connection check and focus(). Closing must remain safe in that case.
  }
}

async function focusInitialElement() {
  await nextTick();
  if (!openCycleActive || !props.open) return;
  const dialogPanel = panel.value;
  if (!dialogPanel) return;

  const marked = dialogPanel.matches("[data-dialog-initial-focus]")
    ? dialogPanel
    : dialogPanel.querySelector<HTMLElement>("[data-dialog-initial-focus]");
  const target =
    (marked && isProgrammaticallyFocusable(marked) ? marked : null) ??
    focusableElements()[0] ??
    dialogPanel;
  try {
    target.focus();
  } catch {
    // Focus is best effort; opening the dialog must not throw when a slot
    // changes during the opening tick.
  }
}

function focusableElements(): HTMLElement[] {
  return Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      'button, [href], input:not([type="hidden"]), select, textarea, [contenteditable="true"], [tabindex]',
    ) ?? [],
  ).filter(
    (element) => isProgrammaticallyFocusable(element) && element.tabIndex >= 0,
  );
}

function isProgrammaticallyFocusable(element: HTMLElement): boolean {
  if (!element.isConnected || element.hidden) return false;
  if (
    element.closest("[hidden], [inert], [aria-hidden='true']") ||
    element.getAttribute("aria-disabled") === "true"
  ) {
    return false;
  }
  if (element.matches(":disabled")) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return typeof element.focus === "function";
}

function requestClose() {
  if (closeEmitted) return;
  closeEmitted = true;
  emit("close");
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target !== event.currentTarget || !props.closeOnBackdrop) return;
  requestClose();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    requestClose();
    return;
  }
  if (event.key !== "Tab") return;

  const dialogPanel = panel.value;
  if (!dialogPanel) return;
  const elements = focusableElements();
  if (elements.length === 0) {
    event.preventDefault();
    dialogPanel.focus();
    return;
  }

  const current = document.activeElement;
  const currentIndex = elements.indexOf(current as HTMLElement);
  if (currentIndex < 0) {
    event.preventDefault();
    (event.shiftKey ? elements[elements.length - 1] : elements[0])?.focus();
    return;
  }

  if (event.shiftKey && currentIndex === 0) {
    event.preventDefault();
    elements[elements.length - 1]?.focus();
  } else if (!event.shiftKey && currentIndex === elements.length - 1) {
    event.preventDefault();
    elements[0]?.focus();
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="app-dialog-backdrop"
      @click.self="handleBackdropClick"
      @mousedown.self="handleBackdropClick"
    >
      <section
        ref="panel"
        class="app-dialog-panel"
        role="dialog"
        aria-modal="true"
        :aria-describedby="describedby"
        :aria-labelledby="labelledby"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <slot />
      </section>
    </div>
  </Teleport>
</template>
