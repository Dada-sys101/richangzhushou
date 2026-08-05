import { describe, expect, it } from "vitest";

import {
  nextOccurrence,
  normalizeRecurrence,
  weekdayOf,
} from "./recurrence.util.js";

const MORNING = "T01:00:00.000Z";

describe("reminder recurrence util", () => {
  it("rejects recurrence on ONCE reminders and past ONCE starts", () => {
    const startsAt = new Date(`2026-08-10${MORNING}`);
    expect(() =>
      normalizeRecurrence("ONCE", { interval: 1 }, startsAt),
    ).toThrowError(/ONCE reminders cannot have a recurrence rule/);

    const normalized = normalizeRecurrence("ONCE", null, startsAt);
    expect(
      nextOccurrence(
        "ONCE",
        normalized,
        new Date(startsAt.getTime() + 1000),
        startsAt,
      ),
    ).toBeNull();
    expect(
      nextOccurrence(
        "ONCE",
        normalized,
        new Date(startsAt.getTime() - 1000),
        startsAt,
      )?.toISOString(),
    ).toBe(startsAt.toISOString());
  });

  it("computes daily occurrences with an interval in Asia/Shanghai", () => {
    const startsAt = new Date(`2026-08-05${MORNING}`);
    const normalized = normalizeRecurrence("DAILY", { interval: 2 }, startsAt);
    const after = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
    expect(
      nextOccurrence("DAILY", normalized, after, startsAt)?.toISOString(),
    ).toBe(new Date(`2026-08-07${MORNING}`).toISOString());
  });

  it("picks the next matching weekday for weekly reminders", () => {
    const monday = new Date(`2026-08-03${MORNING}`);
    expect(weekdayOf(monday)).toBe(1);
    const normalized = normalizeRecurrence(
      "WEEKLY",
      { interval: 2, weekdays: [3, 5] },
      monday,
    );
    expect(
      nextOccurrence(
        "WEEKLY",
        normalized,
        new Date(`2026-08-03T02:00:00.000Z`),
        monday,
      )?.toISOString(),
    ).toBe(new Date(`2026-08-05${MORNING}`).toISOString());
    expect(
      nextOccurrence(
        "WEEKLY",
        normalized,
        new Date(`2026-08-05T02:00:00.000Z`),
        monday,
      )?.toISOString(),
    ).toBe(new Date(`2026-08-07${MORNING}`).toISOString());
    expect(
      nextOccurrence(
        "WEEKLY",
        normalized,
        new Date(`2026-08-07T02:00:00.000Z`),
        monday,
      )?.toISOString(),
    ).toBe(new Date(`2026-08-19${MORNING}`).toISOString());
  });

  it("clamps monthly reminders to the last day of the month", () => {
    const january31 = new Date(`2026-01-31${MORNING}`);
    const normalized = normalizeRecurrence(
      "MONTHLY",
      { dayOfMonth: 31 },
      january31,
    );
    expect(
      nextOccurrence(
        "MONTHLY",
        normalized,
        new Date(`2026-02-01T02:00:00.000Z`),
        january31,
      )?.toISOString(),
    ).toBe(new Date(`2026-02-28${MORNING}`).toISOString());
    expect(
      nextOccurrence(
        "MONTHLY",
        normalized,
        new Date(`2026-03-01T02:00:00.000Z`),
        january31,
      )?.toISOString(),
    ).toBe(new Date(`2026-03-31${MORNING}`).toISOString());
  });

  it("respects the until boundary", () => {
    const startsAt = new Date(`2026-08-05${MORNING}`);
    const until = new Date(`2026-08-06${MORNING}`);
    const normalized = normalizeRecurrence(
      "DAILY",
      { until: until.toISOString() },
      startsAt,
    );
    expect(
      nextOccurrence(
        "DAILY",
        normalized,
        new Date(`2026-08-05T02:00:00.000Z`),
        startsAt,
      )?.toISOString(),
    ).toBe(new Date(`2026-08-06${MORNING}`).toISOString());
    expect(
      nextOccurrence(
        "DAILY",
        normalized,
        new Date(`2026-08-06T02:00:00.000Z`),
        startsAt,
      ),
    ).toBeNull();
  });

  it("rejects invalid schedule/recurrence combinations", () => {
    const startsAt = new Date(`2026-08-05${MORNING}`);
    expect(() =>
      normalizeRecurrence("DAILY", { weekdays: [1] }, startsAt),
    ).toThrowError(/DAILY reminders only support interval and until/);
    expect(() =>
      normalizeRecurrence("WEEKLY", { dayOfMonth: 5 }, startsAt),
    ).toThrowError(/WEEKLY reminders do not support dayOfMonth/);
    expect(() =>
      normalizeRecurrence("MONTHLY", { weekdays: [1] }, startsAt),
    ).toThrowError(/MONTHLY reminders do not support weekdays/);
  });
});
