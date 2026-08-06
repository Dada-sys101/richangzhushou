<script setup lang="ts">
import { onMounted, ref } from "vue";

import { adminApi, ApiClientError, type AdminUserSummary } from "../api/client";

const items = ref<AdminUserSummary[]>([]);
const createForm = ref({
  displayName: "",
  initialPassword: "",
  reason: "",
  username: "",
});
const creating = ref(false);
const selectedAction = ref<{
  action: "close" | "reopen" | "reset-password" | "suspend";
  id: string;
  username: string;
} | null>(null);
const reason = ref("");
const newPassword = ref("");
const errorMessage = ref("");
const successMessage = ref("");

async function load() {
  const response = await adminApi.listUsers();
  items.value = response.items;
}

async function createUser() {
  errorMessage.value = "";
  successMessage.value = "";
  creating.value = true;
  try {
    await adminApi.createUser({
      displayName: createForm.value.displayName,
      initialPassword: createForm.value.initialPassword,
      reason: createForm.value.reason,
      username: createForm.value.username,
    });
    successMessage.value = `已创建账号 ${createForm.value.username}，首次登录需修改密码。`;
    createForm.value = {
      displayName: "",
      initialPassword: "",
      reason: "",
      username: "",
    };
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "创建失败";
  } finally {
    creating.value = false;
  }
}

async function submitAction() {
  if (!selectedAction.value) {
    return;
  }
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const { action, id } = selectedAction.value;
    if (action === "reset-password") {
      await adminApi.resetUserPassword(id, {
        newPassword: newPassword.value,
        reason: reason.value,
      });
      successMessage.value = `已重置 ${selectedAction.value.username} 的密码，下次登录需修改。`;
    } else {
      await adminApi.userAction(id, action, reason.value);
    }
    selectedAction.value = null;
    reason.value = "";
    newPassword.value = "";
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
    <p v-if="successMessage" class="admin-success">{{ successMessage }}</p>

    <el-card class="form-card">
      <template #header>创建账号（管理员）</template>
      <el-form label-position="top" @submit.prevent="createUser">
        <el-form-item label="账号（3-32 位小写字母/数字/下划线）">
          <el-input
            v-model.trim="createForm.username"
            data-test="create-username"
          />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input
            v-model.trim="createForm.displayName"
            data-test="create-display-name"
          />
        </el-form-item>
        <el-form-item label="初始密码（至少 12 位，首次登录需修改）">
          <el-input
            v-model="createForm.initialPassword"
            data-test="create-password"
            show-password
            type="password"
          />
        </el-form-item>
        <el-form-item label="创建原因（必填，将写入审计）">
          <el-input v-model="createForm.reason" data-test="create-reason" />
        </el-form-item>
        <el-button
          :loading="creating"
          data-test="create-submit"
          native-type="submit"
          type="primary"
        >
          创建账号
        </el-button>
      </el-form>
    </el-card>

    <el-table :data="items" row-key="id" style="margin-top: 16px">
      <el-table-column label="账号" prop="username" width="140" />
      <el-table-column label="昵称" prop="displayName" width="160" />
      <el-table-column label="状态" prop="status" width="140" />
      <el-table-column label="角色" prop="role" width="100" />
      <el-table-column label="待改密" width="100">
        <template #default="{ row }">
          {{ row.mustChangePassword ? "是" : "否" }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" prop="createdAt" width="220" />
      <el-table-column label="操作" width="360">
        <template #default="{ row }">
          <el-button
            size="small"
            type="warning"
            @click="
              selectedAction = {
                action: 'suspend',
                id: row.id,
                username: row.username,
              };
              reason = '';
            "
          >
            暂停
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click="
              selectedAction = {
                action: 'close',
                id: row.id,
                username: row.username,
              };
              reason = '';
            "
          >
            关闭
          </el-button>
          <el-button
            size="small"
            type="success"
            @click="
              selectedAction = {
                action: 'reopen',
                id: row.id,
                username: row.username,
              };
              reason = '';
            "
          >
            恢复
          </el-button>
          <el-button
            size="small"
            type="primary"
            @click="
              selectedAction = {
                action: 'reset-password',
                id: row.id,
                username: row.username,
              };
              reason = '';
              newPassword = '';
            "
          >
            重置密码
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-card v-if="selectedAction" class="action-card">
      <template #header>
        对 {{ selectedAction.username }} 执行
        {{
          selectedAction.action === "reset-password"
            ? "重置密码"
            : selectedAction.action
        }}
      </template>
      <el-form label-position="top" @submit.prevent="submitAction">
        <el-form-item
          v-if="selectedAction.action === 'reset-password'"
          label="新密码（至少 12 位）"
        >
          <el-input
            v-model="newPassword"
            data-test="reset-password-input"
            show-password
            type="password"
          />
        </el-form-item>
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
