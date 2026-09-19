<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import {
  ApiClientError,
  type DraftStatus,
  type DraftSummary,
  type TransactionDraftPayload,
} from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import DraftReviewCard from "../components/DraftReviewCard.vue";
import EmptyState from "../components/EmptyState.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import { requestAppConfirm } from "../composables/useAppConfirm";
import {
  hasUnsavedChanges,
  useUnsavedChanges,
} from "../composables/useUnsavedChanges";
import { useAuthStore } from "../stores/auth";
import { useDraftsStore } from "../stores/drafts";
import { useFinanceStore } from "../stores/finance";
import { appendReturnTo, useOptionalRoute } from "../utils/navigation";

type StatusFilter =
  Extract<DraftStatus, "PENDING" | "CONFIRMED" | "DISCARDED"> | "";
type BatchIntent = {
  affectedDraftIds: string[];
  confirmationToken: string;
};

const auth = useAuthStore();
const drafts = useDraftsStore();
const finance = useFinanceStore();
const route = useOptionalRoute();

const statusFilter = ref<StatusFilter>("PENDING");
const loadedFilter = ref<StatusFilter | null>(null);
const loadedDrafts = ref<DraftSummary[]>([]);
const loadError = ref("");
const loadSequence = ref(0);
let reloadQueue: Promise<void> = Promise.resolve();
const cardErrors = ref<Record<string, string>>({});
const cardBusy = ref<Record<string, boolean>>({});
const dirtyCardIds = ref<Record<string, boolean>>({});
const staleMutationIds = ref<Record<string, boolean>>({});
const batchReason = ref("");
const batchReasonDirty = computed(() => batchReason.value.trim().length > 0);
const batchIntent = ref<BatchIntent | null>(null);
const batchError = ref("");
const batchMessage = ref("");
const batchLoading = ref(false);
const batchDialogKey = ref(0);
const selectedIds = ref<string[]>([]);
const mutationRefreshMessage =
  "操作已成功提交，但列表刷新失败；请点击“重试”确认最新状态。";
const batchMutationRefreshMessage =
  "批量操作已成功提交，但列表刷新失败；请点击“重试”确认最新状态。";

const hasLoadedCurrent = computed(
  () => loadedFilter.value === statusFilter.value,
);
const visibleDrafts = computed<DraftSummary[]>(() =>
  hasLoadedCurrent.value ? loadedDrafts.value : [],
);
const visiblePendingDrafts = computed(() =>
  visibleDrafts.value.filter((draft) => draft.status === "PENDING"),
);
const actionablePendingDrafts = computed(() =>
  visiblePendingDrafts.value.filter(
    (draft) => !staleMutationIds.value[draft.id],
  ),
);
const hasStaleMutation = computed(
  () => Object.keys(staleMutationIds.value).length > 0,
);
const selectedPendingIds = computed(() =>
  selectedIds.value.filter((id) =>
    actionablePendingDrafts.value.some((draft) => draft.id === id),
  ),
);
const allPendingSelected = computed(
  () =>
    actionablePendingDrafts.value.length > 0 &&
    selectedPendingIds.value.length === actionablePendingDrafts.value.length,
);
const isInitialLoading = computed(
  () => drafts.loading && !hasLoadedCurrent.value,
);
const isRefreshing = computed(() => drafts.loading && hasLoadedCurrent.value);
const quickCaptureTo = computed(() =>
  appendReturnTo("/capture", route?.fullPath ?? "/drafts"),
);
const batchDescription = computed(() => {
  if (!batchIntent.value) return "";
  const description = `即将丢弃 ${batchIntent.value.affectedDraftIds.length} 条待确认草稿。该操作会写入审计记录且不可恢复。原因：${batchReason.value || "批量清理草稿"}`;
  return batchError.value
    ? `${description}\n错误：${batchError.value}`
    : description;
});

const pageDirty = computed(
  () => batchReasonDirty.value || Object.keys(dirtyCardIds.value).length > 0,
);

useUnsavedChanges(pageDirty);

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
    void finance.loadCategories(true);
    void finance.loadAccounts(true);
  }
});

