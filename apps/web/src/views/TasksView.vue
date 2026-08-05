<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

import type { TaskSummary } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import {
  formatDateTime,
  toLocalDateTimeInput,
  toShanghaiIso,
} from "../utils/time";

const auth = useAuthStore();
const planner = usePlannerStore();

const statusFilter = ref<"" | "CANCELLED" | "COMPLETED" | "OPEN">("OPEN");
const includeDeleted = ref(false);
const editingId = ref("");
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const form = ref({
  dueAt: "",
  priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
  title: "",
});
const editForm = ref({
  dueAt: "",
  priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
  title: "",
  version: 1,
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
  await planner.loadTasks({
    includeDeleted: includeDeleted.value || undefined,
    status: statusFilter.value || undefined,
  });
}

async function submit() {
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await planner.createTask({
      dueAt: form.value.dueAt ? toShanghaiIso(form.value.dueAt) : null,
      priority: form.value.priority,
      title: form.value.title,
    });
    successMessage.value = "待办已创建";
    form.value = { dueAt: "", priority: "MEDIUM", title: "" };
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function startEdit(item: TaskSummary) {
  editingId.value = item.id;
  editForm.value = {
    dueAt: item.dueAt ? toLocalDateTimeInput(item.dueAt) : "",
    priority: item.priority,
    title: item.title,
    version: item.version,
  };
}

async function saveEdit(item: TaskSummary) {
  errorMessage.value = "";
  saving.value = true;
  try {
    await planner.updateTask(item.id, {
      dueAt: editForm.value.dueAt ? toShanghaiIso(editForm.value.dueAt) : null,
      priority: editForm.value.priority,
      title: editForm.value.title,
      version: editForm.value.version,
    });
    successMessage.value = "待办已更新";
    editingId.value = "";
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    saving.value = false;
  }
}

async function complete(item: TaskSummary) {
  errorMessage.value = "";
  try {
    await planner.completeTask(item.id);
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function cancel(item: TaskSummary) {
  errorMessage.value = "";
  try {
    await planner.updateTask(item.id, {
      status: "CANCELLED",
      version: item.version,
    });
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function remove(item: TaskSummary) {
  errorMessage.value = "";
  try {
    await planner.deleteTask(item.id);
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function restore(item: TaskSummary) {
  errorMessage.value = "";
  try {
    await planner.restoreTask(item.id);
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "网络异常，请稍后重试";
}
</script>

<template>
  <section class="planner-page" aria-labelledby="tasks-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">待办</p>
        <h1 id="tasks-title">待办事项</h1>
      </div>
      <div class="filters">
        <label>
          状态
          <select v-model="statusFilter">
            <option value="OPEN">进行中</option>
            <option value="COMPLETED">已完成</option>
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
        优先级
        <select v-model="form.priority">
          <option value="LOW">低</option>
          <option value="MEDIUM">中</option>
          <option value="HIGH">高</option>
        </select>
      </label>
      <label class="planner-field">
        截止时间（可选）
        <input v-model="form.dueAt" type="datetime-local" />
      </label>
      <button class="primary-button" type="submit">新建待办</button>
    </form>

    <p v-if="!planner.tasks.length" class="empty-copy">当前没有待办。</p>
    <ul v-else class="resource-list">
      <li
        v-for="item in planner.tasks"
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
              优先级
              <select v-model="editForm.priority">
                <option value="LOW">低</option>
                <option value="MEDIUM">中</option>
                <option value="HIGH">高</option>
              </select>
            </label>
            <label class="planner-field">
              截止时间（可选）
              <input v-model="editForm.dueAt" type="datetime-local" />
            </label>
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
            <strong :class="{ 'overdue-mark': item.overdue }">{{
              item.title
            }}</strong>
            <small v-if="item.dueAt">
              截止 {{ formatDateTime(item.dueAt) }}
              <span v-if="item.overdue" class="overdue-mark">（已过期）</span>
            </small>
            <small v-else>无截止时间</small>
            <span class="status-badge" :class="statusClass(item.status)">
              {{ statusLabel(item.status) }}
            </span>
            <span class="priority-badge">{{
              priorityLabel(item.priority)
            }}</span>
            <span v-if="item.deletedAt" class="revoked-mark">已删除</span>
          </div>
          <div class="row-actions">
            <button
              v-if="!item.deletedAt && item.status === 'OPEN'"
              class="text-button"
              type="button"
              @click="complete(item)"
            >
              完成
            </button>
            <button
              v-if="!item.deletedAt && item.status === 'OPEN'"
              class="text-button danger"
              type="button"
              @click="cancel(item)"
            >
              取消
            </button>
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

<script lang="ts">
function statusLabel(status: string): string {
  return status === "OPEN"
    ? "进行中"
    : status === "COMPLETED"
      ? "已完成"
      : "已取消";
}

function statusClass(status: string): string {
  return status === "OPEN"
    ? "status-pending"
    : status === "COMPLETED"
      ? "status-confirmed"
      : "status-discarded";
}

function priorityLabel(priority: string): string {
  return priority === "HIGH" ? "高" : priority === "LOW" ? "低" : "中";
}
</script>
