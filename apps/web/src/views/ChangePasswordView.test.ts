// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import {
  createWebHistory,
  createMemoryHistory,
  createRouter,
  RouterView,
  type Router,
} from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../api/client";
import AppDialogHost from "../components/AppDialogHost.vue";
import * as AppConfirm from "../composables/useAppConfirm";
import * as UnsavedChanges from "../composables/useUnsavedChanges";
import { useAuthStore } from "../stores/auth";
import ChangePasswordView from "./ChangePasswordView.vue";

const CURRENT_VALUE = "current-value-for-test";
const NEW_VALUE = "new-value-for-test";
const CONFIRM_VALUE = "new-value-for-test";

const Placeholder = {
  template: '<div data-testid="account-page">账户页</div>',
};
const RouterHost = {
  components: { AppDialogHost, RouterView },
  template: "<RouterView /><AppDialogHost />",
};

interface MountOptions {
  realReplace?: boolean;
  seedBackHistory?: boolean;
  webHistory?: boolean;
}

const mountedResources = new Set<{
  router: Router;
  webHistory: boolean;
  wrapper: VueWrapper;
}>();

function makeRouter(webHistory = false): Router {
  return createRouter({
    history: webHistory ? createWebHistory() : createMemoryHistory(),
    routes: [
      {
        path: "/account",
        name: "account",
        component: Placeholder,
        meta: { page: { title: "我的" } },
      },
      {
        path: "/change-password",
        name: "change-password",
        component: ChangePasswordView,
        meta: {
          page: {
            title: "修改密码",
            parent: { title: "我的", path: "/account" },
          },
        },
      },
    ],
  });
}

async function mountView(
  query: Record<string, string> = { returnTo: "/account" },
  mustChangePassword = false,
  options: MountOptions = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.mustChangePassword = mustChangePassword;
  const changePassword = vi
    .spyOn(auth, "changePassword")
    .mockResolvedValue(undefined);
  if (options.webHistory) {
    window.history.replaceState(null, "", "/");
  }
  const router = makeRouter(options.webHistory);
  if (options.seedBackHistory) {
    await router.push({ name: "account" });
  }
  await router.push({ name: "change-password", query });
  await router.isReady();
  const replace = vi.spyOn(router, "replace");
  if (!options.realReplace) {
    replace.mockResolvedValue(undefined as never);
  }
  const wrapper = mount(RouterHost, {
    global: {
      plugins: [pinia, router],
      stubs: { AppIcon: true },
    },
  });
  mountedResources.add({
    router,
    webHistory: Boolean(options.webHistory),
    wrapper,
  });
  return { auth, changePassword, replace, router, wrapper };
}

async function fillForm(wrapper: VueWrapper) {
  const inputs = wrapper.findAll('input[type="password"]');
  await inputs[0]!.setValue(CURRENT_VALUE);
  await inputs[1]!.setValue(NEW_VALUE);
  await inputs[2]!.setValue(CONFIRM_VALUE);
}

function inputValues(wrapper: VueWrapper): string[] {
  return wrapper
    .findAll('input[type="password"]')
    .map((input) => (input.element as HTMLInputElement).value);
}

async function settleBrowserHistory() {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  await flushPromises();
}

