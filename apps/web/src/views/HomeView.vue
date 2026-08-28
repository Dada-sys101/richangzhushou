<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import AppIcon from "../components/AppIcon.vue";
import AssistantMark from "../components/AssistantMark.vue";
import EmptyState from "../components/EmptyState.vue";
import { useAuthStore } from "../stores/auth";
import { useDraftsStore } from "../stores/drafts";
import { useFinanceStore } from "../stores/finance";
import { usePlannerStore } from "../stores/planner";
import { useTripsStore } from "../stores/trips";
import {
  formatDateTime,
  formatShanghaiDate,
  todayInShanghai,
} from "../utils/time";
import { buildTimeline, isInTimelineRange } from "../utils/timeline";

type HomeStatus =
  "loading" | "ready" | "auth-required" | "auth-expired" | "request-failed";

const auth = useAuthStore();
const drafts = useDraftsStore();
const finance = useFinanceStore();
const planner = usePlannerStore();
const trips = useTripsStore();
const status = ref<HomeStatus>("loading");
const todayDate = todayInShanghai();

const today = computed(() =>
  new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    weekday: "long",
  }).format(new Date()),
);

const timeline = computed(() =>
  buildTimeline(
    planner.calendarEvents,
    planner.openTasks,
    planner.scheduledReminders,
  ).filter((item) => isInTimelineRange(item, "TODAY")),
);

const focus = computed(() => {
  const now = Date.now();
  const next = buildTimeline(
    planner.calendarEvents,
    planner.openTasks,
    planner.scheduledReminders,
  ).find(
    (item) =>
      item.scheduledAt !== null && new Date(item.scheduledAt).getTime() >= now,
  );
  if (next) return { ...next, label: "下一项" };
  const overdue = planner.openTasks.find((item) => item.overdue);
  if (overdue)
    return {
      id: overdue.id,
      label: "已逾期",
      path: "/tasks",
      scheduledAt: overdue.dueAt,
      title: overdue.title,
    };
  const highPriority = planner.openTasks.find(
    (item) => item.priority === "HIGH" && item.dueAt?.startsWith(todayDate),
  );
  if (highPriority)
    return {
      id: highPriority.id,
      label: "优先处理",
      path: "/tasks",
      scheduledAt: highPriority.dueAt,
      title: highPriority.title,
    };
  const pending = drafts.pendingDrafts[0];
  return pending
    ? {
        id: pending.id,
        label: "待确认",
        path: "/drafts",
        scheduledAt: pending.createdAt,
        title: "有一条记录草稿等待核对",
      }
    : null;
});

const attention = computed(() => {
  const items: { id: string; path: string; title: string; type: string }[] = [];
  for (const task of planner.openTasks.filter((item) => item.overdue)) {
    items.push({
      id: `overdue-${task.id}`,
      path: "/tasks",
      title: task.title,
      type: "逾期待办",
    });
  }
  for (const item of buildTimeline([], [], planner.scheduledReminders).filter(
    (reminder) =>
      reminder.scheduledAt !== null &&
      new Date(reminder.scheduledAt).getTime() >= Date.now() &&
      new Date(reminder.scheduledAt).getTime() - Date.now() <=
        24 * 60 * 60 * 1000,
  )) {
    items.push({
      id: `reminder-${item.id}`,
      path: item.path,
      title: item.title,
      type: "即将提醒",
    });
  }
  for (const draft of drafts.pendingDrafts) {
    items.push({
      id: `draft-${draft.id}`,
      path: "/drafts",
      title: "待确认记录草稿",
      type: "待确认",
    });
  }
  for (const budget of finance.summary?.budgets ?? []) {
    if (Number(budget.progress) >= 1) {
      items.push({
        id: `budget-${budget.budgetId}`,
        path: "/finance/budgets",
        title: `${budget.categoryName ?? "本月"}预算已超出`,
        type: "预算",
      });
    }
  }
  return items.slice(0, 3);
});

const activeTrip = computed(
  () =>
    trips.trips.find(
      (trip) =>
        !trip.deletedAt &&
        trip.startDate <= todayDate &&
        trip.endDate >= todayDate,
    ) ??
    trips.trips.find(
      (trip) =>
        !trip.deletedAt &&
        trip.startDate > todayDate &&
        trip.startDate <= addDays(todayDate, 7),
    ) ??
    null,
);

const greeting = computed(() => {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Shanghai",
    }).format(new Date()),
  );
  const prefix = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  return prefix;
});

onMounted(() => {
  if (auth.isAuthenticated) void loadHome();
  else status.value = "auth-required";
});

async function loadHome() {
  status.value = "loading";
  finance.clearError();
  planner.clearError();
  trips.clearError();
  await Promise.all([
    finance.loadFinanceData(todayDate.slice(0, 7)),
    planner.loadCalendarEvents({ date: todayDate }),
    planner.loadTasks({ status: "OPEN" }),
    planner.loadReminders({ status: "SCHEDULED" }),
    trips.loadTrips(),
    drafts.loadDrafts("PENDING"),
  ]);
  const kind = finance.errorKind ?? planner.errorKind ?? trips.errorKind;
  status.value =
    kind === "AUTH_EXPIRED"
      ? "auth-expired"
      : kind === "REQUEST_FAILED"
        ? "request-failed"
        : "ready";
}

