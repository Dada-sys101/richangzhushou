import { defineStore } from "pinia";

import {
  api,
  isOfflineError,
  type TripDetailResponse,
  type TripItemType,
  type TripSummary,
} from "../api/client";
import {
  localGet,
  localList,
  localTripDetail,
  mergePending,
} from "../offline/local";
import { useAuthStore } from "./auth";

interface TripsState {
  detail: TripDetailResponse | null;
  errorMessage: string | null;
  trips: TripSummary[];
}

export const useTripsStore = defineStore("trips", {
  state: (): TripsState => ({
    detail: null,
    errorMessage: null,
    trips: [],
  }),
  actions: {
    async loadTrips(params: { includeDeleted?: boolean } = {}) {
      this.errorMessage = null;
      try {
        const result = await api.listTrips(params);
        const userId = useAuthStore().userId;
        this.trips = userId
          ? mergePending(
              result.items,
              (await localList(userId, "TRIP")) as unknown as TripSummary[],
            )
          : result.items;
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          this.trips = userId
            ? ((await localList(userId, "TRIP")) as unknown as TripSummary[])
            : [];
        } else {
          this.errorMessage = messageOf(error);
        }
      }
    },
    async loadTrip(id: string) {
      this.errorMessage = null;
      try {
        this.detail = await api.getTrip(id);
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          if (userId) {
            const detail = await this.localTripDetail(userId, id);
            if (detail) {
              this.detail = detail;
              return;
            }
          }
        }
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async localTripDetail(userId: string, id: string) {
      const [trip, items, packingItems, transactions, calendarEvents] =
        await Promise.all([
          localGet(userId, "TRIP", id),
          localList(userId, "TRIP_ITEM"),
          localList(userId, "PACKING_ITEM"),
          localList(userId, "TRANSACTION"),
          localList(userId, "CALENDAR_EVENT"),
        ]);
      return localTripDetail(
        trip,
        items.filter((item) => item.tripId === id),
        packingItems.filter((item) => item.tripId === id),
        transactions,
        calendarEvents,
      ) as unknown as TripDetailResponse | null;
    },
    async createTrip(input: {
      budgetAmount?: string | null;
      destination: string;
      endDate: string;
      startDate: string;
      title: string;
    }) {
      this.errorMessage = null;
      try {
        const trip = await api.createTrip(input);
        await this.loadTrips();
        return trip;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async updateTrip(
      id: string,
      input: {
        budgetAmount?: string | null;
        destination?: string;
        endDate?: string;
        startDate?: string;
        title?: string;
        version: number;
      },
    ) {
      this.errorMessage = null;
      try {
        const trip = await api.updateTrip(id, input);
        await this.loadTrip(id);
        return trip;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async deleteTrip(id: string) {
      this.errorMessage = null;
      try {
        await api.deleteTrip(id);
        await this.loadTrips({ includeDeleted: true });
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async restoreTrip(id: string) {
      this.errorMessage = null;
      try {
        await api.restoreTrip(id);
        await this.loadTrips({ includeDeleted: true });
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async createTripItem(
      tripId: string,
      input: {
        clientMutationId?: string | null;
        confirmOutOfRange?: boolean;
        endsAt: string;
        location?: string | null;
        position?: number;
        startsAt: string;
        type: TripItemType;
      },
    ) {
      this.errorMessage = null;
      try {
        const result = await api.createTripItem(tripId, input);
        await this.loadTrip(tripId);
        return result;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async updateTripItem(
      id: string,
      tripId: string,
      input: {
        confirmOutOfRange?: boolean;
        endsAt?: string;
        location?: string | null;
        position?: number;
        startsAt?: string;
        type?: TripItemType;
        version: number;
      },
    ) {
      this.errorMessage = null;
      try {
        const result = await api.updateTripItem(id, input);
        await this.loadTrip(tripId);
        return result;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async deleteTripItem(id: string, tripId: string) {
      this.errorMessage = null;
      try {
        await api.deleteTripItem(id);
        await this.loadTrip(tripId);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async restoreTripItem(id: string, tripId: string) {
      this.errorMessage = null;
      try {
        await api.restoreTripItem(id);
        await this.loadTrip(tripId);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async createPackingItem(
      tripId: string,
      input: {
        clientMutationId?: string | null;
        position?: number;
        text: string;
      },
    ) {
      this.errorMessage = null;
      try {
        const item = await api.createPackingItem(tripId, input);
        await this.loadTrip(tripId);
        return item;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async updatePackingItem(
      id: string,
      tripId: string,
      input: {
        checked?: boolean;
        position?: number;
        text?: string;
        version: number;
      },
    ) {
      this.errorMessage = null;
      try {
        const item = await api.updatePackingItem(id, input);
        await this.loadTrip(tripId);
        return item;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async deletePackingItem(id: string, tripId: string) {
      this.errorMessage = null;
      try {
        await api.deletePackingItem(id);
        await this.loadTrip(tripId);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async restorePackingItem(id: string, tripId: string) {
      this.errorMessage = null;
      try {
        await api.restorePackingItem(id);
        await this.loadTrip(tripId);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    clearError() {
      this.errorMessage = null;
    },
  },
});

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
