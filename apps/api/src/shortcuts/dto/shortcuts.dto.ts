import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";
import {
  SHORTCUT_SCOPES,
  TRANSACTION_TYPES,
  type ShortcutScope,
} from "@daily-assistant/api-contracts";

const MONEY_PATTERN = /^\d+\.\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class CreateShortcutCredentialDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(SHORTCUT_SCOPES, { each: true })
  scopes!: ShortcutScope[];
}

export class ShortcutTransactionDraftDto {
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
