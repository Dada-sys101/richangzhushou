import { Injectable } from "@nestjs/common";
import type {
  ReminderListResponse,
  ReminderRecurrence,
  ReminderScheduleType,
  ReminderSummary,
  ReminderTargetType,
} from "@daily-assistant/api-contracts";

import {
  Prisma,
  type PrismaClient,
  type Reminder,
} from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  normalizeRecurrence,
  nextOccurrence,
  recurrenceToJson,
} from "./recurrence.util.js";
import {
  reminderRecurrenceFromJson,
  toReminderSummary,
} from "./reminders.mapper.js";
import type {
  CreateReminderDto,
  ListRemindersQueryDto,
  UpdateReminderDto,
} from "./dto/reminders.dto.js";

interface NormalizedReminderInput {
  clientMutationId: string | null;
  note: string | null;
  recurrence: ReminderRecurrence | null;
  scheduleType: ReminderScheduleType;
  startsAt: Date;
  targetId: string | null;
  targetType: ReminderTargetType;
  title: string;
}

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: ListRemindersQueryDto,
  ): Promise<ReminderListResponse> {
    const limit = Number(query.limit ?? 50);
    const rows = await this.prisma.reminder.findMany({
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: query.cursor ? 1 : 0,
      take: limit + 1,
      where: {
        deletedAt: query.includeDeleted ? undefined : null,
        userId,
        ...(query.status ? { status: query.status } : {}),
      },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(
      toReminderSummary,
    );
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, id: string): Promise<ReminderSummary> {
    const row = await this.prisma.reminder.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Reminder not found");
    }
    return toReminderSummary(row);
  }

  async create(
    userId: string,
    dto: CreateReminderDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ReminderSummary> {
    const db = tx ?? this.prisma;
    const input = await this.normalizeInput(userId, dto, db);
    const normalized = normalizeRecurrence(
      input.scheduleType,
      input.recurrence,
      input.startsAt,
    );
    const scheduledAt = nextOccurrence(
      input.scheduleType,
      normalized,
      new Date(),
      input.startsAt,
    );
    if (!scheduledAt) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Reminder has no future occurrence",
      );
    }

    if (input.clientMutationId) {
      const replayed = await this.findByIdempotencyKey(
        userId,
        input.clientMutationId,
        db,
      );
      if (replayed) {
        this.assertSameMutation(replayed, input);
        return toReminderSummary(replayed);
      }
    }

    try {
      const row = await db.reminder.create({
        data: {
          clientMutationId: input.clientMutationId,
          note: input.note,
          recurrenceJson: this.recurrenceJson(input.scheduleType, normalized),
          scheduleType: input.scheduleType,
          scheduledAt,
          startsAt: input.startsAt,
          status: "SCHEDULED",
          targetId: input.targetId,
          targetType: input.targetType,
          title: input.title,
          userId,
          version: 1,
        },
      });
      return toReminderSummary(row);
    } catch (error) {
      if (this.isUniqueViolation(error) && input.clientMutationId) {
        const global = await db.reminder.findUnique({
          where: { clientMutationId: input.clientMutationId },
        });
        if (global) {
          if (global.userId !== userId) {
            throw new ApiException(
              "IDEMPOTENCY_CONFLICT",
              409,
              "clientMutationId was already used",
            );
          }
          this.assertSameMutation(global, input);
          return toReminderSummary(global);
        }
      }
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateReminderDto,
  ): Promise<ReminderSummary> {
    const current = await this.prisma.reminder.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!current) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Reminder not found");
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Reminder was modified elsewhere",
      );
    }

    const title = dto.title === undefined ? current.title : dto.title.trim();
    if (!title) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Reminder title is required",
      );
    }
    const note =
      dto.note === undefined
        ? current.note
        : dto.note === null
          ? null
          : dto.note.trim() || null;
    const targetType = dto.targetType ?? current.targetType;
    const targetId =
      dto.targetId === undefined ? current.targetId : dto.targetId;
    await this.validateTarget(userId, targetType, targetId, this.prisma);
    const scheduleType = dto.scheduleType ?? current.scheduleType;
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const recurrence =
      dto.recurrence === undefined
        ? reminderRecurrenceFromJson(current.recurrenceJson)
        : dto.recurrence;

    const status = dto.status ?? current.status;
    if (status !== current.status) {
      if (
        current.status === "SENT" ||
        status === "SENT" ||
        status === "FAILED" ||
        status === "SUPPRESSED"
      ) {
        throw new ApiException(
          "INVALID_STATE",
          409,
          "Reminder status transition is not allowed",
        );
      }
    }

    const scheduleChanged =
      scheduleType !== current.scheduleType ||
      startsAt.getTime() !== current.startsAt.getTime() ||
      recurrenceKey(recurrence) !==
        recurrenceKeyFromJson(current.recurrenceJson);
    let scheduledAt = current.scheduledAt;
    let recurrenceJson:
      Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue =
      current.recurrenceJson as Prisma.InputJsonValue;
    if (scheduleChanged || status === "SCHEDULED") {
      const normalized = normalizeRecurrence(
        scheduleType,
        recurrence,
        startsAt,
      );
      const next = nextOccurrence(
        scheduleType,
        normalized,
        new Date(),
        startsAt,
      );
      if (!next) {
        throw new ApiException(
          "VALIDATION_ERROR",
          400,
          "Reminder has no future occurrence",
        );
      }
      scheduledAt = next;
      recurrenceJson = this.recurrenceJson(scheduleType, normalized);
    }

    const updated = await this.prisma.reminder.updateMany({
      data: {
        note,
        recurrenceJson,
        scheduleType,
        scheduledAt,
        startsAt,
        status,
        targetId,
        targetType,
        title,
        version: { increment: 1 },
      },
      where: { id, userId, version: current.version },
    });
    if (updated.count === 0) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Reminder was modified elsewhere",
      );
    }
    const row = await this.prisma.reminder.findFirstOrThrow({
      where: { id, userId },
    });
    return toReminderSummary(row);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.reminder.updateMany({
      data: { deletedAt: new Date(), version: { increment: 1 } },
      where: { id, userId, deletedAt: null },
    });
    if (result.count === 0) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Reminder not found");
    }
  }

  async restore(userId: string, id: string): Promise<ReminderSummary> {
    const result = await this.prisma.reminder.updateMany({
      data: { deletedAt: null, version: { increment: 1 } },
      where: { id, userId, deletedAt: { not: null } },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Deleted reminder not found",
      );
    }
    const row = await this.prisma.reminder.findFirstOrThrow({
      where: { id, userId },
    });
    return toReminderSummary(row);
  }

  private async normalizeInput(
    userId: string,
    dto: CreateReminderDto,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<NormalizedReminderInput> {
    const title = dto.title.trim();
    if (!title) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Reminder title is required",
      );
    }
    const targetType = dto.targetType ?? "STANDALONE";
    const targetId = dto.targetId ?? null;
    await this.validateTarget(userId, targetType, targetId, db);
    return {
      clientMutationId: dto.clientMutationId ?? null,
      note:
        dto.note === undefined || dto.note === null
          ? null
          : dto.note.trim() || null,
      recurrence: dto.recurrence ?? null,
      scheduleType: dto.scheduleType,
      startsAt: new Date(dto.startsAt),
      targetId,
      targetType,
      title,
    };
  }

  private async validateTarget(
    userId: string,
    targetType: ReminderTargetType,
    targetId: string | null,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<void> {
    if (targetType === "STANDALONE") {
      if (targetId) {
        throw new ApiException(
          "VALIDATION_ERROR",
          400,
          "STANDALONE reminders cannot reference a target",
        );
      }
      return;
    }
    if (!targetId) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        `targetId is required for ${targetType} reminders`,
      );
    }
    if (targetType === "CALENDAR_EVENT") {
      const event = await db.calendarEvent.findFirst({
        where: { deletedAt: null, id: targetId, userId },
      });
      if (!event) {
        throw new ApiException(
          "RESOURCE_NOT_FOUND",
          404,
          "Calendar event not found",
        );
      }
      return;
    }
    const task = await db.task.findFirst({
      where: { deletedAt: null, id: targetId, userId },
    });
    if (!task) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Task not found");
    }
  }

  private async findByIdempotencyKey(
    userId: string,
    clientMutationId: string,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<Reminder | null> {
    return db.reminder.findFirst({
      where: { clientMutationId, userId },
    });
  }

  private assertSameMutation(
    existing: Reminder,
    input: NormalizedReminderInput,
  ): void {
    const same =
      existing.title === input.title &&
      (existing.note ?? null) === input.note &&
      existing.targetType === input.targetType &&
      (existing.targetId ?? null) === input.targetId &&
      existing.scheduleType === input.scheduleType &&
      existing.startsAt.getTime() === input.startsAt.getTime() &&
      recurrenceKeyFromJson(existing.recurrenceJson) ===
        recurrenceKey(input.recurrence);
    if (!same) {
      throw new ApiException(
        "IDEMPOTENCY_CONFLICT",
        409,
        "clientMutationId was already used with different content",
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private recurrenceJson(
    scheduleType: ReminderScheduleType,
    recurrence: ReturnType<typeof normalizeRecurrence>,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
    if (scheduleType === "ONCE") {
      return Prisma.DbNull;
    }
    return (recurrenceToJson(recurrence) ?? Prisma.DbNull) as
      Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
  }
}

function recurrenceKey(recurrence: ReminderRecurrence | null): string {
  if (!recurrence) {
    return "null";
  }
  return JSON.stringify({
    dayOfMonth: recurrence.dayOfMonth ?? null,
    interval: recurrence.interval ?? 1,
    until: recurrence.until ?? null,
    weekdays: recurrence.weekdays ?? null,
  });
}

function recurrenceKeyFromJson(json: unknown): string {
  return recurrenceKey(reminderRecurrenceFromJson(json));
}
