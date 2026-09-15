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

interface HistoryStateLike {
  position?: unknown;
}

function historyPosition(state: unknown): number | null {
  if (!state || typeof state !== "object") {
    return null;
  }
  const position = (state as HistoryStateLike).position;
  return typeof position === "number" && Number.isFinite(position)
    ? position
    : null;
}

export function useUnsavedChanges(
  isDirty: MaybeRefOrGetter<boolean>,
  message = DEFAULT_MESSAGE,
) {
  const allowNavigation = ref(false);
  const reportedDirty = ref(false);
  let router: VueRouter.Router | null = null;
  let lastHistoryPosition: number | null =
    typeof window === "undefined"
      ? null
      : historyPosition(window.history.state);
  let restoringBrowserBack = false;
  let pendingRestoreResolve: (() => void) | null = null;
  let restoreTimer: number | null = null;

  function confirmLeave(): Promise<boolean> {
    return requestAppConfirm({
      confirmLabel: "离开",
      description: message,
      destructive: true,
      title: "放弃未保存的内容？",
    });
  }

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
    router = VueRouter.useRouter();
  } catch {
    router = null;
  }

  try {
    VueRouter.onBeforeRouteLeave?.(() => {
      if (allowNavigation.value || !toValue(isDirty)) {
        return true;
      }
      return confirmLeave();
    });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("onBeforeRouteLeave")
    ) {
      throw error;
    }
  }

  function finishBrowserBackRestore(position: number | null) {
    if (!restoringBrowserBack) {
      return;
    }
    restoringBrowserBack = false;
    lastHistoryPosition = position ?? lastHistoryPosition;
    if (restoreTimer !== null) {
      window.clearTimeout(restoreTimer);
      restoreTimer = null;
    }
    const resolve = pendingRestoreResolve;
    pendingRestoreResolve = null;
    resolve?.();
  }

  function restoreBrowserBack(delta: number): Promise<void> {
    if (delta === 0 || typeof window === "undefined") {
      return Promise.resolve();
    }

    restoringBrowserBack = true;
    return new Promise((resolve) => {
      pendingRestoreResolve = resolve;
      restoreTimer = window.setTimeout(() => {
        finishBrowserBackRestore(historyPosition(window.history.state));
      }, 1000);
      router?.options.history.go(-delta, false);
    });
  }

  function handlePopState(event: PopStateEvent) {
    const targetPosition = historyPosition(event.state);

    if (restoringBrowserBack) {
      finishBrowserBackRestore(targetPosition);
      return;
    }

    if (!router || allowNavigation.value || !toValue(isDirty)) {
      lastHistoryPosition = targetPosition ?? lastHistoryPosition;
      return;
    }

    const currentPosition = lastHistoryPosition;
    const delta =
      targetPosition !== null && currentPosition !== null
        ? targetPosition - currentPosition
        : -1;
    if (delta >= 0) {
      lastHistoryPosition = targetPosition ?? lastHistoryPosition;
      return;
    }

    // Vue Router receives popstate after the browser has already changed the
    // address bar. Keep its listener from processing that event until the
    // user has decided whether to leave, then replace the restored entry with
    // the captured target on accept. The capture listener is on window because
    // createWebHistory also listens on window; a document listener cannot
    // reject this event.
    const targetPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    event.stopPropagation();
    event.stopImmediatePropagation();
    void (async () => {
      await restoreBrowserBack(delta);
      const confirmed = await confirmLeave();
      if (!confirmed || !router) {
        return;
      }
      allowNavigation.value = true;
      try {
        await router.replace(targetPath);
      } finally {
        allowNavigation.value = false;
      }
    })();
  }

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (allowNavigation.value || !toValue(isDirty)) {
      return;
    }
    event.preventDefault();
    event.returnValue = message;
  }

  onMounted(() => {
    window.addEventListener("popstate", handlePopState, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("popstate", handlePopState, true);
    window.removeEventListener("beforeunload", handleBeforeUnload);
    if (restoreTimer !== null) {
      window.clearTimeout(restoreTimer);
      restoreTimer = null;
    }
    pendingRestoreResolve = null;
    restoringBrowserBack = false;
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
