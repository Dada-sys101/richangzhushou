import { Injectable } from "@nestjs/common";
import type {
  CalendarEventSummary,
  PackingItemSummary,
  TripDetailResponse,
  TripExpenseSummary,
  TripItemCreatedResponse,
  TripItemOutOfRangeWarning,
  TripItemSummary,
  TripListResponse,
  TripSummary,
} from "@daily-assistant/api-contracts";

import {
  Prisma,
  type PackingItem,
  type PrismaClient,
  type Trip,
  type TripItem,
} from "../generated/prisma/client.js";
import { toCalendarEventSummary } from "../calendar/calendar.mapper.js";
import { ApiException } from "../common/api-error.js";
import { toTransactionSummary } from "../finance/finance.mapper.js";
import { formatMoney, toDecimal, zeroMoney } from "../finance/money.util.js";
import { dayBounds, toZonedDay } from "../finance/time.util.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  CreatePackingItemDto,
  CreateTripDto,
  CreateTripItemDto,
  ListTripsQueryDto,
  UpdatePackingItemDto,
  UpdateTripDto,
  UpdateTripItemDto,
} from "./dto/trips.dto.js";
import {
  toPackingItemSummary,
  toTripItemSummary,
  toTripSummary,
} from "./trips.mapper.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface NormalizedTripInput {
  budgetAmount: Prisma.Decimal | null;
  clientMutationId: string | null;
  destination: string;
  endDate: Date;
  startDate: Date;
  title: string;
}

