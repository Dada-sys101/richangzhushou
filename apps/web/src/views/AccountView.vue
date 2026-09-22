<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { ApiClientError, type UserSummary } from "../api/client";
import AppIcon from "../components/AppIcon.vue";
import AssistantMark from "../components/AssistantMark.vue";
import PageHeader from "../components/PageHeader.vue";
import SyncBadge from "../components/SyncBadge.vue";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
import { usePwaLifecycle } from "../composables/usePwaLifecycle";
import { useAuthStore } from "../stores/auth";

const ACCOUNT_STATUS_LABELS: Record<UserSummary["status"], string> = {
  ACTIVE: "正常",
  CLOSED: "已关闭",
  DELETED: "已删除",
  DELETION_PENDING: "等待删除",
  DELETION_PROCESSING: "正在删除",
  SUSPENDED: "已暂停",
};

const ACCOUNT_STATUS_DESCRIPTIONS: Record<UserSummary["status"], string> = {
  ACTIVE: "账号可以正常使用",
  CLOSED: "账号已关闭，当前无法使用",
  DELETED: "账号已删除，当前无法使用",
  DELETION_PENDING: "删除申请已提交，正在等待处理",
  DELETION_PROCESSING: "删除流程正在处理，请稍候",
  SUSPENDED: "账号已暂停，请联系管理员处理",
};

const auth = useAuthStore();
const pwa = usePwaLifecycle();
const router = useRouter();
const password = ref("");
const reason = ref("");
const action = ref<"close" | "deletion" | null>(null);
const errorMessage = ref("");
const submitting = ref(false);
const accountStatusLabel = computed(() => {
  const status = auth.user?.status;
  return status ? ACCOUNT_STATUS_LABELS[status] : "未登录";
});
const accountStatusDescription = computed(() => {
  const status = auth.user?.status;
  return status ? ACCOUNT_STATUS_DESCRIPTIONS[status] : "请登录后查看账户状态";
});
const { allowNavigation } = useUnsavedChanges(
  computed(
    () =>
      Boolean(action.value) ||
      password.value.length > 0 ||
      reason.value.trim().length > 0,
  ),
);

async function logout() {
  allowNavigation();
  await auth.logout();
  await router.replace({ name: "login", query: { redirect: "/" } });
}

function selectRiskAction(nextAction: "close" | "deletion") {
  if (submitting.value) {
    return;
  }
  action.value = nextAction;
  reason.value = "";
  errorMessage.value = "";
}

