<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  CategorySummary,
  DraftSummary,
  FinancialAccountSummary,
  TransactionDraftPayload,
} from "../api/client";
import { toLocalDateTimeInput, toShanghaiIso } from "../utils/time";
import DateTimeField from "./DateTimeField.vue";

const props = defineProps<{
  accounts: FinancialAccountSummary[];
  categories: CategorySummary[];
  draft: DraftSummary;
  errorMessage?: string;
  readOnly?: boolean;
  saving?: boolean;
}>();

const emit = defineEmits<{
  confirm: [draftId: string];
  discard: [draftId: string];
  dirtyChange: [draftId: string, dirty: boolean];
  save: [draftId: string, payload: TransactionDraftPayload, version: number];
}>();

type DraftType = "EXPENSE" | "INCOME" | "REFUND";

const type = ref<DraftType>("EXPENSE");
const amount = ref("");
const merchant = ref("");
const occurredAt = ref("");
const note = ref("");
const categoryId = ref("");
const accountId = ref("");
const originalSnapshot = ref("");

const editable = computed(
  () => props.draft.status === "PENDING" && !props.readOnly,
);
const hasChanges = computed(
  () => editable.value && currentSnapshot() !== originalSnapshot.value,
);

watch(
  () => props.draft,
  (draft, previousDraft) => {
    // A reload triggered by another card's mutation can replace this prop
    // while local edits are still in progress. Preserve those edits until
    // the server version changes (for example, after this card is saved).
    if (
      hasChanges.value &&
      previousDraft &&
      draft.version === previousDraft.version
    ) {
      return;
    }
    resetFromDraft(draft);
  },
  { deep: true, immediate: true },
);

watch(
  hasChanges,
  (dirty) => {
    emit("dirtyChange", props.draft.id, dirty);
  },
  { immediate: true },
);

const activeCategories = computed(() =>
  props.categories.filter((category) => !category.isArchived),
);
const activeAccounts = computed(() =>
  props.accounts.filter((account) => !account.isArchived),
);

const sourceLabel = computed(() => {
  const labels: Record<string, string> = {
    IMPORT: "导入",
    MANUAL: "手动",
    SHORTCUT: "快捷指令",
    TEXT: "文本解析",
    VOICE: "语音",
  };
  return labels[props.draft.source] ?? props.draft.source;
});

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    CONFIRMED: "已确认",
    DISCARDED: "已丢弃",
    FAILED: "失败",
    PENDING: "待确认",
  };
  return labels[props.draft.status] ?? props.draft.status;
});

const categoryLabel = computed(() =>
  labelForId(props.categories, props.draft.payload.categoryId, "未分类"),
);
const accountLabel = computed(() =>
  labelForId(props.accounts, props.draft.payload.accountId, "未指定"),
);
const draftTitleId = computed(() => `draft-title-${props.draft.id}`);

const confidenceHint = computed(() => {
  const confidence = props.draft.confidence;
  if (!confidence) {
    return "";
  }
  const fields: string[] = [];
  if (typeof confidence.amount === "number") {
    fields.push(`金额 ${percent(confidence.amount)}`);
  }
  if (typeof confidence.merchant === "number") {
    fields.push(`商户 ${percent(confidence.merchant)}`);
  }
  if (fields.length === 0) {
    return "";
  }
  return `识别置信度：${fields.join(" · ")}，请核对后确认。`;
});

function resetFromDraft(draft: DraftSummary) {
  type.value = draft.payload.type;
  amount.value = draft.payload.amount;
  merchant.value = draft.payload.merchant ?? "";
  occurredAt.value = draft.payload.occurredAt
    ? toLocalDateTimeInput(draft.payload.occurredAt)
    : "";
  note.value = draft.payload.note ?? "";
  categoryId.value = draft.payload.categoryId ?? "";
  accountId.value = draft.payload.accountId ?? "";
  originalSnapshot.value = snapshotForPayload(draft.payload);
}

function currentSnapshot(): string {
  return JSON.stringify({
    accountId: accountId.value || null,
    amount: amount.value.trim(),
    categoryId: categoryId.value || null,
    merchant: merchant.value.trim() || null,
    note: note.value.trim() || null,
    occurredAt: occurredAt.value ? toShanghaiIso(occurredAt.value) : undefined,
    type: type.value,
  });
}

function snapshotForPayload(payload: TransactionDraftPayload): string {
  return JSON.stringify({
    accountId: payload.accountId ?? null,
    amount: payload.amount.trim(),
    categoryId: payload.categoryId ?? null,
    merchant: payload.merchant?.trim() || null,
    note: payload.note?.trim() || null,
    occurredAt: payload.occurredAt
      ? toShanghaiIso(toLocalDateTimeInput(payload.occurredAt))
      : undefined,
    type: payload.type,
  });
}

