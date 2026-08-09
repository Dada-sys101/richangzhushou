import { afterEach, describe, expect, it, vi } from "vitest";

import { Prisma, type Reminder } from "../generated/prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { RemindersService } from "./reminders.service.js";

function createService(prisma: unknown): RemindersService {
  return new RemindersService(prisma as PrismaService);
}

function reminderRow(overrides: Partial<Reminder> = {}): Reminder {
  const startsAt = new Date("2099-01-01T08:00:00.000Z");
  return {
    attemptCount: 0,
    clientMutationId: null,
    createdAt: new Date("2026-08-09T03:30:10.000Z"),
    deletedAt: null,
    failureReason: null,
    id: "reminder_1",
    lastAttemptAt: null,
    lastErrorCode: null,
    nextAttemptAt: null,
    note: null,
    recurrenceJson: null,
    scheduleType: "ONCE",
    scheduledAt: startsAt,
    sentAt: null,
    startsAt,
    status: "SCHEDULED",
    suppressedAt: null,
    targetId: null,
    targetType: "STANDALONE",
    title: "旧版提醒",
    updatedAt: new Date("2026-08-09T03:30:10.000Z"),
    userId: "user_1",
    version: 1,
    ...overrides,
  } as Reminder;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("RemindersService legacy behavior during V1.5 RRULE expand", () => {
  it("lists legacy reminders with the existing filters and cursor contract", async () => {
    const rows = [
      reminderRow({ id: "reminder_3" }),
      reminderRow({ id: "reminder_2" }),
      reminderRow({ id: "reminder_1" }),
    ];
    const prisma = {
      reminder: {
        findMany: vi.fn().mockResolvedValue(rows),
      },
    };
    const service = createService(prisma);

    const result = await service.list("user_1", {
      cursor: "reminder_4",
      includeDeleted: true,
      limit: 2,
      status: "SCHEDULED",
    });

    expect(prisma.reminder.findMany).toHaveBeenCalledWith({
      cursor: { id: "reminder_4" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 1,
      take: 3,
      where: {
        deletedAt: undefined,
        status: "SCHEDULED",
        userId: "user_1",
      },
    });
    expect(result.items.map((item) => item.id)).toEqual([
      "reminder_3",
      "reminder_2",
    ]);
    expect(result.nextCursor).toBe("reminder_2");
  });

  it("scopes get to the current user and keeps RESOURCE_NOT_FOUND semantics", async () => {
    const prisma = {
      reminder: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.get("user_1", "missing")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      statusCode: 404,
    });
    expect(prisma.reminder.findFirst).toHaveBeenCalledWith({
      where: { id: "missing", userId: "user_1" },
    });
  });

  it("creates a legacy ONCE reminder without writing the new recurrence relation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T03:30:10.000Z"));
    const created = reminderRow();
    const prisma = {
      reminder: {
        create: vi.fn().mockResolvedValue(created),
        findFirst: vi.fn(),
      },
    };
    const service = createService(prisma);

    const result = await service.create("user_1", {
      scheduleType: "ONCE",
      startsAt: "2099-01-01T08:00:00.000Z",
      title: "旧版提醒",
    });

    expect(result.id).toBe("reminder_1");
    const createData = prisma.reminder.create.mock.calls[0]?.[0]?.data;
    expect(createData).toMatchObject({
      recurrenceJson: Prisma.DbNull,
      scheduleType: "ONCE",
      targetId: null,
      targetType: "STANDALONE",
      userId: "user_1",
    });
    expect(createData).not.toHaveProperty("recurrenceRule");
  });

  it("replays an identical legacy idempotent create without a second write", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T03:30:10.000Z"));
    const existing = reminderRow({
      clientMutationId: "reminder-mutation-0001",
    });
    const prisma = {
      reminder: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(existing),
      },
    };
    const service = createService(prisma);

    const result = await service.create("user_1", {
      clientMutationId: "reminder-mutation-0001",
      scheduleType: "ONCE",
      startsAt: "2099-01-01T08:00:00.000Z",
      title: "旧版提醒",
    });

    expect(result.id).toBe(existing.id);
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it("rejects an idempotency replay whose legacy content differs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T03:30:10.000Z"));
    const existing = reminderRow({
      clientMutationId: "reminder-mutation-0001",
    });
    const prisma = {
      reminder: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(existing),
      },
    };
    const service = createService(prisma);

    await expect(
      service.create("user_1", {
        clientMutationId: "reminder-mutation-0001",
        scheduleType: "ONCE",
        startsAt: "2099-01-01T08:00:00.000Z",
        title: "不同提醒",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it("recovers an identical create after a P2002 race", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T03:30:10.000Z"));
    const existing = reminderRow({
      clientMutationId: "reminder-mutation-0001",
    });
    const uniqueError = Object.assign(
      Object.create(Prisma.PrismaClientKnownRequestError.prototype),
      { code: "P2002" },
    );
    const prisma = {
      reminder: {
        create: vi.fn().mockRejectedValue(uniqueError),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(existing),
      },
    };
    const service = createService(prisma);

    const result = await service.create("user_1", {
      clientMutationId: "reminder-mutation-0001",
      scheduleType: "ONCE",
      startsAt: "2099-01-01T08:00:00.000Z",
      title: "旧版提醒",
    });

    expect(result.id).toBe(existing.id);
    expect(prisma.reminder.findUnique).toHaveBeenCalledWith({
      where: { clientMutationId: "reminder-mutation-0001" },
    });
  });

  it("keeps target ownership validation before any reminder write", async () => {
    const prisma = {
      reminder: {
        create: vi.fn(),
      },
      task: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(
      service.create("user_1", {
        scheduleType: "ONCE",
        startsAt: "2099-01-01T08:00:00.000Z",
        targetId: "task_other",
        targetType: "TASK",
        title: "跨用户目标",
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { deletedAt: null, id: "task_other", userId: "user_1" },
    });
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it("rejects a stale update before recalculating or writing", async () => {
    const current = reminderRow({ version: 1 });
    const prisma = {
      reminder: {
        findFirst: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(
      service.update("user_1", current.id, {
        title: "过期更新",
        version: 2,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
  });

  it("recalculates the legacy scheduledAt and recurrenceJson on a schedule update", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T03:30:10.000Z"));
    const current = reminderRow({
      recurrenceJson: { interval: 1 },
      scheduleType: "DAILY",
    });
    const updated = reminderRow({
      recurrenceJson: { interval: 2 },
      scheduleType: "DAILY",
      scheduledAt: new Date("2099-02-01T08:00:00.000Z"),
      startsAt: new Date("2099-02-01T08:00:00.000Z"),
      version: 2,
    });
    const prisma = {
      reminder: {
        findFirst: vi.fn().mockResolvedValue(current),
        findFirstOrThrow: vi.fn().mockResolvedValue(updated),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = createService(prisma);

    const result = await service.update("user_1", current.id, {
      recurrence: { interval: 2 },
      startsAt: "2099-02-01T08:00:00.000Z",
      version: 1,
    });

    expect(result.version).toBe(2);
    expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recurrenceJson: { interval: 2 },
        scheduleType: "DAILY",
        scheduledAt: new Date("2099-02-01T08:00:00.000Z"),
        startsAt: new Date("2099-02-01T08:00:00.000Z"),
        version: { increment: 1 },
      }),
      where: { id: current.id, userId: "user_1", version: 1 },
    });
  });

  it("keeps the existing reminder status transition restrictions", async () => {
    const current = reminderRow({ status: "SCHEDULED" });
    const prisma = {
      reminder: {
        findFirst: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(
      service.update("user_1", current.id, {
        status: "SENT",
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
  });

  it("keeps soft-delete and restore ownership/error semantics", async () => {
    const prisma = {
      reminder: {
        findFirstOrThrow: vi.fn().mockResolvedValue(reminderRow()),
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    };
    const service = createService(prisma);

    await expect(service.softDelete("user_1", "missing")).rejects.toMatchObject(
      { code: "RESOURCE_NOT_FOUND" },
    );

    const restored = await service.restore("user_1", "reminder_1");
    expect(restored.id).toBe("reminder_1");
    expect(prisma.reminder.updateMany).toHaveBeenNthCalledWith(2, {
      data: { deletedAt: null, version: { increment: 1 } },
      where: {
        deletedAt: { not: null },
        id: "reminder_1",
        userId: "user_1",
      },
    });
  });
});
