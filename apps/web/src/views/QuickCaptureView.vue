<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";

import { ApiClientError, api } from "../api/client";
import { useDraftsStore } from "../stores/drafts";

const drafts = useDraftsStore();
const text = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const parsing = ref(false);
const uploading = ref(false);
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

async function onFileChange(event: Event) {
  errorMessage.value = "";
  message.value = "";
  createdDraftId.value = "";
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    errorMessage.value = "仅支持 JPG、PNG、WebP 图片";
    input.value = "";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    errorMessage.value = "图片不能超过 10MB";
    input.value = "";
    return;
  }

  uploading.value = true;
  try {
    const intent = await api.createUploadIntent({
      mimeType: file.type,
      ownerType: "TRANSACTION_DRAFT",
    });
    await api.uploadAttachmentContent(intent.id, intent.uploadToken, file);
    await api.completeAttachment(intent.id);
    const result = await api.ocrDraft({
      attachmentId: intent.id,
      clientMutationId: null,
    });
    createdDraftId.value = result.draft.id;
    message.value = "图片识别完成，已生成待确认草稿。";
  } catch (error) {
    if (error instanceof ApiClientError && error.code === "OCR_UNAVAILABLE") {
      errorMessage.value = "暂时无法识别图片，可以继续手动填写账单。";
    } else if (
      error instanceof ApiClientError &&
      error.code === "ATTACHMENT_SCAN_FAILED"
    ) {
      errorMessage.value = "图片扫描未通过，请换一张图片重试或手动填写。";
    } else {
      errorMessage.value = messageOf(error);
    }
  } finally {
    uploading.value = false;
    if (fileInput.value) {
      fileInput.value.value = "";
    }
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
        <h2>图片识别（OCR）</h2>
        <p class="panel-copy">
          上传账单或小票截图，识别结果只生成草稿，不会直接入账。
        </p>
        <input
          ref="fileInput"
          accept="image/jpeg,image/png,image/webp"
          :disabled="uploading"
          type="file"
          @change="onFileChange"
        />
        <p v-if="uploading" class="panel-copy">上传并识别中…</p>
        <RouterLink class="text-button" to="/transactions/new"
          >识别失败时手动填写</RouterLink
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
