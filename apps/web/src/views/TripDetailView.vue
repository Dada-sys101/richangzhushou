<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import {
  ApiClientError,
  type PackingItemSummary,
  type TripDetailResponse,
  type TripItemSummary,
  type TripItemType,
} from "../api/client";
import DateField from "../components/DateField.vue";
import DateTimeField from "../components/DateTimeField.vue";
import ErrorState from "../components/ErrorState.vue";
import LoadingState from "../components/LoadingState.vue";
import SecondaryPageShell from "../components/SecondaryPageShell.vue";
import {
  requestAppConfirm,
  resolveAppConfirm,
} from "../composables/useAppConfirm";
import { useUnsavedChanges } from "../composables/useUnsavedChanges";
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
const loading = ref(false);
const loadedDetailId = ref("");
const loadFailure = ref<{ message: string; status: number | null } | null>(
  null,
);
let loadGeneration = 0;
const detail = computed<TripDetailResponse | null>(() => {
  const current = tripsStore.detail;
  return !loading.value &&
    loadedDetailId.value === tripId.value &&
    current?.trip.id === tripId.value
    ? current
    : null;
});
const loadErrorTitle = computed(() =>
  loadFailure.value?.status === 404
    ? "找不到这段行程"
    : loadFailure.value?.status === 0
      ? "当前离线，无法加载行程"
      : loadFailure.value?.status !== null &&
          loadFailure.value?.status !== undefined &&
          loadFailure.value.status >= 500
        ? "行程暂时无法加载"
        : "行程加载失败",
);
const loadErrorDescription = computed(() =>
  loadFailure.value?.status === 404
    ? "行程可能已删除，或链接已失效。你可以返回行程列表，或重试加载。"
    : loadFailure.value?.status === 0
      ? "本地没有可用的行程详情。联网后可以重试。"
      : loadFailure.value?.status === 503
        ? "服务暂时不可用，请稍后重试。"
        : (loadFailure.value?.message ?? "请检查网络连接后重试。"),
);

const errorMessage = ref("");
const successMessage = ref("");
const saving = ref(false);
const tripMutation = ref<"save" | "delete" | "restore" | null>(null);
let tripMutationGeneration = 0;

const editingTrip = ref(false);
const tripForm = ref({
  budgetAmount: "",
  destination: "",
  endDate: "",
  startDate: "",
  title: "",
  version: 1,
});
const tripEditSnapshot = ref("");

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
const itemEditSnapshot = ref("");
const itemErrorMessage = ref("");
const itemSuccessMessage = ref("");
const locallyDeletedItems = ref<TripItemSummary[]>([]);
const nodeItems = computed(() => {
  const currentItems = detail.value?.items ?? [];
  const currentIds = new Set(currentItems.map((item) => item.id));
  const deletedSnapshots = locallyDeletedItems.value.filter(
    (item) => item.tripId === tripId.value && !currentIds.has(item.id),
  );
  return [...currentItems, ...deletedSnapshots];
});

type ItemMutationKind =
  "create" | "update" | "delete" | "restore" | "confirm-range";
interface ItemMutationContext {
  generation: number;
  itemId?: string;
  kind: ItemMutationKind;
  sequence: number;
  tripId: string;
}
const itemMutation = ref<ItemMutationContext | null>(null);
const itemControlsDisabled = computed(
  () =>
    itemMutation.value !== null || tripMutation.value !== null || saving.value,
);
let itemMutationGeneration = 0;
let itemMutationSequence = 0;

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
const packingEditSnapshot = ref("");
const packingErrorMessage = ref("");
const packingSuccessMessage = ref("");
const locallyDeletedPackingItems = ref<PackingItemSummary[]>([]);

type PackingMutationKind = "create" | "update" | "check" | "delete" | "restore";
interface PackingMutationContext {
  generation: number;
  itemId?: string;
  kind: PackingMutationKind;
  sequence: number;
  tripId: string;
}
const packingMutation = ref<PackingMutationContext | null>(null);
let packingMutationGeneration = 0;
let packingMutationSequence = 0;
const packingControlsDisabled = computed(
  () =>
    packingMutation.value !== null ||
    itemMutation.value !== null ||
    tripMutation.value !== null ||
    saving.value,
);
const packingItems = computed(() => {
  const snapshots = locallyDeletedPackingItems.value.filter(
    (item) => item.tripId === tripId.value,
  );
  const snapshotIds = new Set(snapshots.map((item) => item.id));
  return [
    ...(detail.value?.packingItems ?? []).filter(
      (item) => !snapshotIds.has(item.id),
    ),
    ...snapshots,
  ].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id),
  );
});
const activePackingItemCount = computed(
  () => packingItems.value.filter((item) => !isPackingDeleted(item)).length,
);
useUnsavedChanges(
  computed(
    () =>
      (editingTrip.value && tripFormSnapshot() !== tripEditSnapshot.value) ||
      (Boolean(editingItemId.value) &&
        itemEditFormSnapshot() !== itemEditSnapshot.value) ||
      (Boolean(editingPackingId.value) &&
        packingEditText.value !== packingEditSnapshot.value) ||
      Boolean(itemForm.value.startsAt) ||
      Boolean(itemForm.value.endsAt) ||
      Boolean(itemForm.value.location) ||
      Boolean(packingText.value) ||
      Boolean(packingEditText.value),
  ),
);