interface NormalizedTripItemInput {
  clientMutationId: string | null;
  confirmOutOfRange: boolean;
  endsAt: Date;
  location: string | null;
  position?: number;
  startsAt: Date;
  type: TripItem["type"];
}

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: ListTripsQueryDto,
  ): Promise<TripListResponse> {
    const limit = Number(query.limit ?? 50);
    const rows = await this.prisma.trip.findMany({
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
      skip: query.cursor ? 1 : 0,
      take: limit + 1,
      where: {
        deletedAt: query.includeDeleted ? undefined : null,
        userId,
      },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toTripSummary);
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, id: string): Promise<TripDetailResponse> {
    const trip = await this.prisma.trip.findFirst({
      where: { id, userId },
    });
    if (!trip) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Trip not found");
    }
    const [items, packingItems, linkedTransactions, expense, calendarEvents] =
      await Promise.all([
        this.prisma.tripItem.findMany({
          orderBy: [{ position: "asc" }, { id: "asc" }],
          where: { deletedAt: null, tripId: id },
        }),
        this.prisma.packingItem.findMany({
          orderBy: [{ position: "asc" }, { id: "asc" }],
          where: { deletedAt: null, tripId: id },
        }),
        this.prisma.transaction.findMany({
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          where: {
            deletedAt: null,
            status: "CONFIRMED",
            tripId: id,
            userId,
          },
        }),
        this.tripExpense(trip),
        this.tripCalendarEvents(trip, userId),
      ]);
    return {
      calendarEvents,
      expense,
      items: items.map(toTripItemSummary),
      linkedTransactions: linkedTransactions.map(toTransactionSummary),
      packingItems: packingItems.map(toPackingItemSummary),
      trip: toTripSummary(trip),
    };
  }

  async create(
    userId: string,
    dto: CreateTripDto,
    tx?: Prisma.TransactionClient,
  ): Promise<TripSummary> {
    const db = tx ?? this.prisma;
    const input = this.normalizeCreateInput(dto);
    this.validateTripDates(input.startDate, input.endDate);

    if (input.clientMutationId) {
      const replayed = await this.findTripByIdempotencyKey(
        userId,
        input.clientMutationId,
        db,
      );
      if (replayed) {
        this.assertSameTripMutation(replayed, input);
        return toTripSummary(replayed);
      }
    }
    try {
      const row = await db.trip.create({
        data: {
          budgetAmount: input.budgetAmount,
          clientMutationId: input.clientMutationId,
          destination: input.destination,
          endDate: input.endDate,
          startDate: input.startDate,
          title: input.title,
          userId,
          version: 1,
        },
      });
      return toTripSummary(row);
    } catch (error) {
      if (this.isUniqueViolation(error) && input.clientMutationId) {
        const global = await db.trip.findUnique({
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
          this.assertSameTripMutation(global, input);
          return toTripSummary(global);
        }
      }
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTripDto,
  ): Promise<TripSummary> {
    const current = await this.prisma.trip.findFirst({
      where: { deletedAt: null, id, userId },
    });
    if (!current) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Trip not found");
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Trip was modified elsewhere",
      );
    }
    const input: NormalizedTripInput = {
      budgetAmount:
        dto.budgetAmount === undefined
          ? current.budgetAmount
          : dto.budgetAmount === null
            ? null
            : toDecimal(dto.budgetAmount),
      clientMutationId: current.clientMutationId,
      destination:
        dto.destination === undefined
          ? current.destination
          : dto.destination.trim(),
      endDate: dto.endDate ? this.parseTripDate(dto.endDate) : current.endDate,
      startDate: dto.startDate
        ? this.parseTripDate(dto.startDate)
        : current.startDate,
      title: dto.title === undefined ? current.title : dto.title.trim(),
    };
    if (!input.title.trim()) {
      throw new ApiException("VALIDATION_ERROR", 400, "Trip title is required");
    }
    if (!input.destination.trim()) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Trip destination is required",
      );
    }
    this.validateTripDates(input.startDate, input.endDate);

    const updated = await this.prisma.trip.updateMany({
      data: {
        budgetAmount: input.budgetAmount,
        destination: input.destination,
        endDate: input.endDate,
        startDate: input.startDate,
        title: input.title,
        version: { increment: 1 },
      },
      where: { id, userId, version: current.version },
    });
    if (updated.count === 0) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Trip was modified elsewhere",
      );
    }
    return toTripSummary(
      await this.prisma.trip.findFirstOrThrow({
        where: { id, userId },
      }),
    );
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.trip.updateMany({
      data: { deletedAt: new Date(), version: { increment: 1 } },
      where: { deletedAt: null, id, userId },
    });
    if (result.count === 0) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Trip not found");
    }
  }

  async restore(userId: string, id: string): Promise<TripSummary> {
    const result = await this.prisma.trip.updateMany({
      data: { deletedAt: null, version: { increment: 1 } },
      where: { deletedAt: { not: null }, id, userId },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Deleted trip not found",
      );
    }
    return toTripSummary(
      await this.prisma.trip.findFirstOrThrow({
        where: { id, userId },
      }),
    );
  }

  async createItem(
    userId: string,
    tripId: string,
    dto: CreateTripItemDto,
  ): Promise<TripItemCreatedResponse> {
    const trip = await this.requireActiveTrip(userId, tripId);
    const input = this.normalizeTripItemInput(dto);
    this.validateTripItemTimes(input.startsAt, input.endsAt);
    const outOfRange = this.isOutOfRange(trip, input.startsAt, input.endsAt);
    if (outOfRange && !input.confirmOutOfRange) {
      throw this.outOfRangeError();
    }

    if (input.clientMutationId) {
      const replayed = await this.findTripItemByIdempotencyKey(
        userId,
        input.clientMutationId,
      );
      if (replayed) {
        this.assertSameTripItemMutation(replayed, input);
        return this.withOutOfRangeWarning(replayed, outOfRange);
      }
    }
    const position =
      input.position ?? (await this.nextPosition(tripId, "tripItem"));
    try {
      const row = await this.prisma.tripItem.create({
        data: {
          clientMutationId: input.clientMutationId,
          endsAt: input.endsAt,
          location: input.location,
          position,
          startsAt: input.startsAt,
          tripId,
          type: input.type,
          version: 1,
        },
      });
      return this.withOutOfRangeWarning(row, outOfRange);
    } catch (error) {
      if (this.isUniqueViolation(error) && input.clientMutationId) {
        const global = await this.prisma.tripItem.findUnique({
          where: { clientMutationId: input.clientMutationId },
        });
        if (global) {
          const tripRow = await this.requireActiveTrip(userId, global.tripId);
          if (tripRow.userId !== userId) {
            throw new ApiException(
              "IDEMPOTENCY_CONFLICT",
              409,
              "clientMutationId was already used",
            );
          }
          this.assertSameTripItemMutation(global, input);
          return this.withOutOfRangeWarning(
            global,
            this.isOutOfRange(trip, global.startsAt, global.endsAt),
          );
        }
      }
      throw error;
    }
  }

  async getTripItem(userId: string, id: string): Promise<TripItemSummary> {
    const row = await this.prisma.tripItem.findFirst({
      where: { id, trip: { userId } },
    });
    if (!row) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Trip item not found");
    }
    return toTripItemSummary(row);
  }

  async updateItem(
    userId: string,
    id: string,
    dto: UpdateTripItemDto,
  ): Promise<TripItemCreatedResponse> {
    const current = await this.prisma.tripItem.findFirst({
      include: { trip: true },
      where: { deletedAt: null, id, trip: { userId } },
    });
    if (!current) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Trip item not found");
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Trip item was modified elsewhere",
      );
    }
    const input: NormalizedTripItemInput = {
      clientMutationId: current.clientMutationId,
      confirmOutOfRange: dto.confirmOutOfRange ?? false,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : current.endsAt,
      location:
        dto.location === undefined
          ? current.location
          : this.blankToNull(dto.location),
      position: dto.position ?? current.position,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : current.startsAt,
      type: dto.type ?? current.type,
    };
    this.validateTripItemTimes(input.startsAt, input.endsAt);
    const outOfRange = this.isOutOfRange(
      current.trip,
      input.startsAt,
      input.endsAt,
    );
    if (outOfRange && !input.confirmOutOfRange) {
      throw this.outOfRangeError();
    }

    const updated = await this.prisma.tripItem.updateMany({
      data: {
        endsAt: input.endsAt,
        location: input.location,
        position: input.position,
        startsAt: input.startsAt,
        type: input.type,
        version: { increment: 1 },
      },
      where: { id, trip: { userId }, version: current.version },
    });
    if (updated.count === 0) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Trip item was modified elsewhere",
      );
    }
    const row = await this.prisma.tripItem.findFirstOrThrow({
      where: { id, trip: { userId } },
    });
    return this.withOutOfRangeWarning(row, outOfRange);
  }

  async softDeleteItem(userId: string, id: string): Promise<void> {
    const result = await this.prisma.tripItem.updateMany({
      data: { deletedAt: new Date(), version: { increment: 1 } },
      where: { deletedAt: null, id, trip: { userId } },
    });
    if (result.count === 0) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Trip item not found");
    }
  }

  async restoreItem(userId: string, id: string): Promise<TripItemSummary> {
    const result = await this.prisma.tripItem.updateMany({
      data: { deletedAt: null, version: { increment: 1 } },
      where: { deletedAt: { not: null }, id, trip: { userId } },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Deleted trip item not found",
      );
    }
    return toTripItemSummary(
      await this.prisma.tripItem.findFirstOrThrow({
        where: { id, trip: { userId } },
      }),
    );
  }

  async createPackingItem(
    userId: string,
    tripId: string,
    dto: CreatePackingItemDto,
  ): Promise<PackingItemSummary> {
    await this.requireActiveTrip(userId, tripId);
    const text = dto.text.trim();
    if (!text) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Packing item text is required",
      );
    }
    if (dto.clientMutationId) {
      const replayed = await this.findPackingItemByIdempotencyKey(
        userId,
        dto.clientMutationId,
      );
      if (replayed) {
        this.assertSamePackingMutation(replayed, text);
        return toPackingItemSummary(replayed);
      }
    }
    const position =
      dto.position ?? (await this.nextPosition(tripId, "packingItem"));
    try {
      const row = await this.prisma.packingItem.create({
        data: {
          checked: false,
          clientMutationId: dto.clientMutationId ?? null,
          position,
          text,
          tripId,
          version: 1,
        },
      });
      return toPackingItemSummary(row);
    } catch (error) {
      if (this.isUniqueViolation(error) && dto.clientMutationId) {
        const global = await this.prisma.packingItem.findUnique({
          where: { clientMutationId: dto.clientMutationId },
        });
        if (global) {
          await this.requireActiveTrip(userId, global.tripId);
          this.assertSamePackingMutation(global, text);
          return toPackingItemSummary(global);
        }
      }
      throw error;
    }
  }

  async getPackingItem(
    userId: string,
    id: string,
  ): Promise<PackingItemSummary> {
    const row = await this.prisma.packingItem.findFirst({
      where: { id, trip: { userId } },
    });
    if (!row) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Packing item not found",
      );
    }
    return toPackingItemSummary(row);
  }

  async updatePackingItem(
    userId: string,
    id: string,
    dto: UpdatePackingItemDto,
  ): Promise<PackingItemSummary> {
    const current = await this.prisma.packingItem.findFirst({
      where: { deletedAt: null, id, trip: { userId } },
    });
    if (!current) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Packing item not found",
      );
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Packing item was modified elsewhere",
      );
    }
    const text = dto.text === undefined ? current.text : dto.text.trim();
    if (!text) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Packing item text is required",
      );
    }
    const updated = await this.prisma.packingItem.updateMany({
      data: {
        checked: dto.checked ?? current.checked,
        position: dto.position ?? current.position,
        text,
        version: { increment: 1 },
      },
      where: { id, trip: { userId }, version: current.version },
    });
    if (updated.count === 0) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Packing item was modified elsewhere",
      );
    }
    return toPackingItemSummary(
      await this.prisma.packingItem.findFirstOrThrow({
        where: { id, trip: { userId } },
      }),
    );
  }

  async softDeletePackingItem(userId: string, id: string): Promise<void> {
    const result = await this.prisma.packingItem.updateMany({
      data: { deletedAt: new Date(), version: { increment: 1 } },
      where: { deletedAt: null, id, trip: { userId } },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Packing item not found",
      );
    }
  }

  async restorePackingItem(
    userId: string,
    id: string,
  ): Promise<PackingItemSummary> {
    const result = await this.prisma.packingItem.updateMany({
      data: { deletedAt: null, version: { increment: 1 } },
      where: { deletedAt: { not: null }, id, trip: { userId } },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Deleted packing item not found",
      );
    }
    return toPackingItemSummary(
      await this.prisma.packingItem.findFirstOrThrow({
        where: { id, trip: { userId } },
      }),
    );
  }

  private async tripExpense(
    trip: Pick<Trip, "budgetAmount" | "id" | "userId">,
  ): Promise<TripExpenseSummary> {
    const [expense, refund] = await Promise.all([
      this.sumLinked(trip.userId, trip.id, "EXPENSE"),
      this.sumLinked(trip.userId, trip.id, "REFUND"),
    ]);
    const actual = (expense ?? zeroMoney()).minus(refund ?? zeroMoney());
    const budgetAmount = trip.budgetAmount
      ? formatMoney(trip.budgetAmount)
      : null;
    const budgetProgress =
      trip.budgetAmount && trip.budgetAmount.gt(0)
        ? actual.div(trip.budgetAmount).toFixed(2)
        : null;
    return {
      actualExpense: formatMoney(actual),
      budgetAmount,
      budgetProgress,
    };
  }

  private async sumLinked(
    userId: string,
    tripId: string,
    type: "EXPENSE" | "REFUND",
  ): Promise<Prisma.Decimal | null> {
    const result = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        deletedAt: null,
        status: "CONFIRMED",
        tripId,
        type,
        userId,
      },
    });
    return result._sum.amount;
  }

  private async tripCalendarEvents(
    trip: Pick<Trip, "endDate" | "startDate">,
    userId: string,
  ): Promise<CalendarEventSummary[]> {
    const start = dayBounds(toZonedDay(trip.startDate)).start;
    const end = dayBounds(toZonedDay(trip.endDate)).end;
    const rows = await this.prisma.calendarEvent.findMany({
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      where: {
        deletedAt: null,
        endsAt: { gt: start },
        startsAt: { lt: end },
        userId,
      },
    });
    return rows.map(toCalendarEventSummary);
  }

  private async requireActiveTrip(
    userId: string,
    tripId: string,
  ): Promise<Trip> {
    const trip = await this.prisma.trip.findFirst({
      where: { deletedAt: null, id: tripId, userId },
    });
    if (!trip) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Trip not found");
    }
    return trip;
  }

  private normalizeCreateInput(dto: CreateTripDto): NormalizedTripInput {
    const title = dto.title.trim();
    const destination = dto.destination.trim();
    if (!title) {
      throw new ApiException("VALIDATION_ERROR", 400, "Trip title is required");
    }
    if (!destination) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Trip destination is required",
      );
    }
    return {
      budgetAmount:
        dto.budgetAmount === undefined || dto.budgetAmount === null
          ? null
          : toDecimal(dto.budgetAmount),
      clientMutationId: dto.clientMutationId ?? null,
      destination,
      endDate: this.parseTripDate(dto.endDate),
      startDate: this.parseTripDate(dto.startDate),
      title,
    };
  }

  private normalizeTripItemInput(
    dto: CreateTripItemDto,
  ): NormalizedTripItemInput {
    return {
      clientMutationId: dto.clientMutationId ?? null,
      confirmOutOfRange: dto.confirmOutOfRange ?? false,
      endsAt: new Date(dto.endsAt),
      location: this.blankToNull(dto.location),
      position: dto.position,
      startsAt: new Date(dto.startsAt),
      type: dto.type,
    };
  }

  private parseTripDate(value: string): Date {
    if (!DATE_PATTERN.test(value)) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Trip dates must use YYYY-MM-DD",
      );
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Trip dates must use YYYY-MM-DD",
      );
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Trip date is not a valid calendar day",
      );
    }
    return date;
  }

  private validateTripDates(startDate: Date, endDate: Date): void {
    if (endDate.getTime() < startDate.getTime()) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "endDate must not precede startDate",
        [
          {
            field: "endDate",
            message: "结束日期不得早于开始日期",
          },
        ],
      );
    }
  }

  private validateTripItemTimes(startsAt: Date, endsAt: Date): void {
    if (endsAt.getTime() < startsAt.getTime()) {
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

  private isOutOfRange(
    trip: Pick<Trip, "endDate" | "startDate">,
    startsAt: Date,
    endsAt: Date,
  ): boolean {
    const rangeStart = dayBounds(toZonedDay(trip.startDate)).start;
    const rangeEnd = dayBounds(toZonedDay(trip.endDate)).end;
    return (
      startsAt.getTime() < rangeStart.getTime() ||
      endsAt.getTime() > rangeEnd.getTime()
    );
  }

  private outOfRangeError(): ApiException {
    return new ApiException(
      "VALIDATION_ERROR",
      400,
      "节点时间超出行程日期范围，请确认后保存",
      [
        {
          field: "startsAt",
          message: "节点时间超出行程日期范围，请确认后保存",
        },
      ],
    );
  }

  private withOutOfRangeWarning(
    row: TripItem,
    outOfRange: boolean,
  ): TripItemCreatedResponse {
    const response: TripItemCreatedResponse = {
      tripItem: toTripItemSummary(row),
    };
    if (outOfRange) {
      const warning: TripItemOutOfRangeWarning = {
        code: "TRIP_ITEM_OUT_OF_RANGE",
        message: "节点时间超出行程日期范围，已按确认保存，请核对",
      };
      response.outOfRangeWarning = warning;
    }
    return response;
  }

  private async nextPosition(
    tripId: string,
    kind: "packingItem" | "tripItem",
  ): Promise<number> {
    if (kind === "tripItem") {
      const result = await this.prisma.tripItem.aggregate({
        _max: { position: true },
        where: { deletedAt: null, tripId },
      });
      return (result._max.position ?? -1) + 1;
    }
    const result = await this.prisma.packingItem.aggregate({
      _max: { position: true },
      where: { deletedAt: null, tripId },
    });
    return (result._max.position ?? -1) + 1;
  }

  private async findTripItemByIdempotencyKey(
    userId: string,
    clientMutationId: string,
  ): Promise<TripItem | null> {
    return this.prisma.tripItem.findFirst({
      where: { clientMutationId, trip: { userId } },
    });
  }

  private async findPackingItemByIdempotencyKey(
    userId: string,
    clientMutationId: string,
  ): Promise<PackingItem | null> {
    return this.prisma.packingItem.findFirst({
      where: { clientMutationId, trip: { userId } },
    });
  }

  private async findTripByIdempotencyKey(
    userId: string,
    clientMutationId: string,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<Trip | null> {
    return db.trip.findFirst({
      where: { clientMutationId, userId },
    });
  }

  private assertSameTripMutation(
    existing: Trip,
    input: NormalizedTripInput,
  ): void {
    const same =
      existing.title === input.title &&
      existing.destination === input.destination &&
      existing.startDate.getTime() === input.startDate.getTime() &&
      existing.endDate.getTime() === input.endDate.getTime() &&
      (existing.budgetAmount?.toString() ?? null) ===
        (input.budgetAmount?.toString() ?? null);
    if (!same) {
      throw new ApiException(
        "IDEMPOTENCY_CONFLICT",
        409,
        "clientMutationId was already used with different content",
      );
    }
  }

  private assertSameTripItemMutation(
    existing: TripItem,
    input: NormalizedTripItemInput,
  ): void {
    const same =
      existing.type === input.type &&
      existing.endsAt.getTime() === input.endsAt.getTime() &&
      existing.startsAt.getTime() === input.startsAt.getTime() &&
      (existing.location ?? null) === (input.location ?? null);
    if (!same) {
      throw new ApiException(
        "IDEMPOTENCY_CONFLICT",
        409,
        "clientMutationId was already used with different content",
      );
    }
  }

  private assertSamePackingMutation(existing: PackingItem, text: string): void {
    if (existing.text !== text) {
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

  private blankToNull(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
