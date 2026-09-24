<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import {
  ApiClientError,
  api,
  type ShortcutCredentialSummary,
  type ShortcutScope,
} from "../api/client";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import { requestAppConfirm } from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const name = ref("");
const scopes = ref<ShortcutScope[]>([]);
const credentials = ref<ShortcutCredentialSummary[]>([]);
const createdToken = ref("");
const createdName = ref("");
const nameError = ref("");
const scopeError = ref("");
const actionError = ref("");
const actionStatus = ref("");
const clipboardFeedback = ref("");
const listError = ref("");
const listLoaded = ref(false);
const listLoading = ref(false);
const creating = ref(false);
const copying = ref(false);
const revokingId = ref<string | null>(null);
const nameInput = ref<HTMLInputElement | null>(null);
const scopeFieldset = ref<HTMLFieldSetElement | null>(null);

const scopeOptions: Array<{
  description: string;
  label: string;
  value: ShortcutScope;
}> = [
  {
    description: "生成待你确认的记账草稿，不会直接入账。",
    label: "创建记账草稿",
    value: "transaction:draft:create",
  },
  {
    description: "仅返回今日支出汇总，不读取账单明细。",
    label: "读取今日支出",
    value: "finance:summary:read",
  },
];

const mutationBusy = () => creating.value || revokingId.value !== null;

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
  }
});

onBeforeUnmount(() => {
  createdToken.value = "";
});

function toggleScope(scope: ShortcutScope) {
  scopeError.value = "";
  const index = scopes.value.indexOf(scope);
  if (index >= 0) {
    scopes.value.splice(index, 1);
  } else {
    scopes.value.push(scope);
  }
}

async function createCredential() {
  if (creating.value || revokingId.value !== null || copying.value) return;

  actionError.value = "";
  actionStatus.value = "";
  clipboardFeedback.value = "";
  nameError.value = name.value.trim() ? "" : "请填写设备凭证名称。";
  scopeError.value = scopes.value.length > 0 ? "" : "请至少选择一个权限范围。";

  if (nameError.value || scopeError.value) {
    if (nameError.value) {
      nameInput.value?.focus();
    } else {
      scopeFieldset.value?.focus();
    }
    return;
  }

  createdToken.value = "";
  createdName.value = "";
  creating.value = true;
  try {
    const result = await api.createShortcutCredential({
      name: name.value.trim(),
      scopes: [...scopes.value],
    });
    createdToken.value = result.plaintextToken;
    createdName.value = result.credential.name;
    name.value = "";
    scopes.value = [];
    actionStatus.value = "设备凭证已创建。明文令牌仅在本页显示一次。";
    await reload();
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    creating.value = false;
  }
}

async function revoke(credential: ShortcutCredentialSummary) {
  if (mutationBusy() || copying.value) return;

  actionError.value = "";
  actionStatus.value = "";
  revokingId.value = credential.id;
  try {
    const confirmed = await requestAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "确认撤销",
      description: `撤销后，${credential.name} 对应的快捷指令将立即失效。此操作不能撤回。`,
      destructive: true,
      title: "撤销设备凭证？",
    });
    if (!confirmed) return;

    await api.revokeShortcutCredential(credential.id);
    credentials.value = credentials.value.map((item) =>
      item.id === credential.id
        ? { ...item, revokedAt: item.revokedAt ?? new Date().toISOString() }
        : item,
    );
    actionStatus.value = "设备凭证已撤销，快捷指令将立即失效。";
    await reload();
  } catch (error) {
    actionError.value = messageOf(error);
  } finally {
    revokingId.value = null;
  }
}

async function reload() {
  if (listLoading.value) return false;
  listLoading.value = true;
  listError.value = "";
  try {
    const result = await api.listShortcutCredentials();
    credentials.value = result.items;
    listLoaded.value = true;
    return true;
  } catch (error) {
    listError.value = messageOf(error);
    return false;
  } finally {
    listLoading.value = false;
  }
}

async function copyToken() {
  if (!createdToken.value || copying.value) return;
  copying.value = true;
  clipboardFeedback.value = "";
  try {
    await navigator.clipboard.writeText(createdToken.value);
    clipboardFeedback.value = "令牌已复制，请将它保存到快捷指令中。";
  } catch {
    clipboardFeedback.value = "复制失败。请在上方手动选择并复制令牌。";
  } finally {
    copying.value = false;
  }
}

