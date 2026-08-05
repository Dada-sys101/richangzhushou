import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { Prisma, type Reminder } from "../generated/prisma/client.js";
import {
  NOTIFICATION_ADAPTER,
  NotificationUnavailableError,
  type NotificationAdapter,
} from "../integrations/integrations.types.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  nextOccurrence,
  recurrenceFromRow,
  type NormalizedRecurrence,
} from "./recurrence.util.js";

const PROCESSING_LOCK_MS = 5 * 60 * 1000;
const RETRY_BACKOFF_MS = 60 * 1000;

@Injectable()
export class RemindersScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_ADAPTER)
    private readonly notificationAdapter: NotificationAdapter,
  ) {}

  onModuleInit(): void {
    if (process.env.REMINDER_SCHEDULER_ENABLED === "true") {
      const intervalMs = Number(
        process.env.REMINDER_SCHEDULER_INTERVAL_MS ?? 30_000,
      );
      this.timer = setInterval(() => {
        void this.runDueReminders();
      }, intervalMs);
      this.timer.unref?.();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runDueReminders(): Promise<{
    delivered: number;
    failed: number;
    suppressed: number;
  }> {
    const now = new Date();
    const maxAttempts = this.maxAttempts();
    const candidates = await this.prisma.reminder.findMany({
      include: { user: true },
      orderBy: { scheduledAt: "asc" },
      take: 50,
      where: {
        deletedAt: null,
        OR: [
          {
            status: "SCHEDULED",
            scheduledAt: { lte: now },
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
          },
          {
            status: "FAILED",
            attemptCount: { lt: maxAttempts },
            nextAttemptAt: { lte: now },
          },
        ],
      },
    });

    let delivered = 0;
    let failed = 0;
    let suppressed = 0;
    for (const candidate of candidates) {
      const claimed = await this.prisma.reminder.updateMany({
        data: {
          attemptCount: { increment: 1 },
          lastAttemptAt: now,
          nextAttemptAt: new Date(now.getTime() + PROCESSING_LOCK_MS),
        },
        where: {
          id: candidate.id,
          ...this.claimCondition(candidate, now, maxAttempts),
        },
      });
      if (claimed.count === 0) {
        continue;
      }
      const row = await this.prisma.reminder.findUniqueOrThrow({
        include: { user: true },
        where: { id: candidate.id },
      });
      if (row.user.status !== "ACTIVE") {
        await this.prisma.reminder.update({
          data: {
            failureReason: null,
            lastErrorCode: null,
            nextAttemptAt: null,
            status: "SUPPRESSED",
            suppressedAt: new Date(),
          },
          where: { id: row.id },
        });
        suppressed += 1;
        continue;
      }

      try {
        await this.notificationAdapter.send({
          body: row.note ?? undefined,
          scheduledAt: row.scheduledAt,
          title: row.title,
          userId: row.userId,
        });
      } catch (error) {
        await this.markFailed(row, now, error);
        failed += 1;
        continue;
      }

      if (row.scheduleType === "ONCE") {
        await this.prisma.reminder.update({
          data: {
            failureReason: null,
            lastErrorCode: null,
            nextAttemptAt: null,
            sentAt: new Date(),
            status: "SENT",
          },
          where: { id: row.id },
        });
      } else {
        const next = nextOccurrence(
          row.scheduleType,
          normalizedFromRow(row),
          now,
          row.startsAt,
        );
        await this.prisma.reminder.update({
          data: next
            ? {
                failureReason: null,
                lastErrorCode: null,
                nextAttemptAt: null,
                scheduledAt: next,
                status: "SCHEDULED",
              }
            : {
                failureReason: null,
                lastErrorCode: null,
                nextAttemptAt: null,
                sentAt: new Date(),
                status: "SENT",
              },
          where: { id: row.id },
        });
      }
      delivered += 1;
    }
    return { delivered, failed, suppressed };
  }

  private claimCondition(
    row: Reminder,
    now: Date,
    maxAttempts: number,
  ): Prisma.ReminderWhereInput {
    if (row.status === "SCHEDULED") {
      return {
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        scheduledAt: { lte: now },
        status: "SCHEDULED",
      };
    }
    return {
      OR: [{ nextAttemptAt: { lte: now } }],
      attemptCount: { lt: maxAttempts },
      status: "FAILED",
    };
  }

  private async markFailed(
    row: Reminder,
    now: Date,
    error: unknown,
  ): Promise<void> {
    const message =
      error instanceof Error ? error.message : "Notification delivery failed";
    const code =
      error instanceof NotificationUnavailableError
        ? "NOTIFICATION_UNAVAILABLE"
        : "NOTIFICATION_FAILED";
    const maxAttempts = this.maxAttempts();
    await this.prisma.reminder.update({
      data: {
        failureReason: message.slice(0, 200),
        lastErrorCode: code,
        nextAttemptAt:
          row.attemptCount >= maxAttempts
            ? null
            : new Date(now.getTime() + RETRY_BACKOFF_MS),
        status: "FAILED",
      },
      where: { id: row.id },
    });
  }

  private maxAttempts(): number {
    const value = Number(process.env.REMINDER_MAX_ATTEMPTS ?? 3);
    return Number.isFinite(value) && value > 0 ? value : 3;
  }
}

function normalizedFromRow(row: Reminder): NormalizedRecurrence {
  const recurrence = recurrenceFromRow(row.recurrenceJson);
  return recurrence ?? { interval: 1, until: null };
}
