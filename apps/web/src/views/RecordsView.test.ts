// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DraftSummary,
  FinanceSummaryResponse,
  TransactionSummary,
} from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useDraftsStore } from "../stores/drafts";
import { useFinanceStore } from "../stores/finance";
import RecordsView from "./RecordsView.vue";

function financeSummary(): FinanceSummaryResponse {
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
    todaySpend: "20.00",
    totalExpense: "123.450",
    totalIncome: "900.10",
    totalRefund: "12.00",
    updatedAt: "2026-08-06T04:00:00.000Z",
  };
}

function transaction(
  id: string,
  type: TransactionSummary["type"],
  index: number,
): TransactionSummary {
  return {
    accountId: null,
    amount: index + 1 + ".00",
    categoryId: null,
    createdAt: "2026-08-06T00:00:00.000Z",
    currency: "CNY",
    deletedAt: null,
    id,
    isUnlinkedRefund: type === "REFUND",
    merchant: "商户 " + (index + 1),
    note: null,
    occurredAt: "2026-08-06T00:00:00.000Z",
    originalTransactionId: null,
    source: "WEB",
    sourceFingerprint: null,
    status: "CONFIRMED",
    tripId: null,
    type,
    updatedAt: "2026-08-06T00:00:00.000Z",
    version: 1,
  };
}

function draft(id = "draft-1"): DraftSummary {
  return {
    attachmentId: null,
    clientMutationId: null,
    confidence: null,
    confirmedAt: null,
    createdAt: "2026-08-06T00:00:00.000Z",
    discardedAt: null,
    failureReason: null,
    id,
    payload: {
      amount: "88.00",
      merchant: "待确认商户",
      occurredAt: "2026-08-06T00:00:00.000Z",
      type: "REFUND",
    },
    resultId: null,
    source: "WEB",
    status: "PENDING",
    targetType: "TRANSACTION",
    updatedAt: "2026-08-06T00:00:00.000Z",
    version: 1,
  };
}

async function mountRecords(
  options: {
    path?: string;
    summary?: FinanceSummaryResponse | null;
    transactions?: TransactionSummary[];
    drafts?: DraftSummary[];
  } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "access-token" });
  const finance = useFinanceStore();
  const draftsStore = useDraftsStore();
  finance.$patch({
    summary: options.summary === undefined ? financeSummary() : options.summary,
    transactions: options.transactions ?? [
      transaction("expense-1", "EXPENSE", 0),
      transaction("income-1", "INCOME", 1),
      transaction("refund-1", "REFUND", 2),
    ],
  });
  draftsStore.$patch({ drafts: options.drafts ?? [draft()] });

  const financeLoad = vi
    .spyOn(finance, "loadFinanceData")
    .mockResolvedValue(undefined);
  const draftsLoad = vi
    .spyOn(draftsStore, "loadDrafts")
    .mockResolvedValue(undefined);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/records", component: RecordsView }],
  });
  await router.push(options.path ?? "/records");
  await router.isReady();
  const wrapper = mount(RecordsView, {
    global: { plugins: [pinia, router] },
  });
  await flushPromises();
  return { draftsLoad, draftsStore, finance, financeLoad, router, wrapper };
}

