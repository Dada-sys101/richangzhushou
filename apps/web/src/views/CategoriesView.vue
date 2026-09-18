<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { ApiClientError } from "../api/client";
import EmptyState from "../components/EmptyState.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import SectionCard from "../components/SectionCard.vue";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";

const auth = useAuthStore();
const finance = useFinanceStore();

const newKind = ref<"EXPENSE" | "INCOME">("EXPENSE");
const newName = ref("");
const actionError = ref("");
const categoryLoadError = ref("");
const categoriesLoading = ref(false);
const actionPending = ref<string | null>(null);
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

const expenseCategories = computed(() =>
  finance.categories.filter(
    (item) => !item.isArchived && item.kind === "EXPENSE",
  ),
);
const incomeCategories = computed(() =>
  finance.categories.filter(
    (item) => !item.isArchived && item.kind === "INCOME",
  ),
);
const archivedCategories = computed(() =>
  finance.categories.filter((item) => item.isArchived),
);
const hasCategoryData = computed(() => finance.categories.length > 0);
const categoryRowsLocked = computed(
  () =>
    Boolean(actionPending.value) ||
    categoriesLoading.value ||
    Boolean(categoryLoadError.value),
);

onMounted(() => {
  if (auth.isAuthenticated) {
    void loadCategories();
  }
});

async function loadCategories() {
  categoriesLoading.value = true;
  categoryLoadError.value = "";
  finance.clearError();
  try {
    await finance.loadCategories(true);
    categoryLoadError.value = finance.errorMessage ?? "";
  } catch (error) {
    categoryLoadError.value = messageOf(error);
  } finally {
    categoriesLoading.value = false;
  }
}

async function createCategory() {
  if (actionPending.value) return;
  actionError.value = "";
  if (!newName.value.trim()) {
    actionError.value = "请输入分类名称";
    return;
  }

  actionPending.value = "create";
  finance.clearError();
  try {
    await finance.createCategory({
      kind: newKind.value,
      name: newName.value.trim(),
    });
    const storeError = finance.errorMessage;
    if (storeError) {
      newName.value = "";
      categoryLoadError.value = storeError;
      return;
    }
    categoryLoadError.value = "";
    newName.value = "";
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    actionPending.value = null;
  }
}

function startEdit(id: string, name: string, version: number) {
  actionError.value = "";
  editing.value = { id, name, version };
  editName.value = name;
  editSnapshot.value = name;
}

async function saveEdit() {
  if (!editing.value || actionPending.value) return;
  actionError.value = "";
  if (!editName.value.trim()) {
    actionError.value = "请输入分类名称";
    return;
  }

  const current = editing.value;
  actionPending.value = `edit:${current.id}`;
  finance.clearError();
  try {
    await finance.updateCategory(current.id, {
      name: editName.value.trim(),
      version: current.version,
    });
    const storeError = finance.errorMessage;
    if (storeError) {
      cancelEdit();
      categoryLoadError.value = storeError;
      return;
    }
    categoryLoadError.value = "";
    cancelEdit();
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    actionPending.value = null;
  }
}

function cancelEdit() {
  editing.value = null;
  editName.value = "";
  editSnapshot.value = "";
}

async function toggleArchive(id: string, isArchived: boolean, version: number) {
  if (actionPending.value) return;
  actionError.value = "";
  actionPending.value = `${isArchived ? "restore" : "archive"}:${id}`;
  finance.clearError();
  try {
    await finance.updateCategory(id, { isArchived: !isArchived, version });
    const storeError = finance.errorMessage;
    if (storeError) {
      categoryLoadError.value = storeError;
    } else {
      categoryLoadError.value = "";
    }
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    actionPending.value = null;
  }
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "操作失败，请稍后重试";
}
</script>

