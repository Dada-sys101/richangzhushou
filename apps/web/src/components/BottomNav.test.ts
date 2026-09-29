// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { describe, expect, it } from "vitest";

import BottomNav from "./BottomNav.vue";
import {
  appConfirmState,
  resolveAppConfirm,
} from "../composables/useAppConfirm";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";

const Placeholder = RouterView;
const EditPage = defineComponent({
  setup() {
    const draft = ref("");
    useUnsavedChanges(() => draft.value.length > 0);
    return () =>
      h("input", {
        "aria-label": "未保存内容",
        value: draft.value,
        onInput: (event: Event) => {
          draft.value = (event.target as HTMLInputElement).value;
        },
      });
  },
});

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
      {
        path: "/transactions/new",
        component: EditPage,
        meta: { navigationKind: "FLOW_PAGE" },
      },
      {
        path: "/calendar/event-1",
        component: Placeholder,
        meta: { navigationKind: "DETAIL_PAGE" },
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

  it("returns home from a detail route through the existing root-tab policy", async () => {
    const router = makeRouter();
    await router.push("/calendar/event-1");
    await router.isReady();
    const wrapper = mount(BottomNav, { global: { plugins: [router] } });

    await wrapper.find('a[href="/"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/");
    router.back();
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("keeps the edit URL and input when home navigation is declined, then leaves on acceptance", async () => {
    const router = makeRouter();
    await router.push("/transactions/new");
    await router.isReady();
    const view = mount(RouterView, { global: { plugins: [router] } });
    const wrapper = mount(BottomNav, { global: { plugins: [router] } });
    const input = view.get('input[aria-label="未保存内容"]');
    await input.setValue("尚未保存的记录");

    await wrapper.get('a[href="/"]').trigger("click");
    await flushPromises();
    expect(appConfirmState.open).toBe(true);
    expect(router.currentRoute.value.fullPath).toBe("/transactions/new");

    resolveAppConfirm(false);
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/transactions/new");
    expect(view.get('input[aria-label="未保存内容"]').element).toHaveProperty(
      "value",
      "尚未保存的记录",
    );

    await wrapper.get('a[href="/"]').trigger("click");
    await flushPromises();
    expect(appConfirmState.open).toBe(true);
    resolveAppConfirm(true);
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/");
    view.unmount();
    wrapper.unmount();
  });
});
