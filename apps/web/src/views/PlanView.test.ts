// @vitest-environment jsdom
import { flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import PlanView from "./PlanView.vue";

describe("PlanView", () => {
  it("offers day, week and month views with today as the default range", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    const planner = usePlannerStore();
    auth.$patch({ accessToken: "token" });
    vi.spyOn(planner, "loadCalendarEvents").mockResolvedValue(undefined);
    vi.spyOn(planner, "loadTasks").mockResolvedValue(undefined);
    vi.spyOn(planner, "loadReminders").mockResolvedValue(undefined);

    const wrapper = mount(PlanView, {
      global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("今天的时间轴");
    await wrapper
      .get(".segmented-control button:nth-child(2)")
      .trigger("click");
    expect(wrapper.text()).toContain("本周计划");
    await wrapper
      .get(".segmented-control button:nth-child(3)")
      .trigger("click");
    expect(wrapper.text()).toContain("本月计划");
  });
});
