import { Type } from "class-transformer";
import {
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
} from "class-validator";
import {
  CATEGORY_KINDS,
  FINANCIAL_ACCOUNT_KINDS,
  RECORD_SOURCES,
  TRANSACTION_TYPES,
} from "@daily-assistant/api-contracts";

const MONTH_PATTERN = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const MONEY_PATTERN = /^\d+\.\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class CreateTransactionDto {
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
  @IsIn(RECORD_SOURCES)
  source?: "MANUAL" | "SHORTCUT" | "TEXT" | "VOICE" | "IMPORT";

  @IsOptional()
  @IsString()
  originalTransactionId?: string | null;

  @IsOptional()
  @IsBoolean()
  isUnlinkedRefund?: boolean;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  sourceFingerprint?: string | null;

  @IsOptional()
  @IsString()
  tripId?: string | null;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: "EXPENSE" | "INCOME" | "REFUND";

  @IsOptional()
  @Matches(MONEY_PATTERN)
  amount?: string;

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
  @IsIn(RECORD_SOURCES)
  source?: "MANUAL" | "SHORTCUT" | "TEXT" | "VOICE" | "IMPORT";

  @IsOptional()
  @IsString()
  originalTransactionId?: string | null;

  @IsOptional()
  @IsBoolean()
  isUnlinkedRefund?: boolean;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  sourceFingerprint?: string | null;

  @IsOptional()
  @IsString()
  tripId?: string | null;

  @IsInt()
  @Min(1)
  version!: number;
}

export class ListTransactionsQueryDto {
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
  @Matches(MONTH_PATTERN)
  month?: string;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: "EXPENSE" | "INCOME" | "REFUND";

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;
}

export class CreateCategoryDto {
  @IsIn(CATEGORY_KINDS)
  kind!: "EXPENSE" | "INCOME";

  @IsString()
  @Length(1, 40)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;

  @IsOptional()
  @Matches(COLOR_PATTERN)
  color?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsIn(CATEGORY_KINDS)
  kind?: "EXPENSE" | "INCOME";

  @IsOptional()
  @IsString()
  @Length(1, 40)
  name?: string;

  @IsOptional()
  @Matches(COLOR_PATTERN)
  color?: string;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsInt()
  @Min(1)
  version!: number;
}

export class ListCategoriesQueryDto {
  @IsOptional()
  @IsIn(CATEGORY_KINDS)
  kind?: "EXPENSE" | "INCOME";

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;
}

export class CreateFinancialAccountDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsIn(FINANCIAL_ACCOUNT_KINDS)
  kind!: "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "DIGITAL_WALLET" | "OTHER";

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;
}

export class UpdateFinancialAccountDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  name?: string;

  @IsOptional()
  @IsIn(FINANCIAL_ACCOUNT_KINDS)
  kind?: "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "DIGITAL_WALLET" | "OTHER";

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsInt()
  @Min(1)
  version!: number;
}

export class ListFinancialAccountsQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;
}

export class CreateBudgetDto {
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @Matches(MONTH_PATTERN)
  month!: string;

  @Matches(MONEY_PATTERN)
  amount!: string;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;

  @IsOptional()
  @Matches(CURRENCY_PATTERN)
  currency?: string;
}

export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @Matches(MONTH_PATTERN)
  month?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN)
  amount?: string;

  @IsOptional()
  @Matches(CURRENCY_PATTERN)
  currency?: string;

  @IsInt()
  @Min(1)
  version!: number;
}

export class ListBudgetsQueryDto {
  @IsOptional()
  @Matches(MONTH_PATTERN)
  month?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class SummaryQueryDto {
  @IsOptional()
  @Matches(MONTH_PATTERN)
  month?: string;
}

export class ExportCsvQueryDto {
  @IsOptional()
  @Matches(MONTH_PATTERN)
  month?: string;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: "EXPENSE" | "INCOME" | "REFUND";
}
