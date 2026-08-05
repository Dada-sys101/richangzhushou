<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const displayName = ref("");
const email = ref("");
const password = ref("");
const inviteCode = ref("");
const errorMessage = ref("");
const submitting = ref(false);

async function submit() {
  errorMessage.value = "";
  submitting.value = true;
  try {
    await auth.register({
      displayName: displayName.value,
      email: email.value,
      inviteCode: inviteCode.value.trim().toUpperCase() || undefined,
      password: password.value,
    });
    await router.replace("/account");
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "注册失败，请稍后重试";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="auth-card" aria-labelledby="register-title">
    <p class="eyebrow">受邀体验</p>
    <h1 id="register-title">注册 Daily Assistant</h1>
    <form class="auth-form" @submit.prevent="submit">
      <label>
        昵称
        <input v-model.trim="displayName" maxlength="60" required />
      </label>
      <label>
        邮箱
        <input
          v-model.trim="email"
          autocomplete="email"
          required
          type="email"
        />
      </label>
      <label>
        邀请码
        <input
          v-model.trim="inviteCode"
          autocomplete="off"
          maxlength="64"
          placeholder="选填，注册开关要求时必填"
        />
      </label>
      <label>
        密码（至少 12 位）
        <input
          v-model="password"
          autocomplete="new-password"
          minlength="12"
          required
          type="password"
        />
      </label>
      <p v-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>
      <button class="primary-button" :disabled="submitting" type="submit">
        {{ submitting ? "注册中…" : "注册" }}
      </button>
    </form>
    <p class="auth-links">
      <RouterLink to="/login">已有账号？直接登录</RouterLink>
    </p>
  </section>
</template>
