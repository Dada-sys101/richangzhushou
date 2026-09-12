<script setup lang="ts">
import TemporalPickerField from "./TemporalPickerField.vue";
defineProps<{
  modelValue: string;
  required?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
}>();
defineEmits<{ change: []; "update:modelValue": [value: string] }>();
</script>
<template>
  <TemporalPickerField
    mode="date"
    v-bind="$props"
    @change="$emit('change')"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