function resetBatchContext() {
  selectedIds.value = [];
  dirtyCardIds.value = {};
  batchIntent.value = null;
  batchError.value = "";
  batchMessage.value = "";
  batchReason.value = "";
}

function setCardDirty(id: string, dirty: boolean) {
  const next = { ...dirtyCardIds.value };
  if (dirty) {
    next[id] = true;
  } else {
    delete next[id];
  }
  dirtyCardIds.value = next;
}

function markMutationStale(ids: string[]) {
  const next = { ...staleMutationIds.value };
  for (const id of ids) {
    next[id] = true;
  }
  staleMutationIds.value = next;
  dirtyCardIds.value = Object.fromEntries(
    Object.entries(dirtyCardIds.value).filter(([id]) => !next[id]),
  );
  selectedIds.value = selectedIds.value.filter((id) => !next[id]);
}

function cardError(id: string): string | undefined {
  if (staleMutationIds.value[id]) {
    return mutationRefreshMessage;
  }
  return cardErrors.value[id];
}

async function handleStatusFilterChange(event: Event) {
  const select = event.target as HTMLSelectElement;
  const nextFilter = select.value as StatusFilter;
  if (nextFilter === statusFilter.value) return;

  if (hasUnsavedChanges.value) {
    const confirmed = await requestAppConfirm({
      cancelLabel: "留在当前筛选",
      confirmLabel: "切换筛选",
      description:
        "当前草稿卡片或批量原因有未保存内容，切换筛选会离开当前编辑上下文。是否继续？",
      destructive: true,
      title: "放弃未保存的内容？",
    });
    if (!confirmed) {
      select.value = statusFilter.value;
      return;
    }
  }

  statusFilter.value = nextFilter;
  resetBatchContext();
  void reload();
}

async function reload(): Promise<boolean> {
  const requestedFilter = statusFilter.value;
  const sequence = ++loadSequence.value;
  loadError.value = "";

  const nextLoad = reloadQueue.then(() =>
    executeReload(requestedFilter, sequence),
  );
  reloadQueue = nextLoad.then(
    () => undefined,
    () => undefined,
  );
  return nextLoad;
}

async function executeReload(
  requestedFilter: StatusFilter,
  sequence: number,
): Promise<boolean> {
  drafts.clearError();

  try {
    await drafts.loadDrafts(requestedFilter || undefined);
  } catch (error) {
    if (
      sequence === loadSequence.value &&
      statusFilter.value === requestedFilter
    ) {
      loadError.value = messageOf(error);
    }
    return false;
  }

  if (
    sequence !== loadSequence.value ||
    statusFilter.value !== requestedFilter ||
    (Boolean(requestedFilter) &&
      Boolean(drafts.lastStatus) &&
      drafts.lastStatus !== requestedFilter)
  ) {
    return false;
  }

  loadError.value = drafts.errorMessage ?? "";
  if (loadError.value) return false;

  loadedFilter.value = requestedFilter;
  loadedDrafts.value = [...drafts.drafts];
  staleMutationIds.value = {};
  batchError.value = "";
  const currentDraftIds = new Set(loadedDrafts.value.map((draft) => draft.id));
  dirtyCardIds.value = Object.fromEntries(
    Object.entries(dirtyCardIds.value).filter(([id]) =>
      currentDraftIds.has(id),
    ),
  );
  selectedIds.value = selectedPendingIds.value;
  return true;
}

function setCardBusy(id: string, busy: boolean) {
  const next = { ...cardBusy.value };
  if (busy) {
    next[id] = true;
  } else {
    delete next[id];
  }
  cardBusy.value = next;
}

function replaceDraft(updated: DraftSummary) {
  drafts.drafts = drafts.drafts.map((draft) =>
    draft.id === updated.id ? updated : draft,
  );
  loadedDrafts.value = loadedDrafts.value.map((draft) =>
    draft.id === updated.id ? updated : draft,
  );
}

async function saveDraft(
  id: string,
  payload: TransactionDraftPayload,
  version: number,
) {
  if (cardBusy.value[id]) return;
  cardErrors.value[id] = "";
  setCardBusy(id, true);
  try {
    const updated = await drafts.updateDraft(id, payload, version);
    replaceDraft(updated);
  } catch (error) {
    cardErrors.value[id] = messageOf(error);
  } finally {
    setCardBusy(id, false);
  }
}

