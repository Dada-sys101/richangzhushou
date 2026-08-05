<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  CategorySummary,
  DraftSummary,
  FinancialAccountSummary,
  TransactionDraftPayload,
} from "../api/client";

const props = defineProps<{
  accounts: FinancialAccountSummary[];
  categories: CategorySummary[];
  draft: DraftSummary;
  errorMessage?: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  confirm: [draftId: string];
  discard: [draftId: string];
  save: [draftId: string, payload: TransactionDraftPayload, version: number];
}>();

const type = ref<"EXPENSE" | "INCOME" | "REFUND">(props.draft.payload.type);
const amount = ref(props.draft.payload.amount);
const merchant = ref(props.draft.payload.merchant ?? "");
const occurredAt = ref(
  isoToLocalInput(props.draft.payload.occurredAt ?? new Date().toISOString()),
);
const note = ref(props.draft.payload.note ?? "");
const categoryId = ref(props.draft.payload.categoryId ?? "");
const accountId = ref(props.draft.payload.accountId ?? "");
const dirty = ref(false);

watch(
  () => props.draft,
  (draft) => {
    type.value = draft.payload.type;
    amount.value = draft.payload.amount;
    merchant.value = draft.payload.merchant ?? "";
    occurredAt.value = isoToLocalInput(
      draft.payload.occurredAt ?? new Date().toISOString(),
    );
    note.value = draft.payload.note ?? "";
    categoryId.value = draft.payload.categoryId ?? "";
    accountId.value = draft.payload.accountId ?? "";
    dirty.value = false;
  },
  { deep: true, immediate: true },
);

const sourceLabel = computed(() => {
  const labels: Record<string, string> = {
    IMPORT: "导入",
    MANUAL: "手动",
    OCR: "OCR 识别",
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

const editable = computed(() => props.draft.status === "PENDING");

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

function markDirty() {
  if (editable.value) {
    dirty.value = true;
  }
}

function buildPayload(): TransactionDraftPayload {
  return {
    accountId: accountId.value || null,
    amount: amount.value.trim(),
    categoryId: categoryId.value || null,
    currency: "CNY",
    merchant: merchant.value.trim() || null,
    note: note.value.trim() || null,
    occurredAt: occurredAt.value
      ? new Date(occurredAt.value).toISOString()
      : undefined,
    type: type.value,
  };
}

function save() {
  if (!dirty.value) {
    return;
  }
  emit("save", props.draft.id, buildPayload(), props.draft.version);
}

function isoToLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
</script>

<template>
  <article class="draft-card" :class="{ 'is-settled': !editable }">
    <header class="draft-card-head">
      <div class="draft-title">
        <strong>{{ sourceLabel }}</strong>
        <span
          class="status-badge"
          :class="`status-${draft.status.toLowerCase()}`"
        >
          {{ statusLabel }}
        </span>
      </div>
      <small class="draft-time">{{ formatTime(draft.createdAt) }}</small>
    </header>

    <p v-if="confidenceHint" class="confidence-hint" role="note">
      {{ confidenceHint }}
    </p>

    <div v-if="editable" class="draft-form">
      <label class="draft-field">
        类型
        <select v-model="type" @change="markDirty">
          <option value="EXPENSE">支出</option>
          <option value="INCOME">收入</option>
          <option value="REFUND">退款</option>
        </select>
      </label>
      <label class="draft-field">
        金额
        <input
          v-model="amount"
          inputmode="decimal"
          placeholder="0.00"
          @input="markDirty"
        />
      </label>
      <label class="draft-field">
        商户
        <input v-model="merchant" maxlength="100" @input="markDirty" />
      </label>
      <label class="draft-field">
        时间
        <input v-model="occurredAt" type="datetime-local" @change="markDirty" />
      </label>
      <label class="draft-field">
        分类
        <select v-model="categoryId" @change="markDirty">
          <option value="">未分类</option>
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
      </label>
      <label class="draft-field">
        账户
        <select v-model="accountId" @change="markDirty">
          <option value="">未指定</option>
          <option
            v-for="account in accounts"
            :key="account.id"
            :value="account.id"
          >
            {{ account.name }}
          </option>
        </select>
      </label>
      <label class="draft-field draft-field-wide">
        备注
        <textarea
          v-model="note"
          maxlength="500"
          rows="2"
          @input="markDirty"
        ></textarea>
      </label>

      <p v-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="draft-actions">
        <button
          class="secondary-button"
          :disabled="!dirty || saving"
          type="button"
          @click="save"
        >
          保存修改
        </button>
        <button
          class="primary-button"
          :disabled="saving"
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
