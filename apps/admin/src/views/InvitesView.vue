<script setup lang="ts">
import { onMounted, ref } from "vue";

import { adminApi, ApiClientError, type InviteSummary } from "../api/client";

const items = ref<InviteSummary[]>([]);
const maxUses = ref(1);
const expiresAt = ref("");
const reason = ref("");
const plaintextCode = ref("");
const errorMessage = ref("");
const loading = ref(false);

async function load() {
  const response = await adminApi.listInvites();
  items.value = response.items;
}

async function create() {
  errorMessage.value = "";
  loading.value = true;
  try {
    const response = await adminApi.createInvite({
      expiresAt: expiresAt.value || null,
      maxUses: Number(maxUses.value),
      reason: reason.value,
    });
    plaintextCode.value = response.plaintextCode;
    reason.value = "";
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "创建失败";
  } finally {
    loading.value = false;
  }
}

async function revoke(invite: InviteSummary) {
  errorMessage.value = "";
  try {
    await adminApi.revokeInvite(invite.id, "管理端撤销邀请码");
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "撤销失败";
  }
}

onMounted(load);
</script>

<template>
  <div class="admin-page">
    <h1>邀请码</h1>
    <el-card class="form-card">
      <template #header>创建邀请码</template>
      <el-form label-position="top">
        <el-row :gutter="12">
          <el-col :span="24" :md="8">
            <el-form-item label="最大使用次数">
              <el-input-number v-model="maxUses" :max="100" :min="1" />
            </el-form-item>
          </el-col>
          <el-col :span="24" :md="8">
            <el-form-item label="过期时间（可选）">
              <el-input v-model="expiresAt" placeholder="ISO 8601 或留空" />
            </el-form-item>
          </el-col>
          <el-col :span="24" :md="8">
            <el-form-item label="原因（必填）">
              <el-input v-model="reason" data-test="invite-reason" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-button
          :loading="loading"
          data-test="invite-create"
          type="primary"
          @click="create"
        >
          创建
        </el-button>
      </el-form>
      <el-alert
        v-if="plaintextCode"
        :closable="false"
        class="plaintext-alert"
        title="邀请码明文只显示一次"
        type="success"
      >
        <code data-test="invite-plaintext">{{ plaintextCode }}</code>
      </el-alert>
    </el-card>
    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <el-table :data="items" row-key="id">
      <el-table-column label="前缀" prop="codePrefix" />
      <el-table-column label="状态" prop="status" />
      <el-table-column label="已用/次数" width="120">
        <template #default="{ row }">
          {{ row.usedCount }} / {{ row.maxUses }}
        </template>
      </el-table-column>
      <el-table-column label="过期时间" prop="expiresAt" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button
            :disabled="row.status === 'REVOKED'"
            size="small"
            type="danger"
            @click="revoke(row)"
          >
            撤销
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
