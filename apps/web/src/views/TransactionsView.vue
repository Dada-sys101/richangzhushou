<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import { ApiClientError } from "../api/client";
import PageHeader from "../components/PageHeader.vue";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import { appendReturnTo, useOptionalRoute } from "../utils/navigation";

const auth = useAuthStore();
const finance = useFinanceStore();
const route = useOptionalRoute();
const { startDate: initialStartDate, endDate: initialEndDate } =
  currentMonthRange();
const startDate = ref(initialStartDate);
const endDate = ref(initialEndDate);
const type = ref<"" | "EXPENSE" | "INCOME" | "REFUND">("");
const includeDeleted = ref(false);
const actionError = ref("");

const visibleTransactions = () => {
  if (includeDeleted.value) {
    return finance.transactions;
  }
  return finance.transactions.filter((item) => !item.deletedAt);
};

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
  }
});

watch([startDate, endDate, type, includeDeleted], () => {
  void reload();
});

async function reload() {
  actionError.value = "";
  await finance.loadTransactions({
    includeDeleted: includeDeleted.value || undefined,
    startDate: startDate.value || undefined,
    endDate: endDate.value || undefined,
    type: type.value || undefined,
  });
}

async function remove(id: string) {
  actionError.value = "";
  try {
    await finance.deleteTransaction(id);
  } catch (error) {
    actionError.value = messageOf(error);
  }
}

async function restore(id: string) {
  actionError.value = "";
  try {
    await finance.restoreTransaction(id);
  } catch (error) {
    actionError.value = messageOf(error);
  }
}

async function downloadCsv() {
  actionError.value = "";
  try {
    await finance.exportCsv({
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      type: type.value || undefined,
    });
  } catch (error) {
    actionError.value = messageOf(error);
  }
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "操作失败，请稍后重试";
}

function withTransactionsSource(path: string) {
  return appendReturnTo(path, route?.fullPath ?? "/transactions");
}
</script>

<template>
  <section class="finance-page" aria-labelledby="transactions-title">
    <PageHeader title="账单" title-id="transactions-title" subtitle="记账">
      <template #actions>
        <div class="filters">
          <label>
            开始日期
            <input
              v-model="startDate"
              :max="endDate || undefined"
              type="date"
            />
          </label>
          <label>
            结束日期
            <input
              v-model="endDate"
              :min="startDate || undefined"
              type="date"
            />
          </label>
          <label>
            类型
            <select v-model="type">
              <option value="">全部</option>
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
              <option value="REFUND">退款</option>
            </select>
          </label>
          <label class="check-label">
            <input v-model="includeDeleted" type="checkbox" />
            显示已删除
          </label>
        </div>
      </template>
    </PageHeader>

    <div class="toolbar">
      <RouterLink
        class="primary-button"
        :to="withTransactionsSource('/transactions/new')"
        >记一笔</RouterLink
      >
      <button class="secondary-button" type="button" @click="downloadCsv">
        导出 CSV
      </button>
    </div>

    <p v-if="finance.errorMessage" class="form-error" role="alert">
      {{ finance.errorMessage }}
    </p>
    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>

    <p v-if="visibleTransactions().length === 0" class="empty-copy">
      当前筛选下没有账单。
    </p>
    <ul v-else class="transaction-list">
      <li
        v-for="item in visibleTransactions()"
        :key="item.id"
        :class="{ 'is-deleted': item.deletedAt }"
      >
        <div class="transaction-row">
          <div class="transaction-main">
            <strong>{{ item.merchant || typeLabel(item.type) }}</strong>
            <small>{{ formatTime(item.occurredAt) }}</small>
            <small v-if="item.note" class="note">{{ item.note }}</small>
          </div>
          <div class="transaction-amount" :class="amountClass(item.type)">
            {{ signedMoney(item) }}
          </div>
          <div class="row-actions">
            <RouterLink
              v-if="!item.deletedAt"
              class="text-button"
              :to="withTransactionsSource(`/transactions/${item.id}/edit`)"
            >
              编辑
            </RouterLink>
            <button
              v-if="!item.deletedAt"
              class="text-button danger"
              type="button"
              @click="remove(item.id)"
            >
              删除
            </button>
            <button
              v-else
              class="text-button"
              type="button"
              @click="restore(item.id)"
            >
              恢复
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script lang="ts">
import type { TransactionSummary } from "../api/client";

function currentMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(now);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const year = byType.year ?? "2026";
  const month = byType.month ?? "01";
  const day = byType.day ?? "01";
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${day}`,
  };
}

function typeLabel(type: string): string {
  return type === "EXPENSE" ? "支出" : type === "INCOME" ? "收入" : "退款";
}

function money(value: string): string {
  return `¥${value}`;
}

function signedMoney(item: TransactionSummary): string {
  const prefix = item.type === "EXPENSE" ? "-" : "+";
  return `${prefix}${money(item.amount)}`;
}

function amountClass(type: string): string {
  return type === "EXPENSE" ? "amount-expense" : "amount-income";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
</script>
