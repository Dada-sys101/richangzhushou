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
    const registerServiceWorker = () => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((nextRegistration) => {
          observeRegistration(nextRegistration);
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
    if (!registration?.waiting) return false;
    updateBlocked.value = false;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  function deferUpdate() {
    needRefresh.value = false;
    updateBlocked.value = false;
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
  };
}

let lifecycleState: ReturnType<typeof createPwaLifecycle> | null = null;

export function usePwaLifecycle() {
  lifecycleState ??= createPwaLifecycle();
  return lifecycleState;
}
