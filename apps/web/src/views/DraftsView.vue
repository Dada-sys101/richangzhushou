<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import { ApiClientError } from "../api/client";
import DraftReviewCard from "../components/DraftReviewCard.vue";
import { useAuthStore } from "../stores/auth";
import { useDraftsStore } from "../stores/drafts";
import { useFinanceStore } from "../stores/finance";

const auth = useAuthStore();
const drafts = useDraftsStore();
const finance = useFinanceStore();

const statusFilter = ref<"CONFIRMED" | "DISCARDED" | "PENDING" | "">("PENDING");
const cardErrors = ref<Record<string, string>>({});
const savingId = ref("");
const batchReason = ref("");
const batchIntent = ref<{
  affectedDraftIds: string[];
  confirmationToken: string;
} | null>(null);
const batchMessage = ref("");
const selectedIds = ref<string[]>([]);

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
    void finance.loadCategories(true);
    void finance.loadAccounts(true);
  }
});

watch(statusFilter, () => {
  void reload();
});

async function reload() {
  await drafts.loadDrafts(statusFilter.value || undefined);
}

async function saveDraft(
  id: string,
  payload: {
    accountId?: string | null;
    amount: string;
    categoryId?: string | null;
    currency?: string;
    merchant?: string | null;
    note?: string | null;
    occurredAt?: string;
    type: "EXPENSE" | "INCOME" | "REFUND";
  },
  version: number,
) {
  cardErrors.value[id] = "";
  savingId.value = id;
  try {
    const updated = await drafts.updateDraft(id, payload, version);
    const index = drafts.drafts.findIndex((item) => item.id === id);
    if (index >= 0) {
      drafts.drafts[index] = updated;
    }
  } catch (error) {
    cardErrors.value[id] = messageOf(error);
  } finally {
    savingId.value = "";
  }
}

async function confirmDraft(id: string) {
  cardErrors.value[id] = "";
  savingId.value = id;
  try {
    await drafts.confirmDraft(id);
    await reload();
  } catch (error) {
    cardErrors.value[id] = messageOf(error);
  } finally {
    savingId.value = "";
  }
}

async function discardDraft(id: string) {
  cardErrors.value[id] = "";
  savingId.value = id;
  try {
    await drafts.discardDraft(id);
    await reload();
  } catch (error) {
    cardErrors.value[id] = messageOf(error);
  } finally {
    savingId.value = "";
  }
}

function toggleSelected(id: string) {
  const index = selectedIds.value.indexOf(id);
  if (index >= 0) {
    selectedIds.value.splice(index, 1);
  } else {
    selectedIds.value.push(id);
  }
}

function toggleSelectAll(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selectedIds.value = checked
    ? drafts.pendingDrafts.map((item) => item.id)
    : [];
}

async function startBatchDiscard() {
  batchMessage.value = "";
  cardErrors.value["batch"] = "";
  try {
    const intent = await drafts.createBatchDiscard(
      selectedIds.value.length ? [...selectedIds.value] : undefined,
      batchReason.value.trim() || "批量清理草稿",
    );
    batchIntent.value = {
      affectedDraftIds: intent.affectedDraftIds,
      confirmationToken: intent.confirmationToken,
    };
  } catch (error) {
    cardErrors.value["batch"] = messageOf(error);
  }
}

async function confirmBatchDiscard() {
  if (!batchIntent.value) {
    return;
  }
  cardErrors.value["batch"] = "";
  try {
    const result = await drafts.confirmBatchDiscard(
      batchIntent.value.confirmationToken,
    );
    batchMessage.value = `已丢弃 ${result.discardedCount} 条草稿。`;
    batchIntent.value = null;
    batchReason.value = "";
    selectedIds.value = [];
    await reload();
  } catch (error) {
    cardErrors.value["batch"] = messageOf(error);
  }
}

function cancelBatchDiscard() {
  batchIntent.value = null;
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "网络异常，请稍后重试";
}
</script>

<template>
  <section class="drafts-page" aria-labelledby="drafts-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">统一录入</p>
        <h1 id="drafts-title">草稿中心</h1>
      </div>
      <div class="filters">
        <RouterLink class="secondary-button" to="/capture">快捷记录</RouterLink>
        <label>
          状态
          <select v-model="statusFilter">
            <option value="PENDING">待确认</option>
            <option value="CONFIRMED">已确认</option>
            <option value="DISCARDED">已丢弃</option>
            <option value="">全部</option>
          </select>
        </label>
      </div>
    </header>

    <p v-if="drafts.errorMessage" class="form-error" role="alert">
      {{ drafts.errorMessage }}
    </p>
    <p v-if="batchMessage" class="form-success" role="status">
      {{ batchMessage }}
    </p>
    <p v-if="cardErrors['batch']" class="form-error" role="alert">
      {{ cardErrors["batch"] }}
    </p>

    <div v-if="statusFilter === 'PENDING'" class="batch-bar">
      <label class="check-label">
        <input
          :checked="
            selectedIds.length === drafts.pendingDrafts.length &&
            drafts.pendingDrafts.length > 0
          "
          type="checkbox"
          @change="toggleSelectAll"
        />
        全选待确认（{{ drafts.pendingDrafts.length }}）
      </label>
      <input
        v-model="batchReason"
        maxlength="500"
        placeholder="批量丢弃原因（必填，将写入审计）"
        class="batch-reason"
      />
      <button
        class="danger-button"
        :disabled="drafts.pendingDrafts.length === 0"
        type="button"
        @click="startBatchDiscard"
      >
        批量丢弃
      </button>
    </div>

    <p v-if="!drafts.loading && drafts.drafts.length === 0" class="empty-copy">
      当前没有草稿。
    </p>
    <div v-else class="draft-list">
      <label v-for="item in drafts.drafts" :key="item.id" class="draft-item">
        <input
          v-if="item.status === 'PENDING' && statusFilter === 'PENDING'"
          :checked="selectedIds.includes(item.id)"
          class="draft-check"
          type="checkbox"
          @change="toggleSelected(item.id)"
        />
        <DraftReviewCard
          :accounts="finance.accounts"
          :categories="finance.categories"
          :draft="item"
          :error-message="cardErrors[item.id]"
          :saving="savingId === item.id"
          @confirm="confirmDraft"
          @discard="discardDraft"
          @save="saveDraft"
        />
      </label>
    </div>

    <div v-if="batchIntent" class="dialog-overlay" role="presentation">
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-title"
      >
        <h2 id="batch-title">二次确认批量丢弃</h2>
        <p class="dialog-copy">
          即将丢弃
          {{ batchIntent.affectedDraftIds.length }}
          条待确认草稿，该操作会写入审计记录且不可恢复。
        </p>
        <p class="dialog-copy">原因：{{ batchReason || "批量清理草稿" }}</p>
        <p v-if="cardErrors['batch']" class="form-error" role="alert">
          {{ cardErrors["batch"] }}
        </p>
        <div class="risk-actions">
          <button
            class="secondary-button"
            type="button"
            @click="cancelBatchDiscard"
          >
            取消
          </button>
          <button
            class="danger-button"
            type="button"
            @click="confirmBatchDiscard"
          >
            确认丢弃
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
