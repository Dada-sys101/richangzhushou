import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../generated/prisma/client.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDb = testDatabaseUrl ? describe : describe.skip;

// PR1 requires this suite to run against real MySQL in CI.
describeWithDb("V1.5 PR1 parent Rule SET NULL", () => {
  let prisma: PrismaClient;
  const usernamePrefix = "v15_set_null_";

  beforeAll(() => {
    if (!testDatabaseUrl) {
      return;
    }

    prisma = new PrismaClient({
      adapter: new PrismaMariaDb(testDatabaseUrl),
    });
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await prisma.user.deleteMany({
      where: { username: { startsWith: usernamePrefix } },
    });
    await prisma.$disconnect();
  });

  it("keeps the child Rule, sets parentRuleId to NULL, and matches the orphan predicate", async () => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const username = `${usernamePrefix}${uniqueSuffix}`;

    const user = await prisma.user.create({
      data: {
        displayName: "V1.5 SET NULL Test",
        normalizedUsername: username,
        passwordHash: "test-only-not-a-real-password-hash",
        role: "USER",
        status: "ACTIVE",
        username,
      },
    });

    const parentReminder = await prisma.reminder.create({
      data: {
        recurrenceJson: { interval: 1 },
        scheduleType: "DAILY",
        scheduledAt: new Date("2099-01-01T08:00:00.000Z"),
        startsAt: new Date("2099-01-01T08:00:00.000Z"),
        status: "SCHEDULED",
        targetType: "STANDALONE",
        title: "Parent series",
        userId: user.id,
      },
    });

    const childReminder = await prisma.reminder.create({
      data: {
        recurrenceJson: { interval: 2 },
        scheduleType: "DAILY",
        scheduledAt: new Date("2099-02-01T08:00:00.000Z"),
        startsAt: new Date("2099-02-01T08:00:00.000Z"),
        status: "SCHEDULED",
        targetType: "STANDALONE",
        title: "Child series",
        userId: user.id,
      },
    });

    const parentRule = await prisma.reminderRecurrenceRule.create({
      data: {
        backfillStatus: "PENDING",
        canonicalHash: "p".repeat(64),
        dtstartInstant: new Date("2026-08-10T00:00:00.000Z"),
        dtstartLocal: new Date("2026-08-10T08:00:00.000Z"),
        engine: "RRULE_TEMPORAL",
        reminderId: parentReminder.id,
        rruleText: "FREQ=DAILY;INTERVAL=1",
        schemaVersion: 1,
        timeMode: "WALL_CLOCK",
        timeZoneId: "Asia/Shanghai",
      },
    });

    const splitFromOccurrenceKey = "2026-09-01T08:00:00[Asia/Shanghai]";
    const childRule = await prisma.reminderRecurrenceRule.create({
      data: {
        backfillStatus: "PENDING",
        canonicalHash: "c".repeat(64),
        dtstartInstant: new Date("2026-09-01T00:00:00.000Z"),
        dtstartLocal: new Date("2026-09-01T08:00:00.000Z"),
        engine: "RRULE_TEMPORAL",
        parentRuleId: parentRule.id,
        reminderId: childReminder.id,
        rruleText: "FREQ=DAILY;INTERVAL=2",
        schemaVersion: 1,
        splitFromOccurrenceKey,
        timeMode: "WALL_CLOCK",
        timeZoneId: "Asia/Shanghai",
      },
    });

    await expect(
      prisma.reminderRecurrenceRule.delete({
        where: { id: parentRule.id },
      }),
    ).resolves.toMatchObject({ id: parentRule.id });

    const loadedChildRule =
      await prisma.reminderRecurrenceRule.findUniqueOrThrow({
        where: { id: childRule.id },
      });

    expect(loadedChildRule.parentRuleId).toBeNull();
    expect(loadedChildRule.splitFromOccurrenceKey).toBe(splitFromOccurrenceKey);

    expect(
      await prisma.reminder.findUnique({
        where: { id: childReminder.id },
      }),
    ).not.toBeNull();

    const orphanCandidates = await prisma.reminderRecurrenceRule.findMany({
      where: {
        id: childRule.id,
        parentRuleId: null,
        splitFromOccurrenceKey: { not: null },
      },
    });

    expect(orphanCandidates.map((rule) => rule.id)).toEqual([childRule.id]);
  });
});
