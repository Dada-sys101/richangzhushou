import { Injectable } from "@nestjs/common";
import type {
  CalendarEventCreatedResponse,
  CalendarEventListResponse,
  CalendarEventSummary,
} from "@daily-assistant/api-contracts";

import {
  Prisma,
  type CalendarEvent,
  type PrismaClient,
} from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { dayBounds, monthBounds } from "../finance/time.util.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { isShanghaiMidnight } from "./calendar.time.util.js";
import { toCalendarEventSummary } from "./calendar.mapper.js";
import type {
  CreateCalendarEventDto,
  ListCalendarEventsQueryDto,
  UpdateCalendarEventDto,
} from "./dto/calendar.dto.js";

interface NormalizedCalendarInput {
  allDay: boolean;
  clientMutationId: string | null;
  endsAt: Date;
  startsAt: Date;
  title: string;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: ListCalendarEventsQueryDto,
  ): Promise<CalendarEventListResponse> {
    const limit = Number(query.limit ?? 50);
    const where: Prisma.CalendarEventWhereInput = {
      deletedAt: query.includeDeleted ? undefined : null,
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.date
        ? (() => {
            const bounds = dayBounds(query.date);
            return {
              endsAt: { gt: bounds.start },
              startsAt: { lt: bounds.end },
            };
          })()
        : {}),
      ...(query.month
        ? (() => {
            const bounds = monthBounds(query.month);
            return {
              endsAt: { gt: bounds.start },
              startsAt: { lt: bounds.end },
            };
          })()
        : {}),
    };
    const rows = await this.prisma.calendarEvent.findMany({
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: query.cursor ? 1 : 0,
      take: limit + 1,
      where,
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(
      toCalendarEventSummary,
    );
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, id: string): Promise<CalendarEventSummary> {
    const row = await this.prisma.calendarEvent.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Calendar event not found",
      );
    }
    return toCalendarEventSummary(row);
  }

  async create(
    userId: string,
    dto: CreateCalendarEventDto,
    tx?: Prisma.TransactionClient,
  ): Promise<CalendarEventCreatedResponse> {
    const db = tx ?? this.prisma;
    const input = this.normalizeInput(dto);
    this.validateTimeRange(input);

    if (input.clientMutationId) {
      const replayed = await this.findByIdempotencyKey(
        userId,
        input.clientMutationId,
        db,
      );
      if (replayed) {
        this.assertSameMutation(replayed, input);
        return { calendarEvent: toCalendarEventSummary(replayed) };
      }
    }

    const overlap = await this.findOverlap(
      userId,
      input.startsAt,
      input.endsAt,
      null,
      db,
    );
    try {
      const row = await db.calendarEvent.create({
        data: {
          allDay: input.allDay,
          clientMutationId: input.clientMutationId,
          endsAt: input.endsAt,
          startsAt: input.startsAt,
          status: "SCHEDULED",
          title: input.title,
          userId,
          version: 1,
        },
      });
      return this.withOverlap(row, overlap);
    } catch (error) {
      if (this.isUniqueViolation(error) && input.clientMutationId) {
        const global = await db.calendarEvent.findUnique({
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
          return { calendarEvent: toCalendarEventSummary(global) };
        }
      }
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventCreatedResponse> {
    const current = await this.prisma.calendarEvent.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!current) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Calendar event not found",
      );
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Calendar event was modified elsewhere",
      );
    }
    const input: NormalizedCalendarInput = {
      allDay: dto.allDay ?? current.allDay,
      clientMutationId: current.clientMutationId,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : current.endsAt,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : current.startsAt,
      title: dto.title === undefined ? current.title : dto.title.trim(),
    };
    this.validateTimeRange(input);

    const overlap = await this.findOverlap(
      userId,
      input.startsAt,
      input.endsAt,
      id,
      this.prisma,
    );
    const updated = await this.prisma.calendarEvent.updateMany({
      data: {
        allDay: input.allDay,
        endsAt: input.endsAt,
        startsAt: input.startsAt,
        status: dto.status ?? current.status,
        title: input.title,
        version: { increment: 1 },
      },
      where: { id, userId, version: current.version },
    });
    if (updated.count === 0) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Calendar event was modified elsewhere",
      );
    }
    const row = await this.prisma.calendarEvent.findFirstOrThrow({
      where: { id, userId },
    });
    return this.withOverlap(row, overlap);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.calendarEvent.updateMany({
      data: { deletedAt: new Date(), version: { increment: 1 } },
      where: { id, userId, deletedAt: null },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Calendar event not found",
      );
    }
  }

  async restore(userId: string, id: string): Promise<CalendarEventSummary> {
    const result = await this.prisma.calendarEvent.updateMany({
      data: { deletedAt: null, version: { increment: 1 } },
      where: { id, userId, deletedAt: { not: null } },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Deleted calendar event not found",
      );
    }
    const row = await this.prisma.calendarEvent.findFirstOrThrow({
      where: { id, userId },
    });
    return toCalendarEventSummary(row);
  }

  private normalizeInput(dto: CreateCalendarEventDto): NormalizedCalendarInput {
    const title = dto.title.trim();
    if (!title) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Calendar event title is required",
      );
    }
    return {
      allDay: dto.allDay ?? false,
      clientMutationId: dto.clientMutationId ?? null,
      endsAt: new Date(dto.endsAt),
      startsAt: new Date(dto.startsAt),
      title,
    };
  }

  private validateTimeRange(input: {
    allDay: boolean;
    endsAt: Date;
    startsAt: Date;
    title: string;
  }): void {
    if (!input.title.trim()) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Calendar event title is required",
      );
    }
    if (input.allDay) {
      if (
        !isShanghaiMidnight(input.startsAt) ||
        !isShanghaiMidnight(input.endsAt)
      ) {
        throw new ApiException(
          "VALIDATION_ERROR",
          400,
          "All-day events must use Asia/Shanghai midnight boundaries",
        );
      }
      if (input.endsAt.getTime() <= input.startsAt.getTime()) {
        throw new ApiException(
          "VALIDATION_ERROR",
          400,
          "All-day events must span at least one day",
        );
      }
      return;
    }
    if (input.endsAt.getTime() < input.startsAt.getTime()) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "endsAt must not precede startsAt",
        [
          {
            field: "endsAt",
            message: "结束时间不得早于开始时间",
          },
        ],
      );
    }
  }

  private async findOverlap(
    userId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId: string | null,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<CalendarEvent | null> {
    return db.calendarEvent.findFirst({
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      where: {
        deletedAt: null,
        endsAt: { gt: startsAt },
        id: excludeId ? { not: excludeId } : undefined,
        startsAt: { lt: endsAt },
        status: "SCHEDULED",
        userId,
      },
    });
  }

  private withOverlap(
    row: CalendarEvent,
    overlap: CalendarEvent | null,
  ): CalendarEventCreatedResponse {
    const response: CalendarEventCreatedResponse = {
      calendarEvent: toCalendarEventSummary(row),
    };
    if (overlap) {
      response.overlapWarning = {
        code: "OVERLAP_WARNING",
        conflictingEventId: overlap.id,
        message: "该时间段与另一条日程重叠，已保存但请核对",
      };
    }
    return response;
  }

  private async findByIdempotencyKey(
    userId: string,
    clientMutationId: string,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<CalendarEvent | null> {
    return db.calendarEvent.findFirst({
      where: { clientMutationId, userId },
    });
  }

  private assertSameMutation(
    existing: CalendarEvent,
    input: NormalizedCalendarInput,
  ): void {
    const same =
      existing.allDay === input.allDay &&
      existing.title === input.title &&
      existing.endsAt.getTime() === input.endsAt.getTime() &&
      existing.startsAt.getTime() === input.startsAt.getTime();
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
}
