// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionSummary } from "../api/client";
import * as AppConfirm from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import TransactionsView from "./TransactionsView.vue";

function currentShanghaiMonthDay(day = "01"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${byType.year}-${byType.month}-${day}`;
}

function currentShanghaiMonthDate(day = "01"): string {
  return `${currentShanghaiMonthDay(day)}T00:00:00.000+08:00`;
}

function transaction(
  id: string,
  type: TransactionSummary["type"],
  overrides: Partial<TransactionSummary> = {},
): TransactionSummary {
  const occurredAt = currentShanghaiMonthDate();
  return {
    accountId: null,
    amount: "12.3400",
    categoryId: null,
    createdAt: occurredAt,
    currency: "CNY",
    deletedAt: null,
    id,
    isUnlinkedRefund: type === "REFUND",
    merchant: "示例商户",
    note: null,
    occurredAt,
    originalTransactionId: null,
    source: "WEB",
    sourceFingerprint: null,
    status: "CONFIRMED",
    tripId: null,
    type,
    updatedAt: occurredAt,
    version: 1,
    ...overrides,
  };
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/records",
        component: { template: "<div>记录</div>" },
        meta: { page: { title: "记录" } },
      },
      {
        path: "/transactions",
        component: TransactionsView,
        meta: {
          page: { parent: { path: "/records", title: "记录" }, title: "账单" },
        },
      },
      {
        path: "/transactions/new",
        component: { template: "<div>新增</div>" },
      },
      {
        path: "/transactions/:id/edit",
        component: { template: "<div>编辑</div>" },
      },
    ],
  });
}

async function mountTransactions(
  options: {
    path?: string;
    transactions?: TransactionSummary[];
  } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "access-token" });
  const finance = useFinanceStore();
  finance.$patch({ transactions: options.transactions ?? [] });
  const load = vi
    .spyOn(finance, "loadTransactions")
    .mockImplementation(async () => undefined);
  const router = makeRouter();
  await router.push(options.path ?? "/transactions?source=records");
  await router.isReady();
  const wrapper = mount(TransactionsView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        DateField: {
          emits: ["update:modelValue"],
          props: ["modelValue"],
          template:
            '<input class="date-field-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
      },
    },
  });
  await flushPromises();
  return { finance, load, router, wrapper };
}

describe("TransactionsView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(false);
  });

  it("keeps the secondary-page title, source-preserving header actions, and filters", async () => {
    const { load, wrapper } = await mountTransactions();

    expect(wrapper.get("#transactions-title").text()).toBe("账单明细");
    expect(wrapper.get(".page-header-back").text()).toContain("返回记录");
    expect(wrapper.get("a.transactions-header-action").text()).toContain(
      "记一笔",
    );
    expect(wrapper.get("a.transactions-header-action").attributes("href")).toBe(
      "/transactions/new?returnTo=%2Ftransactions%3Fsource%3Drecords",
    );
    expect(wrapper.findAll(".transactions-header-action")).toHaveLength(2);
    expect(wrapper.find(".transaction-filters").findAll("label")).toHaveLength(
      4,
    );
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: undefined, type: undefined }),
    );

    await wrapper.get("select").setValue("INCOME");
    await flushPromises();
    expect(load).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDeleted: undefined, type: "INCOME" }),
    );
  });

  it("renders compact rows with labels, Shanghai time, exact money strings, notes, and deleted state", async () => {
    const { wrapper } = await mountTransactions({
      transactions: [
        transaction("expense-1", "EXPENSE", {
          amount: "000000000000000000000000.0100",
          merchant: null,
          note: "一条很长的备注，用于确认内容可以换行而不是把页面撑出横向滚动。",
        }),
        transaction("income-1", "INCOME", { amount: "8.90" }),
        transaction("refund-1", "REFUND", {
          amount: "3.20",
          deletedAt: currentShanghaiMonthDate(),
        }),
      ],
    });

    expect(wrapper.findAll(".transaction-list > li")).toHaveLength(2);
    expect(wrapper.text()).toContain("支出");
    expect(wrapper.text()).toContain("收入");
    expect(wrapper.text()).toContain("退款");
    expect(wrapper.text()).toContain("支出");
    expect(wrapper.text()).toContain("-¥000000000000000000000000.0100");
    expect(wrapper.text()).toContain("一条很长的备注");
    expect(wrapper.find(".transaction-list").text()).not.toContain("已删除");

    await wrapper.get(".transaction-deleted-filter input").setValue(true);
    await flushPromises();
    expect(wrapper.findAll(".transaction-list > li")).toHaveLength(3);
    expect(wrapper.text()).toContain("已删除");
    expect(wrapper.text()).toContain("+¥3.20");
    expect(
      wrapper.find("a[href*='/transactions/expense-1/edit']").exists(),
    ).toBe(true);
  });

  it("filters merged rows by type and Shanghai date range while retaining reload filters", async () => {
    const targetDate = currentShanghaiMonthDay();
    const targetStart = new Date(`${targetDate}T00:00:00+08:00`);
    const nextDateStart = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000);
    const { load, wrapper } = await mountTransactions({
      transactions: [
        transaction("expense-in-range", "EXPENSE", {
          merchant: "范围内支出",
          occurredAt: targetStart.toISOString(),
        }),
        transaction("income-in-range", "INCOME", {
          merchant: "范围内收入",
          occurredAt: new Date(nextDateStart.getTime() - 1).toISOString(),
        }),
        transaction("expense-before", "EXPENSE", {
          merchant: "范围前支出",
          occurredAt: new Date(targetStart.getTime() - 1).toISOString(),
        }),
        transaction("expense-after", "EXPENSE", {
          merchant: "范围后支出",
          occurredAt: nextDateStart.toISOString(),
        }),
        transaction("refund-in-range", "REFUND", {
          merchant: "范围内退款",
          occurredAt: targetStart.toISOString(),
        }),
      ],
    });

    const dateFields = wrapper.findAll<HTMLInputElement>(".date-field-stub");
    await dateFields[0]?.setValue(targetDate);
    await dateFields[1]?.setValue(targetDate);
    await flushPromises();

    expect(wrapper.findAll(".transaction-list > li")).toHaveLength(3);
    expect(wrapper.text()).toContain("范围内支出");
    expect(wrapper.text()).toContain("范围内收入");
    expect(wrapper.text()).toContain("范围内退款");
    expect(wrapper.text()).not.toContain("范围前支出");
    expect(wrapper.text()).not.toContain("范围后支出");

    await wrapper.get("select").setValue("EXPENSE");
    await flushPromises();

    expect(wrapper.findAll(".transaction-list > li")).toHaveLength(1);
    expect(wrapper.text()).toContain("范围内支出");
    expect(wrapper.text()).not.toContain("范围内收入");
    expect(wrapper.text()).not.toContain("范围内退款");
    expect(load).toHaveBeenLastCalledWith({
      endDate: targetDate,
      includeDeleted: undefined,
      startDate: targetDate,
      type: "EXPENSE",
    });
  });

  it("keeps loading, failed, retry, and empty list states honest", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useAuthStore().$patch({ accessToken: "access-token" });
    const finance = useFinanceStore();
    finance.$patch({ transactions: [] });
    let resolveLoad: (() => void) | undefined;
    const load = vi.spyOn(finance, "loadTransactions").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finance.transactionsLoading = true;
          resolveLoad = () => {
            finance.transactionsLoading = false;
            resolve();
          };
        }),
    );
    const router = makeRouter();
    await router.push("/transactions");
    await router.isReady();
    const wrapper = mount(TransactionsView, {
      global: { plugins: [pinia, router] },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true);
    expect(wrapper.find(".empty-state").exists()).toBe(false);

    resolveLoad?.();
    await flushPromises();
    expect(wrapper.find(".empty-state").text()).toContain("当前筛选下没有账单");

    load.mockImplementationOnce(async () => {
      finance.errorKind = "REQUEST_FAILED";
      finance.errorMessage = "账单加载失败";
    });
    await wrapper.get("select").setValue("REFUND");
    await flushPromises();
    expect(wrapper.find(".feedback-error-state").text()).toContain(
      "账单加载失败",
    );
    expect(wrapper.find(".empty-state").exists()).toBe(false);

    load.mockImplementationOnce(async () => {
      finance.errorKind = null;
      finance.errorMessage = null;
      finance.transactions = [transaction("recovered", "REFUND")];
    });
    await wrapper.get(".feedback-error-state button").trigger("click");
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(3);
    expect(wrapper.find(".transaction-list").exists()).toBe(true);
  });

  it("confirms reversible deletion, restores deleted rows, and keeps action failures separate", async () => {
    const deleted = transaction("deleted-1", "EXPENSE", {
      deletedAt: currentShanghaiMonthDate(),
    });
    const { finance, wrapper } = await mountTransactions({
      transactions: [transaction("active-1", "EXPENSE"), deleted],
    });
    const remove = vi
      .spyOn(finance, "deleteTransaction")
      .mockResolvedValue(undefined);
    const restore = vi
      .spyOn(finance, "restoreTransaction")
      .mockResolvedValue(undefined);
    const confirm = vi.mocked(AppConfirm.requestAppConfirm);

    await wrapper.get("button.text-button.danger").trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith({
      confirmLabel: "删除",
      description: "删除后仍可在“显示已删除”中恢复。",
      destructive: true,
      title: "删除这笔账单？",
    });
    expect(remove).not.toHaveBeenCalled();

    confirm.mockResolvedValueOnce(true);
    await wrapper.get("button.text-button.danger").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("active-1");

    await wrapper.get(".transaction-deleted-filter input").setValue(true);
    await flushPromises();
    await wrapper.get("button.text-button:not(.danger)").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledWith("deleted-1");

    restore.mockRejectedValueOnce(new Error("恢复失败"));
    await wrapper.get("button.text-button:not(.danger)").trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain("操作失败");
    expect(wrapper.find(".feedback-error-state").exists()).toBe(false);
  });

  it("exports only the active date and type filters and reports export failures", async () => {
    const { finance, wrapper } = await mountTransactions();
    const exportCsv = vi.spyOn(finance, "exportCsv").mockResolvedValue();

    await wrapper.get("select").setValue("EXPENSE");
    await wrapper.get(".transaction-deleted-filter input").setValue(true);
    await flushPromises();
    await wrapper.get("button.transactions-header-action").trigger("click");
    await flushPromises();

    expect(exportCsv).toHaveBeenCalledWith(
      expect.objectContaining({ type: "EXPENSE" }),
    );
    expect(exportCsv.mock.calls[0]?.[0]).not.toHaveProperty("includeDeleted");

    exportCsv.mockRejectedValueOnce(new Error("导出失败"));
    await wrapper.get("button.transactions-header-action").trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain("操作失败");
  });
});
