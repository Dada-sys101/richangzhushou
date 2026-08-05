import { describe, expect, it } from "vitest";

import {
  currentMonth,
  dayBounds,
  isValidMonth,
  monthBounds,
  toZonedDay,
} from "./time.util.js";

describe("Asia/Shanghai time util", () => {
  it("computes natural month bounds in UTC", () => {
    const august = monthBounds("2026-08");
    expect(august.start.toISOString()).toBe("2026-07-31T16:00:00.000Z");
    expect(august.end.toISOString()).toBe("2026-08-31T16:00:00.000Z");
  });

  it("handles year boundaries", () => {
    const january = monthBounds("2026-01");
    expect(january.start.toISOString()).toBe("2025-12-31T16:00:00.000Z");
    expect(january.end.toISOString()).toBe("2026-01-31T16:00:00.000Z");
  });

  it("maps UTC instants to Shanghai calendar days", () => {
    expect(toZonedDay(new Date("2026-08-05T15:59:59.999Z"))).toBe("2026-08-05");
    expect(toZonedDay(new Date("2026-08-05T16:00:00.000Z"))).toBe("2026-08-06");
  });

  it("computes day bounds in UTC", () => {
    const day = dayBounds("2026-08-05");
    expect(day.start.toISOString()).toBe("2026-08-04T16:00:00.000Z");
    expect(day.end.toISOString()).toBe("2026-08-05T16:00:00.000Z");
  });

  it("rejects invalid months and accepts valid ones", () => {
    for (const bad of ["2026-13", "2026-00", "2026-1", "abcd", "26-08"]) {
      expect(isValidMonth(bad)).toBe(false);
    }
    expect(isValidMonth("2026-08")).toBe(true);
    expect(isValidMonth("2099-12")).toBe(true);
    expect(currentMonth()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });
});
