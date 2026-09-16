// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import ActionSheet from "./ActionSheet.vue";

const mountedWrappers = new Set<ReturnType<typeof mount>>();

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  mountedWrappers.clear();
  document.body.innerHTML = "";
  document.documentElement.classList.remove("app-dialog-open");
});

describe("ActionSheet", () => {
  function mountSheet(open = true) {
    const wrapper = mount(ActionSheet, {
      attachTo: document.body,
      props: { labelledby: "sheet-title", open },
      slots: {
        default:
          '<h2 id="sheet-title">更多操作</h2><div class="long-content">长内容</div><button id="sheet-action">操作</button>',
      },
    });
    mountedWrappers.add(wrapper);
    return wrapper;
  }

  it("uses AppDialog semantics and focuses the first available action", async () => {
    mountSheet();
    await nextTick();

    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(panel.getAttribute("aria-labelledby")).toBe("sheet-title");
    expect(document.querySelector(".app-action-sheet")).not.toBeNull();
    expect(document.activeElement?.id).toBe("sheet-action");
  });

  it("does not close for content clicks but closes for backdrop and Escape once", async () => {
    const wrapper = mountSheet();
    await nextTick();
    const backdrop = document.querySelector<HTMLElement>(
      ".app-dialog-backdrop",
    )!;

    document.querySelector<HTMLElement>(".app-action-sheet")!.click();
    expect(wrapper.emitted("close")).toBeUndefined();

    backdrop.click();
    backdrop.click();
    expect(wrapper.emitted("close")).toHaveLength(1);

    document
      .querySelector<HTMLElement>('[role="dialog"]')!
      .dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("restores focus and permits one close in each open cycle", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const wrapper = mountSheet(false);

    await wrapper.setProps({ open: true });
    await nextTick();
    document
      .querySelector<HTMLElement>('[role="dialog"]')!
      .dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    expect(wrapper.emitted("close")).toHaveLength(1);

    await wrapper.setProps({ open: false });
    expect(document.activeElement).toBe(opener);
    await wrapper.setProps({ open: true });
    await nextTick();
    document.querySelector<HTMLElement>(".app-dialog-backdrop")!.click();
    expect(wrapper.emitted("close")).toHaveLength(2);
  });
});
