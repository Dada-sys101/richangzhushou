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
  it("allows confirming today's date when it equals the minimum datetime", async () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const value = (type: "day" | "month" | "year") =>
      parts.find((part) => part.type === type)?.value;
    const today = `${value("year")}-${value("month")}-${value("day")}`;
    const wrapper = mount(TemporalPickerField, {
      attachTo: document.body,
      props: { min: `${today}T00:00`, mode: "datetime", modelValue: "" },
    });

    await wrapper.get(".temporal-field").trigger("click");
    await nextTick();
    const todayButton = document.body.querySelector<HTMLButtonElement>(
      ".calendar-grid button.today",
    );
    expect(todayButton).not.toBeNull();
    expect(todayButton?.disabled).toBe(false);
    todayButton?.click();
    await nextTick();
    const confirm = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "确定",
    )!;
    expect(confirm.disabled).toBe(false);
  });

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
