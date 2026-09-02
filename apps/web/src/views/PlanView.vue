<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import {
  appendReturnTo,
  useOptionalRoute,
  useOptionalRouter,
} from "../utils/navigation";
import {
  addDays,
  formatDateTime,
  formatShanghaiDate,
  todayInShanghai,
} from "../utils/time";
import {
  buildTimeline,
  isInTimelineRange,
  type TimelineItem,
} from "../utils/timeline";

type DisplayMode = "DAY" | "WEEK" | "MONTH";
type Range =
  "TODAY" | "TOMORROW" | "WEEK" | "MONTH" | "FUTURE" | "OVERDUE" | "DATE";

const auth = useAuthStore();
const planner = usePlannerStore();
const route = useOptionalRoute();
const router = useOptionalRouter();
const range = ref<Range>(readRange(route?.query.range));
const displayMode = ref<DisplayMode>(
  readDisplayMode(route?.query.mode, route?.query.range),
);
const actionError = ref("");
const selectedDate = ref(
  typeof route?.query.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(route.query.date)
    ? route.query.date
    : todayInShanghai(),
);
const dateRail = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    addDays(todayInShanghai(), index - 2),
  ),
);
const items = computed(() =>
  buildTimeline(
    planner.calendarEvents,
    planner.openTasks,
    planner.scheduledReminders,
  ).filter((item) =>
    range.value === "DATE"
      ? item.scheduledAt !== null &&
        formatShanghaiDate(new Date(item.scheduledAt)) === selectedDate.value
      : isInTimelineRange(item, range.value),
  ),
);
const mainItems = computed(() => items.value.filter((item) => !item.overdue));
const overdueItems = computed(() =>
  buildTimeline([], planner.openTasks, []).filter((item) => item.overdue),
);

onMounted(() => {
  if (auth.isAuthenticated) void loadPlan();
});

watch(
  () => [route?.query.mode, route?.query.range, route?.query.date],
  ([mode, nextRange, date]) => {
    range.value = readRange(nextRange);
    displayMode.value = readDisplayMode(mode, nextRange);
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      selectedDate.value = date;
    }
  },
);

async function loadPlan() {
  actionError.value = "";
  await Promise.all([
    planner.loadCalendarEvents(),
    planner.loadTasks({ status: "OPEN" }),
    planner.loadReminders({ status: "SCHEDULED" }),
  ]);
}

function setRange(next: Range) {
  range.value = next;
  syncQuery();
}
function selectDate(date: string) {
  selectedDate.value = date;
  range.value = "DATE";
  displayMode.value = "DAY";
  syncQuery();
}
function setDisplay(next: DisplayMode) {
  displayMode.value = next;
  if (next === "DAY") range.value = "TODAY";
  if (next === "WEEK") range.value = "WEEK";
  if (next === "MONTH") range.value = "MONTH";
  syncQuery();
}
function syncQuery() {
  if (!router) return;
  void router.replace({
    query: {
      ...(route?.query ?? {}),
      date: range.value === "DATE" ? selectedDate.value : undefined,
      mode: displayMode.value.toLowerCase(),
      range: range.value.toLowerCase(),
    },
  });
}
function label(item: TimelineItem) {
  return item.kind === "EVENT"
    ? "日程"
    : item.kind === "TASK"
      ? "待办"
      : "提醒";
}
function time(item: TimelineItem) {
  return item.scheduledAt ? formatDateTime(item.scheduledAt) : "无截止时间";
}
async function complete(id: string) {
  try {
    await planner.completeTask(id);
  } catch {
    actionError.value = "暂时无法完成待办，请稍后重试。";
  }
}
async function cancelEvent(item: TimelineItem) {
  const event = planner.calendarEvents.find(
    (candidate) => candidate.id === item.id,
  );
  if (!event) return;
  try {
    await planner.updateCalendarEvent(event.id, {
      status: "CANCELLED",
      version: event.version,
    });
  } catch {
    actionError.value = "暂时无法取消日程，请稍后重试。";
  }
}

function withPlanSource(path: string) {
  return appendReturnTo(path, route?.fullPath ?? "/plan");
}

function readDisplayMode(value: unknown, rangeValue?: unknown): DisplayMode {
  if (value === "week" || (value === undefined && rangeValue === "week")) {
    return "WEEK";
  }
  if (value === "month" || (value === undefined && rangeValue === "month")) {
    return "MONTH";
  }
  return "DAY";
}

function readRange(value: unknown): Range {
  return value === "tomorrow"
    ? "TOMORROW"
    : value === "week"
      ? "WEEK"
      : value === "month"
        ? "MONTH"
        : value === "future"
          ? "FUTURE"
          : value === "overdue"
            ? "OVERDUE"
            : value === "date"
              ? "DATE"
              : "TODAY";
}
</script>

