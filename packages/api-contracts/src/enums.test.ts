import { describe, expect, it } from "vitest";

import {
  ATTACHMENT_SCAN_STATUSES,
  CALENDAR_EVENT_STATUSES,
  RECORD_SOURCES,
  REMINDER_SCHEDULE_TYPES,
  REMINDER_TARGET_TYPES,
  SHORTCUT_SCOPES,
  USER_STATUSES,
} from "./enums.js";

describe("shared enums", () => {
  it("keeps capacity-occupying account states distinct", () => {
    expect(USER_STATUSES).toContain("ACTIVE");
    expect(USER_STATUSES).toContain("SUSPENDED");
    expect(USER_STATUSES).toContain("CLOSED");
  });

  it("keeps AI-assisted sources as record provenance", () => {
    expect(RECORD_SOURCES).toEqual([
      "MANUAL",
      "SHORTCUT",
      "OCR",
      "TEXT",
      "VOICE",
      "IMPORT",
    ]);
  });

  it("keeps WP4 shortcut scopes and attachment scan statuses stable", () => {
    expect(SHORTCUT_SCOPES).toEqual([
      "transaction:draft:create",
      "finance:summary:read",
    ]);
    expect(ATTACHMENT_SCAN_STATUSES).toEqual(["PENDING", "SCANNED", "FAILED"]);
  });

  it("keeps WP5 calendar, task, and reminder enums stable", () => {
    expect(CALENDAR_EVENT_STATUSES).toEqual(["SCHEDULED", "CANCELLED"]);
    expect(REMINDER_SCHEDULE_TYPES).toEqual([
      "ONCE",
      "DAILY",
      "WEEKLY",
      "MONTHLY",
    ]);
    expect(REMINDER_TARGET_TYPES).toEqual([
      "CALENDAR_EVENT",
      "TASK",
      "STANDALONE",
    ]);
  });
});
