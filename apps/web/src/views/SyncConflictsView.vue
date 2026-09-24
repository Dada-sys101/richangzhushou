<script setup lang="ts">
import { computed, ref, watch } from "vue";

import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import { requestAppConfirm } from "../composables/useAppConfirm";
import type {
  PendingMutation,
  SyncAction,
  SyncEntityType,
} from "../offline/sync";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";

const auth = useAuthStore();
const sync = useSyncStore();
const processingId = ref<string | null>(null);
const retrying = ref(false);
const actionError = ref("");
const actionMessage = ref("");

const userId = computed(() => auth.userId);
const ready = computed(() =>
  Boolean(userId.value && sync.initialized && sync.lastUserId === userId.value),
);
const conflicts = computed(() =>
  ready.value
    ? sync.conflicts.filter((item) => item.userId === userId.value)
    : [],
);
const offline = computed(() => sync.offline || auth.offlineMode);
const unavailable = computed(() => offline.value || Boolean(sync.errorMessage));
const busy = computed(() => processingId.value !== null || retrying.value);

watch(userId, () => {
  actionError.value = "";
  actionMessage.value = "";
});

const entityNames: Record<SyncEntityType, string> = {
  TRANSACTION: "账单",
  CATEGORY: "分类",
  FINANCIAL_ACCOUNT: "财务账户",
  BUDGET: "预算",
  CALENDAR_EVENT: "日程",
  TASK: "待办",
  REMINDER: "提醒",
  TRIP: "行程",
  TRIP_ITEM: "行程节点",
  PACKING_ITEM: "行李项",
  DRAFT_RECORD: "草稿",
};
const actionNames: Record<SyncAction, string> = {
  CREATE: "新建",
  UPDATE: "修改",
  DELETE: "删除",
  RESTORE: "恢复",
};

function canKeepLocal(conflict: PendingMutation) {
  return conflict.errorCode !== "IDEMPOTENCY_CONFLICT";
}

function stillCurrent(id: string) {
  return userId.value === id && sync.lastUserId === id;
}

async function retry() {
  if (busy.value || !userId.value) return;
  const id = userId.value;
  retrying.value = true;
  actionError.value = "";
  actionMessage.value = "";
  try {
    await sync.retry(id);
    if (stillCurrent(id)) await sync.refresh(id, { fetchServer: false });
  } catch {
    if (stillCurrent(id)) actionError.value = "重试失败，请检查网络后再试。";
  } finally {
    retrying.value = false;
  }
}

async function choose(conflict: PendingMutation, choice: "local" | "server") {
  if (
    busy.value ||
    !ready.value ||
    unavailable.value ||
    (choice === "local" && !canKeepLocal(conflict)) ||
    !conflicts.value.some((item) => item.id === conflict.id)
  )
    return;
  const id = userId.value;
  if (!id) return;
  processingId.value = conflict.id;
  actionError.value = "";
  actionMessage.value = "";
  try {
    const confirmed = await requestAppConfirm({
      title: choice === "local" ? "重新提交本地内容？" : "使用服务端内容？",
      description:
        choice === "local"
          ? "将按现有同步规则重新提交本地修改，可能再次产生冲突；完成同步前不会宣称已写入服务端。"
          : "将丢弃这项待处理的本地修改，使用服务端当前内容。此选择不能撤回。",
      confirmLabel: choice === "local" ? "确认重新提交" : "确认使用服务端",
      cancelLabel: "取消",
      destructive: choice === "server",
    });
    if (
      !confirmed ||
      !stillCurrent(id) ||
      !conflicts.value.some((item) => item.id === conflict.id)
    )
      return;
    await sync.resolve(id, conflict.id, choice);
    if (!stillCurrent(id)) return;
    await sync.refresh(id, { fetchServer: false });
    if (!stillCurrent(id)) return;
    if (
      sync.errorMessage ||
      sync.conflicts.some(
        (item) =>
          item.userId === id &&
          item.entityType === conflict.entityType &&
          item.entityId === conflict.entityId,
      )
    ) {
      actionError.value = "同步尚未完成，请检查状态并重试。";
    } else {
      actionMessage.value =
        choice === "local"
          ? "已按现有规则重新提交本地修改；请确认后续同步状态。"
          : "已移除这项本地修改，服务端内容已保留。";
    }
  } catch {
    if (stillCurrent(id)) actionError.value = "处理失败，冲突仍可在此重试。";
  } finally {
    processingId.value = null;
  }
}
</script>

