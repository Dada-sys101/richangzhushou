<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

import type { CalendarEventSummary } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import {
  addDays,
  formatDateTime,
  formatShanghaiDate,
  todayInShanghai,
  toLocalDateTimeInput,
  toShanghaiIso,
  toShanghaiIsoDate,
} from "../utils/time";

const auth = useAuthStore();
const planner = usePlannerStore();

const date = ref(todayInShanghai());
const includeDeleted = ref(false);
const editingId = ref("");
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const form = ref({
  allDay: false,
  endsAt: "",
  startsAt: "",
  title: "",
});
const allDayStart = ref(date.value);

const editForm = ref({
  allDay: false,
  endsAt: "",
  startsAt: "",
  status: "SCHEDULED" as "SCHEDULED" | "CANCELLED",
  title: "",
  version: 1,
});
const editAllDayStart = ref(date.value);

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
  }
});

watch([date, includeDeleted], () => {
  void reload();
});

async function reload() {
  await planner.loadCalendarEvents({
    date: date.value,
    includeDeleted: includeDeleted.value || undefined,
  });
}

async function submit() {
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const startsAt = form.value.allDay
      ? toShanghaiIsoDate(allDayStart.value)
      : toShanghaiIso(form.value.startsAt);
    const endsAt = form.value.allDay
      ? toShanghaiIsoDate(addDays(allDayStart.value, 1))
      : toShanghaiIso(form.value.endsAt);
    const result = await planner.createCalendarEvent({
      allDay: form.value.allDay,
      endsAt,
      startsAt,
      title: form.value.title,
    });
    successMessage.value = result.overlapWarning
      ? result.overlapWarning.message
      : "日程已创建";
    form.value = { allDay: false, endsAt: "", startsAt: "", title: "" };
    allDayStart.value = date.value;
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function startEdit(item: CalendarEventSummary) {
  editingId.value = item.id;
  editForm.value = {
    allDay: item.allDay,
    endsAt: item.allDay ? "" : toLocalDateTimeInput(item.endsAt),
    startsAt: item.allDay ? "" : toLocalDateTimeInput(item.startsAt),
    status: item.status,
    title: item.title,
    version: item.version,
  };
  editAllDayStart.value = item.allDay
    ? formatShanghaiDate(new Date(item.startsAt))
    : date.value;
}

async function saveEdit(item: CalendarEventSummary) {
  errorMessage.value = "";
  successMessage.value = "";
  saving.value = true;
  try {
    const startsAt = editForm.value.allDay
      ? toShanghaiIsoDate(editAllDayStart.value)
      : toShanghaiIso(editForm.value.startsAt);
    const endsAt = editForm.value.allDay
      ? toShanghaiIsoDate(addDays(editAllDayStart.value, 1))
      : toShanghaiIso(editForm.value.endsAt);
    const result = await planner.updateCalendarEvent(item.id, {
      allDay: editForm.value.allDay,
      endsAt,
      startsAt,
      status: editForm.value.status,
      title: editForm.value.title,
      version: editForm.value.version,
    });
    successMessage.value = result.overlapWarning
      ? result.overlapWarning.message
      : "日程已更新";
    editingId.value = "";
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    saving.value = false;
  }
}

async function remove(item: CalendarEventSummary) {
  errorMessage.value = "";
  try {
    await planner.deleteCalendarEvent(item.id);
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function restore(item: CalendarEventSummary) {
  errorMessage.value = "";
  try {
    await planner.restoreCalendarEvent(item.id);
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function cancelEdit() {
  editingId.value = "";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "网络异常，请稍后重试";
}
</script>

<template>
  <section class="planner-page" aria-labelledby="calendar-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">日程</p>
        <h1 id="calendar-title">日历</h1>
      </div>
      <div class="filters">
        <label>
          日期
          <input v-model="date" type="date" />
        </label>
        <label class="check-label">
          <input v-model="includeDeleted" type="checkbox" />
          显示已删除
        </label>
      </div>
    </header>

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
      <label class="check-label">
        <input v-model="form.allDay" type="checkbox" />
        全天
      </label>
      <label v-if="form.allDay" class="planner-field">
        日期
        <input v-model="allDayStart" type="date" required />
      </label>
      <template v-else>
        <label class="planner-field">
          开始
          <input v-model="form.startsAt" required type="datetime-local" />
        </label>
        <label class="planner-field">
          结束
          <input v-model="form.endsAt" required type="datetime-local" />
        </label>
      </template>
      <button class="primary-button" type="submit">新建日程</button>
    </form>

    <p v-if="!planner.calendarEvents.length" class="empty-copy">
      当天没有日程。
    </p>
    <ul v-else class="resource-list">
      <li
        v-for="item in planner.calendarEvents"
        :key="item.id"
        :class="{ 'is-deleted': item.deletedAt !== null }"
      >
        <template v-if="editingId === item.id">
          <form class="planner-edit" @submit.prevent="saveEdit(item)">
            <label class="planner-field">
              标题
              <input v-model="editForm.title" maxlength="200" required />
            </label>
            <label class="check-label">
              <input v-model="editForm.allDay" type="checkbox" />
              全天
            </label>
            <label v-if="editForm.allDay" class="planner-field">
              日期
              <input v-model="editAllDayStart" type="date" required />
            </label>
            <template v-else>
              <label class="planner-field">
                开始
                <input
                  v-model="editForm.startsAt"
                  required
                  type="datetime-local"
                />
              </label>
              <label class="planner-field">
                结束
                <input
                  v-model="editForm.endsAt"
                  required
                  type="datetime-local"
                />
              </label>
            </template>
            <label class="planner-field">
              状态
              <select v-model="editForm.status">
                <option value="SCHEDULED">已安排</option>
                <option value="CANCELLED">已取消</option>
              </select>
            </label>
            <div class="planner-actions">
              <button class="primary-button" :disabled="saving" type="submit">
                保存
              </button>
              <button
                class="secondary-button"
                type="button"
                @click="cancelEdit"
              >
                取消
              </button>
            </div>
          </form>
        </template>
        <template v-else>
          <div class="planner-main">
            <strong>{{ item.title }}</strong>
            <small v-if="item.allDay"
              >全天 · {{ item.startsAt.slice(0, 10) }}</small
            >
            <small v-else>
              {{ formatDateTime(item.startsAt) }} –
              {{ formatDateTime(item.endsAt) }}
            </small>
            <span
              class="status-badge"
              :class="
                item.status === 'CANCELLED'
                  ? 'status-discarded'
                  : 'status-pending'
              "
            >
              {{ item.status === "CANCELLED" ? "已取消" : "已安排" }}
            </span>
            <span v-if="item.deletedAt" class="revoked-mark">已删除</span>
          </div>
          <div class="row-actions">
            <button
              v-if="!item.deletedAt"
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
