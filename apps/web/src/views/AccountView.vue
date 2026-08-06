<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { ApiClientError } from "../api/client";
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
    <p class="eyebrow">个人设置</p>
    <h1 id="account-title">个人设置</h1>

    <dl v-if="auth.user" class="account-summary">
      <div>
        <dt>昵称</dt>
        <dd>{{ auth.user.displayName }}</dd>
      </div>
      <div>
        <dt>账号</dt>
        <dd>{{ auth.user.username }}</dd>
      </div>
      <div>
        <dt>状态</dt>
        <dd>{{ auth.user.status }}</dd>
      </div>
    </dl>

    <button class="secondary-button" @click="logout">退出登录</button>
    <RouterLink class="secondary-button" to="/change-password"
      >修改密码</RouterLink
    >

    <form class="auth-form risk-form" @submit.prevent="submit">
      <h2>关闭账号或申请删除</h2>
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

    <p class="auth-links">
      <RouterLink to="/">返回首页</RouterLink>
    </p>
  </section>
</template>