afterEach(() => {
  for (const resource of mountedResources) {
    resource.wrapper.unmount();
    if (resource.webHistory) {
      resource.router.options.history.destroy();
    }
  }
  mountedResources.clear();
  AppConfirm.resolveAppConfirm(false);
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("ChangePasswordView", () => {
  it("keeps auth fields, password metadata and UiFormField slot bindings", async () => {
    const { wrapper } = await mountView({}, true);
    const passwordInputs = wrapper.findAll('input[type="password"]');

    expect(wrapper.get('input[name="username"]').attributes()).toMatchObject({
      autocomplete: "username",
      hidden: "",
    });
    expect(wrapper.get("h1").text()).toBe("修改密码");
    expect(wrapper.text()).toContain("必须先设置新密码");
    expect(passwordInputs).toHaveLength(3);
    expect(passwordInputs.map((input) => input.attributes("id"))).toEqual([
      "change-password-current",
      "change-password-new",
      "change-password-confirm",
    ]);
    expect(passwordInputs.map((input) => input.attributes("required"))).toEqual(
      ["", "", ""],
    );
    expect(
      passwordInputs.map((input) => input.attributes("aria-required")),
    ).toEqual(["true", "true", "true"]);
    expect(passwordInputs[0]!.attributes("aria-describedby")).toBeUndefined();
    expect(passwordInputs[1]!.attributes("aria-describedby")).toBe(
      "change-password-new-help",
    );
    expect(passwordInputs[2]!.attributes("aria-describedby")).toBe(
      "change-password-confirm-help",
    );
    expect(
      passwordInputs.every((input) => input.attributes("minlength") === "12"),
    ).toBe(true);
    expect(
      passwordInputs.map((input) => input.attributes("autocomplete")),
    ).toEqual(["current-password", "new-password", "new-password"]);
    expect(
      passwordInputs.map((input) => input.attributes("aria-label")),
    ).toEqual(["当前密码", "新密码", "确认新密码"]);
    expect(
      wrapper
        .findAll(".ui-form-field__required")
        .every((marker) => marker.attributes("aria-hidden") === "true"),
    ).toBe(true);
    wrapper.unmount();
  });

  it("blocks mismatched passwords without calling auth and preserves inputs", async () => {
    const { changePassword, wrapper } = await mountView();
    const inputs = wrapper.findAll('input[type="password"]');
    await inputs[0]!.setValue(CURRENT_VALUE);
    await inputs[1]!.setValue(NEW_VALUE);
    await inputs[2]!.setValue("different-value-for-test");

    await wrapper.get("form").trigger("submit");

    expect(changePassword).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "两次输入的新密码不一致",
    );
    expect(inputValues(wrapper)).toEqual([
      CURRENT_VALUE,
      NEW_VALUE,
      "different-value-for-test",
    ]);
    wrapper.unmount();
  });

  it("prevents duplicate submissions and clears fields before safe return", async () => {
    let resolveRequest!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    const { changePassword, replace, wrapper } = await mountView();
    changePassword.mockReturnValue(pending);
    await fillForm(wrapper);

    const submit = wrapper.get("form");
    await submit.trigger("submit");
    await submit.trigger("submit");

    expect(changePassword).toHaveBeenCalledTimes(1);
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBe(
      "",
    );
    expect(wrapper.get('button[type="submit"]').text()).toContain("提交中");

    resolveRequest();
    await flushPromises();
    expect(replace).toHaveBeenCalledWith("/account");
    expect(inputValues(wrapper)).toEqual(["", "", ""]);
    expect(wrapper.get('[role="status"]').text()).toContain("密码已修改");
    wrapper.unmount();
  });

  it("keeps inputs and displays only the safe API message on failure", async () => {
    const { changePassword, wrapper } = await mountView();
    changePassword.mockRejectedValue(
      new ApiClientError(400, "INVALID_PASSWORD", "当前密码不正确"),
    );
    await fillForm(wrapper);

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain("当前密码不正确");
    expect(wrapper.text()).not.toContain("INVALID_PASSWORD");
    expect(inputValues(wrapper)).toEqual([
      CURRENT_VALUE,
      NEW_VALUE,
      CONFIRM_VALUE,
    ]);
    wrapper.unmount();
  });

  it("falls back to the parent for an unsafe return target", async () => {
    const { replace, wrapper } = await mountView({
      returnTo: "https://example.invalid/steal",
    });
    await fillForm(wrapper);
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(replace).toHaveBeenCalledWith("/account");
    wrapper.unmount();
  });

  it("prompts and blocks the dirty app cancel navigation", async () => {
    const confirm = vi
      .spyOn(AppConfirm, "requestAppConfirm")
      .mockResolvedValue(false);
    const { router, wrapper } = await mountView(
      { returnTo: "/account" },
      false,
      { realReplace: true },
    );
    await fillForm(wrapper);

    await wrapper.get("a.secondary-button").trigger("click");
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmLabel: "离开",
        destructive: true,
        title: "放弃未保存的内容？",
      }),
    );
    expect(router.currentRoute.value.name).toBe("change-password");
    expect(inputValues(wrapper)).toEqual([
      CURRENT_VALUE,
      NEW_VALUE,
      CONFIRM_VALUE,
    ]);
    wrapper.unmount();
  });

  it("prompts and allows dirty app cancel navigation when accepted", async () => {
    const confirm = vi
      .spyOn(AppConfirm, "requestAppConfirm")
      .mockResolvedValue(true);
    const { router, wrapper } = await mountView(
      { returnTo: "/account" },
      false,
      { realReplace: true },
    );
    await fillForm(wrapper);

    await wrapper.get("a.secondary-button").trigger("click");
    await flushPromises();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.path).toBe("/account");
    expect(wrapper.find("h1").exists()).toBe(false);
    wrapper.unmount();
  });

  it("prompts and blocks dirty browser-style Back navigation", async () => {
    const confirm = vi
      .spyOn(AppConfirm, "requestAppConfirm")
      .mockResolvedValue(false);
    const { router, wrapper } = await mountView(
      { returnTo: "/account" },
      false,
      { realReplace: true, seedBackHistory: true },
    );
    await fillForm(wrapper);

    await router.back();
    await flushPromises();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.name).toBe("change-password");
    expect(inputValues(wrapper)).toEqual([
      CURRENT_VALUE,
      NEW_VALUE,
      CONFIRM_VALUE,
    ]);
    wrapper.unmount();
  });

  it("restores the URL and page when dirty Browser Back is rejected", async () => {
    const confirm = vi.spyOn(AppConfirm, "requestAppConfirm");
    const { router, wrapper } = await mountView(
      { returnTo: "/account" },
      false,
      { realReplace: true, seedBackHistory: true, webHistory: true },
    );
    await fillForm(wrapper);

    router.back();
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        "放弃未保存的内容？",
      );
    });
    expect(window.location.pathname).toBe("/change-password");

    document
      .querySelector<HTMLButtonElement>('[role="dialog"] button.secondary')
      ?.click();
    await settleBrowserHistory();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(AppConfirm.appConfirmState.open).toBe(false);
    expect(router.currentRoute.value.path).toBe("/change-password");
    expect(router.currentRoute.value.query.returnTo).toBe("/account");
    expect(new URL(window.location.href).searchParams.get("returnTo")).toBe(
      "/account",
    );
    expect(window.location.pathname).toBe("/change-password");
    expect(wrapper.get("h1").text()).toBe("修改密码");
    expect(inputValues(wrapper)).toEqual([
      CURRENT_VALUE,
      NEW_VALUE,
      CONFIRM_VALUE,
    ]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    router.back();
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        "放弃未保存的内容？",
      );
    });
    expect(confirm).toHaveBeenCalledTimes(2);
    document
      .querySelector<HTMLButtonElement>('[role="dialog"] button.secondary')
      ?.click();
    await settleBrowserHistory();

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(AppConfirm.appConfirmState.open).toBe(false);
    expect(router.currentRoute.value.path).toBe("/change-password");
    expect(new URL(window.location.href).searchParams.get("returnTo")).toBe(
      "/account",
    );
    expect(window.location.pathname).toBe("/change-password");
    expect(wrapper.get("h1").text()).toBe("修改密码");
    expect(inputValues(wrapper)).toEqual([
      CURRENT_VALUE,
      NEW_VALUE,
      CONFIRM_VALUE,
    ]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("accepts dirty Browser Back exactly once and leaves the form", async () => {
    const confirm = vi.spyOn(AppConfirm, "requestAppConfirm");
    const { replace, router, wrapper } = await mountView(
      { returnTo: "/account" },
      false,
      { realReplace: true, seedBackHistory: true, webHistory: true },
    );
    await fillForm(wrapper);

    router.back();
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    document
      .querySelector<HTMLButtonElement>('[role="dialog"] button.danger')
      ?.click();
    await settleBrowserHistory();
    await vi.waitFor(() => {
      expect(router.currentRoute.value.path).toBe("/account");
    });
    await settleBrowserHistory();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/account");
    expect(AppConfirm.appConfirmState.open).toBe(false);
    expect(router.currentRoute.value.path).toBe("/account");
    expect(window.location.pathname).toBe("/account");
    expect(wrapper.find("h1").exists()).toBe(false);
    expect(wrapper.get('[data-testid="account-page"]').text()).toBe("账户页");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("lets clean Browser Back proceed without opening a confirmation", async () => {
    const confirm = vi.spyOn(AppConfirm, "requestAppConfirm");
    const { router } = await mountView({ returnTo: "/account" }, false, {
      realReplace: true,
      seedBackHistory: true,
      webHistory: true,
    });

    router.back();
    await vi.waitFor(() => {
      expect(router.currentRoute.value.path).toBe("/account");
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/account");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("allows successful navigation before replacing the safe return target", async () => {
    const allowNavigation = vi.fn();
    const useUnsavedChanges = vi
      .spyOn(UnsavedChanges, "useUnsavedChanges")
      .mockReturnValue({
        allowNavigation,
        resetNavigationGuard: vi.fn(),
      });
    const { replace, wrapper } = await mountView(
      { returnTo: "/account" },
      false,
      { realReplace: true },
    );
    allowNavigation.mockImplementation(() => undefined);
    await fillForm(wrapper);

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(useUnsavedChanges).toHaveBeenCalledTimes(1);
    expect(allowNavigation).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/account");
    expect(allowNavigation.mock.invocationCallOrder[0]).toBeLessThan(
      replace.mock.invocationCallOrder[0]!,
    );
    wrapper.unmount();
  });
});
