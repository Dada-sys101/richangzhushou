// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../stores/auth";
import LoginView from "./LoginView.vue";

const replace = vi.fn();

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: { redirect: "/" } }),
  useRouter: () => ({ replace }),
}));

describe("LoginView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
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
});