watch(
  tripId,
  () => {
    if (packingMutation.value?.kind === "delete") {
      resolveAppConfirm(false);
    }
    tripMutationGeneration += 1;
    tripMutation.value = null;
    editingTrip.value = false;
    tripEditSnapshot.value = "";
    if (itemMutation.value?.kind === "confirm-range") {
      saving.value = false;
    }
    itemMutationGeneration += 1;
    itemMutation.value = null;
    itemErrorMessage.value = "";
    itemSuccessMessage.value = "";
    locallyDeletedItems.value = [];
    pendingOutOfRange.value = null;
    editingItemId.value = "";
    itemEditSnapshot.value = "";
    itemForm.value = emptyItemForm();
    itemEditForm.value = emptyItemEditForm();
    packingMutationGeneration += 1;
    packingMutation.value = null;
    locallyDeletedPackingItems.value = [];
    packingText.value = "";
    editingPackingId.value = "";
    packingEditText.value = "";
    packingEditSnapshot.value = "";
    packingErrorMessage.value = "";
    packingSuccessMessage.value = "";
    void load();
  },
  { immediate: true },
);

watch(
  () => tripsStore.detail?.trip.id,
  (loadedId) => {
    if (
      !loading.value &&
      loadedDetailId.value === tripId.value &&
      loadedId !== tripId.value
    ) {
      void load();
    }
  },
  { flush: "sync" },
);

async function load(recoveryAttempt = 0): Promise<boolean> {
  const requestedId = tripId.value;
  const generation = ++loadGeneration;
  loadedDetailId.value = "";
  loadFailure.value = null;
  errorMessage.value = "";
  successMessage.value = "";
  loading.value = Boolean(requestedId && auth.isAuthenticated);
  if (!requestedId || !auth.isAuthenticated) {
    loading.value = false;
    return false;
  }

  try {
    await tripsStore.loadTrip(requestedId);
    if (generation !== loadGeneration || requestedId !== tripId.value) {
      return false;
    }
    if (tripsStore.detail?.trip.id !== requestedId) {
      if (recoveryAttempt === 0) {
        return await load(1);
      } else {
        loadFailure.value = {
          message: "行程详情已变化，请重试加载。",
          status: null,
        };
      }
      return false;
    }
    loadedDetailId.value = requestedId;
    return true;
  } catch (error) {
    if (generation === loadGeneration && requestedId === tripId.value) {
      loadFailure.value = {
        message: messageOf(error),
        status: error instanceof ApiClientError ? error.status : null,
      };
    }
    return false;
  } finally {
    if (generation === loadGeneration) {
      loading.value = false;
    }
  }
}

function startEditTrip() {
  const trip = detail.value?.trip;
  if (!trip || trip.deletedAt || tripMutation.value || saving.value) {
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
  tripEditSnapshot.value = tripFormSnapshot();
}

async function saveEditTrip() {
  const currentDetail = detail.value;
  const requestedId = tripId.value;
  const generation = tripMutationGeneration;
  if (
    !currentDetail ||
    currentDetail.trip.id !== requestedId ||
    currentDetail.trip.deletedAt ||
    !editingTrip.value ||
    tripMutation.value ||
    saving.value
  ) {
    return;
  }
  tripMutation.value = "save";
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await tripsStore.updateTrip(requestedId, {
      budgetAmount: tripForm.value.budgetAmount.trim() || null,
      destination: tripForm.value.destination,
      endDate: tripForm.value.endDate,
      startDate: tripForm.value.startDate,
      title: tripForm.value.title,
      version: tripForm.value.version,
    });
    if (isCurrentTripMutation(requestedId, generation)) {
      successMessage.value = "行程已更新";
      cancelTripEdit(true);
    }
  } catch (error) {
    if (isCurrentTripMutation(requestedId, generation)) {
      errorMessage.value = messageOf(error);
    }
  } finally {
    if (generation === tripMutationGeneration) {
      tripMutation.value = null;
    }
  }
}

function cancelTripEdit(afterSuccessfulSave = false) {
  if (tripMutation.value === "save" && !afterSuccessfulSave) {
    return;
  }
  editingTrip.value = false;
  tripEditSnapshot.value = "";
}

async function removeTrip() {
  const currentDetail = detail.value;
  const requestedId = tripId.value;
  const generation = tripMutationGeneration;
  if (
    !currentDetail ||
    currentDetail.trip.id !== requestedId ||
    currentDetail.trip.deletedAt ||
    editingTrip.value ||
    tripMutation.value ||
    saving.value
  ) {
    return;
  }
  tripMutation.value = "delete";
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const confirmed = await requestAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "删除行程",
      description: `删除“${currentDetail.trip.title}”后，行程会保留在已删除列表中，并可在此恢复。`,
      destructive: true,
      title: "确认删除这段行程？",
    });
    if (!confirmed || !isCurrentTripMutation(requestedId, generation)) {
      return;
    }
    await tripsStore.deleteTrip(requestedId);
    if (!isCurrentTripMutation(requestedId, generation)) {
      return;
    }
    const refreshed = await load();
    if (!isCurrentTripMutation(requestedId, generation)) {
      return;
    }
    if (refreshed && detail.value?.trip.deletedAt) {
      successMessage.value = "行程已删除，可随时恢复";
    } else if (refreshed) {
      errorMessage.value = "行程已删除，但详情状态尚未更新，请重试加载。";
    }
  } catch (error) {
    if (isCurrentTripMutation(requestedId, generation)) {
      errorMessage.value = messageOf(error);
    }
  } finally {
    if (generation === tripMutationGeneration) {
      tripMutation.value = null;
    }
  }
}

