<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";

import type { AiOperation, AiOperationType } from "../api/client";

const props = defineProps<{
  operation: AiOperation;
  proposalVersion: number;
  saving?: boolean;
  mutationLocked?: boolean;
}>();

const emit = defineEmits<{
  save: [operationId: string, fields: Record<string, unknown>];
  accept: [operationId: string];
  reject: [operationId: string];
}>();

const OPERATION_TYPE_LABELS: Record<AiOperationType, string> = {
  CALENDAR_EVENT: "日程",
  REMINDER: "提醒",
  TASK: "待办",
  TRANSACTION: "账单",
  TRIP: "行程",
};

const STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "已接受",
  APPLIED: "已写入",
  EXPIRED: "已过期",
  FAILED: "失败",
  PENDING: "待处理",
  REJECTED: "已拒绝",
};

const TRANSACTION_TYPES = ["EXPENSE", "INCOME", "REFUND"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const REMINDER_SCHEDULE_TYPES = ["ONCE", "DAILY", "WEEKLY", "MONTHLY"];
const REMINDER_TARGET_TYPES = ["CALENDAR_EVENT", "TASK", "STANDALONE"];
const FORMAL_WRITE_FORBIDDEN_FIELDS = new Set([
  "clientMutationId",
  "sourceFingerprint",
]);

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:[T\s](?:(?:[01]\d|2[0-3])(?::?[0-5]\d)?(?::?[0-5]\d(?:[.,]\d+)?)?|24:?00)(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?)?$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_PATTERN = /^\d+\.\d{2}$/;

interface FieldValidation {
  forbidden: string[];
  missing: string[];
  invalid: string[];
  semantic: string[];
}

const editable = computed(() => props.operation.status === "PENDING");

const editState = reactive<Record<string, string>>({});
const dirty = ref(false);

watch(
  () => props.operation,
  (operation) => {
    resetEditableState(operation);
    dirty.value = false;
  },
  { deep: true, immediate: true },
);

function editableFieldKeys(operationType: AiOperationType): string[] {
  switch (operationType) {
    case "TRANSACTION":
      return ["type", "amount", "currency", "occurredAt", "merchant", "note"];
    case "CALENDAR_EVENT":
      return ["title", "startsAt", "endsAt", "allDay"];
    case "TASK":
      return ["title", "priority", "dueAt"];
    case "REMINDER":
      return ["title", "note", "scheduleType", "startsAt", "targetType"];
    case "TRIP":
      return ["title", "destination", "startDate", "endDate", "budgetAmount"];
  }
}

function resetEditableState(operation: AiOperation) {
  for (const key of Object.keys(editState)) {
    delete editState[key];
  }
  if (!editable.value) {
    return;
  }
  const fields = operation.fields as Record<string, unknown>;
  for (const key of editableFieldKeys(operation.operationType)) {
    const value = fields[key];
    if (isDateTimeField(operation.operationType, key)) {
      editState[key] = isoToLocalInput(String(value ?? ""));
    } else if (value === null || value === undefined) {
      editState[key] = "";
    } else {
      editState[key] = String(value);
    }
  }
}

function isDateTimeField(operationType: AiOperationType, key: string): boolean {
  return (
    (operationType === "TRANSACTION" && key === "occurredAt") ||
    (operationType === "CALENDAR_EVENT" &&
      (key === "startsAt" || key === "endsAt")) ||
    (operationType === "TASK" && key === "dueAt") ||
    (operationType === "REMINDER" && key === "startsAt")
  );
}

function isDateOnlyField(operationType: AiOperationType, key: string): boolean {
  return (
    (operationType === "TRIP" && (key === "startDate" || key === "endDate")) ||
    false
  );
}

function knownFieldKeys(operationType: AiOperationType): string[] {
  switch (operationType) {
    case "TRANSACTION":
      return [
        "type",
        "amount",
        "currency",
        "categoryId",
        "accountId",
        "merchant",
        "occurredAt",
        "note",
        "source",
        "originalTransactionId",
        "isUnlinkedRefund",
        "tripId",
      ];
    case "CALENDAR_EVENT":
      return ["title", "startsAt", "endsAt", "allDay"];
    case "TASK":
      return ["title", "priority", "dueAt"];
    case "REMINDER":
      return [
        "title",
        "note",
        "targetType",
        "targetId",
        "scheduleType",
        "startsAt",
        "recurrence",
      ];
    case "TRIP":
      return ["title", "destination", "startDate", "endDate", "budgetAmount"];
  }
}

function requiredFieldKeys(operationType: AiOperationType): string[] {
  switch (operationType) {
    case "TRANSACTION":
      return ["type", "amount"];
    case "CALENDAR_EVENT":
      return ["title", "startsAt", "endsAt"];
    case "TASK":
      return ["title"];
    case "REMINDER":
      return ["title", "scheduleType", "startsAt"];
    case "TRIP":
      return ["title", "destination", "startDate", "endDate"];
  }
}

function isOptionalField(operationType: AiOperationType, key: string): boolean {
  return !requiredFieldKeys(operationType).includes(key);
}

function serverFieldValue(key: string): unknown {
  return (props.operation.fields as Record<string, unknown>)[key];
}

function validationValue(key: string): unknown {
  const operationType = props.operation.operationType;
  const editableKeys = editableFieldKeys(operationType);
  const original = serverFieldValue(key);
  if (!dirty.value) {
    return original === null || original === undefined ? undefined : original;
  }
  if (!editableKeys.includes(key)) {
    return original === null || original === undefined ? undefined : original;
  }

  const raw = editState[key];
  if (isDateTimeField(operationType, key)) {
    if (!raw) {
      return original === null || original === undefined || original === ""
        ? undefined
        : original;
    }
    const localDate = new Date(raw);
    return Number.isNaN(localDate.getTime()) ? raw : localDate.toISOString();
  }
  if (isDateOnlyField(operationType, key)) {
    if (!raw) {
      return original === null || original === undefined || original === ""
        ? undefined
        : original;
    }
    return raw;
  }
  if (key === "allDay") {
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
    return raw || original === undefined || original === null
      ? raw || undefined
      : raw;
  }
  if (raw === "" && (original === undefined || original === null)) {
    return undefined;
  }
  return raw;
}

function isMissing(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
  );
}

