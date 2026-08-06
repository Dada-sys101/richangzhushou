<script setup lang="ts">
import { onMounted, ref } from "vue";

import { ApiClientError, type TripSummary } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useTripsStore } from "../stores/trips";

const auth = useAuthStore();
const tripsStore = useTripsStore();

const includeDeleted = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const saving = ref(false);

const form = ref({
  budgetAmount: "",
  destination: "",
  endDate: "",
  startDate: "",
  title: "",
});

onMounted(() => {
  if (auth.isAuthenticated) {
    void reload();
  }
});

async function reload() {
  await tripsStore.loadTrips({
    includeDeleted: includeDeleted.value || undefined,
  });
}

async function submit() {
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
    successMessage.value = "行程已创建";
    form.value = {
      budgetAmount: "",
      destination: "",
      endDate: "",
      startDate: "",
      title: "",
    };
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  } finally {
    saving.value = false;
  }
}

async function remove(item: TripSummary) {
  errorMessage.value = "";
  try {
    await tripsStore.deleteTrip(item.id);
    await reload();
  } catch (error) {
    errorMessage.value = messageOf(error);
  }
}

async function restore(item: TripSummary) {
  errorMessage.value = "";
  try {
    await tripsStore.restoreTrip(item.id);
    await reload();
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
</script>

<template>
  <section class="trip-page" aria-labelledby="trips-title">
    <header class="page-head">
      <div>
        <p class="eyebrow">行程</p>
        <h1 id="trips-title">我的行程</h1>
      </div>
      <label class="check-label">
        <input v-model="includeDeleted" type="checkbox" @change="reload" />
        显示已删除
      </label>
    </header>

    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="form-success" role="status">
      {{ successMessage }}
    </p>

    <form class="trip-create" @submit.prevent="submit">
      <label class="trip-field">
        标题
        <input v-model="form.title" maxlength="200" required />
      </label>
      <label class="trip-field">
        目的地
        <input v-model="form.destination" maxlength="200" required />
      </label>
      <label class="trip-field">
        开始日期
        <input v-model="form.startDate" required type="date" />
      </label>
      <label class="trip-field">
        结束日期
        <input v-model="form.endDate" required type="date" />
      </label>
      <label class="trip-field">
        预算（元，可选）
        <input
          v-model="form.budgetAmount"
          inputmode="decimal"
          placeholder="0.00"
          step="0.01"
          type="text"
        />
      </label>
      <button class="primary-button" :disabled="saving" type="submit">
        新建行程
      </button>
    </form>

    <p v-if="tripsStore.trips.length === 0" class="empty-copy">
      还没有行程，创建一个开始规划吧。
    </p>
    <ul v-else class="trip-list">
      <li
        v-for="item in tripsStore.trips"
        :key="item.id"
        :class="{ 'is-deleted': item.deletedAt !== null }"
      >
        <RouterLink :to="`/trips/${item.id}`" class="trip-row">
          <span class="trip-main">
            <strong>{{ item.title }}</strong>
            <small
              >{{ item.destination }} 路 {{ item.startDate }} –
              {{ item.endDate }}</small
            >
            <small v-if="item.budgetAmount"
              >预算 楼{{ item.budgetAmount }}</small
            >
          </span>
          <span v-if="item.deletedAt" class="revoked-mark">已删除</span>
        </RouterLink>
        <div class="row-actions">
          <RouterLink
            v-if="!item.deletedAt"
            class="text-button"
            :to="`/trips/${item.id}`"
          >
            查看
          </RouterLink>
          <button
            v-if="!item.deletedAt"
            class="text-button danger"
            type="button"
            @click="remove(item)"
          >
            删除
          </button>
          <button
            v-if="item.deletedAt"
            class="text-button"
            type="button"
            @click="restore(item)"
          >
            恢复
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
