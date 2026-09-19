<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  onBeforeRouteUpdate,
  RouterLink,
  useRoute,
  useRouter,
} from "vue-router";

import type { CalendarEventSummary } from "../api/client";
import DateField from "../components/DateField.vue";
import DateTimeField from "../components/DateTimeField.vue";
import EmptyState from "../components/EmptyState.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import SectionCard from "../components/SectionCard.vue";
import {
  hasUnsavedChanges,
  useUnsavedChanges,
} from "../composables/useUnsavedChanges";
import { requestAppConfirm } from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import { appendReturnTo } from "../utils/navigation";
import {
  addDays,
  formatDateTime,
  formatShanghaiDate,
  todayInShanghai,
  toLocalDateTimeInput,
  toShanghaiIso,
  toShanghaiIsoDate,
} from "../utils/time";

type CalendarStatus = "SCHEDULED" | "CANCELLED";
type RowAction = "delete" | "restore";

const auth = useAuthStore();
const planner = usePlannerStore();
const route = useRoute();
const router = useRouter();

const date = ref(readDateQuery(route.query.date));
const includeDeleted = ref(readIncludeDeletedQuery(route.query.includeDeleted));
const visibleEvents = ref<CalendarEventSummary[]>([]);
const loadedQueryKey = ref<string | null>(null);
const loading = ref(false);
const loadError = ref("");
let loadSequence = 0;

const editingId = ref("");
const savingId = ref<string | null>(null);
const rowActions = ref<Record<string, RowAction | undefined>>({});
const creating = ref(false);
const actionError = ref("");
const successMessage = ref("");
const overlapMessage = ref("");

const form = ref(createForm());
const allDayStart = ref(date.value);
const editForm = ref(createEditForm());
const editAllDayStart = ref(date.value);
const editSnapshot = ref("");

const currentQueryKey = computed(() =>
  calendarQueryKey(date.value, includeDeleted.value),
);
const hasLoadedCurrent = computed(
  () => loadedQueryKey.value === currentQueryKey.value,
);
const isInitialLoading = computed(
  () => loading.value && !hasLoadedCurrent.value,
);
const isRefreshing = computed(() => loading.value && hasLoadedCurrent.value);
const currentEvents = computed(() =>
  hasLoadedCurrent.value ? visibleEvents.value : [],
);
const scheduledCount = computed(
  () =>
    currentEvents.value.filter((item) => item.status === "SCHEDULED").length,
);
const cancelledCount = computed(
  () =>
    currentEvents.value.filter((item) => item.status === "CANCELLED").length,
);
const deletedCount = computed(
  () => currentEvents.value.filter((item) => Boolean(item.deletedAt)).length,
);
const newFormDirty = computed(
  () =>
    Boolean(form.value.title.trim()) ||
    Boolean(form.value.startsAt) ||
    Boolean(form.value.endsAt) ||
    form.value.allDay ||
    (form.value.allDay && allDayStart.value !== date.value),
);
const editDirty = computed(
  () =>
    Boolean(editingId.value) && calendarEditSnapshot() !== editSnapshot.value,
);
const pageDirty = computed(() => newFormDirty.value || editDirty.value);

useUnsavedChanges(pageDirty);

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
  }
});

watch([date, includeDeleted], () => {
  void reload();
});

onBeforeRouteUpdate(async (to) => {
  if (to.path !== route.path) {
    return true;
  }

  const nextDate = readDateQuery(to.query.date);
  const nextIncludeDeleted = readIncludeDeletedQuery(to.query.includeDeleted);
  if (nextDate === date.value && nextIncludeDeleted === includeDeleted.value) {
    return true;
  }

  if (hasUnsavedChanges.value) {
    const confirmed = await confirmContextChange("切换日期或筛选");
    if (!confirmed) {
      return false;
    }
    discardLocalChanges();
  }

  date.value = nextDate;
  includeDeleted.value = nextIncludeDeleted;
  allDayStart.value = nextDate;
  return true;
});

