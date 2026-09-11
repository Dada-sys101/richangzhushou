// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";

import BottomNav from "./BottomNav.vue";

const Placeholder = { template: "<div />" };

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/",
        component: Placeholder,
        meta: { navigationKind: "ROOT_TAB" },
      },
      {
        path: "/records",
        component: Placeholder,
        meta: { navigationKind: "ROOT_TAB" },
      },
      {
        path: "/capture",
        component: Placeholder,
        meta: { navigationKind: "FLOW_PAGE" },
      },
      {
        path: "/plan",
        component: Placeholder,
        meta: { navigationKind: "ROOT_TAB" },
      },
      {
        path: "/account",
        component: Placeholder,
        meta: { navigationKind: "ROOT_TAB" },
      },
    ],
  });
}

describe("BottomNav", () => {
  it("renders five entries and applies root-tab replacement through policy", async () => {
    const router = makeRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mount(BottomNav, { global: { plugins: [router] } });
    const links = wrapper.findAll("a");

    expect(links.map((link) => link.attributes("href"))).toEqual([
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
    expect(wrapper.find('[aria-label="快速新增"]').exists()).toBe(true);

    await links[1]?.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/records");

    router.back();
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/records");
  });
});
