import type {
  ReminderRecurrence,
  ReminderScheduleType,
} from "@daily-assistant/api-contracts";

import { ApiException } from "../common/api-error.js";

const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface NormalizedRecurrence {
  dayOfMonth?: number;
  interval: number;
  until: Date | null;
  weekdays?: number[];
}

interface ShanghaiParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  ms: number;
  second: number;
  year: number;
}

export function normalizeRecurrence(
  scheduleType: ReminderScheduleType,
  recurrence: ReminderRecurrence | null | undefined,
  startsAt: Date,
): NormalizedRecurrence {
  const until = recurrence?.until ? new Date(recurrence.until) : null;
  if (scheduleType === "ONCE") {
    if (recurrence) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "ONCE reminders cannot have a recurrence rule",
      );
    }
    return { interval: 1, until: null };
  }
  const interval = recurrence?.interval ?? 1;
  if (scheduleType === "DAILY") {
    if (recurrence?.weekdays || recurrence?.dayOfMonth) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "DAILY reminders only support interval and until",
      );
    }
    return { interval, until };
  }
  if (scheduleType === "WEEKLY") {
    if (recurrence?.dayOfMonth) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "WEEKLY reminders do not support dayOfMonth",
      );
    }
    const weekdays = (
      recurrence?.weekdays?.length ? [...new Set(recurrence.weekdays)] : []
    )
      .sort((a, b) => a - b)
      .filter((value): value is number => Number.isInteger(value));
    if (weekdays.length === 0) {
      weekdays.push(weekdayOf(startsAt));
    }
    return { interval, until, weekdays };
  }
  if (scheduleType === "MONTHLY") {
    if (recurrence?.weekdays) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "MONTHLY reminders do not support weekdays",
      );
    }
    const dayOfMonth = recurrence?.dayOfMonth ?? dayOfMonthOf(startsAt);
    return { dayOfMonth, interval, until };
  }
  throw new Error("Unsupported reminder schedule type");
}

export function nextOccurrence(
  scheduleType: ReminderScheduleType,
  recurrence: NormalizedRecurrence,
  after: Date,
  startsAt: Date,
): Date | null {
  let candidate: Date | null;
  if (scheduleType === "ONCE") {
    candidate = startsAt.getTime() > after.getTime() ? startsAt : null;
  } else if (scheduleType === "DAILY") {
    candidate = nextDaily(recurrence, after, startsAt);
  } else if (scheduleType === "WEEKLY") {
    candidate = nextWeekly(recurrence, after, startsAt);
  } else {
    candidate = nextMonthly(recurrence, after, startsAt);
  }
  if (!candidate) {
    return null;
  }
  if (recurrence.until && candidate.getTime() > recurrence.until.getTime()) {
    return null;
  }
  return candidate;
}

export function weekdayOf(date: Date): number {
  const shifted = new Date(date.getTime() + SHANGHAI_UTC_OFFSET_MS);
  return ((shifted.getUTCDay() + 6) % 7) + 1;
}

export function dayOfMonthOf(date: Date): number {
  return shanghaiParts(date).day;
}

export function recurrenceToJson(
  recurrence: NormalizedRecurrence,
): Record<string, number | number[] | string> | null {
  const value: Record<string, number | number[] | string> = {
    interval: recurrence.interval,
  };
  if (recurrence.weekdays) {
    value.weekdays = recurrence.weekdays;
  }
  if (recurrence.dayOfMonth) {
    value.dayOfMonth = recurrence.dayOfMonth;
  }
  if (recurrence.until) {
    value.until = recurrence.until.toISOString();
  }
  return Object.keys(value).length > 0 ? value : null;
}

export function recurrenceFromRow(json: unknown): NormalizedRecurrence | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const value = json as Record<string, unknown>;
  return {
    dayOfMonth:
      typeof value.dayOfMonth === "number" ? value.dayOfMonth : undefined,
    interval: typeof value.interval === "number" ? value.interval : 1,
    until: typeof value.until === "string" ? new Date(value.until) : null,
    weekdays: Array.isArray(value.weekdays)
      ? (value.weekdays as number[])
      : undefined,
  };
}

function nextDaily(
  recurrence: NormalizedRecurrence,
  after: Date,
  startsAt: Date,
): Date | null {
  const intervalMs = recurrence.interval * DAY_MS;
  const diffMs = after.getTime() - startsAt.getTime();
  let steps = Math.max(0, Math.floor(diffMs / intervalMs) + 1);
  let candidate = new Date(startsAt.getTime() + steps * intervalMs);
  while (candidate.getTime() <= after.getTime()) {
    steps += 1;
    candidate = new Date(startsAt.getTime() + steps * intervalMs);
  }
  return candidate;
}

function nextWeekly(
  recurrence: NormalizedRecurrence,
  after: Date,
  startsAt: Date,
): Date | null {
  const weekdays = recurrence.weekdays ?? [weekdayOf(startsAt)];
  const spanWeeks =
    Math.max(
      0,
      Math.ceil(
        (after.getTime() - startsAt.getTime()) /
          (recurrence.interval * 7 * DAY_MS),
      ),
    ) + 1;
  for (let weekIndex = 0; weekIndex <= spanWeeks; weekIndex += 1) {
    const base = addShanghaiDays(startsAt, weekIndex * recurrence.interval * 7);
    for (let offset = 0; offset < 7; offset += 1) {
      const candidate = addShanghaiDays(base, offset);
      if (
        candidate.getTime() >= startsAt.getTime() &&
        candidate.getTime() > after.getTime() &&
        weekdays.includes(weekdayOf(candidate))
      ) {
        return candidate;
      }
    }
  }
  return null;
}

function nextMonthly(
  recurrence: NormalizedRecurrence,
  after: Date,
  startsAt: Date,
): Date | null {
  const start = shanghaiParts(startsAt);
  const afterParts = shanghaiParts(after);
  const monthDiff =
    (afterParts.year - start.year) * 12 + (afterParts.month - start.month);
  const dayOfMonth = recurrence.dayOfMonth ?? start.day;
  const firstIndex = Math.max(
    0,
    Math.floor(monthDiff / recurrence.interval) - 1,
  );
  for (let index = firstIndex; index <= firstIndex + 2; index += 1) {
    const months = start.month - 1 + index * recurrence.interval;
    const year = start.year + Math.floor(months / 12);
    const month = (months % 12) + 1;
    const day = Math.min(dayOfMonth, daysInMonth(year, month));
    const candidate = fromShanghaiParts({ ...start, day, month, year });
    if (
      candidate.getTime() >= startsAt.getTime() &&
      candidate.getTime() > after.getTime()
    ) {
      return candidate;
    }
  }
  return null;
}

function shanghaiParts(date: Date): ShanghaiParts {
  const shifted = new Date(date.getTime() + SHANGHAI_UTC_OFFSET_MS);
  return {
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    month: shifted.getUTCMonth() + 1,
    ms: shifted.getUTCMilliseconds(),
    second: shifted.getUTCSeconds(),
    year: shifted.getUTCFullYear(),
  };
}

function fromShanghaiParts(parts: ShanghaiParts): Date {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.ms,
    ) - SHANGHAI_UTC_OFFSET_MS,
  );
}

function addShanghaiDays(date: Date, days: number): Date {
  const parts = shanghaiParts(date);
  return fromShanghaiParts({ ...parts, day: parts.day + days });
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
