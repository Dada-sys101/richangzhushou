import { computed, readonly, ref } from "vue";

import { hasUnsavedChanges } from "./useUnsavedChanges";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_GUIDE_DISMISSED_KEY = "daily-assistant:install-guide-dismissed";
const deferredInstallPrompt = ref<InstallPromptEvent | null>(null);
const installGuideOpen = ref(false);
const needRefresh = ref(false);
const updateBlocked = ref(false);
const updateApplying = ref(false);
const updateError = ref("");
let registration: ServiceWorkerRegistration | null = null;
let initialized = false;

export function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function observeRegistration(nextRegistration: ServiceWorkerRegistration) {
  registration = nextRegistration;
  if (nextRegistration.waiting && navigator.serviceWorker.controller) {
    needRefresh.value = true;
  }
  nextRegistration.addEventListener("updatefound", () => {
    const installing = nextRegistration.installing;
    installing?.addEventListener("statechange", () => {
      if (
        installing.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        needRefresh.value = true;
      }
    });
  });
}

function initializeLifecycle() {
  if (initialized) return;
  initialized = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt.value = event as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt.value = null;
    installGuideOpen.value = false;
  });

  if ("serviceWorker" in navigator) {
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        void registration?.update();
      }
    };
    window.addEventListener("pageshow", checkForUpdate);
    document.addEventListener("visibilitychange", checkForUpdate);

    const registerServiceWorker = () => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((nextRegistration) => {
          observeRegistration(nextRegistration);
          void nextRegistration.update();
          window.setInterval(
            () => void nextRegistration.update(),
            60 * 60 * 1000,
          );
        })
        .catch(() => {
          // The application remains usable when Service Worker registration fails.
        });
    };
    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }
  }
}

function createPwaLifecycle() {
  initializeLifecycle();
  const standalone = computed(isStandaloneMode);
  const ios = computed(isIosDevice);
  const canInstall = computed(
    () =>
      !standalone.value && (Boolean(deferredInstallPrompt.value) || ios.value),
  );

  async function install() {
    const prompt = deferredInstallPrompt.value;
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      deferredInstallPrompt.value = null;
      return;
    }
    if (ios.value) installGuideOpen.value = true;
  }

  function closeInstallGuide() {
    installGuideOpen.value = false;
    window.localStorage.setItem(
      INSTALL_GUIDE_DISMISSED_KEY,
      String(Date.now()),
    );
  }

  async function applyUpdate(activeWrite = false) {
    if (hasUnsavedChanges.value || activeWrite) {
      updateBlocked.value = true;
      return false;
    }
    updateBlocked.value = false;
    updateApplying.value = true;
    updateError.value = "";
    try {
      registration ??=
        (await navigator.serviceWorker.getRegistration()) ?? null;
      if (!registration) throw new Error("SERVICE_WORKER_NOT_REGISTERED");
      if (!registration.waiting) await registration.update();
      const waitingWorker = registration.waiting;
      if (!waitingWorker) {
        needRefresh.value = false;
        window.location.reload();
        return true;
      }
      let reloading = false;
      const reload = () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", reload, {
        once: true,
      });
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(reload, 2500);
      return true;
    } catch {
      updateApplying.value = false;
      updateError.value = "更新暂时未能完成，请稍后重试。";
      return false;
    }
  }

  function deferUpdate() {
    needRefresh.value = false;
    updateBlocked.value = false;
    updateError.value = "";
  }

  return {
    applyUpdate,
    canInstall,
    closeInstallGuide,
    deferUpdate,
    install,
    installGuideOpen: readonly(installGuideOpen),
    ios,
    needRefresh: readonly(needRefresh),
    standalone,
    updateBlocked: readonly(updateBlocked),
    updateApplying: readonly(updateApplying),
    updateError: readonly(updateError),
  };
}

let lifecycleState: ReturnType<typeof createPwaLifecycle> | null = null;

export function usePwaLifecycle() {
  lifecycleState ??= createPwaLifecycle();
  return lifecycleState;
}