async function restoreTrip() {
  const currentDetail = detail.value;
  const requestedId = tripId.value;
  const generation = tripMutationGeneration;
  if (
    !currentDetail ||
    currentDetail.trip.id !== requestedId ||
    !currentDetail.trip.deletedAt ||
    tripMutation.value ||
    saving.value
  ) {
    return;
  }
  tripMutation.value = "restore";
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await tripsStore.restoreTrip(requestedId);
    if (!isCurrentTripMutation(requestedId, generation)) {
      return;
    }
    const refreshed = await load();
    if (!isCurrentTripMutation(requestedId, generation)) {
      return;
    }
    if (refreshed && !detail.value?.trip.deletedAt) {
      successMessage.value = "行程已恢复";
    } else if (refreshed) {
      errorMessage.value = "行程恢复后状态尚未更新，请重试加载。";
    }
  } catch (error) {
    if (isCurrentTripMutation(requestedId, generation)) {
      errorMessage.value = messageOf(error);
    }
  } finally {
    if (generation === tripMutationGeneration) {
      tripMutation.value = null;
    }
  }
}

function isCurrentTripMutation(requestedId: string, generation: number) {
  return (
    generation === tripMutationGeneration &&
    requestedId === tripId.value &&
    detail.value?.trip.id === requestedId
  );
}

async function submitItem() {
  const context = beginItemMutation("create");
  if (!context) return;
  pendingOutOfRange.value = null;
  let payload: ItemCreatePayload | null = null;
  try {
    payload = itemCreatePayload(itemForm.value);
    const result = await tripsStore.createTripItem(context.tripId, payload);
    if (!isCurrentItemMutation(context)) return;
    pendingOutOfRange.value = null;
    showItemResult(result);
    itemForm.value = emptyItemForm();
  } catch (error) {
    if (isCurrentItemMutation(context)) {
      if (payload) handleItemError(error, "create", payload);
      else itemErrorMessage.value = messageOf(error);
    }
  } finally {
    finishItemMutation(context);
  }
}

function startEditItem(item: TripItemSummary) {
  const currentDetail = detail.value;
  if (
    !currentDetail ||
    currentDetail.trip.id !== tripId.value ||
    item.tripId !== tripId.value ||
    isNodeDeleted(item) ||
    itemMutation.value ||
    tripMutation.value ||
    saving.value ||
    !currentDetail.items.some((current) => current.id === item.id)
  ) {
    return;
  }
  itemErrorMessage.value = "";
  itemSuccessMessage.value = "";
  pendingOutOfRange.value = null;
  editingItemId.value = item.id;
  itemEditForm.value = {
    endsAt: toLocalDateTimeInput(item.endsAt),
    location: item.location ?? "",
    startsAt: toLocalDateTimeInput(item.startsAt),
    type: item.type,
    version: item.version,
  };
  itemEditSnapshot.value = itemEditFormSnapshot();
}

async function saveEditItem(item: TripItemSummary) {
  const context = beginItemMutation("update", item.id);
  if (
    !context ||
    editingItemId.value !== item.id ||
    item.tripId !== context.tripId ||
    item.deletedAt ||
    !detail.value?.items.some((current) => current.id === item.id)
  ) {
    if (context) finishItemMutation(context);
    return;
  }
  pendingOutOfRange.value = null;
  let payload: ItemUpdatePayload | null = null;
  try {
    payload = itemUpdatePayload(itemEditForm.value);
    const result = await tripsStore.updateTripItem(
      item.id,
      context.tripId,
      payload,
    );
    if (!isCurrentItemMutation(context)) return;
    pendingOutOfRange.value = null;
    showItemResult(result);
    cancelItemEdit(true);
  } catch (error) {
    if (isCurrentItemMutation(context)) {
      if (payload) handleItemError(error, "update", payload, item.id);
      else itemErrorMessage.value = messageOf(error);
    }
  } finally {
    finishItemMutation(context);
  }
}

async function confirmOutOfRange() {
  const pending = pendingOutOfRange.value;
  if (!pending) return;
  const context = beginItemMutation(
    "confirm-range",
    pending.mode === "update" ? pending.itemId : undefined,
  );
  if (!context) return;
  itemErrorMessage.value = "";
  saving.value = true;
  try {
    if (pending.mode === "create") {
      const result = await tripsStore.createTripItem(context.tripId, {
        ...pending.payload,
        confirmOutOfRange: true,
      });
      if (!isCurrentItemMutation(context)) return;
      pendingOutOfRange.value = null;
      showItemResult(result);
      itemForm.value = emptyItemForm();
    } else if (pending.itemId) {
      const result = await tripsStore.updateTripItem(
        pending.itemId,
        context.tripId,
        {
          ...pending.payload,
          confirmOutOfRange: true,
        },
      );
      if (!isCurrentItemMutation(context)) return;
      pendingOutOfRange.value = null;
      showItemResult(result);
      cancelItemEdit(true);
    }
  } catch (error) {
    if (isCurrentItemMutation(context)) {
      itemErrorMessage.value = messageOf(error);
    }
  } finally {
    if (context.generation === itemMutationGeneration) {
      saving.value = false;
    }
    finishItemMutation(context);
  }
}

function showItemResult(result: { outOfRangeWarning?: { message: string } }) {
  itemErrorMessage.value = "";
  itemSuccessMessage.value = result.outOfRangeWarning
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
    itemErrorMessage.value = "";
    return;
  }
  itemErrorMessage.value = messageOf(error);
}

function cancelItemEdit(afterSuccessfulSave = false) {
  if (itemMutation.value && !afterSuccessfulSave) return;
  editingItemId.value = "";
  itemEditSnapshot.value = "";
  pendingOutOfRange.value = null;
}

