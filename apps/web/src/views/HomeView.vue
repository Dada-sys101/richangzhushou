<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import AppIcon from "../components/AppIcon.vue";
import EmptyState from "../components/EmptyState.vue";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import { usePlannerStore } from "../stores/planner";
import { useTripsStore } from "../stores/trips";
import {
  formatDateTime,
  isSameShanghaiDay,
  todayInShanghai,
} from "../utils/time";

type HomeStatus =
  "loading" | "ready" | "auth-required" | "auth-expired" | "request-failed";

const auth = useAuthStore();
const finance = useFinanceStore();
const planner = usePlannerStore();
const trips = useTripsStore();
const month = ref(currentMonth());
const todayDate = todayInShanghai();
const status = ref<HomeStatus>("loading");

const today = computed(() =>
  new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    weekday: "long",
  }).format(new Date()),
);

const overallBudget = computed(
  () =>
    finance.summary?.budgets.find((budget) => budget.categoryId === null) ??
    null,
);

const recentTransactions = computed(() =>
  finance.transactions.filter((item) => !item.deletedAt).slice(0, 5),
);
const recentTrips = computed(() =>
  trips.trips.filter((item) => !item.deletedAt).slice(0, 3),
);

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
const todayTotal = computed(
  () =>
    todayEvents.value.length +
    todayTasks.value.length +
    todayReminders.value.length,
);

onMounted(() => {
  if (auth.isAuthenticated) {
    void loadHome();
  } else {
    status.value = "auth-required";
  }
});

async function loadHome() {
  status.value = "loading";
  finance.clearError();
  planner.clearError();
  trips.clearError();
  await finance.loadFinanceData(month.value);
  await Promise.all([
    planner.loadCalendarEvents({ date: todayDate }),
    planner.loadTasks({ status: "OPEN" }),
    planner.loadReminders({ status: "SCHEDULED" }),
    trips.loadTrips(),
  ]);
  const kind = finance.errorKind ?? planner.errorKind ?? trips.errorKind;
  status.value =
    kind === "AUTH_EXPIRED"
      ? "auth-expired"
      : kind === "REQUEST_FAILED"
        ? "request-failed"
        : "ready";
}

async function changeMonth() {
  finance.clearError();
  await finance.loadFinanceData(month.value);
  status.value =
    finance.errorKind === "AUTH_EXPIRED"
      ? "auth-expired"
      : finance.errorKind === "REQUEST_FAILED"
        ? "request-failed"
        : "ready";
}
</script>

