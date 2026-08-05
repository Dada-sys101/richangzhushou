<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const email = ref("");
const password = ref("");
const errorMessage = ref("");
const submitting = ref(false);

async function submit() {
  errorMessage.value = "";
  submitting.value = true;
  try {
    await auth.login(email.value, password.value);
    await router.replace(
      typeof route.query.redirect === "string"
        ? route.query.redirect
        : "/account",
    );
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "登录失败，请稍后重试";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="auth-card" aria-labelledby="login-title">
    <p class="eyebrow">欢迎回来</p>
    <h1 id="login-title">登录 Daily Assistant</h1>
    <form class="auth-form" @submit.prevent="submit">
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
        密码
        <input
          v-model="password"
          autocomplete="current-password"
          minlength="12"
          required
          type="password"
        />
      </label>
      <p v-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>
      <button class="primary-button" :disabled="submitting" type="submit">
        {{ submitting ? "登录中…" : "登录" }}
      </button>
    </form>
    <p class="auth-links">
      <RouterLink to="/forgot-password">忘记密码？</RouterLink>
      <RouterLink to="/register">还没有账号？申请注册</RouterLink>
    </p>
  </section>
</template>
