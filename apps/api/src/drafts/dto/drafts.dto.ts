import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
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
  DRAFT_STATUSES,
  TRANSACTION_TYPES,
} from "@daily-assistant/api-contracts";

const MONEY_PATTERN = /^\d+\.\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class ParseTextDto {
  @IsString()
  @Length(1, 2000)
  text!: string;
}

export class OcrDraftDto {
  @IsString()
  attachmentId!: string;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;
}

export class DraftPayloadDto {
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
}

export class UpdateDraftDto {
  @ValidateNested()
  @Type(() => DraftPayloadDto)
  payload!: DraftPayloadDto;

  @IsInt()
  @Min(1)
  version!: number;
}

export class ListDraftsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(DRAFT_STATUSES)
  status?: "PENDING" | "CONFIRMED" | "DISCARDED" | "FAILED";
}

export class BatchDiscardDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids?: string[];

  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class BatchDiscardConfirmDto {
  @IsString()
  @Length(32, 512)
  confirmationToken!: string;
}
