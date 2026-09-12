<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { ApiClientError } from "../api/client";
import FormActions from "../components/FormActions.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import SectionCard from "../components/SectionCard.vue";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
import { useAuthStore } from "../stores/auth";
import { safeReturnTo } from "../utils/navigation";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const submitting = ref(false);
const returnTarget = computed(() =>
  safeReturnTo(route.query, route.meta.page?.parent?.path ?? "/"),
);
const { allowNavigation } = useUnsavedChanges(
  computed(
    () =>
      currentPassword.value.length > 0 ||
      newPassword.value.length > 0 ||
      confirmPassword.value.length > 0,
  ),
);

async function submit() {
  errorMessage.value = "";
  successMessage.value = "";
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = "两次输入的新密码不一致";
    return;
  }
  submitting.value = true;
  try {
    await auth.changePassword(currentPassword.value, newPassword.value);
    successMessage.value = "密码已修改。";
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    allowNavigation();
    await router.replace(returnTarget.value);
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "修改失败，请稍后重试";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <SecondaryPageShell
    title="修改密码"
    title-id="change-password-title"
    subtitle="账号安全"
  >
    <SectionCard
      title="设置新密码"
      description="新密码至少 12 位，请勿与其他网站使用相同密码。"
    >
      <p v-if="auth.mustChangePassword" class="panel-copy">
        首次登录或管理员重置密码后，必须先设置新密码才能继续使用。
      </p>
      <form class="auth-form" @submit.prevent="submit">
        <input
          :value="auth.user?.username ?? ''"
          autocomplete="username"
          hidden
          name="username"
          type="text"
        />
        <label>
          当前密码
          <input
            v-model="currentPassword"
            autocomplete="current-password"
            minlength="12"
            required
            type="password"
          />
        </label>
        <label>
          新密码
          <input
            v-model="newPassword"
            autocomplete="new-password"
            minlength="12"
            required
            type="password"
          />
        </label>
        <label>
          确认新密码
          <input
            v-model="confirmPassword"
            autocomplete="new-password"
            minlength="12"
            required
            type="password"
          />
        </label>
        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="form-success" role="status">
          {{ successMessage }}
        </p>
        <FormActions>
          <RouterLink class="secondary-button" replace :to="returnTarget"
            >取消</RouterLink
          >
          <button class="primary-button" :disabled="submitting" type="submit">
            {{ submitting ? "提交中…" : "确认修改" }}
          </button>
        </FormActions>
      </form>
    </SectionCard>
  </SecondaryPageShell>
</template>
