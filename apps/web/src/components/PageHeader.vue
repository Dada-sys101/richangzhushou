<script setup lang="ts">
import { Comment, Fragment, computed, useSlots } from "vue";

import AppIcon from "./AppIcon.vue";
import { navigateBack } from "../navigation-policy";
import {
  resolveReturnTitle,
  safeReturnTo,
  useOptionalRoute,
  useOptionalRouter,
} from "../utils/navigation";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    titleId?: string;
    parentTitle?: string;
    defaultBackTo?: string;
    showBack?: boolean | null;
  }>(),
  {
    defaultBackTo: undefined,
    parentTitle: undefined,
    showBack: null,
    subtitle: undefined,
    titleId: undefined,
  },
);

const slots = useSlots();
const route = useOptionalRoute();
const router = useOptionalRouter();
const activeRoute = computed(() => route ?? router?.currentRoute.value ?? null);
const pageMeta = computed(() => activeRoute.value?.meta?.page);
const showBack = computed(
  () => props.showBack ?? Boolean(pageMeta.value?.parent),
);
const defaultBackTo = computed(
  () => props.defaultBackTo ?? pageMeta.value?.parent?.path ?? "/",
);
const backTo = computed(() =>
  safeReturnTo(activeRoute.value?.query, defaultBackTo.value),
);
const parentTitle = computed(() =>
  resolveReturnTitle(
    router,
    backTo.value,
    props.parentTitle ?? pageMeta.value?.parent?.title ?? "上一级",
  ),
);

function hasSlotContent(name: "actions" | "default"): boolean {
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

async function goBack() {
  if (router) {
    await navigateBack(router, defaultBackTo.value);
    return;
  }
  window.history.back();
}
</script>

<template>
  <header class="page-header">
    <div class="page-header-main">
      <button
        v-if="showBack"
        class="page-header-back"
        type="button"
        :aria-label="`返回${parentTitle}`"
        @click="goBack"
      >
        <AppIcon name="arrow-left" :size="18" />
        <span>返回{{ parentTitle }}</span>
      </button>
      <h1 :id="titleId">{{ title }}</h1>
      <p v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</p>
    </div>
    <div
      v-if="hasSlotContent('actions') || hasSlotContent('default')"
      class="page-header-actions"
    >
      <slot name="actions" />
      <slot />
    </div>
  </header>
</template>