function scopeLabel(scope: ShortcutScope): string {
  const option = scopeOptions.find((item) => item.value === scope);
  return option ? `${option.label}（${option.value}）` : scope;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "网络异常，请稍后重试";
}
</script>

<template>
  <SecondaryPageShell
    title="快捷指令"
    title-id="shortcuts-title"
    subtitle="设备凭证与调用说明"
  >
    <div class="shortcuts-page">
      <section
        class="shortcuts-intro"
        aria-labelledby="shortcuts-purpose-title"
      >
        <div>
          <p class="shortcuts-eyebrow">用途与安全</p>
          <h2 id="shortcuts-purpose-title">让快捷指令安全地调用有限能力</h2>
          <p class="shortcuts-intro-copy">
            设备凭证可用于创建待确认的记账草稿，或读取今日支出汇总。每个凭证只获得你选择的权限；撤销后立即失效。
          </p>
        </div>
        <ul class="shortcuts-safety-list">
          <li>
            明文令牌只在创建成功后显示一次。请立即复制并妥善保存，不要分享或截图。
          </li>
          <li>
            写入类调用需要提供幂等键；重试同一操作时应复用原键，避免重复创建。
          </li>
          <li>
            快捷指令创建的记账内容先进入草稿，必须由你确认后才会正式入账。
          </li>
        </ul>
        <div class="shortcuts-use-cases" aria-label="当前支持的用途">
          <p>
            <strong>创建记账草稿</strong>
            <span>POST <code>/api/v1/shortcuts/transaction-drafts</code></span>
          </p>
          <p>
            <strong>读取今日支出</strong>
            <span>GET <code>/api/v1/shortcuts/today-spend</code></span>
          </p>
          <p class="shortcuts-idempotency-note">
            请求使用
            <code>Authorization: Bearer &lt;令牌&gt;</code>；写入请求需携带至少
            16 位随机 <code>Idempotency-Key</code>。
          </p>
        </div>
      </section>

      <section class="shortcuts-panel" aria-labelledby="create-title">
        <div class="shortcuts-panel-heading">
          <div>
            <h2 id="create-title">创建设备凭证</h2>
            <p>为一台设备命名，并只授予它需要的权限。</p>
          </div>
        </div>

        <p v-if="actionError" class="form-error" role="alert">
          {{ actionError }}
        </p>
        <p v-if="actionStatus" class="form-success" role="status">
          {{ actionStatus }}
        </p>

        <form
          class="shortcuts-create-form"
          :aria-busy="creating"
          @submit.prevent="createCredential"
        >
          <div class="shortcuts-field">
            <label for="credential-name">凭证名称</label>
            <input
              id="credential-name"
              ref="nameInput"
              v-model="name"
              :aria-describedby="
                nameError ? 'credential-name-error' : 'credential-name-help'
              "
              :aria-invalid="Boolean(nameError)"
              :disabled="mutationBusy() || copying"
              autocomplete="off"
              maxlength="60"
              placeholder="例如：iPhone 记账"
              type="text"
              @input="nameError = ''"
            />
            <p
              v-if="nameError"
              id="credential-name-error"
              class="shortcuts-field-error"
            >
              {{ nameError }}
            </p>
            <p v-else id="credential-name-help" class="shortcuts-field-help">
              最多 60 个字符；建议写明设备，便于之后识别并撤销。
            </p>
          </div>

          <fieldset
            ref="scopeFieldset"
            class="scope-fieldset"
            :aria-describedby="
              scopeError ? 'credential-scope-error' : 'credential-scope-help'
            "
            :aria-invalid="Boolean(scopeError)"
            :disabled="mutationBusy() || copying"
            tabindex="-1"
          >
            <legend>权限范围（至少选择一项）</legend>
            <label
              v-for="option in scopeOptions"
              :key="option.value"
              class="scope-option"
            >
              <input
                :checked="scopes.includes(option.value)"
                type="checkbox"
                @change="toggleScope(option.value)"
              />
              <span class="scope-option-copy">
                <span class="scope-option-title">{{ option.label }}</span>
                <code>{{ option.value }}</code>
                <span class="scope-option-description">{{
                  option.description
                }}</span>
              </span>
            </label>
            <p
              v-if="scopeError"
              id="credential-scope-error"
              class="shortcuts-field-error"
              role="alert"
            >
              {{ scopeError }}
            </p>
            <p v-else id="credential-scope-help" class="shortcuts-field-help">
              范围名称同时显示，便于核对快捷指令使用的技术权限。
            </p>
          </fieldset>

          <button
            class="primary-button shortcuts-create-button"
            :disabled="mutationBusy() || copying"
            type="submit"
          >
            {{ creating ? "正在创建…" : "创建凭证" }}
          </button>
        </form>
      </section>

      <section
        v-if="createdToken"
        class="token-once"
        aria-labelledby="token-once-title"
        aria-describedby="token-once-description"
      >
        <div class="token-once-heading">
          <span class="token-once-icon" aria-hidden="true">!</span>
          <div>
            <h2 id="token-once-title">令牌仅显示这一次</h2>
            <p id="token-once-description">
              “{{
                createdName
              }}”的完整令牌只在本次创建结果中可见。复制并保存后再离开页面；之后无法重新查看。
            </p>
          </div>
        </div>
        <code class="token-code" tabindex="0" aria-label="本次创建的完整令牌">
          {{ createdToken }}
        </code>
        <div class="token-once-actions">
          <button
            class="secondary-button"
            :disabled="copying || mutationBusy()"
            type="button"
            @click="copyToken"
          >
            {{ copying ? "复制中…" : "复制令牌" }}
          </button>
          <p
            v-if="clipboardFeedback"
            class="clipboard-feedback"
            :class="
              clipboardFeedback.startsWith('复制失败')
                ? 'is-error'
                : 'is-success'
            "
            :role="
              clipboardFeedback.startsWith('复制失败') ? 'alert' : 'status'
            "
          >
            {{ clipboardFeedback }}
          </p>
        </div>
      </section>

      <section class="shortcuts-panel" aria-labelledby="list-title">
        <div class="shortcuts-panel-heading shortcuts-list-heading">
          <div>
            <h2 id="list-title">已创建凭证</h2>
            <p>查看每项权限和最近使用时间；撤销后快捷指令会立即失效。</p>
          </div>
          <button
            class="secondary-button shortcuts-refresh-button"
            :disabled="listLoading || mutationBusy() || copying"
            type="button"
            @click="reload"
          >
            {{ listLoading ? "正在刷新…" : "刷新列表" }}
          </button>
        </div>

        <LoadingState
          v-if="!listLoaded && !listError"
          title="正在加载设备凭证"
          description="正在获取当前账号的凭证状态。"
        />
        <ErrorState
          v-else-if="!listLoaded && listError"
          title="凭证列表暂时无法加载"
          :description="listError"
          action-label="重试加载"
          @retry="reload"
        />
        <div v-else class="shortcuts-list-content">
          <p v-if="listLoading" class="shortcuts-refresh-status" role="status">
            正在更新凭证列表…
          </p>
          <div v-if="listError" class="shortcuts-inline-error" role="alert">
            <p>凭证列表刷新失败：{{ listError }}</p>
            <button
              class="secondary-button"
              :disabled="listLoading || mutationBusy() || copying"
              type="button"
              @click="reload"
            >
              重试加载
            </button>
          </div>
          <p
            v-if="credentials.length === 0 && !listError"
            class="shortcuts-empty-state"
          >
            还没有设备凭证。创建后，凭证状态和授权范围会显示在这里。
          </p>
          <ul v-else-if="credentials.length > 0" class="credential-list">
            <li
              v-for="item in credentials"
              :key="item.id"
              class="credential-row"
            >
              <div class="credential-main">
                <div class="credential-title-row">
                  <strong>{{ item.name }}</strong>
                  <span
                    class="credential-status"
                    :class="item.revokedAt ? 'is-revoked' : 'is-active'"
                  >
                    {{ item.revokedAt ? "已撤销" : "有效" }}
                  </span>
                </div>
                <p class="credential-prefix">
                  令牌前缀：{{ item.tokenPrefix }}
                </p>
                <div class="credential-scopes" aria-label="权限范围">
                  <span
                    v-for="scope in item.scopes"
                    :key="scope"
                    class="credential-scope"
                  >
                    {{ scopeLabel(scope) }}
                  </span>
                </div>
                <p class="credential-last-used">
                  最近使用：{{
                    item.lastUsedAt ? formatTime(item.lastUsedAt) : "尚未使用"
                  }}
                </p>
              </div>
              <button
                v-if="!item.revokedAt"
                class="danger-button credential-revoke-button"
                :disabled="mutationBusy() || copying"
                type="button"
                @click="revoke(item)"
              >
                {{ revokingId === item.id ? "等待确认…" : "撤销凭证" }}
              </button>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </SecondaryPageShell>
</template>
