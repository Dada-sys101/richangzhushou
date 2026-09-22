<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import type { AiOperation, AiProposalDetail } from "../api/client";
import AiOperationCard from "../components/AiOperationCard.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import { requestAppConfirm } from "../composables/useAppConfirm";
import { useAiStore, type AiProposalLoadMode } from "../stores/ai";
import { appendReturnTo } from "../utils/navigation";

const route = useRoute();
const ai = useAiStore();

const savingOperationId = ref("");
const confirming = ref(false);
const rejectProposalConfirming = ref(false);
const conflictMessage = ref("");
const refreshFailureMessage = ref("");

const proposalId = computed(() => String(route.params.proposalId ?? ""));

const proposal = computed<AiProposalDetail | null>(() => ai.proposal);
const status = computed(() => proposal.value?.status ?? null);
const loading = computed(() => ai.loading);
const saving = computed(() => ai.saving);
const errorMessage = computed(() => ai.errorMessage);
const errorKind = computed(() => ai.errorKind);

function withProposalSource(path: string) {
  return appendReturnTo(path, route.fullPath);
}
const routeTargetMismatch = computed(
  () => Boolean(proposal.value) && proposal.value?.id !== proposalId.value,
);
const mutationLocked = computed(
  () =>
    routeTargetMismatch.value ||
    ai.authoritativeRefreshPending ||
    ai.authoritativeRefreshRequired ||
    saving.value ||
    confirming.value ||
    rejectProposalConfirming.value ||
    Boolean(savingOperationId.value) ||
    !isReviewable.value,
);

const reviewableStatuses = ["PENDING_REVIEW", "PARTIALLY_APPLIED"] as const;

const isReviewable = computed(() =>
  reviewableStatuses.includes(
    status.value as (typeof reviewableStatuses)[number],
  ),
);

const acceptedOperations = computed(() =>
  (proposal.value?.operations ?? []).filter(
    (operation) => operation.status === "ACCEPTED",
  ),
);

const pendingOperations = computed(() =>
  (proposal.value?.operations ?? []).filter(
    (operation) => operation.status === "PENDING",
  ),
);

const canRejectProposal = computed(() => status.value === "PENDING_REVIEW");

const showFinalConfirmPanel = computed(
  () =>
    Boolean(proposal.value) &&
    !routeTargetMismatch.value &&
    isReviewable.value &&
    acceptedOperations.value.length > 0,
);

const canFinalConfirm = computed(
  () =>
    showFinalConfirmPanel.value &&
    !loading.value &&
    !saving.value &&
    !confirming.value &&
    !mutationLocked.value,
);

const proposalStatusLabel = computed(() => {
  const labels: Record<string, string> = {
    APPLIED: "已写入",
    EXPIRED: "已过期",
    FAILED: "失败",
    PARTIALLY_APPLIED: "部分写入",
    PENDING_REVIEW: "待核对",
    REJECTED: "已拒绝",
  };
  return proposal.value
    ? (labels[proposal.value.status] ?? proposal.value.status)
    : "";
});

const proposalStatusDescription = computed(() => {
  const descriptions: Record<string, string> = {
    APPLIED: "全部已完成写入，当前提案不再需要审核。",
    EXPIRED: "提案已过期，不能继续接受或写入操作。",
    FAILED: "提案处理失败，当前不能继续写入操作。",
    PARTIALLY_APPLIED: "部分已写入；可继续处理仍被接受的操作。",
    PENDING_REVIEW: "请先逐项核对建议，再选择需要写入的操作。",
    REJECTED: "整个提案已被拒绝，当前不再执行任何操作。",
  };
  return proposal.value
    ? (descriptions[proposal.value.status] ?? "请核对当前提案状态。")
    : "";
});

const operationTypesSummary = computed(() => {
  const labels = Array.from(
    new Set((proposal.value?.operations ?? []).map(operationLabel)),
  );
  return labels.join("、") || "暂无操作";
});

const reviewProgressSummary = computed(() => {
  if (!proposal.value) return "";
  if (!isReviewable.value) return proposalStatusDescription.value;
  if (pendingOperations.value.length > 0) {
    return `还有 ${pendingOperations.value.length} 项操作等待核对。`;
  }
  if (acceptedOperations.value.length > 0) {
    return `已有 ${acceptedOperations.value.length} 项操作等待最终确认。`;
  }
  return "所有操作均未接受，不会写入任何正式数据。";
});

watch(
  () => proposalId.value,
  () => {
    if (proposalId.value) {
      void loadProposal();
    }
  },
);

onMounted(() => {
  if (proposalId.value) {
    void loadProposal();
  }
});

interface ProposalLoadOptions {
  mode?: AiProposalLoadMode;
  preserveStateChangeMessage?: boolean;
}

