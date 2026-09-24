// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent } from "vue";

import { api, type ShortcutCredentialSummary } from "../api/client";
import AppDialogHost from "../components/AppDialogHost.vue";
import { appConfirmState } from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";
import ShortcutsView from "./ShortcutsView.vue";

const fakeToken = "fake-shortcut-token-for-unit-tests-only";
const activeCredential: ShortcutCredentialSummary = {
  createdAt: "2026-09-20T01:00:00.000Z",
  id: "credential-1",
  lastUsedAt: "2026-09-23T03:04:00.000Z",
  name: "测试设备凭证",
  revokedAt: null,
  scopes: ["transaction:draft:create", "finance:summary:read"],
  tokenPrefix: "fake_prefix",
};

const Host = defineComponent({
  components: { AppDialogHost, ShortcutsView },
  template: "<main><ShortcutsView /><AppDialogHost /></main>",
});

let wrappers: VueWrapper[] = [];
let clipboardDescriptor: PropertyDescriptor | undefined;

function mockApi(items: ShortcutCredentialSummary[] = []) {
  const list = vi
    .spyOn(api, "listShortcutCredentials")
    .mockResolvedValue({ items });
  const create = vi.spyOn(api, "createShortcutCredential").mockResolvedValue({
    credential: activeCredential,
    plaintextToken: fakeToken,
  });
  const revoke = vi
    .spyOn(api, "revokeShortcutCredential")
    .mockResolvedValue(undefined);
  return { create, list, revoke };
}

async function mountShortcuts() {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "unit-test-session" });

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/account",
        component: { template: "<h1>我的</h1>" },
        meta: { page: { title: "我的" } },
      },
      {
        path: "/shortcuts",
        component: { template: "<div />" },
        meta: {
          page: {
            parent: { path: "/account", title: "我的" },
            title: "快捷指令",
          },
        },
      },
    ],
  });
  await router.push("/account");
  await router.push("/shortcuts");
  await router.isReady();

  const wrapper = mount(Host, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return { router, wrapper };
}

function dialogButton(label: string): HTMLButtonElement {
  const button = Array.from(
    document.body.querySelectorAll<HTMLButtonElement>(
      ".app-dialog-actions button",
    ),
  ).find((item) => item.textContent?.trim() === label);
  if (!button) throw new Error(`找不到确认弹窗按钮：${label}`);
  return button;
}

beforeEach(() => {
  vi.restoreAllMocks();
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.assign(appConfirmState, {
    cancelLabel: "取消",
    confirmLabel: "确认",
    description: "",
    destructive: false,
    open: false,
    title: "请确认",
  });
});

afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount();
  wrappers = [];
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  vi.restoreAllMocks();
});

