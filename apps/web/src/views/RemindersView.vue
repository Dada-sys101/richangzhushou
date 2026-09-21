<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";

import type {
  ReminderRecurrence,
  ReminderScheduleType,
  ReminderStatus,
  ReminderSummary,
} from "../api/client";
import { api } from "../api/client";
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
  formatDateTime,
  toLocalDateTimeInput,
  toShanghaiIso,
} from "../utils/time";

type StatusFilter = ReminderStatus | "";
type RowAction = "cancel" | "delete" | "restore" | "reschedule";
type PushMode =
  | "available"
  | "checking"
  | "denied"
  | "enabled"
  | "error"
  | "unconfigured"
  | "unsupported";

interface ReminderForm {
  dayOfMonth: string;
  interval: string;
  note: string;
  scheduleType: ReminderScheduleType;
  startsAt: string;
  title: string;
  until: string;
  weekdays: number[];
}

interface ReminderEditForm extends ReminderForm {
  version: number;
}

const auth = useAuthStore();
const planner = usePlannerStore();
const route = useRoute();

const statusFilter = ref<StatusFilter>("SCHEDULED");
const includeDeleted = ref(false);
const visibleReminders = ref<ReminderSummary[]>([]);
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

const pushMode = ref<PushMode>("checking");
const pushError = ref("");
const pushLoading = ref(false);
const pushPublicKey = ref<string | null>(null);
const activeSubscription = ref<PushSubscription | null>(null);

const weekdays = [1, 2, 3, 4, 5, 6, 7];
const form = ref<ReminderForm>(createReminderForm());
const editForm = ref<ReminderEditForm>(createEditForm());
const editSnapshot = ref("");

const currentQueryKey = computed(() =>
  reminderQueryKey(statusFilter.value, includeDeleted.value),
);
const hasLoadedCurrent = computed(
  () => loadedQueryKey.value === currentQueryKey.value,
);
const isInitialLoading = computed(
  () => loading.value && !hasLoadedCurrent.value,
);
const isRefreshing = computed(() => loading.value && hasLoadedCurrent.value);
const currentReminders = computed(() =>
  hasLoadedCurrent.value ? visibleReminders.value : [],
);
const filterSummary = computed(() => {
  const status = statusFilter.value
    ? `状态为“${statusLabel(statusFilter.value)}”`
    : "全部状态";
  const deleted = includeDeleted.value ? "包含已删除" : "不含已删除";
  return `当前筛选：${status}，${deleted}。`;
});
const newFormDirty = computed(
  () =>
    reminderFormSnapshot(form.value) !==
    reminderFormSnapshot(createReminderForm()),
);
const editDirty = computed(
  () =>
    Boolean(editingId.value) && reminderEditSnapshot() !== editSnapshot.value,
);
const pageDirty = computed(() => newFormDirty.value || editDirty.value);
const canTogglePush = computed(
  () =>
    pushMode.value === "available" ||
    pushMode.value === "denied" ||
    pushMode.value === "enabled",
);

useUnsavedChanges(pageDirty);

onMounted(() => {
  if (!auth.isAuthenticated) return;
  void reload();
  void loadPushStatus();
});

