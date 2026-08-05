<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

import { ApiClientError } from "../api/client";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const email = ref("");
const password = ref("");
const errorMessage = ref("");
const submitting = ref(false);

async function submit() {
  errorMessage.value = "";
  submitting.value = true;
  try {
    await auth.login(email.value, password.value);
    await router.replace("/dashboard");
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "登录失败";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-card class="admin-login-card">
    <template #header>管理员登录</template>
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="邮箱">
        <el-input v-model.trim="email" data-test="admin-email" type="email" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input
          v-model="password"
          data-test="admin-password"
          show-password
          type="password"
        />
      </el-form-item>
      <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
      <el-button
        :loading="submitting"
        data-test="admin-login-submit"
        native-type="submit"
        type="primary"
      >
        登录
      </el-button>
    </el-form>
  </el-card>
</template>
