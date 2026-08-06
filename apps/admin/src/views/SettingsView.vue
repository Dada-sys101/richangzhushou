<script setup lang="ts">
import { onMounted, ref } from "vue";

import { adminApi, ApiClientError, type SystemSettings } from "../api/client";

const settings = ref<SystemSettings | null>(null);
const reason = ref("");
const errorMessage = ref("");
const saving = ref(false);

async function load() {
  settings.value = await adminApi.getSettings();
}

async function save() {
  if (!settings.value) {
    return;
  }
  errorMessage.value = "";
  saving.value = true;
  try {
    settings.value = await adminApi.updateSettings({
      maxActiveUsers: settings.value.maxActiveUsers,
      reason: reason.value,
    });
    reason.value = "";
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "保存失败";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="admin-page">
    <h1>容量设置</h1>
    <el-card v-if="settings" class="form-card">
      <el-form label-position="top">
        <el-form-item label="容量上限">
          <el-input-number
            v-model="settings.maxActiveUsers"
            :max="1000"
            :min="1"
            data-test="max-users"
          />
        </el-form-item>
        <el-form-item label="原因（必填）">
          <el-input v-model="reason" data-test="settings-reason" />
        </el-form-item>
        <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
        <el-button
          :loading="saving"
          data-test="settings-save"
          type="primary"
          @click="save"
        >
          保存
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>
