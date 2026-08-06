<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";

import { ApiClientError } from "../api/client";
import { useDraftsStore } from "../stores/drafts";

const drafts = useDraftsStore();
const text = ref("");
const parsing = ref(false);
const message = ref("");
const errorMessage = ref("");
const createdDraftId = ref("");

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
    message.value = "已生成待确认草稿，请到草稿中心核对后确认入账。";
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
  <section class="capture-page" aria-labelledby="capture-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">统一录入</p>
        <h1 id="capture-title">快捷记录</h1>
      </div>
      <RouterLink class="secondary-button" to="/drafts">草稿中心</RouterLink>
    </header>

    <div class="capture-grid">
      <form class="capture-panel" @submit.prevent="parseText">
        <h2>文本解析</h2>
        <p class="panel-copy">
          输入自然语言，例如“今天 14:30 星巴克 38.50”，系统会生成待确认草稿。
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
          {{ parsing ? "解析中…" : "解析为草稿" }}
        </button>
      </form>

      <div class="capture-panel">
        <h2>手动记账</h2>
        <p class="panel-copy">也可以直接在记账页面手动填写账单明细。</p>
        <RouterLink class="secondary-button" to="/transactions/new"
          >前往手动记账</RouterLink
        >
      </div>
    </div>

    <p v-if="message" class="form-success" role="status">
      {{ message }}
      <RouterLink v-if="createdDraftId" class="text-button" :to="`/drafts`">
        前往草稿中心
      </RouterLink>
    </p>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
  </section>
</template>
