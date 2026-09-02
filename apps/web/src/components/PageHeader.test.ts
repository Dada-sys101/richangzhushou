// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
} from "vue-router";
import { describe, expect, it } from "vitest";

import PageHeader from "./PageHeader.vue";

const Placeholder = { template: "<div />" };

function makeRouter() {
  const routes: RouteRecordRaw[] = [
    {
      path: "/",
      component: Placeholder,
      meta: { page: { title: "首页" } },
    },
    {
      path: "/records",
      component: Placeholder,
      meta: { page: { title: "记录" } },
    },
    {
      path: "/plan",
      component: Placeholder,
      meta: { page: { title: "计划" } },
    },
    {
      path: "/tasks",
      component: Placeholder,
      meta: { page: { title: "待办" } },
    },
    {
      path: "/calendar",
      component: Placeholder,
      meta: { page: { title: "日程" } },
    },
    {
      path: "/reminders",
      component: Placeholder,
      meta: { page: { title: "提醒" } },
    },
    {
      path: "/detail",
      component: Placeholder,
      meta: {
        page: {
          title: "详情",
          parent: { path: "/records", title: "记录" },
        },
      },
    },
  ];
  return createRouter({ history: createMemoryHistory(), routes });
}

describe("PageHeader", () => {
  it("hides back on a root page and shows the configured parent on a child page", async () => {
    const router = makeRouter();
    await router.push("/");
    await router.isReady();
    const root = mount(PageHeader, {
      global: { plugins: [router] },
      props: { title: "首页" },
    });
    expect(root.find(".page-header-back").exists()).toBe(false);

    await router.push("/detail?returnTo=%2Frecords");
    expect(router.currentRoute.value.meta.page?.parent?.title).toBe("记录");
    const child = mount(PageHeader, {
      global: { plugins: [router] },
      props: { title: "详情" },
    });
    expect(child.find(".page-header-back").text()).toContain("返回记录");

    await child.find(".page-header-back").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/records");
  });

  it("uses the configured parent when returnTo is not supplied", async () => {
    const router = makeRouter();
    await router.push("/detail");
    await router.isReady();
    const wrapper = mount(PageHeader, {
      global: { plugins: [router] },
      props: { title: "详情" },
    });

    await wrapper.find(".page-header-back").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/records");
  });

  it("uses the actual internal return target for the button label", async () => {
    const router = makeRouter();
    await router.push("/detail?returnTo=%2Ftasks");
    await router.isReady();
    const wrapper = mount(PageHeader, {
      global: { plugins: [router] },
      props: { title: "详情" },
    });

    expect(wrapper.find(".page-header-back").text()).toContain("返回待办");
  });
});
