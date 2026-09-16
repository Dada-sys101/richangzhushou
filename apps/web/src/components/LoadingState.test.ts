// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import LoadingState from "./LoadingState.vue";

describe("LoadingState", () => {
  it("uses the default title and loading semantics", () => {
    const wrapper = mount(LoadingState);
    const state = wrapper.get('[role="status"]');

    expect(wrapper.get("h2").text()).toBe("加载中");
    expect(state.attributes("aria-live")).toBe("polite");
    expect(state.attributes("aria-busy")).toBe("true");
    expect(
      wrapper.get(".feedback-state-indicator").attributes("aria-hidden"),
    ).toBe("true");
  });

  it("renders custom title and optional description", () => {
    const wrapper = mount(LoadingState, {
      props: { description: "正在同步数据", title: "请稍候" },
    });

    expect(wrapper.get("h2").text()).toBe("请稍候");
    expect(wrapper.get("p").text()).toBe("正在同步数据");
  });

  it("does not render an empty description", () => {
    const wrapper = mount(LoadingState, { props: { description: "" } });

    expect(wrapper.find("p").exists()).toBe(false);
  });
});
