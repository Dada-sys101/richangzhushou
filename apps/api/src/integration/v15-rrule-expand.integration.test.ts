import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  Prisma,
  PrismaClient,
  type ReminderScheduleType,
} from "../generated/prisma/client.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDb = testDatabaseUrl ? describe : describe.skip;

interface TableInfo {
  tableName: string;
}

interface ColumnInfo {
  columnName: string;
  columnType: string;
  isNullable: string;
  tableName: string;
}

interface ForeignKeyInfo {
  columnName: string;
  constraintName: string;
  referencedColumnName: string;
  referencedTableName: string;
  tableName: string;
}

describeWithDb("V1.5 PR1 RRULE expand schema", () => {
  let prisma: PrismaClient;
  let sequence = 0;

  beforeAll(() => {
    if (!testDatabaseUrl) {
      return;
    }
    prisma = new PrismaClient({
      adapter: new PrismaMariaDb(testDatabaseUrl),
    });
  });

  beforeEach(async () => {
    sequence += 1;
    await prisma.user.deleteMany({
      where: { username: { startsWith: "v15_rrule_" } },
    });
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }
    await prisma.user.deleteMany({
      where: { username: { startsWith: "v15_rrule_" } },
    });
    await prisma.$disconnect();
  });

  it("creates both expand tables, enum columns, foreign keys, and retains legacy reminder columns", async () => {
    const tables = await prisma.$queryRaw<TableInfo[]>`
      SELECT TABLE_NAME AS tableName
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'reminder_recurrence_rules',
          'reminder_recurrence_exceptions'
        )
      ORDER BY TABLE_NAME
    `;
    expect(tables.map((row) => row.tableName)).toEqual([
      "reminder_recurrence_exceptions",
      "reminder_recurrence_rules",
    ]);

    const columns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT
        TABLE_NAME AS tableName,
        COLUMN_NAME AS columnName,
        COLUMN_TYPE AS columnType,
        IS_NULLABLE AS isNullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'reminders',
          'reminder_recurrence_rules',
          'reminder_recurrence_exceptions'
        )
    `;
    const byColumn = new Map(
      columns.map((row) => [`${row.tableName}.${row.columnName}`, row]),
    );

    expect(
      byColumn.get("reminder_recurrence_rules.engine")?.columnType,
    ).toContain("'RRULE_TEMPORAL'");
    expect(
      byColumn.get("reminder_recurrence_rules.time_mode")?.columnType,
    ).toContain("'WALL_CLOCK','ABSOLUTE_INSTANT'");
    const backfillType =
      byColumn.get("reminder_recurrence_rules.backfill_status")?.columnType ??
      "";
    for (const value of [
      "NOT_REQUIRED",
      "PENDING",
      "COMPLETED",
      "MISMATCH",
      "FAILED",
    ]) {
      expect(backfillType).toContain(`'${value}'`);
    }
    expect(
      byColumn.get("reminder_recurrence_exceptions.exception_type")?.columnType,
    ).toContain("'CANCEL','REPLACE'");

    expect(
      byColumn.get("reminder_recurrence_rules.schema_version")?.columnType,
    ).toBe("smallint");
    expect(
      byColumn.get("reminder_recurrence_rules.canonical_hash")?.columnType,
    ).toBe("char(64)");
    expect(
      byColumn.get("reminder_recurrence_rules.dtstart_local")?.isNullable,
    ).toBe("YES");
    expect(
      byColumn.get("reminder_recurrence_exceptions.replacement_payload_json")
        ?.isNullable,
    ).toBe("YES");

    for (const legacyColumn of [
      "schedule_type",
      "recurrence_json",
      "starts_at",
      "scheduled_at",
    ]) {
      expect(byColumn.has(`reminders.${legacyColumn}`)).toBe(true);
    }

    const foreignKeys = await prisma.$queryRaw<ForeignKeyInfo[]>`
      SELECT
        TABLE_NAME AS tableName,
        COLUMN_NAME AS columnName,
        CONSTRAINT_NAME AS constraintName,
        REFERENCED_TABLE_NAME AS referencedTableName,
        REFERENCED_COLUMN_NAME AS referencedColumnName
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME IN (
          'rrule_reminder_id_fkey',
          'rrule_parent_rule_id_fkey',
          'rrule_exception_rule_id_fkey'
        )
      ORDER BY CONSTRAINT_NAME
    `;
    expect(foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columnName: "reminder_id",
          constraintName: "rrule_reminder_id_fkey",
          referencedColumnName: "id",
          referencedTableName: "reminders",
          tableName: "reminder_recurrence_rules",
        }),
        expect.objectContaining({
          columnName: "parent_rule_id",
          constraintName: "rrule_parent_rule_id_fkey",
          referencedColumnName: "id",
          referencedTableName: "reminder_recurrence_rules",
          tableName: "reminder_recurrence_rules",
        }),
        expect.objectContaining({
          columnName: "recurrence_rule_id",
          constraintName: "rrule_exception_rule_id_fkey",
          referencedColumnName: "id",
          referencedTableName: "reminder_recurrence_rules",
        }),
      ]),
    );
  });

  it("keeps a legacy reminder valid without a new rule and preserves its scalar fields", async () => {
    const user = await createUser();
    const reminder = await createLegacyReminder(user.id, "DAILY");
    const before = legacySnapshot(reminder);

    const loaded = await prisma.reminder.findUniqueOrThrow({
      include: { recurrenceRule: true },
      where: { id: reminder.id },
    });

    expect(loaded.recurrenceRule).toBeNull();
    expect(legacySnapshot(loaded)).toEqual(before);
  });

  it("writes and queries WALL_CLOCK and ABSOLUTE_INSTANT rules through the Reminder relation", async () => {
    const user = await createUser();
    const wallReminder = await createLegacyReminder(user.id, "DAILY");
    const absoluteReminder = await createLegacyReminder(user.id, "WEEKLY");

    const wallRule = await prisma.reminderRecurrenceRule.create({
      data: {
        backfillStatus: "PENDING",
        canonicalHash: "a".repeat(64),
        dtstartInstant: new Date("2026-08-10T00:00:00.000Z"),
        dtstartLocal: new Date("2026-08-10T08:00:00.000Z"),
        engine: "RRULE_TEMPORAL",
        reminderId: wallReminder.id,
        rruleText: "FREQ=DAILY;INTERVAL=1",
        schemaVersion: 1,
        timeMode: "WALL_CLOCK",
        timeZoneId: "Asia/Shanghai",
      },
    });
    const absoluteRule = await prisma.reminderRecurrenceRule.create({
      data: {
        backfillStatus: "NOT_REQUIRED",
        canonicalHash: "b".repeat(64),
        dtstartInstant: new Date("2026-08-11T00:00:00.000Z"),
        dtstartLocal: null,
        engine: "RRULE_TEMPORAL",
        reminderId: absoluteReminder.id,
        rruleText: "FREQ=WEEKLY;INTERVAL=1",
        schemaVersion: 1,
        timeMode: "ABSOLUTE_INSTANT",
        timeZoneId: "UTC",
      },
    });

    const wallLoaded = await prisma.reminder.findUniqueOrThrow({
      include: { recurrenceRule: true },
      where: { id: wallReminder.id },
    });
    const absoluteLoaded = await prisma.reminder.findUniqueOrThrow({
      include: { recurrenceRule: true },
      where: { id: absoluteReminder.id },
    });

    expect(wallLoaded.recurrenceRule).toMatchObject({
      canonicalHash: "a".repeat(64),
      engine: "RRULE_TEMPORAL",
      id: wallRule.id,
      reminderId: wallReminder.id,
      timeMode: "WALL_CLOCK",
      timeZoneId: "Asia/Shanghai",
    });
    expect(wallLoaded.recurrenceRule?.dtstartLocal?.toISOString()).toBe(
      "2026-08-10T08:00:00.000Z",
    );
    expect(absoluteLoaded.recurrenceRule).toMatchObject({
      id: absoluteRule.id,
      timeMode: "ABSOLUTE_INSTANT",
      timeZoneId: "UTC",
    });
    expect(absoluteLoaded.recurrenceRule?.dtstartLocal).toBeNull();
  });

  it("stores CANCEL/REPLACE exceptions and enforces stable occurrence uniqueness", async () => {
    const user = await createUser();
    const reminder = await createLegacyReminder(user.id, "DAILY");
    const rule = await createWallClockRule(reminder.id, "c");

    const cancel = await prisma.reminderRecurrenceException.create({
      data: {
        exceptionType: "CANCEL",
        occurrenceKey: "2026-08-12T08:00:00[Asia/Shanghai]",
        originalOccurrenceAt: new Date("2026-08-12T00:00:00.000Z"),
        recurrenceRuleId: rule.id,
      },
    });
    const replace = await prisma.reminderRecurrenceException.create({
      data: {
        exceptionType: "REPLACE",
        occurrenceKey: "2026-08-13T08:00:00[Asia/Shanghai]",
        originalOccurrenceAt: new Date("2026-08-13T00:00:00.000Z"),
        recurrenceRuleId: rule.id,
        replacementInstantAt: new Date("2026-08-13T01:30:00.000Z"),
        replacementLocalAt: new Date("2026-08-13T09:30:00.000Z"),
        replacementPayloadJson: { note: "延后九十分钟" },
        replacementTimeZoneId: "Asia/Shanghai",
      },
    });

    const loaded = await prisma.reminderRecurrenceRule.findUniqueOrThrow({
      include: {
        exceptions: { orderBy: { occurrenceKey: "asc" } },
      },
      where: { id: rule.id },
    });
    expect(loaded.exceptions).toHaveLength(2);
    expect(loaded.exceptions[0]).toMatchObject({
      exceptionType: "CANCEL",
      id: cancel.id,
    });
    expect(loaded.exceptions[1]).toMatchObject({
      exceptionType: "REPLACE",
      id: replace.id,
      replacementTimeZoneId: "Asia/Shanghai",
    });

    await expect(
      prisma.reminderRecurrenceException.create({
        data: {
          exceptionType: "CANCEL",
          occurrenceKey: cancel.occurrenceKey,
          originalOccurrenceAt: cancel.originalOccurrenceAt,
          recurrenceRuleId: rule.id,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces one rule per Reminder and validates both foreign-key boundaries", async () => {
    const user = await createUser();
    const reminder = await createLegacyReminder(user.id, "DAILY");
    await createWallClockRule(reminder.id, "d");

    await expect(createWallClockRule(reminder.id, "e")).rejects.toMatchObject({
      code: "P2002",
    });

    await expect(
      createWallClockRule("missing_reminder", "f"),
    ).rejects.toMatchObject({ code: "P2003" });

    await expect(
      prisma.reminderRecurrenceException.create({
        data: {
          exceptionType: "CANCEL",
          occurrenceKey: "missing-rule-occurrence",
          originalOccurrenceAt: new Date("2026-08-14T00:00:00.000Z"),
          recurrenceRuleId: "missing_rule",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("supports series splitting through the self relation", async () => {
    const user = await createUser();
    const parentReminder = await createLegacyReminder(user.id, "DAILY");
    const childReminder = await createLegacyReminder(user.id, "DAILY");
    const parent = await createWallClockRule(parentReminder.id, "1");
    const child = await prisma.reminderRecurrenceRule.create({
      data: {
        backfillStatus: "PENDING",
        canonicalHash: "2".repeat(64),
        dtstartInstant: new Date("2026-09-01T00:00:00.000Z"),
        dtstartLocal: new Date("2026-09-01T08:00:00.000Z"),
        engine: "RRULE_TEMPORAL",
        parentRuleId: parent.id,
        reminderId: childReminder.id,
        rruleText: "FREQ=DAILY;INTERVAL=2",
        schemaVersion: 1,
        splitFromOccurrenceKey: "2026-09-01T08:00:00[Asia/Shanghai]",
        timeMode: "WALL_CLOCK",
        timeZoneId: "Asia/Shanghai",
      },
    });

    const loadedParent = await prisma.reminderRecurrenceRule.findUniqueOrThrow({
      include: { childRules: true },
      where: { id: parent.id },
    });
    const loadedChild = await prisma.reminderRecurrenceRule.findUniqueOrThrow({
      include: { parentRule: true },
      where: { id: child.id },
    });

    expect(loadedParent.childRules.map((row) => row.id)).toEqual([child.id]);
    expect(loadedChild.parentRule?.id).toBe(parent.id);
    expect(loadedChild.splitFromOccurrenceKey).toBe(
      "2026-09-01T08:00:00[Asia/Shanghai]",
    );
  });

  it("cascades Reminder→Rule→Exception and Rule→Exception deletes", async () => {
    const user = await createUser();
    const reminder = await createLegacyReminder(user.id, "DAILY");
    const rule = await createWallClockRule(reminder.id, "3");
    const exception = await prisma.reminderRecurrenceException.create({
      data: {
        exceptionType: "CANCEL",
        occurrenceKey: "cascade-occurrence",
        originalOccurrenceAt: new Date("2026-08-15T00:00:00.000Z"),
        recurrenceRuleId: rule.id,
      },
    });

    await prisma.reminder.delete({ where: { id: reminder.id } });
    expect(
      await prisma.reminderRecurrenceRule.findUnique({
        where: { id: rule.id },
      }),
    ).toBeNull();
    expect(
      await prisma.reminderRecurrenceException.findUnique({
        where: { id: exception.id },
      }),
    ).toBeNull();

    const secondReminder = await createLegacyReminder(user.id, "DAILY");
    const secondRule = await createWallClockRule(secondReminder.id, "4");
    const secondException = await prisma.reminderRecurrenceException.create({
      data: {
        exceptionType: "CANCEL",
        occurrenceKey: "rule-cascade-occurrence",
        originalOccurrenceAt: new Date("2026-08-16T00:00:00.000Z"),
        recurrenceRuleId: secondRule.id,
      },
    });

    await prisma.reminderRecurrenceRule.delete({
      where: { id: secondRule.id },
    });
    expect(
      await prisma.reminderRecurrenceException.findUnique({
        where: { id: secondException.id },
      }),
    ).toBeNull();
    expect(
      await prisma.reminder.findUnique({
        where: { id: secondReminder.id },
      }),
    ).not.toBeNull();
  });

  async function createUser() {
    const username = `v15_rrule_${sequence}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    return prisma.user.create({
      data: {
        displayName: "V1.5 RRULE Test",
        normalizedUsername: username,
        passwordHash: "test-only-not-a-real-password-hash",
        role: "USER",
        status: "ACTIVE",
        username,
      },
    });
  }

  async function createLegacyReminder(
    userId: string,
    scheduleType: ReminderScheduleType,
  ) {
    const recurring = scheduleType !== "ONCE";
    return prisma.reminder.create({
      data: {
        recurrenceJson: recurring
          ? ({ interval: 1 } satisfies Prisma.InputJsonValue)
          : Prisma.DbNull,
        scheduleType,
        scheduledAt: new Date("2099-01-01T08:00:00.000Z"),
        startsAt: new Date("2099-01-01T08:00:00.000Z"),
        status: "SCHEDULED",
        targetType: "STANDALONE",
        title: `Legacy ${scheduleType}`,
        userId,
      },
    });
  }

  function createWallClockRule(reminderId: string, hashCharacter: string) {
    return prisma.reminderRecurrenceRule.create({
      data: {
        backfillStatus: "PENDING",
        canonicalHash: hashCharacter.repeat(64),
        dtstartInstant: new Date("2026-08-10T00:00:00.000Z"),
        dtstartLocal: new Date("2026-08-10T08:00:00.000Z"),
        engine: "RRULE_TEMPORAL",
        reminderId,
        rruleText: "FREQ=DAILY;INTERVAL=1",
        schemaVersion: 1,
        timeMode: "WALL_CLOCK",
        timeZoneId: "Asia/Shanghai",
      },
    });
  }

  function legacySnapshot(reminder: {
    recurrenceJson: unknown;
    scheduleType: ReminderScheduleType;
    scheduledAt: Date;
    startsAt: Date;
    status: string;
    targetId: string | null;
    targetType: string;
    title: string;
    version: number;
  }) {
    return {
      recurrenceJson: reminder.recurrenceJson,
      scheduleType: reminder.scheduleType,
      scheduledAt: reminder.scheduledAt.toISOString(),
      startsAt: reminder.startsAt.toISOString(),
      status: reminder.status,
      targetId: reminder.targetId,
      targetType: reminder.targetType,
      title: reminder.title,
      version: reminder.version,
    };
  }
});
