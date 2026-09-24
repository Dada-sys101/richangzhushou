// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  api,
  OfflineNetworkError,
  type TripDetailResponse,
} from "../api/client";
import * as AppConfirm from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";
import { useTripsStore } from "../stores/trips";
import TripDetailView from "./TripDetailView.vue";

const unsavedMock = vi.hoisted(() => vi.fn());
vi.mock("../composables/useUnsavedChanges", () => ({
  useUnsavedChanges: unsavedMock,
}));

const Host = { template: "<RouterView />" };
const Placeholder = { template: "<div />" };
const DateTimeFieldStub = defineComponent({
  name: "DateTimeFieldStub",
  props: {
    disabled: Boolean,
    modelValue: { default: "", type: String },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit }) {
    return () =>
      h("input", {
        class: "date-time-field-stub",
        disabled: props.disabled,
        value: props.modelValue,
        onInput: (event: Event) =>
          emit("update:modelValue", (event.target as HTMLInputElement).value),
      });
  },
});

function tripDetail(id: string, title = `行程 ${id}`): TripDetailResponse {
  const timestamp = "2026-10-01T02:00:00.000Z";
  return {
    calendarEvents: [
      {
        allDay: false,
        createdAt: timestamp,
        deletedAt: null,
        endsAt: "2026-10-01T03:00:00.000Z",
        id: `event-${id}`,
        startsAt: timestamp,
        status: "SCHEDULED",
        title: `日历事项 ${id}`,
        updatedAt: timestamp,
        version: 1,
      },
    ],
    expense: {
      actualExpense: "123456789012.30",
      budgetAmount: "987654321098.76",
      budgetProgress: "0.12",
    },
    items: [
      {
        createdAt: timestamp,
        deletedAt: null,
        endsAt: "2026-10-01T03:00:00.000Z",
        id: `item-${id}`,
        location: `杭州湖滨步行街附近的详细地点 ${id}`,
        position: 0,
        startsAt: timestamp,
        tripId: id,
        type: "ACTIVITY",
        updatedAt: timestamp,
        version: 1,
      },
    ],
    linkedTransactions: [
      {
        accountId: null,
        amount: "88.10",
        categoryId: null,
        createdAt: timestamp,
        currency: "CNY",
        deletedAt: null,
        id: `transaction-${id}`,
        isUnlinkedRefund: false,
        merchant: `账单 ${id}`,
        note: null,
        occurredAt: timestamp,
        originalTransactionId: null,
        source: "MANUAL",
        sourceFingerprint: null,
        status: "CONFIRMED",
        tripId: id,
        type: "EXPENSE",
        updatedAt: timestamp,
        version: 1,
      },
    ],
    packingItems: [
      {
        checked: false,
        createdAt: timestamp,
        deletedAt: null,
        id: `packing-${id}`,
        position: 0,
        text: `需要正常换行的长行李说明 ${id}`,
        tripId: id,
        updatedAt: timestamp,
        version: 1,
      },
    ],
    trip: {
      budgetAmount: "987654321098.76",
      createdAt: timestamp,
      deletedAt: null,
      destination: `杭州目的地 ${id}`,
      endDate: "2026-10-03",
      id,
      startDate: "2026-10-01",
      title,
      updatedAt: timestamp,
      version: 1,
    },
  };
}

function setTripDeleted(
  detail: TripDetailResponse,
  deletedAt = "2026-10-02T02:00:00.000Z",
) {
  detail.trip.deletedAt = deletedAt;
  return detail;
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/trips",
        component: Placeholder,
        meta: { page: { title: "行程" } },
      },
      {
        path: "/trips/:id",
        component: TripDetailView,
        meta: {
          page: {
            title: "行程详情",
            parent: { path: "/trips", title: "行程" },
          },
        },
      },
      { path: "/calendar", component: Placeholder },
      { path: "/transactions/:id/edit", component: Placeholder },
    ],
  });
}