async function reload(): Promise<boolean> {
  const requestedStatus = statusFilter.value;
  const requestedIncludeDeleted = includeDeleted.value;
  const requestedKey = reminderQueryKey(
    requestedStatus,
    requestedIncludeDeleted,
  );
  const sequence = ++loadSequence;

  loading.value = true;
  loadError.value = "";
  planner.clearError();

  try {
    await planner.loadReminders({
      includeDeleted: requestedIncludeDeleted || undefined,
      status: requestedStatus || undefined,
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

  if (!isCurrentLoad(sequence, requestedKey)) return false;

  const storeError = planner.errorMessage?.trim()
    ? planner.errorMessage
    : planner.errorKind
      ? "提醒暂时无法加载，请稍后重试"
      : "";
  if (storeError) {
    loadError.value = storeError;
    return false;
  }

  visibleReminders.value = filterReminders(
    planner.reminders,
    requestedStatus,
    requestedIncludeDeleted,
  );
  loadedQueryKey.value = requestedKey;
  loadError.value = "";
  return true;
}

async function handleStatusChange(event: Event) {
  const target = event.currentTarget as HTMLSelectElement;
  const changed = await applyFilterChange(
    readStatusFilter(target.value),
    includeDeleted.value,
  );
  if (!changed) target.value = statusFilter.value;
}

async function handleIncludeDeletedChange(event: Event) {
  const target = event.currentTarget as HTMLInputElement;
  const changed = await applyFilterChange(statusFilter.value, target.checked);
  if (!changed) target.checked = includeDeleted.value;
}

async function applyFilterChange(
  nextStatus: StatusFilter,
  nextIncludeDeleted: boolean,
): Promise<boolean> {
  if (
    nextStatus === statusFilter.value &&
    nextIncludeDeleted === includeDeleted.value
  ) {
    return true;
  }

  if (hasUnsavedChanges.value) {
    const confirmed = await confirmContextChange("切换筛选");
    if (!confirmed) return false;
    discardLocalChanges();
  }

  clearActionFeedback();
  statusFilter.value = nextStatus;
  includeDeleted.value = nextIncludeDeleted;
  await reload();
  return true;
}

async function submit() {
  if (creating.value) return;

  const validationError = validateReminderForm(form.value);
  if (validationError) {
    clearActionFeedback();
    actionError.value = validationError;
    return;
  }

  clearActionFeedback();
  creating.value = true;
  try {
    await planner.createReminder({
      note: form.value.note || null,
      recurrence: buildRecurrence(form.value),
      scheduleType: form.value.scheduleType,
      startsAt: toShanghaiIso(form.value.startsAt),
      title: form.value.title,
    });

    const successText =
      statusFilter.value && statusFilter.value !== "SCHEDULED"
        ? "提醒已创建；当前筛选不会显示这条待发送提醒。"
        : "提醒已创建";
    resetCreateForm();
    await reportRefreshFailure(successText);
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    creating.value = false;
  }
}

async function startEdit(item: ReminderSummary) {
  if (
    item.deletedAt ||
    item.status === "SENT" ||
    savingId.value ||
    rowActions.value[item.id]
  ) {
    return;
  }

  if (editingId.value && editingId.value !== item.id && editDirty.value) {
    const confirmed = await requestAppConfirm({
      cancelLabel: "留在当前编辑",
      confirmLabel: "切换编辑",
      description:
        "当前提醒有未保存内容，切换编辑对象会放弃这些修改。是否继续？",
      destructive: true,
      title: "放弃未保存的内容？",
    });
    if (!confirmed) return;
  }
  if (editingId.value && editingId.value !== item.id) cancelEdit();

  clearActionFeedback();
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
  editSnapshot.value = reminderEditSnapshot();
}

async function saveEdit(item: ReminderSummary) {
  if (savingId.value || editingId.value !== item.id) return;

  const validationError = validateReminderForm(editForm.value);
  if (validationError) {
    clearActionFeedback();
    actionError.value = validationError;
    return;
  }

  clearActionFeedback();
  savingId.value = item.id;
  try {
    await planner.updateReminder(item.id, {
      note: editForm.value.note || null,
      recurrence: buildRecurrence(editForm.value),
      scheduleType: editForm.value.scheduleType,
      startsAt: toShanghaiIso(editForm.value.startsAt),
      title: editForm.value.title,
      version: editForm.value.version,
    });
    cancelEdit();
    await reportRefreshFailure("提醒已更新");
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    savingId.value = null;
  }
}

function cancelEdit() {
  editingId.value = "";
  editSnapshot.value = "";
  editForm.value = createEditForm();
}

async function setStatus(
  item: ReminderSummary,
  status: "CANCELLED" | "SCHEDULED",
) {
  if (item.deletedAt || rowActions.value[item.id]) return;
  if (
    status === "CANCELLED" &&
    (item.status === "SENT" || item.status === "CANCELLED")
  ) {
    return;
  }
  if (status === "SCHEDULED" && item.status !== "CANCELLED") return;

  clearActionFeedback();
  setRowAction(item.id, status === "CANCELLED" ? "cancel" : "reschedule");
  try {
    await planner.updateReminder(item.id, { status, version: item.version });
    await reportRefreshFailure(
      status === "CANCELLED" ? "提醒已取消" : "提醒已重新启用",
    );
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    setRowAction(item.id, undefined);
  }
}

async function remove(item: ReminderSummary) {
  if (item.deletedAt || rowActions.value[item.id]) return;

  const confirmed = await requestAppConfirm({
    cancelLabel: "保留提醒",
    confirmLabel: "删除",
    description: `确定删除提醒“${item.title}”吗？删除后仍可在“显示已删除”中恢复。`,
    destructive: true,
    title: "删除提醒？",
  });
  if (!confirmed || rowActions.value[item.id]) return;

  clearActionFeedback();
  setRowAction(item.id, "delete");
  try {
    await planner.deleteReminder(item.id);
    await reportRefreshFailure("提醒已删除");
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    setRowAction(item.id, undefined);
  }
}

async function restore(item: ReminderSummary) {
  if (!item.deletedAt || rowActions.value[item.id]) return;

  clearActionFeedback();
  setRowAction(item.id, "restore");
  try {
    await planner.restoreReminder(item.id);
    await reportRefreshFailure("提醒已恢复");
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    setRowAction(item.id, undefined);
  }
}

function discardLocalChanges() {
  resetCreateForm();
  cancelEdit();
}

function resetCreateForm() {
  form.value = createReminderForm();
}

function clearActionFeedback() {
  actionError.value = "";
  successMessage.value = "";
}

async function reportRefreshFailure(successText: string) {
  const refreshed = await reload();
  if (refreshed) {
    successMessage.value = successText;
  } else if (loadError.value) {
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
  if (action) next[id] = action;
  else delete next[id];
  rowActions.value = next;
}

function isRowBusy(id: string): boolean {
  return Boolean(rowActions.value[id]);
}

async function loadPushStatus() {
  pushError.value = "";
  pushMode.value = "checking";

  if (!hasBrowserPushSupport()) {
    pushMode.value = "unsupported";
    return;
  }

  try {
    const status = await api.getPushStatus();
    pushPublicKey.value = status.publicKey;
    if (!status.enabled || !status.publicKey) {
      activeSubscription.value = null;
      pushMode.value = "unconfigured";
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    activeSubscription.value = await registration.pushManager.getSubscription();
    if (activeSubscription.value) {
      pushMode.value = "enabled";
    } else {
      pushMode.value =
        Notification.permission === "denied" ? "denied" : "available";
    }
  } catch (error) {
    pushMode.value = "error";
    pushError.value = `应用外提醒状态加载失败：${messageOf(error)}`;
  }
}

async function togglePush() {
  if (pushLoading.value || !canTogglePush.value) return;

  successMessage.value = "";
  pushError.value = "";
  pushLoading.value = true;
  let createdSubscription: PushSubscription | null = null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing =
      activeSubscription.value ??
      (await registration.pushManager.getSubscription());

    if (existing) {
      await api.deletePushSubscription(existing.endpoint);
      await existing.unsubscribe();
      activeSubscription.value = null;
      pushMode.value =
        Notification.permission === "denied" ? "denied" : "available";
      successMessage.value = "应用外提醒已关闭";
      return;
    }

    if (!pushPublicKey.value) throw new Error("应用外提醒尚未配置");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      pushMode.value = "denied";
      pushError.value = "需要允许系统通知才能开启";
      return;
    }

    createdSubscription = await registration.pushManager.subscribe({
      applicationServerKey: base64UrlToBytes(pushPublicKey.value),
      userVisibleOnly: true,
    });
    const json = createdSubscription.toJSON();
    if (!json.endpoint || !json.keys?.auth || !json.keys.p256dh) {
      throw new Error("浏览器未返回完整的通知订阅");
    }
    await api.savePushSubscription({
      endpoint: json.endpoint,
      keys: { auth: json.keys.auth, p256dh: json.keys.p256dh },
    });
    activeSubscription.value = createdSubscription;
    pushMode.value = "enabled";
    successMessage.value = "应用外提醒已开启";
  } catch (error) {
    if (createdSubscription) {
      await createdSubscription.unsubscribe().catch(() => undefined);
      activeSubscription.value = null;
      pushMode.value = "available";
    }
    pushError.value = `应用外提醒操作失败：${messageOf(error)}`;
  } finally {
    pushLoading.value = false;
  }
}

function hasBrowserPushSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "PushManager" in window &&
    "serviceWorker" in navigator
  );
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function buildRecurrence(source: {
  dayOfMonth: string;
  interval: string;
  scheduleType: ReminderScheduleType;
  until: string;
  weekdays: number[];
}): ReminderRecurrence | null {
  if (source.scheduleType === "ONCE") return null;

  const recurrence: ReminderRecurrence = {};
  const interval = Number(source.interval) || 1;
  if (interval !== 1 || source.until) recurrence.interval = interval;
  if (source.scheduleType === "WEEKLY" && source.weekdays.length > 0) {
    recurrence.weekdays = [...source.weekdays].sort((a, b) => a - b);
  }
  if (source.scheduleType === "MONTHLY" && source.dayOfMonth) {
    recurrence.dayOfMonth = Number(source.dayOfMonth);
  }
  if (source.until) recurrence.until = toShanghaiIso(source.until);
  return Object.keys(recurrence).length > 0 ? recurrence : null;
}

function validateReminderForm(source: ReminderForm): string | null {
  if (!source.title.trim()) return "请输入提醒标题";
  if (!source.startsAt) return "请选择首次时间";

  const startsAt = new Date(toShanghaiIso(source.startsAt)).getTime();
  if (!Number.isFinite(startsAt)) return "首次时间格式无效";

  if (source.scheduleType !== "ONCE") {
    const interval = Number(source.interval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 366) {
      return "间隔必须是 1 到 366 之间的整数";
    }
    if (
      source.scheduleType === "MONTHLY" &&
      (!Number.isInteger(Number(source.dayOfMonth)) ||
        Number(source.dayOfMonth) < 1 ||
        Number(source.dayOfMonth) > 31)
    ) {
      return "每月日期必须是 1 到 31 之间的整数";
    }
    if (
      source.weekdays.some(
        (day) => !Number.isInteger(day) || day < 1 || day > 7,
      )
    ) {
      return "星期选择无效";
    }
    if (source.until) {
      const until = new Date(toShanghaiIso(source.until)).getTime();
      if (!Number.isFinite(until)) return "截止时间格式无效";
      if (until < startsAt) return "截止时间不能早于首次时间";
    }
  }
  return null;
}

function toggleWeekday(day: number) {
  const index = form.value.weekdays.indexOf(day);
  if (index >= 0) form.value.weekdays.splice(index, 1);
  else form.value.weekdays.push(day);
}

function toggleEditWeekday(day: number) {
  const index = editForm.value.weekdays.indexOf(day);
  if (index >= 0) editForm.value.weekdays.splice(index, 1);
  else editForm.value.weekdays.push(day);
}

function reminderFormSnapshot(source: ReminderForm): string {
  return JSON.stringify({
    dayOfMonth: source.dayOfMonth,
    interval: source.interval,
    note: source.note,
    scheduleType: source.scheduleType,
    startsAt: source.startsAt,
    title: source.title,
    until: source.until,
    weekdays: [...source.weekdays].sort((a, b) => a - b),
  });
}

function reminderEditSnapshot(): string {
  return reminderFormSnapshot(editForm.value);
}

function createReminderForm(): ReminderForm {
  return {
    dayOfMonth: "",
    interval: "1",
    note: "",
    scheduleType: "ONCE",
    startsAt: "",
    title: "",
    until: "",
    weekdays: [],
  };
}

function createEditForm(): ReminderEditForm {
  return { ...createReminderForm(), version: 1 };
}

function reminderQueryKey(status: StatusFilter, deleted: boolean): string {
  return `${status || "ALL"}:${deleted ? "DELETED" : "ACTIVE"}`;
}

function filterReminders(
  reminders: ReminderSummary[],
  status: StatusFilter,
  includeDeleted: boolean,
): ReminderSummary[] {
  return reminders.filter(
    (item) =>
      (!status || item.status === status) &&
      (includeDeleted || !item.deletedAt),
  );
}

function isCurrentLoad(sequence: number, requestedKey: string): boolean {
  return sequence === loadSequence && requestedKey === currentQueryKey.value;
}

function readStatusFilter(value: string): StatusFilter {
  return value === "SCHEDULED" ||
    value === "SENT" ||
    value === "FAILED" ||
    value === "SUPPRESSED" ||
    value === "CANCELLED"
    ? value
    : "";
}

function withRemindersSource(path: string) {
  return appendReturnTo(path, route.fullPath || "/reminders");
}

function scheduleLabel(item: ReminderSummary): string {
  if (item.scheduleType === "ONCE") return "一次性";
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

function statusLabel(status: ReminderStatus | string): string {
  const labels: Record<string, string> = {
    CANCELLED: "已取消",
    FAILED: "发送失败",
    SCHEDULED: "待发送",
    SENT: "已发送",
    SUPPRESSED: "已抑制",
  };
  return labels[status] ?? status;
}

function statusClass(status: ReminderStatus): string {
  const classes: Record<ReminderStatus, string> = {
    CANCELLED: "status-discarded",
    FAILED: "status-failed",
    SCHEDULED: "status-pending",
    SENT: "status-confirmed",
    SUPPRESSED: "status-discarded",
  };
  return classes[status];
}

function weekdayLabel(day: number): string {
  return ["一", "二", "三", "四", "五", "六", "日"][day - 1] ?? String(day);
}

function emptyDescription(status: StatusFilter): string {
  return status
    ? `当前没有${statusLabel(status)}提醒。可以切换状态筛选，或在上方新建提醒。`
    : "当前没有提醒。可以在上方新建一条安排。";
}

function pushStatusLabel(mode: PushMode): string {
  const labels: Record<PushMode, string> = {
    available: "尚未开启",
    checking: "检查中",
    denied: "权限被拒绝",
    enabled: "已开启",
    error: "检查失败",
    unconfigured: "服务端未配置",
    unsupported: "浏览器不支持",
  };
  return labels[mode];
}

function pushDescription(mode: PushMode): string {
  const descriptions: Record<PushMode, string> = {
    available: "开启后，浏览器关闭时也可以接收系统通知。",
    checking: "正在检查浏览器和服务端的提醒能力。",
    denied: "浏览器通知权限已拒绝，请在浏览器设置中允许通知后再试。",
    enabled: "浏览器已订阅应用外提醒；站内提醒仍会继续保留。",
    error: "暂时无法确认应用外提醒状态，提醒列表仍可正常使用。",
    unconfigured: "服务端尚未配置应用外提醒，当前使用应用内提醒。",
    unsupported: "当前浏览器不支持应用外提醒，当前使用应用内提醒。",
  };
  return descriptions[mode];
}

function pushStatusClass(mode: PushMode): string {
  if (mode === "enabled") return "status-confirmed";
  if (mode === "available" || mode === "checking") return "status-pending";
  if (mode === "denied" || mode === "error") return "status-failed";
  return "status-discarded";
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "网络异常，请稍后重试";
}
</script>

<template>
  <SecondaryPageShell
    class="planner-page planner-workspace reminders-workspace"
    title="提醒事项"
    title-id="reminders-title"
    subtitle="提醒"
  >
    <template #actions>
      <div class="filters reminder-filter-toolbar">
        <label class="secondary-page-filter">
          <span>状态</span>
          <select
            :value="statusFilter"
            aria-label="提醒状态筛选"
            @change="handleStatusChange"
          >
            <option value="SCHEDULED">待发送</option>
            <option value="SENT">已发送</option>
            <option value="FAILED">发送失败</option>
            <option value="SUPPRESSED">已抑制</option>
            <option value="CANCELLED">已取消</option>
            <option value="">全部</option>
          </select>
        </label>
        <label class="check-label reminder-deleted-filter">
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

    <p class="reminder-filter-summary" role="status">{{ filterSummary }}</p>

    <SectionCard
      class="reminder-push-card"
      title="应用外提醒"
      description="应用外提醒是可选能力；不可用时不影响站内提醒。"
    >
      <div class="reminder-push-status">
        <div class="reminder-push-copy">
          <div class="reminder-heading">
            <strong>发送能力</strong>
            <span class="status-badge" :class="pushStatusClass(pushMode)">
              {{ pushStatusLabel(pushMode) }}
            </span>
          </div>
          <p>{{ pushDescription(pushMode) }}</p>
        </div>
        <button
          v-if="canTogglePush"
          class="secondary-button"
          :disabled="pushLoading"
          type="button"
          @click="togglePush"
        >
          {{
            pushLoading
              ? "处理中…"
              : pushMode === "enabled"
                ? "关闭应用外提醒"
                : "开启应用外提醒"
          }}
        </button>
        <button
          v-else-if="pushMode === 'error'"
          class="secondary-button"
          :disabled="pushLoading"
          type="button"
          @click="loadPushStatus"
        >
          重试检查
        </button>
      </div>
      <p
        v-if="pushError"
        class="planner-feedback planner-feedback-error reminder-push-error"
        role="alert"
      >
        {{ pushError }}
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

    <SectionCard
      title="新建提醒"
      description="设置提醒内容、首次时间和重复方式。"
      class="planner-create-card reminder-create-card"
    >
      <form
        class="planner-create reminder-create-form"
        @submit.prevent="submit"
      >
        <label class="planner-field">
          <span>标题</span>
          <input v-model="form.title" maxlength="200" required />
        </label>
        <label class="planner-field">
          <span>备注（可选）</span>
          <textarea v-model="form.note" maxlength="500" rows="2" />
        </label>
        <label class="planner-field">
          <span>重复方式</span>
          <select v-model="form.scheduleType">
            <option value="ONCE">一次性</option>
            <option value="DAILY">每天</option>
            <option value="WEEKLY">每周</option>
            <option value="MONTHLY">每月</option>
          </select>
        </label>
        <label class="planner-field">
          <span>首次时间</span>
          <DateTimeField v-model="form.startsAt" required />
        </label>
        <template v-if="form.scheduleType !== 'ONCE'">
          <label class="planner-field">
            <span>间隔</span>
            <input
              v-model="form.interval"
              max="366"
              min="1"
              step="1"
              type="number"
            />
          </label>
          <fieldset
            v-if="form.scheduleType === 'WEEKLY'"
            class="scope-fieldset reminder-weekday-fieldset"
          >
            <legend>每周星期</legend>
            <label v-for="day in weekdays" :key="day" class="check-label">
              <input
                :checked="form.weekdays.includes(day)"
                type="checkbox"
                @change="toggleWeekday(day)"
              />
              <span>周{{ weekdayLabel(day) }}</span>
            </label>
          </fieldset>
          <label v-if="form.scheduleType === 'MONTHLY'" class="planner-field">
            <span>每月日期</span>
            <input
              v-model="form.dayOfMonth"
              max="31"
              min="1"
              step="1"
              type="number"
            />
          </label>
          <label class="planner-field">
            <span>截止时间（可选）</span>
            <DateTimeField v-model="form.until" :min="form.startsAt" />
          </label>
        </template>
        <button class="primary-button" :disabled="creating" type="submit">
          {{ creating ? "创建中…" : "新建提醒" }}
        </button>
      </form>
    </SectionCard>

    <SectionCard
      title="提醒列表"
      description="查看发送状态、重复规则和可用操作。"
      class="planner-list-card reminder-list-card"
    >
      <LoadingState
        v-if="isInitialLoading"
        description="正在获取当前筛选下的提醒。"
        title="正在加载提醒…"
      />
      <ErrorState
        v-else-if="loadError && !hasLoadedCurrent"
        action-label="重试"
        :description="loadError"
        title="提醒暂时无法加载"
        @retry="retryLoad"
      />
      <template v-else>
        <LoadingState
          v-if="isRefreshing"
          class="reminder-refresh-state"
          description="当前列表仍可查看，刷新完成后会更新。"
          title="正在更新提醒…"
        />
        <div
          v-if="loadError && hasLoadedCurrent"
          class="planner-stale-warning reminder-stale-warning"
          role="alert"
        >
          <span>{{ loadError }} 当前显示的是上次成功加载的提醒。</span>
          <button class="secondary-button" type="button" @click="retryLoad">
            重试
          </button>
        </div>

        <EmptyState
          v-if="
            hasLoadedCurrent && currentReminders.length === 0 && !isRefreshing
          "
          :description="emptyDescription(statusFilter)"
          icon="bell"
          title="当前筛选没有提醒"
        />
        <ul v-else-if="currentReminders.length" class="resource-list">
          <li
            v-for="item in currentReminders"
            :key="item.id"
            class="reminder-row"
            :class="{ 'is-deleted': item.deletedAt !== null }"
          >
            <template v-if="editingId === item.id">
              <form
                class="planner-edit reminder-edit-form"
                @submit.prevent="saveEdit(item)"
              >
                <label class="planner-field">
                  <span>标题</span>
                  <input v-model="editForm.title" maxlength="200" required />
                </label>
                <label class="planner-field">
                  <span>备注（可选）</span>
                  <textarea v-model="editForm.note" maxlength="500" rows="2" />
                </label>
                <label class="planner-field">
                  <span>重复方式</span>
                  <select v-model="editForm.scheduleType">
                    <option value="ONCE">一次性</option>
                    <option value="DAILY">每天</option>
                    <option value="WEEKLY">每周</option>
                    <option value="MONTHLY">每月</option>
                  </select>
                </label>
                <label class="planner-field">
                  <span>首次时间</span>
                  <DateTimeField v-model="editForm.startsAt" required />
                </label>
                <template v-if="editForm.scheduleType !== 'ONCE'">
                  <label class="planner-field">
                    <span>间隔</span>
                    <input
                      v-model="editForm.interval"
                      max="366"
                      min="1"
                      step="1"
                      type="number"
                    />
                  </label>
                  <fieldset
                    v-if="editForm.scheduleType === 'WEEKLY'"
                    class="scope-fieldset reminder-weekday-fieldset"
                  >
                    <legend>每周星期</legend>
                    <label
                      v-for="day in weekdays"
                      :key="day"
                      class="check-label"
                    >
                      <input
                        :checked="editForm.weekdays.includes(day)"
                        type="checkbox"
                        @change="toggleEditWeekday(day)"
                      />
                      <span>周{{ weekdayLabel(day) }}</span>
                    </label>
                  </fieldset>
                  <label
                    v-if="editForm.scheduleType === 'MONTHLY'"
                    class="planner-field"
                  >
                    <span>每月日期</span>
                    <input
                      v-model="editForm.dayOfMonth"
                      max="31"
                      min="1"
                      step="1"
                      type="number"
                    />
                  </label>
                  <label class="planner-field">
                    <span>截止时间（可选）</span>
                    <DateTimeField
                      v-model="editForm.until"
                      :min="editForm.startsAt"
                    />
                  </label>
                </template>
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
              <div class="planner-main reminder-main">
                <div class="reminder-heading">
                  <strong class="reminder-title">{{ item.title }}</strong>
                  <span class="status-badge" :class="statusClass(item.status)">
                    {{ statusLabel(item.status) }}
                  </span>
                  <span v-if="item.deletedAt" class="revoked-mark">已删除</span>
                </div>
                <div class="reminder-meta">
                  <small>下一次：{{ formatDateTime(item.scheduledAt) }}</small>
                  <small>{{ scheduleLabel(item) }}</small>
                  <small>尝试 {{ item.attemptCount }} 次</small>
                </div>
                <small v-if="item.note" class="reminder-note">
                  备注：{{ item.note }}
                </small>
                <small v-if="item.failureReason" class="reminder-failure">
                  失败原因：{{ item.failureReason }}
                </small>
              </div>
              <div class="row-actions reminder-row-actions">
                <button
                  v-if="
                    !item.deletedAt &&
                    item.status !== 'SENT' &&
                    item.status !== 'CANCELLED'
                  "
                  class="text-button danger"
                  :disabled="isRowBusy(item.id)"
                  type="button"
                  @click="setStatus(item, 'CANCELLED')"
                >
                  {{ rowActions[item.id] === "cancel" ? "取消中…" : "取消" }}
                </button>
                <button
                  v-if="!item.deletedAt && item.status === 'CANCELLED'"
                  class="text-button"
                  :disabled="isRowBusy(item.id)"
                  type="button"
                  @click="setStatus(item, 'SCHEDULED')"
                >
                  {{
                    rowActions[item.id] === "reschedule"
                      ? "重新启用中…"
                      : "重新启用"
                  }}
                </button>
                <button
                  v-if="!item.deletedAt && item.status !== 'SENT'"
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
                  :to="withRemindersSource(`/reminders/${item.id}`)"
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