<template>
  <section class="home-page" aria-labelledby="home-title">
    <template v-if="status === 'auth-required'">
      <div class="auth-state-card">
        <span class="auth-state-icon">
          <AppIcon name="user" :size="28" />
        </span>
        <p class="eyebrow">Daily Assistant</p>
        <h1 id="home-title">今日概览</h1>
        <p class="auth-state-message">请登录后查看今日数据</p>
        <p class="auth-state-copy">
          登录后即可查看今日安排、本月财务与最近记录。
        </p>
        <RouterLink
          class="primary-button"
          :to="{ name: 'login', query: { redirect: '/' } }"
        >
          登录
        </RouterLink>
      </div>
    </template>

    <template v-else-if="status === 'auth-expired'">
      <div class="auth-state-card">
        <span class="auth-state-icon">
          <AppIcon name="lock" :size="28" />
        </span>
        <p class="eyebrow">Daily Assistant</p>
        <h1 id="home-title">今日概览</h1>
        <p class="auth-state-message">登录状态已过期，请重新登录</p>
        <p class="auth-state-copy">
          登录已失效，重新登录后可继续查看今日数据。
        </p>
        <RouterLink
          class="primary-button"
          :to="{ name: 'login', query: { redirect: '/' } }"
        >
          重新登录
        </RouterLink>
      </div>
    </template>

    <template v-else-if="status === 'request-failed'">
      <div class="auth-state-card">
        <span class="auth-state-icon">
          <AppIcon name="alert" :size="28" />
        </span>
        <p class="eyebrow">Daily Assistant</p>
        <h1 id="home-title">今日概览</h1>
        <p class="auth-state-message">数据加载失败，请稍后重试</p>
        <p class="auth-state-copy">暂时无法获取今日数据，请检查网络后重试。</p>
        <button class="primary-button" type="button" @click="loadHome">
          重试
        </button>
      </div>
    </template>

    <template v-else-if="status === 'loading'">
      <div class="auth-state-card loading-card" aria-busy="true">
        <span class="spinner" aria-hidden="true"></span>
        <p class="auth-state-message">正在加载今日数据…</p>
      </div>
    </template>

    <template v-else>
      <header class="page-head home-head">
        <div>
          <p class="eyebrow">{{ today }}</p>
          <h1 id="home-title">今日概览</h1>
        </div>
      </header>

      <section class="quick-section" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" class="visually-hidden">快捷操作</h2>
        <div class="quick-actions-grid">
          <RouterLink class="quick-action" to="/transactions/new">
            <span class="quick-action-icon">
              <AppIcon name="receipt" :size="22" />
            </span>
            <strong>记一笔</strong>
            <small>快速记录收支</small>
          </RouterLink>
          <RouterLink class="quick-action" to="/tasks">
            <span class="quick-action-icon">
              <AppIcon name="tasks" :size="22" />
            </span>
            <strong>新建待办</strong>
            <small>添加今日事项</small>
          </RouterLink>
          <RouterLink class="quick-action" to="/calendar">
            <span class="quick-action-icon">
              <AppIcon name="calendar" :size="22" />
            </span>
            <strong>新建日程</strong>
            <small>安排时间计划</small>
          </RouterLink>
          <RouterLink class="quick-action" to="/reminders">
            <span class="quick-action-icon">
              <AppIcon name="bell" :size="22" />
            </span>
            <strong>添加提醒</strong>
            <small>不错过重要事项</small>
          </RouterLink>
        </div>
      </section>

      <section class="card-section" aria-labelledby="monthly-finance-title">
        <div class="section-head">
          <div>
            <h2 id="monthly-finance-title">本月财务</h2>
            <p class="section-copy">本月收入、支出与预算使用情况。</p>
          </div>
          <label class="month-field">
            月份
            <input v-model="month" type="month" @change="changeMonth" />
          </label>
        </div>
        <div v-if="finance.summary" class="finance-summary-card">
          <div class="finance-stat">
            <span class="stat-label">收入</span>
            <strong class="stat-value amount-income">{{
              money(finance.summary.totalIncome)
            }}</strong>
          </div>
          <div class="finance-stat">
            <span class="stat-label">支出</span>
            <strong class="stat-value amount-expense">{{
              money(finance.summary.totalExpense)
            }}</strong>
          </div>
          <div class="finance-stat">
            <span class="stat-label">预算剩余</span>
            <strong v-if="overallBudget" class="stat-value">{{
              money(overallBudget.remaining)
            }}</strong>
            <span v-else class="stat-sub">
              <span class="stat-muted">未设置</span>
              <RouterLink class="text-link" to="/finance/budgets"
                >去设置</RouterLink
              >
            </span>
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
        <p v-else class="empty-copy">暂无本月财务数据。</p>
      </section>

      <section class="card-section" aria-labelledby="today-schedule-title">
        <div class="section-head">
          <div>
            <h2 id="today-schedule-title">今日安排</h2>
            <p class="section-copy">
              今天共有 {{ todayTotal }} 项安排，点击卡片查看详情。
            </p>
          </div>
        </div>
        <div class="today-schedule-grid">
          <RouterLink class="schedule-card" to="/calendar">
            <span class="schedule-card-icon">
              <AppIcon name="calendar" :size="20" />
            </span>
            <strong>{{ todayEvents.length }}</strong>
            <span class="schedule-label">日程</span>
            <small class="schedule-copy">查看今日日程安排</small>
            <span class="schedule-more">
              查看全部
              <AppIcon name="chevron-right" :size="14" />
            </span>
          </RouterLink>
          <RouterLink class="schedule-card" to="/tasks">
            <span class="schedule-card-icon">
              <AppIcon name="tasks" :size="20" />
            </span>
            <strong>{{ todayTasks.length }}</strong>
            <span class="schedule-label">待办</span>
            <small class="schedule-copy">处理今日待办事项</small>
            <span class="schedule-more">
              查看全部
              <AppIcon name="chevron-right" :size="14" />
            </span>
          </RouterLink>
          <RouterLink class="schedule-card" to="/reminders">
            <span class="schedule-card-icon">
              <AppIcon name="bell" :size="20" />
            </span>
            <strong>{{ todayReminders.length }}</strong>
            <span class="schedule-label">提醒</span>
            <small class="schedule-copy">查看今日提醒</small>
            <span class="schedule-more">
              查看全部
              <AppIcon name="chevron-right" :size="14" />
            </span>
          </RouterLink>
        </div>
        <p v-if="todayTotal === 0" class="empty-copy">
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

      <section class="card-section" aria-labelledby="recent-title">
        <div class="section-head">
          <div>
            <h2 id="recent-title">最近账单</h2>
            <p class="section-copy">最近记录的一笔笔收支。</p>
          </div>
          <RouterLink class="text-link" to="/transactions">查看全部</RouterLink>
        </div>
        <EmptyState
          v-if="recentTransactions.length === 0"
          icon="receipt"
          title="还没有账单"
          description="点击“记一笔”开始记录第一笔收支。"
          :action="{ label: '记一笔', to: '/transactions/new' }"
        />
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

      <section class="card-section" aria-labelledby="recent-trips-title">
        <div class="section-head">
          <div>
            <h2 id="recent-trips-title">最近行程</h2>
            <p class="section-copy">把出行安排和预算放在一起管理。</p>
          </div>
          <RouterLink class="text-link" to="/trips">查看全部</RouterLink>
        </div>
        <EmptyState
          v-if="recentTrips.length === 0"
          icon="trip"
          title="还没有行程"
          description="规划一次出行，把行程安排和预算放在一起管理。"
          :action="{ label: '去规划行程', to: '/trips' }"
        />
        <ul v-else class="today-schedule-list">
          <li v-for="item in recentTrips" :key="item.id">
            <RouterLink :to="`/trips/${item.id}`" class="transaction-row">
              <span class="transaction-main">
                <strong>{{ item.title }}</strong>
                <small
                  >{{ item.destination }} ・ {{ item.startDate }} ―
                  {{ item.endDate }}</small
                >
              </span>
              <span class="schedule-tag">行程</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
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
