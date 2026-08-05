<script setup lang="ts">
import { ElContainer, ElHeader, ElMain } from "element-plus";
import "element-plus/es/components/container/style/css";
import "element-plus/es/components/header/style/css";
import "element-plus/es/components/main/style/css";
import "element-plus/es/components/tag/style/css";
import { RouterView } from "vue-router";
</script>

<template>
  <el-container class="admin-shell">
    <el-header class="admin-header">
      <strong>Daily Assistant Admin</strong>
      <nav class="admin-nav">
        <RouterLink to="/dashboard">概览</RouterLink>
        <RouterLink to="/invites">邀请码</RouterLink>
        <RouterLink to="/users">用户</RouterLink>
        <RouterLink to="/settings">设置</RouterLink>
        <RouterLink to="/audits">审计</RouterLink>
      </nav>
    </el-header>
    <el-main>
      <RouterView />
    </el-main>
  </el-container>
</template>
