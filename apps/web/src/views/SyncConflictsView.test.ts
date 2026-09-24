// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppDialogHost from "../components/AppDialogHost.vue";
import { appConfirmState } from "../composables/useAppConfirm";
import type { PendingMutation } from "../offline/sync";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import SyncConflictsView from "./SyncConflictsView.vue";

const Host = defineComponent({
  components: { AppDialogHost, SyncConflictsView },
  template: "<main><SyncConflictsView /><AppDialogHost /></main>",
});
const conflict: PendingMutation = {
  id: "synthetic-conflict-1",
  userId: "synthetic-user",
  entityType: "TASK",
  action: "UPDATE",
  entityId: "synthetic-task",
  localId: null,
  payload: { title: "本地合成内容" },
  version: 2,
  status: "CONFLICT",
  errorCode: "VERSION_CONFLICT",
  errorMessage: "synthetic conflict",
  current: {
    entityType: "TASK",
    entityId: "synthetic-task",
    data: { title: "服务端合成内容", version: 3 },
  },
  createdAt: 1,
};

let wrappers: VueWrapper[] = [];

async function setup(
  options: {
    initialized?: boolean;
    conflicts?: PendingMutation[];
    error?: string;
    offline?: boolean;
  } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.$patch({ offlineUserId: "synthetic-user", offlineMode: false });
  const sync = useSyncStore();
  sync.initialized = options.initialized ?? true;
  sync.lastUserId = "synthetic-user";
  sync.conflicts = options.conflicts ?? [conflict];
  sync.errorMessage = options.error ?? null;
  sync.offline = options.offline ?? false;
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/account", component: { template: "<h1>我的</h1>" } },
      {
        path: "/sync/conflicts",
        component: { template: "<div />" },
        meta: {
          page: {
            title: "冲突处理",
            parent: { path: "/account", title: "我的" },
          },
        },
      },
    ],
  });
  await router.push("/account");
  await router.push("/sync/conflicts");
  await router.isReady();
  const wrapper = mount(Host, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return { auth, router, sync, wrapper };
}

function dialogButton(label: string) {
  const button = Array.from(
    document.body.querySelectorAll<HTMLButtonElement>(
      ".app-dialog-actions button",
    ),
  ).find((item) => item.textContent?.trim() === label);
  if (!button) throw new Error(`Missing dialog button: ${label}`);
  return button;
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.assign(appConfirmState, {
    open: false,
    title: "请确认",
    description: "",
    confirmLabel: "确认",
    cancelLabel: "取消",
    destructive: false,
  });
});
afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount();
  wrappers = [];
  vi.restoreAllMocks();
});

