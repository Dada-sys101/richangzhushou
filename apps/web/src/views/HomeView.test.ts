// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinanceSummaryResponse, UserSummary } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
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
    email: "demo@example.com",
  };
}

function mockLoads() {
  const finance = useFinanceStore();
  const planner = usePlannerStore();
  const trips = useTripsStore();
  vi.spyOn(finance, "loadFinanceData").mockResolvedValue(undefined);
  vi.spyOn(planner, "loadCalendarEvents").mockResolvedValue(undefined);
  vi.spyOn(planner, "loadTasks").mockResolvedValue(undefined);
  vi.spyOn(planner, "loadReminders").mockResolvedValue(undefined);
  vi.spyOn(trips, "loadTrips").mockResolvedValue(undefined);
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
    expect(wrapper.text()).toContain("请登录后查看今日数据");
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
    expect(wrapper.text()).toContain("数据加载失败，请稍后重试");
    expect(load).toHaveBeenCalledOnce();

    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("renders quick actions, monthly finance, today schedule and empty states", async () => {
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

    expect(wrapper.text()).toContain("今日概览");
    expect(wrapper.text()).toContain("记一笔");
    expect(wrapper.text()).toContain("新建待办");
    expect(wrapper.text()).toContain("新建日程");
    expect(wrapper.text()).toContain("添加提醒");

    expect(wrapper.text()).toContain("本月财务");
    expect(wrapper.text()).toContain("¥500.00");
    expect(wrapper.text()).toContain("¥200.00");
    expect(wrapper.text()).toContain("¥800.00");

    expect(wrapper.text()).toContain("今日安排");
    expect(wrapper.text()).toContain("查看今日日程安排");
    expect(wrapper.text()).toContain("处理今日待办事项");
    expect(wrapper.text()).toContain("查看今日提醒");

    expect(wrapper.text()).toContain("还没有账单");
    expect(wrapper.text()).toContain("还没有行程");
    const quickLinks = wrapper.findAllComponents(RouterLinkStub);
    expect(
      quickLinks.some(
        (link) =>
          link.props("to") === "/transactions/new" &&
          link.text().includes("记一笔"),
      ),
    ).toBe(true);
    expect(quickLinks.some((link) => link.props("to") === "/trips")).toBe(true);
  });
});
