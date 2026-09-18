// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  type BudgetSummary,
  type FinanceSummaryResponse,
} from "../api/client";
import * as AppConfirm from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import BudgetsView from "./BudgetsView.vue";

function budget(
  id: string,
  categoryId: string | null = null,
  amount = "1000.00",
  month = "2026-09",
): BudgetSummary {
  return {
    amount,
    categoryId,
    createdAt: "2026-09-01T00:00:00.000Z",
    currency: "CNY",
    deletedAt: null,
    id,
    month,
    updatedAt: "2026-09-01T00:00:00.000Z",
    version: 4,
  };
}

function summary(month = "2026-09"): FinanceSummaryResponse {
  return {
    budgets: [
      {
        amount: "1000.00",
        budgetId: "budget-1",
        categoryId: null,
        categoryName: null,
        progress: "1.25",
        remaining: "-250.00",
        spent: "1250.00",
      },
    ],
    currency: "CNY",
    month,
    netExpense: "1250.00",
    todaySpend: "20.00",
    totalExpense: "1250.00",
    totalIncome: "0.00",
    totalRefund: "0.00",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

async function mountBudgets(
  options: {
    budgets?: BudgetSummary[];
    financeSummary?: FinanceSummaryResponse | null;
    categories?: Array<{
      color: string;
      createdAt: string;
      deletedAt: string | null;
      id: string;
      isArchived: boolean;
      kind: "EXPENSE" | "INCOME";
      name: string;
      updatedAt: string;
      version: number;
    }>;
    loadError?: string;
    summaryError?: string;
  } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "access-token" });
  const finance = useFinanceStore();
  finance.$patch({
    budgets: options.budgets ?? [budget("budget-1")],
    categories: options.categories ?? [
      {
        color: "#7c5cfa",
        createdAt: "2026-09-01T00:00:00.000Z",
        deletedAt: null,
        id: "category-1",
        isArchived: false,
        kind: "EXPENSE",
        name: "餐饮",
        updatedAt: "2026-09-01T00:00:00.000Z",
        version: 1,
      },
      {
        color: "#7c5cfa",
        createdAt: "2026-09-01T00:00:00.000Z",
        deletedAt: null,
        id: "category-archived",
        isArchived: true,
        kind: "EXPENSE",
        name: "已归档",
        updatedAt: "2026-09-01T00:00:00.000Z",
        version: 1,
      },
    ],
    summary:
      options.financeSummary === undefined ? summary() : options.financeSummary,
  });
  const loadBudgets = vi
    .spyOn(finance, "loadBudgets")
    .mockResolvedValue(undefined);
  const loadSummary = vi
    .spyOn(finance, "loadSummary")
    .mockResolvedValue(undefined);
  const loadCategories = vi
    .spyOn(finance, "loadCategories")
    .mockResolvedValue(undefined);
  if (options.loadError) {
    let first = true;
    loadBudgets.mockImplementation(async () => {
      if (first) {
        finance.errorMessage = options.loadError ?? null;
        first = false;
      }
    });
  }
  if (options.summaryError) {
    loadSummary.mockImplementation(async () => {
      finance.errorMessage = options.summaryError ?? null;
    });
  }
  const createBudget = vi
    .spyOn(finance, "createBudget")
    .mockResolvedValue(undefined);
  const updateBudget = vi
    .spyOn(finance, "updateBudget")
    .mockResolvedValue(undefined);
  const deleteBudget = vi
    .spyOn(finance, "deleteBudget")
    .mockResolvedValue(undefined);
  const wrapper = mount(BudgetsView, {
    global: { plugins: [pinia] },
  });
  await flushPromises();
  return {
    createBudget,
    deleteBudget,
    finance,
    loadBudgets,
    loadCategories,
    loadSummary,
    updateBudget,
    wrapper,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BudgetsView", () => {
  it("keeps the page order, month control, string amounts, and over-budget text", async () => {
    const { wrapper } = await mountBudgets();

    expect(wrapper.get("#budgets-title").text()).toBe("月度预算");
    expect(
      wrapper.findAll(".section-card-header h2").map((item) => item.text()),
    ).toEqual(["当月预算概览", "设置新预算", "本月预算列表"]);
    expect(wrapper.text()).toContain("餐饮");
    expect(wrapper.text()).toContain("已超出预算");
    expect(wrapper.text()).toContain("¥1250.00");
    expect(wrapper.text()).toContain("¥1000.00");
    expect(wrapper.find(".progress-track").attributes("role")).toBe(
      "progressbar",
    );
    expect(wrapper.find(".budget-create-form").exists()).toBe(true);
    expect(wrapper.find(".temporal-field").exists()).toBe(true);
  });

  it("loads the current month budget, summary, and categories", async () => {
    const { loadBudgets, loadCategories, loadSummary } = await mountBudgets();

    expect(loadBudgets).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}$/),
    );
    expect(loadSummary).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}$/),
    );
    expect(loadCategories).toHaveBeenCalledWith(true);
  });

  it("shows empty data without inventing summary zeros", async () => {
    const { wrapper } = await mountBudgets({
      budgets: [],
      financeSummary: null,
    });

    expect(wrapper.text()).toContain("本月还没有预算");
    expect(wrapper.text()).toContain("本月摘要暂不可用");
    expect(wrapper.text()).not.toContain("¥0.00");
  });

  it("keeps cached budgets visible beside a retryable load error", async () => {
    const { loadBudgets, wrapper } = await mountBudgets({
      loadError: "预算服务暂时不可用",
    });

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "预算服务暂时不可用",
    );
    expect(wrapper.text()).toContain("整体预算");
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(loadBudgets).toHaveBeenCalledTimes(2);
  });

  it("keeps summary failure separate from a usable budget list", async () => {
    const { loadSummary, wrapper } = await mountBudgets({
      summaryError: "摘要服务暂时不可用",
    });

    expect(wrapper.text()).toContain("本月预算列表");
    expect(wrapper.text()).toContain("摘要服务暂时不可用");
    expect(wrapper.text()).toContain("整体预算");
    await wrapper.get(".budget-feedback button").trigger("click");
    await flushPromises();
    expect(loadSummary).toHaveBeenCalledTimes(2);
  });

  it("creates an overall and category budget with string amounts", async () => {
    const { createBudget, wrapper } = await mountBudgets();
    const amountInput = wrapper.get('input[aria-label="预算金额"]');

    await amountInput.setValue("1234.500");
    await wrapper.get(".budget-create-form").trigger("submit");
    await flushPromises();
    expect(createBudget).toHaveBeenCalledWith({
      amount: "1234.500",
      categoryId: null,
      month: expect.any(String),
    });
    expect((amountInput.element as HTMLInputElement).value).toBe("");

    await wrapper.get('[aria-label="预算范围"]').setValue("category-1");
    await amountInput.setValue("88.00");
    await wrapper.get(".budget-create-form").trigger("submit");
    await flushPromises();
    expect(createBudget).toHaveBeenLastCalledWith({
      amount: "88.00",
      categoryId: "category-1",
      month: expect.any(String),
    });
  });

  it("blocks empty create and retains input after a failed create", async () => {
    const { createBudget, wrapper } = await mountBudgets();
    const input = wrapper.get('input[aria-label="预算金额"]');
    await wrapper.get(".budget-create-form").trigger("submit");
    expect(createBudget).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("请输入预算金额");

    createBudget.mockRejectedValue(
      new ApiClientError(503, "REQUEST_FAILED", "预算服务暂时不可用"),
    );
    await input.setValue("300.00");
    await wrapper.get(".budget-create-form").trigger("submit");
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe("300.00");
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "预算服务暂时不可用",
    );
  });

  it("sends a versioned string update and preserves a failed edit", async () => {
    const { updateBudget, wrapper } = await mountBudgets();
    const input = wrapper.get('input[aria-label="调整整体预算金额"]');
    await input.setValue("1200.000");
    await input.trigger("change");
    await flushPromises();
    expect(updateBudget).toHaveBeenCalledWith("budget-1", {
      amount: "1200.000",
      version: 4,
    });

    updateBudget.mockRejectedValue(
      new ApiClientError(409, "VERSION_CONFLICT", "预算已被更新，请刷新后重试"),
    );
    await input.setValue("1300.00");
    await input.trigger("change");
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe("1300.00");
    expect(wrapper.get('[role="alert"]').text()).toContain("预算已被更新");
  });

  it("confirms before deleting and handles cancellation and failure", async () => {
    const { deleteBudget, wrapper } = await mountBudgets();
    const confirm = vi
      .spyOn(AppConfirm, "requestAppConfirm")
      .mockResolvedValue(false);
    const remove = wrapper.get('button[aria-label="删除整体预算"]');
    await remove.trigger("click");
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ destructive: true }),
    );
    expect(deleteBudget).not.toHaveBeenCalled();

    confirm.mockResolvedValue(true);
    deleteBudget.mockRejectedValue(
      new ApiClientError(503, "REQUEST_FAILED", "删除预算失败"),
    );
    await remove.trigger("click");
    await flushPromises();
    expect(deleteBudget).toHaveBeenCalledWith("budget-1", expect.any(String));
    expect(wrapper.text()).toContain("删除预算失败");
    expect(wrapper.text()).toContain("整体预算");
  });

  it("prevents duplicate create submissions", async () => {
    const { createBudget, wrapper } = await mountBudgets();
    let resolve!: () => void;
    createBudget.mockImplementation(
      () => new Promise<void>((done) => (resolve = done)),
    );
    const input = wrapper.get('input[aria-label="预算金额"]');
    await input.setValue("500.00");
    await wrapper.get(".budget-create-form").trigger("submit");
    await wrapper.get(".budget-create-form").trigger("submit");
    expect(createBudget).toHaveBeenCalledTimes(1);
    resolve();
    await flushPromises();
  });

  it("clears a successful create even when its refresh reports an error", async () => {
    const { createBudget, finance, wrapper } = await mountBudgets();
    createBudget.mockImplementation(async () => {
      finance.errorMessage = "预算刷新失败";
    });
    const input = wrapper.get('input[aria-label="预算金额"]');
    await input.setValue("500.00");
    await wrapper.get(".budget-create-form").trigger("submit");
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(wrapper.text()).not.toContain("预算已保存，但刷新失败");
  });
});
