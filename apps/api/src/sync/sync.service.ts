import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type {
  ApiErrorCode,
  SyncChange,
  SyncChangesResponse,
  SyncCurrentEntity,
  SyncEntityType,
  SyncMutationError,
  SyncMutationResult,
  SyncMutationsResponse,
  SyncStatusResponse,
} from "@daily-assistant/api-contracts";

import { toCalendarEventSummary } from "../calendar/calendar.mapper.js";
import { CalendarService } from "../calendar/calendar.service.js";
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from "../calendar/dto/calendar.dto.js";
import { ApiException } from "../common/api-error.js";
import { toDraftSummary } from "../drafts/drafts.mapper.js";
import { DraftsService } from "../drafts/drafts.service.js";
import { UpdateDraftDto } from "../drafts/dto/drafts.dto.js";
import {
  toBudgetSummary,
  toCategorySummary,
  toFinancialAccountSummary,
  toTransactionSummary,
} from "../finance/finance.mapper.js";
import { FinanceService } from "../finance/finance.service.js";
import {
  CreateBudgetDto,
  CreateCategoryDto,
  CreateFinancialAccountDto,
  CreateTransactionDto,
  UpdateBudgetDto,
  UpdateCategoryDto,
  UpdateFinancialAccountDto,
  UpdateTransactionDto,
} from "../finance/dto/finance.dto.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toReminderSummary } from "../reminders/reminders.mapper.js";
import { RemindersService } from "../reminders/reminders.service.js";
import {
  CreateReminderDto,
  UpdateReminderDto,
} from "../reminders/dto/reminders.dto.js";
import { toTaskSummary } from "../tasks/tasks.mapper.js";
import { TasksService } from "../tasks/tasks.service.js";
import { CreateTaskDto, UpdateTaskDto } from "../tasks/dto/tasks.dto.js";
import {
  toPackingItemSummary,
  toTripItemSummary,
  toTripSummary,
} from "../trips/trips.mapper.js";
import { TripsService } from "../trips/trips.service.js";
import {
  CreatePackingItemDto,
  CreateTripDto,
  CreateTripItemDto,
  UpdatePackingItemDto,
  UpdateTripDto,
  UpdateTripItemDto,
} from "../trips/dto/trips.dto.js";
import {
  CreateDraftSyncPayloadDto,
  CreateTripItemSyncPayloadDto,
  ListSyncChangesQueryDto,
  SyncMutationRequestDto,
  UpdateDraftSyncPayloadDto,
} from "./dto/sync.dto.js";

interface CursorValue {
  id: string;
  t: Date;
}

