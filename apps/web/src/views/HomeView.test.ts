// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinanceSummaryResponse, UserSummary } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import { useDraftsStore } from "../stores/drafts";
import { usePlannerStore } from "../stores/planner";
import { useTripsStore } from "../stores/trips";
import HomeView from "./HomeView.vue";

function summary(): FinanceSummaryResponse {
  return {
    budgets: [
      {
        amount: "1000.00",
        budgetId: "budget-1",
        categoryId: null,
        categoryName: null,
        progress: "0.2",
        remaining: "800.00",
        spent: "200.00",
      },
    ],
    currency: "CNY",
    month: "2026-08",
    netExpense: "200.00",
    todaySpend: "10.00",
    totalExpense: "200.00",
    totalIncome: "500.00",
    totalRefund: "0.00",
    updatedAt: "2026-08-06T04:00:00.000Z",
  };
}

function user(): UserSummary {
  return {
    closedAt: null,
    createdAt: "2026-08-06T00:00:00.000Z",
    deletionRequestedAt: null,
    displayName: "演示用户",
    id: "user-1",
    role: "USER",
    status: "ACTIVE",
    updatedAt: "2026-08-06T00:00:00.000Z",
    username: "demo",
  };
}

function mockLoads() {
  const finance = useFinanceStore();
  const planner = usePlannerStore();
  const trips = useTripsStore();
  const drafts = useDraftsStore();
  vi.spyOn(finance, "loadFinanceData").mockResolvedValue(undefined);
  vi.spyOn(planner, "loadCalendarEvents").mockResolvedValue(undefined);
  vi.spyOn(planner, "loadTasks").mockResolvedValue(undefined);
  vi.spyOn(planner, "loadReminders").mockResolvedValue(undefined);
  vi.spyOn(trips, "loadTrips").mockResolvedValue(undefined);
  vi.spyOn(drafts, "loadDrafts").mockResolvedValue(undefined);
}

function createHomeContext() {
  const pinia = createPinia();
  setActivePinia(pinia);
  mockLoads();
  return pinia;
}

