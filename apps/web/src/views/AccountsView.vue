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

type AccountKind =
  "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "DIGITAL_WALLET" | "OTHER";

const newName = ref("");
const newKind = ref<AccountKind>("DEBIT_CARD");
const actionError = ref("");
const accountLoadError = ref("");
const accountsLoading = ref(false);
const actionPending = ref<string | null>(null);
useUnsavedChanges(computed(() => Boolean(newName.value.trim())));

const accountKindLabels: Record<AccountKind, string> = {
  CASH: "现金",
  CREDIT_CARD: "信用卡",
  DEBIT_CARD: "储蓄卡",
  DIGITAL_WALLET: "电子钱包",
  OTHER: "其他",
};

const activeAccounts = computed(() =>
  finance.accounts.filter((item) => !item.isArchived),
);
const archivedAccounts = computed(() =>
  finance.accounts.filter((item) => item.isArchived),
);
const hasAccountData = computed(() => finance.accounts.length > 0);
const accountRowsLocked = computed(
  () =>
    Boolean(actionPending.value) ||
    accountsLoading.value ||
    Boolean(accountLoadError.value),
);

onMounted(() => {
  if (auth.isAuthenticated) {
    void loadAccounts();
  }
});

async function loadAccounts() {
  accountsLoading.value = true;
  accountLoadError.value = "";
  finance.clearError();
  try {
    await finance.loadAccounts(true);
    accountLoadError.value = finance.errorMessage ?? "";
  } catch (error) {
    accountLoadError.value = messageOf(error);
  } finally {
    accountsLoading.value = false;
  }
}

async function createAccount() {
  if (actionPending.value) return;
  actionError.value = "";
  if (!newName.value.trim()) {
    actionError.value = "请输入账户名称";
    return;
  }

  actionPending.value = "create";
  finance.clearError();
  try {
    await finance.createAccount({
      kind: newKind.value,
      name: newName.value.trim(),
    });
    const storeError = finance.errorMessage;
    if (storeError) {
      newName.value = "";
      accountLoadError.value = storeError;
      return;
    }
    accountLoadError.value = "";
    newName.value = "";
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    actionPending.value = null;
  }
}

async function toggleArchive(id: string, isArchived: boolean, version: number) {
  if (actionPending.value) return;
  actionError.value = "";
  actionPending.value = `${isArchived ? "restore" : "archive"}:${id}`;
  finance.clearError();
  try {
    await finance.updateAccount(id, { isArchived: !isArchived, version });
    const storeError = finance.errorMessage;
    if (storeError) {
      accountLoadError.value = storeError;
    } else {
      accountLoadError.value = "";
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
    class="accounts-page"
    title="资金账户"
    title-id="accounts-title"
    subtitle="设置"
  >
    <SectionCard
      title="新增账户"
      description="选择账户类型并填写一个容易识别的名称。"
    >
      <form class="finance-create-form" @submit.prevent="createAccount">
        <label class="finance-create-field">
          <span>账户类型</span>
          <select v-model="newKind" aria-label="账户类型">
            <option value="CASH">现金</option>
            <option value="DEBIT_CARD">储蓄卡</option>
            <option value="CREDIT_CARD">信用卡</option>
            <option value="DIGITAL_WALLET">电子钱包</option>
            <option value="OTHER">其他</option>
          </select>
        </label>
        <label class="finance-create-field finance-create-name-field">
          <span>账户名称</span>
          <input
            v-model="newName"
            aria-label="账户名称"
            maxlength="40"
            placeholder="如：日常钱包、招商银行"
            required
            type="text"
          />
        </label>
        <button
          class="primary-button finance-create-submit"
          type="submit"
          :disabled="actionPending === 'create'"
        >
          {{ actionPending === "create" ? "新增中…" : "新增账户" }}
        </button>
      </form>
    </SectionCard>

    <p v-if="actionError" class="form-error finance-page-feedback" role="alert">
      {{ actionError }}
    </p>

    <LoadingState
      v-if="accountsLoading && !hasAccountData"
      description="正在获取可用于记账的资金账户。"
      title="正在加载账户…"
    />
    <template v-else>
      <LoadingState
        v-if="accountsLoading"
        class="accounts-refresh-state"
        description="账户列表会在刷新完成后更新。"
        title="正在更新账户…"
      />
      <ErrorState
        v-if="accountLoadError"
        action-label="重试"
        :description="accountLoadError"
        title="账户暂时无法加载"
        @retry="loadAccounts"
      />

      <template v-if="!accountLoadError || hasAccountData">
        <SectionCard title="使用中的账户">
          <EmptyState
            v-if="activeAccounts.length === 0"
            description="新增一个账户，之后记账时就能快速选择。"
            icon="card"
            title="还没有使用中的账户"
          />
          <ul v-else class="resource-list finance-resource-list">
            <li
              v-for="item in activeAccounts"
              :key="item.id"
              class="finance-resource-row"
            >
              <div class="finance-row-main">
                <span class="account-kind">
                  {{ accountKindLabels[item.kind as AccountKind] ?? item.kind }}
                </span>
                <span class="finance-row-name">{{ item.name }}</span>
              </div>
              <div class="finance-row-actions">
                <button
                  class="text-button danger"
                  type="button"
                  :aria-label="`归档账户：${item.name}`"
                  :disabled="accountRowsLocked"
                  @click="toggleArchive(item.id, item.isArchived, item.version)"
                >
                  {{
                    actionPending === `archive:${item.id}` ? "归档中…" : "归档"
                  }}
                </button>
              </div>
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="已归档账户" tone="muted">
          <EmptyState
            v-if="archivedAccounts.length === 0"
            description="归档后的账户会保留在这里，可随时恢复。"
            icon="file"
            title="还没有已归档账户"
          />
          <ul v-else class="resource-list finance-resource-list">
            <li
              v-for="item in archivedAccounts"
              :key="item.id"
              class="finance-resource-row"
            >
              <div class="finance-row-main">
                <span class="account-kind">
                  {{ accountKindLabels[item.kind as AccountKind] ?? item.kind }}
                </span>
                <span class="finance-row-name">{{ item.name }}</span>
              </div>
              <div class="finance-row-actions">
                <button
                  class="text-button"
                  type="button"
                  :aria-label="`恢复账户：${item.name}`"
                  :disabled="accountRowsLocked"
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
