<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import { usePlannerStore } from "../stores/planner";
import {
  formatDateTime,
  isSameShanghaiDay,
  todayInShanghai,
} from "../utils/time";

const auth = useAuthStore();
const finance = useFinanceStore();
const planner = usePlannerStore();
const month = ref(currentMonth());
const todayDate = todayInShanghai();

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

const todayEvents = computed(() => planner.calendarEvents);
const todayTasks = computed(() =>
  planner.openTasks.filter(
    (task) =>
      task.overdue ||
      (task.dueAt !== null && isSameShanghaiDay(task.dueAt, todayDate)),
  ),
);
const todayReminders = computed(() =>
  planner.scheduledReminders.filter((reminder) =>
    isSameShanghaiDay(reminder.scheduledAt, todayDate),
  ),
);

onMounted(async () => {
  if (auth.isAuthenticated) {
    await finance.loadFinanceData(month.value);
    await Promise.all([
      planner.loadCalendarEvents({ date: todayDate }),
      planner.loadTasks({ status: "OPEN" }),
      planner.loadReminders({ status: "SCHEDULED" }),
    ]);
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
    <p class="lede">身份认证、记账、日程、待办与提醒已经可以开始使用。</p>
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

    <section class="recent-section" aria-labelledby="today-schedule-title">
      <h2 id="today-schedule-title">今日安排</h2>
      <div class="today-schedule-grid">
        <RouterLink class="schedule-card" to="/calendar">
          <strong>{{ todayEvents.length }}</strong>
          <span>日程</span>
        </RouterLink>
        <RouterLink class="schedule-card" to="/tasks">
          <strong>{{ todayTasks.length }}</strong>
          <span>待办</span>
        </RouterLink>
        <RouterLink class="schedule-card" to="/reminders">
          <strong>{{ todayReminders.length }}</strong>
          <span>提醒</span>
        </RouterLink>
      </div>
      <p
        v-if="
          todayEvents.length === 0 &&
          todayTasks.length === 0 &&
          todayReminders.length === 0
        "
        class="empty-copy"
      >
        今天暂无日程、待办或提醒。
      </p>
      <ul v-else class="today-schedule-list">
        <li v-for="event in todayEvents.slice(0, 3)" :key="event.id">
          <RouterLink to="/calendar" class="transaction-row">
            <span class="transaction-main">
              <strong>{{ event.title }}</strong>
              <small>{{
                event.allDay ? "全天" : formatDateTime(event.startsAt)
              }}</small>
            </span>
            <span class="schedule-tag">日程</span>
          </RouterLink>
        </li>
        <li v-for="task in todayTasks.slice(0, 3)" :key="task.id">
          <RouterLink to="/tasks" class="transaction-row">
            <span class="transaction-main">
              <strong :class="{ 'overdue-mark': task.overdue }">{{
                task.title
              }}</strong>
              <small v-if="task.dueAt">
                {{ task.overdue ? "已过期" : formatDateTime(task.dueAt) }}
              </small>
              <small v-else>无截止时间</small>
            </span>
            <span class="schedule-tag">待办</span>
          </RouterLink>
        </li>
        <li v-for="reminder in todayReminders.slice(0, 3)" :key="reminder.id">
          <RouterLink to="/reminders" class="transaction-row">
            <span class="transaction-main">
              <strong>{{ reminder.title }}</strong>
              <small>{{ formatDateTime(reminder.scheduledAt) }}</small>
            </span>
            <span class="schedule-tag">提醒</span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <div class="quick-actions">
      <RouterLink class="primary-button" to="/capture">快捷记录</RouterLink>
      <RouterLink class="secondary-button" to="/drafts">草稿中心</RouterLink>
      <RouterLink class="secondary-button" to="/shortcuts">快捷指令</RouterLink>
      <RouterLink class="secondary-button" to="/calendar">日程</RouterLink>
      <RouterLink class="secondary-button" to="/tasks">待办</RouterLink>
      <RouterLink class="secondary-button" to="/reminders">提醒</RouterLink>
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
