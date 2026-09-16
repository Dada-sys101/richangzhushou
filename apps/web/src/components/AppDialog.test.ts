// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import type { VueWrapper } from "@vue/test-utils";

import AppDialog from "./AppDialog.vue";

const mountedWrappers = new Set<VueWrapper>();

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  mountedWrappers.clear();
  document.body.innerHTML = "";
  document.documentElement.classList.remove("app-dialog-open");
});

describe("AppDialog", () => {
  function mountDialog(
    props: { closeOnBackdrop?: boolean; labelledby?: string; open: boolean },
    slot = '<h2 id="title">确认</h2><button id="first">取消</button><button id="last">确认</button>',
  ) {
    const wrapper = mount(AppDialog, {
      attachTo: document.body,
      props: { labelledby: "title", ...props },
      slots: { default: slot },
    });
    mountedWrappers.add(wrapper);
    return wrapper;
  }

  it("moves focus inside, traps tab, closes on Escape and restores focus", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const wrapper = mountDialog({ open: true });
    await nextTick();

    expect(document.activeElement?.id).toBe("first");
    expect(document.documentElement.classList.contains("app-dialog-open")).toBe(
      true,
    );

    const last = document.querySelector<HTMLButtonElement>("#last")!;
    last.focus();
    last.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }),
    );
    expect(document.activeElement?.id).toBe("first");

    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );
    expect(wrapper.emitted("close")).toHaveLength(1);

    await wrapper.setProps({ open: false });
    expect(document.activeElement).toBe(opener);
  });

  it("wraps Shift+Tab from the first focusable element to the last", async () => {
    const wrapper = mountDialog({ open: true });
    await nextTick();

    const first = document.querySelector<HTMLButtonElement>("#first")!;
    first.focus();
    first.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        key: "Tab",
        shiftKey: true,
      }),
    );

    expect(document.activeElement?.id).toBe("last");
    await wrapper.setProps({ open: false });
  });

  it("prioritizes a valid initial-focus marker over the first control", async () => {
    const wrapper = mountDialog(
      { open: true },
      '<h2 id="title">标题</h2><button id="first">第一个</button><button id="marked" data-dialog-initial-focus>标记</button>',
    );
    await nextTick();

    expect(document.activeElement?.id).toBe("marked");
    await wrapper.setProps({ open: false });
  });

  it("skips disabled controls and falls back to the panel when none are valid", async () => {
    const markedDisabled = mountDialog(
      { open: true },
      '<h2 id="title">标题</h2><button id="disabled" disabled data-dialog-initial-focus>禁用</button><button id="enabled">可用</button>',
    );
    await nextTick();
    expect(document.activeElement?.id).toBe("enabled");
    await markedDisabled.setProps({ open: false });

    const noControls = mountDialog(
      { open: true },
      '<h2 id="title">没有操作</h2><p>内容</p>',
    );
    await nextTick();
    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(document.activeElement).toBe(panel);
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }),
    );
    expect(document.activeElement).toBe(panel);
    await noControls.setProps({ open: false });
  });

  it("closes only for a direct backdrop click and only once per cycle", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const wrapper = mountDialog({ closeOnBackdrop: true, open: true });
    await nextTick();
    const backdrop = document.querySelector<HTMLElement>(
      ".app-dialog-backdrop",
    )!;
    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;

    panel.click();
    expect(wrapper.emitted("close")).toBeUndefined();
    backdrop.click();
    backdrop.click();
    expect(wrapper.emitted("close")).toHaveLength(1);

    await wrapper.setProps({ open: false });
    expect(document.activeElement).toBe(opener);
  });

  it("does not close from the backdrop when closeOnBackdrop is false", async () => {
    const wrapper = mountDialog({ open: true });
    await nextTick();
    document.querySelector<HTMLElement>(".app-dialog-backdrop")!.click();
    expect(wrapper.emitted("close")).toBeUndefined();
    await wrapper.setProps({ open: false });
  });

  it("restores the original focus only while it remains connected", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const wrapper = mountDialog({ open: true });
    await nextTick();
    opener.remove();

    await expect(wrapper.setProps({ open: false })).resolves.toBeUndefined();
    expect(document.documentElement.classList.contains("app-dialog-open")).toBe(
      false,
    );
  });

  it("captures the trigger once per closed-to-open transition", async () => {
    const firstOpener = document.createElement("button");
    const secondOpener = document.createElement("button");
    document.body.append(firstOpener, secondOpener);
    firstOpener.focus();
    const wrapper = mountDialog({ open: false });

    await wrapper.setProps({ open: true });
    await nextTick();
    secondOpener.focus();
    await wrapper.setProps({ open: true });
    await wrapper.setProps({ open: false });
    expect(document.activeElement).toBe(firstOpener);
  });

  it("keeps scroll lock until the last open dialog closes", async () => {
    const first = mountDialog({ open: true });
    const second = mountDialog(
      { open: true },
      '<h2 id="title">第二个</h2><button id="second">操作</button>',
    );
    await nextTick();
    expect(document.documentElement.classList.contains("app-dialog-open")).toBe(
      true,
    );

    await first.setProps({ open: false });
    expect(document.documentElement.classList.contains("app-dialog-open")).toBe(
      true,
    );
    await second.setProps({ open: false });
    expect(document.documentElement.classList.contains("app-dialog-open")).toBe(
      false,
    );
  });
});
