// @vitest-environment jsdom
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  api,
  OfflineNetworkError,
  type TripDetailResponse,
  type TripSummary,
} from "../api/client";
import * as local from "../offline/local";
import * as sync from "../offline/sync";
import { useAuthStore } from "./auth";
import { useTripsStore } from "./trips";

const cachedTrip: TripSummary = {
  budgetAmount: "50.00",
  createdAt: "2026-09-23T00:00:00.000Z",
  deletedAt: null,
  destination: "杭州",
  endDate: "2026-09-11",
  id: "trip-cached",
  startDate: "2026-09-10",
  title: "缓存行程",
  updatedAt: "2026-09-23T00:00:00.000Z",
  version: 1,
};

function cachedDetailWithDeletedChildren(): TripDetailResponse {
  const timestamp = "2026-09-24T01:00:00.000Z";
  const trip: TripSummary = { ...cachedTrip, id: "trip-with-deleted" };
  return {
    calendarEvents: [],
    expense: {
      actualExpense: "0.00",
      budgetAmount: trip.budgetAmount,
      budgetProgress: "0.00",
    },
    items: [
      {
        createdAt: timestamp,
        deletedAt: timestamp,
        endsAt: timestamp,
        id: "deleted-node",
        location: null,
        position: 0,
        startsAt: timestamp,
        tripId: trip.id,
        type: "ACTIVITY",
        updatedAt: timestamp,
        version: 2,
      },
    ],
    linkedTransactions: [],
    packingItems: [
      {
        checked: false,
        createdAt: timestamp,
        deletedAt: timestamp,
        id: "deleted-packing",
        position: 0,
        text: "已删除行李项",
        tripId: trip.id,
        updatedAt: timestamp,
        version: 2,
      },
    ],
    trip,
  };
}

let listTrips: ReturnType<typeof vi.spyOn>;
let localList: ReturnType<typeof vi.spyOn>;
let listPending: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().$patch({
    accessToken: "test-token",
    user: { id: "user-1" } as never,
  });
  listTrips = vi.spyOn(api, "listTrips").mockResolvedValue({
    items: [],
    nextCursor: null,
  });
  localList = vi
    .spyOn(local, "localList")
    .mockResolvedValue([cachedTrip as unknown as Record<string, unknown>]);
  listPending = vi.spyOn(sync, "listPendingForUser").mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

describe("Trips store authoritative list merge", () => {
  it("does not resurrect a synced cached trip omitted by the active server list", async () => {
    const store = useTripsStore();
    await store.loadTrips();
    expect(store.trips).toEqual([]);
    expect(localList).toHaveBeenCalledWith("user-1", "TRIP");
    expect(listPending).toHaveBeenCalledWith("user-1");
  });

  it("keeps a genuinely pending local trip visible alongside server results", async () => {
    localList.mockResolvedValueOnce([
      { ...cachedTrip, id: "local:trip-1" } as unknown as Record<
        string,
        unknown
      >,
    ]);
    listPending.mockResolvedValueOnce([
      {
        action: "CREATE",
        createdAt: Date.now(),
        current: null,
        entityId: null,
        entityType: "TRIP",
        errorCode: null,
        errorMessage: null,
        id: "mutation-1",
        localId: "local:trip-1",
        payload: {},
        status: "PENDING",
        userId: "user-1",
        version: null,
      },
    ]);
    const store = useTripsStore();
    await store.loadTrips();
    expect(store.trips.map((trip) => trip.id)).toEqual(["local:trip-1"]);
  });

  it("continues to show the local list when the request is offline", async () => {
    listTrips.mockRejectedValueOnce(new OfflineNetworkError("GET", "/trips"));
    const store = useTripsStore();
    await store.loadTrips();
    expect(store.trips).toEqual([cachedTrip]);
    expect(listPending).not.toHaveBeenCalled();
  });
});

describe("Trips store detail tombstones", () => {
  it("requests deleted children explicitly for detail loads", async () => {
    const detail = cachedDetailWithDeletedChildren();
    const getTrip = vi.spyOn(api, "getTrip").mockResolvedValue(detail);
    const store = useTripsStore();

    await store.loadTrip(detail.trip.id);

    expect(getTrip).toHaveBeenCalledWith(detail.trip.id, {
      includeDeletedChildren: true,
    });
    expect(store.detail?.items[0]?.deletedAt).not.toBeNull();
    expect(store.detail?.packingItems[0]?.deletedAt).not.toBeNull();
  });

  it("keeps cached deleted children available when detail loading is offline", async () => {
    const detail = cachedDetailWithDeletedChildren();
    vi.spyOn(api, "getTrip").mockRejectedValue(
      new OfflineNetworkError("GET", `/trips/${detail.trip.id}`),
    );
    const store = useTripsStore();
    const localDetail = vi
      .spyOn(store, "localTripDetail")
      .mockResolvedValue(detail);

    await store.loadTrip(detail.trip.id);

    expect(localDetail).toHaveBeenCalledWith("user-1", detail.trip.id);
    expect(store.detail?.items).toHaveLength(1);
    expect(store.detail?.items[0]?.deletedAt).not.toBeNull();
    expect(store.detail?.packingItems).toHaveLength(1);
    expect(store.detail?.packingItems[0]?.deletedAt).not.toBeNull();
  });
});