async function reload(): Promise<boolean> {
  const requestedDate = date.value;
  const requestedIncludeDeleted = includeDeleted.value;
  const requestedKey = calendarQueryKey(requestedDate, requestedIncludeDeleted);
  const sequence = ++loadSequence;

  loading.value = true;
  loadError.value = "";
  planner.clearError();

  try {
    await planner.loadCalendarEvents({
      date: requestedDate,
      includeDeleted: requestedIncludeDeleted || undefined,
    });
  } catch (error) {
    if (isCurrentLoad(sequence, requestedKey)) {
      loadError.value = messageOf(error);
    }
    return false;
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }

  if (!isCurrentLoad(sequence, requestedKey)) {
    return false;
  }

  const storeError = planner.errorMessage?.trim()
    ? planner.errorMessage
    : planner.errorKind
      ? "日程暂时无法加载，请稍后重试"
      : "";
  if (storeError) {
    loadError.value = storeError;
    return false;
  }

  visibleEvents.value = [...planner.calendarEvents];
  loadedQueryKey.value = requestedKey;
  loadError.value = "";
  return true;
}

async function handleDateChange(nextDate: string) {
  if (!isValidDate(nextDate) || nextDate === date.value) {
    return;
  }
  await applyContextChange(nextDate, includeDeleted.value);
}

async function handleIncludeDeletedChange(event: Event) {
  const nextIncludeDeleted = (event.currentTarget as HTMLInputElement).checked;
  if (nextIncludeDeleted === includeDeleted.value) {
    return;
  }
  await applyContextChange(date.value, nextIncludeDeleted);
}

async function applyContextChange(
  nextDate: string,
  nextIncludeDeleted: boolean,
) {
  if (nextDate === date.value && nextIncludeDeleted === includeDeleted.value) {
    return;
  }

  if (hasUnsavedChanges.value) {
    const confirmed = await confirmContextChange("切换日期或筛选");
    if (!confirmed) {
      return;
    }
    discardLocalChanges();
  }

  date.value = nextDate;
  includeDeleted.value = nextIncludeDeleted;
  allDayStart.value = nextDate;
  syncQuery();
}

async function submit() {
  if (creating.value) {
    return;
  }

  clearActionFeedback();
  creating.value = true;
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

    successMessage.value = "日程已创建";
    overlapMessage.value = result?.overlapWarning?.message ?? "";
    resetCreateForm();
    await reportRefreshFailure("日程已创建");
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    creating.value = false;
  }
}

async function startEdit(item: CalendarEventSummary) {
  if (item.deletedAt || savingId.value || rowActions.value[item.id]) {
    return;
  }

  if (editingId.value && editingId.value !== item.id && editDirty.value) {
    const confirmed = await requestAppConfirm({
      cancelLabel: "留在当前编辑",
      confirmLabel: "切换编辑",
      description:
        "当前日程有未保存内容，切换编辑对象会放弃这些修改。是否继续？",
      destructive: true,
      title: "放弃未保存的内容？",
    });
    if (!confirmed) {
      return;
    }
    cancelEdit();
  } else if (editingId.value && editingId.value !== item.id) {
    cancelEdit();
  }

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
  editSnapshot.value = calendarEditSnapshot();
}

async function saveEdit(item: CalendarEventSummary) {
  if (savingId.value || editingId.value !== item.id) {
    return;
  }

  clearActionFeedback();
  savingId.value = item.id;
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

    successMessage.value = "日程已更新";
    overlapMessage.value = result?.overlapWarning?.message ?? "";
    cancelEdit();
    await reportRefreshFailure("日程已更新");
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    savingId.value = null;
  }
}

async function remove(item: CalendarEventSummary) {
  if (item.deletedAt || rowActions.value[item.id]) {
    return;
  }

  const confirmed = await requestAppConfirm({
    cancelLabel: "保留日程",
    confirmLabel: "删除",
    description: `确定删除日程“${item.title}”吗？删除后仍可在“显示已删除”中恢复。`,
    destructive: true,
    title: "删除日程？",
  });
  if (!confirmed || rowActions.value[item.id]) {
    return;
  }

  clearActionFeedback();
  setRowAction(item.id, "delete");
  try {
    await planner.deleteCalendarEvent(item.id);
    await reportRefreshFailure("日程已删除");
    if (!loadError.value) {
      successMessage.value = "日程已删除";
    }
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    setRowAction(item.id, undefined);
  }
}

