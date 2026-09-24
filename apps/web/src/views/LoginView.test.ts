// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import LoginView from "./LoginView.vue";

const { replace, route } = vi.hoisted(() => ({
  replace: vi.fn(),
  route: { query: { redirect: "/" as string | undefined } },
}));

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ replace }),
}));

describe("LoginView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    route.query.redirect = "/";
    setActivePinia(createPinia());
  });

  it("shows guidance and preserves native field constraints", () => {
    const wrapper = mount(LoginView);
    expect(wrapper.text()).toContain("账号由管理员创建");
    expect(wrapper.get("#login-username").attributes("pattern")).toBe(
      "[a-z0-9_]{3,32}",
    );
    expect(wrapper.get("#login-username").attributes("required")).toBeDefined();
    expect(wrapper.get("#login-password").attributes("minlength")).toBe("12");
    expect(wrapper.get("#login-password").attributes("required")).toBeDefined();
  });

  it("honors the home redirect after logging out", async () => {
    const auth = useAuthStore();
    vi.spyOn(auth, "login").mockResolvedValue(undefined);
    const wrapper = mount(LoginView);

    await wrapper.get('input[type="text"]').setValue("demo_user");
    await wrapper.get('input[type="password"]').setValue("password-1234");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(auth.login).toHaveBeenCalledWith("demo_user", "password-1234");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("defaults to /account and prioritizes forced password change", async () => {
    const auth = useAuthStore();
    vi.spyOn(auth, "login").mockResolvedValue(undefined);
    route.query.redirect = undefined;
    const wrapper = mount(LoginView);
    await wrapper.get("#login-username").setValue("demo_user");
    await wrapper.get("#login-password").setValue("password-1234");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(replace).toHaveBeenCalledWith("/account");

    replace.mockClear();
    route.query.redirect = "/tasks";
    auth.mustChangePassword = true;
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(replace).toHaveBeenCalledWith("/change-password");
  });

  it("locks duplicate submissions synchronously and keeps progress visible", async () => {
    const auth = useAuthStore();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const login = vi.spyOn(auth, "login").mockReturnValue(pending);
    const wrapper = mount(LoginView);
    await wrapper.get("#login-username").setValue("demo_user");
    await wrapper.get("#login-password").setValue("password-1234");
    const form = wrapper.get("form");
    void form.trigger("submit");
    void form.trigger("submit");
    await wrapper.vm.$nextTick();
    expect(login).toHaveBeenCalledTimes(1);
    expect(form.attributes("aria-busy")).toBe("true");
    expect(wrapper.get('[role="status"]').text()).toContain("正在登录");
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    finish();
    await flushPromises();
  });

  it.each([
    new ApiClientError(401, "INVALID_CREDENTIALS", "账号或密码错误"),
    new ApiClientError(429, "RATE_LIMITED", "操作过于频繁，请稍后重试"),
    new Error("network unavailable"),
  ])(
    "keeps input after failure and permits a corrected retry (%s)",
    async (failure) => {
      const auth = useAuthStore();
      const login = vi
        .spyOn(auth, "login")
        .mockRejectedValueOnce(failure)
        .mockResolvedValue(undefined);
      const wrapper = mount(LoginView);
      await wrapper.get("#login-username").setValue("demo_user");
      await wrapper.get("#login-password").setValue("password-1234");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain(
        failure instanceof ApiClientError
          ? failure.message
          : "登录失败，请稍后重试",
      );
      expect(
        (wrapper.get("#login-username").element as HTMLInputElement).value,
      ).toBe("demo_user");
      expect(
        (wrapper.get("#login-password").element as HTMLInputElement).value,
      ).toBe("password-1234");
      expect(
        wrapper.get('button[type="submit"]').attributes("disabled"),
      ).toBeUndefined();
      await wrapper.get("#login-password").setValue("password-5678");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(login).toHaveBeenLastCalledWith("demo_user", "password-5678");
      expect(replace).toHaveBeenCalledWith("/");
    },
  );
});
