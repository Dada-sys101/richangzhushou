<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { ApiClientError } from "../api/client";
import AppIcon from "../components/AppIcon.vue";
import AssistantMark from "../components/AssistantMark.vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const password = ref("");
const reason = ref("");
const action = ref<"close" | "deletion" | null>(null);
const errorMessage = ref("");
const submitting = ref(false);

async function logout() {
  await auth.logout();
  await router.replace("/login");
}

async function submit() {
  if (!action.value) {
    return;
  }
  errorMessage.value = "";
  submitting.value = true;
  try {
    if (action.value === "close") {
      await auth.closeAccount(password.value, reason.value);
      await router.replace("/login");
    } else {
      await auth.requestDeletion(password.value, reason.value);
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
    <h1 id="account-title">我的</h1>

    <section class="profile-card" aria-label="账号概览">
      <AssistantMark size="lg" />
      <div>
        <strong>{{ auth.user?.displayName ?? "日常助手用户" }}</strong
        ><small
          >账号状态：{{
            auth.user?.status === "ACTIVE"
              ? "正常"
              : (auth.user?.status ?? "未登录")
          }}</small
        ><small>已同步 · {{ auth.user?.username ?? "个人账号" }}</small>
      </div>
    </section>

    <section class="account-group" aria-labelledby="appearance-title">
      <p class="section-label">个人与外观</p>
      <h2 id="appearance-title" class="visually-hidden">个人与外观</h2>
      <div class="settings-list">
        <div class="settings-row">
          <span class="settings-icon is-purple"
            ><AppIcon name="user" :size="16" /></span
          ><span
            ><strong>个人资料</strong><small>昵称、头像与基础信息</small></span
          ><AppIcon name="chevron-right" :size="16" />
        </div>
        <div class="settings-row">
          <span class="settings-icon is-purple"
            ><AppIcon name="settings" :size="16" /></span
          ><span
            ><strong>外观与主题</strong
            ><small>当前使用正式浅色主题</small></span
          ><AppIcon name="chevron-right" :size="16" />
        </div>
      </div>
    </section>
    <section class="account-group" aria-labelledby="finance-settings-title">
      <p class="section-label">财务设置</p>
      <h2 id="finance-settings-title" class="visually-hidden">财务设置</h2>
      <div class="settings-list">
        <RouterLink class="settings-row" to="/finance/categories"
          ><span class="settings-icon is-mint"
            ><AppIcon name="tags" :size="16" /></span
          ><span><strong>分类管理</strong><small>收入与支出分类</small></span
          ><AppIcon name="chevron-right" :size="16" /></RouterLink
        ><RouterLink class="settings-row" to="/finance/accounts"
          ><span class="settings-icon is-mint"
            ><AppIcon name="card" :size="16" /></span
          ><span><strong>资金账户</strong><small>现金、银行卡等</small></span
          ><AppIcon name="chevron-right" :size="16" /></RouterLink
        ><RouterLink class="settings-row" to="/finance/budgets"
          ><span class="settings-icon is-mint"
            ><AppIcon name="budget" :size="16" /></span
          ><span
            ><strong>预算设置</strong><small>月度预算与分类预算</small></span
          ><AppIcon name="chevron-right" :size="16"
        /></RouterLink>
      </div>
    </section>
    <section class="account-group" aria-labelledby="data-title">
      <p class="section-label">记录与数据</p>
      <h2 id="data-title" class="visually-hidden">记录与数据</h2>
      <div class="settings-list">
        <RouterLink class="settings-row" to="/transactions"
          ><span class="settings-icon is-blue"
            ><AppIcon name="file" :size="16" /></span
          ><span><strong>数据导出</strong><small>导出 CSV</small></span
          ><AppIcon name="chevron-right" :size="16" /></RouterLink
        ><RouterLink class="settings-row" to="/sync/conflicts"
          ><span class="settings-icon is-blue"
            ><AppIcon name="refresh" :size="16" /></span
          ><span><strong>同步状态</strong><small>待同步与冲突记录</small></span
          ><AppIcon name="chevron-right" :size="16"
        /></RouterLink>
      </div>
    </section>
    <section class="account-group" aria-labelledby="automation-title">
      <p class="section-label">自动化</p>
      <h2 id="automation-title" class="visually-hidden">自动化</h2>
      <div class="settings-list">
        <RouterLink class="settings-row" to="/shortcuts"
          ><span class="settings-icon is-blue"
            ><AppIcon name="zap" :size="16" /></span
          ><span><strong>Apple 快捷指令</strong><small>自动化入口</small></span
          ><AppIcon name="chevron-right" :size="16"
        /></RouterLink>
        <RouterLink class="settings-row" to="/ai"
          ><span class="settings-icon is-lavender"
            ><AppIcon name="zap" :size="16" /></span
          ><span
            ><strong>已有自动化能力</strong><small>草稿与确认流程</small></span
          ><AppIcon name="chevron-right" :size="16"
        /></RouterLink>
      </div>
    </section>

    <section
      class="account-group account-security"
      aria-labelledby="security-title"
    >
      <p class="section-label">账号与安全</p>
      <h2 id="security-title" class="visually-hidden">账号与安全</h2>
      <details class="account-danger-details">
        <summary>账号与安全</summary>
        <form
          class="auth-form risk-form account-danger-zone"
          @submit.prevent="submit"
        >
          <p class="section-label">账号与安全</p>
          <h2>安全与高风险操作</h2>
          <div class="account-link-list">
            <RouterLink to="/change-password">修改密码</RouterLink
            ><button class="secondary-button" type="button" @click="logout">
              退出登录
            </button>
          </div>
          <p class="risk-copy">
            关闭会立即释放名额并撤销会话；申请删除会进入保留期。两者都需要输入密码和原因。
          </p>
          <label>
            当前密码
            <input
              v-model="password"
              autocomplete="current-password"
              required
              type="password"
            />
          </label>
          <label>
            原因
            <textarea
              v-model.trim="reason"
              maxlength="500"
              required
              rows="3"
            ></textarea>
          </label>
          <p v-if="errorMessage" class="form-error" role="alert">
            {{ errorMessage }}
          </p>
          <div class="risk-actions">
            <button
              class="danger-button"
              :disabled="submitting"
              type="button"
              @click="
                action = 'close';
                reason = '';
              "
            >
              选择关闭账号
            </button>
            <button
              class="danger-button"
              :disabled="submitting"
              type="button"
              @click="
                action = 'deletion';
                reason = '';
              "
            >
              选择申请删除
            </button>
          </div>
          <p v-if="action" class="action-confirmation">
            即将{{
              action === "close" ? "关闭账号" : "申请删除账号"
            }}，请确认密码和原因后提交。
          </p>
          <button
            v-if="action"
            class="primary-button"
            :disabled="submitting"
            type="submit"
          >
            {{ submitting ? "提交中…" : "确认并提交" }}
          </button>
        </form>
      </details>
    </section>
  </section>
</template>