interface ChangeRow {
  createdAt: Date;
  data: Record<string, unknown>;
  deletedAt: Date | null;
  entityId: string;
  entityType: SyncEntityType;
  updatedAt: Date;
  version: number;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly calendarService: CalendarService,
    private readonly tasksService: TasksService,
    private readonly remindersService: RemindersService,
    private readonly tripsService: TripsService,
    private readonly draftsService: DraftsService,
  ) {}

  async listChanges(
    userId: string,
    query: ListSyncChangesQueryDto,
  ): Promise<SyncChangesResponse> {
    const limit = Number(query.limit ?? 100);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.collectChanges(userId, cursor, limit);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const changes: SyncChange[] = page.map((row) => ({
      changeType: changeTypeOf(row, cursor),
      data: row.data,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      entityId: row.entityId,
      entityType: row.entityType,
      id: `${row.entityType}:${row.entityId}`,
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    }));
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(last.updatedAt, last.entityId) : null;
    return { changes, nextCursor };
  }

  async applyMutations(
    userId: string,
    dto: { mutations: SyncMutationRequestDto[] },
  ): Promise<SyncMutationsResponse> {
    if (dto.mutations.length > 50) {
      throw new ApiException(
        "MUTATION_BATCH_TOO_LARGE",
        400,
        "A sync mutation batch may contain at most 50 mutations",
      );
    }
    const results: SyncMutationResult[] = [];
    for (const mutation of dto.mutations) {
      results.push(await this.applyOne(userId, mutation));
    }
    return { results };
  }

  async getStatus(userId: string): Promise<SyncStatusResponse> {
    const [applied, failed, conflicted, last] = await Promise.all([
      this.prisma.syncMutation.count({
        where: { status: "APPLIED", userId },
      }),
      this.prisma.syncMutation.count({
        where: { status: "FAILED", userId },
      }),
      this.prisma.syncMutation.count({
        where: { status: "CONFLICTED", userId },
      }),
      this.prisma.syncMutation.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
        where: { status: "APPLIED", userId },
      }),
    ]);
    return {
      appliedCount: applied,
      conflictCount: conflicted,
      failedCount: failed,
      lastAppliedAt: last?.createdAt.toISOString() ?? null,
    };
  }

  private async applyOne(
    userId: string,
    mutation: SyncMutationRequestDto,
  ): Promise<SyncMutationResult> {
    const requestHash = hashMutation(mutation);
    const existing = await this.prisma.syncMutation.findUnique({
      where: {
        userId_clientMutationId: {
          clientMutationId: mutation.clientMutationId,
          userId,
        },
      },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return errorResult(
          mutation.clientMutationId,
          "IDEMPOTENCY_CONFLICT",
          "clientMutationId was already used with different content",
        );
      }
      const stored = existing.resultRef as
        Record<string, unknown> | null | undefined;
      if (existing.status === "APPLIED" && stored) {
        return {
          clientMutationId: mutation.clientMutationId,
          result: stored,
          status: "OK",
        };
      }
      return {
        clientMutationId: mutation.clientMutationId,
        error:
          (stored as SyncMutationError | undefined) ??
          ({
            code: (existing.errorCode as ApiErrorCode) ?? "INTERNAL_ERROR",
            message: existing.errorMessage ?? "Sync mutation failed",
          } satisfies SyncMutationError),
        status: "ERROR",
      };
    }

    try {
      const raw = await this.dispatch(userId, mutation);
      const result = extractEntityResult(mutation.entityType, raw);
      await this.prisma.syncMutation.create({
        data: {
          action: mutation.action,
          clientMutationId: mutation.clientMutationId,
          entityId: mutation.entityId ?? null,
          entityType: mutation.entityType,
          requestHash,
          resultRef: result as unknown as Prisma.InputJsonValue,
          status: "APPLIED",
          userId,
        },
      });
      return {
        clientMutationId: mutation.clientMutationId,
        result,
        status: "OK",
      };
    } catch (error) {
      const apiError =
        error instanceof ApiException
          ? error
          : new ApiException(
              "INTERNAL_ERROR",
              500,
              "Sync mutation could not be applied",
            );
      const status =
        apiError.code === "VERSION_CONFLICT" ||
        apiError.code === "IDEMPOTENCY_CONFLICT"
          ? "CONFLICTED"
          : "FAILED";
      const current =
        apiError.code === "VERSION_CONFLICT"
          ? await this.currentEntity(
              userId,
              mutation.entityType,
              mutation.entityId ?? null,
            )
          : undefined;
      const errorBody: SyncMutationError = {
        code: apiError.code,
        message: apiError.message,
        ...(current ? { current } : {}),
      };
      await this.prisma.syncMutation.create({
        data: {
          action: mutation.action,
          clientMutationId: mutation.clientMutationId,
          entityId: mutation.entityId ?? null,
          entityType: mutation.entityType,
          errorCode: apiError.code,
          errorMessage: apiError.message.slice(0, 500),
          requestHash,
          resultRef: errorBody as unknown as Prisma.InputJsonValue,
          status,
          userId,
        },
      });
      return {
        clientMutationId: mutation.clientMutationId,
        error: errorBody,
        status: "ERROR",
      };
    }
  }

  private async dispatch(
    userId: string,
    mutation: SyncMutationRequestDto,
  ): Promise<unknown> {
    const id = mutation.action === "CREATE" ? "" : this.requireId(mutation);
    switch (mutation.entityType) {
      case "TRANSACTION":
        return this.dispatchTransaction(userId, mutation, id);
      case "CATEGORY":
        return this.dispatchCategory(userId, mutation, id);
      case "FINANCIAL_ACCOUNT":
        return this.dispatchFinancialAccount(userId, mutation, id);
      case "BUDGET":
        return this.dispatchBudget(userId, mutation, id);
      case "CALENDAR_EVENT":
        return this.dispatchCalendarEvent(userId, mutation, id);
      case "TASK":
        return this.dispatchTask(userId, mutation, id);
      case "REMINDER":
        return this.dispatchReminder(userId, mutation, id);
      case "TRIP":
        return this.dispatchTrip(userId, mutation, id);
      case "TRIP_ITEM":
        return this.dispatchTripItem(userId, mutation, id);
      case "PACKING_ITEM":
        return this.dispatchPackingItem(userId, mutation, id);
      case "DRAFT_RECORD":
        return this.dispatchDraftRecord(userId, mutation, id);
      default:
        throw unsupported(mutation);
    }
  }

  private async dispatchTransaction(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const dto = await this.validatePayload(CreateTransactionDto, {
        ...(mutation.payload ?? {}),
        clientMutationId: mutation.clientMutationId,
      });
      return this.financeService.createTransaction(userId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdateTransactionDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.financeService.updateTransaction(userId, id, dto);
    }
    if (mutation.action === "DELETE") {
      return this.deleteEntity(
        userId,
        "TRANSACTION",
        id,
        this.requireVersion(mutation),
      );
    }
    if (mutation.action === "RESTORE") {
      return this.restoreEntity(
        userId,
        "TRANSACTION",
        id,
        this.requireVersion(mutation),
      );
    }
    throw unsupported(mutation);
  }

  private async dispatchCategory(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const dto = await this.validatePayload(CreateCategoryDto, {
        ...(mutation.payload ?? {}),
        clientMutationId: mutation.clientMutationId,
      });
      return this.financeService.createCategory(userId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdateCategoryDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.financeService.updateCategory(userId, id, dto);
    }
    throw unsupported(mutation);
  }

  private async dispatchFinancialAccount(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const dto = await this.validatePayload(CreateFinancialAccountDto, {
        ...(mutation.payload ?? {}),
        clientMutationId: mutation.clientMutationId,
      });
      return this.financeService.createFinancialAccount(userId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdateFinancialAccountDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.financeService.updateFinancialAccount(userId, id, dto);
    }
    throw unsupported(mutation);
  }

  private async dispatchBudget(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const dto = await this.validatePayload(CreateBudgetDto, {
        ...(mutation.payload ?? {}),
        clientMutationId: mutation.clientMutationId,
      });
      return this.financeService.createBudget(userId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdateBudgetDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.financeService.updateBudget(userId, id, dto);
    }
    if (mutation.action === "DELETE") {
      return this.deleteEntity(
        userId,
        "BUDGET",
        id,
        this.requireVersion(mutation),
      );
    }
    if (mutation.action === "RESTORE") {
      return this.restoreEntity(
        userId,
        "BUDGET",
        id,
        this.requireVersion(mutation),
      );
    }
    throw unsupported(mutation);
  }

  private async dispatchCalendarEvent(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const dto = await this.validatePayload(CreateCalendarEventDto, {
        ...(mutation.payload ?? {}),
        clientMutationId: mutation.clientMutationId,
      });
      return this.calendarService.create(userId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdateCalendarEventDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.calendarService.update(userId, id, dto);
    }
    if (mutation.action === "DELETE") {
      return this.deleteEntity(
        userId,
        "CALENDAR_EVENT",
        id,
        this.requireVersion(mutation),
      );
    }
    if (mutation.action === "RESTORE") {
      return this.restoreEntity(
        userId,
        "CALENDAR_EVENT",
        id,
        this.requireVersion(mutation),
      );
    }
    throw unsupported(mutation);
  }

  private async dispatchTask(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const dto = await this.validatePayload(CreateTaskDto, {
        ...(mutation.payload ?? {}),
        clientMutationId: mutation.clientMutationId,
      });
      return this.tasksService.create(userId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdateTaskDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.tasksService.update(userId, id, dto);
    }
    if (mutation.action === "DELETE") {
      return this.deleteEntity(
        userId,
        "TASK",
        id,
        this.requireVersion(mutation),
      );
    }
    if (mutation.action === "RESTORE") {
      return this.restoreEntity(
        userId,
        "TASK",
        id,
        this.requireVersion(mutation),
      );
    }
    throw unsupported(mutation);
  }

  private async dispatchReminder(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const dto = await this.validatePayload(CreateReminderDto, {
        ...(mutation.payload ?? {}),
        clientMutationId: mutation.clientMutationId,
      });
      return this.remindersService.create(userId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdateReminderDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.remindersService.update(userId, id, dto);
    }
    if (mutation.action === "DELETE") {
      return this.deleteEntity(
        userId,
        "REMINDER",
        id,
        this.requireVersion(mutation),
      );
    }
    if (mutation.action === "RESTORE") {
      return this.restoreEntity(
        userId,
        "REMINDER",
        id,
        this.requireVersion(mutation),
      );
    }
    throw unsupported(mutation);
  }

  private async dispatchTrip(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const dto = await this.validatePayload(CreateTripDto, {
        ...(mutation.payload ?? {}),
        clientMutationId: mutation.clientMutationId,
      });
      return this.tripsService.create(userId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdateTripDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.tripsService.update(userId, id, dto);
    }
    if (mutation.action === "DELETE") {
      return this.deleteEntity(
        userId,
        "TRIP",
        id,
        this.requireVersion(mutation),
      );
    }
    if (mutation.action === "RESTORE") {
      return this.restoreEntity(
        userId,
        "TRIP",
        id,
        this.requireVersion(mutation),
      );
    }
    throw unsupported(mutation);
  }

  private async dispatchTripItem(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const payload = await this.validatePayload(
        CreateTripItemSyncPayloadDto,
        mutation.payload ?? {},
      );
      const dto = new CreateTripItemDto();
      Object.assign(dto, {
        clientMutationId: mutation.clientMutationId,
        confirmOutOfRange: payload.confirmOutOfRange,
        endsAt: payload.endsAt,
        location: payload.location,
        position: payload.position,
        startsAt: payload.startsAt,
        type: payload.type,
      });
      return this.tripsService.createItem(userId, payload.tripId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdateTripItemDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.tripsService.updateItem(userId, id, dto);
    }
    if (mutation.action === "DELETE") {
      return this.deleteEntity(
        userId,
        "TRIP_ITEM",
        id,
        this.requireVersion(mutation),
      );
    }
    if (mutation.action === "RESTORE") {
      return this.restoreEntity(
        userId,
        "TRIP_ITEM",
        id,
        this.requireVersion(mutation),
      );
    }
    throw unsupported(mutation);
  }

  private async dispatchPackingItem(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const payload = mutation.payload ?? {};
      const tripId = payload.tripId;
      if (typeof tripId !== "string" || tripId.length === 0) {
        throw new ApiException("VALIDATION_ERROR", 400, "tripId is required");
      }
      const dto = await this.validatePayload(CreatePackingItemDto, {
        ...payload,
        clientMutationId: mutation.clientMutationId,
      });
      return this.tripsService.createPackingItem(userId, tripId, dto);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(UpdatePackingItemDto, {
        ...(mutation.payload ?? {}),
        version: this.requireVersion(mutation),
      });
      return this.tripsService.updatePackingItem(userId, id, dto);
    }
    if (mutation.action === "DELETE") {
      return this.deleteEntity(
        userId,
        "PACKING_ITEM",
        id,
        this.requireVersion(mutation),
      );
    }
    if (mutation.action === "RESTORE") {
      return this.restoreEntity(
        userId,
        "PACKING_ITEM",
        id,
        this.requireVersion(mutation),
      );
    }
    throw unsupported(mutation);
  }

  private async dispatchDraftRecord(
    userId: string,
    mutation: SyncMutationRequestDto,
    id: string,
  ): Promise<unknown> {
    if (mutation.action === "CREATE") {
      const dto = await this.validatePayload(
        CreateDraftSyncPayloadDto,
        mutation.payload ?? {},
      );
      const row = await this.prisma.draftRecord.create({
        data: {
          clientMutationId: mutation.clientMutationId,
          confidenceJson: (dto.confidence ?? Prisma.DbNull) as
            Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
          payloadJson: dto.payload as unknown as Prisma.InputJsonValue,
          source: dto.source,
          status: "PENDING",
          targetType: "TRANSACTION",
          userId,
          version: 1,
        },
      });
      return toDraftSummary(row);
    }
    if (mutation.action === "UPDATE") {
      const dto = await this.validatePayload(
        UpdateDraftSyncPayloadDto,
        mutation.payload ?? {},
      );
      const update: UpdateDraftDto = {
        payload: dto.payload as unknown as UpdateDraftDto["payload"],
        version: this.requireVersion(mutation),
      };
      return this.draftsService.updateDraft(userId, id, update);
    }
    if (mutation.action === "DELETE") {
      return this.deleteEntity(
        userId,
        "DRAFT_RECORD",
        id,
        this.requireVersion(mutation),
      );
    }
    throw unsupported(mutation);
  }

  private async validatePayload<T extends object>(
    cls: new () => T,
    payload: unknown,
  ): Promise<T> {
    const instance = plainToInstance(cls, payload ?? {});
    const errors = await validate(instance, { whitelist: true });
    const first = errors[0];
    if (first) {
      const message = first.constraints
        ? (Object.values(first.constraints)[0] ?? "Invalid payload")
        : `Invalid field: ${first.property}`;
      throw new ApiException("VALIDATION_ERROR", 400, message);
    }
    return instance;
  }

  private requireId(mutation: SyncMutationRequestDto): string {
    if (!mutation.entityId) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "entityId is required for this mutation",
      );
    }
    return mutation.entityId;
  }

  private requireVersion(mutation: SyncMutationRequestDto): number {
    if (!mutation.version || mutation.version < 1) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "version is required for this mutation",
      );
    }
    return mutation.version;
  }

  private async deleteEntity(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    version: number,
  ): Promise<Record<string, unknown>> {
    const result = await this.tombstoneUpdate(
      userId,
      entityType,
      entityId,
      version,
      false,
    );
    if (result.count === 0) {
      const current = await this.findEntity(userId, entityType, entityId);
      if (!current) {
        throw new ApiException("RESOURCE_NOT_FOUND", 404, "Entity not found");
      }
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Entity was modified elsewhere",
      );
    }
    const row = await this.findEntity(userId, entityType, entityId);
    if (!row) {
      throw new ApiException(
        "INTERNAL_ERROR",
        500,
        "Entity disappeared after delete",
      );
    }
    return row.data;
  }

  private async restoreEntity(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    version: number,
  ): Promise<Record<string, unknown>> {
    const result = await this.tombstoneUpdate(
      userId,
      entityType,
      entityId,
      version,
      true,
    );
    if (result.count === 0) {
      const current = await this.findEntity(userId, entityType, entityId);
      if (!current) {
        throw new ApiException("RESOURCE_NOT_FOUND", 404, "Entity not found");
      }
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Entity was modified elsewhere",
      );
    }
    const row = await this.findEntity(userId, entityType, entityId);
    if (!row) {
      throw new ApiException(
        "INTERNAL_ERROR",
        500,
        "Entity disappeared after restore",
      );
    }
    return row.data;
  }

  private async tombstoneUpdate(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    version: number,
    restoring: boolean,
  ): Promise<{ count: number }> {
    const data = restoring
      ? { deletedAt: null, version: { increment: 1 } }
      : { deletedAt: new Date(), version: { increment: 1 } };
    const deletedAt = restoring ? { not: null } : null;
    switch (entityType) {
      case "TRANSACTION":
        return this.prisma.transaction.updateMany({
          data,
          where: { deletedAt, id: entityId, userId, version },
        });
      case "BUDGET":
        return this.prisma.budget.updateMany({
          data,
          where: { deletedAt, id: entityId, userId, version },
        });
      case "CALENDAR_EVENT":
        return this.prisma.calendarEvent.updateMany({
          data,
          where: { deletedAt, id: entityId, userId, version },
        });
      case "TASK":
        return this.prisma.task.updateMany({
          data,
          where: { deletedAt, id: entityId, userId, version },
        });
      case "REMINDER":
        return this.prisma.reminder.updateMany({
          data,
          where: { deletedAt, id: entityId, userId, version },
        });
      case "TRIP":
        return this.prisma.trip.updateMany({
          data,
          where: { deletedAt, id: entityId, userId, version },
        });
      case "TRIP_ITEM":
        return this.prisma.tripItem.updateMany({
          data,
          where: { deletedAt, id: entityId, trip: { userId }, version },
        });
      case "PACKING_ITEM":
        return this.prisma.packingItem.updateMany({
          data,
          where: { deletedAt, id: entityId, trip: { userId }, version },
        });
      case "DRAFT_RECORD":
        return this.prisma.draftRecord.updateMany({
          data: {
            ...(restoring
              ? {}
              : { discardedAt: new Date(), status: "DISCARDED" }),
            version: { increment: 1 },
          },
          where: {
            id: entityId,
            status: restoring ? undefined : "PENDING",
            userId,
            version,
          },
        });
      default:
        throw new ApiException(
          "MUTATION_UNSUPPORTED",
          400,
          "This entity does not support delete or restore",
        );
    }
  }

  private async findEntity(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
  ): Promise<ChangeRow | null> {
    switch (entityType) {
      case "TRANSACTION": {
        const row = await this.prisma.transaction.findFirst({
          where: { id: entityId, userId },
        });
        return row
          ? toRow(
              "TRANSACTION",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toTransactionSummary(row),
            )
          : null;
      }
      case "CATEGORY": {
        const row = await this.prisma.category.findFirst({
          where: { id: entityId, userId },
        });
        return row
          ? toRow(
              "CATEGORY",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toCategorySummary(row),
            )
          : null;
      }
      case "FINANCIAL_ACCOUNT": {
        const row = await this.prisma.financialAccount.findFirst({
          where: { id: entityId, userId },
        });
        return row
          ? toRow(
              "FINANCIAL_ACCOUNT",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toFinancialAccountSummary(row),
            )
          : null;
      }
      case "BUDGET": {
        const row = await this.prisma.budget.findFirst({
          where: { id: entityId, userId },
        });
        return row
          ? toRow(
              "BUDGET",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toBudgetSummary(row),
            )
          : null;
      }
      case "CALENDAR_EVENT": {
        const row = await this.prisma.calendarEvent.findFirst({
          where: { id: entityId, userId },
        });
        return row
          ? toRow(
              "CALENDAR_EVENT",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toCalendarEventSummary(row),
            )
          : null;
      }
      case "TASK": {
        const row = await this.prisma.task.findFirst({
          where: { id: entityId, userId },
        });
        return row
          ? toRow(
              "TASK",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toTaskSummary(row),
            )
          : null;
      }
      case "REMINDER": {
        const row = await this.prisma.reminder.findFirst({
          where: { id: entityId, userId },
        });
        return row
          ? toRow(
              "REMINDER",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toReminderSummary(row),
            )
          : null;
      }
      case "TRIP": {
        const row = await this.prisma.trip.findFirst({
          where: { id: entityId, userId },
        });
        return row
          ? toRow(
              "TRIP",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toTripSummary(row),
            )
          : null;
      }
      case "TRIP_ITEM": {
        const row = await this.prisma.tripItem.findFirst({
          where: { id: entityId, trip: { userId } },
        });
        return row
          ? toRow(
              "TRIP_ITEM",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toTripItemSummary(row),
            )
          : null;
      }
      case "PACKING_ITEM": {
        const row = await this.prisma.packingItem.findFirst({
          where: { id: entityId, trip: { userId } },
        });
        return row
          ? toRow(
              "PACKING_ITEM",
              row.id,
              row.createdAt,
              row.updatedAt,
              row.deletedAt,
              row.version,
              toPackingItemSummary(row),
            )
          : null;
      }
      case "DRAFT_RECORD": {
        const row = await this.prisma.draftRecord.findFirst({
          where: { id: entityId, userId },
        });
        return row
          ? toRow(
              "DRAFT_RECORD",
              row.id,
              row.createdAt,
              row.updatedAt,
              null,
              row.version,
              toDraftSummary(row),
            )
          : null;
      }
      default:
        return null;
    }
  }

  private async currentEntity(
    userId: string,
    entityType: SyncEntityType,
    entityId: string | null,
  ): Promise<SyncCurrentEntity | undefined> {
    if (!entityId) {
      return undefined;
    }
    const row = await this.findEntity(userId, entityType, entityId);
    return row ? { data: row.data, entityId, entityType } : undefined;
  }

  private async collectChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows: ChangeRow[] = [
      ...(await this.transactionChanges(userId, cursor, limit)),
      ...(await this.categoryChanges(userId, cursor, limit)),
      ...(await this.financialAccountChanges(userId, cursor, limit)),
      ...(await this.budgetChanges(userId, cursor, limit)),
      ...(await this.calendarEventChanges(userId, cursor, limit)),
      ...(await this.taskChanges(userId, cursor, limit)),
      ...(await this.reminderChanges(userId, cursor, limit)),
      ...(await this.tripChanges(userId, cursor, limit)),
      ...(await this.tripItemChanges(userId, cursor, limit)),
      ...(await this.packingItemChanges(userId, cursor, limit)),
      ...(await this.draftChanges(userId, cursor, limit)),
    ];
    rows.sort(compareRows);
    return rows;
  }

  private async transactionChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.transaction.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { userId, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "TRANSACTION",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toTransactionSummary(row),
      ),
    );
  }

  private async categoryChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { userId, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "CATEGORY",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toCategorySummary(row),
      ),
    );
  }

  private async financialAccountChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.financialAccount.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { userId, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "FINANCIAL_ACCOUNT",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toFinancialAccountSummary(row),
      ),
    );
  }

  private async budgetChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.budget.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { userId, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "BUDGET",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toBudgetSummary(row),
      ),
    );
  }

  private async calendarEventChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.calendarEvent.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { userId, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "CALENDAR_EVENT",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toCalendarEventSummary(row),
      ),
    );
  }

  private async taskChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.task.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { userId, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "TASK",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toTaskSummary(row),
      ),
    );
  }

  private async reminderChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.reminder.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { userId, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "REMINDER",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toReminderSummary(row),
      ),
    );
  }

  private async tripChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.trip.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { userId, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "TRIP",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toTripSummary(row),
      ),
    );
  }

  private async tripItemChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.tripItem.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { trip: { userId }, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "TRIP_ITEM",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toTripItemSummary(row),
      ),
    );
  }

  private async packingItemChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.packingItem.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { trip: { userId }, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "PACKING_ITEM",
        row.id,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.version,
        toPackingItemSummary(row),
      ),
    );
  }

  private async draftChanges(
    userId: string,
    cursor: CursorValue | null,
    limit: number,
  ): Promise<ChangeRow[]> {
    const rows = await this.prisma.draftRecord.findMany({
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      where: { userId, ...cursorWhere(cursor) },
    });
    return rows.map((row) =>
      toRow(
        "DRAFT_RECORD",
        row.id,
        row.createdAt,
        row.updatedAt,
        null,
        row.version,
        toDraftSummary(row),
      ),
    );
  }
}