<template>
  <SecondaryPageShell
    class="categories-page"
    title="分类管理"
    title-id="categories-title"
    subtitle="设置"
  >
    <SectionCard title="新增分类" description="分别管理支出和收入使用的分类。">
      <form class="finance-create-form" @submit.prevent="createCategory">
        <label class="finance-create-field">
          <span>分类类型</span>
          <select v-model="newKind" aria-label="分类类型">
            <option value="EXPENSE">支出</option>
            <option value="INCOME">收入</option>
          </select>
        </label>
        <label class="finance-create-field finance-create-name-field">
          <span>分类名称</span>
          <input
            v-model="newName"
            aria-label="分类名称"
            maxlength="40"
            placeholder="如：餐饮、工资"
            required
            type="text"
          />
        </label>
        <button
          class="primary-button finance-create-submit"
          type="submit"
          :disabled="actionPending === 'create'"
        >
          {{ actionPending === "create" ? "新增中…" : "新增分类" }}
        </button>
      </form>
    </SectionCard>

    <p v-if="actionError" class="form-error finance-page-feedback" role="alert">
      {{ actionError }}
    </p>

    <LoadingState
      v-if="categoriesLoading && !hasCategoryData"
      description="正在获取支出和收入分类。"
      title="正在加载分类…"
    />
    <template v-else>
      <LoadingState
        v-if="categoriesLoading"
        class="categories-refresh-state"
        description="分类列表会在刷新完成后更新。"
        title="正在更新分类…"
      />
      <ErrorState
        v-if="categoryLoadError"
        action-label="重试"
        :description="categoryLoadError"
        title="分类暂时无法加载"
        @retry="loadCategories"
      />

      <template v-if="!categoryLoadError || hasCategoryData">
        <SectionCard title="支出分类">
          <EmptyState
            v-if="expenseCategories.length === 0"
            description="新增一个支出分类，记录会更容易整理。"
            icon="tags"
            title="还没有支出分类"
          />
          <ul v-else class="resource-list finance-resource-list">
            <li
              v-for="item in expenseCategories"
              :key="item.id"
              class="finance-resource-row"
            >
              <div class="finance-row-main">
                <span
                  class="color-dot"
                  :style="{ background: item.color }"
                  aria-hidden="true"
                ></span>
                <span class="finance-kind-badge">支出</span>
                <span class="finance-row-name">{{ item.name }}</span>
              </div>
              <template v-if="editing?.id === item.id">
                <label class="finance-row-edit-field">
                  <span class="visually-hidden">编辑支出分类名称</span>
                  <input
                    v-model="editName"
                    aria-label="编辑支出分类名称"
                    maxlength="40"
                    type="text"
                  />
                </label>
                <div class="finance-row-actions">
                  <button
                    class="text-button"
                    type="button"
                    :disabled="categoryRowsLocked"
                    @click="saveEdit"
                  >
                    {{
                      actionPending === `edit:${item.id}` ? "保存中…" : "保存"
                    }}
                  </button>
                  <button
                    class="text-button"
                    type="button"
                    :disabled="categoryRowsLocked"
                    @click="cancelEdit"
                  >
                    取消
                  </button>
                </div>
              </template>
              <div v-else class="finance-row-actions">
                <button
                  class="text-button"
                  type="button"
                  :aria-label="`编辑支出分类：${item.name}`"
                  :disabled="categoryRowsLocked"
                  @click="startEdit(item.id, item.name, item.version)"
                >
                  编辑
                </button>
                <button
                  class="text-button danger"
                  type="button"
                  :aria-label="`归档支出分类：${item.name}`"
                  :disabled="categoryRowsLocked"
                  @click="toggleArchive(item.id, item.isArchived, item.version)"
                >
                  归档
                </button>
              </div>
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="收入分类">
          <EmptyState
            v-if="incomeCategories.length === 0"
            description="新增一个收入分类，收入记录会更清晰。"
            icon="tags"
            title="还没有收入分类"
          />
          <ul v-else class="resource-list finance-resource-list">
            <li
              v-for="item in incomeCategories"
              :key="item.id"
              class="finance-resource-row"
            >
              <div class="finance-row-main">
                <span
                  class="color-dot"
                  :style="{ background: item.color }"
                  aria-hidden="true"
                ></span>
                <span class="finance-kind-badge">收入</span>
                <span class="finance-row-name">{{ item.name }}</span>
              </div>
              <template v-if="editing?.id === item.id">
                <label class="finance-row-edit-field">
                  <span class="visually-hidden">编辑收入分类名称</span>
                  <input
                    v-model="editName"
                    aria-label="编辑收入分类名称"
                    maxlength="40"
                    type="text"
                  />
                </label>
                <div class="finance-row-actions">
                  <button
                    class="text-button"
                    type="button"
                    :disabled="categoryRowsLocked"
                    @click="saveEdit"
                  >
                    {{
                      actionPending === `edit:${item.id}` ? "保存中…" : "保存"
                    }}
                  </button>
                  <button
                    class="text-button"
                    type="button"
                    :disabled="categoryRowsLocked"
                    @click="cancelEdit"
                  >
                    取消
                  </button>
                </div>
              </template>
              <div v-else class="finance-row-actions">
                <button
                  class="text-button"
                  type="button"
                  :aria-label="`编辑收入分类：${item.name}`"
                  :disabled="categoryRowsLocked"
                  @click="startEdit(item.id, item.name, item.version)"
                >
                  编辑
                </button>
                <button
                  class="text-button danger"
                  type="button"
                  :aria-label="`归档收入分类：${item.name}`"
                  :disabled="categoryRowsLocked"
                  @click="toggleArchive(item.id, item.isArchived, item.version)"
                >
                  归档
                </button>
              </div>
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="已归档分类" tone="muted">
          <EmptyState
            v-if="archivedCategories.length === 0"
            description="归档后的分类会保留在这里，可随时恢复。"
            icon="file"
            title="还没有已归档分类"
          />
          <ul v-else class="resource-list finance-resource-list">
            <li
              v-for="item in archivedCategories"
              :key="item.id"
              class="finance-resource-row"
            >
              <div class="finance-row-main">
                <span
                  class="color-dot"
                  :style="{ background: item.color }"
                  aria-hidden="true"
                ></span>
                <span class="finance-kind-badge">
                  {{ item.kind === "INCOME" ? "收入" : "支出" }}
                </span>
                <span class="finance-row-name">{{ item.name }}</span>
              </div>
              <div class="finance-row-actions">
                <button
                  class="text-button"
                  type="button"
                  :aria-label="`恢复${item.kind === 'INCOME' ? '收入' : '支出'}分类：${item.name}`"
                  :disabled="categoryRowsLocked"
                  @click="toggleArchive(item.id, item.isArchived, item.version)"
                >
                  {{
                    actionPending === `restore:${item.id}` ? "恢复中…" : "恢复"
                  }}
                </button>
              </div>
            </li>
          </ul>
        </SectionCard>
      </template>
    </template>
  </SecondaryPageShell>
</template>