async function mountTrip(
  path: string,
  initialDetail?: TripDetailResponse,
  configureStore?: (store: ReturnType<typeof useTripsStore>) => void,
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.$patch({ accessToken: "test-token", user: { id: "user-1" } as never });
  const store = useTripsStore();
  store.detail = initialDetail ?? null;
  configureStore?.(store);
  const router = makeRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(Host, {
    global: {
      plugins: [pinia, router],
      stubs: {
        DateField: { template: '<input class="date-field-stub" />' },
        DateTimeField: DateTimeFieldStub,
      },
    },
  });
  return { router, store, wrapper };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("TripDetailView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders trip details in the requested read-only information order", async () => {
    const loaded = tripDetail("trip-1", "杭州秋日行程");
    vi.spyOn(api, "getTrip").mockResolvedValue(loaded);
    const { wrapper } = await mountTrip("/trips/trip-1");
    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("杭州秋日行程");
    expect(wrapper.get(".page-header-subtitle").text()).toContain(
      "杭州目的地 trip-1",
    );
    expect(wrapper.text()).toContain("¥123456789012.30");
    expect(wrapper.text()).toContain("¥987654321098.76");
    expect(wrapper.text()).toContain("日历事项 trip-1");
    expect(wrapper.text()).toContain("账单 trip-1");
    expect(
      wrapper.findAll(".secondary-page-content h2").map((node) => node.text()),
    ).toEqual(["费用汇总", "行程节点", "行李清单", "行程内日历", "关联账单"]);
    expect(wrapper.text()).toContain("10/01 10:00");
    expect(wrapper.get("#trip-node-create-title").text()).toBe("新增节点");
    expect(wrapper.get("#trip-node-list-title").text()).toBe("已有节点");
    expect(wrapper.get(".trip-node-type").text()).toBe("活动");
    expect(wrapper.get(".trip-node-details").text()).toContain("开始时间");
    expect(wrapper.get(".trip-node-details").text()).toContain("结束时间");
    expect(wrapper.get(".trip-node-details").text()).toContain(
      "杭州湖滨步行街附近的详细地点 trip-1",
    );
    expect(
      wrapper.find('form[aria-labelledby="trip-node-create-title"]').exists(),
    ).toBe(true);
    expect(wrapper.find("button").exists()).toBe(true);
    expect(wrapper.text()).toContain("编辑行程");
    expect(
      wrapper
        .get(".trip-node-form select")
        .findAll("option")
        .map((option) => option.element.value),
    ).toEqual(["TRANSPORT", "STAY", "ACTIVITY", "FOOD", "OTHER"]);
  });

  it("shows a separate empty message for every empty detail section", async () => {
    const empty = tripDetail("trip-empty");
    empty.items = [];
    empty.packingItems = [];
    empty.calendarEvents = [];
    empty.linkedTransactions = [];
    vi.spyOn(api, "getTrip").mockResolvedValue(empty);
    const { wrapper } = await mountTrip("/trips/trip-empty");
    await flushPromises();

    expect(wrapper.text()).toContain("还没有行程节点。");
    expect(wrapper.text()).toContain("清单还是空的");
    expect(wrapper.text()).toContain("行程日期范围内没有日程。");
    expect(wrapper.text()).toContain(
      "还没有关联账单，记账时选择该行程即可关联。",
    );
  });

  it("keeps a matching locally cached detail when the store resolves offline", async () => {
    const cached = tripDetail("trip-offline", "离线缓存行程");
    const deletedAt = "2026-10-02T02:00:00.000Z";
    cached.items[0]!.deletedAt = deletedAt;
    cached.packingItems[0]!.deletedAt = deletedAt;
    const getTrip = vi
      .spyOn(api, "getTrip")
      .mockRejectedValue(new OfflineNetworkError("GET", "/trips/trip-offline"));
    const { store, wrapper } = await mountTrip(
      "/trips/trip-offline",
      undefined,
      (currentStore) => {
        vi.spyOn(currentStore, "localTripDetail").mockResolvedValue(cached);
      },
    );
    await flushPromises();

    expect(store.localTripDetail).toHaveBeenCalledWith(
      "user-1",
      "trip-offline",
    );
    expect(getTrip).toHaveBeenCalledWith("trip-offline", {
      includeDeletedChildren: true,
    });
    expect(wrapper.get("h1").text()).toBe("离线缓存行程");
    expect(wrapper.text()).toContain("¥123456789012.30");
    expect(wrapper.get('[data-node-id="item-trip-offline"]').text()).toContain(
      "已删除",
    );
    expect(
      wrapper.get('[data-packing-id="packing-trip-offline"]').text(),
    ).toContain("已删除 · 可恢复");
    expect(
      wrapper
        .find('[data-packing-id="packing-trip-offline"] input[type="checkbox"]')
        .exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain("无法加载");
  });

  it("shows loading and hides a previous route's detail and actions", async () => {
    const pending = deferred<TripDetailResponse>();
    vi.spyOn(api, "getTrip").mockReturnValue(pending.promise);
    const previous = tripDetail("trip-previous", "上一段行程");
    const { wrapper } = await mountTrip("/trips/trip-current", previous);

    expect(wrapper.get('[role="status"]').text()).toContain("正在加载行程");
    expect(wrapper.text()).not.toContain("上一段行程");
    expect(wrapper.find(".trip-head-actions").exists()).toBe(false);

    pending.resolve(tripDetail("trip-current", "当前行程"));
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("当前行程");
    expect(wrapper.text()).not.toContain("上一段行程");
    expect(wrapper.text()).toContain("编辑行程");
  });

  it("distinguishes 404 from service failure and retries without showing stale content", async () => {
    const previous = tripDetail("trip-old", "不应继续显示的行程");
    const request = vi
      .spyOn(api, "getTrip")
      .mockRejectedValueOnce(new ApiClientError(404, "NOT_FOUND", "not found"))
      .mockRejectedValueOnce(
        new ApiClientError(503, "UNAVAILABLE", "unavailable"),
      )
      .mockResolvedValueOnce(tripDetail("trip-old"));
    const { wrapper } = await mountTrip("/trips/trip-old", previous);
    await flushPromises();

    expect(wrapper.get("h2").text()).toBe("找不到这段行程");
    expect(wrapper.text()).not.toContain("不应继续显示的行程");
    expect(wrapper.text()).not.toContain("还没有行程节点");

    await wrapper.get(".feedback-state-action").trigger("click");
    await flushPromises();
    expect(wrapper.get("h2").text()).toBe("行程暂时无法加载");
    expect(wrapper.text()).not.toContain("不应继续显示的行程");

    await wrapper.get(".feedback-state-action").trigger("click");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("行程 trip-old");
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("does not render an older response after the route changes", async () => {
    const latePrevious = deferred<TripDetailResponse>();
    const getTrip = vi.spyOn(api, "getTrip").mockImplementation((id) => {
      if (id === "trip-a") return Promise.resolve(tripDetail(id, "行程 A"));
      if (id === "trip-b") return latePrevious.promise;
      return Promise.resolve(tripDetail(id, `当前 ${id}`));
    });
    const { router, wrapper } = await mountTrip("/trips/trip-a");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("行程 A");

    await router.push("/trips/trip-b");
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain("正在加载行程");
    expect(wrapper.text()).not.toContain("行程 A");
    expect(wrapper.find(".trip-head-actions").exists()).toBe(false);

    await router.push("/trips/trip-c");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("当前 trip-c");

    latePrevious.resolve(tripDetail("trip-b", "迟到的行程 B"));
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("当前 trip-c");
    expect(wrapper.text()).not.toContain("迟到的行程 B");
    expect(wrapper.text()).not.toContain("行程 A");
    expect(getTrip.mock.calls.map(([id]) => id)).toEqual([
      "trip-a",
      "trip-b",
      "trip-c",
      "trip-c",
    ]);
  });

  it("asks before deleting and sends no request when deletion is cancelled", async () => {
    const detail = tripDetail("trip-delete-cancel", "待取消行程");
    vi.spyOn(api, "getTrip").mockResolvedValue(detail);
    const confirm = vi.spyOn(AppConfirm, "requestAppConfirm");
    const pendingConfirmation = deferred<boolean>();
    confirm.mockReturnValue(pendingConfirmation.promise);
    const { store, wrapper } = await mountTrip("/trips/trip-delete-cancel");
    const remove = vi.spyOn(store, "deleteTrip").mockResolvedValue(undefined);
    await flushPromises();

    await wrapper.get("button.danger-button").trigger("click");
    await wrapper.get("button.danger-button").trigger("click");
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith({
      cancelLabel: "取消",
      confirmLabel: "删除行程",
      description:
        "删除“待取消行程”后，行程会保留在已删除列表中，并可在此恢复。",
      destructive: true,
      title: "确认删除这段行程？",
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(wrapper.get("button.danger-button").element).toHaveProperty(
      "disabled",
      true,
    );
    expect(remove).not.toHaveBeenCalled();
    pendingConfirmation.resolve(false);
    await flushPromises();
    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("待取消行程");
    expect(wrapper.text()).not.toContain("行程已删除");
    expect(wrapper.get(".trip-head-actions").text()).toContain("删除");
    expect(wrapper.get(".trip-head-actions").text()).not.toContain("恢复");
  });

  it("refreshes deleted detail and replaces edit/delete actions with restore", async () => {
    const active = tripDetail("trip-delete", "准备删除的行程");
    const deleted = setTripDeleted(tripDetail("trip-delete", "准备删除的行程"));
    const getTrip = vi
      .spyOn(api, "getTrip")
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(deleted);
    vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(true);
    const { store, wrapper } = await mountTrip("/trips/trip-delete");
    const remove = vi.spyOn(store, "deleteTrip").mockResolvedValue(undefined);
    await flushPromises();

    await wrapper.get("button.danger-button").trigger("click");
    await flushPromises();

    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("trip-delete");
    expect(getTrip).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[role="status"]').text()).toContain("已删除");
    expect(wrapper.text()).toContain("行程已删除，可随时恢复");
    expect(wrapper.get(".trip-head-actions").text()).not.toContain("编辑行程");
    expect(wrapper.find("button.danger-button").exists()).toBe(false);
    expect(wrapper.get(".trip-head-actions button").text()).toBe("恢复");
  });

  it("retains failed trip edits, blocks duplicate saves, and retries unchanged payload", async () => {
    const detail = tripDetail("trip-save", "编辑前标题");
    vi.spyOn(api, "getTrip").mockResolvedValue(detail);
    const { store, wrapper } = await mountTrip("/trips/trip-save");
    const update = vi
      .spyOn(store, "updateTrip")
      .mockRejectedValueOnce(new ApiClientError(503, "UNAVAILABLE", "保存失败"))
      .mockResolvedValue(detail.trip);
    await flushPromises();
    await wrapper.get(".trip-head-actions button").trigger("click");

    const form = wrapper.get("form.trip-create");
    await form.get("input[required]").setValue("编辑后的标题");
    await form.get('input[inputmode="decimal"]').setValue("1200.50");
    await form.trigger("submit");
    await flushPromises();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenNthCalledWith(1, "trip-save", {
      budgetAmount: "1200.50",
      destination: "杭州目的地 trip-save",
      endDate: "2026-10-03",
      startDate: "2026-10-01",
      title: "编辑后的标题",
      version: 1,
    });
    expect(wrapper.get('[role="alert"]').text()).toContain("保存失败");
    expect(
      wrapper.get("form.trip-create").get("input[required]").element,
    ).toHaveProperty("value", "编辑后的标题");
    expect(wrapper.text()).not.toContain("行程已更新");

    await wrapper.get("form.trip-create").trigger("submit");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(2, "trip-save", {
      budgetAmount: "1200.50",
      destination: "杭州目的地 trip-save",
      endDate: "2026-10-03",
      startDate: "2026-10-01",
      title: "编辑后的标题",
      version: 1,
    });
    expect(wrapper.text()).toContain("行程已更新");
    expect(
      wrapper.find(".secondary-page-content > form.trip-create").exists(),
    ).toBe(false);
    expect(wrapper.get(".trip-head-actions").text()).toContain("编辑行程");
  });

  it("locks repeated saves and does not show an old mutation result on a new route", async () => {
    const detailA = tripDetail("trip-save-a", "行程 A");
    const detailB = tripDetail("trip-save-b", "行程 B");
    vi.spyOn(api, "getTrip").mockImplementation(async (id) =>
      id === "trip-save-a" ? detailA : detailB,
    );
    const { router, store, wrapper } = await mountTrip("/trips/trip-save-a");
    const pending = deferred<TripDetailResponse["trip"]>();
    const update = vi
      .spyOn(store, "updateTrip")
      .mockReturnValue(pending.promise);
    await flushPromises();
    await wrapper.get(".trip-head-actions button").trigger("click");
    const form = wrapper.get("form.trip-create");
    await form.get("input[required]").setValue("A 的新标题");
    await form.trigger("submit");
    await form.trigger("submit");
    expect(update).toHaveBeenCalledOnce();
    expect(wrapper.get('button[type="submit"]').text()).toContain("保存中");
    expect(wrapper.get('button[type="submit"]').element).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      wrapper.get("form.trip-create .trip-actions button.secondary-button")
        .element,
    ).toHaveProperty("disabled", true);

    await router.push("/trips/trip-save-b");
    await flushPromises();
    pending.resolve(detailA.trip);
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("行程 B");
    expect(wrapper.text()).not.toContain("A 的新标题");
    expect(wrapper.text()).not.toContain("行程已更新");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("retries restore after a failure and only then shows the active trip actions", async () => {
    const deleted = setTripDeleted(tripDetail("trip-restore", "恢复中的行程"));
    const restored = tripDetail("trip-restore", "恢复中的行程");
    const getTrip = vi
      .spyOn(api, "getTrip")
      .mockResolvedValueOnce(deleted)
      .mockResolvedValueOnce(restored);
    const { store, wrapper } = await mountTrip("/trips/trip-restore");
    const pendingRestore = deferred<void>();
    const restore = vi
      .spyOn(store, "restoreTrip")
      .mockReturnValueOnce(pendingRestore.promise)
      .mockResolvedValue(undefined);
    await flushPromises();

    await wrapper.get(".trip-head-actions button").trigger("click");
    await wrapper.get(".trip-head-actions button").trigger("click");
    expect(restore).toHaveBeenCalledOnce();
    expect(wrapper.get(".trip-head-actions button").text()).toContain("恢复中");
    expect(wrapper.get(".trip-head-actions button").element).toHaveProperty(
      "disabled",
      true,
    );
    pendingRestore.reject(new ApiClientError(503, "UNAVAILABLE", "恢复失败"));
    await flushPromises();
    expect(restore).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[role="alert"]').text()).toContain("恢复失败");
    expect(wrapper.text()).not.toContain("行程已恢复");
    expect(wrapper.text()).toContain("这段行程已删除");
    expect(wrapper.get(".trip-head-actions button").text()).toBe("恢复");

    await wrapper.get(".trip-head-actions button").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledTimes(2);
    expect(getTrip).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("行程已恢复");
    expect(wrapper.text()).not.toContain("这段行程已删除");
    expect(wrapper.get(".trip-head-actions").text()).toContain("编辑行程");
    expect(wrapper.find("button.danger-button").exists()).toBe(true);
  });

  it("does not delete or show stale feedback when the route changes during confirmation", async () => {
    const detailA = tripDetail("trip-confirm-a", "待删行程 A");
    const detailB = tripDetail("trip-confirm-b", "当前行程 B");
    vi.spyOn(api, "getTrip").mockImplementation(async (id) =>
      id === "trip-confirm-a" ? detailA : detailB,
    );
    const confirm = vi.spyOn(AppConfirm, "requestAppConfirm");
    const pendingConfirmation = deferred<boolean>();
    confirm.mockReturnValue(pendingConfirmation.promise);
    const { router, store, wrapper } = await mountTrip("/trips/trip-confirm-a");
    const remove = vi.spyOn(store, "deleteTrip").mockResolvedValue(undefined);
    await flushPromises();

    await wrapper.get("button.danger-button").trigger("click");
    await router.push("/trips/trip-confirm-b");
    await flushPromises();
    pendingConfirmation.resolve(true);
    await flushPromises();

    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.get("h1").text()).toBe("当前行程 B");
    expect(wrapper.text()).not.toContain("行程已删除");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("keeps node input after failure, prevents duplicate creation, and retries the Shanghai payload", async () => {
    const loaded = tripDetail("trip-node-create");
    vi.spyOn(api, "getTrip").mockResolvedValue(loaded);
    const { store, wrapper } = await mountTrip("/trips/trip-node-create");
    const pending = deferred<never>();
    const create = vi
      .spyOn(store, "createTripItem")
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue({} as never);
    await flushPromises();

    const form = wrapper.get('form[aria-labelledby="trip-node-create-title"]');
    await form.get("select").setValue("TRANSPORT");
    await form
      .findAll(".date-time-field-stub")[0]!
      .setValue("2026-10-02T10:30");
    await form
      .findAll(".date-time-field-stub")[1]!
      .setValue("2026-10-02T11:30");
    await form.get('input[type="text"]').setValue("杭州东站");
    await form.trigger("submit");
    await form.trigger("submit");

    expect(create).toHaveBeenCalledOnce();
    expect(form.get('button[type="submit"]').text()).toContain("添加中");
    expect(form.get('button[type="submit"]').element).toHaveProperty(
      "disabled",
      true,
    );
    expect(form.get("select").element).toHaveProperty("disabled", true);
    pending.reject(new ApiClientError(503, "UNAVAILABLE", "节点暂时保存失败"));
    await flushPromises();

    expect(wrapper.get(".trip-node-section [role=alert]").text()).toContain(
      "节点暂时保存失败",
    );
    expect(form.get("select").element).toHaveProperty("value", "TRANSPORT");
    expect(form.findAll(".date-time-field-stub")[0]!.element).toHaveProperty(
      "value",
      "2026-10-02T10:30",
    );
    expect(form.get('input[type="text"]').element).toHaveProperty(
      "value",
      "杭州东站",
    );

    await form.trigger("submit");
    await flushPromises();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith("trip-node-create", {
      endsAt: "2026-10-02T03:30:00.000Z",
      location: "杭州东站",
      startsAt: "2026-10-02T02:30:00.000Z",
      type: "TRANSPORT",
    });
    expect(wrapper.get(".trip-node-section [role=status]").text()).toContain(
      "节点已保存",
    );
    expect(form.get("select").element).toHaveProperty("value", "ACTIVITY");
    expect(form.findAll(".date-time-field-stub")[0]!.element).toHaveProperty(
      "value",
      "",
    );
  });

  it("keeps edit values through out-of-range cancellation and confirms with the original version", async () => {
    const loaded = tripDetail("trip-node-range");
    vi.spyOn(api, "getTrip").mockResolvedValue(loaded);
    const { store, wrapper } = await mountTrip("/trips/trip-node-range");
    const rangeError = new ApiClientError(
      400,
      "TRIP_ITEM_OUT_OF_RANGE",
      "节点时间超出行程日期范围",
    );
    const update = vi
      .spyOn(store, "updateTripItem")
      .mockRejectedValueOnce(rangeError)
      .mockRejectedValueOnce(rangeError)
      .mockResolvedValue({} as never);
    await flushPromises();

    const card = wrapper.get('[data-node-id="item-trip-node-range"]');
    await card.get("button").trigger("click");
    const form = card.get("form.trip-node-form");
    await form.get("select").setValue("STAY");
    await form
      .findAll(".date-time-field-stub")[0]!
      .setValue("2026-10-04T10:00");
    await form
      .findAll(".date-time-field-stub")[1]!
      .setValue("2026-10-04T11:00");
    await form.get('input[type="text"]').setValue("西湖住宿点");
    await form.trigger("submit");
    await flushPromises();

    expect(update).toHaveBeenCalledOnce();
    expect(wrapper.get(".trip-node-section [role=alert]").text()).toContain(
      "节点时间超出行程日期范围",
    );
    const cancelRange = wrapper
      .get(".trip-node-section .warning-banner")
      .get("button.secondary-button");
    await cancelRange.trigger("click");
    expect(update).toHaveBeenCalledOnce();
    expect(wrapper.find(".trip-node-section .warning-banner").exists()).toBe(
      false,
    );
    expect(form.get('input[type="text"]').element).toHaveProperty(
      "value",
      "西湖住宿点",
    );

    await form.trigger("submit");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(2);
    await wrapper
      .get(".trip-node-section .warning-banner")
      .get("button.primary-button")
      .trigger("click");
    await flushPromises();

    const expectedPayload = {
      endsAt: "2026-10-04T03:00:00.000Z",
      location: "西湖住宿点",
      startsAt: "2026-10-04T02:00:00.000Z",
      type: "STAY",
      version: 1,
    };
    expect(update).toHaveBeenNthCalledWith(
      1,
      "item-trip-node-range",
      "trip-node-range",
      expectedPayload,
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      "item-trip-node-range",
      "trip-node-range",
      expectedPayload,
    );
    expect(update).toHaveBeenNthCalledWith(
      3,
      "item-trip-node-range",
      "trip-node-range",
      { ...expectedPayload, confirmOutOfRange: true },
    );
    expect(wrapper.get(".trip-node-section [role=status]").text()).toContain(
      "节点已保存",
    );
    expect(card.find("form.trip-node-form").exists()).toBe(false);
  });

  it("confirms node deletion, retries failures, and keeps restore feedback local to the node section", async () => {
    const loaded = tripDetail("trip-node-delete");
    const deletedNode = loaded.items[0]!;
    vi.spyOn(api, "getTrip").mockResolvedValue(loaded);
    const confirm = vi.spyOn(AppConfirm, "requestAppConfirm");
    const pendingConfirm = deferred<boolean>();
    confirm.mockReturnValueOnce(pendingConfirm.promise).mockResolvedValue(true);
    const { store, wrapper } = await mountTrip("/trips/trip-node-delete");
    const pendingDelete = deferred<void>();
    const remove = vi
      .spyOn(store, "deleteTripItem")
      .mockRejectedValueOnce(
        new ApiClientError(503, "UNAVAILABLE", "节点删除暂时失败"),
      )
      .mockImplementationOnce(async () => {
        await pendingDelete.promise;
        store.detail!.items = [];
      });
    const restore = vi
      .spyOn(store, "restoreTripItem")
      .mockRejectedValueOnce(
        new ApiClientError(503, "UNAVAILABLE", "节点恢复暂时失败"),
      )
      .mockImplementationOnce(async () => {
        store.detail!.items = [deletedNode];
      });
    await flushPromises();

    const card = wrapper.get('[data-node-id="item-trip-node-delete"]');
    await card.get("button.danger").trigger("click");
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("刷新或重新进入行程后仍可恢复"),
      }),
    );
    expect(card.get("button.danger").element).toHaveProperty("disabled", true);
    expect(remove).not.toHaveBeenCalled();
    pendingConfirm.resolve(false);
    await flushPromises();
    expect(remove).not.toHaveBeenCalled();
    expect(card.findAll("button.danger")).toHaveLength(1);

    await card.get("button.danger").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledOnce();
    expect(wrapper.get(".trip-node-section [role=alert]").text()).toContain(
      "节点删除暂时失败",
    );
    expect(card.findAll("button.danger")).toHaveLength(1);

    await card.get("button.danger").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(card.get("button.danger").element).toHaveProperty("disabled", true);
    pendingDelete.resolve();
    await (remove.mock.results[1]!.value as Promise<void>);
    await flushPromises();
    let currentCard = wrapper.get('[data-node-id="item-trip-node-delete"]');
    expect(currentCard.text()).toContain("已删除");
    expect(currentCard.findAll("button.danger")).toHaveLength(0);
    expect(currentCard.get("button").text()).toBe("恢复节点");

    await currentCard.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get(".trip-node-section [role=alert]").text()).toContain(
      "节点恢复暂时失败",
    );
    currentCard = wrapper.get('[data-node-id="item-trip-node-delete"]');
    expect(currentCard.text()).toContain("已删除");
    await currentCard.get("button").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledTimes(2);
    currentCard = wrapper.get('[data-node-id="item-trip-node-delete"]');
    expect(currentCard.text()).not.toContain("已删除");
    expect(wrapper.get(".trip-node-section [role=status]").text()).toContain(
      "节点已恢复",
    );
  });

  it("ignores a late node mutation result after switching trips", async () => {
    const detailA = tripDetail("trip-node-old", "旧行程");
    const detailB = tripDetail("trip-node-current", "当前行程");
    vi.spyOn(api, "getTrip").mockImplementation(async (id) =>
      id === "trip-node-old" ? detailA : detailB,
    );
    const { router, store, wrapper } = await mountTrip("/trips/trip-node-old");
    const pending = deferred<never>();
    const create = vi
      .spyOn(store, "createTripItem")
      .mockReturnValue(pending.promise);
    await flushPromises();

    const form = wrapper.get('form[aria-labelledby="trip-node-create-title"]');
    await form
      .findAll(".date-time-field-stub")[0]!
      .setValue("2026-10-02T10:30");
    await form
      .findAll(".date-time-field-stub")[1]!
      .setValue("2026-10-02T11:30");
    await form.get('input[type="text"]').setValue("旧行程节点");
    await form.trigger("submit");
    expect(create).toHaveBeenCalledOnce();

    await router.push("/trips/trip-node-current");
    await flushPromises();
    pending.resolve({} as never);
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("当前行程");
    expect(wrapper.text()).not.toContain("旧行程节点");
    expect(wrapper.text()).not.toContain("节点已保存");
    expect(wrapper.find(".trip-node-section [role=alert]").exists()).toBe(
      false,
    );
  });

  it("creates packing items with the original text payload, blocks duplicates, and retries retained input", async () => {
    const loaded = tripDetail("trip-packing-create");
    vi.spyOn(api, "getTrip").mockResolvedValue(loaded);
    const { store, wrapper } = await mountTrip("/trips/trip-packing-create");
    const pending = deferred<never>();
    const create = vi
      .spyOn(store, "createPackingItem")
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({} as never);
    await flushPromises();

    const form = wrapper.get(
      'form[aria-labelledby="trip-packing-create-title"]',
    );
    expect(wrapper.get("#trip-packing-create-title").text()).toBe("新增行李项");
    expect(wrapper.get("#trip-packing-list-title").text()).toBe("清单项目");
    expect(wrapper.get(".trip-packing-state").text()).toBe("待整理");

    const field = form.get("input[required]");
    await field.setValue("折叠后的外套与充电器");
    await form.trigger("submit");
    await form.trigger("submit");
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith("trip-packing-create", {
      text: "折叠后的外套与充电器",
    });
    expect(form.get('button[type="submit"]').text()).toContain("添加中");
    expect(form.get('button[type="submit"]').element).toHaveProperty(
      "disabled",
      true,
    );

    pending.reject(new ApiClientError(503, "UNAVAILABLE", "新增暂时失败"));
    await flushPromises();
    expect(wrapper.get(".trip-packing-section [role=alert]").text()).toContain(
      "新增暂时失败",
    );
    expect(field.element).toHaveProperty("value", "折叠后的外套与充电器");
    expect(wrapper.text()).not.toContain("行李项已添加");

    await form.trigger("submit");
    await flushPromises();
    expect(create).toHaveBeenCalledTimes(2);
    expect(wrapper.get(".trip-packing-section [role=status]").text()).toContain(
      "行李项已添加",
    );
    expect(field.element).toHaveProperty("value", "");
  });

  it("keeps packing edit text on failure and preserves version and checked payloads", async () => {
    const loaded = tripDetail("trip-packing-update");
    vi.spyOn(api, "getTrip").mockResolvedValue(loaded);
    const { store, wrapper } = await mountTrip("/trips/trip-packing-update");
    const pending = deferred<never>();
    const pendingCheck = deferred<never>();
    let failCheckOnce = true;
    const update = vi
      .spyOn(store, "updatePackingItem")
      .mockReturnValueOnce(pending.promise)
      .mockImplementation(async (id, tripId, input) => {
        if ("checked" in input && failCheckOnce) {
          failCheckOnce = false;
          await pendingCheck.promise;
        }
        const current = store.detail!.packingItems.find(
          (item) => item.id === id,
        )!;
        store.detail!.packingItems = [
          {
            ...current,
            ...input,
            version: current.version + 1,
          },
        ];
        return store.detail!.packingItems[0]!;
      });
    await flushPromises();

    const card = wrapper.get('[data-packing-id="packing-trip-packing-update"]');
    await card.get("button").trigger("click");
    const editForm = card.get("form.trip-packing-edit-form");
    const input = editForm.get("input[required]");
    await input.setValue("编辑后的长行李备注");
    await editForm.trigger("submit");
    await editForm.trigger("submit");
    expect(update).toHaveBeenCalledOnce();
    expect(editForm.get('button[type="submit"]').element).toHaveProperty(
      "disabled",
      true,
    );
    expect(update).toHaveBeenCalledOnce();
    pending.reject(new ApiClientError(503, "UNAVAILABLE", "编辑暂时失败"));
    await flushPromises();

    expect(wrapper.get(".trip-packing-section [role=alert]").text()).toContain(
      "编辑暂时失败",
    );
    expect(input.element).toHaveProperty("value", "编辑后的长行李备注");
    expect(wrapper.text()).not.toContain("行李项已更新");

    await editForm.trigger("submit");
    await flushPromises();
    expect(update).toHaveBeenNthCalledWith(
      2,
      "packing-trip-packing-update",
      "trip-packing-update",
      { text: "编辑后的长行李备注", version: 1 },
    );
    expect(wrapper.get(".trip-packing-section [role=status]").text()).toContain(
      "行李项已更新",
    );
    expect(wrapper.find(".trip-packing-edit-form").exists()).toBe(false);

    const checkbox = wrapper.get(
      '[data-packing-id="packing-trip-packing-update"] input[type="checkbox"]',
    );
    await checkbox.setValue(true);
    await checkbox.trigger("change");
    expect(update).toHaveBeenCalledTimes(3);
    expect(checkbox.element).toHaveProperty("checked", false);
    pendingCheck.reject(
      new ApiClientError(503, "UNAVAILABLE", "状态更新暂时失败"),
    );
    await flushPromises();
    expect(wrapper.get(".trip-packing-section [role=alert]").text()).toContain(
      "状态更新暂时失败",
    );
    await checkbox.setValue(true);
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(
      "packing-trip-packing-update",
      "trip-packing-update",
      { checked: true, version: 2 },
    );
    expect(wrapper.get(".trip-packing-section [role=status]").text()).toContain(
      "已标记为已收纳",
    );
  });

  it("requires delete confirmation, keeps a deleted row visible, and retries restore", async () => {
    const loaded = tripDetail("trip-packing-delete");
    const packingItem = loaded.packingItems[0]!;
    vi.spyOn(api, "getTrip").mockResolvedValue(loaded);
    const confirm = vi.spyOn(AppConfirm, "requestAppConfirm");
    const pendingConfirmation = deferred<boolean>();
    confirm
      .mockReturnValueOnce(pendingConfirmation.promise)
      .mockResolvedValue(true);
    const { store, wrapper } = await mountTrip("/trips/trip-packing-delete");
    const pendingDelete = deferred<void>();
    const remove = vi
      .spyOn(store, "deletePackingItem")
      .mockRejectedValueOnce(
        new ApiClientError(503, "UNAVAILABLE", "删除暂时失败"),
      )
      .mockImplementationOnce(async () => {
        await pendingDelete.promise;
        store.detail!.packingItems = [];
      });
    const restore = vi
      .spyOn(store, "restorePackingItem")
      .mockRejectedValueOnce(
        new ApiClientError(503, "UNAVAILABLE", "恢复暂时失败"),
      )
      .mockImplementationOnce(async () => {
        store.detail!.packingItems = [packingItem];
      });
    await flushPromises();

    const card = wrapper.get('[data-packing-id="packing-trip-packing-delete"]');
    await card.get("button.danger").trigger("click");
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmLabel: "删除行李项",
        description: expect.stringContaining("刷新或重新进入行程后仍可恢复"),
        title: "确认删除这个行李项？",
      }),
    );
    expect(remove).not.toHaveBeenCalled();
    expect(card.get("button.danger").element).toHaveProperty("disabled", true);
    await card.get("button.danger").trigger("click");
    expect(confirm).toHaveBeenCalledOnce();
    pendingConfirmation.resolve(false);
    await flushPromises();
    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.find(".trip-packing-recovery-note").exists()).toBe(false);

    await card.get("button.danger").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledOnce();
    expect(wrapper.get(".trip-packing-section [role=alert]").text()).toContain(
      "删除暂时失败",
    );
    expect(wrapper.text()).not.toContain("行李项已删除");
    expect(card.find("button.danger").exists()).toBe(true);

    await card.get("button.danger").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(card.get("button.danger").element).toHaveProperty("disabled", true);
    await card.get("button.danger").trigger("click");
    expect(remove).toHaveBeenCalledTimes(2);
    pendingDelete.resolve();
    await flushPromises();

    const deletedCard = wrapper.get(
      '[data-packing-id="packing-trip-packing-delete"]',
    );
    expect(deletedCard.text()).toContain("已删除 · 可恢复");
    expect(deletedCard.find('input[type="checkbox"]').exists()).toBe(false);
    expect(deletedCard.find("button").text()).toBe("恢复行李项");
    expect(wrapper.get(".trip-packing-recovery-note").text()).toContain(
      "刷新或重新进入行程后继续恢复",
    );

    await deletedCard.get("button").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledOnce();
    expect(wrapper.get(".trip-packing-section [role=alert]").text()).toContain(
      "恢复暂时失败",
    );
    expect(
      wrapper.get('[data-packing-id="packing-trip-packing-delete"]').text(),
    ).toContain("已删除 · 可恢复");

    const pendingRestore = deferred<void>();
    restore.mockImplementationOnce(async () => {
      await pendingRestore.promise;
      store.detail!.packingItems = [packingItem];
    });
    const restoreButton = wrapper.get(
      '[data-packing-id="packing-trip-packing-delete"] button',
    );
    await restoreButton.trigger("click");
    await restoreButton.trigger("click");
    expect(restore).toHaveBeenCalledTimes(2);
    expect(restoreButton.text()).toContain("恢复中");
    expect(restoreButton.element).toHaveProperty("disabled", true);
    await restoreButton.trigger("click");
    expect(restore).toHaveBeenCalledTimes(2);
    pendingRestore.resolve();
    await flushPromises();
    expect(
      wrapper.get('[data-packing-id="packing-trip-packing-delete"]').text(),
    ).not.toContain("已删除 · 可恢复");
    expect(wrapper.get(".trip-packing-section [role=status]").text()).toContain(
      "行李项已恢复",
    );
  });

  it("drops packing drafts, snapshots, and late feedback when switching trips", async () => {
    const detailA = tripDetail("trip-packing-old", "旧行程");
    const detailB = tripDetail("trip-packing-current", "当前行程");
    vi.spyOn(api, "getTrip").mockImplementation(async (id) =>
      id === "trip-packing-old" ? detailA : detailB,
    );
    const { router, store, wrapper } = await mountTrip(
      "/trips/trip-packing-old",
    );
    const pending = deferred<never>();
    const create = vi
      .spyOn(store, "createPackingItem")
      .mockReturnValue(pending.promise);
    await flushPromises();

    const form = wrapper.get(
      'form[aria-labelledby="trip-packing-create-title"]',
    );
    await form.get("input[required]").setValue("旧行程的未保存行李项");
    const unsaved = unsavedMock.mock.calls.at(-1)?.[0] as
      { value: boolean } | undefined;
    expect(unsaved?.value).toBe(true);
    await form.trigger("submit");
    expect(create).toHaveBeenCalledOnce();

    await router.push("/trips/trip-packing-current");
    await flushPromises();
    pending.resolve({} as never);
    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("当前行程");
    expect(wrapper.text()).not.toContain("旧行程的未保存行李项");
    expect(wrapper.text()).not.toContain("行李项已添加");
    expect(wrapper.find(".trip-packing-section [role=alert]").exists()).toBe(
      false,
    );
  });

  it("does not delete an old trip item when navigation wins over confirmation", async () => {
    const detailA = tripDetail("trip-packing-confirm-old", "待删行程");
    const detailB = tripDetail("trip-packing-confirm-new", "当前行程");
    vi.spyOn(api, "getTrip").mockImplementation(async (id) =>
      id === "trip-packing-confirm-old" ? detailA : detailB,
    );
    const confirm = vi.spyOn(AppConfirm, "requestAppConfirm");
    const pendingConfirmation = deferred<boolean>();
    confirm.mockReturnValue(pendingConfirmation.promise);
    const { router, store, wrapper } = await mountTrip(
      "/trips/trip-packing-confirm-old",
    );
    const remove = vi.spyOn(store, "deletePackingItem").mockResolvedValue();
    await flushPromises();

    await wrapper
      .get('[data-packing-id="packing-trip-packing-confirm-old"] button.danger')
      .trigger("click");
    expect(confirm).toHaveBeenCalledOnce();
    await router.push("/trips/trip-packing-confirm-new");
    await flushPromises();
    pendingConfirmation.resolve(true);
    await flushPromises();

    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.get("h1").text()).toBe("当前行程");
    expect(wrapper.text()).not.toContain(
      "需要正常换行的长行李说明 trip-packing-confirm-old",
    );
    expect(wrapper.text()).not.toContain("行李项已删除");
    expect(wrapper.find(".trip-packing-section [role=alert]").exists()).toBe(
      false,
    );
  });
});
