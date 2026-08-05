import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { ATTACHMENT_OWNER_TYPES } from "@daily-assistant/api-contracts";

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export class UploadIntentDto {
  @IsIn(ATTACHMENT_OWNER_TYPES)
  ownerType!: "TRANSACTION_DRAFT";

  @IsIn(ALLOWED_ATTACHMENT_MIME_TYPES)
  mimeType!: (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_SIZE)
  size?: number;
}
