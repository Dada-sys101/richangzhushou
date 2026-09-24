// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppDialogHost from "../components/AppDialogHost.vue";
import { appConfirmState } from "../composables/useAppConfirm";
import { useDraftsStore } from "../stores/drafts";
import QuickCaptureView from "./QuickCaptureView.vue";

const Host = defineComponent({
  components: { AppDialogHost, RouterView },
  template: "<main><RouterView /><AppDialogHost /></main>",
});
let wrappers: VueWrapper[] = [];

async function setup(url = "/capture?returnTo=%2Frecords") {
  const pinia = createPinia();
  setActivePinia(pinia);
  const drafts = useDraftsStore();
  const create = vi.spyOn(drafts, "createTextDraft").mockResolvedValue({
    draft: { id: "draft-1" },
  } as Awaited<ReturnType<typeof drafts.createTextDraft>>);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/records", component: { template: "<h1>记录</h1>" } },
      {
        path: "/capture",
        component: QuickCaptureView,
        meta: {
          page: {
            title: "快速记录",
            parent: { path: "/records", title: "记录" },
          },
        },
      },
      { path: "/drafts", component: { template: "<h1>草稿中心</h1>" } },
      { path: "/calendar", component: { template: "<h1>日程</h1>" } },
      { path: "/tasks", component: { template: "<h1>待办</h1>" } },
      { path: "/reminders", component: { template: "<h1>提醒</h1>" } },
    ],
  });
  await router.push("/records");
  await router.push(url);
  await router.isReady();
  const wrapper = mount(Host, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return { create, router, wrapper };
}

function dialogButton(label: string) {
  const button = Array.from(
    document.body.querySelectorAll<HTMLButtonElement>(
      ".app-dialog-actions button",
    ),
  ).find((item) => item.textContent?.trim() === label);
  if (!button) throw new Error(`找不到按钮：${label}`);
  return button;
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.assign(appConfirmState, { open: false, title: "请确认" });
});

afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount();
  wrappers = [];
  vi.restoreAllMocks();
});

describe("QuickCaptureView", () => {
  it("shows a draft-only path and preserves existing shortcut sources", async () => {
    const { wrapper } = await setup();
    expect(wrapper.get("h1").text()).toBe("快速记录");
    expect(wrapper.text()).toContain("生成草稿不等于正式入账");
    expect(wrapper.find(".capture-result a").exists()).toBe(false);
    for (const path of ["calendar", "tasks", "reminders"]) {
      expect(
        wrapper
          .get(`a[href="/${path}?returnTo=%2Fcapture"]`)
          .attributes("href"),
      ).toBeDefined();
    }
  });

  it("does not send empty input and caps query prefill at 2000 characters", async () => {
    const { create, wrapper } = await setup();
    await wrapper.get("form").trigger("submit");
    expect(create).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("请输入");
    const query = encodeURIComponent("字".repeat(2001));
    const second = await setup(`/capture?text=${query}`);
    expect(
      (second.wrapper.get("textarea").element as HTMLTextAreaElement).value
        .length,
    ).toBe(2000);
  });

  it("locks duplicate sends synchronously and only then offers draft review", async () => {
    const { create, wrapper } = await setup();
    let release!: (value: Awaited<ReturnType<typeof create>>) => void;
    create.mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof create>>>((resolve) => {
          release = resolve;
        }),
    );
    await wrapper.get("textarea").setValue("今天星巴克 38.50");
    const form = wrapper.get("form");
    await form.trigger("submit");
    await form.trigger("submit");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith("今天星巴克 38.50");
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.text()).toContain("生成中");
    expect(wrapper.find(".capture-result a").exists()).toBe(false);
    release({ draft: { id: "draft-1" } } as Awaited<ReturnType<typeof create>>);
    await flushPromises();
    expect(wrapper.text()).toContain("草稿已生成，尚未入账");
    expect(wrapper.get(".capture-result a").attributes("href")).toContain(
      "/drafts?returnTo=",
    );
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  it("keeps failed input and retries without fake success", async () => {
    const { create, wrapper } = await setup();
    create.mockRejectedValueOnce(new Error("offline"));
    await wrapper.get("textarea").setValue("午饭 25");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "午饭 25",
    );
    expect(wrapper.get('[role="alert"]').text()).toContain("网络异常");
    expect(wrapper.find(".capture-result a").exists()).toBe(false);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(create).toHaveBeenCalledTimes(2);
    expect(wrapper.get(".capture-result a").attributes("href")).toBeDefined();
  });

  it("protects unsaved route leave and preserves input when declined", async () => {
    const { router, wrapper } = await setup();
    await wrapper.get("textarea").setValue("待保存内容");
    const leaving = router.push("/records");
    await flushPromises();
    expect(appConfirmState.open).toBe(true);
    dialogButton("取消").click();
    await leaving;
    expect(router.currentRoute.value.path).toBe("/capture");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "待保存内容",
    );
    const accepted = router.push("/records");
    await flushPromises();
    dialogButton("离开").click();
    await accepted;
    expect(router.currentRoute.value.path).toBe("/records");
  });
});
