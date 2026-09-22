<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { ApiClientError, type AiProposalCreateRequest } from "../api/client";
import FormActions from "../components/FormActions.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import SectionCard from "../components/SectionCard.vue";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
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

const requestTypeLabels: Record<(typeof AI_REQUEST_TYPES)[number], string> = {
  CALENDAR_EVENT: "日程",
  REMINDER: "提醒",
  TASK: "待办",
  TRANSACTION: "账单",
  TRIP: "行程",
};
const requestTypeDescriptions: Record<
  (typeof AI_REQUEST_TYPES)[number],
  string
> = {
  CALENDAR_EVENT: "安排一个日程",
  REMINDER: "设置提醒",
  TASK: "整理待办事项",
  TRANSACTION: "记录一笔账单",
  TRIP: "规划一段行程",
};
const { allowNavigation } = useUnsavedChanges(
  computed(() => userInput.value.trim().length > 0),
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
    allowNavigation();
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
  <SecondaryPageShell
    class="ai-page ai-workspace"
    title="AI 助手"
    title-id="ai-title"
    subtitle="单轮输入需求，生成一份待核对的提案"
  >
    <SectionCard
      title="说说你想完成什么"
      description="这是一次单轮需求输入。当前页面不保存聊天历史。"
    >
      <div class="ai-assistant-prompt" role="note">
        <span class="ai-assistant-prompt__label">AI 助手</span>
        <p>选择业务类型并描述需求，我会生成一份可编辑、待确认的建议。</p>
      </div>

      <form class="capture-panel ai-request-form" @submit.prevent="generate">
        <fieldset class="ai-request-types">
          <legend>要处理的类型</legend>
          <div class="ai-request-types__options">
            <button
              v-for="type in AI_REQUEST_TYPES"
              :key="type"
              :aria-pressed="requestType === type"
              :class="{ 'is-selected': requestType === type }"
              :title="requestTypeDescriptions[type]"
              class="ai-request-type"
              type="button"
              @click="requestType = type"
            >
              {{ requestTypeLabels[type] }}
            </button>
          </div>
        </fieldset>

        <label class="capture-label ai-message-editor">
          <span>你的需求</span>
          <textarea
            v-model="userInput"
            aria-describedby="ai-input-help"
            maxlength="2000"
            placeholder="例如：明天下午三点和产品团队开会"
            rows="4"
          ></textarea>
          <small id="ai-input-help"
            >可输入较长内容；生成前不会写入正式数据。</small
          >
        </label>

        <div aria-live="polite" class="ai-generation-status">
          <p v-if="generating" class="ai-generation-status__pending">
            正在生成待审核提案，请稍候…
          </p>
          <p v-else-if="errorMessage" class="form-error" role="alert">
            {{ errorMessage }}
          </p>
        </div>

        <FormActions>
          <button
            class="primary-button ai-generate-button"
            :disabled="!canGenerate"
            type="submit"
          >
            {{
              generating
                ? "正在生成…"
                : errorMessage
                  ? "重新生成提案"
                  : "生成提案"
            }}
          </button>
        </FormActions>

        <p class="ai-confirmation-note">
          生成后会进入提案核对页；只有你确认后，才会写入正式数据。
        </p>
      </form>
    </SectionCard>
  </SecondaryPageShell>
</template>
