<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import AppIcon from "../components/AppIcon.vue";
import EmptyState from "../components/EmptyState.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import PageHeader from "../components/PageHeader.vue";
import { useAuthStore } from "../stores/auth";
import { useDraftsStore } from "../stores/drafts";
import { useFinanceStore } from "../stores/finance";
import {
  appendReturnTo,
  useOptionalRoute,
  useOptionalRouter,
} from "../utils/navigation";

type RecordTab = "RECENT" | "PENDING";

const auth = useAuthStore();
const drafts = useDraftsStore();
const finance = useFinanceStore();
const route = useOptionalRoute();
const router = useOptionalRouter();
const tabOrder: RecordTab[] = ["RECENT", "PENDING"];
const activeTab = ref<RecordTab>(
  route?.query.tab === "pending" ? "PENDING" : "RECENT",
);
const month = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
});

const records = computed(() =>
  finance.transactions.filter((item) => !item.deletedAt).slice(0, 6),
);
const pendingRecords = computed(() => drafts.pendingDrafts.slice(0, 6));
const financeHasError = computed(() =>
  Boolean(finance.errorKind || finance.errorMessage),
);
const financeErrorDescription = computed(() =>
  finance.errorKind === "AUTH_EXPIRED"
    ? "登录状态已过期，请重新登录后再试。"
    : "记录与摘要暂时无法加载，请检查网络后重试。",
);
const draftsErrorDescription = "待确认草稿暂时无法加载，请检查网络后重试。";

onMounted(() => {
  if (auth.isAuthenticated) {
    void Promise.all([
      finance.loadFinanceData(month),
      drafts.loadDrafts("PENDING"),
    ]);
  }
});

watch(
  () => route?.query.tab,
  (value) => {
    activeTab.value = value === "pending" ? "PENDING" : "RECENT";
  },
);

function setActiveTab(tab: RecordTab) {
  activeTab.value = tab;
  if (router) {
    const query = { ...(route?.query ?? {}) };
    delete query.tab;
    if (tab === "PENDING") query.tab = "pending";
    void router.replace({ query });
  }
}

function handleTabKeydown(event: KeyboardEvent, tab: RecordTab) {
  const currentIndex = tabOrder.indexOf(tab);
  let nextIndex: number;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % tabOrder.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex + tabOrder.length - 1) % tabOrder.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabOrder.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  const nextTab = tabOrder[nextIndex];
  if (!nextTab) return;
  setActiveTab(nextTab);
  document.getElementById("records-tab-" + nextTab.toLowerCase())?.focus();
}

function retryFinance() {
  void finance.loadFinanceData(month);
}

function retryDrafts() {
  void drafts.loadDrafts("PENDING");
}

function withRecordsSource(path: string) {
  return appendReturnTo(path, route?.fullPath ?? "/records");
}

function signedAmount(type: string, amount: string) {
  return (type === "EXPENSE" ? "-" : "+") + "¥" + amount;
}

function typeLabel(type: string) {
  return type === "EXPENSE" ? "支出" : type === "INCOME" ? "收入" : "退款";
}

function categoryTone(index: number) {
  return ["orange", "blue", "mint", "pink"][index % 4];
}

function recordDate(value: string | null | undefined) {
  if (!value) return "日期未提供";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未提供";
  return date.toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
  });
}
</script>

