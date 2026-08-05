<script setup lang="ts">
import { onMounted, ref } from "vue";

import {
  ApiClientError,
  api,
  type ShortcutCredentialSummary,
  type ShortcutScope,
} from "../api/client";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const name = ref("");
const scopes = ref<ShortcutScope[]>([]);
const credentials = ref<ShortcutCredentialSummary[]>([]);
const createdToken = ref("");
const createdName = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);
const copying = ref(false);

const scopeOptions: Array<{
  label: string;
  value: ShortcutScope;
}> = [
  {
    label: "创建交易草稿（transaction:draft:create）",
    value: "transaction:draft:create",
  },
  {
    label: "读取今日支出（finance:summary:read）",
    value: "finance:summary:read",
  },
];

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
  }
});

function toggleScope(scope: ShortcutScope) {
  const index = scopes.value.indexOf(scope);
  if (index >= 0) {
    scopes.value.splice(index, 1);
  } else {
    scopes.value.push(scope);
  }
}

async function createCredential() {
  errorMessage.value = "";
  successMessage.value = "";
  createdToken.value = "";
  if (!name.value.trim() || scopes.value.length === 0) {
    errorMessage.value = "请填写名称并至少选择一个权限范围";
    return;
  }
  loading.value = true;
  try {
    const result = await api.createShortcutCredential({
      name: name.value.trim(),
      scopes: [...scopes.value],
    });
    createdToken.value = result.plaintextToken;
    createdName.value = result.credential.name;
    name.value = "";
    scopes.value = [];
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    loading.value = false;
  }
}

async function revoke(id: string) {
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await api.revokeShortcutCredential(id);
    await reload();
    successMessage.value = "设备凭证已撤销，快捷指令将立即失效。";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function reload() {
  try {
    const result = await api.listShortcutCredentials();
    credentials.value = result.items;
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function copyToken() {
  copying.value = true;
  try {
    await navigator.clipboard.writeText(createdToken.value);
    successMessage.value = "令牌已复制，请立即保存到快捷指令。";
  } catch {
    errorMessage.value = "复制失败，请手动复制令牌。";
  } finally {
    copying.value = false;
  }
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "网络异常，请稍后重试";
}
</script>

<template>
  <section class="shortcuts-page" aria-labelledby="shortcuts-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">Apple 快捷指令</p>
        <h1 id="shortcuts-title">快捷指令配置</h1>
      </div>
    </header>

    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="form-success" role="status">
      {{ successMessage }}
    </p>

    <section class="guide-section" aria-labelledby="guide-title">
      <h2 id="guide-title">使用步骤</h2>
      <ol class="guide-steps">
        <li>创建设备凭证并选择最小权限范围；</li>
        <li>令牌只显示一次，复制后保存到快捷指令的“文本”变量；</li>
        <li>
          记账：快捷指令调用“获取 URL 内容”，POST
          <code>/api/v1/shortcuts/transaction-drafts</code>，请求头携带
          <code>Authorization: Bearer &lt;令牌&gt;</code> 与
          <code>Idempotency-Key: &lt;16 位以上随机串&gt;</code>，请求体为
          <code>{"amount":"38.50","merchant":"星巴克","type":"EXPENSE"}</code>；
        </li>
        <li>
          查账：GET <code>/api/v1/shortcuts/today-spend</code> 返回今日支出；
        </li>
        <li>快捷指令只生成待确认草稿，入账前请到草稿中心确认。</li>
      </ol>
    </section>

    <section class="guide-section" aria-labelledby="create-title">
      <h2 id="create-title">创建设备凭证</h2>
      <form class="auth-form" @submit.prevent="createCredential">
        <label>
          名称
          <input
            v-model="name"
            maxlength="60"
            placeholder="例如：iPhone 记账"
          />
        </label>
        <fieldset class="scope-fieldset">
          <legend>权限范围（最少一个）</legend>
          <label
            v-for="option in scopeOptions"
            :key="option.value"
            class="check-label"
          >
            <input
              :checked="scopes.includes(option.value)"
              type="checkbox"
              @change="toggleScope(option.value)"
            />
            {{ option.label }}
          </label>
        </fieldset>
        <button class="primary-button" :disabled="loading" type="submit">
          创建凭证
        </button>
      </form>

      <div v-if="createdToken" class="token-once" role="alert">
        <h3>令牌只显示这一次</h3>
        <p class="dialog-copy">
          {{ createdName }}
          的完整令牌如下，请立即复制并保存；关闭页面后将无法再次查看。
        </p>
        <code class="token-code">{{ createdToken }}</code>
        <button
          class="secondary-button"
          :disabled="copying"
          type="button"
          @click="copyToken"
        >
          {{ copying ? "复制中…" : "复制令牌" }}
        </button>
      </div>
    </section>

    <section class="guide-section" aria-labelledby="list-title">
      <h2 id="list-title">已创建凭证</h2>
      <p v-if="credentials.length === 0" class="empty-copy">还没有设备凭证。</p>
      <ul v-else class="credential-list">
        <li v-for="item in credentials" :key="item.id">
          <div class="credential-main">
            <strong>{{ item.name }}</strong>
            <small>前缀 {{ item.tokenPrefix }}</small>
            <small>范围：{{ item.scopes.join("、") }}</small>
            <small v-if="item.lastUsedAt">
              最近使用：{{ formatTime(item.lastUsedAt) }}
            </small>
            <small v-if="item.revokedAt" class="revoked-mark">已撤销</small>
          </div>
          <button
            v-if="!item.revokedAt"
            class="danger-button"
            type="button"
            @click="revoke(item.id)"
          >
            撤销
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>

<script lang="ts">
function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
</script>
