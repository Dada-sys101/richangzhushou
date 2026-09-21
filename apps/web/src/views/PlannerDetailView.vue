<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

import {
  ApiClientError,
  api,
  type CalendarEventSummary,
  type ReminderRecurrence,
  type ReminderScheduleType,
  type ReminderSummary,
  type TaskSummary,
} from "../api/client";
import DateField from "../components/DateField.vue";
import DateTimeField from "../components/DateTimeField.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
import { requestAppConfirm } from "../composables/useAppConfirm";
import { usePlannerStore } from "../stores/planner";
import type { PlannerEntity } from "../utils/navigation";
import {
  addDays,
  formatDateTime,
  formatShanghaiDate,
  toLocalDateTimeInput,
  toShanghaiIso,
  toShanghaiIsoDate,
} from "../utils/time";

type PlannerDetail = CalendarEventSummary | ReminderSummary | TaskSummary;
type DetailAction =
  "cancel" | "complete" | "delete" | "load" | "reschedule" | "restore" | "save";

interface TaskEditForm {
  dueAt: string;
  priority: TaskSummary["priority"];
  title: string;
  version: number;
}

interface CalendarEditForm {
  allDay: boolean;
  endsAt: string;
  startsAt: string;
  status: CalendarEventSummary["status"];
  title: string;
  version: number;
}

interface ReminderEditForm {
  dayOfMonth: string;
  interval: string;
  note: string;
  scheduleType: ReminderScheduleType;
  startsAt: string;
  title: string;
  until: string;
  version: number;
  weekdays: number[];
}

const route = useRoute();
const planner = usePlannerStore();

const id = computed(() =>
  typeof route.params.id === "string" ? route.params.id : "",
);
const entity = computed<PlannerEntity>(
  () => route.meta.plannerEntity ?? "task",
);
const entityLabel = computed(() => {
  switch (entity.value) {
    case "calendar-event":
      return "日程";
    case "reminder":
      return "提醒";
    default:
      return "待办";
  }
});
const pageTitle = computed(() => `${entityLabel.value}详情`);

const item = ref<PlannerDetail | null>(null);
const loading = ref(false);
const activeAction = ref<Exclude<DetailAction, "load"> | null>(null);
const errorMessage = ref("");
const successMessage = ref("");
const retryAction = ref<DetailAction | null>(null);
const loadStateKey = ref(0);
const confirmingDelete = ref(false);
const editing = ref(false);
const editSnapshot = ref("");
let loadSequence = 0;

const taskEditForm = ref<TaskEditForm>({
  dueAt: "",
  priority: "MEDIUM",
  title: "",
  version: 1,
});
const calendarEditForm = ref<CalendarEditForm>({
  allDay: false,
  endsAt: "",
  startsAt: "",
  status: "SCHEDULED",
  title: "",
  version: 1,
});
const calendarEditDay = ref(formatShanghaiDate(new Date()));
const reminderEditForm = ref<ReminderEditForm>({
  dayOfMonth: "",
  interval: "1",
  note: "",
  scheduleType: "ONCE",
  startsAt: "",
  title: "",
  until: "",
  version: 1,
  weekdays: [],
});
const weekdays = [1, 2, 3, 4, 5, 6, 7];

const isDirty = computed(
  () => editing.value && editSnapshot.value !== currentEditSnapshot(),
);
const isBusy = computed(
  () => activeAction.value !== null || loading.value || confirmingDelete.value,
);
const canEdit = computed(() => Boolean(item.value && !item.value.deletedAt));
const showComplete = computed(() => {
  const current = item.value;
  return Boolean(
    entity.value === "task" &&
    current &&
    "priority" in current &&
    current.status === "OPEN" &&
    !current.deletedAt,
  );
});
const showCancel = computed(() => {
  const current = item.value;
  if (!current || current.deletedAt) {
    return false;
  }
  if (entity.value === "task") {
    return "priority" in current && current.status === "OPEN";
  }
  if (entity.value === "calendar-event") {
    return !("scheduleType" in current) && current.status === "SCHEDULED";
  }
  return "scheduleType" in current && current.status === "SCHEDULED";
});
const showReschedule = computed(() => {
  const current = item.value;
  return Boolean(
    entity.value === "reminder" &&
    current &&
    "scheduleType" in current &&
    current.status === "CANCELLED" &&
    !current.deletedAt,
  );
});
const retryLabel = computed(() =>
  retryAction.value === "load" ? "重新加载" : "重试",
);
const loadErrorTitle = computed(() => {
  if (!id.value) return "无法打开详情";
  if (errorMessage.value === "找不到这条记录") return "记录不存在";
  if (errorMessage.value === "详情数据无效，暂时无法显示") {
    return "详情数据无效";
  }
  return "详情暂时无法加载";
});