async function loadProposal(options: ProposalLoadOptions = {}) {
  const requestedProposalId = proposalId.value;
  if (!requestedProposalId) {
    return;
  }
  const mode = options.mode ?? "NORMAL";
  if (!options.preserveStateChangeMessage) {
    conflictMessage.value = "";
  }
  if (mode === "AUTHORITATIVE_RECOVERY") {
    refreshFailureMessage.value = "";
  }
  try {
    const loadedProposal = await ai.getProposal(requestedProposalId, mode);
    if (loadedProposal) {
      refreshFailureMessage.value = "";
    }
  } catch {
    if (mode === "AUTHORITATIVE_RECOVERY") {
      refreshFailureMessage.value = "最新状态获取失败，请重试刷新";
    }
  }
}

function retryAuthoritativeRefresh() {
  void loadProposal({
    mode: "AUTHORITATIVE_RECOVERY",
    preserveStateChangeMessage: true,
  });
}

async function saveOperation(
  operationId: string,
  fields: Record<string, unknown>,
) {
  const targetProposalId = proposalId.value;
  if (
    !proposal.value ||
    proposal.value.id !== targetProposalId ||
    mutationLocked.value
  ) {
    return;
  }
  savingOperationId.value = operationId;
  conflictMessage.value = "";
  try {
    await ai.editOperation(targetProposalId, operationId, {
      fields,
      version: proposal.value.version,
    });
  } catch {
    handleMutationError(targetProposalId);
  } finally {
    savingOperationId.value = "";
  }
}

async function acceptOperation(operationId: string) {
  const targetProposalId = proposalId.value;
  if (
    !proposal.value ||
    proposal.value.id !== targetProposalId ||
    mutationLocked.value
  ) {
    return;
  }
  savingOperationId.value = operationId;
  conflictMessage.value = "";
  try {
    await ai.acceptOperation(
      targetProposalId,
      operationId,
      proposal.value.version,
    );
  } catch {
    handleMutationError(targetProposalId);
  } finally {
    savingOperationId.value = "";
  }
}

async function rejectOperation(operationId: string) {
  const targetProposalId = proposalId.value;
  if (
    !proposal.value ||
    proposal.value.id !== targetProposalId ||
    mutationLocked.value
  ) {
    return;
  }
  savingOperationId.value = operationId;
  conflictMessage.value = "";
  try {
    await ai.rejectOperation(
      targetProposalId,
      operationId,
      proposal.value.version,
    );
  } catch {
    handleMutationError(targetProposalId);
  } finally {
    savingOperationId.value = "";
  }
}

async function rejectProposal() {
  const targetProposalId = proposalId.value;
  if (
    !proposal.value ||
    proposal.value.id !== targetProposalId ||
    mutationLocked.value
  ) {
    return;
  }
  if (
    !(await requestAppConfirm({
      confirmLabel: "拒绝",
      description: "确定要拒绝整个方案吗？此操作不可撤销。",
      destructive: true,
      title: "拒绝整个方案？",
    }))
  ) {
    return;
  }
  if (
    !proposal.value ||
    proposal.value.id !== targetProposalId ||
    mutationLocked.value
  ) {
    return;
  }
  rejectProposalConfirming.value = true;
  conflictMessage.value = "";
  try {
    await ai.rejectProposal(targetProposalId, proposal.value.version);
  } catch {
    handleMutationError(targetProposalId);
  } finally {
    rejectProposalConfirming.value = false;
  }
}

async function finalConfirm() {
  const targetProposalId = proposalId.value;
  if (
    confirming.value ||
    saving.value ||
    mutationLocked.value ||
    !proposal.value ||
    proposal.value.id !== targetProposalId ||
    routeTargetMismatch.value ||
    !showFinalConfirmPanel.value ||
    acceptedOperations.value.length === 0
  ) {
    return;
  }
  // Exact scope: all currently ACCEPTED operations, ordered by ordinal ASC.
  const operationIds = [...acceptedOperations.value]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((operation) => operation.id);
  if (operationIds.length === 0) {
    return;
  }
  confirming.value = true;
  conflictMessage.value = "";
  try {
    await ai.finalConfirm(targetProposalId, {
      operationIds,
      version: proposal.value.version,
    });
  } catch {
    handleMutationError(targetProposalId);
  } finally {
    confirming.value = false;
  }
}

function handleMutationError(targetProposalId: string) {
  if (
    targetProposalId !== proposalId.value ||
    proposal.value?.id !== targetProposalId
  ) {
    return;
  }
  if (ai.errorKind === "CONFLICT") {
    conflictMessage.value = "提案已发生变化，请重新确认";
    void loadProposal({
      mode: "AUTHORITATIVE_RECOVERY",
      preserveStateChangeMessage: true,
    });
  } else if (ai.errorKind === "STATE_CHANGED") {
    conflictMessage.value = "操作状态已发生变化，已刷新最新数据";
    void loadProposal({
      mode: "AUTHORITATIVE_RECOVERY",
      preserveStateChangeMessage: true,
    });
  }
}

function operationLabel(operation: AiOperation): string {
  const labels: Record<string, string> = {
    CALENDAR_EVENT: "日程",
    REMINDER: "提醒",
    TASK: "待办",
    TRANSACTION: "账单",
    TRIP: "行程",
  };
  return labels[operation.operationType] ?? operation.operationType;
}
</script>

