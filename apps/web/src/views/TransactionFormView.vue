<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { ApiClientError } from "../api/client";
import DateTimeField from "../components/DateTimeField.vue";
import FormActions from "../components/FormActions.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import SectionCard from "../components/SectionCard.vue";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import { useTripsStore } from "../stores/trips";
import { safeReturnTo } from "../utils/navigation";

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
const returnTarget = computed(() =>
  safeReturnTo(route.query, route.meta.page?.parent?.path ?? "/"),
);
const formSnapshot = computed(() =>
  JSON.stringify({
    accountId: accountId.value,
    amount: amount.value,
    categoryId: categoryId.value,
    isUnlinkedRefund: isUnlinkedRefund.value,
    merchant: merchant.value,
    note: note.value,
    occurredAt: occurredAt.value,
    originalTransactionId: originalTransactionId.value,
    tripId: tripId.value,
    type: type.value,
  }),
);
const initialSnapshot = ref(formSnapshot.value);
const { allowNavigation } = useUnsavedChanges(
  computed(() => formSnapshot.value !== initialSnapshot.value),
);

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
      initialSnapshot.value = formSnapshot.value;
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
    initialSnapshot.value = formSnapshot.value;
    allowNavigation();
    await router.replace(returnTarget.value);
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
  <SecondaryPageShell
    :title="editingId ? '编辑账单' : '记一笔'"
    class="finance-page transaction-form-page"
    subtitle="记账"
    title-id="form-title"
  >
    <div
      v-if="finance.errorMessage || errorMessage"
      class="transaction-form-feedback"
      role="alert"
    >
      {{ errorMessage || finance.errorMessage }}
    </div>
    <p
      v-if="successMessage"
      class="form-success transaction-form-feedback"
      role="status"
    >
      {{ successMessage }}
    </p>
    <div
      v-if="duplicateWarning"
      class="warning-banner transaction-form-feedback"
      role="status"
    >
      {{ duplicateWarning }}
    </div>

    <form class="transaction-form" @submit.prevent="submit">
      <SectionCard
        title="基本信息"
        description="填写账单类型、金额和实际发生时间。"
      >
        <div class="transaction-form-grid">
          <label class="transaction-form-field">
            <span>类型</span>
            <select v-model="type">
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
              <option value="REFUND">退款</option>
            </select>
          </label>
          <label class="transaction-form-field transaction-amount-field">
            <span>金额（元）</span>
            <input
              v-model="amount"
              inputmode="decimal"
              placeholder="0.00"
              required
              step="0.01"
              type="text"
            />
          </label>
          <label class="transaction-form-field transaction-time-field">
            <span>时间</span>
            <DateTimeField v-model="occurredAt" required />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="分类与关联"
        description="分类和账户可留空，也可以关联到已有行程。"
      >
        <div class="transaction-form-grid">
          <label class="transaction-form-field">
            <span>分类</span>
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
          <label class="transaction-form-field">
            <span>账户</span>
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
          <label class="transaction-form-field transaction-wide-field">
            <span>行程（可选）</span>
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
        </div>
      </SectionCard>

      <SectionCard
        v-if="type === 'REFUND'"
        title="退款关联"
        description="退款可关联原支出；无法确认原单时可标记为无原单退款。"
        tone="muted"
      >
        <fieldset class="refund-fields transaction-refund-fields">
          <legend class="sr-only">退款关联方式</legend>
          <label class="check-label transaction-refund-toggle">
            <input v-model="isUnlinkedRefund" type="checkbox" />
            <span>无原单退款（不引用原账单）</span>
          </label>
          <label v-if="!isUnlinkedRefund" class="transaction-form-field">
            <span>原账单</span>
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
      </SectionCard>

      <SectionCard title="补充说明" tone="muted">
        <div class="transaction-form-grid">
          <label class="transaction-form-field transaction-wide-field">
            <span>商户/说明</span>
            <input
              v-model="merchant"
              maxlength="100"
              placeholder="例如：便利店"
              type="text"
            />
          </label>
          <label class="transaction-form-field transaction-wide-field">
            <span>备注（可选）</span>
            <textarea
              v-model="note"
              maxlength="500"
              placeholder="补充票据、用途或其他说明"
              rows="3"
            ></textarea>
          </label>
        </div>
      </SectionCard>

      <FormActions class="transaction-form-actions">
        <RouterLink replace class="secondary-button" :to="returnTarget">
          取消
        </RouterLink>
        <button class="primary-button" :disabled="submitting" type="submit">
          {{ submitting ? "保存中…" : "保存" }}
        </button>
      </FormActions>
    </form>
  </SecondaryPageShell>
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
