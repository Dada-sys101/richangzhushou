<script setup lang="ts">
import { ElCard, ElResult } from "element-plus";
import "element-plus/es/components/card/style/css";
import "element-plus/es/components/icon/style/css";
import "element-plus/es/components/result/style/css";
</script>

<template>
  <el-card shadow="never" class="foundation-card">
    <template #header>管理端工程骨架</template>
    <el-result
      icon="success"
      title="Vue 3 + TypeScript + Element Plus 已就绪"
      sub-title="WP9 已提供概览、用户、设置与审计管理页面；账号由管理员在此创建。"
    />
  </el-card>
</template>
