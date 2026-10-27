// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import RecordMoreActions from "./RecordMoreActions.vue";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("RecordMoreActions", () => {
  it("closes before dispatching an action and restores focus for its confirmation", async () => {
    const wrapper = mount(RecordMoreActions, {
      attachTo: document.body,
      slots: { default: "<button>删除</button>" },
    });
    const disclosure = wrapper.get("details").element as HTMLDetailsElement;
    disclosure.open = true;
    await wrapper.get("button").trigger("click");
    expect(disclosure.open).toBe(false);
    expect(document.activeElement).toBe(wrapper.get("summary").element);
    wrapper.unmount();
  });

  it("closes with Escape and outside pointer input", async () => {
    const wrapper = mount(RecordMoreActions, { attachTo: document.body });
    const disclosure = wrapper.get("details").element as HTMLDetailsElement;
    disclosure.open = true;
    await wrapper.get("summary").trigger("keydown", { key: "Escape" });
    expect(disclosure.open).toBe(false);
    disclosure.open = true;
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(disclosure.open).toBe(false);
    wrapper.unmount();
  });

  it("prevents opening while the record is busy", () => {
    const wrapper = mount(RecordMoreActions, { props: { disabled: true } });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    wrapper.get("summary").element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    wrapper.unmount();
  });
});