<template>
  <section class="v2-page plan-page" aria-labelledby="plan-title">
    <PageHeader
      title="计划中心"
      title-id="plan-title"
      subtitle="日程、待办与提醒，统一按时间查看"
      :show-back="false"
    >
      <template #actions>
        <RouterLink class="primary-button" :to="withPlanSource('/capture')"
          >快速新增</RouterLink
        >
      </template>
    </PageHeader>
    <div class="segmented-control" aria-label="计划视图">
      <button
        v-for="mode in [
          { value: 'DAY', label: '日' },
          { value: 'WEEK', label: '周' },
          { value: 'MONTH', label: '月' },
        ]"
        :key="mode.value"
        :class="{ active: displayMode === mode.value }"
        type="button"
        @click="setDisplay(mode.value as DisplayMode)"
      >
        {{ mode.label }}
      </button>
    </div>
    <div class="plan-date-rail" aria-label="日期选择">
      <button
        v-for="date in dateRail"
        :key="date"
        :class="{ active: selectedDate === date && range === 'DATE' }"
        type="button"
        @click="selectDate(date)"
      >
        <small>{{
          new Date(`${date}T00:00:00+08:00`)
            .toLocaleDateString("zh-CN", {
              weekday: "short",
              timeZone: "Asia/Shanghai",
            })
            .replace("周", "")
        }}</small
        ><strong>{{ date.slice(-2) }}</strong>
      </button>
    </div>
    <div class="range-chips" aria-label="快捷范围">
      <button
        v-for="option in [
          { value: 'TODAY', label: '今天' },
          { value: 'TOMORROW', label: '明天' },
          { value: 'WEEK', label: '本周' },
          { value: 'FUTURE', label: '以后' },
          { value: 'OVERDUE', label: '逾期' },
        ]"
        :key="option.value"
        :class="{ active: range === option.value }"
        type="button"
        @click="setRange(option.value as Range)"
      >
        {{ option.label }}
      </button>
    </div>
    <p
      v-if="actionError || planner.errorMessage"
      class="form-error"
      role="alert"
    >
      {{ actionError || planner.errorMessage }}
    </p>
    <div class="plan-desktop-grid">
      <section class="v2-section">
        <div class="section-head">
          <div>
            <p class="section-label">
              {{
                displayMode === "DAY"
                  ? "今天的时间轴"
                  : displayMode === "WEEK"
                    ? "本周计划"
                    : "本月计划"
              }}
            </p>
            <h2>
              {{
                mainItems.length ? `共 ${mainItems.length} 项` : "暂无匹配计划"
              }}
            </h2>
          </div>
        </div>
        <EmptyState
          v-if="!mainItems.length"
          icon="calendar"
          title="这里还没有计划"
          description="可切换范围，或前往计划页创建日程、待办和提醒。"
          :action="{ label: '新建待办', to: withPlanSource('/tasks') }"
        />
        <ul v-else class="timeline-list plan-timeline">
          <li v-for="item in mainItems" :key="`${item.kind}-${item.id}`">
            <div>
              <RouterLink class="plan-item-link" :to="withPlanSource(item.path)"
                ><time>{{ time(item) }}</time
                ><span
                  class="timeline-dot"
                  :class="`is-${item.kind.toLowerCase()}`"
                ></span
                ><span class="timeline-content"
                  ><strong :class="{ 'overdue-mark': item.overdue }">{{
                    item.title
                  }}</strong
                  ><small>{{
                    item.overdue ? "已逾期" : label(item)
                  }}</small></span
                ></RouterLink
              >
              <span class="plan-item-actions"
                ><button
                  v-if="item.kind === 'TASK'"
                  class="text-button"
                  type="button"
                  @click="complete(item.id)"
                >
                  完成</button
                ><RouterLink class="text-button" :to="withPlanSource(item.path)"
                  >查看</RouterLink
                ><button
                  v-if="item.kind === 'EVENT'"
                  class="text-button danger"
                  type="button"
                  @click="cancelEvent(item)"
                >
                  取消
                </button></span
              >
            </div>
          </li>
        </ul>
      </section>
      <aside class="plan-desktop-aside" aria-label="当前事项摘要">
        <p class="section-label">当前事项</p>
        <strong>{{ mainItems[0]?.title ?? "今天暂时没有待处理事项" }}</strong>
        <small>{{
          mainItems[0] ? time(mainItems[0]) : "可通过快速新增添加计划"
        }}</small>
        <RouterLink
          class="text-link"
          :to="withPlanSource(mainItems[0]?.path ?? '/capture')"
          >{{ mainItems[0] ? "查看详情" : "快速新增" }}</RouterLink
        >
      </aside>
    </div>
    <section
      v-if="overdueItems.length && range !== 'OVERDUE'"
      class="overdue-panel"
      aria-label="逾期事项"
    >
      <div>
        <small>逾期事项（{{ overdueItems.length }}）</small
        ><strong>{{ overdueItems[0]?.title }}</strong>
      </div>
      <RouterLink :to="withPlanSource(overdueItems[0]?.path ?? '/tasks')"
        >去处理</RouterLink
      >
    </section>
  </section>
</template>
