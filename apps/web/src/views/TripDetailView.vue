<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import {
  ApiClientError,
  type PackingItemSummary,
  type TripDetailResponse,
  type TripItemSummary,
  type TripItemType,
} from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useTripsStore } from "../stores/trips";
import {
  formatDateTime,
  formatShanghaiDate,
  toLocalDateTimeInput,
  toShanghaiIso,
} from "../utils/time";

const route = useRoute();
const auth = useAuthStore();
const tripsStore = useTripsStore();

const tripId = computed(() =>
  typeof route.params.id === "string" ? route.params.id : "",
);
const detail = computed<TripDetailResponse | null>(() => tripsStore.detail);

const errorMessage = ref("");
const successMessage = ref("");
const saving = ref(false);

const editingTrip = ref(false);
const tripForm = ref({
  budgetAmount: "",
  destination: "",
  endDate: "",
  startDate: "",
  title: "",
  version: 1,
});

const itemForm = ref({
  endsAt: "",
  location: "",
  startsAt: "",
  type: "ACTIVITY" as TripItemType,
});
const editingItemId = ref("");
const itemEditForm = ref({
  endsAt: "",
  location: "",
  startsAt: "",
  type: "ACTIVITY" as TripItemType,
  version: 1,
});

interface ItemCreatePayload {
  endsAt: string;
  location: string | null;
  startsAt: string;
  type: TripItemType;
}

interface ItemUpdatePayload extends ItemCreatePayload {
  version: number;
}

const pendingOutOfRange = ref<
  | { itemId?: undefined; mode: "create"; payload: ItemCreatePayload }
  | { itemId: string; mode: "update"; payload: ItemUpdatePayload }
  | null
>(null);

const packingText = ref("");
const editingPackingId = ref("");
const packingEditText = ref("");

onMounted(() => {
  if (auth.isAuthenticated && tripId.value) {
    void load();
  }
});

watch(tripId, () => {
  if (tripId.value) {
    void load();
  }
});

