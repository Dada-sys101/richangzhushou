import type {
  ReminderRecurrence,
  ReminderSummary,
} from "@daily-assistant/api-contracts";

import type { Reminder } from "../generated/prisma/client.js";

export function toReminderSummary(row: Reminder): ReminderSummary {
  const recurrence = reminderRecurrenceFromJson(row.recurrenceJson);
  return {
    attemptCount: row.attemptCount,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    failureReason: row.failureReason,
    id: row.id,
    note: row.note,
    recurrence,
    scheduleType: row.scheduleType,
    scheduledAt: row.scheduledAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    status: row.status,
    suppressedAt: row.suppressedAt?.toISOString() ?? null,
    targetId: row.targetId,
    targetType: row.targetType,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export function reminderRecurrenceFromJson(
  json: unknown,
): ReminderRecurrence | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const value = json as Record<string, unknown>;
  return {
    ...(typeof value.interval === "number" ? { interval: value.interval } : {}),
    ...(Array.isArray(value.weekdays)
      ? { weekdays: value.weekdays as number[] }
      : {}),
    ...(typeof value.dayOfMonth === "number"
      ? { dayOfMonth: value.dayOfMonth }
      : {}),
    ...(typeof value.until === "string" ? { until: value.until } : {}),
  };
}
