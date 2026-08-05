<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import type {
  ReminderRecurrence,
  ReminderScheduleType,
  ReminderSummary,
} from "../api/client";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import {
  formatDateTime,
  toLocalDateTimeInput,
  toShanghaiIso,
} from "../utils/time";

const auth = useAuthStore();
const planner = usePlannerStore();

const statusFilter = ref<
  "" | "CANCELLED" | "FAILED" | "SCHEDULED" | "SENT" | "SUPPRESSED"
>("SCHEDULED");
const includeDeleted = ref(false);
const editingId = ref("");
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const weekdays = [1, 2, 3, 4, 5, 6, 7];

const form = ref({
  dayOfMonth: "",
  interval: "1",
  note: "",
  scheduleType: "ONCE" as ReminderScheduleType,
  startsAt: "",
  title: "",
  until: "",
  weekdays: [] as number[],
});
const editForm = ref({
  dayOfMonth: "",
  interval: "1",
  note: "",
  scheduleType: "ONCE" as ReminderScheduleType,
  startsAt: "",
  title: "",
  until: "",
  version: 1,
  weekdays: [] as number[],
});

const notificationStatus = computed(() => {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
});

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
  }
});

watch([statusFilter, includeDeleted], () => {
  void reload();
});

async function reload() {
  await planner.loadReminders({
    includeDeleted: includeDeleted.value || undefined,
    status: statusFilter.value || undefined,
  });
}