<template>
  <SecondaryPageShell
    class="proposal-review-page proposal-review-workspace"
    title="提案核对"
    title-id="review-title"
    subtitle="逐项确认建议，最终确认后才会写入"
  >
    <template #actions>
      <RouterLink class="secondary-button" :to="withProposalSource('/ai')"
        >新建提案</RouterLink
      >
    </template>

    <ErrorState
      v-if="errorKind === 'NOT_FOUND'"
      description="未找到该提案，可能已被删除或不存在。"
      title="提案不存在"
    />

    <template v-else-if="loading && !proposal">
      <LoadingState
        description="正在获取需要审核的提案。"
        title="正在加载提案"
      />
    </template>

    <template v-else-if="proposal">
      <section
        class="proposal-status-summary"
        aria-labelledby="proposal-status-title"
      >
        <div class="proposal-status-summary__heading">
          <p class="eyebrow">当前提案</p>
          <h2 id="proposal-status-title">{{ proposalStatusLabel }}</h2>
        </div>
        <span
          class="status-badge"
          :class="`status-${proposal.status.toLowerCase()}`"
        >
          状态：{{ proposalStatusLabel }}
        </span>
        <p class="proposal-status-summary__description" role="status">
          {{ proposalStatusDescription }}
        </p>
        <p class="proposal-status-summary__progress">
          {{ reviewProgressSummary }}
        </p>
        <small v-if="proposal.completedAt" class="draft-time">
          完成于 {{ new Date(proposal.completedAt).toLocaleString("zh-CN") }}
        </small>
      </section>

      <section
        class="proposal-request-summary"
        aria-labelledby="proposal-request-title"
      >
        <p class="eyebrow">本次需求概览</p>
        <h2 id="proposal-request-title">
          将审核 {{ proposal.operations.length }} 项建议
        </h2>
        <p>
          涉及{{
            operationTypesSummary
          }}。原始输入不会在此页面重复保存或伪造展示。
        </p>
      </section>

      <p v-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>
      <p v-if="conflictMessage" class="form-error" role="alert">
        {{ conflictMessage }}
      </p>
      <p v-if="ai.authoritativeRefreshPending" class="form-error" role="status">
        正在获取最新状态，当前提案暂时只读。
      </p>
      <p v-if="refreshFailureMessage" class="form-error" role="alert">
        {{ refreshFailureMessage }}
      </p>
      <button
        v-if="mutationLocked && !ai.authoritativeRefreshPending"
        class="secondary-button refresh-proposal-button"
        :disabled="loading"
        type="button"
        @click="retryAuthoritativeRefresh"
      >
        重新加载最新状态
      </button>

      <section
        class="proposal-operation-section"
        aria-labelledby="proposal-operations-title"
      >
        <div class="proposal-operation-section__heading">
          <div>
            <p class="eyebrow">逐项审核</p>
            <h2 id="proposal-operations-title">操作列表</h2>
          </div>
          <p class="proposal-operation-section__count" role="status">
            共 {{ proposal.operations.length }} 项，待核对
            {{ pendingOperations.length }} 项
          </p>
        </div>

        <div v-if="proposal.operations.length" class="operation-list">
          <AiOperationCard
            v-for="operation in proposal.operations"
            :key="operation.id"
            :operation="operation"
            :proposal-version="proposal.version"
            :saving="savingOperationId === operation.id"
            :mutation-locked="mutationLocked"
            @save="saveOperation"
            @accept="acceptOperation"
            @reject="rejectOperation"
          />
        </div>
        <p v-else class="proposal-empty-operations" role="status">
          此提案没有可审核的操作，不会写入正式数据。
        </p>
      </section>

      <section v-if="canRejectProposal" class="proposal-secondary-actions">
        <div>
          <p class="eyebrow">不采用此方案</p>
          <h2>拒绝整个提案</h2>
          <p>拒绝后不会写入此提案中的任何操作。</p>
        </div>
        <button
          class="danger-button reject-proposal-button"
          :disabled="rejectProposalConfirming || mutationLocked"
          type="button"
          @click="rejectProposal"
        >
          {{ rejectProposalConfirming ? "拒绝中…" : "拒绝整个提案" }}
        </button>
      </section>

      <section
        v-if="showFinalConfirmPanel"
        class="final-confirm-panel"
        aria-labelledby="final-confirm-title"
      >
        <div class="final-confirm-panel__heading">
          <p class="eyebrow">最后一步</p>
          <h2 id="final-confirm-title">最终确认写入</h2>
        </div>
        <p class="panel-copy">
          只有你在上方明确确认的操作会在最终确认后写入；未确认或已拒绝的操作不会被应用。
        </p>
        <p class="panel-copy">
          即将正式写入 {{ acceptedOperations.length }} 项，写入后无法撤销。
        </p>
        <ul class="final-confirm-list">
          <li v-for="operation in acceptedOperations" :key="operation.id">
            {{ operationLabel(operation) }}
          </li>
        </ul>
        <button
          class="primary-button final-confirm-button"
          :disabled="!canFinalConfirm"
          type="button"
          @click="finalConfirm"
        >
          {{ confirming ? "写入中…" : "最终确认并写入" }}
        </button>
      </section>
    </template>
  </SecondaryPageShell>
</template>
