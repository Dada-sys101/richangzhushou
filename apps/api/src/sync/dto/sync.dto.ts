import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import {
  DRAFT_TARGET_TYPES,
  RECORD_SOURCES,
  SYNC_ACTIONS,
  SYNC_ENTITY_TYPES,
  TRANSACTION_TYPES,
} from "@daily-assistant/api-contracts";

const MONEY_PATTERN = /^\d+\.\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class ListSyncChangesQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 512)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class SyncMutationRequestDto {
  @IsString()
  @Length(16, 128)
  clientMutationId!: string;

  @IsIn(SYNC_ENTITY_TYPES)
  entityType!: (typeof SYNC_ENTITY_TYPES)[number];

  @IsIn(SYNC_ACTIONS)
  action!: (typeof SYNC_ACTIONS)[number];

  @IsOptional()
  @IsString()
  entityId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number | null;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class SyncMutationBatchRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SyncMutationRequestDto)
  mutations!: SyncMutationRequestDto[];
}

export class SyncTransactionDraftPayloadDto {
  @IsIn(TRANSACTION_TYPES)
  type!: "EXPENSE" | "INCOME" | "REFUND";

  @Matches(MONEY_PATTERN)
  amount!: string;

  @IsOptional()
  @Matches(CURRENCY_PATTERN)
  currency?: string;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  accountId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchant?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @IsString()
  originalTransactionId?: string | null;

  @IsOptional()
  @IsBoolean()
  isUnlinkedRefund?: boolean;

  @IsOptional()
  @IsString()
  tripId?: string | null;
}

export class CreateDraftSyncPayloadDto {
  @IsIn(RECORD_SOURCES)
  source!: "MANUAL" | "SHORTCUT" | "OCR" | "TEXT" | "VOICE" | "IMPORT";

  @IsIn(DRAFT_TARGET_TYPES)
  targetType!: "TRANSACTION";

  @ValidateNested()
  @Type(() => SyncTransactionDraftPayloadDto)
  payload!: SyncTransactionDraftPayloadDto;

  @IsOptional()
  @IsObject()
  confidence?: Record<string, number>;
}

export class UpdateDraftSyncPayloadDto {
  @ValidateNested()
  @Type(() => SyncTransactionDraftPayloadDto)
  payload!: SyncTransactionDraftPayloadDto;
}

export class CreateTripItemSyncPayloadDto {
  @IsString()
  tripId!: string;

  @IsIn(["TRANSPORT", "STAY", "ACTIVITY", "FOOD", "OTHER"])
  type!: "TRANSPORT" | "STAY" | "ACTIVITY" | "FOOD" | "OTHER";

  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsISO8601({ strict: true })
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  confirmOutOfRange?: boolean;
}
