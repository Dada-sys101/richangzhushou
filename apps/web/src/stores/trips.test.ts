// @vitest-environment jsdom
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, OfflineNetworkError, type TripSummary } from "../api/client";
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