function isString(value: unknown, maxLength?: number): boolean {
  return (
    typeof value === "string" &&
    (maxLength === undefined || value.length <= maxLength)
  );
}

function isRequiredString(value: unknown, maxLength: number): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isEnum(value: unknown, values: string[]): boolean {
  return typeof value === "string" && values.includes(value);
}

function isStrictIsoDateTime(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_TIME_PATTERN.test(value)) {
    return false;
  }
  const datePart = value.slice(0, 10);
  return isValidDateOnly(datePart) && Number.isFinite(Date.parse(value));
}

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isPositiveMoney(value: unknown): boolean {
  if (typeof value !== "string" || !MONEY_PATTERN.test(value)) {
    return false;
  }
  const [integer, fraction] = value.split(".") as [string, string];
  return integer.replace(/^0+/, "").length > 0 || fraction !== "00";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isShanghaiMidnight(value: string): boolean {
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) &&
    (date.getTime() + 8 * 60 * 60 * 1000) % (24 * 60 * 60 * 1000) === 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidRecurrence(value: unknown, scheduleType: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  const allowed = new Set(["interval", "weekdays", "dayOfMonth", "until"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    return false;
  }
  const interval = value.interval;
  if (
    interval !== undefined &&
    (typeof interval !== "number" ||
      !Number.isInteger(interval) ||
      interval < 1 ||
      interval > 366)
  ) {
    return false;
  }
  if (value.weekdays !== undefined) {
    if (
      !Array.isArray(value.weekdays) ||
      value.weekdays.length > 7 ||
      new Set(value.weekdays).size !== value.weekdays.length ||
      value.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
    ) {
      return false;
    }
  }
  const dayOfMonth = value.dayOfMonth;
  if (
    dayOfMonth !== undefined &&
    (typeof dayOfMonth !== "number" ||
      !Number.isInteger(dayOfMonth) ||
      dayOfMonth < 1 ||
      dayOfMonth > 31)
  ) {
    return false;
  }
  if (
    value.until !== undefined &&
    value.until !== null &&
    !isStrictIsoDateTime(value.until)
  ) {
    return false;
  }
  if (scheduleType === "ONCE") {
    return false;
  }
  if (
    scheduleType === "DAILY" &&
    (value.weekdays !== undefined || value.dayOfMonth !== undefined)
  ) {
    return false;
  }
  if (scheduleType === "WEEKLY" && value.dayOfMonth !== undefined) {
    return false;
  }
  if (scheduleType === "MONTHLY" && value.weekdays !== undefined) {
    return false;
  }
  return true;
}

function isPastOneTimeOccurrence(value: unknown): boolean {
  if (!isStrictIsoDateTime(value)) {
    return false;
  }
  const startsAt = Date.parse(value);
  const authoritativeReference = Date.parse(props.operation.updatedAt);
  return (
    Number.isFinite(authoritativeReference) &&
    Number.isFinite(startsAt) &&
    startsAt <= authoritativeReference
  );
}

function validateOperationFields(
  operationType: AiOperationType,
  fields: Record<string, unknown>,
): FieldValidation {
  const forbidden: string[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];
  const semantic: string[] = [];
  const known = new Set(knownFieldKeys(operationType));
  for (const key of Object.keys(props.operation.fields)) {
    if (FORMAL_WRITE_FORBIDDEN_FIELDS.has(key)) {
      forbidden.push(key);
    } else if (!known.has(key)) {
      invalid.push(key);
    }
  }

  const required = (key: string, valid: (value: unknown) => boolean) => {
    const value = fields[key];
    if (isMissing(value)) {
      missing.push(key);
    } else if (!valid(value)) {
      invalid.push(key);
    }
  };
  const optional = (key: string, valid: (value: unknown) => boolean) => {
    const value = fields[key];
    if (value !== undefined && !valid(value)) {
      invalid.push(key);
    }
  };

  switch (operationType) {
    case "TRANSACTION": {
      required("type", (value) => isEnum(value, TRANSACTION_TYPES));
      required("amount", isPositiveMoney);
      optional(
        "currency",
        (value) => typeof value === "string" && /^[A-Z]{3}$/.test(value),
      );
      optional("categoryId", (value) => isString(value));
      optional("accountId", (value) => isString(value));
      optional("merchant", (value) => isString(value, 100));
      optional("occurredAt", isStrictIsoDateTime);
      optional("note", (value) => isString(value, 500));
      if (
        Object.prototype.hasOwnProperty.call(
          props.operation.fields,
          "source",
        ) &&
        fields.source !== "TEXT"
      ) {
        invalid.push("source");
      }
      optional("originalTransactionId", (value) => isString(value));
      optional("isUnlinkedRefund", isBoolean);
      optional("tripId", (value) => isString(value));
      const hasOriginalTransaction =
        typeof fields.originalTransactionId === "string" &&
        fields.originalTransactionId.length > 0;
      const isUnlinkedRefund = fields.isUnlinkedRefund === true;
      if (fields.type !== "REFUND") {
        if (hasOriginalTransaction) {
          semantic.push("originalTransactionId");
        }
        if (isUnlinkedRefund) {
          semantic.push("isUnlinkedRefund");
        }
      } else if (
        (hasOriginalTransaction && isUnlinkedRefund) ||
        (!hasOriginalTransaction && !isUnlinkedRefund)
      ) {
        semantic.push("refund");
      }
      break;
    }
    case "CALENDAR_EVENT":
      required("title", (value) => isRequiredString(value, 200));
      required("startsAt", isStrictIsoDateTime);
      required("endsAt", isStrictIsoDateTime);
      optional("allDay", isBoolean);
      if (
        isStrictIsoDateTime(fields.startsAt) &&
        isStrictIsoDateTime(fields.endsAt)
      ) {
        const startsAt = new Date(fields.startsAt as string);
        const endsAt = new Date(fields.endsAt as string);
        if (endsAt.getTime() < startsAt.getTime()) {
          invalid.push("endsAt");
        }
        if (fields.allDay === true) {
          if (
            !isShanghaiMidnight(fields.startsAt as string) ||
            !isShanghaiMidnight(fields.endsAt as string) ||
            endsAt.getTime() <= startsAt.getTime()
          ) {
            invalid.push("allDay");
          }
        }
      }
      break;
    case "TASK":
      required("title", (value) => isRequiredString(value, 200));
      optional("priority", (value) => isEnum(value, PRIORITIES));
      optional("dueAt", isStrictIsoDateTime);
      break;
    case "REMINDER": {
      required("title", (value) => isRequiredString(value, 200));
      required("scheduleType", (value) =>
        isEnum(value, REMINDER_SCHEDULE_TYPES),
      );
      required("startsAt", isStrictIsoDateTime);
      optional("note", (value) => isString(value, 500));
      optional("targetType", (value) => isEnum(value, REMINDER_TARGET_TYPES));
      optional("targetId", (value) => isString(value));
      optional("recurrence", (value) =>
        isValidRecurrence(value, fields.scheduleType),
      );
      const targetType = fields.targetType ?? "STANDALONE";
      const targetId = fields.targetId;
      if (
        targetType === "STANDALONE" &&
        typeof targetId === "string" &&
        targetId.length > 0
      ) {
        invalid.push("targetId");
      }
      if (
        (targetType === "CALENDAR_EVENT" || targetType === "TASK") &&
        (typeof targetId !== "string" || targetId.trim().length === 0)
      ) {
        invalid.push("targetId");
      }
      if (
        fields.scheduleType === "ONCE" &&
        isPastOneTimeOccurrence(fields.startsAt)
      ) {
        semantic.push("startsAt");
      }
      break;
    }
    case "TRIP":
      required("title", (value) => isRequiredString(value, 200));
      required("destination", (value) => isRequiredString(value, 200));
      required("startDate", isValidDateOnly);
      required("endDate", isValidDateOnly);
      optional("budgetAmount", isPositiveMoney);
      if (
        isValidDateOnly(fields.startDate) &&
        isValidDateOnly(fields.endDate) &&
        (fields.endDate as string) < (fields.startDate as string)
      ) {
        invalid.push("endDate");
      }
      break;
  }
  return { forbidden, missing, invalid, semantic };
}

function markDirty() {
  if (editable.value && !props.mutationLocked) {
    dirty.value = true;
  }
}

const fieldValidation = computed(() => {
  if (!editable.value) {
    return {
      forbidden: [],
      missing: [],
      invalid: [],
      semantic: [],
    } satisfies FieldValidation;
  }
  const fields: Record<string, unknown> = {};
  for (const key of knownFieldKeys(props.operation.operationType)) {
    fields[key] = validationValue(key);
  }
  return validateOperationFields(props.operation.operationType, fields);
});

const hasMissingFields = computed(
  () => fieldValidation.value.missing.length > 0,
);
const hasForbiddenFields = computed(
  () => fieldValidation.value.forbidden.length > 0,
);
const hasInvalidFields = computed(
  () =>
    fieldValidation.value.invalid.length > 0 ||
    fieldValidation.value.forbidden.length > 0 ||
    fieldValidation.value.semantic.length > 0,
);
const hasSemanticInvalidFields = computed(
  () => fieldValidation.value.semantic.length > 0,
);

const canAccept = computed(
  () =>
    editable.value &&
    !dirty.value &&
    !hasMissingFields.value &&
    !hasInvalidFields.value &&
    !props.saving &&
    !props.mutationLocked,
);
const canReject = computed(
  () =>
    (props.operation.status === "PENDING" ||
      props.operation.status === "ACCEPTED") &&
    !props.saving &&
    !props.mutationLocked,
);

function buildFields(): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const serverFields = props.operation.fields as Record<string, unknown>;
  // Preserve server fields that are not editable and not server-owned.
  for (const [key, value] of Object.entries(serverFields)) {
    if (
      key !== "clientMutationId" &&
      key !== "sourceFingerprint" &&
      !editableFieldKeys(props.operation.operationType).includes(key)
    ) {
      fields[key] = value;
    }
  }
  for (const key of editableFieldKeys(props.operation.operationType)) {
    const raw = editState[key] ?? "";
    if (isOptionalField(props.operation.operationType, key) && raw === "") {
      continue;
    }
    if (key === "allDay") {
      fields[key] = raw === "true";
    } else if (isDateTimeField(props.operation.operationType, key)) {
      fields[key] = raw ? localInputToIso(raw) : null;
    } else {
      fields[key] = raw;
    }
  }
  return fields;
}

function save() {
  if (!dirty.value || props.mutationLocked) {
    return;
  }
  emit("save", props.operation.id, buildFields());
}

function accept() {
  if (!canAccept.value) {
    return;
  }
  emit("accept", props.operation.id);
}

function updateBooleanField(key: string, event: Event) {
  if (props.mutationLocked) {
    return;
  }
  editState[key] = String((event.target as HTMLInputElement).checked);
  markDirty();
}

function isoToLocalInput(iso: string): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(local: string): string {
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? local : date.toISOString();
}

function booleanFieldValue(key: string): boolean {
  return editState[key] === "true";
}

function inputModeFor(key: string): "decimal" | "text" {
  return key === "amount" || key === "budgetAmount" ? "decimal" : "text";
}
</script>

<template>
  <article
    class="draft-card operation-card"
    :class="{ 'is-settled': !editable }"
  >
    <header class="draft-card-head">
      <div class="draft-title">
        <strong>{{ OPERATION_TYPE_LABELS[operation.operationType] }}</strong>
        <span
          class="status-badge"
          :class="`status-${operation.status.toLowerCase()}`"
        >
          {{ STATUS_LABELS[operation.status] ?? operation.status }}
        </span>
      </div>
      <small class="draft-time">置信度 {{ operation.confidence }}</small>
    </header>

    <p
      v-if="operation.clarification"
      class="confidence-hint clarification-hint"
      role="note"
    >
      需要补充的信息：{{ operation.clarification }}
    </p>
    <p v-if="hasMissingFields" class="confidence-hint" role="note">
      请核对并补充必填字段后再接受。
    </p>
    <p v-else-if="hasForbiddenFields" class="confidence-hint" role="alert">
      存在正式写入禁止字段，请移除后再接受。
    </p>
    <p
      v-else-if="hasSemanticInvalidFields"
      class="confidence-hint"
      role="alert"
    >
      字段组合不符合正式写入规则，请修正后再接受。
    </p>
    <p v-else-if="hasInvalidFields" class="confidence-hint" role="alert">
      存在无效字段，请修正后再接受。
    </p>
    <p v-else-if="dirty" class="confidence-hint" role="note">
      已修改字段，请先保存后再接受。
    </p>

    <div v-if="editable" class="draft-form">
      <label
        v-for="key in editableFieldKeys(operation.operationType)"
        :key="key"
        class="draft-field"
      >
        {{ key }}
        <select
          v-if="key === 'type'"
          v-model="editState[key]"
          :disabled="mutationLocked || saving"
          @change="markDirty"
        >
          <option value="EXPENSE">支出</option>
          <option value="INCOME">收入</option>
          <option value="REFUND">退款</option>
        </select>
        <select
          v-else-if="key === 'priority'"
          v-model="editState[key]"
          :disabled="mutationLocked || saving"
          @change="markDirty"
        >
          <option value="LOW">低</option>
          <option value="MEDIUM">中</option>
          <option value="HIGH">高</option>
        </select>
        <select
          v-else-if="key === 'scheduleType'"
          v-model="editState[key]"
          :disabled="mutationLocked || saving"
          @change="markDirty"
        >
          <option value="ONCE">单次</option>
          <option value="DAILY">每天</option>
          <option value="WEEKLY">每周</option>
          <option value="MONTHLY">每月</option>
        </select>
        <select
          v-else-if="key === 'targetType'"
          v-model="editState[key]"
          :disabled="mutationLocked || saving"
          @change="markDirty"
        >
          <option value="STANDALONE">独立提醒</option>
          <option value="CALENDAR_EVENT">关联日程</option>
          <option value="TASK">关联待办</option>
        </select>
        <input
          v-else-if="key === 'allDay'"
          :checked="booleanFieldValue(key)"
          :disabled="mutationLocked || saving"
          type="checkbox"
          @change="updateBooleanField(key, $event)"
        />
        <input
          v-else-if="isDateTimeField(operation.operationType, key)"
          v-model="editState[key]"
          :disabled="mutationLocked || saving"
          type="datetime-local"
          @change="markDirty"
        />
        <input
          v-else-if="isDateOnlyField(operation.operationType, key)"
          v-model="editState[key]"
          :disabled="mutationLocked || saving"
          type="date"
          @change="markDirty"
        />
        <textarea
          v-else-if="key === 'note'"
          v-model="editState[key]"
          :disabled="mutationLocked || saving"
          maxlength="500"
          rows="2"
          @input="markDirty"
        ></textarea>
        <input
          v-else
          v-model="editState[key]"
          :inputmode="inputModeFor(key)"
          :disabled="mutationLocked || saving"
          type="text"
          @input="markDirty"
        />
      </label>

      <div class="draft-actions">
        <button
          class="secondary-button"
          :disabled="!dirty || saving || mutationLocked"
          type="button"
          @click="save"
        >
          保存修改
        </button>
        <button
          class="primary-button"
          :disabled="!canAccept"
          type="button"
          @click="accept"
        >
          接受此项
        </button>
        <button
          class="danger-button"
          :disabled="!canReject"
          type="button"
          @click="emit('reject', operation.id)"
        >
          拒绝此项
        </button>
      </div>
    </div>

    <dl v-else class="draft-readonly">
      <div v-for="(value, key) in operation.fields" :key="key">
        <dt>{{ key }}</dt>
        <dd>
          {{
            value === null || value === undefined || value === "" ? "—" : value
          }}
        </dd>
      </div>
      <div v-if="operation.status === 'APPLIED'">
        <dt>写入结果</dt>
        <dd>
          {{ operation.resultEntityType || "已写入" }}
          <span v-if="operation.resultEntityId" class="result-id">{{
            operation.resultEntityId
          }}</span>
        </dd>
      </div>
    </dl>
    <div
      v-if="
        !editable &&
        (operation.status === 'PENDING' || operation.status === 'ACCEPTED')
      "
      class="draft-actions readonly-actions"
    >
      <button
        class="danger-button"
        :disabled="!canReject"
        type="button"
        @click="emit('reject', operation.id)"
      >
        拒绝此项
      </button>
    </div>
  </article>
</template>