describe("RecordsView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the title, quick capture action, and source-preserving links", async () => {
    const { wrapper } = await mountRecords();

    expect(wrapper.get("#records-title").text()).toBe("记录中心");
    expect(wrapper.get("a.records-capture-action").attributes("href")).toBe(
      "/capture?returnTo=%2Frecords",
    );
    expect(wrapper.get("a.record-tab-detail").attributes("href")).toBe(
      "/transactions?returnTo=%2Frecords",
    );
    expect(wrapper.get("a.records-insight").text()).toContain("预算管理");
    expect(wrapper.get("a.records-insight").text()).not.toContain("智能洞察");
    expect(wrapper.get("a.records-insight").attributes("href")).toBe(
      "/finance/budgets?returnTo=%2Frecords",
    );
    expect(wrapper.find("a.records-capture-action").text()).toContain(
      "快速记录",
    );
  });

  it("renders exact summary strings without inventing a zero fallback", async () => {
    const ready = await mountRecords();
    expect(ready.wrapper.find(".records-summary").text()).toContain("¥123.450");
    expect(ready.wrapper.find(".records-summary").text()).toContain("¥900.10");
    expect(ready.wrapper.find(".records-summary").text()).toContain("¥800.00");
    expect(ready.wrapper.find(".records-summary").text()).not.toContain(
      "¥0.00",
    );

    const absent = await mountRecords({ summary: null });
    expect(absent.wrapper.find(".records-summary").text()).toContain(
      "本月摘要暂不可用",
    );
    expect(absent.wrapper.find(".records-summary").text()).not.toContain(
      "¥0.00",
    );
  });

  it("keeps tab state and query keys stable with accessible linkage", async () => {
    const { router, wrapper } = await mountRecords({
      path: "/records?source=home",
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.attributes("aria-selected")).toBe("true");
    expect(tabs[0]!.attributes("aria-controls")).toBe("records-panel-recent");
    expect(tabs[0]!.attributes("tabindex")).toBe("0");
    expect(tabs[1]!.attributes("aria-selected")).toBe("false");
    expect(tabs[1]!.attributes("tabindex")).toBe("-1");
    expect(
      wrapper.get("#records-panel-recent").attributes("aria-labelledby"),
    ).toBe("records-tab-recent");

    await tabs[1]!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({
      source: "home",
      tab: "pending",
    });
    expect(wrapper.find("#records-panel-pending").exists()).toBe(true);

    await wrapper.get("#records-tab-pending").trigger("keydown", {
      key: "Home",
    });
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ source: "home" });
    expect(wrapper.find("#records-panel-recent").exists()).toBe(true);

    await router.push("/records?source=home&tab=pending");
    await flushPromises();
    expect(
      wrapper.get("#records-tab-pending").attributes("aria-selected"),
    ).toBe("true");
    await router.back();
    await flushPromises();
    expect(wrapper.get("#records-tab-recent").attributes("aria-selected")).toBe(
      "true",
    );
  });

  it("limits rows to six and preserves merchant, labels, dates, signs, and sources", async () => {
    const transactions = Array.from({ length: 7 }, (_, index) =>
      transaction(
        "transaction-" + (index + 1),
        index === 1 ? "INCOME" : index === 2 ? "REFUND" : "EXPENSE",
        index,
      ),
    );
    const { wrapper } = await mountRecords({ transactions });
    expect(wrapper.findAll(".prototype-record-list li")).toHaveLength(6);
    expect(wrapper.text()).toContain("商户 1");
    expect(wrapper.text()).toContain("支出");
    expect(wrapper.text()).toContain("收入");
    expect(wrapper.text()).toContain("退款");
    expect(wrapper.text()).toContain("-¥1.00");
    expect(wrapper.text()).toContain("+¥2.00");
    expect(wrapper.text()).toContain("+¥3.00");
    expect(
      wrapper.find("a[href*='/transactions/transaction-1/edit']").exists(),
    ).toBe(true);

    await wrapper.get("#records-tab-pending").trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".prototype-record-list li")).toHaveLength(1);
    expect(wrapper.text()).toContain("待确认商户");
    expect(wrapper.text()).toContain("退款");
    expect(wrapper.text()).toContain("待确认");
    expect(wrapper.text()).toContain("去确认");
    expect(wrapper.text()).toContain("+¥88.00");
    expect(wrapper.find("a[href*='/drafts?returnTo=']").exists()).toBe(true);
    expect(
      wrapper.findAll("button").some((item) => item.text() === "确认"),
    ).toBe(false);
  });

  it("isolates loading and errors between finance and drafts, with direct retries", async () => {
    const pending = await mountRecords();
    pending.finance.$patch({
      errorKind: "REQUEST_FAILED",
      errorMessage: "finance failed",
    });
    await pending.wrapper.get("#records-tab-pending").trigger("click");
    await flushPromises();
    expect(pending.wrapper.text()).toContain("待确认商户");
    expect(pending.wrapper.text()).not.toContain("¥123.450");

    await pending.wrapper.get("#records-tab-recent").trigger("click");
    await flushPromises();
    expect(pending.wrapper.find('[role="alert"]').exists()).toBe(true);
    await pending.wrapper.find('[role="alert"] button').trigger("click");
    expect(pending.financeLoad).toHaveBeenCalledTimes(2);

    const drafts = await mountRecords();
    drafts.draftsStore.errorMessage = "drafts failed";
    await drafts.wrapper.get("#records-tab-pending").trigger("click");
    await flushPromises();
    expect(drafts.wrapper.text()).toContain("待确认草稿暂时不可用");
    await drafts.wrapper.find('[role="alert"] button').trigger("click");
    expect(drafts.draftsLoad).toHaveBeenCalledTimes(2);
    await drafts.wrapper.get("#records-tab-recent").trigger("click");
    await flushPromises();
    expect(drafts.wrapper.text()).toContain("商户 1");
  });

  it("keeps capture and scoped loading states available", async () => {
    const context = await mountRecords();
    context.finance.$patch({
      summary: null,
      summaryLoading: true,
      transactionsLoading: true,
    });
    await context.wrapper.vm.$nextTick();
    expect(context.wrapper.find("a.records-capture-action").exists()).toBe(
      true,
    );
    expect(context.wrapper.find('[role="status"]').text()).toContain(
      "正在加载本月概览",
    );
    expect(context.wrapper.find(".records-list-state").text()).toContain(
      "正在加载最近记录",
    );

    await context.wrapper.get("#records-tab-pending").trigger("click");
    await context.wrapper.vm.$nextTick();
    expect(context.wrapper.text()).toContain("待确认商户");
  });

  it("shows both honest empty states", async () => {
    const { wrapper } = await mountRecords({
      summary: null,
      transactions: [],
      drafts: [],
    });
    expect(wrapper.text()).toContain("还没有记录");
    await wrapper.get("#records-tab-pending").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("没有待确认草稿");
  });
});
