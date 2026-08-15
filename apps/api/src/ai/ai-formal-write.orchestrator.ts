import { Injectable } from "@nestjs/common";
import { plainToInstance, type ClassConstructor } from "class-transformer";
import { validate } from "class-validator";
import type {
  AiOperationType,
  TransactionCreatedResponse,
  CalendarEventCreatedResponse,
  Identifier,
} from "@daily-assistant/api-contracts";

import { ApiException } from "../common/api-error.js";
import { CalendarService } from "../calendar/calendar.service.js";
import { CreateCalendarEventDto } from "../calendar/dto/calendar.dto.js";
import { FinanceService } from "../finance/finance.service.js";
import { CreateTransactionDto } from "../finance/dto/finance.dto.js";
import { RemindersService } from "../reminders/reminders.service.js";
import { CreateReminderDto } from "../reminders/dto/reminders.dto.js";
import { TasksService } from "../tasks/tasks.service.js";
import { CreateTaskDto } from "../tasks/dto/tasks.dto.js";
import { TripsService } from "../trips/trips.service.js";
import { CreateTripDto } from "../trips/dto/trips.dto.js";

type FormalCreateDto =
  | CreateCalendarEventDto
  | CreateReminderDto
  | CreateTaskDto
  | CreateTransactionDto
  | CreateTripDto;

export interface PreparedFormalWrite {
  dto: FormalCreateDto;
  operationType: AiOperationType;
}

export interface FormalWriteResult {
  resultEntityId: Identifier;
  resultEntityType: AiOperationType;
}

/**
 * The only H04 component allowed to cross the formal business-write boundary.
 * It translates persisted AI fields into the existing domain DTOs, validates
 * them at runtime, and injects the server-owned mutation metadata.
 */
@Injectable()
export class AiFormalWriteOrchestrator {
  constructor(
    private readonly financeService: FinanceService,
    private readonly calendarService: CalendarService,
    private readonly tasksService: TasksService,
    private readonly remindersService: RemindersService,
    private readonly tripsService: TripsService,
  ) {}

  async prepare(
    operationType: AiOperationType,
    fields: Record<string, unknown>,
    clientMutationId: string,
  ): Promise<PreparedFormalWrite> {
    if (!isRecord(fields)) {
      throw validationError("AI operation fields must be an object");
    }
    if (hasOwn(fields, "clientMutationId")) {
      throw validationError("clientMutationId is server-owned");
    }

    const sanitized = { ...fields };
    if (operationType === "TRANSACTION") {
      if (hasOwn(fields, "sourceFingerprint")) {
        throw validationError("sourceFingerprint is server-owned");
      }
      if (hasOwn(fields, "source") && fields.source !== "TEXT") {
        throw validationError("AI transactions must use the TEXT source");
      }
      // H01 already persists source=TEXT in its provider fixture. The value
      // is accepted for compatibility, removed, and replaced below by the
      // server-owned value rather than passed through from the provider.
      delete sanitized.source;
      delete sanitized.sourceFingerprint;
      sanitized.source = "TEXT";
    }

    const dto = await this.validateDto(operationType, {
      ...sanitized,
      clientMutationId,
    });
    return { dto, operationType };
  }

  async apply(
    userId: string,
    operationType: AiOperationType,
    fields: Record<string, unknown>,
    clientMutationId: string,
  ): Promise<FormalWriteResult> {
    const prepared = await this.prepare(
      operationType,
      fields,
      clientMutationId,
    );
    return this.applyPrepared(userId, prepared);
  }

  async applyPrepared(
    userId: string,
    prepared: PreparedFormalWrite,
  ): Promise<FormalWriteResult> {
    switch (prepared.operationType) {
      case "TRANSACTION": {
        const response = (await this.financeService.createTransaction(
          userId,
          prepared.dto as CreateTransactionDto,
        )) as TransactionCreatedResponse;
        return {
          resultEntityId: requireResultId(response.transaction?.id),
          resultEntityType: "TRANSACTION",
        };
      }
      case "CALENDAR_EVENT": {
        const response = (await this.calendarService.create(
          userId,
          prepared.dto as CreateCalendarEventDto,
        )) as CalendarEventCreatedResponse;
        return {
          resultEntityId: requireResultId(response.calendarEvent?.id),
          resultEntityType: "CALENDAR_EVENT",
        };
      }
      case "TASK": {
        const result = await this.tasksService.create(
          userId,
          prepared.dto as CreateTaskDto,
        );
        return {
          resultEntityId: requireResultId(result.id),
          resultEntityType: "TASK",
        };
      }
      case "REMINDER": {
        const result = await this.remindersService.create(
          userId,
          prepared.dto as CreateReminderDto,
        );
        return {
          resultEntityId: requireResultId(result.id),
          resultEntityType: "REMINDER",
        };
      }
      case "TRIP": {
        const result = await this.tripsService.create(
          userId,
          prepared.dto as CreateTripDto,
        );
        return {
          resultEntityId: requireResultId(result.id),
          resultEntityType: "TRIP",
        };
      }
      default:
        throw validationError("Unsupported AI operation type");
    }
  }

  private async validateDto(
    operationType: AiOperationType,
    raw: Record<string, unknown>,
  ): Promise<FormalCreateDto> {
    const Dto = dtoForOperation(
      operationType,
    ) as ClassConstructor<FormalCreateDto>;
    const dto = plainToInstance(Dto, raw);
    const errors = await validate(dto, {
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      whitelist: true,
    });
    if (errors.length > 0) {
      throw validationError("AI operation fields failed domain validation");
    }
    return dto as FormalCreateDto;
  }
}

function dtoForOperation(
  operationType: AiOperationType,
):
  | ClassConstructor<CreateCalendarEventDto>
  | ClassConstructor<CreateReminderDto>
  | ClassConstructor<CreateTaskDto>
  | ClassConstructor<CreateTransactionDto>
  | ClassConstructor<CreateTripDto> {
  switch (operationType) {
    case "TRANSACTION":
      return CreateTransactionDto;
    case "CALENDAR_EVENT":
      return CreateCalendarEventDto;
    case "TASK":
      return CreateTaskDto;
    case "REMINDER":
      return CreateReminderDto;
    case "TRIP":
      return CreateTripDto;
    default:
      throw validationError("Unsupported AI operation type");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requireResultId(value: unknown): Identifier {
  if (typeof value !== "string" || value.length === 0) {
    throw new ApiException(
      "INTERNAL_ERROR",
      500,
      "Formal Domain Service returned an invalid entity identifier",
    );
  }
  return value;
}

function validationError(message: string): ApiException {
  return new ApiException("VALIDATION_ERROR", 400, message);
}