function cursorWhere(cursor: CursorValue | null): {
  OR?: Array<
    { id: { gt: string }; updatedAt: Date } | { updatedAt: { gt: Date } }
  >;
} {
  if (!cursor) {
    return {};
  }
  return {
    OR: [
      { updatedAt: { gt: cursor.t } },
      { updatedAt: cursor.t, id: { gt: cursor.id } },
    ],
  };
}

function compareRows(a: ChangeRow, b: ChangeRow): number {
  const byTime = a.updatedAt.getTime() - b.updatedAt.getTime();
  return byTime !== 0 ? byTime : a.entityId.localeCompare(b.entityId);
}

function changeTypeOf(
  row: ChangeRow,
  cursor: CursorValue | null,
): SyncChange["changeType"] {
  if (row.deletedAt || row.data.status === "DISCARDED") {
    return "DELETE";
  }
  if (cursor === null && row.createdAt.getTime() === row.updatedAt.getTime()) {
    return "CREATE";
  }
  return "UPDATE";
}

function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ id, t: updatedAt.toISOString() }),
  ).toString("base64url");
}

function decodeCursor(cursor: string): CursorValue {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { id?: unknown; t?: unknown };
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.t !== "string" ||
      !Number.isFinite(Date.parse(parsed.t))
    ) {
      throw new Error("invalid cursor");
    }
    return { id: parsed.id, t: new Date(parsed.t) };
  } catch {
    throw new ApiException("CURSOR_INVALID", 400, "Sync cursor is invalid");
  }
}

