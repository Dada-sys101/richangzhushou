<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import AssistantMark from "../components/AssistantMark.vue";
import EmptyState from "../components/EmptyState.vue";
import { useAuthStore } from "../stores/auth";
import { useDraftsStore } from "../stores/drafts";
import { useFinanceStore } from "../stores/finance";

const auth = useAuthStore();
const drafts = useDraftsStore();
const finance = useFinanceStore();
const activeTab = ref<"RECENT" | "PENDING">("RECENT");
const month = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
});

const records = computed(() =>
  finance.transactions.filter((item) => !item.deletedAt).slice(0, 6),
);

onMounted(() => {
  if (auth.isAuthenticated) {
    void Promise.all([
      finance.loadFinanceData(month),
      drafts.loadDrafts("PENDING"),
    ]);
  }
});

function signedAmount(type: string, amount: string) {
  return `${type === "EXPENSE" ? "-" : "+"}¥${amount}`;
}
function typeLabel(type: string) {
  return type === "EXPENSE" ? "支出" : type === "INCOME" ? "收入" : "退款";
}
function categoryTone(index: number) {
  return ["orange", "blue", "mint", "pink"][index % 4];
}
</script>

<template>
  <section class="v2-page records-page" aria-labelledby="records-title">
    <header class="records-head">
      <div>
        <h1 id="records-title">记录中心</h1>
        <p>账单、待确认与最近输入</p>
      </div>
    </header>

    <section class="records-summary" aria-label="本月财务摘要">
      <p>本月概览</p>
      <strong>支出 ¥{{ finance.summary?.totalExpense ?? "0.00" }}</strong>
      <span>收入 ¥{{ finance.summary?.totalIncome ?? "0.00" }}</span>
      <small
        >预算剩余
        {{ finance.summary?.budgets[0]?.remaining ?? "未设置" }}</small
      >
    </section>

    <div class="record-tabs" role="tablist" aria-label="记录筛选">
      <button
        :class="{ active: activeTab === 'RECENT' }"
        type="button"
        @click="activeTab = 'RECENT'"
      >
        最近记录
      </button>
      <button
        :class="{ active: activeTab === 'PENDING' }"
        type="button"
        @click="activeTab = 'PENDING'"
      >
        待确认
        <span v-if="drafts.pendingDrafts.length">{{
          drafts.pendingDrafts.length
        }}</span>
      </button>
      <RouterLink to="/transactions">统计</RouterLink>
    </div>

    <section
      v-if="activeTab === 'RECENT'"
      class="record-list-section"
      aria-label="最近记录"
    >
      <EmptyState
        v-if="!records.length"
        icon="receipt"
        title="还没有记录"
        description="从一句话录入或手动记一笔开始。"
        :action="{ label: '去录入', to: '/capture' }"
      />
      <ul v-else class="record-list prototype-record-list">
        <li v-for="(item, index) in records" :key="item.id">
          <RouterLink :to="`/transactions/${item.id}/edit`">
            <span
              class="record-category-dot"
              :class="`is-${categoryTone(index)}`"
            ></span>
            <span
              ><strong>{{ item.merchant || typeLabel(item.type) }}</strong
              ><small
                >{{ typeLabel(item.type) }} ·
                {{
                  new Date(item.occurredAt).toLocaleDateString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                  })
                }}</small
              ></span
            >
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
    <section v-else class="record-list-section" aria-label="待确认记录">
      <EmptyState
        v-if="!drafts.pendingDrafts.length"
        icon="check"
        title="没有待确认草稿"
        description="统一录入生成的草稿会在这里等待你确认。"
      />
      <ul v-else class="record-list prototype-record-list">
        <li
          v-for="(draft, index) in drafts.pendingDrafts.slice(0, 6)"
          :key="draft.id"
        >
          <RouterLink to="/drafts"
            ><span
              class="record-category-dot"
              :class="`is-${categoryTone(index)}`"
            ></span
            ><span
              ><strong>{{ draft.payload.merchant || "一条记录草稿" }}</strong
              ><small>待确认 · 请核对金额和分类</small></span
            ><b class="record-pending">去确认</b></RouterLink
          >
        </li>
      </ul>
    </section>

    <RouterLink class="records-insight" to="/finance/budgets"
      ><AssistantMark size="sm" /><span
        ><strong>智能洞察</strong
        ><small>账单已集中在这里，预算与分类仍可在设置中管理。</small></span
      ><span>›</span></RouterLink
    >
  </section>
</template>