useUnsavedChanges(isDirty);

onMounted(() => {
  void load();
});

watch([id, entity], () => {
  void load();
});

async function load() {
  const sequence = ++loadSequence;
  const requestedId = id.value;
  const requestedEntity = entity.value;

  loadStateKey.value = sequence;
  resetEditor();
  item.value = null;
  activeAction.value = null;
  confirmingDelete.value = false;
  loading.value = false;
  errorMessage.value = "";
  successMessage.value = "";
  retryAction.value = null;

  if (!requestedId) {
    errorMessage.value = "缺少记录标识，请返回列表后重试";
    return;
  }

  loading.value = true;
  try {
    const result = await fetchItem(requestedId, requestedEntity);
    if (!isCurrentLoad(sequence, requestedId, requestedEntity)) {
      return;
    }
    if (!isPlannerDetail(result, requestedEntity, requestedId)) {
      throw new InvalidPlannerDetailError();
    }
    item.value = result;
  } catch (error) {
    if (!isCurrentLoad(sequence, requestedId, requestedEntity)) {
      return;
    }
    errorMessage.value = messageOf(error, "load");
    retryAction.value = "load";
  } finally {
    if (isCurrentLoad(sequence, requestedId, requestedEntity)) {
      loading.value = false;
    }
  }
}

async function fetchItem(
  requestedId: string,
  requestedEntity: PlannerEntity,
): Promise<unknown> {
  if (requestedEntity === "calendar-event") {
    return api.getCalendarEvent(requestedId);
  }
  if (requestedEntity === "reminder") {
    return api.getReminder(requestedId);
  }
  return api.getTask(requestedId);
}

function isCurrentLoad(
  sequence: number,
  requestedId: string,
  requestedEntity: PlannerEntity,
): boolean {
  return (
    sequence === loadSequence &&
    id.value === requestedId &&
    entity.value === requestedEntity
  );
}

function startEdit() {
  const current = item.value;
  if (!current || current.deletedAt || isBusy.value) {
    return;
  }

  if ("priority" in current) {
    taskEditForm.value = {
      dueAt: current.dueAt ? toLocalDateTimeInput(current.dueAt) : "",
      priority: current.priority,
      title: current.title,
      version: current.version,
    };
  } else if ("scheduleType" in current) {
    reminderEditForm.value = {
      dayOfMonth: current.recurrence?.dayOfMonth
        ? String(current.recurrence.dayOfMonth)
        : "",
      interval: String(current.recurrence?.interval ?? 1),
      note: current.note ?? "",
      scheduleType: current.scheduleType,
      startsAt: toLocalDateTimeInput(current.scheduledAt),
      title: current.title,
      until: current.recurrence?.until
        ? toLocalDateTimeInput(current.recurrence.until)
        : "",
      version: current.version,
      weekdays: current.recurrence?.weekdays
        ? [...current.recurrence.weekdays]
        : [],
    };
  } else {
    calendarEditForm.value = {
      allDay: current.allDay,
      endsAt: current.allDay ? "" : toLocalDateTimeInput(current.endsAt),
      startsAt: current.allDay ? "" : toLocalDateTimeInput(current.startsAt),
      status: current.status,
      title: current.title,
      version: current.version,
    };
    calendarEditDay.value = formatShanghaiDate(new Date(current.startsAt));
  }

  editing.value = true;
  editSnapshot.value = currentEditSnapshot();
  clearActionMessages();
}

function cancelEdit() {
  resetEditor();
}

