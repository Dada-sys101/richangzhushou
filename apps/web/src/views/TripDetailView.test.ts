// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  api,
  OfflineNetworkError,
  type TripDetailResponse,
} from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useTripsStore } from "../stores/trips";
import TripDetailView from "./TripDetailView.vue";

const unsavedMock = vi.hoisted(() => vi.fn());
vi.mock("../composables/useUnsavedChanges", () => ({
  useUnsavedChanges: unsavedMock,
}));

const Host = { template: "<RouterView />" };
const Placeholder = { template: "<div />" };

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
        DateTimeField: { template: '<input class="date-time-field-stub" />' },
      },
    },
  });
  return { router, store, wrapper };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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
    expect(wrapper.find("button").exists()).toBe(true);
    expect(wrapper.text()).toContain("编辑行程");
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
    expect(wrapper.text()).toContain("还没有行李项。");
    expect(wrapper.text()).toContain("行程日期范围内没有日程。");
    expect(wrapper.text()).toContain(
      "还没有关联账单，记账时选择该行程即可关联。",
    );
  });

  it("keeps a matching locally cached detail when the store resolves offline", async () => {
    const cached = tripDetail("trip-offline", "离线缓存行程");
    vi.spyOn(api, "getTrip").mockRejectedValue(
      new OfflineNetworkError("GET", "/trips/trip-offline"),
    );
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
    expect(wrapper.get("h1").text()).toBe("离线缓存行程");
    expect(wrapper.text()).toContain("¥123456789012.30");
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
});
