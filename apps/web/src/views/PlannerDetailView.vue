<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

import {
  api,
  type CalendarEventSummary,
  type ReminderRecurrence,
  type ReminderScheduleType,
  type ReminderSummary,
  type TaskSummary,
} from "../api/client";
import DateField from "../components/DateField.vue";
import DateTimeField from "../components/DateTimeField.vue";
import PageHeader from "../components/PageHeader.vue";
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
const editing = ref(false);
const editSnapshot = ref("");

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
const isBusy = computed(() => activeAction.value !== null || loading.value);
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

useUnsavedChanges(isDirty);

onMounted(() => {
  void load();
});

watch([id, entity], () => {
  void load();
});

async function load() {
  resetEditor();
  item.value = null;
  errorMessage.value = "";
  successMessage.value = "";
  retryAction.value = null;

  if (!id.value) {
    errorMessage.value = "找不到这条记录";
    return;
  }

  loading.value = true;
  try {
    const result = await fetchItem();
    if (!isPlannerDetail(result)) {
      throw new Error("无法读取该事项");
    }
    item.value = result;
  } catch (error) {
    errorMessage.value = messageOf(error);
    retryAction.value = "load";
  } finally {
    loading.value = false;
  }
}

async function fetchItem(): Promise<PlannerDetail> {
  if (entity.value === "calendar-event") {
    return api.getCalendarEvent(id.value);
  }
  if (entity.value === "reminder") {
    return api.getReminder(id.value);
  }
  return api.getTask(id.value);
}

function startEdit() {
  const current = item.value;
  if (!current || current.deletedAt) {
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
  if (!current || current.deletedAt) {
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
    errorMessage.value = messageOf(error);
    retryAction.value = "save";
  } finally {
    activeAction.value = null;
  }
}

async function completeTask() {
  const current = item.value;
  if (!current || !("priority" in current) || current.deletedAt) {
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
    errorMessage.value = messageOf(error);
    retryAction.value = "complete";
  } finally {
    activeAction.value = null;
  }
}

async function cancelCurrent() {
  const current = item.value;
  if (!current || current.deletedAt) {
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
    errorMessage.value = messageOf(error);
    retryAction.value = "cancel";
  } finally {
    activeAction.value = null;
  }
}

async function rescheduleReminder() {
  const current = item.value;
  if (!current || !("scheduleType" in current) || current.deletedAt) {
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
    errorMessage.value = messageOf(error);
    retryAction.value = "reschedule";
  } finally {
    activeAction.value = null;
  }
}

async function deleteCurrent(confirmBefore = true) {
  const current = item.value;
  if (!current || current.deletedAt) {
    return;
  }
  if (
    confirmBefore &&
    !(await requestAppConfirm({
      confirmLabel: "删除",
      description: `确定删除${entityLabel.value}“${current.title}”吗？删除后仍可恢复。`,
      destructive: true,
      title: `删除${entityLabel.value}？`,
    }))
  ) {
    return;
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
    errorMessage.value = messageOf(error);
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
  if (!current || !current.deletedAt) {
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
    errorMessage.value = messageOf(error);
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

function isPlannerDetail(value: unknown): value is PlannerDetail {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { title?: unknown }).title === "string"
  );
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
    return labels[value.status] ?? value.status;
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
      : "status-discarded";
}

function timeText(value: PlannerDetail): string {
  if ("dueAt" in value) {
    return value.dueAt ? formatDateTime(value.dueAt) : "未设置截止时间";
  }
  if ("scheduleType" in value) {
    return formatDateTime(value.scheduledAt);
  }
  return `${formatDateTime(value.startsAt)} – ${formatDateTime(value.endsAt)}`;
}

function detailNote(value: PlannerDetail): string | null {
  return "note" in value ? value.note : null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
</script>

<template>
  <section class="planner-detail-page" aria-labelledby="planner-detail-title">
    <PageHeader
      :title="pageTitle"
      title-id="planner-detail-title"
      subtitle="查看并管理当前事项"
    />

    <p v-if="loading" class="loading-copy" role="status">加载中…</p>
    <template v-else>
      <div v-if="errorMessage" class="planner-detail-error" role="alert">
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
      <article v-if="item" class="planner-detail-card">
        <div class="planner-detail-card-head">
          <div>
            <p class="eyebrow">{{ entityLabel }}</p>
            <h2>{{ item.title }}</h2>
          </div>
          <span class="status-chip" :class="statusClass(item)">
            {{ statusText(item) }}
          </span>
        </div>

        <p v-if="successMessage" class="form-success" role="status">
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
            <dt>时间</dt>
            <dd>{{ timeText(item) }}</dd>
          </div>
          <div v-if="'priority' in item">
            <dt>优先级</dt>
            <dd>{{ item.priority }}</dd>
          </div>
          <div v-if="detailNote(item)">
            <dt>备注</dt>
            <dd>{{ detailNote(item) }}</dd>
          </div>
          <div v-if="item.deletedAt">
            <dt>状态</dt>
            <dd>已删除，可恢复</dd>
          </div>
        </dl>

        <div v-if="!editing" class="planner-detail-actions">
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
            v-if="showCancel"
            class="text-button danger"
            :disabled="isBusy"
            type="button"
            @click="cancelCurrent"
          >
            {{ activeAction === "cancel" ? "处理中…" : `取消${entityLabel}` }}
          </button>
          <button
            v-if="showReschedule"
            class="secondary-button"
            :disabled="isBusy"
            type="button"
            @click="rescheduleReminder"
          >
            {{ activeAction === "reschedule" ? "处理中…" : "重新安排" }}
          </button>
          <button
            v-if="item.deletedAt"
            class="secondary-button"
            :disabled="isBusy"
            type="button"
            @click="restoreCurrent"
          >
            {{ activeAction === "restore" ? "处理中…" : "恢复" }}
          </button>
          <button
            v-if="!item.deletedAt"
            class="danger-button"
            :disabled="isBusy"
            type="button"
            @click="handleDeleteCurrent"
          >
            {{ activeAction === "delete" ? "删除中…" : "删除" }}
          </button>
        </div>
      </article>
    </template>
  </section>
</template>
