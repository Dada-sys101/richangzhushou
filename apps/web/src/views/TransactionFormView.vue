<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import { useTripsStore } from "../stores/trips";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const finance = useFinanceStore();
const trips = useTripsStore();

const editingId = typeof route.params.id === "string" ? route.params.id : null;
const type = ref<"EXPENSE" | "INCOME" | "REFUND">("EXPENSE");
const amount = ref("");
const occurredAt = ref(defaultOccurredAt());
const categoryId = ref("");
const accountId = ref("");
const merchant = ref("");
const note = ref("");
const originalTransactionId = ref("");
const isUnlinkedRefund = ref(false);
const tripId = ref("");
const version = ref(1);
const errorMessage = ref("");
const successMessage = ref("");
const duplicateWarning = ref<string | null>(null);
const submitting = ref(false);

const expenseTransactions = computed(() =>
  finance.transactions.filter((item) => item.type === "EXPENSE"),
);

const categoriesForType = computed(() =>
  finance.categories.filter(
    (item) =>
      !item.isArchived &&
      (type.value === "INCOME"
        ? item.kind === "INCOME"
        : item.kind === "EXPENSE"),
  ),
);

const activeAccounts = computed(() =>
  finance.accounts.filter((item) => !item.isArchived),
);

onMounted(async () => {
  if (!auth.isAuthenticated) {
    return;
  }
  await Promise.all([
    finance.loadCategories(true),
    finance.loadAccounts(true),
    finance.loadTransactions(),
    trips.loadTrips(),
  ]);
  if (editingId) {
    try {
      const item = await finance.getTransaction(editingId);
      type.value = item.type;
      amount.value = item.amount;
      occurredAt.value = toLocalInputValue(item.occurredAt);
      categoryId.value = item.categoryId ?? "";
      accountId.value = item.accountId ?? "";
      merchant.value = item.merchant ?? "";
      note.value = item.note ?? "";
      originalTransactionId.value = item.originalTransactionId ?? "";
      isUnlinkedRefund.value = item.isUnlinkedRefund;
      tripId.value = item.tripId ?? "";
      version.value = item.version;
    } catch (error) {
      errorMessage.value = messageOf(error);
    }
  }
});

async function submit() {
  errorMessage.value = "";
  successMessage.value = "";
  duplicateWarning.value = null;
  submitting.value = true;
  const body = {
    accountId: accountId.value || null,
    amount: amount.value,
    categoryId: categoryId.value || null,
    isUnlinkedRefund: isUnlinkedRefund.value,
    merchant: merchant.value.trim() || null,
    note: note.value.trim() || null,
    occurredAt: new Date(occurredAt.value).toISOString(),
    originalTransactionId: originalTransactionId.value || null,
    tripId: tripId.value || null,
    type: type.value,
  };
  try {
    const result = editingId
      ? await finance.updateTransaction(editingId, {
          ...body,
          version: version.value,
        })
      : await finance.createTransaction(body);
    if (result.duplicateWarning) {
      duplicateWarning.value = result.duplicateWarning.message;
    }
    successMessage.value = "账单已保存";
    await router.replace("/transactions");
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    submitting.value = false;
  }
}

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) {
    const field = error.fieldErrors?.[0];
    return field ? `${field.message}` : error.message;
  }
  return "操作失败，请稍后重试";
}
</script>

<template>
  <section class="finance-page form-page" aria-labelledby="form-title">
    <p class="eyebrow">记账</p>
    <h1 id="form-title">{{ editingId ? "编辑账单" : "记一笔" }}</h1>

    <p v-if="finance.errorMessage" class="form-error" role="alert">
      {{ finance.errorMessage }}
    </p>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="form-success" role="status">
      {{ successMessage }}
    </p>
    <div v-if="duplicateWarning" class="warning-banner" role="status">
      {{ duplicateWarning }}
    </div>

    <form class="auth-form" @submit.prevent="submit">
      <label>
        类型
        <select v-model="type">
          <option value="EXPENSE">支出</option>
          <option value="INCOME">收入</option>
          <option value="REFUND">退款</option>
        </select>
      </label>
      <label>
        金额（元）
        <input
          v-model="amount"
          inputmode="decimal"
          placeholder="0.00"
          required
          step="0.01"
          type="text"
        />
      </label>
      <label>
        时间
        <input v-model="occurredAt" required type="datetime-local" />
      </label>
      <label>
        分类
        <select v-model="categoryId">
          <option value="">不分类</option>
          <option
            v-for="item in categoriesForType"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </option>
        </select>
      </label>
      <label>
        账户
        <select v-model="accountId">
          <option value="">不指定</option>
          <option
            v-for="item in activeAccounts"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </option>
        </select>
      </label>
      <label>
        行程（可选）
        <select v-model="tripId">
          <option value="">不关联</option>
          <option
            v-for="item in trips.trips.filter(
              (trip) => trip.deletedAt === null,
            )"
            :key="item.id"
            :value="item.id"
          >
            {{ item.title }}（{{ item.startDate }}）
          </option>
        </select>
      </label>
      <label>
        商户/说明
        <input
          v-model="merchant"
          maxlength="100"
          placeholder="例如：便利店"
          type="text"
        />
      </label>
      <label>
        备注
        <textarea v-model="note" maxlength="500" rows="3"></textarea>
      </label>

      <fieldset v-if="type === 'REFUND'" class="refund-fields">
        <legend>退款关联</legend>
        <label class="check-label">
          <input v-model="isUnlinkedRefund" type="checkbox" />
          无原单退款（不引用原账单）
        </label>
        <label v-if="!isUnlinkedRefund">
          原账单
          <select v-model="originalTransactionId">
            <option value="">选择一笔支出</option>
            <option
              v-for="item in expenseTransactions"
              :key="item.id"
              :value="item.id"
            >
              {{ item.merchant || "支出" }} · {{ item.amount }}
            </option>
          </select>
        </label>
      </fieldset>

      <div class="form-actions">
        <button class="primary-button" :disabled="submitting" type="submit">
          {{ submitting ? "保存中…" : "保存" }}
        </button>
        <RouterLink class="secondary-button" to="/transactions"
          >取消</RouterLink
        >
      </div>
    </form>
  </section>
</template>

<script lang="ts">
function defaultOccurredAt(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
</script>
