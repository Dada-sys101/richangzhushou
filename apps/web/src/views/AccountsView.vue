<script setup lang="ts">
import { onMounted, ref } from "vue";

import { ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";

const auth = useAuthStore();
const finance = useFinanceStore();

const newName = ref("");
const newKind = ref<
  "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "DIGITAL_WALLET" | "OTHER"
>("DEBIT_CARD");
const errorMessage = ref("");

const accountKindLabels: Record<string, string> = {
  CASH: "现金",
  CREDIT_CARD: "信用卡",
  DEBIT_CARD: "储蓄卡",
  DIGITAL_WALLET: "电子钱包",
  OTHER: "其他",
};

onMounted(() => {
  if (auth.isAuthenticated) {
    void finance.loadAccounts(true);
  }
});

async function createAccount() {
  errorMessage.value = "";
  if (!newName.value.trim()) {
    errorMessage.value = "请输入账户名称";
    return;
  }
  try {
    await finance.createAccount({
      kind: newKind.value,
      name: newName.value.trim(),
    });
    newName.value = "";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function toggleArchive(id: string, isArchived: boolean, version: number) {
  errorMessage.value = "";
  try {
    await finance.updateAccount(id, { isArchived: !isArchived, version });
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "操作失败，请稍后重试";
}
</script>

<template>
  <section class="finance-page" aria-labelledby="accounts-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">设置</p>
        <h1 id="accounts-title">账户</h1>
      </div>
    </header>

    <form class="inline-create" @submit.prevent="createAccount">
      <select v-model="newKind">
        <option value="CASH">现金</option>
        <option value="DEBIT_CARD">储蓄卡</option>
        <option value="CREDIT_CARD">信用卡</option>
        <option value="DIGITAL_WALLET">电子钱包</option>
        <option value="OTHER">其他</option>
      </select>
      <input
        v-model="newName"
        maxlength="40"
        placeholder="新账户名称"
        required
        type="text"
      />
      <button class="primary-button" type="submit">新增</button>
    </form>

    <p v-if="finance.errorMessage" class="form-error" role="alert">
      {{ finance.errorMessage }}
    </p>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>

    <ul class="resource-list">
      <li
        v-for="item in finance.accounts.filter((a) => !a.isArchived)"
        :key="item.id"
      >
        <span class="account-kind">{{
          accountKindLabels[item.kind] ?? item.kind
        }}</span>
        <span>{{ item.name }}</span>
        <button
          class="text-button danger"
          type="button"
          @click="toggleArchive(item.id, item.isArchived, item.version)"
        >
          归档
        </button>
      </li>
    </ul>

    <h2>已归档</h2>
    <ul class="resource-list">
      <li
        v-for="item in finance.accounts.filter((a) => a.isArchived)"
        :key="item.id"
      >
        <span class="account-kind">{{
          accountKindLabels[item.kind] ?? item.kind
        }}</span>
        <span>{{ item.name }}</span>
        <button
          class="text-button"
          type="button"
          @click="toggleArchive(item.id, item.isArchived, item.version)"
        >
          恢复
        </button>
      </li>
    </ul>
  </section>
</template>
