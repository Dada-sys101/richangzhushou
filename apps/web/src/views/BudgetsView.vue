<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";

import {
  ApiClientError,
  type CategorySummary,
  type BudgetSummary,
  type FinanceSummaryResponse,
} from "../api/client";
import EmptyState from "../components/EmptyState.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import MonthField from "../components/MonthField.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import SectionCard from "../components/SectionCard.vue";
import { requestAppConfirm } from "../composables/useAppConfirm";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";

const auth = useAuthStore();
const finance = useFinanceStore();

const month = ref(currentMonth());
const categoryId = ref("");
const amount = ref("");
const actionError = ref("");
const actionRetryable = ref(false);
const loadError = ref("");
const summaryError = ref("");
const loading = ref(false);
const loadedMonth = ref<string | null>(null);
const actionPending = ref<string | null>(null);
const rowAmounts = reactive<Record<string, string>>({});
const visibleBudgets = ref<BudgetSummary[]>([]);
const visibleSummary = ref<FinanceSummaryResponse | null>(null);
const visibleCategories = ref<CategorySummary[]>([]);
const categoriesLoaded = ref(false);
let loadSequence = 0;

useUnsavedChanges(
  computed(
    () =>
      Boolean(amount.value.trim()) ||
      Object.entries(rowAmounts).some(([id, value]) => {
        const budget = visibleBudgets.value.find((item) => item.id === id);
        return Boolean(budget && value !== budget.amount);
      }),
  ),
);

const expenseCategories = computed(() =>
  visibleCategories.value.filter(
    (item) => !item.isArchived && item.kind === "EXPENSE",
  ),
);

const budgetsForMonth = computed(() =>
  visibleBudgets.value.filter((item) => item.month === month.value),
);

const currentSummary = computed(() => visibleSummary.value);

const isInitialLoading = computed(
  () => loading.value && loadedMonth.value !== month.value,
);

onMounted(() => {
  if (auth.isAuthenticated) {
    void load();
  }
});

watch(month, () => {
  void load();
});

async function load() {
  const selectedMonth = month.value;
  const sequence = ++loadSequence;
  const hasCachedMonth = loadedMonth.value === selectedMonth;
  loading.value = true;
  loadError.value = "";
  summaryError.value = "";
  finance.clearError();
  if (!hasCachedMonth) {
    visibleBudgets.value = finance.budgets.filter(
      (item) => item.month === selectedMonth,
    );
    visibleSummary.value =
      finance.summary?.month === selectedMonth ? finance.summary : null;
  }
  if (!categoriesLoaded.value) {
    visibleCategories.value = finance.categories;
  }

  let budgetError = "";
  let categoryError = "";
  let nextSummaryError = "";

  const budgetResult = await callStore(() =>
    finance.loadBudgets(selectedMonth),
  );
  if (sequence !== loadSequence || selectedMonth !== month.value) return;
  if (!budgetResult.error) {
    visibleBudgets.value = finance.budgets.filter(
      (item) => item.month === selectedMonth,
    );
  }
  if (budgetResult.error) budgetError = budgetResult.error;

  const summaryResult = await callStore(() =>
    finance.loadSummary(selectedMonth),
  );
  if (sequence !== loadSequence || selectedMonth !== month.value) return;
  if (!summaryResult.error) {
    visibleSummary.value =
      finance.summary?.month === selectedMonth ? finance.summary : null;
  }
  if (summaryResult.error) nextSummaryError = summaryResult.error;

  const categoryResult = await callStore(() => finance.loadCategories(true));
  if (sequence !== loadSequence || selectedMonth !== month.value) return;
  if (!categoryResult.error) {
    visibleCategories.value = finance.categories;
    categoriesLoaded.value = true;
  }
  if (categoryResult.error) categoryError = categoryResult.error;

  if (sequence !== loadSequence || selectedMonth !== month.value) return;

  loadedMonth.value = selectedMonth;
  loading.value = false;
  loadError.value = budgetError || categoryError;
  summaryError.value = nextSummaryError;
}

async function callStore(
  operation: () => Promise<unknown>,
): Promise<{ error: string }> {
  const previousError = finance.errorMessage;
  try {
    await operation();
  } catch (error) {
    return { error: messageOf(error) };
  }
  const storeError = finance.errorMessage;
  if (storeError && storeError !== previousError) {
    return { error: storeError };
  }
  return { error: "" };
}