async function removeItem(item: TripItemSummary) {
  const context = beginItemMutation("delete", item.id);
  if (
    !context ||
    item.tripId !== context.tripId ||
    isNodeDeleted(item) ||
    !detail.value?.items.some((current) => current.id === item.id)
  ) {
    if (context) finishItemMutation(context);
    return;
  }
  try {
    const confirmed = await requestAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "删除节点",
      description: `删除“${itemTypeLabel(item.type)}${item.location ? ` · ${item.location}` : ""}”后仅能在当前页面内恢复；刷新或离开页面后，详情页将无法再显示该节点。`,
      destructive: true,
      title: "确认删除这个行程节点？",
    });
    if (!confirmed || !isCurrentItemMutation(context)) return;
    await tripsStore.deleteTripItem(item.id, context.tripId);
    if (isCurrentItemMutation(context)) {
      locallyDeletedItems.value = [
        ...locallyDeletedItems.value.filter(
          (snapshot) => snapshot.id !== item.id,
        ),
        item,
      ];
      itemSuccessMessage.value =
        "节点已删除；如需恢复，请在离开或刷新页面前操作。";
    }
  } catch (error) {
    if (isCurrentItemMutation(context)) {
      itemErrorMessage.value = messageOf(error);
    }
  } finally {
    finishItemMutation(context);
  }
}

async function restoreItem(item: TripItemSummary) {
  const context = beginItemMutation("restore", item.id);
  if (
    !context ||
    item.tripId !== context.tripId ||
    !isNodeDeleted(item) ||
    !nodeItems.value.some(
      (current) => current.id === item.id && isNodeDeleted(current),
    )
  ) {
    if (context) finishItemMutation(context);
    return;
  }
  try {
    await tripsStore.restoreTripItem(item.id, context.tripId);
    if (isCurrentItemMutation(context)) {
      locallyDeletedItems.value = locallyDeletedItems.value.filter(
        (snapshot) => snapshot.id !== item.id,
      );
      itemSuccessMessage.value = "节点已恢复";
    }
  } catch (error) {
    if (isCurrentItemMutation(context)) {
      itemErrorMessage.value = messageOf(error);
    }
  } finally {
    finishItemMutation(context);
  }
}

function beginItemMutation(
  kind: ItemMutationKind,
  itemId?: string,
): ItemMutationContext | null {
  const requestedId = tripId.value;
  if (
    !requestedId ||
    detail.value?.trip.id !== requestedId ||
    itemMutation.value ||
    packingMutation.value ||
    tripMutation.value ||
    saving.value
  ) {
    return null;
  }
  const context = {
    generation: itemMutationGeneration,
    itemId,
    kind,
    sequence: ++itemMutationSequence,
    tripId: requestedId,
  };
  itemMutation.value = context;
  itemErrorMessage.value = "";
  itemSuccessMessage.value = "";
  return context;
}

function isCurrentItemMutation(context: ItemMutationContext): boolean {
  return (
    context.generation === itemMutationGeneration &&
    context.tripId === tripId.value &&
    detail.value?.trip.id === context.tripId &&
    itemMutation.value?.sequence === context.sequence
  );
}

function finishItemMutation(context: ItemMutationContext) {
  if (
    context.generation === itemMutationGeneration &&
    itemMutation.value?.sequence === context.sequence
  ) {
    itemMutation.value = null;
  }
}

function isNodeDeleted(item: TripItemSummary): boolean {
  if (item.deletedAt !== null) return true;
  const serverStillShowsItem = detail.value?.items.some(
    (current) => current.id === item.id,
  );
  return (
    !serverStillShowsItem &&
    locallyDeletedItems.value.some((snapshot) => snapshot.id === item.id)
  );
}

function itemCreatePayload(value: typeof itemForm.value): ItemCreatePayload {
  return {
    endsAt: toShanghaiIso(value.endsAt),
    location: value.location.trim() || null,
    startsAt: toShanghaiIso(value.startsAt),
    type: value.type,
  };
}

function itemUpdatePayload(
  value: typeof itemEditForm.value,
): ItemUpdatePayload {
  return {
    ...itemCreatePayload(value),
    version: value.version,
  };
}

function emptyItemForm() {
  return {
    endsAt: "",
    location: "",
    startsAt: "",
    type: "ACTIVITY" as TripItemType,
  };
}

function emptyItemEditForm() {
  return {
    endsAt: "",
    location: "",
    startsAt: "",
    type: "ACTIVITY" as TripItemType,
    version: 1,
  };
}

function cancelPendingOutOfRange() {
  if (itemMutation.value) return;
  pendingOutOfRange.value = null;
  itemErrorMessage.value = "";
}

async function submitPacking() {
  const context = beginPackingMutation("create");
  if (!context) return;
  try {
    await tripsStore.createPackingItem(context.tripId, {
      text: packingText.value.trim(),
    });
    if (!isCurrentPackingMutation(context)) return;
    packingText.value = "";
    packingSuccessMessage.value = "行李项已添加";
  } catch (error) {
    if (isCurrentPackingMutation(context)) {
      packingErrorMessage.value = messageOf(error);
    }
  } finally {
    finishPackingMutation(context);
  }
}

function startEditPacking(item: PackingItemSummary) {
  if (
    packingControlsDisabled.value ||
    item.tripId !== tripId.value ||
    isPackingDeleted(item) ||
    !detail.value?.packingItems.some((current) => current.id === item.id)
  ) {
    return;
  }
  packingErrorMessage.value = "";
  packingSuccessMessage.value = "";
  editingPackingId.value = item.id;
  packingEditText.value = item.text;
  packingEditSnapshot.value = item.text;
}