function mountHome(pinia: ReturnType<typeof createPinia>) {
  return mount(HomeView, {
    global: {
      plugins: [pinia],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

describe("HomeView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("prompts login when the user is not authenticated", async () => {
    const pinia = createHomeContext();
    const wrapper = mountHome(pinia);
    await flushPromises();
    expect(wrapper.text()).toContain("请登录后查看今日安排");
    const loginLink = wrapper.findComponent(RouterLinkStub);
    expect(loginLink.props("to")).toEqual({
      name: "login",
      query: { redirect: "/" },
    });
  });

  it("shows the expired-session state with a re-login action", async () => {
    const pinia = createHomeContext();
    const auth = useAuthStore();
    auth.$patch({ accessToken: "token", user: user() });
    const finance = useFinanceStore();
    vi.spyOn(finance, "loadFinanceData").mockImplementation(async () => {
      finance.errorKind = "AUTH_EXPIRED";
    });
    const wrapper = mountHome(pinia);
    await flushPromises();
    expect(wrapper.text()).toContain("登录状态已过期，请重新登录");
    const loginLink = wrapper.findComponent(RouterLinkStub);
    expect(loginLink.props("to")).toEqual({
      name: "login",
      query: { redirect: "/" },
    });
  });

  it("renders an accessible loading state while the home request is pending", async () => {
    const pinia = createHomeContext();
    const auth = useAuthStore();
    auth.$patch({ accessToken: "token", user: user() });
    const finance = useFinanceStore();
    let resolveFinance: (() => void) | undefined;
    vi.spyOn(finance, "loadFinanceData").mockReturnValue(
      new Promise<void>((resolve) => {
        resolveFinance = resolve;
      }),
    );

    const wrapper = mountHome(pinia);
    await wrapper.vm.$nextTick();

    const loading = wrapper.find('[role="status"]');
    expect(loading.exists()).toBe(true);
    expect(loading.attributes("aria-live")).toBe("polite");
    expect(loading.attributes("aria-busy")).toBe("true");
    expect(loading.text()).toContain("正在整理今天的安排…");
    expect(wrapper.find(".home-layout").exists()).toBe(false);

    resolveFinance?.();
    await flushPromises();
    expect(wrapper.find(".home-layout").exists()).toBe(true);
  });

  it("shows the request-failed state and retries on demand", async () => {
    const pinia = createHomeContext();
    const auth = useAuthStore();
    auth.$patch({ accessToken: "token", user: user() });
    const finance = useFinanceStore();
    const load = vi
      .spyOn(finance, "loadFinanceData")
      .mockImplementation(async () => {
        finance.errorKind = "REQUEST_FAILED";
      });
    const wrapper = mountHome(pinia);
    await flushPromises();
    expect(wrapper.text()).toContain("暂时无法加载今天");
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').text()).toContain(
      "检查网络后重试，离线记录仍会保留在本机。",
    );
    expect(wrapper.find(".home-layout").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("今日时间轴");
    expect(load).toHaveBeenCalledOnce();

    await wrapper.find('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });

  it("renders one V2 home focus and a combined empty timeline", async () => {
    const pinia = createHomeContext();
    const auth = useAuthStore();
    auth.$patch({ accessToken: "token", user: user() });
    const finance = useFinanceStore();
    finance.$patch({
      errorKind: null,
      errorMessage: null,
      summary: summary(),
      transactions: [],
    });
    const planner = usePlannerStore();
    planner.$patch({
      calendarEvents: [],
      errorKind: null,
      errorMessage: null,
      reminders: [],
      tasks: [],
    });
    const trips = useTripsStore();
    trips.$patch({ errorKind: null, errorMessage: null, trips: [] });

    const wrapper = mountHome(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("今日时间轴");
    expect(wrapper.text()).toContain("今天没有安排");
    expect(wrapper.text()).toContain("例如：明天 10 点和李想开会");
    expect(wrapper.findAll(".focus-card")).toHaveLength(0);
    const quickLinks = wrapper.findAllComponents(RouterLinkStub);
    expect(
      quickLinks.some((link) => link.props("to") === "/capture?returnTo=%2F"),
    ).toBe(true);
  });

  it("prioritizes the greeting, capture entry, and confirmation-safe AI entry", async () => {
    const pinia = createHomeContext();
    const auth = useAuthStore();
    auth.$patch({ accessToken: "token", user: user() });
    const wrapper = mountHome(pinia);
    await flushPromises();

    const greeting = wrapper.find(".home-greeting");
    expect(greeting.exists()).toBe(true);
    expect(greeting.find("#home-title").exists()).toBe(true);
    expect(greeting.find(".home-date").text()).toBe(
      new Intl.DateTimeFormat("zh-CN", {
        day: "numeric",
        month: "long",
        timeZone: "Asia/Shanghai",
        weekday: "long",
      }).format(new Date()),
    );
    expect(greeting.text()).toContain("天气暂未配置");

    const assistantMark = greeting.find(".assistant-mark");
    expect(assistantMark.attributes("aria-hidden")).toBe("true");
    expect(greeting.find(".page-header-actions .assistant-mark").exists()).toBe(
      false,
    );

    const links = wrapper.findAllComponents(RouterLinkStub);
    const captureLink = links.find((link) =>
      link.classes().includes("home-capture"),
    );
    const aiLink = links.find((link) =>
      link.classes().includes("home-ai-link"),
    );
    expect(captureLink?.props("to")).toBe("/capture?returnTo=%2F");
    expect(aiLink?.props("to")).toBe("/ai?returnTo=%2F");
    expect(wrapper.find(".home-ai-link").text()).toContain(
      "生成建议或内容，确认后再写入",
    );
    expect(wrapper.text()).not.toContain("已同步");

    expect(
      greeting.element.compareDocumentPosition(
        wrapper.find(".home-capture").element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      wrapper
        .find(".home-capture")
        .element.compareDocumentPosition(
          wrapper.find(".home-ai-link").element,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      wrapper
        .find(".home-ai-link")
        .element.compareDocumentPosition(wrapper.find(".home-layout").element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
