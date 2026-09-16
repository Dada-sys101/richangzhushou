// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it, vi } from "vitest";

import EmptyState from "./EmptyState.vue";

const Placeholder = { template: "<div />" };

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: Placeholder },
      { path: "/records", component: Placeholder },
    ],
  });
}

describe("EmptyState", () => {
  it("renders semantic copy and a decorative icon", () => {
    const wrapper = mount(EmptyState, {
      props: { description: "还没有记录", icon: "receipt", title: "暂无记录" },
    });

    const section = wrapper.get("section");
    expect(section.attributes("aria-labelledby")).toMatch(
      /^empty-state-title-/,
    );
    expect(section.attributes("aria-describedby")).toMatch(
      /^empty-state-description-/,
    );
    expect(wrapper.get("h2").text()).toBe("暂无记录");
    expect(wrapper.get("p").text()).toBe("还没有记录");
    expect(wrapper.get(".empty-state-icon").attributes("aria-hidden")).toBe(
      "true",
    );
  });

  it("does not render an empty action area without an action", () => {
    const wrapper = mount(EmptyState, {
      props: { description: "没有内容", icon: "receipt", title: "空" },
    });

    expect(wrapper.find(".empty-state-action").exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("renders a RouterLink action", async () => {
    const router = makeRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mount(EmptyState, {
      global: { plugins: [router] },
      props: {
        action: { label: "查看记录", to: "/records" },
        description: "没有内容",
        icon: "receipt",
        title: "空",
      },
    });

    expect(wrapper.get("a").attributes("href")).toBe("/records");
    expect(wrapper.find("button").exists()).toBe(false);
    await wrapper.get("a").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/records");
  });

  it("renders a button action and invokes it once per click", async () => {
    const onClick = vi.fn();
    const wrapper = mount(EmptyState, {
      props: {
        action: { label: "重新加载", onClick },
        description: "没有内容",
        icon: "receipt",
        title: "空",
      },
    });

    await wrapper.get("button").trigger("click");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("prioritizes to over onClick", () => {
    const onClick = vi.fn();
    const router = makeRouter();
    const wrapper = mount(EmptyState, {
      global: { plugins: [router] },
      props: {
        action: { label: "去记录", onClick, to: "/records" },
        description: "没有内容",
        icon: "receipt",
        title: "空",
      },
    });

    expect(wrapper.find("a").exists()).toBe(true);
    expect(wrapper.find("button").exists()).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps long copy and action labels in the DOM", () => {
    const wrapper = mount(EmptyState, {
      props: {
        action: { label: "这是一个很长的操作按钮文案" },
        description: "长描述。".repeat(30),
        icon: "receipt",
        title: "长标题。".repeat(12),
      },
    });

    expect(wrapper.text()).toContain("长标题。".repeat(12));
    expect(wrapper.text()).toContain("这是一个很长的操作按钮文案");
  });
});
