// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import AppDialog from "./AppDialog.vue";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.classList.remove("app-dialog-open");
});

describe("AppDialog", () => {
  it("moves focus inside, traps tab, closes on Escape and restores focus", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const wrapper = mount(AppDialog, {
      attachTo: document.body,
      props: { labelledby: "title", open: true },
      slots: {
        default:
          '<h2 id="title">确认</h2><button id="first">取消</button><button id="last">确认</button>',
      },
    });
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

    last.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );
    expect(wrapper.emitted("close")).toHaveLength(1);

    await wrapper.setProps({ open: false });
    expect(document.activeElement).toBe(opener);
    wrapper.unmount();
  });
});
