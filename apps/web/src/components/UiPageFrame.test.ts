// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import UiPageFrame from "./UiPageFrame.vue";

describe("UiPageFrame", () => {
  it("uses PageHeader by default and keeps the contracted slot order", () => {
    const wrapper = mount(UiPageFrame, {
      props: {
        title: "页面标题",
        titleId: "page-title",
        subtitle: "页面说明",
        maxWidth: "form",
      },
      slots: {
        status: "状态",
        filter: "筛选",
        default: "内容",
        action: "操作",
      },
      global: { stubs: { AppIcon: true } },
    });

    const frame = wrapper.get(".ui-page-frame");
    expect(frame.attributes("aria-labelledby")).toBe("page-title");
    expect(frame.classes()).toContain("ui-page-frame--form");
    expect(frame.get(".ui-page-frame__header h1").text()).toBe("页面标题");
    expect(frame.get(".page-header-subtitle").text()).toBe("页面说明");
    expect(
      Array.from(frame.element.children).map((child) => child.className),
    ).toEqual([
      "ui-page-frame__header",
      "ui-page-frame__status",
      "ui-page-frame__filter",
      "ui-page-frame__content",
      "ui-page-frame__action",
    ]);
  });

  it("allows a custom header and does not create empty slot regions", () => {
    const wrapper = mount(UiPageFrame, {
      props: { title: "默认标题", titleId: "custom-title" },
      slots: {
        header: '<h1 id="custom-title">自定义标题</h1>',
        status: () => [],
        filter: () => [],
        action: () => [],
        default: "内容",
      },
    });

    expect(wrapper.get(".ui-page-frame__header h1").text()).toBe("自定义标题");
    expect(wrapper.find(".ui-page-frame__status").exists()).toBe(false);
    expect(wrapper.find(".ui-page-frame__filter").exists()).toBe(false);
    expect(wrapper.find(".ui-page-frame__action").exists()).toBe(false);
    expect(wrapper.find(".ui-page-frame--form").exists()).toBe(false);
  });
});
