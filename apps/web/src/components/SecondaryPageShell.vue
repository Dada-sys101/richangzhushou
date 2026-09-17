<script setup lang="ts">
import { Comment, Fragment, useSlots } from "vue";

import PageHeader from "./PageHeader.vue";

const slots = useSlots();

function hasSlotContent(name: "actions"): boolean {
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

withDefaults(
  defineProps<{
    title: string;
    titleId: string;
    subtitle?: string;
  }>(),
  { subtitle: undefined },
);
</script>

<template>
  <section class="secondary-page" :aria-labelledby="titleId">
    <PageHeader :title="title" :title-id="titleId" :subtitle="subtitle">
      <template v-if="hasSlotContent('actions')" #actions
        ><slot name="actions"
      /></template>
    </PageHeader>
    <div class="secondary-page-content"><slot /></div>
  </section>
</template>
