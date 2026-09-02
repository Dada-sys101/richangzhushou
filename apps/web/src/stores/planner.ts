import { defineStore } from "pinia";

import {
  api,
  apiErrorKind,
  isOfflineError,
  type ApiErrorKind,
  type CalendarEventSummary,
  type ReminderSummary,
  type TaskSummary,
} from "../api/client";
import { localList, mergePending } from "../offline/local";
import type { SyncEntityType } from "../offline/sync";
import { useAuthStore } from "./auth";

type CalendarEventParams = {
  date?: string;
  includeDeleted?: boolean;
  month?: string;
  status?: "SCHEDULED" | "CANCELLED";
};

type TaskParams = {
  includeDeleted?: boolean;
  status?: "OPEN" | "COMPLETED" | "CANCELLED";
};

type ReminderParams = {
  includeDeleted?: boolean;
  status?: "SCHEDULED" | "SENT" | "CANCELLED" | "FAILED" | "SUPPRESSED";
};

interface PlannerState {
  calendarEvents: CalendarEventSummary[];
  errorKind: ApiErrorKind | null;
  errorMessage: string | null;
  lastCalendarParams: CalendarEventParams;
  lastReminderParams: ReminderParams;
  lastTaskParams: TaskParams;
  reminders: ReminderSummary[];
  tasks: TaskSummary[];
}