async function submit() {
  if (!action.value || submitting.value) {
    return;
  }
  errorMessage.value = "";
  submitting.value = true;
  try {
    if (action.value === "close") {
      await auth.closeAccount(password.value, reason.value);
      allowNavigation();
      await router.replace("/login");
    } else {
      await auth.requestDeletion(password.value, reason.value);
      allowNavigation();
      await router.replace("/login");
    }
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "操作失败，请稍后重试";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="account-page" aria-labelledby="account-title">
    <PageHeader
      title="我的"
      title-id="account-title"
      subtitle="账户、同步与安全设置"
      :show-back="false"
    />

    <section class="profile-card" aria-labelledby="account-overview-title">
      <div class="profile-card-mark">
        <AssistantMark size="lg" />
      </div>
      <div class="profile-card-copy">
        <p class="account-kicker">账户概览</p>
        <h2 id="account-overview-title">
          {{ auth.user?.displayName ?? "日常助手用户" }}
        </h2>
        <p class="account-identity">
          {{ auth.user?.username ?? "个人账号" }}
        </p>
        <div class="account-status-summary">
          <strong>账号状态：{{ accountStatusLabel }}</strong>
          <span>{{ accountStatusDescription }}</span>
        </div>
      </div>
    </section>

    <section class="account-sync-section" aria-labelledby="sync-status-title">
      <div class="account-section-heading">
        <p class="section-label">同步</p>
        <h2 id="sync-status-title">真实同步状态</h2>
        <p>状态、待同步记录和冲突以当前设备的实际同步结果为准。</p>
      </div>
      <div class="account-sync-card">
        <SyncBadge />
      </div>
    </section>

    <section class="account-group" aria-labelledby="common-settings-title">
      <div class="account-section-heading">
        <p class="section-label">常用设置</p>
        <h2 id="common-settings-title">常用设置</h2>
        <p>快速进入账户、记录和同步相关操作。</p>
      </div>
      <div class="settings-list">
        <RouterLink class="settings-row" to="/change-password">
          <span class="settings-icon is-purple">
            <AppIcon name="lock" :size="16" />
          </span>
          <span>
            <strong>修改密码</strong>
            <small>更新登录凭据</small>
          </span>
          <AppIcon name="chevron-right" :size="16" />
        </RouterLink>
        <RouterLink class="settings-row" to="/sync/conflicts">
          <span class="settings-icon is-blue">
            <AppIcon name="refresh" :size="16" />
          </span>
          <span>
            <strong>同步状态</strong>
            <small>查看待同步、失败和冲突记录</small>
          </span>
          <AppIcon name="chevron-right" :size="16" />
        </RouterLink>
        <RouterLink class="settings-row" to="/transactions">
          <span class="settings-icon is-mint">
            <AppIcon name="file" :size="16" />
          </span>
          <span>
            <strong>账单明细</strong>
            <small>查看记录与导出 CSV</small>
          </span>
          <AppIcon name="chevron-right" :size="16" />
        </RouterLink>
        <button
          aria-label="退出登录"
          class="settings-row settings-button"
          type="button"
          @click="logout"
        >
          <span class="settings-icon is-lavender">
            <AppIcon name="user" :size="16" />
          </span>
          <span>
            <strong>退出登录</strong>
            <small>退出当前设备上的账号</small>
          </span>
          <AppIcon name="chevron-right" :size="16" />
        </button>
      </div>
    </section>

    <section class="account-group" aria-labelledby="finance-settings-title">
      <div class="account-section-heading">
        <p class="section-label">财务与数据</p>
        <h2 id="finance-settings-title">财务与数据</h2>
        <p>管理分类、资金账户和预算；账单明细已归入常用设置。</p>
      </div>
      <div class="settings-list">
        <RouterLink class="settings-row" to="/finance/categories">
          <span class="settings-icon is-mint">
            <AppIcon name="tags" :size="16" />
          </span>
          <span>
            <strong>分类管理</strong>
            <small>收入与支出分类</small>
          </span>
          <AppIcon name="chevron-right" :size="16" />
        </RouterLink>
        <RouterLink class="settings-row" to="/finance/accounts">
          <span class="settings-icon is-mint">
            <AppIcon name="card" :size="16" />
          </span>
          <span>
            <strong>资金账户</strong>
            <small>现金、银行卡等</small>
          </span>
          <AppIcon name="chevron-right" :size="16" />
        </RouterLink>
        <RouterLink class="settings-row" to="/finance/budgets">
          <span class="settings-icon is-mint">
            <AppIcon name="budget" :size="16" />
          </span>
          <span>
            <strong>预算设置</strong>
            <small>月度预算与分类预算</small>
          </span>
          <AppIcon name="chevron-right" :size="16" />
        </RouterLink>
      </div>
    </section>

    <section class="account-group" aria-labelledby="app-settings-title">
      <div class="account-section-heading">
        <p class="section-label">应用</p>
        <h2 id="app-settings-title">应用</h2>
        <p>根据当前浏览器环境管理主屏幕安装入口。</p>
      </div>
      <div class="settings-list">
        <button
          v-if="pwa.canInstall.value"
          class="settings-row settings-button"
          type="button"
          @click="pwa.install"
        >
          <span class="settings-icon is-blue">
            <AppIcon name="download" :size="16" />
          </span>
          <span>
            <strong>添加到主屏幕</strong>
            <small>
              {{
                pwa.ios.value
                  ? "按 Safari 步骤安装，打开更方便"
                  : "安装为独立应用，打开更方便"
              }}
            </small>
          </span>
          <AppIcon name="chevron-right" :size="16" />
        </button>
        <div v-else-if="pwa.standalone.value" class="settings-row">
          <span class="settings-icon is-blue">
            <AppIcon name="check" :size="16" />
          </span>
          <span>
            <strong>主屏幕应用</strong>
            <small>当前已使用应用模式</small>
          </span>
          <span class="settings-row-state">已启用</span>
        </div>
        <div v-else class="settings-row">
          <span class="settings-icon is-blue">
            <AppIcon name="home" :size="16" />
          </span>
          <span>
            <strong>浏览器模式</strong>
            <small>当前浏览器暂未提供安装入口</small>
          </span>
          <span class="settings-row-state">浏览器</span>
        </div>
      </div>
    </section>

    <section
      class="account-group account-security"
      aria-labelledby="security-title"
    >
      <div class="account-section-heading">
        <p class="section-label">账号与安全</p>
        <h2 id="security-title">高风险操作</h2>
        <p>关闭账号或申请删除会影响登录和数据使用，请谨慎操作。</p>
      </div>
      <details class="account-danger-details">
        <summary>
          <span>
            <strong>关闭账号或申请删除</strong>
            <small>需要当前密码和操作原因</small>
          </span>
          <AppIcon name="chevron-down" :size="18" />
        </summary>
        <div class="account-danger-zone">
          <div class="account-danger-intro">
            <h3>安全与高风险操作</h3>
            <p class="risk-copy">
              关闭会立即释放名额并撤销会话；申请删除会进入保留期。两者都需要输入密码和原因。
            </p>
          </div>
          <div
            class="risk-actions"
            role="group"
            aria-label="选择高风险账号操作"
          >
            <button
              class="danger-button"
              :aria-pressed="action === 'close'"
              :disabled="submitting"
              type="button"
              @click="selectRiskAction('close')"
            >
              选择关闭账号
            </button>
            <button
              class="danger-button"
              :aria-pressed="action === 'deletion'"
              :disabled="submitting"
              type="button"
              @click="selectRiskAction('deletion')"
            >
              选择申请删除
            </button>
          </div>
          <form
            class="auth-form risk-form account-risk-form"
            @submit.prevent="submit"
          >
            <p v-if="action" class="action-confirmation">
              即将{{
                action === "close" ? "关闭账号" : "申请删除账号"
              }}，请确认密码和原因后提交。
            </p>
            <label for="account-risk-password">
              当前密码
              <input
                id="account-risk-password"
                v-model="password"
                autocomplete="current-password"
                required
                type="password"
              />
            </label>
            <label for="account-risk-reason">
              原因
              <textarea
                id="account-risk-reason"
                v-model.trim="reason"
                maxlength="500"
                required
                rows="3"
              ></textarea>
            </label>
            <p v-if="errorMessage" class="form-error" role="alert">
              {{ errorMessage }}
            </p>
            <button
              v-if="action"
              class="primary-button account-risk-submit"
              :disabled="submitting"
              type="submit"
            >
              {{ submitting ? "提交中…" : "确认并提交" }}
            </button>
          </form>
        </div>
      </details>
    </section>
  </section>
</template>
