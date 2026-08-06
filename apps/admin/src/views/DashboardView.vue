<script setup lang="ts">
import { onMounted, ref } from "vue";

import {
  adminApi,
  ApiClientError,
  type AdminDashboardResponse,
} from "../api/client";

const dashboard = ref<AdminDashboardResponse | null>(null);
const health = ref<{ database: string; status: string } | null>(null);
const errorMessage = ref("");

onMounted(async () => {
  try {
    [dashboard.value, health.value] = await Promise.all([
      adminApi.getDashboard(),
      adminApi.getHealth(),
    ]);
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "加载失败";
  }
});
</script>

<template>
  <div class="admin-page">
    <h1>管理概览</h1>
    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <el-row v-if="dashboard" :gutter="16">
      <el-col :span="24" :md="8">
        <el-card>
          <template #header>容量</template>
          <div class="stat">
            {{ dashboard.occupiedSlots }} / {{ dashboard.maxActiveUsers }}
          </div>
          <div class="stat-label">
            剩余 {{ dashboard.remainingSlots }} 个名额
          </div>
        </el-card>
      </el-col>
      <el-col :span="24" :md="8">
        <el-card>
          <template #header>用户</template>
          <div class="stat">{{ dashboard.activeUsers }} 活跃</div>
          <div class="stat-label">{{ dashboard.suspendedUsers }} 暂停</div>
        </el-card>
      </el-col>
      <el-col :span="24" :md="8">
        <el-card>
          <template #header>账号创建</template>
          <div class="stat">管理员创建</div>
          <div class="stat-label">账号密码登录，首次登录需改密</div>
        </el-card>
      </el-col>
    </el-row>
    <el-alert
      v-if="health"
      :closable="false"
      :title="`数据库：${health.database}`"
      :type="health.status === 'ok' ? 'success' : 'warning'"
      style="margin-top: 16px"
    />
  </div>
</template>