async function createBudget() {
  if (actionPending.value) return;
  actionError.value = "";
  actionRetryable.value = false;
  if (!amount.value.trim()) {
    actionError.value = "请输入预算金额";
    return;
  }

  actionPending.value = "create";
  finance.clearError();
  try {
    await finance.createBudget({
      amount: amount.value.trim(),
      categoryId: categoryId.value || null,
      month: month.value,
    });
    const refreshError = finance.errorMessage;
    amount.value = "";
    categoryId.value = "";
    await refreshAfterWrite(
      refreshError ? "预算已保存，但刷新失败，请点击重试。" : "",
    );
  } catch (error) {
    actionError.value = messageOf(error);
    actionRetryable.value = false;
  } finally {
    actionPending.value = null;
  }
}

function editAmount(id: string, value: string) {
  rowAmounts[id] = value;
}

function amountFor(id: string, fallback: string): string {
  return rowAmounts[id] ?? fallback;
}

async function updateAmount(id: string, version: number, fallback: string) {
  if (actionPending.value) return;
  const next = amountFor(id, fallback).trim();
  actionError.value = "";
  actionRetryable.value = false;
  if (!next) {
    actionError.value = "请输入预算金额";
    return;
  }

  actionPending.value = `update:${id}`;
  finance.clearError();
  try {
    await finance.updateBudget(id, { amount: next, version });
    const refreshError = finance.errorMessage;
    visibleBudgets.value = visibleBudgets.value.map((item) =>
      item.id === id
        ? { ...item, amount: next, version: item.version + 1 }
        : item,
    );
    delete rowAmounts[id];
    await refreshAfterWrite(
      refreshError ? "预算已保存，但刷新失败，请点击重试。" : "",
    );
  } catch (error) {
    actionError.value = messageOf(error);
    actionRetryable.value = false;
  } finally {
    actionPending.value = null;
  }
}

async function removeBudget(id: string, label: string) {
  if (actionPending.value) return;
  const confirmed = await requestAppConfirm({
    confirmLabel: "删除预算",
    description: `确定删除“${label}”的预算吗？删除后本月列表将不再显示这项预算。`,
    destructive: true,
    title: "删除预算？",
  });
  if (!confirmed || actionPending.value) return;

  actionError.value = "";
  actionRetryable.value = false;
  actionPending.value = `delete:${id}`;
  finance.clearError();
  try {
    await finance.deleteBudget(id, month.value);
    const refreshError = finance.errorMessage;
    visibleBudgets.value = visibleBudgets.value.filter(
      (item) => item.id !== id,
    );
    delete rowAmounts[id];
    await refreshAfterWrite(
      refreshError ? "预算已删除，但刷新失败，请点击重试。" : "",
    );
  } catch (error) {
    actionError.value = messageOf(error);
    actionRetryable.value = false;
  } finally {
    actionPending.value = null;
  }
}

async function refreshAfterWrite(message: string) {
  actionError.value = message;
  actionRetryable.value = Boolean(message);
  await load();
  if (!loadError.value && !summaryError.value) {
    actionError.value = "";
    actionRetryable.value = false;
  }
}

async function retryActionRefresh() {
  await refreshAfterWrite(actionError.value);
}

function categoryName(id: string | null): string {
  if (!id) return "整体预算";
  return (
    visibleCategories.value.find((item) => item.id === id)?.name ??
    "未知支出分类"
  );
}

function progressOf(budgetId: string) {
  return currentSummary.value?.budgets.find(
    (item) => item.budgetId === budgetId,
  );
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "操作失败，请稍后重试";
}
</script>

