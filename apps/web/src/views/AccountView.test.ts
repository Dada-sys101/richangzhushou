// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import {
  createMemoryHistory,
  createRouter,
  RouterView,
  type Router,
} from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, type UserSummary } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import AccountView from "./AccountView.vue";

const requestAppConfirmMock = vi.hoisted(() => vi.fn());
const pwaFactoryMock = vi.hoisted(() => vi.fn());

vi.mock("../composables/useAppConfirm", () => ({
  requestAppConfirm: requestAppConfirmMock,
}));

vi.mock("../composables/usePwaLifecycle", () => ({
  usePwaLifecycle: pwaFactoryMock,
}));

const Placeholder = {
  template: '<div data-testid="placeholder">placeholder</div>',
};

const RouterHost = {
  components: { RouterView },
  template: "<RouterView />",
};

const ACCOUNT_ROUTES = [
  "/change-password",
  "/sync/conflicts",
  "/transactions",
  "/finance/categories",
  "/finance/accounts",
  "/finance/budgets",
  "/other",
  "/login",
].map((path) => ({ path, component: Placeholder }));

function user(status: UserSummary["status"] = "ACTIVE"): UserSummary {
  return {
    closedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    deletionRequestedAt: null,
    displayName: "演示用户",
    id: "user-1",
    role: "USER",
    status,
    updatedAt: "2026-08-01T00:00:00.000Z",
    username: "demo-user",
  };
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/account",
        name: "account",
        component: AccountView,
        meta: { page: { title: "我的" } },
      },
      {
        path: "/login",
        name: "login",
        component: Placeholder,
      },
      ...ACCOUNT_ROUTES,
    ],
  });
}

interface AccountContext {
  auth: ReturnType<typeof useAuthStore>;
  router: Router;
  sync: ReturnType<typeof useSyncStore>;
  wrapper: VueWrapper;
}

const mountedContexts = new Set<AccountContext>();

function createPwaState() {
  return {
    canInstall: ref(false),
    install: vi.fn(),
    ios: ref(false),
    standalone: ref(false),
  };
}

async function mountAccount(
  status: UserSummary["status"] = "ACTIVE",
  pwa = createPwaState(),
): Promise<AccountContext> {
  pwaFactoryMock.mockReturnValue(pwa);
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.$patch({ accessToken: "access-token", user: user(status) });
  const sync = useSyncStore();
  sync.$patch({
    conflictCount: 0,
    errorMessage: null,
    failedCount: 0,
    lastSyncedAt: null,
    pendingCount: 0,
    status: "SYNCED",
    syncing: false,
  });
  const router = makeRouter();
  await router.push("/account");
  await router.isReady();
  const wrapper = mount(RouterHost, {
    global: { plugins: [pinia, router] },
  });
  const context = { auth, router, sync, wrapper };
  mountedContexts.add(context);
  await flushPromises();
  return context;
}

async function openRiskActions(wrapper: VueWrapper) {
  await wrapper.get(".account-danger-details summary").trigger("click");
  await wrapper.vm.$nextTick();
}

afterEach(() => {
  for (const context of mountedContexts) {
    context.wrapper.unmount();
  }
  mountedContexts.clear();
  requestAppConfirmMock.mockReset();
  pwaFactoryMock.mockReset();
  vi.restoreAllMocks();
});

beforeEach(() => {
  requestAppConfirmMock.mockResolvedValue(false);
});