<template>
  <section class="v2-page records-page" aria-labelledby="records-title">
    <PageHeader
      title="记录中心"
      title-id="records-title"
      subtitle="账单、待确认与最近输入"
      :show-back="false"
    >
      <template #actions>
        <RouterLink
          class="primary-button records-capture-action"
          :to="withRecordsSource('/capture')"
        >
          <AppIcon name="plus" :size="18" />
          <span>快速记录</span>
        </RouterLink>
      </template>
    </PageHeader>

    <section
      class="records-summary"
      aria-label="本月财务摘要"
      :aria-busy="finance.summaryLoading ? 'true' : undefined"
    >
      <div class="records-summary-heading">
        <p>本月概览</p>
        <span>账单摘要</span>
      </div>
      <LoadingState
        v-if="finance.summaryLoading"
        title="正在加载本月概览…"
        description="金额加载完成后会显示在这里。"
      />
      <ErrorState
        v-else-if="financeHasError"
        title="本月摘要暂不可用"
        :description="financeErrorDescription"
        action-label="重试"
        @retry="retryFinance"
      />
      <p v-else-if="!finance.summary" class="records-unavailable" role="status">
        本月摘要暂不可用
      </p>
      <div v-else class="records-summary-values">
        <div class="records-summary-expense">
          <span>支出</span>
          <strong>¥{{ finance.summary.totalExpense }}</strong>
        </div>
        <div class="records-summary-secondary">
          <div>
            <span>收入</span>
            <strong>¥{{ finance.summary.totalIncome }}</strong>
          </div>
          <div>
            <span>预算剩余</span>
            <strong v-if="finance.summary.budgets[0]"
              >¥{{ finance.summary.budgets[0].remaining }}</strong
            >
            <strong v-else>未设置</strong>
          </div>
        </div>
      </div>
    </section>

    <nav class="record-tab-nav" aria-label="记录筛选">
      <div class="record-tabs" role="tablist" aria-label="记录筛选">
        <button
          id="records-tab-recent"
          role="tab"
          :class="{ active: activeTab === 'RECENT' }"
          :aria-selected="activeTab === 'RECENT'"
          aria-controls="records-panel-recent"
          :tabindex="activeTab === 'RECENT' ? 0 : -1"
          type="button"
          @click="setActiveTab('RECENT')"
          @keydown="handleTabKeydown($event, 'RECENT')"
        >
          最近记录
        </button>
        <button
          id="records-tab-pending"
          role="tab"
          :class="{ active: activeTab === 'PENDING' }"
          :aria-selected="activeTab === 'PENDING'"
          aria-controls="records-panel-pending"
          :tabindex="activeTab === 'PENDING' ? 0 : -1"
          type="button"
          @click="setActiveTab('PENDING')"
          @keydown="handleTabKeydown($event, 'PENDING')"
        >
          待确认
          <span v-if="drafts.pendingDrafts.length" class="record-tab-count">{{
            drafts.pendingDrafts.length
          }}</span>
        </button>
      </div>
      <RouterLink
        class="record-tab-detail"
        :to="withRecordsSource('/transactions')"
      >
        <span>账单明细</span>
        <AppIcon name="chevron-right" :size="16" />
      </RouterLink>
    </nav>

    <section
      v-if="activeTab === 'RECENT'"
      id="records-panel-recent"
      class="record-list-section record-tabpanel"
      role="tabpanel"
      aria-labelledby="records-tab-recent"
      tabindex="0"
    >
      <div v-if="finance.transactionsLoading" class="records-list-state">
        <LoadingState
          title="正在加载最近记录…"
          description="最近的账单会显示在这里。"
        />
      </div>
      <div v-else-if="financeHasError" class="records-list-state">
        <ErrorState
          title="最近记录暂时不可用"
          :description="financeErrorDescription"
          action-label="重试"
          @retry="retryFinance"
        />
      </div>
      <EmptyState
        v-else-if="!records.length"
        icon="receipt"
        title="还没有记录"
        description="从一句话录入或手动记一笔开始。"
        :action="{ label: '去录入', to: withRecordsSource('/capture') }"
      />
      <ul v-else class="record-list prototype-record-list">
        <li v-for="(item, index) in records" :key="item.id">
          <RouterLink
            :to="withRecordsSource('/transactions/' + item.id + '/edit')"
          >
            <span
              class="record-category-dot"
              :class="'is-' + categoryTone(index)"
            ></span>
            <span class="record-list-copy">
              <strong>{{ item.merchant || typeLabel(item.type) }}</strong>
              <small
                >{{ typeLabel(item.type) }} ·
                {{ recordDate(item.occurredAt) }}</small
              >
            </span>
            <b
              :class="
                item.type === 'EXPENSE' ? 'amount-expense' : 'amount-income'
              "
              >{{ signedAmount(item.type, item.amount) }}</b
            >
          </RouterLink>
        </li>
      </ul>
    </section>

    <section
      v-else
      id="records-panel-pending"
      class="record-list-section record-tabpanel"
      role="tabpanel"
      aria-labelledby="records-tab-pending"
      tabindex="0"
    >
      <div v-if="drafts.loading" class="records-list-state">
        <LoadingState
          title="正在加载待确认草稿…"
          description="待确认内容会显示在这里。"
        />
      </div>
      <div v-else-if="drafts.errorMessage" class="records-list-state">
        <ErrorState
          title="待确认草稿暂时不可用"
          :description="draftsErrorDescription"
          action-label="重试"
          @retry="retryDrafts"
        />
      </div>
      <EmptyState
        v-else-if="!pendingRecords.length"
        icon="check"
        title="没有待确认草稿"
        description="快速新增生成的草稿会在这里等待你确认。"
      />
      <ul v-else class="record-list prototype-record-list">
        <li v-for="(draft, index) in pendingRecords" :key="draft.id">
          <RouterLink :to="withRecordsSource('/drafts')">
            <span
              class="record-category-dot"
              :class="'is-' + categoryTone(index)"
            ></span>
            <span class="record-list-copy">
              <strong>{{ draft.payload.merchant || "一条记录草稿" }}</strong>
              <small
                >待确认 · {{ typeLabel(draft.payload.type) }} ·
                {{ recordDate(draft.payload.occurredAt ?? draft.createdAt) }} ·
                请核对金额和分类</small
              >
            </span>
            <b class="record-pending">
              去确认 ·
              {{ signedAmount(draft.payload.type, draft.payload.amount) }}
            </b>
          </RouterLink>
        </li>
      </ul>
    </section>

    <RouterLink
      class="records-insight"
      :to="withRecordsSource('/finance/budgets')"
    >
      <AppIcon name="budget" :size="20" />
      <span>
        <strong>预算管理</strong>
        <small>查看本月预算和分类设置。</small>
      </span>
      <AppIcon name="chevron-right" :size="18" />
    </RouterLink>
  </section>
</template>
