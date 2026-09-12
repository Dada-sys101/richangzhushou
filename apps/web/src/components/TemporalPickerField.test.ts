// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import TemporalPickerField from "./TemporalPickerField.vue";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.classList.remove("app-dialog-open");
});

describe("TemporalPickerField", () => {
  it("shows and preserves a leap-day value when cancelled", async () => {
    const wrapper = mount(TemporalPickerField, {
      attachTo: document.body,
      props: { mode: "date", modelValue: "2024-02-29" },
    });
    expect(wrapper.get(".temporal-field").text()).toContain("2024年2月29日");
    await wrapper.get(".temporal-field").trigger("click");
    await nextTick();
    expect(document.body.textContent).toContain("2024年2月");
    const cancel = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "取消",
    )!;
    cancel.click();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("clears an optional month only after confirmation", async () => {
    const wrapper = mount(TemporalPickerField, {
      attachTo: document.body,
      props: { mode: "month", modelValue: "2026-09" },
    });
    await wrapper.get(".temporal-field").trigger("click");
    await nextTick();
    const buttons = Array.from(document.body.querySelectorAll("button"));
    buttons.find((button) => button.textContent?.trim() === "清除")!.click();
    buttons.find((button) => button.textContent?.trim() === "确定")!.click();
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([""]);
    expect(wrapper.emitted("change")).toHaveLength(1);
  });
});