async function saveEditPacking(item: PackingItemSummary) {
  const context = beginPackingMutation("update", item.id);
  if (
    !context ||
    editingPackingId.value !== item.id ||
    item.tripId !== context.tripId ||
    isPackingDeleted(item) ||
    !detail.value?.packingItems.some((current) => current.id === item.id)
  ) {
    if (context) finishPackingMutation(context);
    return;
  }
  try {
    await tripsStore.updatePackingItem(item.id, context.tripId, {
      text: packingEditText.value.trim(),
      version: item.version,
    });
    if (!isCurrentPackingMutation(context)) return;
    clearPackingEdit();
    packingSuccessMessage.value = "行李项已更新";
  } catch (error) {
    if (isCurrentPackingMutation(context)) {
      packingErrorMessage.value = messageOf(error);
    }
  } finally {
    finishPackingMutation(context);
  }
}

function cancelPackingEdit() {
  if (packingMutation.value) return;
  clearPackingEdit();
}

function clearPackingEdit() {
  editingPackingId.value = "";
  packingEditText.value = "";
  packingEditSnapshot.value = "";
}

function tripFormSnapshot(): string {
  return JSON.stringify({
    budgetAmount: tripForm.value.budgetAmount,
    destination: tripForm.value.destination,
    endDate: tripForm.value.endDate,
    startDate: tripForm.value.startDate,
    title: tripForm.value.title,
  });
}

function itemEditFormSnapshot(): string {
  return JSON.stringify({
    endsAt: itemEditForm.value.endsAt,
    location: itemEditForm.value.location,
    startsAt: itemEditForm.value.startsAt,
    type: itemEditForm.value.type,
  });
}

async function togglePacking(item: PackingItemSummary, event: Event) {
  const checkbox = event.currentTarget;
  if (checkbox instanceof HTMLInputElement) {
    checkbox.checked = item.checked;
  }
  const context = beginPackingMutation("check", item.id);
  if (
    !context ||
    item.tripId !== context.tripId ||
    isPackingDeleted(item) ||
    !detail.value?.packingItems.some((current) => current.id === item.id)
  ) {
    if (context) finishPackingMutation(context);
    return;
  }
  try {
    await tripsStore.updatePackingItem(item.id, context.tripId, {
      checked: !item.checked,
      version: item.version,
    });
    if (isCurrentPackingMutation(context)) {
      packingSuccessMessage.value = !item.checked
        ? "已标记为已收纳"
        : "已取消收纳标记";
    }
  } catch (error) {
    if (isCurrentPackingMutation(context)) {
      packingErrorMessage.value = messageOf(error);
    }
  } finally {
    finishPackingMutation(context);
  }
}

async function removePacking(item: PackingItemSummary) {
  const context = beginPackingMutation("delete", item.id);
  if (
    !context ||
    item.tripId !== context.tripId ||
    isPackingDeleted(item) ||
    !detail.value?.packingItems.some((current) => current.id === item.id)
  ) {
    if (context) finishPackingMutation(context);
    return;
  }
  try {
    const confirmed = await requestAppConfirm({
      cancelLabel: "取消",
      confirmLabel: "删除行李项",
      description: `删除“${item.text}”后仅能在当前页面内恢复。行程详情接口不会返回已删除行李项；刷新或离开后，无法从详情页重新找到它。`,
      destructive: true,
      title: "确认删除这个行李项？",
    });
    if (!confirmed || !isCurrentPackingMutation(context)) return;
    await tripsStore.deletePackingItem(item.id, context.tripId);
    if (isCurrentPackingMutation(context)) {
      locallyDeletedPackingItems.value = [
        ...locallyDeletedPackingItems.value.filter(
          (snapshot) => snapshot.id !== item.id,
        ),
        item,
      ];
      packingSuccessMessage.value =
        "行李项已删除；仅当前页面可恢复，刷新或离开后无法从详情页重新找回。";
    }
  } catch (error) {
    if (isCurrentPackingMutation(context)) {
      packingErrorMessage.value = messageOf(error);
    }
  } finally {
    finishPackingMutation(context);
  }
}

async function restorePacking(item: PackingItemSummary) {
  const context = beginPackingMutation("restore", item.id);
  if (
    !context ||
    item.tripId !== context.tripId ||
    !isPackingDeleted(item) ||
    !packingItems.value.some(
      (current) => current.id === item.id && isPackingDeleted(current),
    )
  ) {
    if (context) finishPackingMutation(context);
    return;
  }
  try {
    await tripsStore.restorePackingItem(item.id, context.tripId);
    if (isCurrentPackingMutation(context)) {
      locallyDeletedPackingItems.value =
        locallyDeletedPackingItems.value.filter(
          (snapshot) => snapshot.id !== item.id,
        );
      packingSuccessMessage.value = "行李项已恢复";
    }
  } catch (error) {
    if (isCurrentPackingMutation(context)) {
      packingErrorMessage.value = messageOf(error);
    }
  } finally {
    finishPackingMutation(context);
  }
}

function beginPackingMutation(
  kind: PackingMutationKind,
  itemId?: string,
): PackingMutationContext | null {
  const requestedId = tripId.value;
  if (
    !requestedId ||
    detail.value?.trip.id !== requestedId ||
    packingMutation.value ||
    itemMutation.value ||
    tripMutation.value ||
    saving.value
  ) {
    return null;
  }
  const context = {
    generation: packingMutationGeneration,
    itemId,
    kind,
    sequence: ++packingMutationSequence,
    tripId: requestedId,
  };
  packingMutation.value = context;
  packingErrorMessage.value = "";
  packingSuccessMessage.value = "";
  return context;
}

function isCurrentPackingMutation(context: PackingMutationContext): boolean {
  return (
    context.generation === packingMutationGeneration &&
    context.tripId === tripId.value &&
    detail.value?.trip.id === context.tripId &&
    packingMutation.value?.sequence === context.sequence
  );
}

