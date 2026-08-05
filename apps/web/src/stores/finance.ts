import { defineStore } from "pinia";

import {
  api,
  type BudgetSummary,
  type CategorySummary,
  type FinanceSummaryResponse,
  type FinancialAccountSummary,
  type TransactionSummary,
} from "../api/client";

interface FinanceState {
  budgets: BudgetSummary[];
  categories: CategorySummary[];
  accounts: FinancialAccountSummary[];
  summary: FinanceSummaryResponse | null;
  transactions: TransactionSummary[];
  transactionsLoading: boolean;
  summaryLoading: boolean;
  errorMessage: string | null;
}

export const useFinanceStore = defineStore("finance", {
  state: (): FinanceState => ({
    accounts: [],
    budgets: [],
    categories: [],
    errorMessage: null,
    summary: null,
    summaryLoading: false,
    transactions: [],
    transactionsLoading: false,
  }),
  actions: {
    async loadFinanceData(month: string) {
      this.errorMessage = null;
      await Promise.all([
        this.loadTransactions({ month }),
        this.loadSummary(month),
        this.loadBudgets(month),
        this.loadCategories(true),
        this.loadAccounts(true),
      ]);
    },
    async loadTransactions(
      params: {
        includeDeleted?: boolean;
        month?: string;
        type?: "EXPENSE" | "INCOME" | "REFUND";
      } = {},
    ) {
      this.transactionsLoading = true;
      try {
        const result = await api.listTransactions({ limit: 100, ...params });
        this.transactions = result.items;
      } catch (error) {
        this.errorMessage = errorMessage(error);
      } finally {
        this.transactionsLoading = false;
      }
    },
    async getTransaction(id: string) {
      return api.getTransaction(id);
    },
    async loadSummary(month: string) {
      this.summaryLoading = true;
      try {
        this.summary = await api.getFinanceSummary(month);
      } catch (error) {
        this.errorMessage = errorMessage(error);
      } finally {
        this.summaryLoading = false;
      }
    },
    async loadBudgets(month?: string) {
      try {
        this.budgets = (await api.listBudgets(month ? { month } : {})).items;
      } catch (error) {
        this.errorMessage = errorMessage(error);
      }
    },
    async loadCategories(includeArchived = false) {
      try {
        this.categories = (await api.listCategories({ includeArchived })).items;
      } catch (error) {
        this.errorMessage = errorMessage(error);
      }
    },
    async loadAccounts(includeArchived = false) {
      try {
        this.accounts = (
          await api.listFinancialAccounts({ includeArchived })
        ).items;
      } catch (error) {
        this.errorMessage = errorMessage(error);
      }
    },
    async createCategory(input: {
      color?: string;
      kind: "EXPENSE" | "INCOME";
      name: string;
    }) {
      await api.createCategory(input);
      await this.loadCategories(true);
    },
    async updateCategory(
      id: string,
      input: {
        color?: string;
        isArchived?: boolean;
        kind?: "EXPENSE" | "INCOME";
        name?: string;
        version: number;
      },
    ) {
      await api.updateCategory(id, input);
      await this.loadCategories(true);
    },
    async createAccount(input: {
      kind: "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "DIGITAL_WALLET" | "OTHER";
      name: string;
    }) {
      await api.createFinancialAccount(input);
      await this.loadAccounts(true);
    },
    async updateAccount(
      id: string,
      input: {
        isArchived?: boolean;
        kind?:
          "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "DIGITAL_WALLET" | "OTHER";
        name?: string;
        version: number;
      },
    ) {
      await api.updateFinancialAccount(id, input);
      await this.loadAccounts(true);
    },
    async createBudget(input: {
      amount: string;
      categoryId?: string | null;
      month: string;
    }) {
      await api.createBudget(input);
      await this.loadBudgets(input.month);
      await this.loadSummary(input.month);
    },
    async updateBudget(
      id: string,
      input: {
        amount?: string;
        categoryId?: string | null;
        month?: string;
        version: number;
      },
    ) {
      await api.updateBudget(id, input);
      await this.loadBudgets();
      await this.loadSummary(this.summary?.month ?? currentMonth());
    },
    async deleteBudget(id: string, month: string) {
      await api.deleteBudget(id);
      await this.loadBudgets(month);
      await this.loadSummary(month);
    },
    async createTransaction(input: {
      accountId?: string | null;
      amount: string;
      categoryId?: string | null;
      isUnlinkedRefund?: boolean;
      merchant?: string | null;
      note?: string | null;
      occurredAt?: string;
      originalTransactionId?: string | null;
      type: "EXPENSE" | "INCOME" | "REFUND";
    }) {
      const result = await api.createTransaction(input);
      await this.loadTransactions();
      return result;
    },
    async updateTransaction(
      id: string,
      input: {
        accountId?: string | null;
        amount?: string;
        categoryId?: string | null;
        isUnlinkedRefund?: boolean;
        merchant?: string | null;
        note?: string | null;
        occurredAt?: string;
        originalTransactionId?: string | null;
        type?: "EXPENSE" | "INCOME" | "REFUND";
        version: number;
      },
    ) {
      const result = await api.updateTransaction(id, input);
      await this.loadTransactions();
      return result;
    },
    async deleteTransaction(id: string) {
      await api.deleteTransaction(id);
      await this.loadTransactions({ includeDeleted: true });
      await this.loadSummary(this.summary?.month ?? currentMonth());
    },
    async restoreTransaction(id: string) {
      await api.restoreTransaction(id);
      await this.loadTransactions({ includeDeleted: true });
      await this.loadSummary(this.summary?.month ?? currentMonth());
    },
    async exportCsv(month?: string) {
      const result = await api.exportFinanceCsv({ month });
      const filename = month
        ? `daily-assistant-transactions-${month}.csv`
        : "daily-assistant-transactions-all.csv";
      const blob = new Blob([result.content], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    clearError() {
      this.errorMessage = null;
    },
  },
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}

function currentMonth(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(now);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${byType.year ?? "2026"}-${byType.month ?? "01"}`;
}
