import { defineStore } from "pinia";

import {
  api,
  isOfflineError,
  type CalendarEventSummary,
  type ReminderSummary,
  type TaskSummary,
} from "../api/client";
import { localList, mergePending } from "../offline/local";
import { useAuthStore } from "./auth";

interface PlannerState {
  calendarEvents: CalendarEventSummary[];
  errorMessage: string | null;
  reminders: ReminderSummary[];
  tasks: TaskSummary[];
}

export const usePlannerStore = defineStore("planner", {
  state: (): PlannerState => ({
    calendarEvents: [],
    errorMessage: null,
    reminders: [],
    tasks: [],
  }),
  getters: {
    openTasks: (state) => state.tasks.filter((task) => task.status === "OPEN"),
    scheduledReminders: (state) =>
      state.reminders.filter((reminder) => reminder.status === "SCHEDULED"),
  },
  actions: {
    async loadCalendarEvents(
      params: {
        date?: string;
        includeDeleted?: boolean;
        month?: string;
        status?: "SCHEDULED" | "CANCELLED";
      } = {},
    ) {
      this.errorMessage = null;
      try {
        const result = await api.listCalendarEvents(params);
        const userId = useAuthStore().userId;
        this.calendarEvents = userId
          ? mergePending(
              result.items,
              (await localList(
                userId,
                "CALENDAR_EVENT",
              )) as unknown as CalendarEventSummary[],
            )
          : result.items;
      } catch (error) {
        if (isOfflineError(error)) {
          const userId = useAuthStore().userId;
          this.calendarEvents = userId
            ? ((await localList(
                userId,
                "CALENDAR_EVENT",
              )) as unknown as CalendarEventSummary[])
            : [];
        } else {
          this.errorMessage = messageOf(error);
        }
      }
    },
    async loadTasks(
      params: {
        includeDeleted?: boolean;
        status?: "OPEN" | "COMPLETED" | "CANCELLED";
      } = {},
    ) {
      this.errorMessage = null;
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
          this.errorMessage = messageOf(error);
        }
      }
    },
    async loadReminders(
      params: {
        includeDeleted?: boolean;
        status?: "SCHEDULED" | "SENT" | "CANCELLED" | "FAILED" | "SUPPRESSED";
      } = {},
    ) {
      this.errorMessage = null;
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
          this.errorMessage = messageOf(error);
        }
      }
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
        await api.deleteCalendarEvent(id);
        await this.loadCalendarEvents({ includeDeleted: true });
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async restoreCalendarEvent(id: string) {
      this.errorMessage = null;
      try {
        await api.restoreCalendarEvent(id);
        await this.loadCalendarEvents({ includeDeleted: true });
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
        await api.deleteTask(id);
        await this.loadTasks({ includeDeleted: true });
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async restoreTask(id: string) {
      this.errorMessage = null;
      try {
        await api.restoreTask(id);
        await this.loadTasks({ includeDeleted: true });
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
        await api.deleteReminder(id);
        await this.loadReminders({ includeDeleted: true });
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async restoreReminder(id: string) {
      this.errorMessage = null;
      try {
        await api.restoreReminder(id);
        await this.loadReminders({ includeDeleted: true });
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

type ReminderStatus =
  "SCHEDULED" | "SENT" | "CANCELLED" | "FAILED" | "SUPPRESSED";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
