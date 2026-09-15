<script setup lang="ts">
import { Comment, Fragment, useSlots } from "vue";

import PageHeader from "./PageHeader.vue";

const slots = useSlots();

function hasSlotContent(
  name: "header" | "status" | "filter" | "default" | "action",
): boolean {
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
    maxWidth?: "form" | "content";
  }>(),
  {
    maxWidth: "content",
    subtitle: undefined,
  },
);
</script>

<template>
  <section
    class="ui-page-frame"
    :class="{ 'ui-page-frame--form': maxWidth === 'form' }"
    :aria-labelledby="titleId"
  >
    <div class="ui-page-frame__header">
      <template v-if="hasSlotContent('header')">
        <slot name="header" />
      </template>
      <template v-else>
        <PageHeader :title="title" :title-id="titleId" :subtitle="subtitle" />
      </template>
    </div>
    <div v-if="hasSlotContent('status')" class="ui-page-frame__status">
      <slot name="status" />
    </div>
    <div v-if="hasSlotContent('filter')" class="ui-page-frame__filter">
      <slot name="filter" />
    </div>
    <div v-if="hasSlotContent('default')" class="ui-page-frame__content">
      <slot />
    </div>
    <div v-if="hasSlotContent('action')" class="ui-page-frame__action">
      <slot name="action" />
    </div>
  </section>
</template>
