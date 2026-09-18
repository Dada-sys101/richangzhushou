<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import EmptyState from "../components/EmptyState.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
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
type PlanLoadStatus = "loading" | "ready" | "error";

const auth = useAuthStore();
const planner = usePlannerStore();
const route = useOptionalRoute();
const router = useOptionalRouter();
const range = ref<Range>(readRange(route?.query.range));
const displayMode = ref<DisplayMode>(
  readDisplayMode(route?.query.mode, route?.query.range),
);
const actionError = ref("");
const loadStatus = ref<PlanLoadStatus>("loading");
const initialLoadError = ref("");
const partialLoadError = ref("");
const selectedDate = ref(
  typeof route?.query.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(route.query.date)
    ? route.query.date
    : todayInShanghai(),
);
const hideCalendarEvents = ref(false);
const hideOpenTasks = ref(false);
const hideScheduledReminders = ref(false);
const visibleCalendarEvents = computed(() =>
  hideCalendarEvents.value ? [] : planner.calendarEvents,
);
const visibleOpenTasks = computed(() =>
  hideOpenTasks.value ? [] : planner.openTasks,
);
const visibleScheduledReminders = computed(() =>
  hideScheduledReminders.value ? [] : planner.scheduledReminders,
);
const dateRail = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    addDays(todayInShanghai(), index - 2),
  ),
);
const items = computed(() =>
  buildTimeline(
    visibleCalendarEvents.value,
    visibleOpenTasks.value,
    visibleScheduledReminders.value,
  ).filter((item) =>
    range.value === "DATE"
      ? item.scheduledAt !== null &&
        formatShanghaiDate(new Date(item.scheduledAt)) === selectedDate.value
      : isInTimelineRange(item, range.value),
  ),
);
const mainItems = computed(() =>
  range.value === "OVERDUE"
    ? items.value
    : items.value.filter((item) => !item.overdue),
);
const overdueItems = computed(() =>
  buildTimeline([], visibleOpenTasks.value, []).filter((item) => item.overdue),
);

onMounted(() => {
  if (auth.isAuthenticated) {
    void loadPlan();
  } else {
    loadStatus.value = "ready";
  }
});

watch(
  () => [route?.query.mode, route?.query.range, route?.query.date],
  ([mode, nextRange, date]) => {
    const resolvedRange = readRange(nextRange);
    range.value = resolvedRange;
    displayMode.value = readDisplayMode(mode, nextRange);
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      selectedDate.value = date;
    } else if (resolvedRange === "TODAY") {
      selectedDate.value = todayInShanghai();
    }
  },
);

async function loadPlan() {
  const calendarEventsSnapshot = planner.calendarEvents;
  const tasksSnapshot = planner.tasks;
  const remindersSnapshot = planner.reminders;
  loadStatus.value = "loading";
  initialLoadError.value = "";
  partialLoadError.value = "";
  actionError.value = "";
  hideCalendarEvents.value = false;
  hideOpenTasks.value = false;
  hideScheduledReminders.value = false;
  planner.clearError();
  const results = await Promise.allSettled([
    planner.loadCalendarEvents(),
    planner.loadTasks({ status: "OPEN" }),
    planner.loadReminders({ status: "SCHEDULED" }),
  ]);
  const rejectedCount = results.filter(
    (result) => result.status === "rejected",
  ).length;
  const storeLoadFailed = Boolean(planner.errorKind || planner.errorMessage);
  const failed = rejectedCount > 0 || storeLoadFailed;

  if (failed) {
    hideCalendarEvents.value =
      planner.calendarEvents === calendarEventsSnapshot;
    hideOpenTasks.value = planner.tasks === tasksSnapshot;
    hideScheduledReminders.value = planner.reminders === remindersSnapshot;
  }
  const hasData = Boolean(
    visibleCalendarEvents.value.length ||
    visibleOpenTasks.value.length ||
    visibleScheduledReminders.value.length,
  );

  if (failed && !hasData) {
    loadStatus.value = "error";
    initialLoadError.value =
      planner.errorKind === "AUTH_EXPIRED"
        ? "登录状态已过期，请重新登录后再试。"
        : "日程、待办和提醒暂时无法加载，请检查网络后重试。";
  } else {
    loadStatus.value = "ready";
    if (failed) {
      partialLoadError.value =
        "部分计划暂时无法加载，已显示当前可用内容；可以稍后重试。";
    }
  }
  planner.clearError();
}

