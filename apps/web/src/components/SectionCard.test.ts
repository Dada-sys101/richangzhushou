// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SectionCard from "./SectionCard.vue";

describe("SectionCard", () => {
  it("renders semantic section copy and tone", () => {
    const wrapper = mount(SectionCard, {
      props: { title: "已归档", description: "不再使用", tone: "muted" },
      slots: { default: "列表" },
    });

    expect(wrapper.classes()).toContain("section-card-muted");
    expect(wrapper.get("h2").text()).toBe("已归档");
    expect(wrapper.text()).toContain("列表");
  });
});
