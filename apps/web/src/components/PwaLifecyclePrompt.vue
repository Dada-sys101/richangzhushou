<script setup lang="ts">
import { usePwaLifecycle } from "../composables/usePwaLifecycle";
import { useSyncStore } from "../stores/sync";

const sync = useSyncStore();
const pwa = usePwaLifecycle();
</script>

<template>
  <aside v-if="pwa.needRefresh.value" class="pwa-update" role="status">
    <div>
      <strong>发现新版本</strong>
      <p v-if="pwa.updateBlocked.value">
        当前有未保存内容或正在同步，请完成后再更新。
      </p>
      <p v-else>更新后将自动重新打开日常助手。</p>
    </div>
    <div class="pwa-update-actions">
      <button class="secondary-button" type="button" @click="pwa.deferUpdate">
        稍后
      </button>
      <button
        class="primary-button"
        type="button"
        @click="pwa.applyUpdate(sync.syncing)"
      >
        更新
      </button>
    </div>
  </aside>

  <div
    v-if="pwa.installGuideOpen.value"
    class="pwa-guide-backdrop"
    role="presentation"
    @click.self="pwa.closeInstallGuide"
  >
    <section
      class="pwa-guide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-guide-title"
    >
      <h2 id="pwa-guide-title">添加到主屏幕</h2>
      <ol>
        <li>点击 Safari 底部的“分享”按钮。</li>
        <li>选择“添加到主屏幕”。</li>
        <li>点击右上角“添加”。</li>
      </ol>
      <button
        class="primary-button"
        type="button"
        @click="pwa.closeInstallGuide"
      >
        知道了
      </button>
    </section>
  </div>
</template>
