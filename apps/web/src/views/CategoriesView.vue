<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { ApiClientError } from "../api/client";
import PageHeader from "../components/PageHeader.vue";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";

const auth = useAuthStore();
const finance = useFinanceStore();

const newKind = ref<"EXPENSE" | "INCOME">("EXPENSE");
const newName = ref("");
const errorMessage = ref("");
const editing = ref<{ id: string; name: string; version: number } | null>(null);
const editName = ref("");
const editSnapshot = ref("");
useUnsavedChanges(
  computed(
    () =>
      (Boolean(editing.value) && editName.value !== editSnapshot.value) ||
      Boolean(newName.value.trim()),
  ),
);

const visibleCategories = () =>
  finance.categories.filter((item) => !item.isArchived);

onMounted(() => {
  if (auth.isAuthenticated) {
    void finance.loadCategories(true);
  }
});

async function createCategory() {
  errorMessage.value = "";
  if (!newName.value.trim()) {
    errorMessage.value = "请输入分类名称";
    return;
  }
  try {
    await finance.createCategory({
      kind: newKind.value,
      name: newName.value.trim(),
    });
    newName.value = "";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function startEdit(id: string, name: string, version: number) {
  editing.value = { id, name, version };
  editName.value = name;
  editSnapshot.value = name;
}

async function saveEdit() {
  errorMessage.value = "";
  if (!editing.value || !editName.value.trim()) {
    return;
  }
  try {
    await finance.updateCategory(editing.value.id, {
      name: editName.value.trim(),
      version: editing.value.version,
    });
    cancelEdit();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function cancelEdit() {
  editing.value = null;
  editName.value = "";
  editSnapshot.value = "";
}

async function toggleArchive(id: string, isArchived: boolean, version: number) {
  errorMessage.value = "";
  try {
    await finance.updateCategory(id, { isArchived: !isArchived, version });
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "操作失败，请稍后重试";
}
</script>

<template>
  <section class="finance-page" aria-labelledby="categories-title">
    <PageHeader title="分类" title-id="categories-title" subtitle="设置" />

    <form class="inline-create" @submit.prevent="createCategory">
      <select v-model="newKind">
        <option value="EXPENSE">支出</option>
        <option value="INCOME">收入</option>
      </select>
      <input
        v-model="newName"
        maxlength="40"
        placeholder="新分类名称"
        required
        type="text"
      />
      <button class="primary-button" type="submit">新增</button>
    </form>

    <p v-if="finance.errorMessage" class="form-error" role="alert">
      {{ finance.errorMessage }}
    </p>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>

    <h2>支出分类</h2>
    <ul class="resource-list">
      <li
        v-for="item in visibleCategories().filter((c) => c.kind === 'EXPENSE')"
        :key="item.id"
      >
        <span class="color-dot" :style="{ background: item.color }"></span>
        <template v-if="editing?.id === item.id">
          <input v-model="editName" maxlength="40" type="text" />
          <button class="text-button" type="button" @click="saveEdit">
            保存
          </button>
          <button class="text-button" type="button" @click="cancelEdit">
            取消
          </button>
        </template>
        <template v-else>
          <span>{{ item.name }}</span>
          <button
            class="text-button"
            type="button"
            @click="startEdit(item.id, item.name, item.version)"
          >
            编辑
          </button>
          <button
            class="text-button danger"
            type="button"
            @click="toggleArchive(item.id, item.isArchived, item.version)"
          >
            归档
          </button>
        </template>
      </li>
    </ul>

    <h2>收入分类</h2>
    <ul class="resource-list">
      <li
        v-for="item in visibleCategories().filter((c) => c.kind === 'INCOME')"
        :key="item.id"
      >
        <span class="color-dot" :style="{ background: item.color }"></span>
        <span>{{ item.name }}</span>
        <button
          class="text-button danger"
          type="button"
          @click="toggleArchive(item.id, item.isArchived, item.version)"
        >
          归档
        </button>
      </li>
    </ul>

    <h2>已归档</h2>
    <ul class="resource-list">
      <li
        v-for="item in finance.categories.filter((c) => c.isArchived)"
        :key="item.id"
      >
        <span class="color-dot" :style="{ background: item.color }"></span>
        <span>{{ item.name }}</span>
        <button
          class="text-button"
          type="button"
          @click="toggleArchive(item.id, item.isArchived, item.version)"
        >
          恢复
        </button>
      </li>
    </ul>
  </section>
</template>
