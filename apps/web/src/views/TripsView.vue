<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, type TripSummary } from "../api/client";
import DateField from "../components/DateField.vue";
import EmptyState from "../components/EmptyState.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import PageHeader from "../components/PageHeader.vue";
import SectionCard from "../components/SectionCard.vue";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
import { useAuthStore } from "../stores/auth";
import { useTripsStore } from "../stores/trips";

const auth = useAuthStore();
const tripsStore = useTripsStore();
const includeDeleted = ref(false);
const visibleTrips = ref<TripSummary[]>([]);
const loadedFilter = ref<boolean | null>(null);
const loading = ref(false);
const loadError = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const saving = ref(false);
const mutating = ref(false);
let loadSequence = 0;
const form = ref({
  budgetAmount: "",
  destination: "",
  endDate: "",
  startDate: "",
  title: "",
});
useUnsavedChanges(
  computed(
    () =>
      Boolean(form.value.title.trim()) ||
      Boolean(form.value.destination.trim()) ||
      Boolean(form.value.startDate) ||
      Boolean(form.value.endDate) ||
      Boolean(form.value.budgetAmount.trim()),
  ),
);
const hasCurrentList = computed(
  () => loadedFilter.value === includeDeleted.value,
);

onMounted(() => {
  if (auth.isAuthenticated) void reload();
});

async function reload() {
  const requestedFilter = includeDeleted.value;
  const sequence = ++loadSequence;
  loading.value = true;
  loadError.value = "";
  try {
    await tripsStore.loadTrips({
      includeDeleted: requestedFilter || undefined,
    });
    if (sequence !== loadSequence || requestedFilter !== includeDeleted.value)
      return;
    if (tripsStore.errorMessage || tripsStore.errorKind) {
      loadError.value =
        tripsStore.errorMessage || "行程暂时无法加载，请稍后重试";
      return;
    }
    visibleTrips.value = tripsStore.trips.filter(
      (item) => requestedFilter || !item.deletedAt,
    );
    loadedFilter.value = requestedFilter;
  } catch (error) {
    if (sequence === loadSequence) loadError.value = messageOf(error);
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

function changeFilter() {
  errorMessage.value = "";
  successMessage.value = "";
  void reload();
}

async function submit() {
  if (saving.value || mutating.value) return;
  errorMessage.value = "";
  successMessage.value = "";
  saving.value = true;
  try {
    await tripsStore.createTrip({
      budgetAmount: form.value.budgetAmount.trim() || null,
      destination: form.value.destination,
      endDate: form.value.endDate,
      startDate: form.value.startDate,
      title: form.value.title,
    });
    form.value = {
      budgetAmount: "",
      destination: "",
      endDate: "",
      startDate: "",
      title: "",
    };
    successMessage.value = "行程已创建";
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    saving.value = false;
  }
}

async function changeDeletion(item: TripSummary, action: "delete" | "restore") {
  if (mutating.value || saving.value) return;
  errorMessage.value = "";
  successMessage.value = "";
  mutating.value = true;
  try {
    if (action === "delete") await tripsStore.deleteTrip(item.id);
    else await tripsStore.restoreTrip(item.id);
    successMessage.value = action === "delete" ? "行程已删除" : "行程已恢复";
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    mutating.value = false;
  }
}

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) {
    const field = error.fieldErrors?.[0];
    return field ? field.message : error.message;
  }
  return error instanceof Error ? error.message : "网络异常，请稍后重试";
}
</script>

<template>
  <section class="trip-page trip-list-page" aria-labelledby="trips-title">
    <PageHeader title="我的行程" title-id="trips-title" subtitle="行程" />
    <div class="trip-list-toolbar">
      <div>
        <h2>行程列表</h2>
        <p>查看已有行程，或开启一段新的安排。</p>
      </div>
      <label class="check-label">
        <input
          v-model="includeDeleted"
          type="checkbox"
          @change="changeFilter"
        />
        显示已删除
      </label>
    </div>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="form-success" role="status">
      {{ successMessage }}
    </p>
    <SectionCard
      class="trip-list-panel"
      title="现有行程"
      description="选择行程查看详情；已删除行程可在筛选后恢复。"
    >
      <LoadingState
        v-if="loading && !hasCurrentList"
        title="正在加载行程…"
        description="正在获取当前筛选下的行程。"
      />
      <ErrorState
        v-else-if="loadError && !hasCurrentList"
        title="行程暂时无法加载"
        :description="loadError"
        action-label="重试"
        @retry="reload"
      />
      <template v-else>
        <LoadingState
          v-if="loading"
          title="正在更新行程…"
          description="当前列表仍可查看。"
        />
        <div v-if="loadError" class="planner-stale-warning" role="alert">
          <span>{{ loadError }} 当前显示的是上次成功加载的行程。</span>
          <button class="secondary-button" type="button" @click="reload">
            重试
          </button>
        </div>
        <EmptyState
          v-if="hasCurrentList && visibleTrips.length === 0 && !loading"
          icon="calendar"
          :title="includeDeleted ? '当前筛选没有行程' : '还没有行程'"
          :description="
            includeDeleted ? '暂无可显示的行程。' : '创建一个行程，开始规划吧。'
          "
        />
        <ul v-else-if="hasCurrentList && visibleTrips.length" class="trip-list">
          <li
            v-for="item in visibleTrips"
            :key="item.id"
            :class="{ 'is-deleted': item.deletedAt !== null }"
          >
            <RouterLink :to="`/trips/${item.id}`" class="trip-row">
              <span class="trip-main">
                <strong>{{ item.title }}</strong>
                <small
                  >{{ item.destination }} · {{ item.startDate }} –
                  {{ item.endDate }}</small
                >
                <small v-if="item.budgetAmount"
                  >预算 ¥{{ item.budgetAmount }}</small
                >
              </span>
              <span v-if="item.deletedAt" class="revoked-mark">已删除</span>
            </RouterLink>
            <div class="row-actions">
              <RouterLink
                v-if="!item.deletedAt"
                class="text-button"
                :to="`/trips/${item.id}`"
                >查看</RouterLink
              >
              <button
                v-if="!item.deletedAt"
                class="text-button danger"
                :disabled="mutating || saving"
                type="button"
                @click="changeDeletion(item, 'delete')"
              >
                删除
              </button>
              <button
                v-else
                class="text-button"
                :disabled="mutating || saving"
                type="button"
                @click="changeDeletion(item, 'restore')"
              >
                恢复
              </button>
            </div>
          </li>
        </ul>
      </template>
    </SectionCard>
    <SectionCard
      class="trip-create-panel"
      title="新建行程"
      description="填写目的地与日期，预算可稍后补充。"
    >
      <form class="trip-create" @submit.prevent="submit">
        <label class="trip-field"
          >标题<input v-model="form.title" maxlength="200" required
        /></label>
        <label class="trip-field"
          >目的地<input v-model="form.destination" maxlength="200" required
        /></label>
        <label class="trip-field"
          >开始日期<DateField
            v-model="form.startDate"
            :max="form.endDate || undefined"
            required
        /></label>
        <label class="trip-field"
          >结束日期<DateField
            v-model="form.endDate"
            :min="form.startDate || undefined"
            required
        /></label>
        <label class="trip-field"
          >预算（元，可选）<input
            v-model="form.budgetAmount"
            inputmode="decimal"
            placeholder="0.00"
            step="0.01"
            type="text"
        /></label>
        <button
          class="primary-button"
          :disabled="saving || mutating"
          type="submit"
        >
          {{ saving ? "创建中…" : "新建行程" }}
        </button>
      </form>
    </SectionCard>
  </section>
</template>
