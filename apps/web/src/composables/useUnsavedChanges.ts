import {
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import * as VueRouter from "vue-router";

const DEFAULT_MESSAGE = "当前页面有未保存的内容，确定要离开吗？";

export function useUnsavedChanges(
  isDirty: MaybeRefOrGetter<boolean>,
  message = DEFAULT_MESSAGE,
) {
  const allowNavigation = ref(false);

  try {
    VueRouter.onBeforeRouteLeave?.(() => {
      if (allowNavigation.value || !toValue(isDirty)) {
        return true;
      }
      return window.confirm(message);
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