function finishPackingMutation(context: PackingMutationContext) {
  if (
    context.generation === packingMutationGeneration &&
    packingMutation.value?.sequence === context.sequence
  ) {
    packingMutation.value = null;
  }
}

function isPackingDeleted(item: PackingItemSummary): boolean {
  return (
    item.deletedAt !== null ||
    locallyDeletedPackingItems.value.some(
      (snapshot) => snapshot.id === item.id && snapshot.tripId === tripId.value,
    )
  );
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
  <SecondaryPageShell
    class="trip-page trip-detail-workspace"
    :title="detail?.trip.title ?? '行程详情'"
    title-id="trip-detail-title"
    :subtitle="
      detail
        ? `${detail.trip.destination} · ${detail.trip.startDate} – ${detail.trip.endDate}`
        : '行程'
    "
  >
    <template #actions>
      <div v-if="detail" class="trip-head-actions">
        <button
          v-if="!editingTrip && !detail.trip.deletedAt"
          class="secondary-button"
          :disabled="tripMutation !== null || saving"
          type="button"
          @click="startEditTrip"
        >
          编辑行程
        </button>
        <button
          v-if="!editingTrip && !detail.trip.deletedAt"
          class="danger-button"
          :disabled="tripMutation !== null || saving"
          type="button"
          @click="removeTrip"
        >
          删除
        </button>
        <button
          v-if="detail.trip.deletedAt"
          class="secondary-button"
          :disabled="tripMutation !== null || saving"
          type="button"
          @click="restoreTrip"
        >
          {{ tripMutation === "restore" ? "恢复中…" : "恢复" }}
        </button>
      </div>
    </template>

    <p
      v-if="errorMessage"
      class="planner-feedback planner-feedback-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <p
      v-if="successMessage"
      class="planner-feedback planner-feedback-success"
      role="status"
    >
      {{ successMessage }}
    </p>

    <LoadingState
      v-if="loading"
      title="正在加载行程"
      description="正在获取这段行程的最新详情。"
    />
    <ErrorState
      v-else-if="loadFailure"
      :title="loadErrorTitle"
      :description="loadErrorDescription"
      action-label="重试"
      @retry="load"
    />
    <template v-else-if="detail">
      <p
        v-if="detail.trip.deletedAt"
        class="trip-detail-deleted-state"
        role="status"
      >
        这段行程已删除，正式数据保留且可以恢复。
      </p>
      <section class="trip-card" aria-labelledby="trip-expense-title">
        <h2 id="trip-expense-title" class="trip-detail-summary-title">
          费用汇总
        </h2>
        <div class="today-stat">
          <span class="stat-label">实际支出</span>
          <strong class="stat-value"
            >¥{{ detail.expense.actualExpense }}</strong
          >
        </div>
        <div class="today-stat">
          <span class="stat-label">预算</span>
          <strong class="stat-value">
            {{
              detail.expense.budgetAmount
                ? `¥${detail.expense.budgetAmount}`
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
          <DateField
            v-model="tripForm.startDate"
            :max="tripForm.endDate || undefined"
            required
          />
        </label>
        <label class="trip-field">
          结束日期
          <DateField
            v-model="tripForm.endDate"
            :min="tripForm.startDate || undefined"
            required
          />
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
          <button
            class="primary-button"
            :disabled="saving || tripMutation !== null"
            type="submit"
          >
            {{ tripMutation === "save" ? "保存中…" : "保存" }}
          </button>
          <button
            class="secondary-button"
            :disabled="tripMutation !== null"
            type="button"
            @click="cancelTripEdit()"
          >
            取消
          </button>
        </div>
      </form>

      <section
        class="trip-section trip-node-section"
        aria-labelledby="trip-items-title"
        :aria-busy="itemMutation !== null"
      >
        <h2 id="trip-items-title">行程节点</h2>
        <p
          v-if="itemErrorMessage"
          class="planner-feedback planner-feedback-error trip-node-feedback"
          role="alert"
        >
          {{ itemErrorMessage }}
        </p>
        <p
          v-if="itemSuccessMessage"
          class="planner-feedback planner-feedback-success trip-node-feedback"
          role="status"
        >
          {{ itemSuccessMessage }}
        </p>
        <div v-if="pendingOutOfRange" class="warning-banner" role="alert">
          <p>节点时间超出行程日期范围，仍要保存吗？</p>
          <div class="trip-actions">
            <button
              class="primary-button"
              :disabled="itemControlsDisabled"
              type="button"
              @click="confirmOutOfRange"
            >
              {{
                itemMutation?.kind === "confirm-range" ? "保存中…" : "仍要保存"
              }}
            </button>
            <button
              class="secondary-button"
              :disabled="itemControlsDisabled"
              type="button"
              @click="cancelPendingOutOfRange"
            >
              取消
            </button>
          </div>
        </div>

        <div
          class="trip-node-subsection"
          aria-labelledby="trip-node-create-title"
        >
          <div class="trip-node-subsection-heading">
            <h3 id="trip-node-create-title">新增节点</h3>
            <p>填写类型、起止时间和地点，时间按上海时区保存。</p>
          </div>
          <form
            class="trip-create trip-node-form"
            aria-labelledby="trip-node-create-title"
            @submit.prevent="submitItem"
          >
            <label class="trip-field">
              类型
              <select v-model="itemForm.type" :disabled="itemControlsDisabled">
                <option value="TRANSPORT">交通</option>
                <option value="STAY">住宿</option>
                <option value="ACTIVITY">活动</option>
                <option value="FOOD">餐饮</option>
                <option value="OTHER">其他</option>
              </select>
            </label>
            <label class="trip-field">
              开始时间
              <DateTimeField
                v-model="itemForm.startsAt"
                :disabled="itemControlsDisabled"
                required
              />
            </label>
            <label class="trip-field">
              结束时间
              <DateTimeField
                v-model="itemForm.endsAt"
                :disabled="itemControlsDisabled"
                :min="itemForm.startsAt"
                required
              />
            </label>
            <label class="trip-field">
              地点（可选）
              <input
                v-model="itemForm.location"
                :disabled="itemControlsDisabled"
                maxlength="200"
                type="text"
              />
            </label>
            <button
              class="primary-button"
              :disabled="itemControlsDisabled"
              type="submit"
            >
              {{ itemMutation?.kind === "create" ? "添加中…" : "添加节点" }}
            </button>
          </form>
        </div>

        <div
          class="trip-node-subsection"
          aria-labelledby="trip-node-list-title"
        >
          <div class="trip-node-subsection-heading">
            <h3 id="trip-node-list-title">已有节点</h3>
            <p>{{ nodeItems.length }} 项，按行程记录展示</p>
          </div>
          <p v-if="nodeItems.length === 0" class="empty-copy">
            还没有行程节点。
          </p>
        </div>
        <ul v-if="nodeItems.length > 0" class="trip-node-list">
          <li
            v-for="item in nodeItems"
            :key="item.id"
            class="trip-node-card"
            :data-node-id="item.id"
            :class="{ 'is-deleted': isNodeDeleted(item) }"
          >
            <template v-if="editingItemId === item.id">
              <form
                class="trip-create trip-node-form"
                :aria-label="`编辑行程节点：${itemTypeLabel(item.type)}`"
                @submit.prevent="saveEditItem(item)"
              >
                <label class="trip-field">
                  类型
                  <select
                    v-model="itemEditForm.type"
                    :disabled="itemControlsDisabled"
                  >
                    <option value="TRANSPORT">交通</option>
                    <option value="STAY">住宿</option>
                    <option value="ACTIVITY">活动</option>
                    <option value="FOOD">餐饮</option>
                    <option value="OTHER">其他</option>
                  </select>
                </label>
                <label class="trip-field">
                  开始时间
                  <DateTimeField
                    v-model="itemEditForm.startsAt"
                    :disabled="itemControlsDisabled"
                    required
                  />
                </label>
                <label class="trip-field">
                  结束时间
                  <DateTimeField
                    v-model="itemEditForm.endsAt"
                    :disabled="itemControlsDisabled"
                    :min="itemEditForm.startsAt"
                    required
                  />
                </label>
                <label class="trip-field">
                  地点
                  <input
                    v-model="itemEditForm.location"
                    :disabled="itemControlsDisabled"
                    maxlength="200"
                    type="text"
                  />
                </label>
                <div class="trip-actions">
                  <button
                    class="primary-button"
                    :disabled="itemControlsDisabled"
                    type="submit"
                  >
                    {{
                      itemMutation?.kind === "update" ||
                      itemMutation?.kind === "confirm-range"
                        ? "保存中…"
                        : "保存"
                    }}
                  </button>
                  <button
                    class="secondary-button"
                    :disabled="itemControlsDisabled"
                    type="button"
                    @click="cancelItemEdit()"
                  >
                    取消
                  </button>
                </div>
              </form>
            </template>
            <template v-else>
              <div class="trip-node-content">
                <div class="trip-node-heading">
                  <span class="trip-node-type">{{
                    itemTypeLabel(item.type)
                  }}</span>
                  <span
                    v-if="isNodeDeleted(item)"
                    class="revoked-mark"
                    role="status"
                  >
                    已删除
                  </span>
                </div>
                <dl class="trip-node-details">
                  <div>
                    <dt>开始时间</dt>
                    <dd>
                      <time :datetime="item.startsAt">{{
                        formatDateTime(item.startsAt)
                      }}</time>
                    </dd>
                  </div>
                  <div>
                    <dt>结束时间</dt>
                    <dd>
                      <time :datetime="item.endsAt">{{
                        formatDateTime(item.endsAt)
                      }}</time>
                    </dd>
                  </div>
                  <div class="trip-node-location">
                    <dt>地点</dt>
                    <dd>{{ item.location || "未填写" }}</dd>
                  </div>
                </dl>
              </div>
              <div class="row-actions trip-node-actions">
                <button
                  v-if="!isNodeDeleted(item)"
                  class="text-button"
                  :disabled="itemControlsDisabled"
                  type="button"
                  @click="startEditItem(item)"
                >
                  编辑节点
                </button>
                <button
                  v-if="!isNodeDeleted(item)"
                  class="text-button danger"
                  :disabled="itemControlsDisabled"
                  type="button"
                  @click="removeItem(item)"
                >
                  {{
                    itemMutation?.kind === "delete" &&
                    itemMutation.itemId === item.id
                      ? "删除中…"
                      : "删除节点"
                  }}
                </button>
                <button
                  v-if="isNodeDeleted(item)"
                  class="text-button"
                  :disabled="itemControlsDisabled"
                  type="button"
                  @click="restoreItem(item)"
                >
                  {{
                    itemMutation?.kind === "restore" &&
                    itemMutation.itemId === item.id
                      ? "恢复中…"
                      : "恢复节点"
                  }}
                </button>
              </div>
            </template>
          </li>
        </ul>
      </section>

      <section
        class="trip-section trip-packing-section"
        aria-labelledby="packing-title"
        :aria-busy="packingMutation !== null"
      >
        <h2 id="packing-title">行李清单</h2>
        <p
          v-if="packingErrorMessage"
          class="planner-feedback planner-feedback-error trip-packing-feedback"
          role="alert"
        >
          {{ packingErrorMessage }}
        </p>
        <p
          v-if="packingSuccessMessage"
          class="planner-feedback planner-feedback-success trip-packing-feedback"
          role="status"
        >
          {{ packingSuccessMessage }}
        </p>

        <div class="trip-packing-subsection">
          <div class="trip-packing-subsection-heading">
            <h3 id="trip-packing-create-title">新增行李项</h3>
            <p>勾选后会明确标记为已收纳。</p>
          </div>
          <form
            class="trip-create trip-packing-form"
            aria-labelledby="trip-packing-create-title"
            @submit.prevent="submitPacking"
          >
            <label class="trip-field">
              物品名称或备注
              <input
                v-model="packingText"
                :disabled="packingControlsDisabled"
                maxlength="200"
                required
                type="text"
              />
            </label>
            <button
              class="primary-button"
              :disabled="packingControlsDisabled"
              type="submit"
            >
              {{
                packingMutation?.kind === "create" ? "添加中…" : "添加行李项"
              }}
            </button>
          </form>
        </div>

        <div class="trip-packing-subsection">
          <div class="trip-packing-subsection-heading">
            <h3 id="trip-packing-list-title">清单项目</h3>
            <p>{{ activePackingItemCount }} 件有效行李项</p>
          </div>
          <p v-if="activePackingItemCount === 0" class="empty-copy">
            {{
              packingItems.length > 0
                ? "当前清单没有有效项目；已删除项目仅可在本页恢复。"
                : "清单还是空的，添加第一件需要带上的物品。"
            }}
          </p>
          <p
            v-if="locallyDeletedPackingItems.length > 0"
            class="trip-packing-recovery-note"
          >
            删除项仅在本次页面打开期间保留以便恢复；详情接口不会返回已删除行李项，刷新或离开后无法从行程详情重新找回。
          </p>
        </div>

        <ul v-if="packingItems.length > 0" class="trip-packing-list">
          <li
            v-for="item in packingItems"
            :key="item.id"
            class="trip-packing-card"
            :data-packing-id="item.id"
            :class="{
              'is-checked': item.checked && !isPackingDeleted(item),
              'is-deleted': isPackingDeleted(item),
            }"
          >
            <template v-if="editingPackingId === item.id">
              <form
                class="trip-create trip-packing-form trip-packing-edit-form"
                :aria-label="`编辑行李项：${item.text}`"
                @submit.prevent="saveEditPacking(item)"
              >
                <label class="trip-field">
                  物品名称或备注
                  <input
                    v-model="packingEditText"
                    :disabled="packingControlsDisabled"
                    maxlength="200"
                    required
                    type="text"
                  />
                </label>
                <div class="trip-actions">
                  <button
                    class="primary-button"
                    :disabled="packingControlsDisabled"
                    type="submit"
                  >
                    {{
                      packingMutation?.kind === "update" &&
                      packingMutation.itemId === item.id
                        ? "保存中…"
                        : "保存"
                    }}
                  </button>
                  <button
                    class="secondary-button"
                    :disabled="packingControlsDisabled"
                    type="button"
                    @click="cancelPackingEdit"
                  >
                    取消
                  </button>
                </div>
              </form>
            </template>
            <template v-else>
              <div class="trip-packing-item-main">
                <label
                  v-if="!isPackingDeleted(item)"
                  class="trip-packing-toggle"
                >
                  <input
                    :aria-label="`${item.checked ? '取消已收纳标记' : '标记为已收纳'}：${item.text}`"
                    :checked="item.checked"
                    :disabled="
                      packingControlsDisabled || isPackingDeleted(item)
                    "
                    type="checkbox"
                    @change="togglePacking(item, $event)"
                  />
                  <span aria-hidden="true"></span>
                </label>
                <span
                  v-else
                  class="trip-packing-toggle-placeholder"
                  aria-hidden="true"
                ></span>
                <p
                  class="trip-packing-text"
                  :class="{
                    'packing-done': item.checked && !isPackingDeleted(item),
                  }"
                >
                  {{ item.text }}
                </p>
                <span
                  class="trip-packing-state"
                  :class="{
                    'is-checked': item.checked && !isPackingDeleted(item),
                    'is-deleted': isPackingDeleted(item),
                  }"
                >
                  {{
                    isPackingDeleted(item)
                      ? "已删除 · 本页可恢复"
                      : item.checked
                        ? "已收纳"
                        : "待整理"
                  }}
                </span>
              </div>
              <div class="row-actions trip-packing-actions">
                <button
                  v-if="!isPackingDeleted(item)"
                  class="text-button"
                  :disabled="packingControlsDisabled"
                  type="button"
                  @click="startEditPacking(item)"
                >
                  编辑行李项
                </button>
                <button
                  v-if="!isPackingDeleted(item)"
                  class="text-button danger"
                  :disabled="packingControlsDisabled"
                  type="button"
                  @click="removePacking(item)"
                >
                  {{
                    packingMutation?.kind === "delete" &&
                    packingMutation.itemId === item.id
                      ? "删除中…"
                      : "删除行李项"
                  }}
                </button>
                <button
                  v-if="isPackingDeleted(item)"
                  class="text-button"
                  :disabled="packingControlsDisabled"
                  type="button"
                  @click="restorePacking(item)"
                >
                  {{
                    packingMutation?.kind === "restore" &&
                    packingMutation.itemId === item.id
                      ? "恢复中…"
                      : "恢复行李项"
                  }}
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

    <ErrorState
      v-else
      title="无法打开行程详情"
      description="请返回行程列表，重新打开一段有效的行程。"
    />
  </SecondaryPageShell>
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
  return `${sign}¥${item.amount}`;
}

function amountClass(type: string): string {
  return type === "EXPENSE" ? "amount-expense" : "amount-income";
}
</script>
