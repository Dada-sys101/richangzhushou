<script setup lang="ts">
import { ElContainer, ElHeader, ElMain, ElTag } from "element-plus";
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
      <el-tag effect="plain">WP1</el-tag>
    </el-header>
    <el-main>
      <RouterView />
    </el-main>
  </el-container>
</template>
