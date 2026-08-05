import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ATTACHMENT_OWNER_TYPES } from "@daily-assistant/api-contracts";

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export class UploadIntentDto {
  @IsIn(ATTACHMENT_OWNER_TYPES)
  ownerType!: "TRANSACTION_DRAFT";

  @IsString()
  @MaxLength(100)
  mimeType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_SIZE)
  size?: number;
}
