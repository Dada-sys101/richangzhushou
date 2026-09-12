import { defineStore } from "pinia";

import {
  api,
  apiErrorKind,
  isOfflineError,
  type ApiErrorKind,
  type BudgetSummary,
  type CategorySummary,
  type FinanceSummaryResponse,
  type FinancialAccountSummary,
  type TransactionSummary,
} from "../api/client";
import {
  localGet,
  localList,
  localSummary,
  mergePending,
} from "../offline/local";
import type { SyncEntityType } from "../offline/sync";
import { useAuthStore } from "./auth";

type TransactionParams = {
  endDate?: string;
  includeDeleted?: boolean;
  month?: string;
  startDate?: string;
  type?: "EXPENSE" | "INCOME" | "REFUND";
};

interface FinanceState {
  budgets: BudgetSummary[];
  categories: CategorySummary[];
  accounts: FinancialAccountSummary[];
  errorKind: ApiErrorKind | null;
  lastAccountsIncludeArchived: boolean;
  lastBudgetMonth: string | undefined;
  lastCategoriesIncludeArchived: boolean;
  lastSummaryMonth: string | null;
  lastTransactionParams: TransactionParams;
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
    errorKind: null,
    errorMessage: null,
    lastAccountsIncludeArchived: false,
    lastBudgetMonth: undefined,
    lastCategoriesIncludeArchived: false,
    lastSummaryMonth: null,
    lastTransactionParams: {},
    summary: null,
    summaryLoading: false,
    transactions: [],
    transactionsLoading: false,
  }),
  actions: {
    async loadFinanceData(month: string) {
      this.errorMessage = null;
      this.errorKind = null;
      await Promise.all([
        this.loadTransactions({}),
        this.loadSummary(month),
        this.loadBudgets(month),
        this.loadCategories(true),
        this.loadAccounts(true),
      ]);
    },
    async loadTransactions(params: TransactionParams = {}) {
      this.lastTransactionParams = { ...params };
      this.transactionsLoading = true;
      try {
        const result = await api.listTransactions({ limit: 100, ...params });
        this.transactions = mergePending(
          result.items,
          await this.localTransactions(),
        );
      } catch (error) {
        if (isOfflineError(error)) {
          this.transactions = await this.localTransactions();
        } else {
          this.errorKind = apiErrorKind(error);
          this.errorMessage = errorMessage(error);
        }
      } finally {
        this.transactionsLoading = false;
      }
    },
    async getTransaction(id: string) {
      try {
        return await api.getTransaction(id);
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          if (userId) {
            const local = await localGet(userId, "TRANSACTION", id);
            if (local) {
              return local as unknown as TransactionSummary;
            }
          }
        }
        throw error;
      }
    },
    async loadSummary(month: string) {
      this.lastSummaryMonth = month;
      this.summaryLoading = true;
      try {
        this.summary = await api.getFinanceSummary(month);
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          if (userId) {
            this.summary = localSummary(
              await localList(userId, "TRANSACTION"),
              await localList(userId, "BUDGET"),
              await localList(userId, "CATEGORY"),
              month,
            ) as unknown as FinanceSummaryResponse;
          }
        } else {
          this.errorKind = apiErrorKind(error);
          this.errorMessage = errorMessage(error);
        }
      } finally {
        this.summaryLoading = false;
      }
    },
    async loadBudgets(month?: string) {
      this.lastBudgetMonth = month;
      try {
        const result = await api.listBudgets(month ? { month } : {});
        const userId = useAuthStore().userId;
        const locals = userId
          ? (await localList(userId, "BUDGET")).filter(
              (budget) => !month || budget.month === month,
            )
          : [];
        this.budgets = mergePending(
          result.items,
          locals as unknown as BudgetSummary[],
        );
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          this.budgets = userId
            ? ((await localList(
                userId,
                "BUDGET",
              )) as unknown as BudgetSummary[])
            : [];
        } else {
          this.errorKind = apiErrorKind(error);
          this.errorMessage = errorMessage(error);
        }
      }
    },
    async loadCategories(includeArchived = false) {
      this.lastCategoriesIncludeArchived = includeArchived;
      try {
        const result = await api.listCategories({ includeArchived });
        const userId = useAuthStore().userId;
        const locals = userId ? await localList(userId, "CATEGORY") : [];
        this.categories = mergePending(
          result.items,
          locals as unknown as CategorySummary[],
        );
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          this.categories = userId
            ? ((await localList(
                userId,
                "CATEGORY",
              )) as unknown as CategorySummary[])
            : [];
        } else {
          this.errorKind = apiErrorKind(error);
          this.errorMessage = errorMessage(error);
        }
      }
    },
    async loadAccounts(includeArchived = false) {
      this.lastAccountsIncludeArchived = includeArchived;
      try {
        const result = await api.listFinancialAccounts({ includeArchived });
        const userId = useAuthStore().userId;
        const locals = userId
          ? await localList(userId, "FINANCIAL_ACCOUNT")
          : [];
        this.accounts = mergePending(
          result.items,
          locals as unknown as FinancialAccountSummary[],
        );
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          this.accounts = userId
            ? ((await localList(
                userId,
                "FINANCIAL_ACCOUNT",
              )) as unknown as FinancialAccountSummary[])
            : [];
        } else {
          this.errorKind = apiErrorKind(error);
          this.errorMessage = errorMessage(error);
        }
      }
    },
    async refreshForSync(entityTypes: SyncEntityType[] = []) {
      this.clearError();
      const changed = new Set(entityTypes);
      const refreshAll = changed.size === 0;
      const refreshSummary =
        refreshAll ||
        changed.has("TRANSACTION") ||
        changed.has("CATEGORY") ||
        changed.has("BUDGET");
      const requests: Promise<unknown>[] = [];
      if (refreshAll || changed.has("TRANSACTION")) {
        requests.push(this.loadTransactions(this.lastTransactionParams));
      }
      if (refreshAll || changed.has("CATEGORY")) {
        requests.push(this.loadCategories(this.lastCategoriesIncludeArchived));
      }
      if (refreshAll || changed.has("FINANCIAL_ACCOUNT")) {
        requests.push(this.loadAccounts(this.lastAccountsIncludeArchived));
      }
      if (refreshAll || changed.has("BUDGET")) {
        requests.push(this.loadBudgets(this.lastBudgetMonth));
      }
      if (refreshSummary) {
        requests.push(
          this.loadSummary(this.lastSummaryMonth ?? currentMonth()),
        );
      }
      await Promise.all(requests);
    },
    async localTransactions() {
      const userId = useAuthStore().userId;
      if (!userId) {
        return [];
      }
      const locals = await localList(userId, "TRANSACTION");
      return locals as unknown as TransactionSummary[];
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
      tripId?: string | null;
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
        tripId?: string | null;
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
      await this.loadTransactions({
        ...this.lastTransactionParams,
        includeDeleted: true,
      });
      await this.loadSummary(this.summary?.month ?? currentMonth());
    },
    async restoreTransaction(id: string) {
      await api.restoreTransaction(id);
      await this.loadTransactions({
        ...this.lastTransactionParams,
        includeDeleted: true,
      });
      await this.loadSummary(this.summary?.month ?? currentMonth());
    },
    async exportCsv(
      params: {
        endDate?: string;
        startDate?: string;
        type?: "EXPENSE" | "INCOME" | "REFUND";
      } = {},
    ) {
      const result = await api.exportFinanceCsv(params);
      const rangeName =
        params.startDate && params.endDate
          ? `${params.startDate}-${params.endDate}`
          : undefined;
      const filename = rangeName
        ? `daily-assistant-transactions-${rangeName}.csv`
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
      this.errorKind = null;
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
