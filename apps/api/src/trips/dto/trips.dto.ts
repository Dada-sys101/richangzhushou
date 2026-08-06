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

import { TRIP_ITEM_TYPES } from "@daily-assistant/api-contracts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_PATTERN = /^\d+\.\d{2}$/;

export class CreateTripDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @Length(1, 200)
  destination!: string;

  @Matches(DATE_PATTERN)
  startDate!: string;

  @Matches(DATE_PATTERN)
  endDate!: string;

  @IsOptional()
  @Matches(MONEY_PATTERN)
  budgetAmount?: string | null;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;
}

export class UpdateTripDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  destination?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  startDate?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  endDate?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN)
  budgetAmount?: string | null;

  @IsInt()
  @Min(1)
  version!: number;
}

export class ListTripsQueryDto {
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
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;
}

export class CreateTripItemDto {
  @IsIn(TRIP_ITEM_TYPES)
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

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;
}

export class UpdateTripItemDto {
  @IsOptional()
  @IsIn(TRIP_ITEM_TYPES)
  type?: "TRANSPORT" | "STAY" | "ACTIVITY" | "FOOD" | "OTHER";

  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  endsAt?: string;

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

  @IsInt()
  @Min(1)
  version!: number;
}

export class CreatePackingItemDto {
  @IsString()
  @Length(1, 200)
  text!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;
}

export class UpdatePackingItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  text?: string;

  @IsOptional()
  @IsBoolean()
  checked?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsInt()
  @Min(1)
  version!: number;
}
