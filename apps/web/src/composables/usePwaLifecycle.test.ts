// @vitest-environment jsdom

import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasUnsavedChanges } from "./useUnsavedChanges";
import { isIosDevice, usePwaLifecycle } from "./usePwaLifecycle";

describe("PWA lifecycle policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasUnsavedChanges.value = false;
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0",
    });
  });

  it("uses the browser install prompt when it becomes available", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" }>;
    };
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    const lifecycle = usePwaLifecycle();

    window.dispatchEvent(event);
    await nextTick();
    expect(lifecycle.canInstall.value).toBe(true);
    await lifecycle.install();
    expect(prompt).toHaveBeenCalledOnce();
    expect(lifecycle.canInstall.value).toBe(false);
  });

  it("defers reload while a form has unsaved changes", async () => {
    const lifecycle = usePwaLifecycle();
    hasUnsavedChanges.value = true;

    await expect(lifecycle.applyUpdate()).resolves.toBe(false);
    expect(lifecycle.updateBlocked.value).toBe(true);
  });

  it("recognizes iPhone as an install-guide platform", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    });
    expect(isIosDevice()).toBe(true);
  });
});
