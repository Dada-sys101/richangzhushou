<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";

import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";

const auth = useAuthStore();
const sync = useSyncStore();
const actionMessage = ref("");

const conflicts = computed(() => sync.conflicts);

async function choose(mutationId: string, choice: "local" | "server") {
  actionMessage.value = "";
  const userId = auth.userId;
  if (!userId) {
    return;
  }
  try {
    await sync.resolve(userId, mutationId, choice);
    actionMessage.value =
      choice === "local"
        ? "已按本地内容重新提交，联网后同步。"
        : "已保留服务端内容并丢弃本地修改。";
  } catch {
    actionMessage.value = "处理失败，请稍后重试。";
  }
}
</script>

<template>
  <section class="finance-page" aria-labelledby="conflicts-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">同步</p>
        <h1 id="conflicts-title">冲突处理</h1>
      </div>
      <RouterLink class="secondary-button" to="/">返回首页</RouterLink>
    </header>

    <p v-if="actionMessage" class="form-success" role="status">
      {{ actionMessage }}
    </p>
    <p v-if="conflicts.length === 0" class="empty-copy">
      当前没有待处理的冲突。
    </p>
    <ul v-else class="conflict-list">
      <li
        v-for="conflict in conflicts"
        :key="conflict.id"
        class="conflict-card"
      >
        <div class="conflict-head">
          <strong>{{ conflict.entityType }} · {{ conflict.action }}</strong>
          <small>{{ conflict.errorMessage }}</small>
        </div>
        <div class="conflict-grid">
          <div class="conflict-pane">
            <h2>本地内容</h2>
            <pre>{{ JSON.stringify(conflict.payload, null, 2) }}</pre>
          </div>
          <div class="conflict-pane">
            <h2>服务端当前</h2>
            <pre>{{
              JSON.stringify(conflict.current?.data ?? {}, null, 2)
            }}</pre>
          </div>
        </div>
        <div class="conflict-actions">
          <button
            class="primary-button"
            type="button"
            @click="choose(conflict.id, 'local')"
          >
            保留本地
          </button>
          <button
            class="secondary-button"
            type="button"
            @click="choose(conflict.id, 'server')"
          >
            保留服务端
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