async function confirmDraft(id: string) {
  if (cardBusy.value[id]) return;
  cardErrors.value[id] = "";
  setCardBusy(id, true);
  try {
    const result = await drafts.confirmDraft(id);
    if (result?.draft) {
      replaceDraft(result.draft);
    }
    const refreshed = await reload();
    if (!refreshed) {
      markMutationStale([id]);
    }
  } catch (error) {
    cardErrors.value[id] = messageOf(error);
  } finally {
    setCardBusy(id, false);
  }
}

async function discardDraft(id: string) {
  if (cardBusy.value[id]) return;

  const confirmed = await requestAppConfirm({
    cancelLabel: "保留草稿",
    confirmLabel: "丢弃草稿",
    description: "确定丢弃这条草稿吗？丢弃后不可恢复。",
    destructive: true,
    title: "丢弃这条草稿？",
  });
  if (!confirmed || cardBusy.value[id]) return;

  cardErrors.value[id] = "";
  setCardBusy(id, true);
  try {
    await drafts.discardDraft(id);
    const refreshed = await reload();
    if (!refreshed) {
      markMutationStale([id]);
    }
  } catch (error) {
    cardErrors.value[id] = messageOf(error);
  } finally {
    setCardBusy(id, false);
  }
}

function toggleSelected(id: string) {
  if (!actionablePendingDrafts.value.some((draft) => draft.id === id)) {
    return;
  }
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
    ? actionablePendingDrafts.value.map((draft) => draft.id)
    : [];
}

async function startBatchDiscard() {
  if (
    batchLoading.value ||
    batchIntent.value ||
    hasStaleMutation.value ||
    visiblePendingDrafts.value.length === 0
  ) {
    return;
  }
  batchMessage.value = "";
  batchError.value = "";
  batchLoading.value = true;
  try {
    const intent = await drafts.createBatchDiscard(
      selectedPendingIds.value.length
        ? [...selectedPendingIds.value]
        : undefined,
      batchReason.value.trim() || "批量清理草稿",
    );
    batchIntent.value = {
      affectedDraftIds: intent.affectedDraftIds,
      confirmationToken: intent.confirmationToken,
    };
  } catch (error) {
    batchError.value = messageOf(error);
  } finally {
    batchLoading.value = false;
  }
}

async function confirmBatchDiscard() {
  const intent = batchIntent.value;
  if (!intent || batchLoading.value) return;

  batchError.value = "";
  batchLoading.value = true;
  try {
    const result = await drafts.confirmBatchDiscard(intent.confirmationToken);
    batchIntent.value = null;
    batchReason.value = "";
    selectedIds.value = [];
    const refreshed = await reload();
    if (!refreshed) {
      markMutationStale(intent.affectedDraftIds);
      batchMessage.value = "";
      batchError.value = batchMutationRefreshMessage;
    } else {
      batchMessage.value = `已丢弃 ${result.discardedCount} 条草稿。`;
    }
  } catch (error) {
    batchError.value = messageOf(error);
    // ConfirmDialog suppresses duplicate action events during one open cycle.
    // Remount it after a failure so the same short-lived token can be retried.
    batchDialogKey.value += 1;
  } finally {
    batchLoading.value = false;
  }
}

function cancelBatchDiscard() {
  batchIntent.value = null;
  batchError.value = "";
}

function retryLoad() {
  void reload();
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "网络异常，请稍后重试";
}
</script>