function hashMutation(mutation: SyncMutationRequestDto): string {
  const canonical = canonicalize({
    action: mutation.action,
    entityId: mutation.entityId ?? null,
    entityType: mutation.entityType,
    payload: mutation.payload ?? {},
    version: mutation.version ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function extractEntityResult(
  entityType: SyncEntityType,
  raw: unknown,
): Record<string, unknown> {
  if (raw && typeof raw === "object") {
    const object = raw as Record<string, unknown>;
    if (entityType === "TRANSACTION" && object.transaction) {
      return object.transaction as Record<string, unknown>;
    }
    if (entityType === "CALENDAR_EVENT" && object.calendarEvent) {
      return object.calendarEvent as Record<string, unknown>;
    }
    if (entityType === "TRIP_ITEM" && object.tripItem) {
      return object.tripItem as Record<string, unknown>;
    }
  }
  return (raw ?? {}) as Record<string, unknown>;
}

function errorResult(
  clientMutationId: string,
  code: ApiErrorCode,
  message: string,
): SyncMutationResult {
  return {
    clientMutationId,
    error: { code, message },
    status: "ERROR",
  };
}

function unsupported(mutation: SyncMutationRequestDto): ApiException {
  return new ApiException(
    "MUTATION_UNSUPPORTED",
    400,
    `${mutation.action} is not supported for ${mutation.entityType}`,
  );
}

function toRow(
  entityType: SyncEntityType,
  entityId: string,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date | null,
  version: number,
  data: object,
): ChangeRow {
  return {
    createdAt,
    data: data as unknown as Record<string, unknown>,
    deletedAt,
    entityId,
    entityType,
    updatedAt,
    version,
  };
}
