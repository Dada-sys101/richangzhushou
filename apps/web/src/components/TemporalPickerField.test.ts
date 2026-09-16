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
  it("selects today for an empty required datetime before confirmation", async () => {
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
      props: {
        min: `${today}T00:00`,
        mode: "datetime",
        modelValue: "",
        required: true,
      },
    });

    await wrapper.get(".temporal-field").trigger("click");
    await nextTick();
    const todayButton = document.body.querySelector<HTMLButtonElement>(
      ".calendar-grid button.today",
    );
    expect(todayButton).not.toBeNull();
    expect(todayButton?.disabled).toBe(false);
    expect(todayButton?.classList.contains("selected")).toBe(true);
    await nextTick();
    const confirm = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "确定",
    )!;
    expect(confirm.disabled).toBe(false);
    confirm.click();
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([
      `${today}T00:00`,
    ]);
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

  it("initializes selectable time boundaries and confirms padded values", async () => {
    const wrapper = mount(TemporalPickerField, {
      attachTo: document.body,
      props: { mode: "datetime", modelValue: "2026-09-15T23:59" },
    });

    await wrapper.get(".temporal-field").trigger("click");
    await nextTick();

    const hour = Array.from(document.body.querySelectorAll("select")).find(
      (select) => select.closest("label")?.textContent?.includes("小时"),
    ) as HTMLSelectElement;
    const minute = Array.from(document.body.querySelectorAll("select")).find(
      (select) => select.closest("label")?.textContent?.includes("分钟"),
    ) as HTMLSelectElement;
    expect(hour.value).toBe("23");
    expect(Array.from(hour.options, (option) => option.value)).toEqual([
      "00",
      ...Array.from({ length: 22 }, (_, index) =>
        String(index + 1).padStart(2, "0"),
      ),
      "23",
    ]);
    expect(minute.value).toBe("59");
    expect(minute.options).toHaveLength(60);
    expect(minute.options[0]?.value).toBe("00");
    expect(minute.options[59]?.value).toBe("59");

    hour.value = "00";
    hour.dispatchEvent(new Event("change", { bubbles: true }));
    minute.value = "00";
    minute.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await Array.from(document.body.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "确定")!
      .click();

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([
      "2026-09-15T00:00",
    ]);
    expect(wrapper.emitted("change")).toHaveLength(1);
  });

  it("cancels time changes without changing the original datetime", async () => {
    const wrapper = mount(TemporalPickerField, {
      attachTo: document.body,
      props: { mode: "datetime", modelValue: "2026-09-15T23:59" },
    });

    await wrapper.get(".temporal-field").trigger("click");
    await nextTick();
    const selects =
      document.body.querySelectorAll<HTMLSelectElement>(".time-entry select");
    selects[0]!.value = "00";
    selects[0]!.dispatchEvent(new Event("change", { bubbles: true }));
    selects[1]!.value = "00";
    selects[1]!.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    document.body
      .querySelectorAll("button")
      [
        Array.from(document.body.querySelectorAll("button")).findIndex(
          (button) => button.textContent?.trim() === "取消",
        )
      ]?.click();

    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.get(".temporal-field").text()).toContain("23:59");
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