async function restore(item: CalendarEventSummary) {
  if (!item.deletedAt || rowActions.value[item.id]) {
    return;
  }

  clearActionFeedback();
  setRowAction(item.id, "restore");
  try {
    await planner.restoreCalendarEvent(item.id);
    await reportRefreshFailure("日程已恢复");
    if (!loadError.value) {
      successMessage.value = "日程已恢复";
    }
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    setRowAction(item.id, undefined);
  }
}

function cancelEdit() {
  editingId.value = "";
  editSnapshot.value = "";
  editForm.value = createEditForm();
  editAllDayStart.value = date.value;
}

function discardLocalChanges() {
  resetCreateForm();
  cancelEdit();
}

function resetCreateForm() {
  form.value = createForm();
  allDayStart.value = date.value;
}

function clearActionFeedback() {
  actionError.value = "";
  successMessage.value = "";
  overlapMessage.value = "";
}

async function reportRefreshFailure(successText: string) {
  const refreshed = await reload();
  if (!refreshed && loadError.value) {
    actionError.value = `${successText}，但列表刷新失败，请点击“重试”确认最新状态。`;
  }
}

async function retryLoad() {
  await reload();
}

async function confirmContextChange(action: string): Promise<boolean> {
  return requestAppConfirm({
    cancelLabel: "留在当前页面",
    confirmLabel: "继续切换",
    description: `当前页面有未保存内容，${action}会放弃这些修改。是否继续？`,
    destructive: true,
    title: "放弃未保存的内容？",
  });
}

function setRowAction(id: string, action: RowAction | undefined) {
  const next = { ...rowActions.value };
  if (action) {
    next[id] = action;
  } else {
    delete next[id];
  }
  rowActions.value = next;
}

function isRowBusy(id: string): boolean {
  return Boolean(rowActions.value[id]);
}

function calendarEditSnapshot(): string {
  return JSON.stringify({
    allDay: editForm.value.allDay,
    day: editAllDayStart.value,
    endsAt: editForm.value.endsAt,
    startsAt: editForm.value.startsAt,
    status: editForm.value.status,
    title: editForm.value.title,
  });
}

function isCurrentLoad(sequence: number, requestedKey: string): boolean {
  return sequence === loadSequence && requestedKey === currentQueryKey.value;
}

function syncQuery() {
  void router.replace({
    query: {
      ...route.query,
      date: date.value,
      includeDeleted: includeDeleted.value ? "true" : undefined,
    },
  });
}

function withCalendarSource(path: string) {
  return appendReturnTo(path, route.fullPath || "/calendar");
}

function eventTime(item: CalendarEventSummary): string {
  if (item.allDay) {
    return `全天 · ${formatShanghaiDate(new Date(item.startsAt))}`;
  }
  return `${formatDateTime(item.startsAt)} – ${formatDateTime(item.endsAt)}`;
}

function overviewDate(value: string): string {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    weekday: "short",
    year: "numeric",
  }).format(instant);
}

function statusLabel(status: CalendarStatus): string {
  return status === "CANCELLED" ? "已取消" : "已安排";
}

function statusClass(status: CalendarStatus): string {
  return status === "CANCELLED" ? "status-discarded" : "status-pending";
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "网络异常，请稍后重试";
}

function createForm() {
  return {
    allDay: false,
    endsAt: "",
    startsAt: "",
    title: "",
  };
}

function createEditForm() {
  return {
    allDay: false,
    endsAt: "",
    startsAt: "",
    status: "SCHEDULED" as CalendarStatus,
    title: "",
    version: 1,
  };
}

function calendarQueryKey(value: string, showDeleted: boolean): string {
  return `${value}|${showDeleted ? "deleted" : "active"}`;
}

function readDateQuery(value: unknown): string {
  return isValidDate(value) ? value : todayInShanghai();
}

