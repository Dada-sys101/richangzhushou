<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { ApiClientError, type AiProposalCreateRequest } from "../api/client";
import { useAiStore } from "../stores/ai";

const AI_REQUEST_TYPES = [
  "TRANSACTION",
  "CALENDAR_EVENT",
  "TASK",
  "REMINDER",
  "TRIP",
] as const;

const router = useRouter();
const ai = useAiStore();

const userInput = ref("");
const requestType = ref<(typeof AI_REQUEST_TYPES)[number]>("TASK");
const generating = ref(false);
const errorMessage = ref("");
const pendingIdempotencyKey = ref<string | null>(null);
const lastAttemptInput = ref<{ requestType: string; userInput: string } | null>(
  null,
);

const canGenerate = computed(
  () => userInput.value.trim().length > 0 && !generating.value,
);

watch([userInput, requestType], () => {
  if (
    lastAttemptInput.value &&
    (lastAttemptInput.value.userInput !== userInput.value ||
      lastAttemptInput.value.requestType !== requestType.value)
  ) {
    // Input changed after a failed attempt: the old key is invalidated.
    pendingIdempotencyKey.value = null;
    lastAttemptInput.value = null;
  }
});

async function generate() {
  errorMessage.value = "";
  if (!userInput.value.trim()) {
    errorMessage.value = "请输入要生成的请求内容";
    return;
  }
  if (generating.value) {
    return;
  }

  let idempotencyKey = pendingIdempotencyKey.value;
  if (!idempotencyKey) {
    idempotencyKey = crypto.randomUUID();
  }
  const attemptInput = {
    requestType: requestType.value,
    userInput: userInput.value,
  };

  generating.value = true;
  try {
    const request = buildCreateRequest(userInput.value, requestType.value);
    const response = await ai.createProposal(request, idempotencyKey);
    pendingIdempotencyKey.value = null;
    lastAttemptInput.value = null;
    await router.push({
      name: "ai-proposal-review",
      params: { proposalId: response.proposal.id },
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === "AI_PROVIDER_ERROR") {
      // A persisted FAILED AI request replays its stored failure, so the
      // next explicit attempt must use a fresh key.
      pendingIdempotencyKey.value = null;
      lastAttemptInput.value = null;
      errorMessage.value = error.message;
    } else if (isNetworkFailure(error)) {
      // Transport outcome unknown: keep the same key for a manual retry with
      // unchanged input.
      pendingIdempotencyKey.value = idempotencyKey;
      lastAttemptInput.value = attemptInput;
      errorMessage.value = "网络异常，AI 功能需要联网使用，请检查网络后重试";
    } else {
      pendingIdempotencyKey.value = null;
      lastAttemptInput.value = null;
      errorMessage.value =
        error instanceof ApiClientError
          ? error.message
          : "生成失败，请稍后重试";
    }
  } finally {
    generating.value = false;
  }
}

function buildCreateRequest(
  userInputValue: string,
  requestTypeValue: string,
): AiProposalCreateRequest {
  return {
    allowedCategoryLabels: [],
    currency: "CNY",
    currentDateTime: new Date().toISOString(),
    explicitSelectedContext: [],
    locale: navigator.language || "zh-CN",
    requestType: requestTypeValue,
    timeZoneId:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
    userInput: userInputValue,
  };
}

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 0 || error.code === "NETWORK_ERROR")
  );
}
</script>

<template>
  <section class="ai-page" aria-labelledby="ai-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">AI 助手</p>
        <h1 id="ai-title">生成提案</h1>
      </div>
    </header>

    <form class="capture-panel" @submit.prevent="generate">
      <h2>输入请求</h2>
      <p class="panel-copy">
        用自然语言描述待办事项、日程、账单、提醒或行程，系统将生成提案供你核对。
      </p>

      <label class="capture-label">
        类型
        <select v-model="requestType">
          <option v-for="type in AI_REQUEST_TYPES" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </label>

      <label class="capture-label">
        内容
        <textarea
          v-model="userInput"
          maxlength="2000"
          placeholder="例如：明天下午三点和产品团队开会"
          rows="4"
        ></textarea>
      </label>

      <p v-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>

      <button class="primary-button" :disabled="!canGenerate" type="submit">
        {{ generating ? "生成中…" : "生成 Proposal" }}
      </button>
    </form>
  </section>
</template>
