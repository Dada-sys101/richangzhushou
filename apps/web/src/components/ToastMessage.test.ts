// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ToastMessage from "./ToastMessage.vue";

describe("ToastMessage", () => {
  it("defaults to a polite success status", () => {
    const wrapper = mount(ToastMessage, { props: { message: "已保存" } });

    expect(wrapper.attributes("class")).toContain("app-toast-success");
    expect(wrapper.attributes("role")).toBe("status");
    expect(wrapper.attributes("aria-live")).toBe("polite");
  });

  it.each([
    ["info", "status", "polite"],
    ["warning", "status", "polite"],
  ] as const)("uses polite status semantics for %s", (tone, role, live) => {
    const wrapper = mount(ToastMessage, {
      props: { message: "提示", tone },
    });

    expect(wrapper.attributes("class")).toContain(`app-toast-${tone}`);
    expect(wrapper.attributes("role")).toBe(role);
    expect(wrapper.attributes("aria-live")).toBe(live);
  });

  it("uses assertive alert semantics for errors", () => {
    const wrapper = mount(ToastMessage, {
      props: { message: "保存失败", tone: "error" },
    });

    expect(wrapper.attributes("role")).toBe("alert");
    expect(wrapper.attributes("aria-live")).toBe("assertive");
  });

  it("renders the message as text, including long content", () => {
    const message = "<strong>不会执行</strong>".repeat(12);
    const wrapper = mount(ToastMessage, { props: { message } });

    expect(wrapper.text()).toBe(message);
    expect(wrapper.find("strong").exists()).toBe(false);
  });
});
