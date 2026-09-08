import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  api,
  type CalendarEventSummary,
  type ReminderSummary,
} from "../api/client";
import { usePlannerStore } from "./planner";

function calendarEvent(
  overrides: Partial<CalendarEventSummary> = {},
): CalendarEventSummary {
  return {
    allDay: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    deletedAt: null,
    endsAt: "2026-08-30T03:00:00.000Z",
    id: "event-1",
    startsAt: "2026-08-30T02:00:00.000Z",
    status: "SCHEDULED",
    title: "产品评审",
    updatedAt: "2026-08-29T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function reminder(overrides: Partial<ReminderSummary> = {}): ReminderSummary {
  return {
    attemptCount: 0,
    createdAt: "2026-08-29T00:00:00.000Z",
    deletedAt: null,
    failureReason: null,
    id: "reminder-1",
    note: "",
    recurrence: null,
    scheduleType: "ONCE",
    scheduledAt: "2026-08-30T02:00:00.000Z",
    sentAt: null,
    status: "SCHEDULED",
    suppressedAt: null,
    targetId: null,
    targetType: "STANDALONE",
    title: "提交报销",
    updatedAt: "2026-08-29T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

describe("planner delete actions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it("keeps the server calendar tombstone in the shared store", async () => {
    const deleted = calendarEvent({
      deletedAt: "2026-08-29T05:06:07.000Z",
      updatedAt: "2026-08-29T05:06:07.000Z",
      version: 3,
    });
    vi.spyOn(api, "deleteCalendarEvent").mockResolvedValue(deleted);
    vi.spyOn(api, "listCalendarEvents").mockResolvedValue({
      items: [deleted],
      nextCursor: null,
    });

    const planner = usePlannerStore();
    const result = await planner.deleteCalendarEvent("event-1");

    expect(result).toEqual(deleted);
    expect(planner.calendarEvents).toEqual([deleted]);
  });

  it("keeps the server reminder tombstone in the shared store", async () => {
    const deleted = reminder({
      deletedAt: "2026-08-29T06:07:08.000Z",
      updatedAt: "2026-08-29T06:07:08.000Z",
      version: 4,
    });
    vi.spyOn(api, "deleteReminder").mockResolvedValue(deleted);
    vi.spyOn(api, "listReminders").mockResolvedValue({
      items: [deleted],
      nextCursor: null,
    });

    const planner = usePlannerStore();
    const result = await planner.deleteReminder("reminder-1");

    expect(result).toEqual(deleted);
    expect(planner.reminders).toEqual([deleted]);
  });

  it("reuses the active list filters when a sync refreshes planner data", async () => {
    vi.spyOn(api, "listTasks").mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    const planner = usePlannerStore();

    await planner.loadTasks({ includeDeleted: true, status: "CANCELLED" });
    await planner.refreshForSync(["TASK"]);

    expect(api.listTasks).toHaveBeenNthCalledWith(2, {
      includeDeleted: true,
      status: "CANCELLED",
    });
  });
});