<template>
  <SecondaryPageShell
    title="冲突处理"
    title-id="conflicts-title"
    subtitle="同步"
  >
    <div class="sync-conflicts-page">
      <section
        class="sync-conflicts-overview"
        aria-labelledby="conflicts-overview-title"
      >
        <p class="sync-conflicts-eyebrow">同步冲突</p>
        <h2 id="conflicts-overview-title">先比较，再决定保留哪一侧</h2>
        <p>
          本地修改与服务端当前内容不一致。每项需要你明确选择，页面不会自动合并或覆盖。
        </p>
        <p
          v-if="ready && conflicts.length"
          class="sync-conflicts-count"
          role="status"
        >
          待处理 {{ conflicts.length }} 项
        </p>
      </section>

      <p v-if="actionMessage" class="form-success" role="status">
        {{ actionMessage }}
      </p>
      <p v-if="actionError" class="form-error" role="alert">
        {{ actionError }}
      </p>

      <LoadingState
        v-if="!ready"
        title="正在读取冲突"
        description="正在确认当前账号的本地同步状态。"
      />
      <template v-else>
        <div
          v-if="unavailable"
          class="sync-conflicts-availability"
          role="alert"
        >
          <strong>{{ offline ? "当前离线" : "同步暂时失败" }}</strong>
          <p>
            {{
              offline
                ? "可以查看已加载的冲突；请联网后再选择并重试同步。"
                : "可以查看已加载的冲突；请先重试同步，再作选择。"
            }}
          </p>
          <button
            class="secondary-button"
            type="button"
            :disabled="busy"
            @click="retry"
          >
            {{ retrying ? "正在重试…" : "重试同步" }}
          </button>
        </div>
        <ErrorState
          v-if="!conflicts.length && sync.errorMessage && !offline"
          title="冲突状态暂时无法确认"
          description="同步失败，当前不能确认是否还有冲突。请重试。"
        />
        <p
          v-else-if="!conflicts.length && offline"
          class="sync-conflicts-empty"
        >
          当前离线，暂时无法确认是否还有冲突。联网后请重试。
        </p>
        <p
          v-else-if="!conflicts.length"
          class="sync-conflicts-empty"
          role="status"
        >
          当前没有待处理的冲突。
        </p>
        <section v-else aria-labelledby="conflicts-list-title">
          <h2 id="conflicts-list-title" class="sync-conflicts-list-title">
            逐项核对
          </h2>
          <ul class="conflict-list">
            <li
              v-for="conflict in conflicts"
              :key="conflict.id"
              class="conflict-card"
            >
              <div class="conflict-head">
                <div>
                  <h3>
                    {{ entityNames[conflict.entityType] }} ·
                    {{ actionNames[conflict.action] }}
                  </h3>
                  <p
                    v-if="conflict.errorCode === 'IDEMPOTENCY_CONFLICT'"
                    class="conflict-reason"
                  >
                    重复请求的内容不一致。当前同步规则无法通过此冲突保留本地修改；这里只能丢弃该待处理修改并使用服务端内容。
                  </p>
                  <p v-else class="conflict-reason">
                    本地修改与服务端版本冲突，请对照后选择。
                  </p>
                </div>
                <span class="conflict-status">待你选择</span>
              </div>
              <div class="conflict-grid">
                <div class="conflict-pane">
                  <h4>本地待提交内容</h4>
                  <pre>{{ JSON.stringify(conflict.payload, null, 2) }}</pre>
                </div>
                <div class="conflict-pane">
                  <h4>服务端当前内容</h4>
                  <pre>{{
                    conflict.current
                      ? JSON.stringify(conflict.current.data, null, 2)
                      : "暂无可对照的服务端内容"
                  }}</pre>
                </div>
              </div>
              <p class="conflict-version">
                本地版本：{{ conflict.version ?? "未提供" }}
              </p>
              <div class="conflict-actions">
                <button
                  v-if="canKeepLocal(conflict)"
                  class="primary-button"
                  type="button"
                  :disabled="busy || unavailable"
                  @click="choose(conflict, 'local')"
                >
                  {{
                    processingId === conflict.id
                      ? "处理中…"
                      : "重新提交本地内容"
                  }}
                </button>
                <button
                  class="secondary-button"
                  type="button"
                  :disabled="busy || unavailable"
                  @click="choose(conflict, 'server')"
                >
                  {{
                    processingId === conflict.id ? "处理中…" : "使用服务端内容"
                  }}
                </button>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </SecondaryPageShell>
</template>
