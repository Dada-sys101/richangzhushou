<script setup lang="ts">
import { onMounted, ref } from "vue";

import { adminApi, ApiClientError, type AdminUserSummary } from "../api/client";

const items = ref<AdminUserSummary[]>([]);
const selectedAction = ref<{ id: string; action: string } | null>(null);
const reason = ref("");
const errorMessage = ref("");

async function load() {
  const response = await adminApi.listUsers();
  items.value = response.items;
}

async function submitAction() {
  if (!selectedAction.value) {
    return;
  }
  errorMessage.value = "";
  try {
    await adminApi.userAction(
      selectedAction.value.id,
      selectedAction.value.action as "close" | "reopen" | "suspend",
      reason.value,
    );
    selectedAction.value = null;
    reason.value = "";
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "操作失败";
  }
}

onMounted(load);
</script>

<template>
  <div class="admin-page">
    <h1>用户</h1>
    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <el-table :data="items" row-key="id">
      <el-table-column label="邮箱（脱敏）" prop="maskedEmail" />
      <el-table-column label="状态" prop="status" width="150" />
      <el-table-column label="角色" prop="role" width="100" />
      <el-table-column label="注册时间" prop="createdAt" width="220" />
      <el-table-column label="操作" width="260">
        <template #default="{ row }">
          <el-button
            size="small"
            type="warning"
            @click="
              selectedAction = { id: row.id, action: 'suspend' };
              reason = '';
            "
          >
            暂停
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click="
              selectedAction = { id: row.id, action: 'close' };
              reason = '';
            "
          >
            关闭
          </el-button>
          <el-button
            size="small"
            type="success"
            @click="
              selectedAction = { id: row.id, action: 'reopen' };
              reason = '';
            "
          >
            恢复
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-card v-if="selectedAction" class="action-card">
      <template #header
        >对 {{ selectedAction.id }} 执行 {{ selectedAction.action }}</template
      >
      <el-form label-position="top" @submit.prevent="submitAction">
        <el-form-item label="原因（必填）">
          <el-input v-model="reason" data-test="user-action-reason" />
        </el-form-item>
        <el-button
          data-test="user-action-submit"
          native-type="submit"
          type="primary"
        >
          提交
        </el-button>
        <el-button @click="selectedAction = null">取消</el-button>
      </el-form>
    </el-card>
  </div>
</template>
