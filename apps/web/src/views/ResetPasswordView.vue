<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { api, ApiClientError } from "../api/client";

const router = useRouter();
const recoveryToken = ref("");
const newPassword = ref("");
const errorMessage = ref("");
const message = ref("");
const submitting = ref(false);

async function submit() {
  errorMessage.value = "";
  message.value = "";
  submitting.value = true;
  try {
    await api.resetPassword({
      newPassword: newPassword.value,
      recoveryToken: recoveryToken.value,
    });
    message.value = "密码已重置，请使用新密码登录。";
    await router.replace("/login");
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "重置失败，请稍后重试";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="auth-card" aria-labelledby="reset-title">
    <p class="eyebrow">密码恢复</p>
    <h1 id="reset-title">设置新密码</h1>
    <form class="auth-form" @submit.prevent="submit">
      <label>
        恢复凭证
        <input
          v-model.trim="recoveryToken"
          autocomplete="off"
          minlength="32"
          required
        />
      </label>
      <label>
        新密码（至少 12 位）
        <input
          v-model="newPassword"
          autocomplete="new-password"
          minlength="12"
          required
          type="password"
        />
      </label>
      <p v-if="message" class="form-success" role="status">{{ message }}</p>
      <p v-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>
      <button class="primary-button" :disabled="submitting" type="submit">
        {{ submitting ? "提交中…" : "重置密码" }}
      </button>
    </form>
    <p class="auth-links">
      <RouterLink to="/login">返回登录</RouterLink>
    </p>
  </section>
</template>