async function saveEdit() {
  const current = item.value;
  if (!current || current.deletedAt || isBusy.value) {
    return;
  }

  beginAction("save");
  try {
    let updated: PlannerDetail;
    if ("priority" in current) {
      updated = await planner.updateTask(current.id, {
        dueAt: taskEditForm.value.dueAt
          ? toShanghaiIso(taskEditForm.value.dueAt)
          : null,
        priority: taskEditForm.value.priority,
        title: taskEditForm.value.title,
        version: taskEditForm.value.version,
      });
      successMessage.value = "待办已更新";
    } else if ("scheduleType" in current) {
      updated = await planner.updateReminder(current.id, {
        note: reminderEditForm.value.note || null,
        recurrence: buildRecurrence(reminderEditForm.value),
        scheduleType: reminderEditForm.value.scheduleType,
        startsAt: toShanghaiIso(reminderEditForm.value.startsAt),
        title: reminderEditForm.value.title,
        version: reminderEditForm.value.version,
      });
      successMessage.value = "提醒已更新";
    } else {
      const startsAt = calendarEditForm.value.allDay
        ? toShanghaiIsoDate(calendarEditDay.value)
        : toShanghaiIso(calendarEditForm.value.startsAt);
      const endsAt = calendarEditForm.value.allDay
        ? toShanghaiIsoDate(addDays(calendarEditDay.value, 1))
        : toShanghaiIso(calendarEditForm.value.endsAt);
      const result = await planner.updateCalendarEvent(current.id, {
        allDay: calendarEditForm.value.allDay,
        endsAt,
        startsAt,
        status: calendarEditForm.value.status,
        title: calendarEditForm.value.title,
        version: calendarEditForm.value.version,
      });
      updated = result.calendarEvent;
      successMessage.value = result.overlapWarning
        ? result.overlapWarning.message
        : "日程已更新";
    }

    item.value = updated;
    syncPlannerItem(updated);
    resetEditor();
    retryAction.value = null;
  } catch (error) {
    errorMessage.value = messageOf(error, "action");
    retryAction.value = "save";
  } finally {
    activeAction.value = null;
  }
}

async function completeTask() {
  const current = item.value;
  if (
    !current ||
    !("priority" in current) ||
    current.deletedAt ||
    isBusy.value
  ) {
    return;
  }

  beginAction("complete");
  try {
    const result = await planner.completeTask(current.id);
    item.value = result.task;
    syncPlannerItem(result.task);
    successMessage.value = "待办已完成";
    resetEditor();
  } catch (error) {
    errorMessage.value = messageOf(error, "action");
    retryAction.value = "complete";
  } finally {
    activeAction.value = null;
  }
}

async function cancelCurrent() {
  const current = item.value;
  if (!current || current.deletedAt || isBusy.value) {
    return;
  }

  beginAction("cancel");
  try {
    if ("priority" in current) {
      const updated = await planner.updateTask(current.id, {
        status: "CANCELLED",
        version: current.version,
      });
      item.value = updated;
      syncPlannerItem(updated);
    } else if ("scheduleType" in current) {
      const updated = await planner.updateReminder(current.id, {
        status: "CANCELLED",
        version: current.version,
      });
      item.value = updated;
      syncPlannerItem(updated);
    } else {
      const result = await planner.updateCalendarEvent(current.id, {
        status: "CANCELLED",
        version: current.version,
      });
      item.value = result.calendarEvent;
      syncPlannerItem(result.calendarEvent);
    }
    successMessage.value = `${entityLabel.value}已取消`;
    resetEditor();
  } catch (error) {
    errorMessage.value = messageOf(error, "action");
    retryAction.value = "cancel";
  } finally {
    activeAction.value = null;
  }
}

async function rescheduleReminder() {
  const current = item.value;
  if (
    !current ||
    !("scheduleType" in current) ||
    current.deletedAt ||
    isBusy.value
  ) {
    return;
  }

  beginAction("reschedule");
  try {
    const updated = await planner.updateReminder(current.id, {
      status: "SCHEDULED",
      version: current.version,
    });
    item.value = updated;
    syncPlannerItem(updated);
    successMessage.value = "提醒已重新安排";
    resetEditor();
  } catch (error) {
    errorMessage.value = messageOf(error, "action");
    retryAction.value = "reschedule";
  } finally {
    activeAction.value = null;
  }
}

