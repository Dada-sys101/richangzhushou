<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import type { AiOperation, AiProposalDetail } from "../api/client";
import AiOperationCard from "../components/AiOperationCard.vue";
import { useAiStore, type AiProposalLoadMode } from "../stores/ai";

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
const routeTargetMismatch = computed(
  () => Boolean(proposal.value) && proposal.value?.id !== proposalId.value,
);
const mutationLocked = computed(
  () =>
    routeTargetMismatch.value ||
    ai.authoritativeRefreshPending ||
    ai.authoritativeRefreshRequired,
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

const canRejectProposal = computed(
  () => status.value === "PENDING_REVIEW" && !saving.value,
);

const canFinalConfirm = computed(
  () =>
    isReviewable.value && acceptedOperations.value.length > 0 && !saving.value,
);

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
  if (!window.confirm("确定要拒绝整个 Proposal 吗？此操作不可撤销。")) {
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
    !proposal.value ||
    proposal.value.id !== targetProposalId ||
    mutationLocked.value
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
    conflictMessage.value = "Proposal 已发生变化，请重新确认";
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
  return operation.operationType;
}
</script>

<template>
  <section class="proposal-review-page" aria-labelledby="review-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">AI 提案</p>
        <h1 id="review-title">提案核对</h1>
      </div>
      <RouterLink class="secondary-button" to="/ai">新建提案</RouterLink>
    </header>

    <p v-if="errorKind === 'NOT_FOUND'" class="form-error" role="alert">
      未找到该提案，可能已被删除或不存在。
      <RouterLink class="text-button" to="/ai">返回 AI 助手</RouterLink>
    </p>

    <template v-else-if="loading && !proposal">
      <div class="auth-state-card loading-card" aria-busy="true">
        <span class="spinner" aria-hidden="true"></span>
        <p class="auth-state-message">正在加载提案…</p>
      </div>
    </template>

    <template v-else-if="proposal">
      <div class="proposal-meta">
        <p class="eyebrow">状态</p>
        <span
          class="status-badge"
          :class="`status-${proposal.status.toLowerCase()}`"
        >
          {{ proposal.status }}
        </span>
        <small v-if="proposal.completedAt" class="draft-time">
          完成于 {{ new Date(proposal.completedAt).toLocaleString("zh-CN") }}
        </small>
      </div>

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

      <div class="operation-list">
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

      <div v-if="canRejectProposal" class="proposal-actions">
        <button
          class="danger-button reject-proposal-button"
          :disabled="rejectProposalConfirming || mutationLocked"
          type="button"
          @click="rejectProposal"
        >
          {{ rejectProposalConfirming ? "拒绝中…" : "拒绝整个 Proposal" }}
        </button>
      </div>

      <section
        v-if="canFinalConfirm"
        class="final-confirm-panel"
        aria-labelledby="final-confirm-title"
      >
        <h2 id="final-confirm-title">最终确认写入</h2>
        <p class="panel-copy">
          即将正式写入 {{ acceptedOperations.length }} 项，写入后无法撤销。
        </p>
        <ul class="final-confirm-list">
          <li v-for="operation in acceptedOperations" :key="operation.id">
            {{ operationLabel(operation) }}
            <span class="schedule-tag">{{ operation.operationType }}</span>
          </li>
        </ul>
        <p class="panel-copy warning-copy">
          点击下方按钮后才会写入正式业务记录。
        </p>
        <button
          class="primary-button final-confirm-button"
          :disabled="confirming || saving || mutationLocked"
          type="button"
          @click="finalConfirm"
        >
          {{ confirming ? "写入中…" : "最终确认并写入" }}
        </button>
      </section>
    </template>
  </section>
</template>
