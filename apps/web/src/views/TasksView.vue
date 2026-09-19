<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";

import type { Priority, TaskStatus, TaskSummary } from "../api/client";
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

type StatusFilter = TaskStatus | "";
type RowAction = "cancel" | "complete" | "delete" | "restore";

const auth = useAuthStore();
const planner = usePlannerStore();
const route = useRoute();

const statusFilter = ref<StatusFilter>("OPEN");
const includeDeleted = ref(false);
const visibleTasks = ref<TaskSummary[]>([]);
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

const form = ref(createForm());
const editForm = ref(createEditForm());
const editSnapshot = ref("");

const currentQueryKey = computed(() =>
  taskQueryKey(statusFilter.value, includeDeleted.value),
);
const hasLoadedCurrent = computed(
  () => loadedQueryKey.value === currentQueryKey.value,
);
const isInitialLoading = computed(
  () => loading.value && !hasLoadedCurrent.value,
);
const isRefreshing = computed(() => loading.value && hasLoadedCurrent.value);
const currentTasks = computed(() =>
  hasLoadedCurrent.value ? visibleTasks.value : [],
);
const filterSummary = computed(() => {
  const status = statusFilter.value
    ? `状态为“${statusLabel(statusFilter.value)}”`
    : "全部状态";
  const deleted = includeDeleted.value ? "，包含已删除" : "，不含已删除";
  return `当前筛选：${status}${deleted}。`;
});
const newFormDirty = computed(
  () => taskFormSnapshot(form.value) !== taskFormSnapshot(createForm()),
);
const editDirty = computed(
  () => Boolean(editingId.value) && taskEditSnapshot() !== editSnapshot.value,
);
const pageDirty = computed(() => newFormDirty.value || editDirty.value);

useUnsavedChanges(pageDirty);

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
  }
});

