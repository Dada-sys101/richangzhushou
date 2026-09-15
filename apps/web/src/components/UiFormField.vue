<script setup lang="ts">
import { Comment, Fragment, computed, useId, useSlots } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    for?: string;
    required?: boolean;
    help?: string;
    error?: string;
  }>(),
  {
    error: undefined,
    for: undefined,
    help: undefined,
    required: false,
  },
);

const slots = useSlots();
const generatedId = useId();
const controlId = computed(() => props.for ?? `ui-form-field-${generatedId}`);
const helpId = computed(() => `${controlId.value}-help`);
const errorId = computed(() => `${controlId.value}-error`);
const hasHelp = computed(() => Boolean(props.help) || hasSlotContent("help"));
const hasError = computed(() => Boolean(props.error));
const describedBy = computed(() => {
  if (hasError.value) return errorId.value;
  if (hasHelp.value) return helpId.value;
  return undefined;
});

const slotProps = computed(() => ({
  controlId: controlId.value,
  describedBy: describedBy.value,
  helpId: helpId.value,
  errorId: errorId.value,
  required: props.required,
}));

function hasSlotContent(name: "help"): boolean {
  const slot = slots[name];
  if (!slot) return false;
  return slot().some(hasVNodeContent);
}

function hasVNodeContent(vnode: {
  type: unknown;
  children?: unknown;
}): boolean {
  if (vnode.type === Comment) return false;
  if (vnode.type === Fragment && Array.isArray(vnode.children)) {
    return vnode.children.some((child) =>
      typeof child === "object" && child !== null
        ? hasVNodeContent(child as { type: unknown; children?: unknown })
        : typeof child === "string" && child.trim().length > 0,
    );
  }
  return typeof vnode.children === "string"
    ? vnode.children.trim().length > 0
    : true;
}
</script>

<template>
  <div class="ui-form-field">
    <label class="ui-form-field__label" :for="controlId">
      <slot name="label" :label="label" :required="required">{{ label }}</slot>
      <span v-if="required" class="ui-form-field__required" aria-hidden="true"
        >*</span
      >
    </label>
    <div class="ui-form-field__control">
      <slot v-bind="slotProps" />
    </div>
    <p v-if="hasError" :id="errorId" class="ui-form-field__error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hasHelp" :id="helpId" class="ui-form-field__help">
      <slot name="help" :help="help">{{ help }}</slot>
    </p>
  </div>
</template>
