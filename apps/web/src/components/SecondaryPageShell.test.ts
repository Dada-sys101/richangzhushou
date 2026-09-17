// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SecondaryPageShell from "./SecondaryPageShell.vue";

describe("SecondaryPageShell", () => {
  it("renders a named page, actions and grouped content", () => {
    const wrapper = mount(SecondaryPageShell, {
      props: { title: "资金账户", titleId: "accounts-title", subtitle: "设置" },
      slots: {
        actions: "筛选",
        default: "页面内容",
      },
      global: {
        stubs: { AppIcon: true },
      },
    });

    expect(wrapper.get(".secondary-page").attributes("aria-labelledby")).toBe(
      "accounts-title",
    );
    expect(wrapper.get("h1").text()).toBe("资金账户");
    expect(wrapper.text()).toContain("筛选");
    expect(wrapper.text()).toContain("页面内容");
    expect(wrapper.get(".page-header-actions").text()).toContain("筛选");
    expect(wrapper.get(".secondary-page-content").text()).toContain("页面内容");
  });

  it("keeps the default slot for page content and omits empty actions", () => {
    const wrapper = mount(SecondaryPageShell, {
      props: { title: "同步冲突", titleId: "conflicts-title" },
      slots: {
        actions: () => [],
        default: '<p data-test="content">请处理冲突</p>',
      },
      global: {
        stubs: { AppIcon: true },
      },
    });

    expect(wrapper.find(".page-header-actions").exists()).toBe(false);
    expect(
      wrapper.get(".secondary-page-content [data-test=content]").text(),
    ).toBe("请处理冲突");
  });
});
