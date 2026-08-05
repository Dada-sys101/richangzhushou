<script setup lang="ts">
import { onMounted, ref } from "vue";

import { ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";

const auth = useAuthStore();
const finance = useFinanceStore();

const newKind = ref<"EXPENSE" | "INCOME">("EXPENSE");
const newName = ref("");
const errorMessage = ref("");
const editing = ref<{ id: string; name: string; version: number } | null>(null);
const editName = ref("");

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
    editing.value = null;
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
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
    <header class="page-head">
      <div>
        <p class="eyebrow">设置</p>
        <h1 id="categories-title">分类</h1>
      </div>
    </header>

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
          <button class="text-button" type="button" @click="editing = null">
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
