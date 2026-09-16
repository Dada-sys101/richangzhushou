// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import ConfirmDialog from "./ConfirmDialog.vue";

const mountedWrappers = new Set<ReturnType<typeof mount>>();

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  mountedWrappers.clear();
  document.body.innerHTML = "";
  document.documentElement.classList.remove("app-dialog-open");
});

describe("ConfirmDialog", () => {
  function mountConfirm(
    props: {
      cancelLabel?: string;
      confirmLabel?: string;
      destructive?: boolean;
      description?: string;
      open: boolean;
      title?: string;
    } = { description: "确定要继续吗？", open: true },
  ) {
    const wrapper = mount(ConfirmDialog, {
      attachTo: document.body,
      props: {
        description: "确定要继续吗？",
        ...props,
      },
    });
    mountedWrappers.add(wrapper);
    return wrapper;
  }

  it("associates title and description and focuses cancel first", async () => {
    mountConfirm({
      cancelLabel: "稍后",
      confirmLabel: "删除",
      description: "删除后无法恢复。",
      destructive: true,
      open: true,
      title: "删除记录？",
    });
    await nextTick();

    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const cancel =
      document.querySelector<HTMLButtonElement>("button.secondary")!;
    const confirm = document.querySelector<HTMLButtonElement>("button.danger")!;
    expect(panel.getAttribute("aria-labelledby")).toBe("app-confirm-title");
    expect(panel.getAttribute("aria-describedby")).toBe(
      "app-confirm-description",
    );
    expect(document.getElementById("app-confirm-title")?.textContent).toBe(
      "删除记录？",
    );
    expect(
      document.getElementById("app-confirm-description")?.textContent,
    ).toBe("删除后无法恢复。");
    expect(cancel.hasAttribute("data-dialog-initial-focus")).toBe(true);
    expect(document.activeElement).toBe(cancel);
    expect(confirm.textContent).toContain("删除");
  });

  it("deduplicates rapid confirm click and keyboard activation", async () => {
    const wrapper = mountConfirm();
    await nextTick();
    const confirm =
      document.querySelector<HTMLButtonElement>("button.primary")!;

    confirm.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    );
    confirm.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    );
    confirm.click();
    expect(wrapper.emitted("confirm")).toHaveLength(1);
    expect(wrapper.emitted("cancel")).toBeUndefined();
  });

  it("deduplicates cancel click, Space activation and Escape", async () => {
    const wrapper = mountConfirm();
    await nextTick();
    const cancel =
      document.querySelector<HTMLButtonElement>("button.secondary")!;
    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;

    cancel.click();
    cancel.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: " " }),
    );
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );
    expect(wrapper.emitted("cancel")).toHaveLength(1);
    expect(wrapper.emitted("confirm")).toBeUndefined();
  });

  it("allows one new result after a real closed-to-open cycle", async () => {
    const wrapper = mountConfirm();
    await nextTick();
    document.querySelector<HTMLButtonElement>("button.primary")!.click();
    expect(wrapper.emitted("confirm")).toHaveLength(1);

    await wrapper.setProps({ open: false });
    await nextTick();
    await wrapper.setProps({ open: true });
    await nextTick();
    document.querySelector<HTMLButtonElement>("button.secondary")!.click();
    expect(wrapper.emitted("cancel")).toHaveLength(1);
    expect(wrapper.emitted("confirm")).toHaveLength(1);
  });
});
