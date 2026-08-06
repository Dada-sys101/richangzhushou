import { describe, expect, it } from "vitest";

import { localSummary } from "./local";

describe("localSummary", () => {
  it("computes month totals, refunds, income, and budget progress", () => {
    const transactions = [
      {
        amount: "100.00",
        categoryId: "cat-1",
        occurredAt: "2026-08-06T04:00:00.000Z",
        status: "CONFIRMED",
        type: "EXPENSE",
      },
      {
        amount: "20.00",
        categoryId: "cat-1",
        occurredAt: "2026-08-06T05:00:00.000Z",
        status: "CONFIRMED",
        type: "REFUND",
      },
      {
        amount: "50.00",
        occurredAt: "2026-08-06T06:00:00.000Z",
        status: "CONFIRMED",
        type: "INCOME",
      },
      {
        amount: "999.00",
        occurredAt: "2026-07-01T00:00:00.000Z",
        status: "CONFIRMED",
        type: "EXPENSE",
      },
    ];
    const budgets = [
      {
        amount: "200.00",
        categoryId: "cat-1",
        id: "budget-1",
        month: "2026-08",
      },
    ];
    const categories = [{ id: "cat-1", name: "餐饮" }];
    const summary = localSummary(transactions, budgets, categories, "2026-08");
    expect(summary.totalExpense).toBe("100.00");
    expect(summary.totalRefund).toBe("20.00");
    expect(summary.netExpense).toBe("80.00");
    expect(summary.totalIncome).toBe("50.00");
    expect(summary.budgets[0]).toMatchObject({
      amount: "200.00",
      categoryName: "餐饮",
      progress: "0.40",
      remaining: "120.00",
      spent: "80.00",
    });
  });
});
