<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";

const auth = useAuthStore();
const finance = useFinanceStore();
const month = ref(currentMonth());

const today = computed(() =>
  new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    weekday: "long",
  }).format(new Date()),
);

const overallBudget = computed(() =>
  finance.summary?.budgets.find((budget) => budget.categoryId === null),
);

const recentTransactions = computed(() => finance.transactions.slice(0, 5));

onMounted(async () => {
  if (auth.isAuthenticated) {
    await finance.loadFinanceData(month.value);
  }
});
</script>

<template>
  <section
    v-if="!auth.isAuthenticated"
    class="hero"
    aria-labelledby="page-title"
  >
    <p class="eyebrow">Daily Assistant</p>
    <h1 id="page-title">把每天的事情，放在一个清晰的地方。</h1>
    <p class="lede">
      身份认证、邀请注册和账号管理已经可用；记账、预算与今日财务已经可以开始使用。
    </p>
    <p class="home-links">
      <RouterLink class="home-link" to="/register">注册</RouterLink>
      <RouterLink class="home-link" to="/login">登录</RouterLink>
      <RouterLink class="home-link" to="/account">我的账号</RouterLink>
    </p>
  </section>

  <section v-else class="today-page" aria-labelledby="today-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ today }}</p>
        <h1 id="today-title">今日财务</h1>
      </div>
      <label class="month-field">
        月份
        <input v-model="month" type="month" />
      </label>
    </header>

    <p v-if="finance.errorMessage" class="form-error" role="alert">
      {{ finance.errorMessage }}
    </p>

    <div v-if="finance.summary" class="today-card">
      <div class="today-stat">
        <span class="stat-label">今日支出</span>
        <strong class="stat-value">{{
          money(finance.summary.todaySpend)
        }}</strong>
      </div>
      <div class="today-stat">
        <span class="stat-label">本月支出</span>
        <strong class="stat-value">{{
          money(finance.summary.netExpense)
        }}</strong>
      </div>
      <div class="today-stat">
        <span class="stat-label">本月收入</span>
        <strong class="stat-value">{{
          money(finance.summary.totalIncome)
        }}</strong>
      </div>
      <div v-if="overallBudget" class="budget-progress">
        <div class="budget-row">
          <span>本月预算</span>
          <strong>{{ percent(overallBudget.progress) }}</strong>
        </div>
        <div class="progress-track" aria-hidden="true">
          <div
            class="progress-fill"
            :style="{ width: progressWidth(overallBudget.progress) }"
          ></div>
        </div>
        <p class="budget-copy">
          已用 {{ money(overallBudget.spent) }}，剩余
          {{ money(overallBudget.remaining) }}
        </p>
      </div>
    </div>

    <div class="quick-actions">
      <RouterLink class="primary-button" to="/capture">快捷记录</RouterLink>
      <RouterLink class="secondary-button" to="/drafts">草稿中心</RouterLink>
      <RouterLink class="secondary-button" to="/shortcuts">快捷指令</RouterLink>
      <RouterLink class="primary-button" to="/transactions/new"
        >记一笔</RouterLink
      >
      <RouterLink class="secondary-button" to="/transactions"
        >全部账单</RouterLink
      >
      <RouterLink class="secondary-button" to="/finance/budgets"
        >预算</RouterLink
      >
      <RouterLink class="secondary-button" to="/finance/categories"
        >分类</RouterLink
      >
      <RouterLink class="secondary-button" to="/finance/accounts"
        >账户</RouterLink
      >
    </div>

    <section class="recent-section" aria-labelledby="recent-title">
      <h2 id="recent-title">最近账单</h2>
      <p v-if="recentTransactions.length === 0" class="empty-copy">
        还没有账单，点击“记一笔”开始记录。
      </p>
      <ul v-else class="transaction-list">
        <li v-for="item in recentTransactions" :key="item.id">
          <RouterLink
            :to="`/transactions/${item.id}/edit`"
            class="transaction-row"
          >
            <span class="transaction-main">
              <strong>{{ item.merchant || typeLabel(item.type) }}</strong>
              <small>{{ formatTime(item.occurredAt) }}</small>
            </span>
            <span class="transaction-amount" :class="amountClass(item.type)">
              {{ signedMoney(item) }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </section>
</template>

<script lang="ts">
import type { TransactionSummary } from "../api/client";

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

function progressWidth(value: string): string {
  const percentValue = Math.min(Number(value) * 100, 100);
  return `${percentValue}%`;
}

function typeLabel(type: string): string {
  return type === "EXPENSE" ? "支出" : type === "INCOME" ? "收入" : "退款";
}

function signedMoney(item: TransactionSummary): string {
  if (item.type === "EXPENSE") {
    return `-${money(item.amount)}`;
  }
  if (item.type === "REFUND") {
    return `+${money(item.amount)}`;
  }
  return `+${money(item.amount)}`;
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