describe("SyncConflictsView", () => {
  it("does not report empty before initialization and isolates another user's conflict", async () => {
    const { sync, wrapper } = await setup({ initialized: false });
    expect(wrapper.text()).toContain("正在读取冲突");
    expect(wrapper.text()).not.toContain("当前没有待处理的冲突");
    sync.initialized = true;
    sync.conflicts = [{ ...conflict, userId: "another-user" }];
    await flushPromises();
    expect(wrapper.text()).toContain("当前没有待处理的冲突");
    expect(wrapper.text()).not.toContain("本地合成内容");
  });

  it("shows both synthetic sides and handles long content", async () => {
    const { wrapper } = await setup();
    expect(wrapper.text()).toContain("待处理 1 项");
    expect(wrapper.text()).toContain("本地合成内容");
    expect(wrapper.text()).toContain("服务端合成内容");
    expect(wrapper.text()).toContain("本地版本：2");
  });

  it("never offers local choice for an idempotency conflict", async () => {
    const { sync, wrapper } = await setup({
      conflicts: [{ ...conflict, errorCode: "IDEMPOTENCY_CONFLICT" }],
    });
    const resolve = vi.spyOn(sync, "resolve");
    expect(wrapper.text()).toContain("无法通过此冲突保留本地修改");
    expect(wrapper.text()).not.toContain("重新提交本地内容");
    expect(wrapper.text()).toContain("使用服务端内容");
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    ["重新提交本地内容", "重新提交本地内容？", "确认重新提交", "local"],
    ["使用服务端内容", "使用服务端内容？", "确认使用服务端", "server"],
  ] as const)(
    "confirms %s and cancellation makes no resolve call",
    async (label, title, confirmLabel, choice) => {
      const { sync, wrapper } = await setup();
      const resolve = vi.spyOn(sync, "resolve").mockImplementation(async () => {
        sync.conflicts = [];
      });
      vi.spyOn(sync, "refresh").mockResolvedValue(undefined);
      const button = wrapper
        .findAll(".conflict-actions button")
        .find((item) => item.text() === label);
      if (!button) throw new Error("Missing action");
      await button.trigger("click");
      expect(document.body.textContent).toContain(title);
      dialogButton("取消").click();
      await flushPromises();
      expect(resolve).not.toHaveBeenCalled();
      await button.trigger("click");
      dialogButton(confirmLabel).click();
      await flushPromises();
      expect(resolve).toHaveBeenCalledWith(
        "synthetic-user",
        conflict.id,
        choice,
      );
      expect(wrapper.text()).toContain("当前没有待处理的冲突");
    },
  );

  it("locks duplicate actions while the confirmation is open", async () => {
    const { sync, wrapper } = await setup();
    const resolve = vi.spyOn(sync, "resolve");
    await wrapper.findAll(".conflict-actions button")[0]!.trigger("click");
    expect(
      wrapper
        .findAll(".conflict-actions button")
        .every((button) => button.attributes("disabled") !== undefined),
    ).toBe(true);
    await wrapper.findAll(".conflict-actions button")[1]!.trigger("click");
    dialogButton("取消").click();
    await flushPromises();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("preserves a conflict and allows retry after operation failure", async () => {
    const { sync, wrapper } = await setup();
    const resolve = vi
      .spyOn(sync, "resolve")
      .mockRejectedValueOnce(new Error("synthetic failure"));
    const button = wrapper.findAll(".conflict-actions button")[0]!;
    await button.trigger("click");
    dialogButton("确认重新提交").click();
    await flushPromises();
    expect(wrapper.text()).toContain("处理失败，冲突仍可在此重试");
    expect(wrapper.text()).toContain("本地合成内容");
    expect(button.attributes("disabled")).toBeUndefined();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("keeps an idempotency conflict after server-choice failure and allows retry", async () => {
    const { sync, wrapper } = await setup({
      conflicts: [{ ...conflict, errorCode: "IDEMPOTENCY_CONFLICT" }],
    });
    const resolve = vi
      .spyOn(sync, "resolve")
      .mockRejectedValueOnce(new Error("synthetic failure"));
    const button = wrapper.get(".conflict-actions button");
    await button.trigger("click");
    dialogButton("确认使用服务端").click();
    await flushPromises();
    expect(wrapper.text()).toContain("处理失败，冲突仍可在此重试");
    expect(wrapper.text()).toContain("本地合成内容");
    expect(button.attributes("disabled")).toBeUndefined();
    expect(resolve).toHaveBeenCalledWith(
      "synthetic-user",
      conflict.id,
      "server",
    );
  });

  it("distinguishes offline and sync failure from an empty list, with retry", async () => {
    const { sync, wrapper } = await setup({ conflicts: [], offline: true });
    expect(wrapper.text()).toContain("当前离线，暂时无法确认");
    expect(wrapper.text()).not.toContain("当前没有待处理的冲突");
    sync.offline = false;
    sync.errorMessage = "synthetic failure";
    await flushPromises();
    expect(wrapper.text()).toContain("冲突状态暂时无法确认");
    const retry = vi.spyOn(sync, "retry").mockImplementation(async () => {
      sync.errorMessage = null;
    });
    vi.spyOn(sync, "refresh").mockResolvedValue(undefined);
    await wrapper.find(".sync-conflicts-availability button").trigger("click");
    await flushPromises();
    expect(retry).toHaveBeenCalledWith("synthetic-user");
    expect(wrapper.text()).toContain("当前没有待处理的冲突");
  });

  it("drops stale feedback after an account switch and keeps Browser Back", async () => {
    const { auth, router, sync, wrapper } = await setup();
    let release!: () => void;
    vi.spyOn(sync, "resolve").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const button = wrapper.findAll(".conflict-actions button")[0]!;
    await button.trigger("click");
    dialogButton("确认重新提交").click();
    await flushPromises();
    auth.offlineUserId = "another-user";
    release();
    await flushPromises();
    expect(wrapper.text()).not.toContain("已按现有规则重新提交");
    expect(wrapper.text()).not.toContain("本地合成内容");
    await wrapper.get(".page-header-back").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/account");
  });
});
