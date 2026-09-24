// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";

import NotFoundView from "./NotFoundView.vue";

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<p>首页</p>" } },
      { path: "/:pathMatch(.*)*", component: NotFoundView },
    ],
  });
}

describe("NotFoundView", () => {
  it("explains an unknown address without outdated scaffolding copy", async () => {
    const router = makeRouter();
    await router.push("/missing-page");
    await router.isReady();
    const wrapper = mount(NotFoundView, { global: { plugins: [router] } });

    expect(wrapper.get("h1").text()).toBe("找不到这个页面");
    expect(wrapper.text()).toContain("地址输入有误");
    expect(wrapper.text()).not.toContain("WP1");
    expect(wrapper.get('a[href="/"]').text()).toBe("返回首页");
    wrapper.unmount();
  });

  it("keeps the home link focusable and navigates home", async () => {
    const router = makeRouter();
    await router.push("/missing-page");
    await router.isReady();
    const wrapper = mount(NotFoundView, {
      attachTo: document.body,
      global: { plugins: [router] },
    });
    const link = wrapper.get('a[href="/"]');
    (link.element as HTMLAnchorElement).focus();
    expect(document.activeElement).toBe(link.element);
    await link.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/");
    wrapper.unmount();
  });
});