<template>
  <SecondaryPageShell
    class="budgets-page"
    title="月度预算"
    title-id="budgets-title"
    subtitle="预算"
  >
    <template #actions>
      <label class="secondary-page-filter">
        月份
        <MonthField v-model="month" required />
      </label>
    </template>

    <LoadingState
      v-if="isInitialLoading"
      description="正在获取本月预算和支出摘要。"
      title="正在加载预算…"
    />
    <LoadingState
      v-else-if="loading"
      class="budgets-refresh-state"
      description="预算列表会在刷新完成后更新。"
      title="正在更新预算…"
    />

    <SectionCard title="当月预算概览" class="budget-overview-card">
      <p class="budget-overview-count">
        本月共有 <strong>{{ budgetsForMonth.length }}</strong> 项预算
      </p>
      <div v-if="summaryError" class="form-error budget-feedback" role="alert">
        <span>{{ summaryError }}</span>
        <button class="secondary-button" type="button" @click="load">
          重试
        </button>
      </div>
      <div v-else-if="currentSummary" class="budget-overview-summary">
        <span>本月支出</span>
        <strong>¥{{ currentSummary.totalExpense }}</strong>
      </div>
      <p v-else class="budget-muted" role="status">本月摘要暂不可用。</p>
    </SectionCard>

    <SectionCard
      title="设置新预算"
      description="可设置整体预算或单独控制某个未归档支出分类。"
    >
      <form
        class="inline-create budget-create-form"
        @submit.prevent="createBudget"
      >
        <label class="budget-create-field">
          <span>预算范围</span>
          <select v-model="categoryId" aria-label="预算范围">
            <option value="">整体预算</option>
            <option
              v-for="item in expenseCategories"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select>
        </label>
        <label class="budget-create-field">
          <span>预算金额</span>
          <input
            v-model="amount"
            aria-label="预算金额"
            inputmode="decimal"
            placeholder="如 1000.00"
            required
            step="0.01"
            type="text"
          />
        </label>
        <button
          class="primary-button budget-create-submit"
          type="submit"
          :disabled="actionPending === 'create'"
        >
          {{ actionPending === "create" ? "新增中…" : "新增预算" }}
        </button>
      </form>
    </SectionCard>

    <div v-if="actionError" class="form-error budget-feedback" role="alert">
      <span>{{ actionError }}</span>
      <button
        v-if="actionRetryable"
        class="secondary-button"
        type="button"
        @click="retryActionRefresh"
      >
        重试
      </button>
    </div>

    <ErrorState
      v-if="loadError"
      action-label="重试"
      :description="loadError"
      title="预算暂时无法加载"
      @retry="load"
    />

    <SectionCard title="本月预算列表">
      <EmptyState
        v-if="!loadError && budgetsForMonth.length === 0 && !loading"
        description="先设置一个整体预算或支出分类预算。"
        icon="wallet"
        title="本月还没有预算"
      />
      <ul
        v-else-if="budgetsForMonth.length > 0"
        class="resource-list budget-list"
      >
        <li v-for="item in budgetsForMonth" :key="item.id">
          <div class="budget-line">
            <strong class="budget-name">{{
              categoryName(item.categoryId)
            }}</strong>
            <span class="budget-amounts">
              已支出 ¥{{ progressOf(item.id)?.spent ?? "—" }} / 预算 ¥{{
                item.amount
              }}
            </span>
            <span
              v-if="progressOf(item.id)"
              class="budget-ratio"
              :class="{ over: Number(progressOf(item.id)?.progress ?? 0) > 1 }"
            >
              {{ percent(progressOf(item.id)?.progress ?? "0") }}
            </span>
          </div>
          <p v-if="progressOf(item.id)" class="budget-status">
            <span
              v-if="Number(progressOf(item.id)?.progress ?? 0) > 1"
              class="budget-status-over"
            >
              已超出预算，剩余 ¥{{ progressOf(item.id)?.remaining ?? "—" }}
            </span>
            <span v-else>
              剩余 ¥{{ progressOf(item.id)?.remaining ?? "—" }}
            </span>
          </p>
          <div
            v-if="progressOf(item.id)"
            class="progress-track"
            role="progressbar"
            :aria-label="`${categoryName(item.categoryId)}使用比例`"
            :aria-valuemax="100"
            :aria-valuemin="0"
            :aria-valuenow="progressPercent(progressOf(item.id)?.progress)"
          >
            <div
              class="progress-fill"
              :style="{ width: widthOf(progressOf(item.id)?.progress ?? '0') }"
            ></div>
          </div>
          <div class="budget-actions">
            <label class="inline-amount">
              调整金额
              <input
                :aria-label="`调整${categoryName(item.categoryId)}金额`"
                :value="amountFor(item.id, item.amount)"
                inputmode="decimal"
                step="0.01"
                type="text"
                @input="
                  editAmount(item.id, ($event.target as HTMLInputElement).value)
                "
                @change="updateAmount(item.id, item.version, item.amount)"
              />
            </label>
            <button
              class="text-button danger"
              type="button"
              :aria-label="`删除${categoryName(item.categoryId)}`"
              :disabled="Boolean(actionPending)"
              @click="removeBudget(item.id, categoryName(item.categoryId))"
            >
              {{ actionPending === `delete:${item.id}` ? "删除中…" : "删除" }}
            </button>
          </div>
        </li>
      </ul>
    </SectionCard>
  </SecondaryPageShell>
</template>

<script lang="ts">
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

function percent(value: string): string {
  return `${(Number(value) * 100).toFixed(0)}%`;
}

function progressPercent(value: string | undefined): number {
  return Math.min(Math.max(Number(value ?? "0") * 100, 0), 100);
}

function widthOf(value: string): string {
  return `${Math.min(Math.max(Number(value) * 100, 0), 100)}%`;
}
</script>
