import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import {
  REMINDER_SCHEDULE_TYPES,
  REMINDER_STATUSES,
  REMINDER_TARGET_TYPES,
} from "@daily-assistant/api-contracts";

export class ReminderRecurrenceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  interval?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  until?: string | null;
}

export class CreateReminderDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @IsIn(REMINDER_TARGET_TYPES)
  targetType?: "CALENDAR_EVENT" | "TASK" | "STANDALONE";

  @IsOptional()
  @IsString()
  targetId?: string | null;

  @IsIn(REMINDER_SCHEDULE_TYPES)
  scheduleType!: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";

  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReminderRecurrenceDto)
  recurrence?: ReminderRecurrenceDto | null;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;
}

export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @IsIn(REMINDER_TARGET_TYPES)
  targetType?: "CALENDAR_EVENT" | "TASK" | "STANDALONE";

  @IsOptional()
  @IsString()
  targetId?: string | null;

  @IsOptional()
  @IsIn(REMINDER_SCHEDULE_TYPES)
  scheduleType?: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";

  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReminderRecurrenceDto)
  recurrence?: ReminderRecurrenceDto | null;

  @IsOptional()
  @IsIn(REMINDER_STATUSES)
  status?: "SCHEDULED" | "SENT" | "CANCELLED" | "FAILED" | "SUPPRESSED";

  @IsInt()
  @Min(1)
  version!: number;
}

export class ListRemindersQueryDto {
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
  @IsIn(REMINDER_STATUSES)
  status?: "SCHEDULED" | "SENT" | "CANCELLED" | "FAILED" | "SUPPRESSED";

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
