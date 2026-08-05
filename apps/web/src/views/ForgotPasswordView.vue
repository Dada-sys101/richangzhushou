<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";

import { api, ApiClientError } from "../api/client";

const email = ref("");
const message = ref("");
const errorMessage = ref("");
const submitting = ref(false);

async function submit() {
  message.value = "";
  errorMessage.value = "";
  submitting.value = true;
  try {
    await api.forgotPassword(email.value);
    message.value = "如果该邮箱已注册，你会收到一封恢复邮件。";
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "请求失败，请稍后重试";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="auth-card" aria-labelledby="forgot-title">
    <p class="eyebrow">密码恢复</p>
    <h1 id="forgot-title">找回密码</h1>
    <form class="auth-form" @submit.prevent="submit">
      <label>
        注册邮箱
        <input
          v-model.trim="email"
          autocomplete="email"
          required
          type="email"
        />
      </label>
      <p v-if="message" class="form-success" role="status">{{ message }}</p>
      <p v-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>
      <button class="primary-button" :disabled="submitting" type="submit">
        {{ submitting ? "提交中…" : "发送恢复邮件" }}
      </button>
    </form>
    <p class="auth-links">
      <RouterLink to="/login">返回登录</RouterLink>
      <RouterLink to="/reset-password">已有恢复凭证？设置新密码</RouterLink>
    </p>
  </section>
</template>
