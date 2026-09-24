<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const username = ref("");
const password = ref("");
const errorMessage = ref("");
const submitting = ref(false);

async function submit() {
  if (submitting.value) return;
  errorMessage.value = "";
  submitting.value = true;
  try {
    await auth.login(username.value, password.value);
    await router.replace(
      auth.mustChangePassword
        ? "/change-password"
        : typeof route.query.redirect === "string"
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
  <section class="auth-card login-card" aria-labelledby="login-title">
    <p class="eyebrow">欢迎回来</p>
    <h1 id="login-title">登录日常助手</h1>
    <p class="login-intro">
      使用管理员为你创建的账号，继续查看自己的日常安排。
    </p>
    <form
      class="auth-form login-form"
      :aria-busy="submitting"
      @submit.prevent="submit"
    >
      <label for="login-username">
        <span>账号</span>
        <input
          id="login-username"
          v-model.trim="username"
          autocomplete="username"
          autocapitalize="none"
          minlength="3"
          pattern="[a-z0-9_]{3,32}"
          required
          :disabled="submitting"
          :aria-describedby="
            errorMessage
              ? 'login-username-help login-error'
              : 'login-username-help'
          "
          spellcheck="false"
          type="text"
        />
        <small id="login-username-help">3–32 位小写字母、数字或下划线</small>
      </label>
      <label for="login-password">
        <span>密码</span>
        <input
          id="login-password"
          v-model="password"
          autocomplete="current-password"
          minlength="12"
          required
          :disabled="submitting"
          :aria-describedby="errorMessage ? 'login-error' : undefined"
          type="password"
        />
      </label>
      <p v-if="errorMessage" id="login-error" class="form-error" role="alert">
        {{ errorMessage }}
      </p>
      <p v-if="submitting" class="login-progress" role="status">
        正在登录，请稍候…
      </p>
      <button
        class="primary-button login-submit"
        :disabled="submitting"
        type="submit"
      >
        {{ submitting ? "登录中…" : "登录" }}
      </button>
    </form>
    <p class="auth-links login-help">
      账号由管理员创建；忘记密码请联系管理员重置。
    </p>
  </section>
</template>
