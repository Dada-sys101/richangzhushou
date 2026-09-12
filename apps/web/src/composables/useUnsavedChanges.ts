import {
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import * as VueRouter from "vue-router";
import { requestAppConfirm } from "./useAppConfirm";

const DEFAULT_MESSAGE = "当前页面有未保存的内容，确定要离开吗？";
export const hasUnsavedChanges = ref(false);
let dirtySourceCount = 0;

export function useUnsavedChanges(
  isDirty: MaybeRefOrGetter<boolean>,
  message = DEFAULT_MESSAGE,
) {
  const allowNavigation = ref(false);
  const reportedDirty = ref(false);

  watch(
    () => toValue(isDirty),
    (dirty) => {
      if (dirty === reportedDirty.value) return;
      reportedDirty.value = dirty;
      dirtySourceCount += dirty ? 1 : -1;
      hasUnsavedChanges.value = dirtySourceCount > 0;
    },
    { immediate: true },
  );

  try {
    VueRouter.onBeforeRouteLeave?.(() => {
      if (allowNavigation.value || !toValue(isDirty)) {
        return true;
      }
      return requestAppConfirm({
        confirmLabel: "离开",
        description: message,
        destructive: true,
        title: "放弃未保存的内容？",
      });
    });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("onBeforeRouteLeave")
    ) {
      throw error;
    }
  }

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (allowNavigation.value || !toValue(isDirty)) {
      return;
    }
    event.preventDefault();
    event.returnValue = message;
  }

  onMounted(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    if (reportedDirty.value) {
      reportedDirty.value = false;
      dirtySourceCount = Math.max(0, dirtySourceCount - 1);
      hasUnsavedChanges.value = dirtySourceCount > 0;
    }
  });

  return {
    allowNavigation: () => {
      allowNavigation.value = true;
    },
    resetNavigationGuard: () => {
      allowNavigation.value = false;
    },
  };
}