async function deleteCurrent(confirmBefore = true) {
  const current = item.value;
  if (!current || current.deletedAt || isBusy.value) {
    return;
  }

  if (confirmBefore) {
    confirmingDelete.value = true;
    const confirmed = await (async () => {
      try {
        return await requestAppConfirm({
          confirmLabel: "删除",
          description: `确定删除${entityLabel.value}“${current.title}”吗？删除后仍可恢复。`,
          destructive: true,
          title: `删除${entityLabel.value}？`,
        });
      } finally {
        confirmingDelete.value = false;
      }
    })();
    if (!confirmed || isBusy.value) {
      return;
    }
  }

  beginAction("delete");
  try {
    let updated: PlannerDetail;
    if ("priority" in current) {
      updated = await planner.deleteTask(current.id);
    } else if ("scheduleType" in current) {
      updated = await planner.deleteReminder(current.id);
    } else {
      updated = await planner.deleteCalendarEvent(current.id);
    }
    item.value = updated;
    syncPlannerItem(updated);
    successMessage.value = `${entityLabel.value}已删除`;
    resetEditor();
  } catch (error) {
    errorMessage.value = messageOf(error, "action");
    retryAction.value = "delete";
  } finally {
    activeAction.value = null;
  }
}

function handleDeleteCurrent() {
  void deleteCurrent();
}

async function restoreCurrent() {
  const current = item.value;
  if (!current || !current.deletedAt || isBusy.value) {
    return;
  }

  beginAction("restore");
  try {
    let updated: PlannerDetail;
    if ("priority" in current) {
      updated = await planner.restoreTask(current.id);
    } else if ("scheduleType" in current) {
      updated = await planner.restoreReminder(current.id);
    } else {
      updated = await planner.restoreCalendarEvent(current.id);
    }
    item.value = updated;
    syncPlannerItem(updated);
    successMessage.value = `${entityLabel.value}已恢复`;
    resetEditor();
  } catch (error) {
    errorMessage.value = messageOf(error, "action");
    retryAction.value = "restore";
  } finally {
    activeAction.value = null;
  }
}

async function retry() {
  const action = retryAction.value;
  retryAction.value = null;
  if (action === "load") return load();
  if (action === "save") return saveEdit();
  if (action === "complete") return completeTask();
  if (action === "cancel") return cancelCurrent();
  if (action === "reschedule") return rescheduleReminder();
  if (action === "delete") return deleteCurrent(false);
  if (action === "restore") return restoreCurrent();
}

function beginAction(action: Exclude<DetailAction, "load">) {
  activeAction.value = action;
  clearActionMessages();
  retryAction.value = null;
}

function clearActionMessages() {
  errorMessage.value = "";
  successMessage.value = "";
}

function resetEditor() {
  editing.value = false;
  editSnapshot.value = "";
}

function currentEditSnapshot(): string {
  if (entity.value === "task") {
    return JSON.stringify(taskEditForm.value);
  }
  if (entity.value === "calendar-event") {
    return JSON.stringify({
      ...calendarEditForm.value,
      day: calendarEditDay.value,
    });
  }
  return JSON.stringify({
    ...reminderEditForm.value,
    weekdays: [...reminderEditForm.value.weekdays].sort((a, b) => a - b),
  });
}

function syncPlannerItem(updated: PlannerDetail) {
  if ("priority" in updated) {
    upsert(planner.tasks, updated);
  } else if ("scheduleType" in updated) {
    upsert(planner.reminders, updated);
  } else {
    upsert(planner.calendarEvents, updated);
  }
}

function upsert<T extends { deletedAt: string | null; id: string }>(
  list: T[],
  updated: T,
) {
  const index = list.findIndex((candidate) => candidate.id === updated.id);
  if (index >= 0) {
    list.splice(index, 1, updated);
  } else if (!updated.deletedAt) {
    list.push(updated);
  }
}

