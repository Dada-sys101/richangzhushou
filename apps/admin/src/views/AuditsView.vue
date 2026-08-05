<script setup lang="ts">
import { onMounted, ref } from "vue";

import { adminApi, type AdminAuditEntry } from "../api/client";

const items = ref<AdminAuditEntry[]>([]);

onMounted(async () => {
  const response = await adminApi.getAudits();
  items.value = response.items;
});
</script>

<template>
  <div class="admin-page">
    <h1>审计记录</h1>
    <el-table :data="items" row-key="id">
      <el-table-column label="时间" prop="createdAt" width="220" />
      <el-table-column label="操作" prop="action" width="170" />
      <el-table-column label="操作者" prop="actorEmail" width="150" />
      <el-table-column label="目标" prop="targetType" width="150" />
      <el-table-column label="原因" prop="reason" />
      <el-table-column label="请求 ID" prop="requestId" width="200" />
    </el-table>
  </div>
</template>