async function load() {
  errorMessage.value = "";
  try {
    await tripsStore.loadTrip(tripId.value);
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function startEditTrip() {
  const trip = detail.value?.trip;
  if (!trip) {
    return;
  }
  editingTrip.value = true;
  tripForm.value = {
    budgetAmount: trip.budgetAmount ?? "",
    destination: trip.destination,
    endDate: trip.endDate,
    startDate: trip.startDate,
    title: trip.title,
    version: trip.version,
  };
}

async function saveEditTrip() {
  errorMessage.value = "";
  successMessage.value = "";
  saving.value = true;
  try {
    await tripsStore.updateTrip(tripId.value, {
      budgetAmount: tripForm.value.budgetAmount.trim() || null,
      destination: tripForm.value.destination,
      endDate: tripForm.value.endDate,
      startDate: tripForm.value.startDate,
      title: tripForm.value.title,
      version: tripForm.value.version,
    });
    successMessage.value = "行程已更新";
    editingTrip.value = false;
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    saving.value = false;
  }
}

async function removeTrip() {
  errorMessage.value = "";
  try {
    await tripsStore.deleteTrip(tripId.value);
    successMessage.value = "行程已删除";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function restoreTrip() {
  errorMessage.value = "";
  try {
    await tripsStore.restoreTrip(tripId.value);
    await load();
    successMessage.value = "行程已恢复";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function submitItem() {
  errorMessage.value = "";
  pendingOutOfRange.value = null;
  const payload = {
    endsAt: toShanghaiIso(itemForm.value.endsAt),
    location: itemForm.value.location.trim() || null,
    startsAt: toShanghaiIso(itemForm.value.startsAt),
    type: itemForm.value.type,
  };
  try {
    const result = await tripsStore.createTripItem(tripId.value, payload);
    showItemResult(result);
    itemForm.value = {
      endsAt: "",
      location: "",
      startsAt: "",
      type: "ACTIVITY",
    };
  } catch (error) {
    handleItemError(error, "create", payload);
  }
}

function startEditItem(item: TripItemSummary) {
  editingItemId.value = item.id;
  itemEditForm.value = {
    endsAt: toLocalDateTimeInput(item.endsAt),
    location: item.location ?? "",
    startsAt: toLocalDateTimeInput(item.startsAt),
    type: item.type,
    version: item.version,
  };
}

async function saveEditItem(item: TripItemSummary) {
  errorMessage.value = "";
  pendingOutOfRange.value = null;
  const payload = {
    endsAt: toShanghaiIso(itemEditForm.value.endsAt),
    location: itemEditForm.value.location.trim() || null,
    startsAt: toShanghaiIso(itemEditForm.value.startsAt),
    type: itemEditForm.value.type,
    version: itemEditForm.value.version,
  };
  try {
    const result = await tripsStore.updateTripItem(
      item.id,
      tripId.value,
      payload,
    );
    showItemResult(result);
    editingItemId.value = "";
  } catch (error) {
    handleItemError(error, "update", payload, item.id);
  }
}

async function confirmOutOfRange() {
  if (!pendingOutOfRange.value) {
    return;
  }
  const pending = pendingOutOfRange.value;
  pendingOutOfRange.value = null;
  errorMessage.value = "";
  saving.value = true;
  try {
    if (pending.mode === "create") {
      const result = await tripsStore.createTripItem(tripId.value, {
        ...pending.payload,
        confirmOutOfRange: true,
      });
      showItemResult(result);
      itemForm.value = {
        endsAt: "",
        location: "",
        startsAt: "",
        type: "ACTIVITY",
      };
    } else if (pending.itemId) {
      const result = await tripsStore.updateTripItem(
        pending.itemId,
        tripId.value,
        {
          ...pending.payload,
          confirmOutOfRange: true,
        },
      );
      showItemResult(result);
      editingItemId.value = "";
    }
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    saving.value = false;
  }
}

function showItemResult(result: { outOfRangeWarning?: { message: string } }) {
  successMessage.value = result.outOfRangeWarning
    ? result.outOfRangeWarning.message
    : "节点已保存";
}

function handleItemError(
  error: unknown,
  mode: "create" | "update",
  payload: ItemCreatePayload | ItemUpdatePayload,
  itemId?: string,
) {
  if (error instanceof ApiClientError && error.message.includes("超出")) {
    pendingOutOfRange.value =
      mode === "create"
        ? { mode, payload: payload as ItemCreatePayload }
        : { itemId: itemId ?? "", mode, payload: payload as ItemUpdatePayload };
    return;
  }
  errorMessage.value = messageOf(error);
}

function cancelItemEdit() {
  editingItemId.value = "";
}

async function removeItem(item: TripItemSummary) {
  errorMessage.value = "";
  try {
    await tripsStore.deleteTripItem(item.id, tripId.value);
    successMessage.value = "节点已删除";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function restoreItem(item: TripItemSummary) {
  errorMessage.value = "";
  try {
    await tripsStore.restoreTripItem(item.id, tripId.value);
    successMessage.value = "节点已恢复";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function submitPacking() {
  errorMessage.value = "";
  try {
    await tripsStore.createPackingItem(tripId.value, {
      text: packingText.value.trim(),
    });
    packingText.value = "";
    successMessage.value = "行李项已添加";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function startEditPacking(item: PackingItemSummary) {
  editingPackingId.value = item.id;
  packingEditText.value = item.text;
}

async function saveEditPacking(item: PackingItemSummary) {
  errorMessage.value = "";
  try {
    await tripsStore.updatePackingItem(item.id, tripId.value, {
      text: packingEditText.value.trim(),
      version: item.version,
    });
    editingPackingId.value = "";
    successMessage.value = "行李项已更新";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function togglePacking(item: PackingItemSummary) {
  errorMessage.value = "";
  try {
    await tripsStore.updatePackingItem(item.id, tripId.value, {
      checked: !item.checked,
      version: item.version,
    });
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function removePacking(item: PackingItemSummary) {
  errorMessage.value = "";
  try {
    await tripsStore.deletePackingItem(item.id, tripId.value);
    successMessage.value = "行李项已删除";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function restorePacking(item: PackingItemSummary) {
  errorMessage.value = "";
  try {
    await tripsStore.restorePackingItem(item.id, tripId.value);
    successMessage.value = "行李项已恢复";
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) {
    const field = error.fieldErrors?.[0];
    return field ? field.message : error.message;
  }
  return "网络异常，请稍后重试";
}

function percent(value: string | null): string {
  if (value === null) {
    return "未设置预算";
  }
  return `${(Number(value) * 100).toFixed(0)}%`;
}
</script>

<template>
  <section class="trip-page" aria-labelledby="trip-detail-title">
    <p class="eyebrow">
      <RouterLink class="text-button" to="/trips">行程</RouterLink>
      / 详情
    </p>

    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="form-success" role="status">
      {{ successMessage }}
    </p>

    <template v-if="detail">
      <header class="page-head">
        <div>
          <h1 id="trip-detail-title">{{ detail.trip.title }}</h1>
          <p class="trip-meta">
            {{ detail.trip.destination }} 路 {{ detail.trip.startDate }} –
            {{ detail.trip.endDate }}
          </p>
        </div>
        <div class="trip-head-actions">
          <button
            v-if="!editingTrip && !detail.trip.deletedAt"
            class="secondary-button"
            type="button"
            @click="startEditTrip"
          >
            编辑行程
          </button>
          <button
            v-if="!detail.trip.deletedAt"
            class="danger-button"
            type="button"
            @click="removeTrip"
          >
            删除
          </button>
          <button
            v-if="detail.trip.deletedAt"
            class="secondary-button"
            type="button"
            @click="restoreTrip"
          >
            恢复
          </button>
        </div>
      </header>

      <form
        v-if="editingTrip"
        class="trip-create"
        @submit.prevent="saveEditTrip"
      >
        <label class="trip-field">
          标题
          <input v-model="tripForm.title" maxlength="200" required />
        </label>
        <label class="trip-field">
          目的地
          <input v-model="tripForm.destination" maxlength="200" required />
        </label>
        <label class="trip-field">
          开始日期
          <input v-model="tripForm.startDate" required type="date" />
        </label>
        <label class="trip-field">
          结束日期
          <input v-model="tripForm.endDate" required type="date" />
        </label>
        <label class="trip-field">
          预算（元，可选）
          <input
            v-model="tripForm.budgetAmount"
            inputmode="decimal"
            step="0.01"
            type="text"
          />
        </label>
        <div class="trip-actions">
          <button class="primary-button" :disabled="saving" type="submit">
            保存
          </button>
          <button
            class="secondary-button"
            type="button"
            @click="editingTrip = false"
          >
            取消
          </button>
        </div>
      </form>

      <section class="trip-card" aria-label="费用汇总">
        <div class="today-stat">
          <span class="stat-label">实际支出</span>
          <strong class="stat-value"
            >楼{{ detail.expense.actualExpense }}</strong
          >
        </div>
        <div class="today-stat">
          <span class="stat-label">预算</span>
          <strong class="stat-value">
            {{
              detail.expense.budgetAmount
                ? `楼${detail.expense.budgetAmount}`
                : "未设置"
            }}
          </strong>
        </div>
        <div class="today-stat">
          <span class="stat-label">预算进度</span>
          <strong class="stat-value">{{
            percent(detail.expense.budgetProgress)
          }}</strong>
        </div>
      </section>

      <div v-if="pendingOutOfRange" class="warning-banner" role="alert">
        <p>节点时间超出行程日期范围，仍要保存吗？</p>
        <div class="trip-actions">
          <button
            class="primary-button"
            :disabled="saving"
            type="button"
            @click="confirmOutOfRange"
          >
            仍要保存
          </button>
          <button
            class="secondary-button"
            type="button"
            @click="pendingOutOfRange = null"
          >
            取消
          </button>
        </div>
      </div>

      <section class="trip-section" aria-labelledby="trip-items-title">
        <h2 id="trip-items-title">行程节点</h2>
        <form class="trip-create" @submit.prevent="submitItem">
          <label class="trip-field">
            类型
            <select v-model="itemForm.type">
              <option value="TRANSPORT">交通</option>
              <option value="STAY">住宿</option>
              <option value="ACTIVITY">活动</option>
              <option value="FOOD">餐饮</option>
              <option value="OTHER">其他</option>
            </select>
          </label>
          <label class="trip-field">
            开始
            <input v-model="itemForm.startsAt" required type="datetime-local" />
          </label>
          <label class="trip-field">
            结束
            <input v-model="itemForm.endsAt" required type="datetime-local" />
          </label>
          <label class="trip-field">
            地点（可选）
            <input v-model="itemForm.location" maxlength="200" type="text" />
          </label>
          <button class="primary-button" type="submit">添加节点</button>
        </form>

        <p v-if="detail.items.length === 0" class="empty-copy">
          还没有行程节点。
        </p>
        <ul v-else class="resource-list">
          <li
            v-for="item in detail.items"
            :key="item.id"
            :class="{ 'is-deleted': item.deletedAt !== null }"
          >
            <template v-if="editingItemId === item.id">
              <form class="trip-create" @submit.prevent="saveEditItem(item)">
                <label class="trip-field">
                  类型
                  <select v-model="itemEditForm.type">
                    <option value="TRANSPORT">交通</option>
                    <option value="STAY">住宿</option>
                    <option value="ACTIVITY">活动</option>
                    <option value="FOOD">餐饮</option>
                    <option value="OTHER">其他</option>
                  </select>
                </label>
                <label class="trip-field">
                  开始
                  <input
                    v-model="itemEditForm.startsAt"
                    required
                    type="datetime-local"
                  />
                </label>
                <label class="trip-field">
                  结束
                  <input
                    v-model="itemEditForm.endsAt"
                    required
                    type="datetime-local"
                  />
                </label>
                <label class="trip-field">
                  地点
                  <input
                    v-model="itemEditForm.location"
                    maxlength="200"
                    type="text"
                  />
                </label>
                <div class="trip-actions">
                  <button class="primary-button" type="submit">保存</button>
                  <button
                    class="secondary-button"
                    type="button"
                    @click="cancelItemEdit"
                  >
                    取消
                  </button>
                </div>
              </form>
            </template>
            <template v-else>
              <div class="planner-main">
                <strong
                  >{{ itemTypeLabel(item.type) }} 路
                  {{ item.location || "未填地点" }}</strong
                >
                <small
                  >{{ formatDateTime(item.startsAt) }} –
                  {{ formatDateTime(item.endsAt) }}</small
                >
                <span v-if="item.deletedAt" class="revoked-mark">已删除</span>
              </div>
              <div class="row-actions">
                <button
                  v-if="!item.deletedAt"
                  class="text-button"
                  type="button"
                  @click="startEditItem(item)"
                >
                  编辑
                </button>
                <button
                  v-if="!item.deletedAt"
                  class="text-button danger"
                  type="button"
                  @click="removeItem(item)"
                >
                  删除
                </button>
                <button
                  v-if="item.deletedAt"
                  class="text-button"
                  type="button"
                  @click="restoreItem(item)"
                >
                  恢复
                </button>
              </div>
            </template>
          </li>
        </ul>
      </section>

      <section class="trip-section" aria-labelledby="packing-title">
        <h2 id="packing-title">行李清单</h2>
        <form class="trip-create" @submit.prevent="submitPacking">
          <label class="trip-field">
            行李项
            <input v-model="packingText" maxlength="200" required type="text" />
          </label>
          <button class="primary-button" type="submit">添加</button>
        </form>
        <p v-if="detail.packingItems.length === 0" class="empty-copy">
          还没有行李项。
        </p>
        <ul v-else class="resource-list">
          <li
            v-for="item in detail.packingItems"
            :key="item.id"
            :class="{ 'is-deleted': item.deletedAt !== null }"
          >
            <template v-if="editingPackingId === item.id">
              <form class="trip-create" @submit.prevent="saveEditPacking(item)">
                <label class="trip-field">
                  行李项
                  <input
                    v-model="packingEditText"
                    maxlength="200"
                    required
                    type="text"
                  />
                </label>
                <div class="trip-actions">
                  <button class="primary-button" type="submit">保存</button>
                  <button
                    class="secondary-button"
                    type="button"
                    @click="editingPackingId = ''"
                  >
                    取消
                  </button>
                </div>
              </form>
            </template>
            <template v-else>
              <label class="check-label">
                <input
                  :checked="item.checked"
                  :disabled="item.deletedAt !== null"
                  type="checkbox"
                  @change="togglePacking(item)"
                />
                <span :class="{ 'packing-done': item.checked }">{{
                  item.text
                }}</span>
              </label>
              <div class="row-actions">
                <button
                  v-if="!item.deletedAt"
                  class="text-button"
                  type="button"
                  @click="startEditPacking(item)"
                >
                  编辑
                </button>
                <button
                  v-if="!item.deletedAt"
                  class="text-button danger"
                  type="button"
                  @click="removePacking(item)"
                >
                  删除
                </button>
                <button
                  v-if="item.deletedAt"
                  class="text-button"
                  type="button"
                  @click="restorePacking(item)"
                >
                  恢复
                </button>
              </div>
            </template>
          </li>
        </ul>
      </section>

      <section class="trip-section" aria-labelledby="trip-calendar-title">
        <h2 id="trip-calendar-title">行程内日历</h2>
        <p v-if="detail.calendarEvents.length === 0" class="empty-copy">
          行程日期范围内没有日程。
        </p>
        <ul v-else class="resource-list">
          <li v-for="event in detail.calendarEvents" :key="event.id">
            <RouterLink
              :to="`/calendar?date=${formatShanghaiDate(new Date(event.startsAt))}`"
              class="trip-row"
            >
              <span class="trip-main">
                <strong>{{ event.title }}</strong>
                <small>{{ formatDateTime(event.startsAt) }}</small>
              </span>
              <span class="schedule-tag">日历</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section class="trip-section" aria-labelledby="trip-transactions-title">
        <h2 id="trip-transactions-title">关联账单</h2>
        <p v-if="detail.linkedTransactions.length === 0" class="empty-copy">
          还没有关联账单，记账时选择该行程即可关联。
        </p>
        <ul v-else class="resource-list">
          <li v-for="item in detail.linkedTransactions" :key="item.id">
            <RouterLink
              :to="`/transactions/${item.id}/edit`"
              class="transaction-row"
            >
              <span class="transaction-main">
                <strong>{{ item.merchant || typeLabel(item.type) }}</strong>
                <small>{{ formatDateTime(item.occurredAt) }}</small>
              </span>
              <span class="transaction-amount" :class="amountClass(item.type)">
                {{ signedMoney(item) }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>

    <p v-else-if="!tripsStore.errorMessage" class="empty-copy">
      正在加载行程……
    </p>
  </section>
</template>

<script lang="ts">
import type { TransactionSummary } from "../api/client";

function itemTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ACTIVITY: "活动",
    FOOD: "餐饮",
    OTHER: "其他",
    STAY: "住宿",
    TRANSPORT: "交通",
  };
  return labels[type] ?? type;
}

function typeLabel(type: string): string {
  return type === "EXPENSE" ? "支出" : type === "INCOME" ? "收入" : "退款";
}

function signedMoney(item: TransactionSummary): string {
  const sign = item.type === "EXPENSE" ? "-" : "+";
  return `${sign}楼${item.amount}`;
}

function amountClass(type: string): string {
  return type === "EXPENSE" ? "amount-expense" : "amount-income";
}
</script>
