import { describe, expect, it } from "vitest";

import {
  anonymousUsername,
  deletionScheduledAt,
  loadAccountDeletionConfig,
} from "./account-deletion.config.js";

describe("account deletion configuration", () => {
  it("applies safe defaults", () => {
    const config = loadAccountDeletionConfig({});
    expect(config).toEqual({
      batchSize: 20,
      leaseMs: 600_000,
      maxAttempts: 5,
      retentionDays: 30,
    });
  });

  it("parses configured values", () => {
    const config = loadAccountDeletionConfig({
      ACCOUNT_DELETION_BATCH_SIZE: "10",
      ACCOUNT_DELETION_LEASE_SECONDS: "120",
      ACCOUNT_DELETION_MAX_ATTEMPTS: "3",
      ACCOUNT_DELETION_RETENTION_DAYS: "7",
    });
    expect(config).toEqual({
      batchSize: 10,
      leaseMs: 120_000,
      maxAttempts: 3,
      retentionDays: 7,
    });
  });

  it("falls back when values are invalid", () => {
    const config = loadAccountDeletionConfig({
      ACCOUNT_DELETION_BATCH_SIZE: "0",
      ACCOUNT_DELETION_LEASE_SECONDS: "abc",
      ACCOUNT_DELETION_MAX_ATTEMPTS: "-1",
      ACCOUNT_DELETION_RETENTION_DAYS: "",
    });
    expect(config).toEqual({
      batchSize: 20,
      leaseMs: 600_000,
      maxAttempts: 5,
      retentionDays: 30,
    });
  });

  it("computes the scheduled deletion time from the retention window", () => {
    const now = new Date("2026-08-06T00:00:00.000Z");
    const scheduled = deletionScheduledAt(now, {
      ACCOUNT_DELETION_RETENTION_DAYS: "30",
    });
    expect(scheduled.toISOString()).toBe("2026-09-05T00:00:00.000Z");
  });

  it("generates unique anonymous usernames without business meaning", () => {
    const first = anonymousUsername();
    const second = anonymousUsername();
    expect(first).toMatch(/^deleted_[0-9a-f]{32}$/);
    expect(first).not.toBe(second);
  });
});
