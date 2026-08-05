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
      sub-title="当前工作包不包含用户、邀请码或业务数据管理功能。"
    />
  </el-card>
</template>