function setRange(next: Range) {
  range.value = next;
  if (next === "TODAY") {
    selectedDate.value = todayInShanghai();
    displayMode.value = "DAY";
  }
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
  if (next === "DAY") {
    range.value = "TODAY";
    selectedDate.value = todayInShanghai();
  }
  if (next === "WEEK") range.value = "WEEK";
  if (next === "MONTH") range.value = "MONTH";
  syncQuery();
}
function dateWeekday(date: string) {
  return new Date(`${date}T00:00:00+08:00`)
    .toLocaleDateString("zh-CN", {
      weekday: "short",
      timeZone: "Asia/Shanghai",
    })
    .replace("周", "");
}
function dateLabel(date: string) {
  return date === todayInShanghai()
    ? `今天，${date}`
    : `${dateWeekday(date)}，${date}`;
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
  <section
    class="v2-page plan-page"
    aria-labelledby="plan-title"
    :aria-busy="loadStatus === 'loading' ? 'true' : undefined"
  >
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
    <div class="plan-controls" aria-label="计划筛选与视图">
      <div class="plan-control-group">
        <span class="plan-control-label">视图</span>
        <div class="segmented-control" role="group" aria-label="计划视图">
          <button
            v-for="mode in [
              { value: 'DAY', label: '日' },
              { value: 'WEEK', label: '周' },
              { value: 'MONTH', label: '月' },
            ]"
            :key="mode.value"
            :aria-pressed="displayMode === mode.value"
            :class="{ active: displayMode === mode.value }"
            type="button"
            @click="setDisplay(mode.value as DisplayMode)"
          >
            {{ mode.label }}
          </button>
        </div>
      </div>
      <div class="plan-control-group">
        <span class="plan-control-label">日期</span>
        <div class="plan-date-rail" role="group" aria-label="日期选择">
          <button
            v-for="date in dateRail"
            :key="date"
            :aria-current="date === todayInShanghai() ? 'date' : undefined"
            :aria-label="`选择${dateLabel(date)}`"
            :aria-pressed="
              selectedDate === date && (range === 'DATE' || range === 'TODAY')
            "
            :class="{
              active:
                selectedDate === date &&
                (range === 'DATE' || range === 'TODAY'),
            }"
            type="button"
            @click="selectDate(date)"
          >
            <small>{{
              date === todayInShanghai() ? "今天" : dateWeekday(date)
            }}</small>
            <strong>{{ date.slice(-2) }}</strong>
          </button>
        </div>
      </div>
      <div class="plan-control-group">
        <span class="plan-control-label">范围</span>
        <div class="range-chips" role="group" aria-label="快捷范围">
          <button
            v-for="option in [
              { value: 'TODAY', label: '今天' },
              { value: 'TOMORROW', label: '明天' },
              { value: 'WEEK', label: '本周' },
              { value: 'FUTURE', label: '以后' },
              { value: 'OVERDUE', label: '逾期' },
            ]"
            :key="option.value"
            :aria-pressed="range === option.value"
            :class="{ active: range === option.value }"
            type="button"
            @click="setRange(option.value as Range)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>
    <p v-if="actionError" class="form-error" role="alert">
      {{ actionError }}
    </p>
    <LoadingState
      v-if="loadStatus === 'loading'"
      title="正在整理计划…"
      description="日程、待办和提醒会合并显示在同一条时间轴上。"
    />
    <ErrorState
      v-else-if="loadStatus === 'error'"
      title="暂时无法加载计划"
      :description="initialLoadError"
      action-label="重试"
      @retry="loadPlan"
    />
    <template v-else>
      <p v-if="partialLoadError" class="plan-load-warning" role="status">
        {{ partialLoadError }}
      </p>
      <div class="plan-desktop-grid">
        <section class="v2-section">
          <div class="section-head">
            <div>
              <p class="section-label">
                {{
                  range === "OVERDUE"
                    ? "逾期事项"
                    : displayMode === "DAY"
                      ? "今天的时间轴"
                      : displayMode === "WEEK"
                        ? "本周计划"
                        : "本月计划"
                }}
              </p>
              <h2>
                {{
                  mainItems.length
                    ? `共 ${mainItems.length} 项`
                    : "暂无匹配计划"
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
                <RouterLink
                  class="plan-item-link"
                  :to="withPlanSource(item.path)"
                  ><time>{{ time(item) }}</time
                  ><span
                    class="timeline-dot"
                    :class="`is-${item.kind.toLowerCase()}`"
                  ></span
                  ><span class="timeline-content"
                    ><strong :class="{ 'overdue-mark': item.overdue }">{{
                      item.title
                    }}</strong
                    ><small
                      class="timeline-item-type"
                      :class="`is-${item.kind.toLowerCase()}`"
                      >{{ label(item)
                      }}<span v-if="item.overdue"> · 已逾期</span></small
                    ></span
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
                  ><RouterLink
                    class="text-button"
                    :to="withPlanSource(item.path)"
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
    </template>
  </section>
</template>