function buildRecurrence(source: {
  dayOfMonth: string;
  interval: string;
  scheduleType: ReminderScheduleType;
  until: string;
  weekdays: number[];
}): ReminderRecurrence | null {
  if (source.scheduleType === "ONCE") {
    return null;
  }
  const recurrence: ReminderRecurrence = {};
  const interval = Number(source.interval) || 1;
  if (interval !== 1 || source.until) {
    recurrence.interval = interval;
  }
  if (source.scheduleType === "WEEKLY" && source.weekdays.length > 0) {
    recurrence.weekdays = [...source.weekdays].sort((a, b) => a - b);
  }
  if (source.scheduleType === "MONTHLY" && source.dayOfMonth) {
    recurrence.dayOfMonth = Number(source.dayOfMonth);
  }
  if (source.until) {
    recurrence.until = toShanghaiIso(source.until);
  }
  return Object.keys(recurrence).length > 0 ? recurrence : null;
}

function toggleWeekday(day: number) {
  const selected = reminderEditForm.value.weekdays;
  const index = selected.indexOf(day);
  if (index >= 0) {
    selected.splice(index, 1);
  } else {
    selected.push(day);
  }
}

class InvalidPlannerDetailError extends Error {
  constructor() {
    super("INVALID_PLANNER_DETAIL");
    this.name = "InvalidPlannerDetailError";
  }
}

