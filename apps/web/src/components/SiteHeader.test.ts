// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import SiteHeader from "./SiteHeader.vue";

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRoute: () => ({ fullPath: "/" }),
  };
});

describe("SiteHeader", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("hides the primary navigation until authenticated", () => {
    const wrapper = mount(SiteHeader, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    expect(wrapper.find("nav").exists()).toBe(false);
    expect(wrapper.text()).toContain("日常助手");
  });

  it("shows the concise desktop navigation when authenticated", async () => {
    const auth = useAuthStore();
    auth.$patch({ accessToken: "token" });
    const wrapper = mount(SiteHeader, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    const links = wrapper.findAllComponents(RouterLinkStub);
    expect(links.map((link) => link.text())).toEqual([
      "日常助手",
      "首页",
      "日程",
      "待办",
      "财务",
      "行程",
    ]);
  });

  it("collects secondary entries under 更多 and closes it on outside click", async () => {
    const auth = useAuthStore();
    auth.$patch({ accessToken: "token" });
    const sync = useSyncStore();
    sync.$patch({ conflictCount: 0 });
    const wrapper = mount(SiteHeader, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    expect(wrapper.find(".more-panel").exists()).toBe(false);

    await wrapper.find(".more-trigger").trigger("click");
    const panel = wrapper.find(".more-panel");
    expect(panel.exists()).toBe(true);
    for (const label of [
      "快捷记录",
      "草稿中心",
      "快捷指令",
      "提醒",
      "预算",
      "分类",
      "资金账户",
      "个人设置",
    ]) {
      expect(panel.text()).toContain(label);
    }
    expect(panel.text()).not.toContain("同步冲突");

    document.dispatchEvent(new MouseEvent("click"));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".more-panel").exists()).toBe(false);
  });

  it("shows the sync conflicts entry in 更多 when conflicts exist", async () => {
    const auth = useAuthStore();
    auth.$patch({ accessToken: "token" });
    const sync = useSyncStore();
    sync.$patch({ conflictCount: 2 });
    const wrapper = mount(SiteHeader, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    await wrapper.find(".more-trigger").trigger("click");
    expect(wrapper.find(".more-panel").text()).toContain("同步冲突");
  });
});