describe("ShortcutsView", () => {
  it("explains the safe uses and shows friendly names with exact scope keys", async () => {
    mockApi([activeCredential]);
    const { wrapper } = await mountShortcuts();

    expect(wrapper.get("h1").text()).toBe("快捷指令");
    expect(wrapper.text()).toContain("创建记账草稿");
    expect(wrapper.text()).toContain("读取今日支出");
    expect(wrapper.text()).toContain("transaction:draft:create");
    expect(wrapper.text()).toContain("finance:summary:read");
    expect(wrapper.text()).toContain("撤销后立即失效");
    expect(wrapper.text()).toContain("最近使用：09/23 11:04");
    expect(wrapper.text()).toContain("有效");
  });

  it("distinguishes initial loading and failed list loading, then retries", async () => {
    let rejectInitial!: (reason?: unknown) => void;
    const list = vi.spyOn(api, "listShortcutCredentials").mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectInitial = reject;
      }),
    );
    list.mockResolvedValueOnce({ items: [] });

    const pinia = createPinia();
    setActivePinia(pinia);
    useAuthStore().$patch({ accessToken: "unit-test-session" });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/account", component: { template: "<h1>我的</h1>" } },
        {
          path: "/shortcuts",
          component: { template: "<div />" },
          meta: {
            page: {
              parent: { path: "/account", title: "我的" },
              title: "快捷指令",
            },
          },
        },
      ],
    });
    await router.push("/shortcuts");
    await router.isReady();
    const wrapper = mount(Host, { global: { plugins: [pinia, router] } });
    wrappers.push(wrapper);
    await flushPromises();

    expect(wrapper.text()).toContain("正在加载设备凭证");
    rejectInitial(new Error("offline"));
    await flushPromises();
    expect(wrapper.text()).toContain("凭证列表暂时无法加载");
    expect(wrapper.text()).not.toContain("还没有设备凭证");
    await wrapper.get(".feedback-state-action").trigger("click");
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("还没有设备凭证");
  });

  it("validates name and at least one scope before calling the API", async () => {
    const { create } = mockApi();
    const { wrapper } = await mountShortcuts();

    await wrapper.get(".shortcuts-create-form").trigger("submit");

    expect(create).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("请填写设备凭证名称。");
    expect(wrapper.text()).toContain("请至少选择一个权限范围。");
    expect(document.activeElement).toBe(
      wrapper.get("#credential-name").element,
    );

    await wrapper.get("#credential-name").setValue("我的手机");
    await wrapper.get(".shortcuts-create-form").trigger("submit");
    expect(create).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(wrapper.get(".scope-fieldset").element);
  });

  it("sends the existing payload and shows the returned token only in page memory", async () => {
    const { create, list } = mockApi();
    list.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({
      items: [activeCredential],
    });
    const { wrapper } = await mountShortcuts();
    await wrapper.get("#credential-name").setValue("我的手机");
    await wrapper.get(".scope-option input").setValue(true);

    await wrapper.get(".shortcuts-create-form").trigger("submit");
    await flushPromises();

    expect(create).toHaveBeenCalledWith({
      name: "我的手机",
      scopes: ["transaction:draft:create"],
    });
    expect(wrapper.text()).toContain(fakeToken);
    expect(wrapper.text()).toContain("令牌仅显示这一次");
    expect(wrapper.get("#credential-name").element).toHaveProperty("value", "");
    expect(localStorage.getItem("shortcut-token")).toBeNull();
    expect(sessionStorage.getItem("shortcut-token")).toBeNull();
    expect(wrapper.text()).toContain("测试设备凭证");
  });

  it("locks duplicate creation and preserves form values after failure", async () => {
    let rejectCreate: ((reason?: unknown) => void) | undefined;
    const create = vi.spyOn(api, "createShortcutCredential").mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectCreate = reject;
      }),
    );
    vi.spyOn(api, "listShortcutCredentials").mockResolvedValue({ items: [] });
    vi.spyOn(api, "revokeShortcutCredential").mockResolvedValue(undefined);
    const { wrapper } = await mountShortcuts();
    await wrapper.get("#credential-name").setValue("保留的名称");
    await wrapper.get(".scope-option input").setValue(true);

    await wrapper.get(".shortcuts-create-form").trigger("submit");
    await wrapper.get(".shortcuts-create-form").trigger("submit");
    expect(create).toHaveBeenCalledTimes(1);
    expect(
      wrapper.get(".shortcuts-create-button").attributes("disabled"),
    ).toBeDefined();

    rejectCreate?.(new Error("offline"));
    await flushPromises();
    expect(wrapper.text()).toContain("网络异常，请稍后重试");
    expect(wrapper.get("#credential-name").element).toHaveProperty(
      "value",
      "保留的名称",
    );
    expect(
      (wrapper.get(".scope-option input").element as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      wrapper.get(".shortcuts-create-button").attributes("disabled"),
    ).toBeUndefined();
  });

  it("reports clipboard success and failure without exposing errors", async () => {
    mockApi();
    const { wrapper } = await mountShortcuts();
    await wrapper.get("#credential-name").setValue("复制测试");
    await wrapper.get(".scope-option input").setValue(true);
    await wrapper.get(".shortcuts-create-form").trigger("submit");
    await flushPromises();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await wrapper.get(".token-once-actions button").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(fakeToken);
    expect(wrapper.text()).toContain("令牌已复制");

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await wrapper.get(".token-once-actions button").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("复制失败");
    expect(wrapper.text()).not.toContain("denied");
  });

  it("does not send a revoke request when the confirmation is cancelled", async () => {
    const { revoke: revokeApi } = mockApi([activeCredential]);
    const { wrapper } = await mountShortcuts();

    await wrapper.get(".credential-revoke-button").trigger("click");
    expect(document.body.textContent).toContain("撤销设备凭证？");
    dialogButton("取消").click();
    await flushPromises();

    expect(revokeApi).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("有效");
  });

  it("revokes after confirmation and keeps the revoked status visible", async () => {
    const revoked = {
      ...activeCredential,
      revokedAt: "2026-09-24T02:00:00.000Z",
    };
    const { list, revoke: revokeApi } = mockApi([activeCredential]);
    list
      .mockResolvedValueOnce({ items: [activeCredential] })
      .mockResolvedValueOnce({
        items: [revoked],
      });
    const { wrapper } = await mountShortcuts();

    await wrapper.get(".credential-revoke-button").trigger("click");
    dialogButton("确认撤销").click();
    await flushPromises();

    expect(revokeApi).toHaveBeenCalledTimes(1);
    expect(revokeApi).toHaveBeenCalledWith(activeCredential.id);
    expect(wrapper.text()).toContain("已撤销");
    expect(wrapper.text()).toContain("快捷指令将立即失效");
    expect(wrapper.find(".credential-revoke-button").exists()).toBe(false);
  });

  it("keeps an active credential after revoke failure so the user can retry", async () => {
    const { revoke: revokeApi } = mockApi([activeCredential]);
    revokeApi.mockRejectedValueOnce(new Error("offline"));
    const { wrapper } = await mountShortcuts();

    await wrapper.get(".credential-revoke-button").trigger("click");
    dialogButton("确认撤销").click();
    await flushPromises();

    expect(wrapper.text()).toContain("网络异常，请稍后重试");
    expect(wrapper.text()).toContain("有效");
    expect(wrapper.find(".credential-revoke-button").exists()).toBe(true);
    expect(
      wrapper.get(".credential-revoke-button").attributes("disabled"),
    ).toBeUndefined();
  });

  it("uses the existing page-back route", async () => {
    mockApi();
    const { router, wrapper } = await mountShortcuts();

    await wrapper.get(".page-header-back").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/account");
  });
});