async function reload(): Promise<boolean> {
  const requestedStatus = statusFilter.value;
  const requestedIncludeDeleted = includeDeleted.value;
  const requestedKey = taskQueryKey(requestedStatus, requestedIncludeDeleted);
  const sequence = ++loadSequence;

  loading.value = true;
  loadError.value = "";
  planner.clearError();

  try {
    await planner.loadTasks({
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

  if (!isCurrentLoad(sequence, requestedKey)) {
    return false;
  }

  const storeError = planner.errorMessage?.trim()
    ? planner.errorMessage
    : planner.errorKind
      ? "待办暂时无法加载，请稍后重试"
      : "";
  if (storeError) {
    loadError.value = storeError;
    return false;
  }

  visibleTasks.value = filterTasks(
    planner.tasks,
    requestedStatus,
    requestedIncludeDeleted,
  );
  loadedQueryKey.value = requestedKey;
  loadError.value = "";
  return true;
}

async function handleStatusChange(event: Event) {
  const target = event.currentTarget as HTMLSelectElement;
  const nextStatus = readStatusFilter(target.value);
  const changed = await applyFilterChange(nextStatus, includeDeleted.value);
  if (!changed) {
    target.value = statusFilter.value;
  }
}

async function handleIncludeDeletedChange(event: Event) {
  const target = event.currentTarget as HTMLInputElement;
  const changed = await applyFilterChange(statusFilter.value, target.checked);
  if (!changed) {
    target.checked = includeDeleted.value;
  }
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
    if (!confirmed) {
      return false;
    }
    discardLocalChanges();
  }

  clearActionFeedback();
  statusFilter.value = nextStatus;
  includeDeleted.value = nextIncludeDeleted;
  await reload();
  return true;
}

async function submit() {
  if (creating.value || !form.value.title.trim()) {
    return;
  }

  clearActionFeedback();
  creating.value = true;
  try {
    await planner.createTask({
      dueAt: form.value.dueAt ? toShanghaiIso(form.value.dueAt) : null,
      priority: form.value.priority,
      title: form.value.title,
    });

    const successText =
      statusFilter.value && statusFilter.value !== "OPEN"
        ? "待办已创建；当前筛选不会显示这条进行中的待办。"
        : "待办已创建";
    resetCreateForm();
    await reportRefreshFailure(successText);
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    creating.value = false;
  }
}

async function startEdit(item: TaskSummary) {
  if (item.deletedAt || savingId.value || rowActions.value[item.id]) {
    return;
  }

  if (editingId.value && editingId.value !== item.id && editDirty.value) {
    const confirmed = await requestAppConfirm({
      cancelLabel: "留在当前编辑",
      confirmLabel: "切换编辑",
      description:
        "当前待办有未保存内容，切换编辑对象会放弃这些修改。是否继续？",
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

  clearActionFeedback();
  editingId.value = item.id;
  editForm.value = {
    dueAt: item.dueAt ? toLocalDateTimeInput(item.dueAt) : "",
    priority: item.priority,
    title: item.title,
    version: item.version,
  };
  editSnapshot.value = taskEditSnapshot();
}

async function saveEdit(item: TaskSummary) {
  if (
    savingId.value ||
    editingId.value !== item.id ||
    !editForm.value.title.trim()
  ) {
    return;
  }

  clearActionFeedback();
  savingId.value = item.id;
  try {
    await planner.updateTask(item.id, {
      dueAt: editForm.value.dueAt ? toShanghaiIso(editForm.value.dueAt) : null,
      priority: editForm.value.priority,
      title: editForm.value.title,
      version: editForm.value.version,
    });

    cancelEdit();
    await reportRefreshFailure("待办已更新");
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

async function complete(item: TaskSummary) {
  if (
    item.deletedAt ||
    item.status !== "OPEN" ||
    rowActions.value[item.id] ||
    savingId.value
  ) {
    return;
  }

  clearActionFeedback();
  setRowAction(item.id, "complete");
  try {
    await planner.completeTask(item.id);
    await reportRefreshFailure("待办已完成");
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    setRowAction(item.id, undefined);
  }
}

async function cancel(item: TaskSummary) {
  if (
    item.deletedAt ||
    item.status !== "OPEN" ||
    rowActions.value[item.id] ||
    savingId.value
  ) {
    return;
  }

  clearActionFeedback();
  setRowAction(item.id, "cancel");
  try {
    await planner.updateTask(item.id, {
      status: "CANCELLED",
      version: item.version,
    });
    await reportRefreshFailure("待办已取消");
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    setRowAction(item.id, undefined);
  }
}

async function remove(item: TaskSummary) {
  if (item.deletedAt || rowActions.value[item.id] || savingId.value) {
    return;
  }

  const confirmed = await requestAppConfirm({
    cancelLabel: "保留待办",
    confirmLabel: "删除",
    description: `确定删除待办“${item.title}”吗？删除后仍可在“显示已删除”中恢复。`,
    destructive: true,
    title: "删除待办？",
  });
  if (!confirmed || rowActions.value[item.id]) {
    return;
  }

  clearActionFeedback();
  setRowAction(item.id, "delete");
  try {
    await planner.deleteTask(item.id);
    await reportRefreshFailure("待办已删除");
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    setRowAction(item.id, undefined);
  }
}

async function restore(item: TaskSummary) {
  if (!item.deletedAt || rowActions.value[item.id] || savingId.value) {
    return;
  }

  clearActionFeedback();
  setRowAction(item.id, "restore");
  try {
    await planner.restoreTask(item.id);
    await reportRefreshFailure("待办已恢复");
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
  form.value = createForm();
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

function taskEditSnapshot(): string {
  return taskFormSnapshot(editForm.value);
}

function taskFormSnapshot(source: {
  dueAt: string;
  priority: Priority;
  title: string;
}): string {
  return JSON.stringify({
    dueAt: source.dueAt,
    priority: source.priority,
    title: source.title,
  });
}

function createForm() {
  return {
    dueAt: "",
    priority: "MEDIUM" as Priority,
    title: "",
  };
}

function createEditForm() {
  return {
    dueAt: "",
    priority: "MEDIUM" as Priority,
    title: "",
    version: 1,
  };
}

function taskQueryKey(status: StatusFilter, deleted: boolean): string {
  return `${status || "ALL"}:${deleted ? "DELETED" : "ACTIVE"}`;
}

function filterTasks(
  tasks: TaskSummary[],
  status: StatusFilter,
  includeDeleted: boolean,
): TaskSummary[] {
  return tasks.filter(
    (item) =>
      (!status || item.status === status) &&
      (includeDeleted || !item.deletedAt),
  );
}

function isCurrentLoad(sequence: number, requestedKey: string): boolean {
  return sequence === loadSequence && requestedKey === currentQueryKey.value;
}

function readStatusFilter(value: string): StatusFilter {
  return value === "OPEN" || value === "COMPLETED" || value === "CANCELLED"
    ? value
    : "";
}

function withTasksSource(path: string) {
  return appendReturnTo(path, route.fullPath || "/tasks");
}

function statusLabel(status: TaskStatus | string): string {
  return status === "OPEN"
    ? "进行中"
    : status === "COMPLETED"
      ? "已完成"
      : "已取消";
}

function statusClass(status: TaskStatus): string {
  return status === "OPEN"
    ? "status-pending"
    : status === "COMPLETED"
      ? "status-confirmed"
      : "status-discarded";
}

function priorityLabel(priority: Priority): string {
  return priority === "HIGH" ? "高" : priority === "LOW" ? "低" : "中";
}

function priorityClass(priority: Priority): string {
  return `task-priority-${priority.toLowerCase()}`;
}

function emptyDescription(status: StatusFilter): string {
  return status
    ? `当前没有${statusLabel(status)}待办。可以切换状态筛选，或在上方新建待办。`
    : "当前没有待办。可以在上方新建一条安排。";
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "网络异常，请稍后重试";
}
</script>

<template>
  <SecondaryPageShell
    class="planner-page planner-workspace tasks-workspace"
    title="待办事项"
    title-id="tasks-title"
    subtitle="待办"
  >
    <template #actions>
      <div class="filters task-filter-toolbar">
        <label class="secondary-page-filter">
          <span>状态</span>
          <select
            :value="statusFilter"
            aria-label="待办状态筛选"
            @change="handleStatusChange"
          >
            <option value="OPEN">进行中</option>
            <option value="COMPLETED">已完成</option>
            <option value="CANCELLED">已取消</option>
            <option value="">全部</option>
          </select>
        </label>
        <label class="check-label task-deleted-filter">
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

    <p class="task-filter-summary" role="status">{{ filterSummary }}</p>

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
      title="新建待办"
      description="记录任务、优先级和可选截止时间。"
      class="planner-create-card task-create-card"
    >
      <form class="planner-create task-create-form" @submit.prevent="submit">
        <label class="planner-field">
          <span>标题</span>
          <input
            v-model="form.title"
            aria-label="新建待办标题"
            maxlength="200"
            required
          />
        </label>
        <label class="planner-field">
          <span>优先级</span>
          <select v-model="form.priority" aria-label="新建待办优先级">
            <option value="LOW">低</option>
            <option value="MEDIUM">中</option>
            <option value="HIGH">高</option>
          </select>
        </label>
        <label class="planner-field">
          <span>截止时间（可选）</span>
          <DateTimeField v-model="form.dueAt" />
        </label>
        <button class="primary-button" :disabled="creating" type="submit">
          {{ creating ? "创建中…" : "新建待办" }}
        </button>
      </form>
    </SectionCard>

    <SectionCard
      title="待办列表"
      description="按状态查看并处理现有待办。"
      class="planner-list-card task-list-card"
    >
      <LoadingState
        v-if="isInitialLoading"
        description="正在获取当前筛选下的待办。"
        title="正在加载待办…"
      />
      <ErrorState
        v-else-if="loadError && !hasLoadedCurrent"
        action-label="重试"
        :description="loadError"
        title="待办暂时无法加载"
        @retry="retryLoad"
      />
      <template v-else>
        <LoadingState
          v-if="isRefreshing"
          class="task-refresh-state"
          description="当前列表仍可查看，刷新完成后会更新。"
          title="正在更新待办…"
        />
        <div
          v-if="loadError && hasLoadedCurrent"
          class="planner-stale-warning"
          role="alert"
        >
          <span>{{ loadError }} 当前显示的是上次成功加载的待办。</span>
          <button class="secondary-button" type="button" @click="retryLoad">
            重试
          </button>
        </div>

        <EmptyState
          v-if="hasLoadedCurrent && currentTasks.length === 0 && !isRefreshing"
          :description="emptyDescription(statusFilter)"
          icon="tasks"
          title="当前筛选没有待办"
        />
        <ul v-else-if="currentTasks.length" class="resource-list">
          <li
            v-for="item in currentTasks"
            :key="item.id"
            class="task-row"
            :class="{ 'is-deleted': item.deletedAt !== null }"
          >
            <template v-if="editingId === item.id">
              <form
                class="planner-edit task-edit-form"
                @submit.prevent="saveEdit(item)"
              >
                <label class="planner-field">
                  <span>标题</span>
                  <input
                    v-model="editForm.title"
                    aria-label="编辑待办标题"
                    maxlength="200"
                    required
                  />
                </label>
                <label class="planner-field">
                  <span>优先级</span>
                  <select
                    v-model="editForm.priority"
                    aria-label="编辑待办优先级"
                  >
                    <option value="LOW">低</option>
                    <option value="MEDIUM">中</option>
                    <option value="HIGH">高</option>
                  </select>
                </label>
                <label class="planner-field">
                  <span>截止时间（可选）</span>
                  <DateTimeField v-model="editForm.dueAt" />
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
              <div class="planner-main task-main">
                <div class="task-heading">
                  <strong class="task-title">{{ item.title }}</strong>
                  <span class="status-badge" :class="statusClass(item.status)">
                    {{ statusLabel(item.status) }}
                  </span>
                  <span
                    class="priority-badge"
                    :class="priorityClass(item.priority)"
                  >
                    优先级：{{ priorityLabel(item.priority) }}
                  </span>
                  <span v-if="item.deletedAt" class="revoked-mark">已删除</span>
                </div>
                <div class="task-meta">
                  <small v-if="item.dueAt">
                    截止 {{ formatDateTime(item.dueAt) }}
                  </small>
                  <small v-else>无截止时间</small>
                  <span v-if="item.overdue" class="overdue-mark">已逾期</span>
                </div>
              </div>
              <div class="row-actions task-row-actions">
                <button
                  v-if="!item.deletedAt && item.status === 'OPEN'"
                  class="text-button"
                  :disabled="isRowBusy(item.id) || Boolean(savingId)"
                  type="button"
                  @click="complete(item)"
                >
                  {{ rowActions[item.id] === "complete" ? "完成中…" : "完成" }}
                </button>
                <button
                  v-if="!item.deletedAt && item.status === 'OPEN'"
                  class="text-button danger"
                  :disabled="isRowBusy(item.id) || Boolean(savingId)"
                  type="button"
                  @click="cancel(item)"
                >
                  {{ rowActions[item.id] === "cancel" ? "取消中…" : "取消" }}
                </button>
                <button
                  v-if="!item.deletedAt"
                  class="text-button"
                  :disabled="isRowBusy(item.id) || Boolean(savingId)"
                  type="button"
                  @click="startEdit(item)"
                >
                  编辑
                </button>
                <button
                  v-if="!item.deletedAt"
                  class="text-button danger"
                  :disabled="isRowBusy(item.id) || Boolean(savingId)"
                  type="button"
                  @click="remove(item)"
                >
                  {{ rowActions[item.id] === "delete" ? "删除中…" : "删除" }}
                </button>
                <RouterLink
                  class="text-button"
                  :to="withTasksSource(`/tasks/${item.id}`)"
                >
                  查看
                </RouterLink>
                <button
                  v-if="item.deletedAt"
                  class="text-button"
                  :disabled="isRowBusy(item.id) || Boolean(savingId)"
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
