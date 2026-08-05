import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

import { PRIORITIES, TASK_STATUSES } from "@daily-assistant/api-contracts";

export class CreateTaskDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: "LOW" | "MEDIUM" | "HIGH";

  @IsOptional()
  @IsISO8601({ strict: true })
  dueAt?: string | null;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  clientMutationId?: string | null;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: "LOW" | "MEDIUM" | "HIGH";

  @IsOptional()
  @IsISO8601({ strict: true })
  dueAt?: string | null;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: "OPEN" | "COMPLETED" | "CANCELLED";

  @IsInt()
  @Min(1)
  version!: number;
}

export class ListTasksQueryDto {
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
  @IsIn(TASK_STATUSES)
  status?: "OPEN" | "COMPLETED" | "CANCELLED";

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
