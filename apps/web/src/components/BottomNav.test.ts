// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { RouterLinkStub } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import BottomNav from "./BottomNav.vue";

describe("BottomNav", () => {
  it("renders the five mobile navigation entries", () => {
    const wrapper = mount(BottomNav, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    const links = wrapper.findAllComponents(RouterLinkStub);
    expect(links.map((link) => link.props("to"))).toEqual([
      "/",
      "/records",
      "/capture",
      "/plan",
      "/account",
    ]);
    expect(wrapper.text()).toContain("首页");
    expect(wrapper.text()).toContain("记录");
    expect(wrapper.text()).toContain("计划");
    expect(wrapper.text()).toContain("我的");
    expect(wrapper.find('[aria-label="统一录入"]').exists()).toBe(true);
  });
});