describe("AccountView", () => {
  it("prioritizes the account overview and renders the real sync badge", async () => {
    const { sync, wrapper } = await mountAccount();
    sync.$patch({
      failedCount: 2,
      lastSyncedAt: "2026-08-01T08:09:10.000Z",
      pendingCount: 1,
      status: "PENDING_SYNC",
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.get("h1").text()).toBe("我的");
    expect(wrapper.get("#account-overview-title").text()).toBe("演示用户");
    expect(wrapper.get(".account-identity").text()).toBe("demo-user");
    expect(wrapper.get(".account-status-summary").text()).toContain(
      "账号状态：正常",
    );
    expect(wrapper.get("#sync-status-title").text()).toBe("真实同步状态");
    expect(wrapper.get('[role="status"]').text()).toContain("同步中");
    expect(wrapper.get('[role="status"]').text()).toContain("失败 2");
    expect(wrapper.text()).not.toContain("已同步 · demo-user");
  });

  it.each([
    ["ACTIVE", "正常", "账号可以正常使用"],
    ["SUSPENDED", "已暂停", "账号已暂停，请联系管理员处理"],
    ["CLOSED", "已关闭", "账号已关闭，当前无法使用"],
    ["DELETION_PENDING", "等待删除", "删除申请已提交，正在等待处理"],
    ["DELETION_PROCESSING", "正在删除", "删除流程正在处理，请稍候"],
    ["DELETED", "已删除", "账号已删除，当前无法使用"],
  ] as const)(
    "uses text and description for the %s account state",
    async (status, label, description) => {
      const { wrapper } = await mountAccount(status);
      const summary = wrapper.get(".account-status-summary");
      expect(summary.text()).toContain(`账号状态：${label}`);
      expect(summary.text()).toContain(description);
    },
  );

  it("keeps all account entry points accessible without duplicate record links", async () => {
    const { wrapper } = await mountAccount();
    const hrefs = wrapper.findAll("a").map((link) => link.attributes("href"));

    expect(hrefs).toContain("/change-password");
    expect(hrefs).toContain("/sync/conflicts");
    expect(hrefs).toContain("/transactions");
    expect(hrefs).toContain("/finance/categories");
    expect(hrefs).toContain("/finance/accounts");
    expect(hrefs).toContain("/finance/budgets");
    expect(hrefs.filter((href) => href === "/transactions")).toHaveLength(1);
    expect(hrefs.filter((href) => href === "/sync/conflicts")).toHaveLength(1);
    expect(wrapper.findAll('button[aria-label="退出登录"]')).toHaveLength(1);
  });

  it("uses the browser-mode PWA state without showing a fake install action", async () => {
    const { wrapper } = await mountAccount();

    expect(wrapper.text()).toContain("浏览器模式");
    expect(wrapper.text()).toContain("当前浏览器暂未提供安装入口");
    expect(wrapper.text()).not.toContain("添加到主屏幕");
  });

  it("uses the existing PWA install action when the browser exposes one", async () => {
    const pwa = createPwaState();
    pwa.canInstall.value = true;
    const { wrapper } = await mountAccount("ACTIVE", pwa);

    const installButton = wrapper
      .findAll("button.settings-button")
      .find((button) => button.text().includes("添加到主屏幕"));
    expect(installButton).toBeDefined();
    await installButton!.trigger("click");
    expect(pwa.install).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("添加到主屏幕");
  });

  it("logs out through auth and preserves the existing login redirect", async () => {
    const { auth, router, wrapper } = await mountAccount();
    const logout = vi.spyOn(auth, "logout").mockResolvedValue(undefined);

    await wrapper.get("button.settings-button").trigger("click");
    await flushPromises();

    expect(logout).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query).toEqual({ redirect: "/" });
  });

  it("keeps high-risk actions collapsed and reveals final submission after selection", async () => {
    const { wrapper } = await mountAccount();
    const details = wrapper.get(".account-danger-details");

    expect((details.element as HTMLDetailsElement).open).toBe(false);
    expect(wrapper.find(".account-risk-form").exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false);

    await openRiskActions(wrapper);

    expect(wrapper.find(".account-risk-form").exists()).toBe(true);
    expect(
      wrapper.find('input[autocomplete="current-password"]').exists(),
    ).toBe(true);
    expect(wrapper.find('textarea[maxlength="500"]').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false);

    await wrapper.get('button[aria-pressed="false"]').trigger("click");
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
  });

  it("keeps risk inputs after a failed request and prevents duplicate submission", async () => {
    const { auth, wrapper } = await mountAccount();
    const requestDeletion = vi
      .spyOn(auth, "requestDeletion")
      .mockImplementation(
        () =>
          new Promise<void>((_, reject) => {
            rejectRequest = reject;
          }),
      );
    let rejectRequest!: (reason?: unknown) => void;
    await openRiskActions(wrapper);
    await wrapper.findAll(".risk-actions button")[1]!.trigger("click");
    const password = wrapper.get('input[autocomplete="current-password"]');
    const reason = wrapper.get('textarea[maxlength="500"]');
    await password.setValue("wrong-password");
    await reason.setValue("保留输入以便重试");

    const form = wrapper.get(".account-risk-form");
    form.element.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await wrapper.vm.$nextTick();
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBe(
      "",
    );
    form.element.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    expect(requestDeletion).toHaveBeenCalledOnce();
    rejectRequest(
      new ApiClientError(400, "INVALID_PASSWORD", "当前密码不正确"),
    );
    await flushPromises();

    expect(requestDeletion).toHaveBeenCalledOnce();
    expect(requestDeletion).toHaveBeenCalledWith(
      "wrong-password",
      "保留输入以便重试",
    );
    expect(wrapper.get('[role="alert"]').text()).toContain("当前密码不正确");
    expect((password.element as HTMLInputElement).value).toBe("wrong-password");
    expect((reason.element as HTMLTextAreaElement).value).toBe(
      "保留输入以便重试",
    );
  });

  it("submits a close request once and returns to login after success", async () => {
    const { auth, router, wrapper } = await mountAccount();
    const closeAccount = vi
      .spyOn(auth, "closeAccount")
      .mockResolvedValue(undefined);
    await openRiskActions(wrapper);
    await wrapper.get(".risk-actions button").trigger("click");
    await wrapper
      .get('input[autocomplete="current-password"]')
      .setValue("current-password");
    await wrapper.get('textarea[maxlength="500"]').setValue("关闭账号测试");
    await wrapper.get(".account-risk-form").trigger("submit");
    await flushPromises();

    expect(closeAccount).toHaveBeenCalledWith(
      "current-password",
      "关闭账号测试",
    );
    expect(router.currentRoute.value.name).toBe("login");
  });

  it("keeps the page when the unsaved leave confirmation is rejected and leaves after acceptance", async () => {
    const { router, wrapper } = await mountAccount();
    await openRiskActions(wrapper);
    await wrapper.get(".risk-actions button").trigger("click");
    await wrapper.get('textarea[maxlength="500"]').setValue("尚未提交的原因");

    requestAppConfirmMock.mockResolvedValueOnce(false);
    await router.push("/other");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/account");
    expect(requestAppConfirmMock).toHaveBeenCalledOnce();
    expect(wrapper.get('textarea[maxlength="500"]').element).toHaveProperty(
      "value",
      "尚未提交的原因",
    );

    requestAppConfirmMock.mockResolvedValueOnce(true);
    await router.push("/other");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/other");
  });
});
