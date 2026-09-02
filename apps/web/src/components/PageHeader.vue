<script setup lang="ts">
import { computed } from "vue";

import AppIcon from "./AppIcon.vue";
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

async function goBack() {
  if (router) {
    await router.replace(backTo.value);
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
    <div v-if="$slots.actions || $slots.default" class="page-header-actions">
      <slot name="actions" />
      <slot />
    </div>
  </header>
</template>
