<script setup lang="ts">
import { ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import { ApiClientError } from "../api/client";
import AssistantMark from "../components/AssistantMark.vue";
import { useDraftsStore } from "../stores/drafts";

const drafts = useDraftsStore();
const route = useRoute();
const text = ref("");
const parsing = ref(false);
const message = ref("");
const errorMessage = ref("");
const createdDraftId = ref("");

watch(
  () => route.query.text,
  (value) => {
    if (typeof value === "string") text.value = value.slice(0, 2000);
  },
  { immediate: true },
);

async function parseText() {
  errorMessage.value = "";
  message.value = "";
  createdDraftId.value = "";
  if (!text.value.trim()) {
    errorMessage.value = "请输入要解析的内容";
    return;
  }
  parsing.value = true;
  try {
    const result = await drafts.createTextDraft(text.value);
    createdDraftId.value = result.draft.id;
    message.value = "已生成待确认财务草稿，请到草稿中心核对后确认入账。";
    text.value = "";
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    parsing.value = false;
  }
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "网络异常，请稍后重试";
}
</script>

<template>
  <section
    class="capture-page prototype-capture"
    aria-labelledby="capture-title"
  >
    <header class="capture-head">
      <div>
        <p class="eyebrow">统一录入</p>
        <h1 id="capture-title">记录此刻的想法</h1>
        <p>用一句话开始，确认后才会写入正式记录。</p>
      </div>
      <AssistantMark size="md" />
    </header>

    <div class="capture-grid">
      <form class="capture-panel capture-primary" @submit.prevent="parseText">
        <h2>一句话录入</h2>
        <p class="panel-copy">
          先支持把收支内容整理为待确认草稿，例如“今天 14:30 星巴克 38.50”。
        </p>
        <label class="capture-label">
          内容
          <textarea
            v-model="text"
            maxlength="2000"
            placeholder="例如：星巴克 38.50"
            rows="4"
          ></textarea>
        </label>
        <button class="primary-button" :disabled="parsing" type="submit">
          {{ parsing ? "整理中…" : "生成待确认草稿" }}
        </button>
      </form>

      <div class="capture-panel">
        <h2>快捷类型</h2>
        <p class="panel-copy">
          跨实体智能生成尚未由当前 API 提供。需要时可直接进入原有编辑页。
        </p>
        <div class="capture-type-links capture-type-chips">
          <RouterLink to="/transactions/new">记录/财务</RouterLink>
          <RouterLink to="/calendar">日程</RouterLink>
          <RouterLink to="/tasks">待办</RouterLink>
          <RouterLink to="/reminders">提醒</RouterLink>
          <RouterLink to="/trips">行程</RouterLink>
        </div>
      </div>
    </div>

    <section class="capture-confirm-card" aria-live="polite">
      <span class="capture-confirm-icon">✓</span>
      <span>
        <strong>{{ createdDraftId ? "草稿已生成" : "识别与确认" }}</strong>
        <small>{{
          message || "当前仅生成待确认的财务草稿，不会直接写入正式账单。"
        }}</small>
      </span>
      <RouterLink v-if="createdDraftId" class="text-button" to="/drafts">
        去确认
      </RouterLink>
    </section>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
  </section>
</template>