function readIncludeDeletedQuery(value: unknown): boolean {
  return value === "true" || value === "1";
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
</script>

<template>
  <SecondaryPageShell
    class="planner-page planner-workspace calendar-workspace"
    title="日历"
    title-id="calendar-title"
    subtitle="日程"
  >
    <template #actions>
      <div class="calendar-toolbar">
        <label class="secondary-page-filter calendar-date-filter">
          <span>日期</span>
          <DateField
            :model-value="date"
            required
            @update:model-value="handleDateChange"
          />
        </label>
        <label class="check-label calendar-deleted-filter">
          <input
            :checked="includeDeleted"
            aria-label="显示已删除"
            type="checkbox"
            @change="handleIncludeDeletedChange"
          />
          <span>显示已删除</span>
        </label>
      </div>
    </template>

    <SectionCard
      class="calendar-overview-card"
      title="当日概览"
      description="选择日期后，快速查看当天安排并处理日程。"
    >
      <div class="calendar-overview-grid">
        <div>
          <span>当前日期</span>
          <strong>{{ overviewDate(date) }}</strong>
        </div>
        <div>
          <span>日程总数</span>
          <strong>{{ currentEvents.length }}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>
            {{ scheduledCount }} 项已安排<span v-if="cancelledCount">
              · {{ cancelledCount }} 项已取消</span
            >
          </strong>
        </div>
      </div>
      <p v-if="includeDeleted && deletedCount" class="calendar-overview-note">
        当前包含 {{ deletedCount }} 项已删除日程。
      </p>
    </SectionCard>

    <p
      v-if="actionError"
      class="planner-feedback planner-feedback-error"
      role="alert"
    >
      {{ actionError }}
    </p>
    <p
      v-if="successMessage"
      class="planner-feedback planner-feedback-success"
      role="status"
    >
      {{ successMessage }}
    </p>
    <p
      v-if="overlapMessage"
      class="planner-feedback planner-feedback-warning"
      role="status"
    >
      时间与已有日程重叠：{{ overlapMessage }}
    </p>

    <SectionCard
      title="新建日程"
      description="填写标题和时间，可选择全天日程。"
      class="planner-create-card calendar-create-card"
    >
      <form class="planner-create" @submit.prevent="submit">
        <label class="planner-field">
          <span>标题</span>
          <input
            v-model="form.title"
            aria-label="新建日程标题"
            maxlength="200"
            required
          />
        </label>
        <label class="check-label calendar-all-day-field">
          <input
            v-model="form.allDay"
            aria-label="新建全天日程"
            type="checkbox"
          />
          <span>全天</span>
        </label>
        <label v-if="form.allDay" class="planner-field">
          <span>日期</span>
          <DateField v-model="allDayStart" required />
        </label>
        <template v-else>
          <label class="planner-field">
            <span>开始时间</span>
            <DateTimeField v-model="form.startsAt" required />
          </label>
          <label class="planner-field">
            <span>结束时间</span>
            <DateTimeField
              v-model="form.endsAt"
              :min="form.startsAt"
              required
            />
          </label>
        </template>
        <button class="primary-button" :disabled="creating" type="submit">
          {{ creating ? "创建中…" : "新建日程" }}
        </button>
      </form>
    </SectionCard>

    <SectionCard
      title="当日日程"
      description="按时间查看、编辑或管理当天安排。"
      class="planner-list-card calendar-list-card"
    >
      <LoadingState
        v-if="isInitialLoading"
        description="正在获取当前日期的日程。"
        title="正在加载日程…"
      />
      <ErrorState
        v-else-if="loadError && !hasLoadedCurrent"
        action-label="重试"
        :description="loadError"
        title="日程暂时无法加载"
        @retry="retryLoad"
      />
      <template v-else>
        <LoadingState
          v-if="isRefreshing"
          class="calendar-refresh-state"
          description="当前列表仍可查看，刷新完成后会更新。"
          title="正在更新日程…"
        />
        <div
          v-if="loadError && hasLoadedCurrent"
          class="calendar-stale-warning"
          role="alert"
        >
          <span>{{ loadError }} 当前显示的是上次成功加载的日程。</span>
          <button class="secondary-button" type="button" @click="retryLoad">
            重试
          </button>
        </div>

        <EmptyState
          v-if="hasLoadedCurrent && currentEvents.length === 0 && !isRefreshing"
          description="当天还没有日程，可以在上方新建一条安排。"
          icon="calendar"
          title="当天没有日程"
        />
        <ul v-else-if="currentEvents.length" class="resource-list">
          <li
            v-for="item in currentEvents"
            :key="item.id"
            class="calendar-event-row"
            :class="{ 'is-deleted': item.deletedAt !== null }"
          >
            <template v-if="editingId === item.id">
              <form
                class="planner-edit calendar-edit-form"
                @submit.prevent="saveEdit(item)"
              >
                <label class="planner-field">
                  <span>标题</span>
                  <input
                    v-model="editForm.title"
                    aria-label="编辑日程标题"
                    maxlength="200"
                    required
                  />
                </label>
                <label class="check-label calendar-all-day-field">
                  <input
                    v-model="editForm.allDay"
                    aria-label="编辑全天日程"
                    type="checkbox"
                  />
                  <span>全天</span>
                </label>
                <label v-if="editForm.allDay" class="planner-field">
                  <span>日期</span>
                  <DateField v-model="editAllDayStart" required />
                </label>
                <template v-else>
                  <label class="planner-field">
                    <span>开始时间</span>
                    <DateTimeField v-model="editForm.startsAt" required />
                  </label>
                  <label class="planner-field">
                    <span>结束时间</span>
                    <DateTimeField
                      v-model="editForm.endsAt"
                      :min="editForm.startsAt"
                      required
                    />
                  </label>
                </template>
                <label class="planner-field">
                  <span>状态</span>
                  <select v-model="editForm.status" aria-label="编辑日程状态">
                    <option value="SCHEDULED">已安排</option>
                    <option value="CANCELLED">已取消</option>
                  </select>
                </label>
                <div class="planner-actions">
                  <button
                    class="primary-button"
                    :disabled="savingId === item.id"
                    type="submit"
                  >
                    {{ savingId === item.id ? "保存中…" : "保存" }}
                  </button>
                  <button
                    class="secondary-button"
                    :disabled="savingId === item.id"
                    type="button"
                    @click="cancelEdit"
                  >
                    取消编辑
                  </button>
                </div>
              </form>
            </template>
            <template v-else>
              <div class="planner-main calendar-event-main">
                <div class="calendar-event-heading">
                  <strong class="calendar-event-title">{{ item.title }}</strong>
                  <span class="status-badge" :class="statusClass(item.status)">
                    {{ statusLabel(item.status) }}
                  </span>
                  <span v-if="item.deletedAt" class="revoked-mark">已删除</span>
                </div>
                <small class="calendar-event-time">{{ eventTime(item) }}</small>
              </div>
              <div class="row-actions calendar-row-actions">
                <button
                  v-if="!item.deletedAt"
                  class="text-button"
                  :disabled="isRowBusy(item.id)"
                  type="button"
                  @click="startEdit(item)"
                >
                  编辑
                </button>
                <button
                  v-if="!item.deletedAt"
                  class="text-button danger"
                  :disabled="isRowBusy(item.id)"
                  type="button"
                  @click="remove(item)"
                >
                  {{ rowActions[item.id] === "delete" ? "删除中…" : "删除" }}
                </button>
                <RouterLink
                  class="text-button"
                  :to="withCalendarSource(`/calendar/${item.id}`)"
                >
                  查看
                </RouterLink>
                <button
                  v-if="item.deletedAt"
                  class="text-button"
                  :disabled="isRowBusy(item.id)"
                  type="button"
                  @click="restore(item)"
                >
                  {{ rowActions[item.id] === "restore" ? "恢复中…" : "恢复" }}
                </button>
              </div>
            </template>
          </li>
        </ul>
      </template>
    </SectionCard>
  </SecondaryPageShell>
</template>
