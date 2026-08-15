import { Transform, Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  Equals,
  IsArray,
  IsDefined,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type {
  AiFinalConfirmRequest,
  AiOperationAcceptRequest,
  AiOperationEditRequest,
  AiOperationRejectRequest,
  AiProposalCreateRequest,
  AiProposalListQuery,
  AiProposalRejectRequest,
  AiSelectedContext,
  Identifier,
} from "@daily-assistant/api-contracts";

/** Runtime DTO for the frozen eight-field provider input. */
export class AiSelectedContextDto implements AiSelectedContext {
  @IsString()
  @MinLength(1)
  id!: Identifier;

  @IsString()
  @Length(1, 50)
  entityType!: string;

  @IsString()
  @Length(1, 500)
  summary!: string;
}

export class AiProposalCreateDto implements AiProposalCreateRequest {
  @IsString()
  @Length(1, 2000)
  userInput!: string;

  @IsString()
  @Length(1, 80)
  requestType!: string;

  @IsString()
  @Length(1, 20)
  locale!: string;

  @IsString()
  @Length(1, 64)
  timeZoneId!: string;

  @IsString()
  @IsISO8601({ strict: true })
  currentDateTime!: string;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsArray()
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  allowedCategoryLabels!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiSelectedContextDto)
  explicitSelectedContext!: AiSelectedContextDto[];
}

export class AiOperationEditDto implements AiOperationEditRequest {
  @IsInt()
  @Min(1)
  version!: number;

  @IsObject()
  fields!: Record<string, unknown>;
}

export class AiOperationAcceptDto implements AiOperationAcceptRequest {
  @IsInt()
  @Min(1)
  version!: number;
}

export class AiOperationRejectDto implements AiOperationRejectRequest {
  @IsInt()
  @Min(1)
  version!: number;
}

export class AiProposalRejectDto implements AiProposalRejectRequest {
  @IsInt()
  @Min(1)
  version!: number;
}

export class AiFinalConfirmDto implements AiFinalConfirmRequest {
  @IsInt()
  @Min(1)
  version!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  operationIds!: [Identifier, ...Identifier[]];
}

export class AiProposalListQueryDto implements AiProposalListQuery {
  /**
   * Query values arrive as strings. Convert the literal "true"/"false"
   * strings to booleans so @Equals(true) rejects `unfinished=false`; a plain
   * @Type(() => Boolean) is avoided because Boolean("false") is true.
   */
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsDefined()
  @Equals(true)
  unfinished!: true;

  @IsOptional()
  @IsString()
  @MinLength(1)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