<template>
  <SecondaryPageShell
    class="drafts-page drafts-workspace"
    title="草稿中心"
    title-id="drafts-title"
    subtitle="核对草稿内容，确认后才会正式入账"
  >
    <template #actions>
      <div class="draft-toolbar">
        <RouterLink class="secondary-button" :to="quickCaptureTo"
          >快速新增</RouterLink
        >
        <label class="secondary-page-filter drafts-status-filter">
          <span>状态</span>
          <select
            :value="statusFilter"
            aria-label="草稿状态"
            @change="handleStatusFilterChange"
          >
            <option value="PENDING">待确认</option>
            <option value="CONFIRMED">已确认</option>
            <option value="DISCARDED">已丢弃</option>
            <option value="">全部</option>
          </select>
        </label>
      </div>
    </template>

    <p class="draft-confirmation-note" role="note">
      文本、语音和快捷指令只会生成草稿；确认入账前不会写入正式账单。
    </p>
    <p v-if="batchMessage" class="form-success" role="status">
      {{ batchMessage }}
    </p>
    <p v-if="batchError" class="form-error" role="alert">
      {{ batchError }}
    </p>

    <LoadingState
      v-if="isInitialLoading"
      description="正在获取草稿内容。"
      title="正在加载草稿…"
    />
    <ErrorState
      v-else-if="loadError && !hasLoadedCurrent"
      action-label="重试"
      :description="loadError"
      title="草稿暂时无法加载"
      @retry="retryLoad"
    />
    <template v-else>
      <LoadingState
        v-if="isRefreshing"
        class="draft-refresh-state"
        description="当前列表仍可查看，刷新完成后会更新。"
        title="正在更新草稿…"
      />
      <div
        v-if="loadError && hasLoadedCurrent"
        class="draft-stale-warning"
        role="alert"
      >
        <span>{{ loadError }} 当前显示的是上次成功加载的草稿。</span>
        <button class="secondary-button" type="button" @click="retryLoad">
          重试
        </button>
      </div>

      <section
        v-if="statusFilter === 'PENDING' && hasLoadedCurrent"
        class="batch-bar"
        aria-label="批量处理待确认草稿"
      >
        <label class="check-label draft-select-all">
          <input
            aria-label="全选待确认"
            :checked="allPendingSelected"
            :disabled="hasStaleMutation"
            type="checkbox"
            @change="toggleSelectAll"
          />
          <span>全选待确认（{{ visiblePendingDrafts.length }}）</span>
        </label>
        <label class="batch-reason-field">
          <span>批量丢弃原因</span>
          <input
            v-model="batchReason"
            aria-label="批量丢弃原因"
            maxlength="500"
            placeholder="批量丢弃原因（将写入审计）"
            class="batch-reason"
          />
        </label>
        <button
          class="danger-button"
          :disabled="
            batchLoading ||
            hasStaleMutation ||
            visiblePendingDrafts.length === 0
          "
          type="button"
          @click="startBatchDiscard"
        >
          {{ batchLoading ? "准备中…" : "批量丢弃" }}
        </button>
      </section>

      <EmptyState
        v-if="hasLoadedCurrent && visibleDrafts.length === 0 && !isRefreshing"
        :action="{ label: '快速新增', to: quickCaptureTo }"
        description="快速新增、文本解析和快捷指令生成的内容会先出现在这里。"
        icon="file"
        title="当前没有草稿"
      />
      <ul v-else-if="visibleDrafts.length" class="draft-list">
        <li v-for="item in visibleDrafts" :key="item.id" class="draft-item">
          <input
            v-if="item.status === 'PENDING' && statusFilter === 'PENDING'"
            :aria-label="`选择${item.payload.merchant || '这条草稿'}`"
            :checked="selectedIds.includes(item.id)"
            class="draft-check"
            :disabled="Boolean(staleMutationIds[item.id])"
            type="checkbox"
            @change="toggleSelected(item.id)"
          />
          <DraftReviewCard
            :accounts="finance.accounts"
            :categories="finance.categories"
            :draft="item"
            :error-message="cardError(item.id)"
            :read-only="Boolean(staleMutationIds[item.id])"
            :saving="Boolean(cardBusy[item.id])"
            @dirty-change="setCardDirty"
            @confirm="confirmDraft"
            @discard="discardDraft"
            @save="saveDraft"
          />
        </li>
      </ul>
    </template>

    <ConfirmDialog
      :key="batchDialogKey"
      cancel-label="取消"
      confirm-label="确认丢弃"
      :description="batchDescription"
      destructive
      :open="Boolean(batchIntent)"
      title="二次确认批量丢弃？"
      @cancel="cancelBatchDiscard"
      @confirm="confirmBatchDiscard"
    />
  </SecondaryPageShell>
</template>
