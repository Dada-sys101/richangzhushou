<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

import { ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";

const auth = useAuthStore();
const finance = useFinanceStore();
const month = ref(currentMonth());
const categoryId = ref("");
const amount = ref("");
const errorMessage = ref("");

const expenseCategories = () =>
  finance.categories.filter(
    (item) => !item.isArchived && item.kind === "EXPENSE",
  );

function categoryName(categoryId: string | null): string {
  if (!categoryId) {
    return "整体预算";
  }
  return (
    finance.categories.find((item) => item.id === categoryId)?.name ?? "分类"
  );
}

const budgetsForMonth = () =>
  finance.budgets.filter((item) => item.month === month.value);

onMounted(() => {
  if (auth.isAuthenticated) {
    void load();
  }
});

watch(month, () => {
  void load();
});

async function load() {
  errorMessage.value = "";
  await Promise.all([
    finance.loadBudgets(month.value),
    finance.loadSummary(month.value),
    finance.loadCategories(true),
  ]);
}

async function createBudget() {
  errorMessage.value = "";
  if (!amount.value) {
    errorMessage.value = "请输入预算金额";
    return;
  }
  try {
    await finance.createBudget({
      amount: amount.value,
      categoryId: categoryId.value || null,
      month: month.value,
    });
    amount.value = "";
    categoryId.value = "";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function updateAmount(id: string, version: number, next: string) {
  errorMessage.value = "";
  if (!next.trim()) {
    return;
  }
  try {
    await finance.updateBudget(id, { amount: next, version });
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function removeBudget(id: string) {
  errorMessage.value = "";
  try {
    await finance.deleteBudget(id, month.value);
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function progressOf(budgetId: string) {
  return finance.summary?.budgets.find((item) => item.budgetId === budgetId);
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "操作失败，请稍后重试";
}
</script>

<template>
  <section class="finance-page" aria-labelledby="budgets-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">预算</p>
        <h1 id="budgets-title">月度预算</h1>
      </div>
      <label>
        月份
        <input v-model="month" type="month" />
      </label>
    </header>

    <form class="inline-create" @submit.prevent="createBudget">
      <select v-model="categoryId">
        <option value="">整体预算</option>
        <option
          v-for="item in expenseCategories()"
          :key="item.id"
          :value="item.id"
        >
          {{ item.name }}
        </option>
      </select>
      <input
        v-model="amount"
        inputmode="decimal"
        placeholder="预算金额，如 1000.00"
        required
        step="0.01"
        type="text"
      />
      <button class="primary-button" type="submit">新增预算</button>
    </form>

    <p v-if="finance.errorMessage" class="form-error" role="alert">
      {{ finance.errorMessage }}
    </p>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>

    <p v-if="budgetsForMonth().length === 0" class="empty-copy">
      本月还没有预算，先设置一个整体预算吧。
    </p>
    <ul v-else class="resource-list budget-list">
      <li v-for="item in budgetsForMonth()" :key="item.id">
        <div class="budget-line">
          <strong>
            {{ categoryName(item.categoryId) }}
          </strong>
          <span>
            {{ money(progressOf(item.id)?.spent ?? "0.00") }} /
            {{ money(item.amount) }}
          </span>
          <span
            class="budget-ratio"
            :class="{ over: Number(progressOf(item.id)?.progress ?? 0) > 1 }"
          >
            {{ percent(progressOf(item.id)?.progress ?? "0.00") }}
          </span>
        </div>
        <div class="progress-track" aria-hidden="true">
          <div
            class="progress-fill"
            :style="{ width: widthOf(progressOf(item.id)?.progress ?? '0.00') }"
          ></div>
        </div>
        <div class="budget-actions">
          <label class="inline-amount">
            金额
            <input
              :value="item.amount"
              inputmode="decimal"
              step="0.01"
              type="text"
              @change="
                updateAmount(
                  item.id,
                  item.version,
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </label>
          <button
            class="text-button danger"
            type="button"
            @click="removeBudget(item.id)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
  </section>
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

function money(value: string): string {
  return `¥${value}`;
}

function percent(value: string): string {
  return `${(Number(value) * 100).toFixed(0)}%`;
}

function widthOf(value: string): string {
  return `${Math.min(Number(value) * 100, 100)}%`;
}
</script>