async function submit() {
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await planner.createReminder({
      note: form.value.note || null,
      recurrence: buildRecurrence(form.value),
      scheduleType: form.value.scheduleType,
      startsAt: toShanghaiIso(form.value.startsAt),
      title: form.value.title,
    });
    successMessage.value = "提醒已创建";
    form.value = {
      dayOfMonth: "",
      interval: "1",
      note: "",
      scheduleType: "ONCE",
      startsAt: "",
      title: "",
      until: "",
      weekdays: [],
    };
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function startEdit(item: ReminderSummary) {
  editingId.value = item.id;
  editForm.value = {
    dayOfMonth: item.recurrence?.dayOfMonth
      ? String(item.recurrence.dayOfMonth)
      : "",
    interval: String(item.recurrence?.interval ?? 1),
    note: item.note ?? "",
    scheduleType: item.scheduleType,
    startsAt: toLocalDateTimeInput(item.scheduledAt),
    title: item.title,
    until: item.recurrence?.until
      ? toLocalDateTimeInput(item.recurrence.until)
      : "",
    version: item.version,
    weekdays: item.recurrence?.weekdays ? [...item.recurrence.weekdays] : [],
  };
}

async function saveEdit(item: ReminderSummary) {
  errorMessage.value = "";
  saving.value = true;
  try {
    await planner.updateReminder(item.id, {
      note: editForm.value.note || null,
      recurrence: buildRecurrence(editForm.value),
      scheduleType: editForm.value.scheduleType,
      startsAt: toShanghaiIso(editForm.value.startsAt),
      title: editForm.value.title,
      version: editForm.value.version,
    });
    successMessage.value = "提醒已更新";
    editingId.value = "";
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    saving.value = false;
  }
}

async function setStatus(
  item: ReminderSummary,
  status: "CANCELLED" | "SCHEDULED",
) {
  errorMessage.value = "";
  try {
    await planner.updateReminder(item.id, {
      status,
      version: item.version,
    });
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function remove(item: ReminderSummary) {
  errorMessage.value = "";
  try {
    await planner.deleteReminder(item.id);
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function restore(item: ReminderSummary) {
  errorMessage.value = "";
  try {
    await planner.restoreReminder(item.id);
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
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
  const index = form.value.weekdays.indexOf(day);
  if (index >= 0) {
    form.value.weekdays.splice(index, 1);
  } else {
    form.value.weekdays.push(day);
  }
}

function toggleEditWeekday(day: number) {
  const index = editForm.value.weekdays.indexOf(day);
  if (index >= 0) {
    editForm.value.weekdays.splice(index, 1);
  } else {
    editForm.value.weekdays.push(day);
  }
}

function scheduleLabel(item: ReminderSummary): string {
  if (item.scheduleType === "ONCE") {
    return "一次性";
  }
  if (item.scheduleType === "DAILY") {
    return `每 ${item.recurrence?.interval ?? 1} 天`;
  }
  if (item.scheduleType === "WEEKLY") {
    const days = item.recurrence?.weekdays?.length
      ? item.recurrence.weekdays.map(weekdayLabel).join("、")
      : "相同星期";
    return `每 ${item.recurrence?.interval ?? 1} 周（${days}）`;
  }
  return `每 ${item.recurrence?.interval ?? 1} 个月的 ${item.recurrence?.dayOfMonth ?? "同一天"} 日`;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    CANCELLED: "已取消",
    FAILED: "发送失败",
    SCHEDULED: "待发送",
    SENT: "已发送",
    SUPPRESSED: "已抑制",
  };
  return labels[status] ?? status;
}

function statusClass(status: string): string {
  const classes: Record<string, string> = {
    CANCELLED: "status-discarded",
    FAILED: "status-failed",
    SCHEDULED: "status-pending",
    SENT: "status-confirmed",
    SUPPRESSED: "status-discarded",
  };
  return classes[status] ?? "status-pending";
}

function weekdayLabel(day: number): string {
  return ["一", "二", "三", "四", "五", "六", "日"][day - 1] ?? String(day);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "网络异常，请稍后重试";
}
</script>

<template>
  <section class="planner-page" aria-labelledby="reminders-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">提醒</p>
        <h1 id="reminders-title">提醒设置</h1>
      </div>
      <div class="filters">
        <label>
          状态
          <select v-model="statusFilter">
            <option value="SCHEDULED">待发送</option>
            <option value="SENT">已发送</option>
            <option value="FAILED">发送失败</option>
            <option value="SUPPRESSED">已抑制</option>
            <option value="CANCELLED">已取消</option>
            <option value="">全部</option>
          </select>
        </label>
        <label class="check-label">
          <input v-model="includeDeleted" type="checkbox" />
          显示已删除
        </label>
      </div>
    </header>

    <p v-if="notificationStatus !== 'granted'" class="warning-banner">
      通知未开启：应用内提醒仍会保留，浏览器推送未授权。
    </p>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="form-success" role="status">
      {{ successMessage }}
    </p>

    <form class="planner-create" @submit.prevent="submit">
      <label class="planner-field">
        标题
        <input v-model="form.title" maxlength="200" required />
      </label>
      <label class="planner-field">
        备注（可选）
        <input v-model="form.note" maxlength="500" />
      </label>
      <label class="planner-field">
        重复
        <select v-model="form.scheduleType">
          <option value="ONCE">一次性</option>
          <option value="DAILY">每天</option>
          <option value="WEEKLY">每周</option>
          <option value="MONTHLY">每月</option>
        </select>
      </label>
      <label class="planner-field">
        首次时间
        <input v-model="form.startsAt" required type="datetime-local" />
      </label>
      <template v-if="form.scheduleType !== 'ONCE'">
        <label class="planner-field">
          间隔
          <input v-model="form.interval" max="366" min="1" type="number" />
        </label>
        <fieldset v-if="form.scheduleType === 'WEEKLY'" class="scope-fieldset">
          <legend>星期</legend>
          <label v-for="day in weekdays" :key="day" class="check-label">
            <input
              :checked="form.weekdays.includes(day)"
              type="checkbox"
              @change="toggleWeekday(day)"
            />
            周{{ weekdayLabel(day) }}
          </label>
        </fieldset>
        <label v-if="form.scheduleType === 'MONTHLY'" class="planner-field">
          每月几号
          <input v-model="form.dayOfMonth" max="31" min="1" type="number" />
        </label>
        <label class="planner-field">
          截止时间（可选）
          <input v-model="form.until" type="datetime-local" />
        </label>
      </template>
      <button class="primary-button" type="submit">新建提醒</button>
    </form>

    <p v-if="!planner.reminders.length" class="empty-copy">当前没有提醒。</p>
    <ul v-else class="resource-list">
      <li
        v-for="item in planner.reminders"
        :key="item.id"
        :class="{ 'is-deleted': item.deletedAt !== null }"
      >
        <template v-if="editingId === item.id">
          <form class="planner-edit" @submit.prevent="saveEdit(item)">
            <label class="planner-field">
              标题
              <input v-model="editForm.title" maxlength="200" required />
            </label>
            <label class="planner-field">
              备注（可选）
              <input v-model="editForm.note" maxlength="500" />
            </label>
            <label class="planner-field">
              重复
              <select v-model="editForm.scheduleType">
                <option value="ONCE">一次性</option>
                <option value="DAILY">每天</option>
                <option value="WEEKLY">每周</option>
                <option value="MONTHLY">每月</option>
              </select>
            </label>
            <label class="planner-field">
              首次时间
              <input
                v-model="editForm.startsAt"
                required
                type="datetime-local"
              />
            </label>
            <template v-if="editForm.scheduleType !== 'ONCE'">
              <label class="planner-field">
                间隔
                <input
                  v-model="editForm.interval"
                  max="366"
                  min="1"
                  type="number"
                />
              </label>
              <fieldset
                v-if="editForm.scheduleType === 'WEEKLY'"
                class="scope-fieldset"
              >
                <legend>星期</legend>
                <label v-for="day in weekdays" :key="day" class="check-label">
                  <input
                    :checked="editForm.weekdays.includes(day)"
                    type="checkbox"
                    @change="toggleEditWeekday(day)"
                  />
                  周{{ weekdayLabel(day) }}
                </label>
              </fieldset>
              <label
                v-if="editForm.scheduleType === 'MONTHLY'"
                class="planner-field"
              >
                每月几号
                <input
                  v-model="editForm.dayOfMonth"
                  max="31"
                  min="1"
                  type="number"
                />
              </label>
              <label class="planner-field">
                截止时间（可选）
                <input v-model="editForm.until" type="datetime-local" />
              </label>
            </template>
            <div class="planner-actions">
              <button class="primary-button" :disabled="saving" type="submit">
                保存
              </button>
              <button
                class="secondary-button"
                type="button"
                @click="editingId = ''"
              >
                取消
              </button>
            </div>
          </form>
        </template>
        <template v-else>
          <div class="planner-main">
            <strong>{{ item.title }}</strong>
            <small>下一次：{{ formatDateTime(item.scheduledAt) }}</small>
            <small>{{ scheduleLabel(item) }}</small>
            <span class="status-badge" :class="statusClass(item.status)">
              {{ statusLabel(item.status) }}
            </span>
            <small v-if="item.attemptCount > 0">
              尝试 {{ item.attemptCount }} 次
            </small>
            <small v-if="item.failureReason" class="overdue-mark">
              {{ item.failureReason }}
            </small>
            <span v-if="item.deletedAt" class="revoked-mark">已删除</span>
          </div>
          <div class="row-actions">
            <button
              v-if="
                !item.deletedAt &&
                item.status !== 'SENT' &&
                item.status !== 'CANCELLED'
              "
              class="text-button danger"
              type="button"
              @click="setStatus(item, 'CANCELLED')"
            >
              取消
            </button>
            <button
              v-if="!item.deletedAt && item.status === 'CANCELLED'"
              class="text-button"
              type="button"
              @click="setStatus(item, 'SCHEDULED')"
            >
              重新启用
            </button>
            <button
              v-if="!item.deletedAt && item.status !== 'SENT'"
              class="text-button"
              type="button"
              @click="startEdit(item)"
            >
              编辑
            </button>
            <button
              v-if="!item.deletedAt"
              class="text-button danger"
              type="button"
              @click="remove(item)"
            >
              删除
            </button>
            <button
              v-if="item.deletedAt"
              class="text-button"
              type="button"
              @click="restore(item)"
            >
              恢复
            </button>
          </div>
        </template>
      </li>
    </ul>
  </section>
</template>