export const usePlannerStore = defineStore("planner", {
  state: (): PlannerState => ({
    calendarEvents: [],
    errorKind: null,
    errorMessage: null,
    lastCalendarParams: {},
    lastReminderParams: {},
    lastTaskParams: {},
    reminders: [],
    tasks: [],
  }),
  getters: {
    openTasks: (state) => state.tasks.filter((task) => task.status === "OPEN"),
    scheduledReminders: (state) =>
      state.reminders.filter((reminder) => reminder.status === "SCHEDULED"),
  },
  actions: {
    async loadCalendarEvents(params: CalendarEventParams = {}) {
      this.lastCalendarParams = { ...params };
      this.errorMessage = null;
      this.errorKind = null;
      try {
        const result = await api.listCalendarEvents(params);
        const userId = useAuthStore().userId;
        this.calendarEvents = userId
          ? mergePending(
              result.items,
              filterCalendarLocals(
                (await localList(
                  userId,
                  "CALENDAR_EVENT",
                )) as unknown as CalendarEventSummary[],
                params.date,
              ),
            )
          : result.items;
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          this.calendarEvents = userId
            ? filterCalendarLocals(
                (await localList(
                  userId,
                  "CALENDAR_EVENT",
                )) as unknown as CalendarEventSummary[],
                params.date,
              )
            : [];
        } else {
          this.errorKind = apiErrorKind(error);
          this.errorMessage = messageOf(error);
        }
      }
    },
    async loadTasks(params: TaskParams = {}) {
      this.lastTaskParams = { ...params };
      this.errorMessage = null;
      this.errorKind = null;
      try {
        const result = await api.listTasks(params);
        const userId = useAuthStore().userId;
        this.tasks = userId
          ? mergePending(
              result.items,
              (await localList(userId, "TASK")) as unknown as TaskSummary[],
            )
          : result.items;
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          this.tasks = userId
            ? ((await localList(userId, "TASK")) as unknown as TaskSummary[])
            : [];
        } else {
          this.errorKind = apiErrorKind(error);
          this.errorMessage = messageOf(error);
        }
      }
    },
    async loadReminders(params: ReminderParams = {}) {
      this.lastReminderParams = { ...params };
      this.errorMessage = null;
      this.errorKind = null;
      try {
        const result = await api.listReminders(params);
        const userId = useAuthStore().userId;
        this.reminders = userId
          ? mergePending(
              result.items,
              (await localList(
                userId,
                "REMINDER",
              )) as unknown as ReminderSummary[],
            )
          : result.items;
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          this.reminders = userId
            ? ((await localList(
                userId,
                "REMINDER",
              )) as unknown as ReminderSummary[])
            : [];
        } else {
          this.errorKind = apiErrorKind(error);
          this.errorMessage = messageOf(error);
        }
      }
    },
    async refreshForSync(entityTypes: SyncEntityType[] = []) {
      this.clearError();
      const changed = new Set(entityTypes);
      const refreshAll = changed.size === 0;
      const requests: Promise<unknown>[] = [];
      if (refreshAll || changed.has("CALENDAR_EVENT")) {
        requests.push(this.loadCalendarEvents(this.lastCalendarParams));
      }
      if (refreshAll || changed.has("TASK")) {
        requests.push(this.loadTasks(this.lastTaskParams));
      }
      if (refreshAll || changed.has("REMINDER")) {
        requests.push(this.loadReminders(this.lastReminderParams));
      }
      await Promise.all(requests);
    },
    async createCalendarEvent(input: {
      allDay?: boolean;
      endsAt: string;
      startsAt: string;
      title: string;
    }) {
      this.errorMessage = null;
      try {
        const result = await api.createCalendarEvent(input);
        await this.loadCalendarEvents();
        return result;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async updateCalendarEvent(
      id: string,
      input: {
        allDay?: boolean;
        endsAt?: string;
        startsAt?: string;
        status?: "SCHEDULED" | "CANCELLED";
        title?: string;
        version: number;
      },
    ) {
      this.errorMessage = null;
      try {
        const result = await api.updateCalendarEvent(id, input);
        await this.loadCalendarEvents();
        return result;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async deleteCalendarEvent(id: string) {
      this.errorMessage = null;
      try {
        const result = await api.deleteCalendarEvent(id);
        await this.loadCalendarEvents({ includeDeleted: true });
        if (result) {
          replaceById(this.calendarEvents, result);
        }
        return requireDeleted(result, this.calendarEvents, id);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async restoreCalendarEvent(id: string) {
      this.errorMessage = null;
      try {
        const result = await api.restoreCalendarEvent(id);
        await this.loadCalendarEvents({ includeDeleted: true });
        return result;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async createTask(input: {
      dueAt?: string | null;
      priority?: "LOW" | "MEDIUM" | "HIGH";
      title: string;
    }) {
      this.errorMessage = null;
      try {
        const task = await api.createTask(input);
        await this.loadTasks();
        return task;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async updateTask(
      id: string,
      input: {
        dueAt?: string | null;
        priority?: "LOW" | "MEDIUM" | "HIGH";
        status?: "OPEN" | "COMPLETED" | "CANCELLED";
        title?: string;
        version: number;
      },
    ) {
      this.errorMessage = null;
      try {
        const task = await api.updateTask(id, input);
        await this.loadTasks();
        return task;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async completeTask(id: string) {
      this.errorMessage = null;
      try {
        const result = await api.completeTask(id);
        await this.loadTasks();
        return result;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async deleteTask(id: string) {
      this.errorMessage = null;
      try {
        const result = await api.deleteTask(id);
        await this.loadTasks({ includeDeleted: true });
        if (result) {
          replaceById(this.tasks, result);
        }
        return requireDeleted(result, this.tasks, id);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async restoreTask(id: string) {
      this.errorMessage = null;
      try {
        const result = await api.restoreTask(id);
        await this.loadTasks({ includeDeleted: true });
        return result;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async createReminder(input: {
      note?: string | null;
      recurrence?: {
        dayOfMonth?: number;
        interval?: number;
        until?: string | null;
        weekdays?: number[];
      } | null;
      scheduleType: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
      startsAt: string;
      title: string;
    }) {
      this.errorMessage = null;
      try {
        const reminder = await api.createReminder(input);
        await this.loadReminders();
        return reminder;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async updateReminder(
      id: string,
      input: {
        note?: string | null;
        recurrence?: {
          dayOfMonth?: number;
          interval?: number;
          until?: string | null;
          weekdays?: number[];
        } | null;
        scheduleType?: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
        startsAt?: string;
        status?: ReminderStatus;
        title?: string;
        version: number;
      },
    ) {
      this.errorMessage = null;
      try {
        const reminder = await api.updateReminder(id, input);
        await this.loadReminders();
        return reminder;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async deleteReminder(id: string) {
      this.errorMessage = null;
      try {
        const result = await api.deleteReminder(id);
        await this.loadReminders({ includeDeleted: true });
        if (result) {
          replaceById(this.reminders, result);
        }
        return requireDeleted(result, this.reminders, id);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async restoreReminder(id: string) {
      this.errorMessage = null;
      try {
        const result = await api.restoreReminder(id);
        await this.loadReminders({ includeDeleted: true });
        return result;
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    clearError() {
      this.errorKind = null;
      this.errorMessage = null;
    },
  },
});

type ReminderStatus =
  "SCHEDULED" | "SENT" | "CANCELLED" | "FAILED" | "SUPPRESSED";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}

function replaceById<T extends { id: string }>(items: T[], updated: T) {
  const index = items.findIndex((item) => item.id === updated.id);
  if (index >= 0) {
    items.splice(index, 1, updated);
  } else {
    items.push(updated);
  }
}

function requireDeleted<T extends { deletedAt: string | null; id: string }>(
  result: T | undefined,
  items: T[],
  id: string,
): T {
  const deleted = result ?? items.find((item) => item.id === id);
  if (!deleted?.deletedAt) {
    throw new Error("删除已提交，但暂时无法读取最新状态，请重试");
  }
  return deleted;
}

function filterCalendarLocals(
  items: CalendarEventSummary[],
  date?: string,
): CalendarEventSummary[] {
  if (!date) {
    return items;
  }
  const bounds = calendarDayBounds(date);
  return items.filter(
    (item) => item.startsAt < bounds.end && item.endsAt > bounds.start,
  );
}

function calendarDayBounds(date: string): { start: string; end: string } {
  const parts = date.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const start = new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000);
  return {
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    start: start.toISOString(),
  };
}
