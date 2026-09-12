<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppDialog from "./AppDialog.vue";

type Mode = "date" | "datetime" | "month";
const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    max?: string;
    min?: string;
    mode: Mode;
    modelValue: string;
    required?: boolean;
  }>(),
  { disabled: false, max: "", min: "", required: false },
);
const emit = defineEmits<{
  change: [];
  "update:modelValue": [value: string];
}>();
const open = ref(false);
const draft = ref("");
const visibleMonth = ref("");
const hour = ref("00");
const minute = ref("00");
const titleId = computed(() => `temporal-picker-${props.mode}-title`);
const title = computed(
  () =>
    ({ date: "选择日期", datetime: "选择日期和时间", month: "选择月份" })[
      props.mode
    ],
);

const today = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
};
const currentMonth = computed(() => visibleMonth.value || today().slice(0, 7));
const year = computed(() => Number(currentMonth.value.slice(0, 4)));
const month = computed(() => Number(currentMonth.value.slice(5, 7)));
const days = computed(() => {
  const first = new Date(Date.UTC(year.value, month.value - 1, 1));
  const total = new Date(Date.UTC(year.value, month.value, 0)).getUTCDate();
  const leading = first.getUTCDay();
  return [
    ...Array.from({ length: leading }, () => ""),
    ...Array.from(
      { length: total },
      (_, index) =>
        `${currentMonth.value}-${String(index + 1).padStart(2, "0")}`,
    ),
  ];
});
const displayValue = computed(() => {
  if (!props.modelValue) return "请选择";
  if (props.mode === "month") {
    const [y, m] = props.modelValue.split("-");
    return `${y}年${Number(m)}月`;
  }
  const [date = "", time] = props.modelValue.split("T");
  const [y, m, d] = date.split("-");
  return props.mode === "datetime"
    ? `${y}年${Number(m)}月${Number(d)}日 ${time || "00:00"}`
    : `${y}年${Number(m)}月${Number(d)}日`;
});
const candidateValue = computed(() => {
  if (!draft.value || props.mode !== "datetime") return draft.value;
  return `${draft.value.split("T")[0]}T${normalizePart(hour.value, 23)}:${normalizePart(minute.value, 59)}`;
});
const candidateValid = computed(
  () =>
    (!props.required || Boolean(candidateValue.value)) &&
    (!candidateValue.value || bounded(candidateValue.value)),
);

watch(
  () => props.modelValue,
  (value) => {
    if (!open.value) draft.value = value;
  },
);

function show() {
  draft.value = props.modelValue;
  const datePart = props.modelValue.split("T")[0] || today();
  visibleMonth.value = datePart.slice(0, 7);
  const time = props.modelValue.split("T")[1] || "00:00";
  const [nextHour = "00", nextMinute = "00"] = time.split(":");
  hour.value = nextHour;
  minute.value = nextMinute;
  open.value = true;
}
function shiftMonth(offset: number) {
  const next = new Date(Date.UTC(year.value, month.value - 1 + offset, 1));
  visibleMonth.value = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}
function selectDate(value: string) {
  draft.value = value;
}
function selectMonth(value: number) {
  draft.value = `${year.value}-${String(value).padStart(2, "0")}`;
}
function bounded(value: string) {
  return (
    (!props.min || value >= props.min) && (!props.max || value <= props.max)
  );
}
function boundedDay(value: string) {
  return (
    (!props.min || value >= props.min.slice(0, 10)) &&
    (!props.max || value <= props.max.slice(0, 10))
  );
}
function confirm() {
  const value = candidateValue.value;
  if (!candidateValid.value) return;
  emit("update:modelValue", value);
  emit("change");
  open.value = false;
}
function normalizePart(value: string, max: number) {
  return String(Math.min(max, Math.max(0, Number(value) || 0))).padStart(
    2,
    "0",
  );
}
</script>

<template>
  <button
    type="button"
    class="temporal-field"
    :class="{ 'is-empty': !modelValue }"
    :disabled="disabled"
    @click="show"
  >
    <span>{{ displayValue }}</span
    ><span aria-hidden="true">▾</span>
  </button>
  <AppDialog :labelledby="titleId" :open="open" @close="open = false">
    <div class="temporal-picker">
      <h2 :id="titleId">{{ title }}</h2>
      <template v-if="mode === 'month'">
        <div class="temporal-picker-heading">
          <button
            type="button"
            aria-label="上一年"
            @click="
              visibleMonth = `${year - 1}-${String(month).padStart(2, '0')}`
            "
          >
            ‹</button
          ><strong>{{ year }}年</strong
          ><button
            type="button"
            aria-label="下一年"
            @click="
              visibleMonth = `${year + 1}-${String(month).padStart(2, '0')}`
            "
          >
            ›
          </button>
        </div>
        <div class="month-grid">
          <button
            v-for="item in 12"
            :key="item"
            type="button"
            :class="{
              selected: draft === `${year}-${String(item).padStart(2, '0')}`,
            }"
            @click="selectMonth(item)"
          >
            {{ item }}月
          </button>
        </div>
      </template>
      <template v-else>
        <div class="temporal-picker-heading">
          <button type="button" aria-label="上个月" @click="shiftMonth(-1)">
            ‹</button
          ><strong>{{ year }}年{{ month }}月</strong
          ><button type="button" aria-label="下个月" @click="shiftMonth(1)">
            ›
          </button>
        </div>
        <div class="calendar-grid calendar-weekdays">
          <span
            v-for="label in ['日', '一', '二', '三', '四', '五', '六']"
            :key="label"
            >{{ label }}</span
          >
        </div>
        <div class="calendar-grid">
          <span v-for="(day, index) in days" :key="`${day}-${index}`"
            ><button
              v-if="day"
              type="button"
              :disabled="!boundedDay(day)"
              :class="{
                selected: draft.split('T')[0] === day,
                today: day === today(),
              }"
              @click="selectDate(day)"
            >
              {{ Number(day.slice(-2)) }}
            </button></span
          >
        </div>
        <div v-if="mode === 'datetime'" class="time-entry">
          <label
            >小时<input
              v-model="hour"
              inputmode="numeric"
              maxlength="2"
              type="text" /></label
          ><span>:</span
          ><label
            >分钟<input
              v-model="minute"
              inputmode="numeric"
              maxlength="2"
              type="text"
          /></label>
        </div>
      </template>
      <div class="temporal-picker-shortcuts">
        <button
          type="button"
          class="secondary"
          @click="draft = mode === 'month' ? today().slice(0, 7) : today()"
        >
          今天</button
        ><button
          v-if="!required"
          type="button"
          class="secondary"
          @click="draft = ''"
        >
          清除
        </button>
      </div>
      <div class="app-dialog-actions">
        <button type="button" class="secondary" @click="open = false">
          取消</button
        ><button
          type="button"
          class="primary"
          :disabled="!candidateValid"
          @click="confirm"
        >
          确定
        </button>
      </div>
    </div>
  </AppDialog>
</template>