function buildPayload(): TransactionDraftPayload {
  const original = props.draft.payload;
  return {
    ...original,
    accountId: accountId.value || null,
    amount: amount.value.trim(),
    categoryId: categoryId.value || null,
    currency: original.currency ?? "CNY",
    merchant: merchant.value.trim() || null,
    note: note.value.trim() || null,
    occurredAt: occurredAt.value ? toShanghaiIso(occurredAt.value) : undefined,
    type: type.value,
  };
}

function save() {
  if (!editable.value || !hasChanges.value || props.saving) {
    return;
  }
  emit("save", props.draft.id, buildPayload(), props.draft.version);
}

function labelForId(
  items: Array<{ id: string; name: string }>,
  id: string | null | undefined,
  fallback: string,
): string {
  if (!id) return fallback;
  return items.find((item) => item.id === id)?.name ?? "未找到名称";
}

function typeName(value: DraftType): string {
  return value === "INCOME" ? "收入" : value === "REFUND" ? "退款" : "支出";
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
</script>

<template>
  <article
    class="draft-card"
    :class="{ 'is-settled': !editable }"
    :aria-labelledby="draftTitleId"
  >
    <header class="draft-card-head">
      <div class="draft-title">
        <strong :id="draftTitleId">{{ sourceLabel }}</strong>
        <span
          class="status-badge"
          :class="`status-${draft.status.toLowerCase()}`"
          role="status"
        >
          {{ statusLabel }}
        </span>
      </div>
      <small class="draft-time">创建于 {{ formatTime(draft.createdAt) }}</small>
    </header>

    <p class="draft-status-copy" role="note">
      状态：{{ statusLabel
      }}<span v-if="editable"
        >；当前仍是草稿，确认入账前不会写入正式账单。</span
      >
    </p>

    <p v-if="confidenceHint" class="confidence-hint" role="note">
      {{ confidenceHint }}
    </p>
    <p v-if="draft.failureReason" class="draft-failure" role="alert">
      失败原因：{{ draft.failureReason }}
    </p>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>

    <div v-if="editable" class="draft-form">
      <label class="draft-field">
        <span>类型</span>
        <select v-model="type" aria-label="草稿类型" :disabled="saving">
          <option value="EXPENSE">支出</option>
          <option value="INCOME">收入</option>
          <option value="REFUND">退款</option>
        </select>
      </label>
      <label class="draft-field">
        <span>金额</span>
        <input
          v-model="amount"
          aria-label="草稿金额"
          inputmode="decimal"
          placeholder="0.00"
          :disabled="saving"
        />
      </label>
      <label class="draft-field">
        <span>商户</span>
        <input
          v-model="merchant"
          aria-label="草稿商户"
          maxlength="100"
          :disabled="saving"
        />
      </label>
      <label class="draft-field">
        <span>时间</span>
        <DateTimeField v-model="occurredAt" :disabled="saving" />
      </label>
      <label class="draft-field">
        <span>分类</span>
        <select v-model="categoryId" aria-label="草稿分类" :disabled="saving">
          <option value="">未分类</option>
          <option
            v-for="category in activeCategories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
      </label>
      <label class="draft-field">
        <span>账户</span>
        <select v-model="accountId" aria-label="草稿账户" :disabled="saving">
          <option value="">未指定</option>
          <option
            v-for="account in activeAccounts"
            :key="account.id"
            :value="account.id"
          >
            {{ account.name }}
          </option>
        </select>
      </label>
      <label class="draft-field draft-field-wide">
        <span>备注</span>
        <textarea
          v-model="note"
          aria-label="草稿备注"
          maxlength="500"
          rows="2"
          :disabled="saving"
        ></textarea>
      </label>

      <div class="draft-actions">
        <button
          class="secondary-button"
          :disabled="!hasChanges || saving"
          type="button"
          @click="save"
        >
          保存修改
        </button>
        <button
          class="primary-button"
          :disabled="hasChanges || saving"
          type="button"
          @click="emit('confirm', draft.id)"
        >
          确认入账
        </button>
        <button
          class="danger-button"
          :disabled="saving"
          type="button"
          @click="emit('discard', draft.id)"
        >
          丢弃
        </button>
      </div>
    </div>

    <dl v-else class="draft-readonly">
      <div>
        <dt>类型</dt>
        <dd>{{ typeName(draft.payload.type) }}</dd>
      </div>
      <div>
        <dt>金额</dt>
        <dd>¥{{ draft.payload.amount }}</dd>
      </div>
      <div>
        <dt>商户</dt>
        <dd>{{ draft.payload.merchant || "—" }}</dd>
      </div>
      <div>
        <dt>时间</dt>
        <dd>
          {{ formatTime(draft.payload.occurredAt ?? draft.createdAt) }}
        </dd>
      </div>
      <div>
        <dt>分类</dt>
        <dd>{{ categoryLabel }}</dd>
      </div>
      <div>
        <dt>账户</dt>
        <dd>{{ accountLabel }}</dd>
      </div>
      <div class="draft-readonly-wide">
        <dt>备注</dt>
        <dd>{{ draft.payload.note || "—" }}</dd>
      </div>
    </dl>
  </article>
</template>

<script lang="ts">
function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
</script>
