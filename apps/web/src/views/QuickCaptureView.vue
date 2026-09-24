<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import { ApiClientError } from "../api/client";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
import { useDraftsStore } from "../stores/drafts";
import { appendReturnTo } from "../utils/navigation";

const drafts = useDraftsStore();
const route = useRoute();
const text = ref("");
const parsing = ref(false);
const errorMessage = ref("");
const createdDraftId = ref("");
const canSubmit = computed(
  () => text.value.trim().length > 0 && !parsing.value,
);
useUnsavedChanges(computed(() => text.value.trim().length > 0));

watch(
  () => route.query.text,
  (value) => {
    if (typeof value === "string") text.value = value.slice(0, 2000);
  },
  { immediate: true },
);

function onInput() {
  errorMessage.value = "";
  createdDraftId.value = "";
}

async function parseText() {
  if (parsing.value) return;
  errorMessage.value = "";
  if (!text.value.trim()) {
    errorMessage.value = "请输入要记录的内容";
    return;
  }
  createdDraftId.value = "";
  parsing.value = true;
  try {
    const result = await drafts.createTextDraft(text.value);
    createdDraftId.value = result.draft.id;
    text.value = "";
  } catch (error) {
    errorMessage.value =
      error instanceof ApiClientError ? error.message : "网络异常，请稍后重试";
  } finally {
    parsing.value = false;
  }
}

function withCaptureSource(path: string) {
  return appendReturnTo(path, route.fullPath);
}
</script>

<template>
  <SecondaryPageShell
    title="快速记录"
    title-id="capture-title"
    subtitle="一句话生成待确认的财务草稿"
  >
    <div class="capture-workspace">
      <form class="capture-panel capture-entry" @submit.prevent="parseText">
        <div class="capture-step-heading">
          <span aria-hidden="true">01</span>
          <div>
            <h2>写下一句话</h2>
            <p class="panel-copy">
              例如“今天 14:30 星巴克 38.50”。目前仅整理收支内容。
            </p>
          </div>
        </div>
        <label class="capture-label" for="capture-text">记录内容</label>
        <textarea
          id="capture-text"
          v-model="text"
          maxlength="2000"
          rows="5"
          placeholder="例如：星巴克 38.50"
          :disabled="parsing"
          @input="onInput"
        ></textarea>
        <div class="capture-entry-footer">
          <small>{{ text.length }} / 2000 字</small>
          <button class="primary-button" :disabled="!canSubmit" type="submit">
            {{
              parsing
                ? "生成中…"
                : errorMessage
                  ? "重试生成草稿"
                  : "生成待确认草稿"
            }}
          </button>
        </div>
        <p v-if="parsing" class="capture-progress" role="status">
          正在整理为待确认草稿，请稍候…
        </p>
        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }} 输入仍在，可修改后重试。
        </p>
      </form>

      <section
        class="capture-result"
        aria-labelledby="capture-result-title"
        aria-live="polite"
      >
        <div class="capture-step-heading">
          <span aria-hidden="true">02</span>
          <div>
            <h2 id="capture-result-title">核对草稿</h2>
            <p v-if="createdDraftId" class="panel-copy">
              草稿已生成，尚未入账。请到草稿中心核对并确认。
            </p>
            <p v-else class="panel-copy">
              生成草稿不等于正式入账；只有在草稿中心确认后才会写入账单。
            </p>
          </div>
        </div>
        <RouterLink
          v-if="createdDraftId"
          class="secondary-button"
          :to="withCaptureSource('/drafts')"
        >
          去草稿中心核对
        </RouterLink>
      </section>

      <section
        class="capture-panel capture-other"
        aria-labelledby="capture-other-title"
      >
        <h2 id="capture-other-title">记录其他事项</h2>
        <p class="panel-copy">
          日程、待办和提醒仍在各自页面创建，不会由这段文字自动生成。
        </p>
        <div class="capture-type-links capture-type-chips">
          <RouterLink :to="withCaptureSource('/calendar')">日程</RouterLink>
          <RouterLink :to="withCaptureSource('/tasks')">待办</RouterLink>
          <RouterLink :to="withCaptureSource('/reminders')">提醒</RouterLink>
        </div>
      </section>
    </div>
  </SecondaryPageShell>
</template>