function isPlannerDetail(
  value: unknown,
  expectedEntity: PlannerEntity,
  expectedId: string,
): value is PlannerDetail {
  if (!isRecord(value) || !isBasePlannerDetail(value, expectedId)) {
    return false;
  }

  if (expectedEntity === "task") {
    return (
      isTaskStatus(value.status) &&
      isTaskPriority(value.priority) &&
      isNullableIsoDate(value.dueAt) &&
      typeof value.overdue === "boolean" &&
      isNullableIsoDate(value.cancelledAt) &&
      isNullableIsoDate(value.completedAt)
    );
  }

  if (expectedEntity === "calendar-event") {
    return (
      isCalendarStatus(value.status) &&
      typeof value.allDay === "boolean" &&
      isIsoDate(value.startsAt) &&
      isIsoDate(value.endsAt)
    );
  }

  return (
    isReminderStatus(value.status) &&
    isReminderScheduleType(value.scheduleType) &&
    isIsoDate(value.scheduledAt) &&
    Number.isInteger(value.attemptCount) &&
    Number(value.attemptCount) >= 0 &&
    isNullableString(value.note) &&
    isNullableString(value.failureReason) &&
    isNullableIsoDate(value.sentAt) &&
    isNullableIsoDate(value.suppressedAt) &&
    isReminderRecurrence(value.recurrence)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBasePlannerDetail(
  value: Record<string, unknown>,
  expectedId: string,
): boolean {
  return (
    value.id === expectedId &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    Number.isInteger(value.version) &&
    Number(value.version) > 0 &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt) &&
    isNullableIsoDate(value.deletedAt)
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isTaskStatus(value: unknown): value is TaskSummary["status"] {
  return value === "OPEN" || value === "COMPLETED" || value === "CANCELLED";
}

function isTaskPriority(value: unknown): value is TaskSummary["priority"] {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}

function isCalendarStatus(
  value: unknown,
): value is CalendarEventSummary["status"] {
  return value === "SCHEDULED" || value === "CANCELLED";
}

function isReminderStatus(value: unknown): value is ReminderSummary["status"] {
  return (
    value === "SCHEDULED" ||
    value === "SENT" ||
    value === "CANCELLED" ||
    value === "FAILED" ||
    value === "SUPPRESSED"
  );
}

function isReminderScheduleType(value: unknown): value is ReminderScheduleType {
  return (
    value === "ONCE" ||
    value === "DAILY" ||
    value === "WEEKLY" ||
    value === "MONTHLY"
  );
}

function isReminderRecurrence(
  value: unknown,
): value is ReminderRecurrence | null {
  if (value === null) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  if (
    "interval" in value &&
    (!Number.isInteger(value.interval) || Number(value.interval) < 1)
  ) {
    return false;
  }
  if (
    "dayOfMonth" in value &&
    (!Number.isInteger(value.dayOfMonth) ||
      Number(value.dayOfMonth) < 1 ||
      Number(value.dayOfMonth) > 31)
  ) {
    return false;
  }
  if (
    "weekdays" in value &&
    (!Array.isArray(value.weekdays) ||
      value.weekdays.some(
        (day) => !Number.isInteger(day) || Number(day) < 1 || Number(day) > 7,
      ))
  ) {
    return false;
  }
  return !("until" in value) || isNullableIsoDate(value.until);
}

function statusText(value: PlannerDetail): string {
  if ("priority" in value) {
    return value.status === "OPEN"
      ? "待完成"
      : value.status === "COMPLETED"
        ? "已完成"
        : "已取消";
  }
  if ("scheduleType" in value) {
    const labels: Record<string, string> = {
      CANCELLED: "已取消",
      FAILED: "发送失败",
      SCHEDULED: "待发送",
      SENT: "已发送",
      SUPPRESSED: "已抑制",
    };
    return labels[value.status] ?? "未知状态";
  }
  return value.status === "SCHEDULED" ? "已安排" : "已取消";
}

function statusClass(value: PlannerDetail): string {
  if ("priority" in value) {
    return value.status === "OPEN"
      ? "status-pending"
      : value.status === "COMPLETED"
        ? "status-confirmed"
        : "status-discarded";
  }
  return value.status === "SCHEDULED"
    ? "status-pending"
    : value.status === "SENT"
      ? "status-confirmed"
      : value.status === "FAILED"
        ? "status-failed"
        : "status-discarded";
}

function timeText(value: PlannerDetail): string {
  if ("dueAt" in value) {
    return value.dueAt ? formatDateTime(value.dueAt) : "未设置截止时间";
  }
  if ("scheduleType" in value) {
    return formatDateTime(value.scheduledAt);
  }
  if (value.allDay) {
    return `全天 · ${formatShanghaiDate(new Date(value.startsAt))}`;
  }
  return `${formatDateTime(value.startsAt)} – ${formatDateTime(value.endsAt)}`;
}

function timeLabel(value: PlannerDetail): string {
  if ("dueAt" in value) return "截止时间";
  if ("scheduleType" in value) return "下一次时间";
  return "日程时间";
}

function priorityText(priority: TaskSummary["priority"]): string {
  return priority === "HIGH" ? "高" : priority === "LOW" ? "低" : "中";
}

function recurrenceText(value: ReminderSummary): string {
  if (value.scheduleType === "ONCE") return "一次性";
  if (value.scheduleType === "DAILY") {
    return `每 ${value.recurrence?.interval ?? 1} 天`;
  }
  if (value.scheduleType === "WEEKLY") {
    const days = value.recurrence?.weekdays?.length
      ? value.recurrence.weekdays.map(weekdayText).join("、")
      : "相同星期";
    return `每 ${value.recurrence?.interval ?? 1} 周（${days}）`;
  }
  return `每 ${value.recurrence?.interval ?? 1} 个月的 ${value.recurrence?.dayOfMonth ?? "同一天"} 日`;
}

function weekdayText(day: number): string {
  const label = ["一", "二", "三", "四", "五", "六", "日"][day - 1];
  return label ? `周${label}` : "未知星期";
}

function detailNote(value: PlannerDetail): string | null {
  return "note" in value ? value.note : null;
}

function messageOf(error: unknown, phase: "load" | "action"): string {
  if (error instanceof InvalidPlannerDetailError) {
    return "详情数据无效，暂时无法显示";
  }
  if (error instanceof ApiClientError) {
    if (phase === "load" && error.status === 404) {
      return "找不到这条记录";
    }
    if (error.status === 401) {
      return "登录状态已过期，请重新登录";
    }
    if (error.status === 403) {
      return "没有权限执行该操作";
    }
    if (error.status === 0) {
      return "当前离线，请恢复网络后重试";
    }
    if (error.status >= 500) {
      return phase === "load"
        ? "详情暂时无法加载，请稍后重试"
        : "操作失败，请稍后重试";
    }
    return "操作失败，请稍后重试";
  }
  return phase === "load"
    ? "详情暂时无法加载，请稍后重试"
    : "操作失败，请稍后重试";
}
</script>

<template>
  <SecondaryPageShell
    class="planner-detail-page planner-detail-workspace"
    :title="pageTitle"
    title-id="planner-detail-title"
    subtitle="查看并管理当前事项"
  >
    <LoadingState
      v-if="loading"
      description="正在获取当前事项的最新详情。"
      title="正在加载详情…"
    />
    <template v-else>
      <ErrorState
        v-if="errorMessage && !item"
        :key="loadStateKey"
        :action-label="retryAction === 'load' ? '重新加载' : undefined"
        :description="errorMessage"
        :title="loadErrorTitle"
        @retry="retry"
      />
      <article v-else-if="item" class="planner-detail-card">
        <div class="planner-detail-card-head">
          <div class="planner-detail-heading">
            <p class="eyebrow">{{ entityLabel }}详情</p>
            <h2>{{ item.title }}</h2>
          </div>
          <div
            v-if="item.deletedAt"
            class="planner-detail-status"
            aria-label="当前状态"
          >
            <span class="revoked-mark">已删除</span>
          </div>
        </div>

        <div
          v-if="errorMessage"
          class="planner-detail-error planner-detail-feedback"
          role="alert"
        >
          <span>{{ errorMessage }}</span>
          <button
            v-if="retryAction"
            class="secondary-button"
            type="button"
            @click="retry"
          >
            {{ retryLabel }}
          </button>
        </div>

        <p v-if="successMessage" class="planner-detail-success" role="status">
          {{ successMessage }}
        </p>

        <form
          v-if="editing"
          class="planner-detail-form"
          @submit.prevent="saveEdit"
        >
          <template v-if="entity === 'task'">
            <label class="planner-field">
              标题
              <input v-model="taskEditForm.title" maxlength="200" required />
            </label>
            <label class="planner-field">
              优先级
              <select v-model="taskEditForm.priority">
                <option value="LOW">低</option>
                <option value="MEDIUM">中</option>
                <option value="HIGH">高</option>
              </select>
            </label>
            <label class="planner-field">
              截止时间（可选）
              <DateTimeField v-model="taskEditForm.dueAt" />
            </label>
          </template>

          <template v-else-if="entity === 'calendar-event'">
            <label class="planner-field">
              标题
              <input
                v-model="calendarEditForm.title"
                maxlength="200"
                required
              />
            </label>
            <label class="check-label">
              <input v-model="calendarEditForm.allDay" type="checkbox" />
              全天
            </label>
            <label v-if="calendarEditForm.allDay" class="planner-field">
              日期
              <DateField v-model="calendarEditDay" required />
            </label>
            <template v-else>
              <label class="planner-field">
                开始
                <DateTimeField v-model="calendarEditForm.startsAt" required />
              </label>
              <label class="planner-field">
                结束
                <DateTimeField
                  v-model="calendarEditForm.endsAt"
                  :min="calendarEditForm.startsAt"
                  required
                />
              </label>
            </template>
          </template>

          <template v-else>
            <label class="planner-field">
              标题
              <input
                v-model="reminderEditForm.title"
                maxlength="200"
                required
              />
            </label>
            <label class="planner-field">
              备注（可选）
              <input v-model="reminderEditForm.note" maxlength="500" />
            </label>
            <label class="planner-field">
              重复
              <select v-model="reminderEditForm.scheduleType">
                <option value="ONCE">一次性</option>
                <option value="DAILY">每天</option>
                <option value="WEEKLY">每周</option>
                <option value="MONTHLY">每月</option>
              </select>
            </label>
            <label class="planner-field">
              首次时间
              <DateTimeField v-model="reminderEditForm.startsAt" required />
            </label>
            <template v-if="reminderEditForm.scheduleType !== 'ONCE'">
              <label class="planner-field">
                间隔
                <input
                  v-model="reminderEditForm.interval"
                  max="366"
                  min="1"
                  type="number"
                />
              </label>
              <fieldset
                v-if="reminderEditForm.scheduleType === 'WEEKLY'"
                class="scope-fieldset"
              >
                <legend>星期</legend>
                <label v-for="day in weekdays" :key="day" class="check-label">
                  <input
                    :checked="reminderEditForm.weekdays.includes(day)"
                    type="checkbox"
                    @change="toggleWeekday(day)"
                  />
                  周{{
                    day === 7
                      ? "日"
                      : ["一", "二", "三", "四", "五", "六"][day - 1]
                  }}
                </label>
              </fieldset>
              <label
                v-if="reminderEditForm.scheduleType === 'MONTHLY'"
                class="planner-field"
              >
                每月几号
                <input
                  v-model="reminderEditForm.dayOfMonth"
                  max="31"
                  min="1"
                  type="number"
                />
              </label>
              <label class="planner-field">
                截止时间（可选）
                <DateTimeField
                  v-model="reminderEditForm.until"
                  :min="reminderEditForm.startsAt"
                />
              </label>
            </template>
          </template>

          <div class="planner-actions">
            <button class="primary-button" :disabled="isBusy" type="submit">
              {{ activeAction === "save" ? "保存中…" : "保存" }}
            </button>
            <button
              class="secondary-button"
              :disabled="isBusy"
              type="button"
              @click="cancelEdit"
            >
              取消编辑
            </button>
          </div>
        </form>

        <dl v-else class="planner-detail-list">
          <div>
            <dt>类型</dt>
            <dd>{{ entityLabel }}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>
              <span class="status-badge" :class="statusClass(item)">
                {{ statusText(item) }}
              </span>
            </dd>
          </div>
          <div>
            <dt>{{ timeLabel(item) }}</dt>
            <dd>
              <span>{{ timeText(item) }}</span>
              <span
                v-if="'overdue' in item && item.overdue"
                class="overdue-mark"
              >
                已逾期
              </span>
            </dd>
          </div>
          <div v-if="'priority' in item">
            <dt>优先级</dt>
            <dd>{{ priorityText(item.priority) }}</dd>
          </div>
          <div v-if="'scheduleType' in item">
            <dt>重复</dt>
            <dd>{{ recurrenceText(item) }}</dd>
          </div>
          <div v-if="'scheduleType' in item">
            <dt>尝试次数</dt>
            <dd>{{ item.attemptCount }} 次</dd>
          </div>
          <div v-if="'scheduleType' in item && item.failureReason">
            <dt>失败原因</dt>
            <dd>{{ item.failureReason }}</dd>
          </div>
          <div v-if="detailNote(item)">
            <dt>备注</dt>
            <dd>{{ detailNote(item) }}</dd>
          </div>
          <div v-if="item.deletedAt">
            <dt>删除状态</dt>
            <dd class="revoked-mark">已删除，可恢复</dd>
          </div>
        </dl>

        <div
          v-if="!editing"
          class="planner-detail-actions"
          :aria-busy="isBusy"
          aria-label="事项操作"
        >
          <div
            v-if="canEdit || showComplete || showReschedule"
            class="planner-detail-action-group"
            role="group"
            aria-label="主要操作"
          >
            <button
              v-if="canEdit"
              class="secondary-button"
              :disabled="isBusy"
              type="button"
              @click="startEdit"
            >
              编辑
            </button>
            <button
              v-if="showComplete"
              class="primary-button"
              :disabled="isBusy"
              type="button"
              @click="completeTask"
            >
              {{ activeAction === "complete" ? "处理中…" : "完成" }}
            </button>
            <button
              v-if="showReschedule"
              class="primary-button"
              :disabled="isBusy"
              type="button"
              @click="rescheduleReminder"
            >
              {{ activeAction === "reschedule" ? "处理中…" : "重新安排" }}
            </button>
          </div>
          <div
            v-if="showCancel"
            class="planner-detail-action-group"
            role="group"
            aria-label="状态操作"
          >
            <button
              class="text-button danger"
              :disabled="isBusy"
              type="button"
              @click="cancelCurrent"
            >
              {{ activeAction === "cancel" ? "处理中…" : `取消${entityLabel}` }}
            </button>
          </div>
          <div
            class="planner-detail-action-group planner-detail-danger-actions"
            role="group"
            aria-label="危险操作"
          >
            <button
              v-if="item.deletedAt"
              class="primary-button"
              :disabled="isBusy"
              type="button"
              @click="restoreCurrent"
            >
              {{ activeAction === "restore" ? "处理中…" : "恢复" }}
            </button>
            <button
              v-else
              class="danger-button"
              :disabled="isBusy"
              type="button"
              @click="handleDeleteCurrent"
            >
              {{ activeAction === "delete" ? "删除中…" : "删除" }}
            </button>
          </div>
        </div>
      </article>
    </template>
  </SecondaryPageShell>
</template>