function itemKind(kind: string) {
  return kind === "EVENT" ? "日程" : kind === "TASK" ? "待办" : "提醒";
}
function itemTime(value: string | null) {
  if (!value) return "无截止时间";
  const date = new Date(value);
  return formatShanghaiDate(date) === todayDate
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "Asia/Shanghai",
      }).format(date)
    : formatDateTime(value);
}
function addDays(date: string, days: number): string {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}
</script>

<template>
  <section class="v2-page home-page" aria-labelledby="home-title">
    <template v-if="status === 'auth-required' || status === 'auth-expired'">
      <div class="auth-state-card">
        <span class="auth-state-icon"
          ><AppIcon
            :name="status === 'auth-required' ? 'user' : 'lock'"
            :size="28"
        /></span>
        <p class="eyebrow">日常助手</p>
        <h1 id="home-title">把今天过得更轻松</h1>
        <p class="auth-state-message">
          {{
            status === "auth-required"
              ? "请登录后查看今日安排"
              : "登录状态已过期，请重新登录"
          }}
        </p>
        <RouterLink
          class="primary-button"
          :to="{ name: 'login', query: { redirect: '/' } }"
          >{{ status === "auth-required" ? "登录" : "重新登录" }}</RouterLink
        >
      </div>
    </template>
    <template v-else-if="status === 'request-failed'">
      <EmptyState
        icon="alert"
        title="暂时无法加载今天"
        description="检查网络后重试，离线记录仍会保留在本机。"
        :action="{ label: '重试', onClick: loadHome }"
      />
    </template>
    <template v-else-if="status === 'loading'">
      <div class="auth-state-card loading-card" aria-busy="true">
        <span class="spinner" aria-hidden="true"></span>
        <p class="auth-state-message">正在整理今天的安排…</p>
      </div>
    </template>
    <template v-else>
      <header class="v2-greeting">
        <div>
          <h1 id="home-title">{{ greeting }}，{{ auth.user?.displayName }}</h1>
          <p class="home-date">{{ today }}</p>
        </div>
        <AssistantMark size="md" />
      </header>
      <div class="home-layout">
        <div class="home-priority-column">
          <RouterLink v-if="focus" class="focus-card" :to="focus.path"
            ><span class="focus-kicker">{{ focus.label }}</span
            ><strong>{{ focus.title }}</strong
            ><small>{{ itemTime(focus.scheduledAt) }}</small
            ><span class="focus-action">开始准备</span></RouterLink
          >
          <EmptyState
            v-else
            icon="check"
            title="今天暂时没有待处理事项"
            description="可以记录一个想法，或提前安排接下来的时间。"
            :action="{ label: '统一录入', to: '/capture' }"
          />
          <section
            v-if="attention.length"
            class="v2-section"
            aria-labelledby="attention-title"
          >
            <div class="section-head">
              <div>
                <p class="section-label">需要关注</p>
                <h2 id="attention-title">别让重要事情溜走</h2>
              </div>
            </div>
            <ul class="attention-list">
              <li v-for="item in attention" :key="item.id">
                <RouterLink :to="item.path"
                  ><span class="attention-type"><i></i>{{ item.type }}</span
                  ><strong>{{ item.title }}</strong
                  ><small>查看</small></RouterLink
                >
              </li>
            </ul>
          </section>
        </div>
        <section
          class="v2-section home-timeline"
          aria-labelledby="timeline-title"
        >
          <div class="section-head">
            <div>
              <p class="section-label">今日时间轴</p>
              <h2 id="timeline-title">按时间，把今天排清楚</h2>
            </div>
            <RouterLink class="text-link" to="/plan">查看计划</RouterLink>
          </div>
          <EmptyState
            v-if="!timeline.length"
            icon="calendar"
            title="今天没有安排"
            description="待办、日程和提醒会在这里合并显示。"
            :action="{ label: '去计划', to: '/plan' }"
          />
          <ul v-else class="timeline-list">
            <li v-for="item in timeline" :key="`${item.kind}-${item.id}`">
              <RouterLink :to="item.path"
                ><time>{{ itemTime(item.scheduledAt) }}</time
                ><span
                  class="timeline-dot"
                  :class="`is-${item.kind.toLowerCase()}`"
                ></span
                ><span class="timeline-content"
                  ><strong :class="{ 'overdue-mark': item.overdue }">{{
                    item.title
                  }}</strong
                  ><small>{{
                    item.overdue ? "已逾期" : itemKind(item.kind)
                  }}</small></span
                ></RouterLink
              >
            </li>
          </ul>
        </section>
      </div>
      <RouterLink
        v-if="activeTrip"
        class="trip-glance-card"
        :to="`/trips/${activeTrip.id}`"
        ><AppIcon name="trip" :size="22" /><span
          ><small>{{
            activeTrip.startDate <= todayDate ? "行程进行中" : "即将出发"
          }}</small
          ><strong
            >{{ activeTrip.title }} · {{ activeTrip.destination }}</strong
          ></span
        ><AppIcon name="chevron-right" :size="18"
      /></RouterLink>
      <RouterLink class="home-capture" to="/capture">
        <span>例如：明天 10 点和李想开会</span>
        <AppIcon name="chevron-right" :size="18" />
      </RouterLink>
    </template>
  </section>
</template>
