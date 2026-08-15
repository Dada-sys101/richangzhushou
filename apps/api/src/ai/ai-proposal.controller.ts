import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UserOnlyGuard } from "../auth/user-only.guard.js";
import { ApiException } from "../common/api-error.js";
import { AiProposalApplicationPort } from "./ai-proposal.application-port.js";
import {
  AiFinalConfirmDto,
  AiOperationAcceptDto,
  AiOperationEditDto,
  AiOperationRejectDto,
  AiProposalCreateDto,
  AiProposalListQueryDto,
  AiProposalRejectDto,
} from "./dto/ai-proposal.dto.js";

/**
 * PR18 AI Proposal HTTP adapter.
 *
 * Thin by design: each handler only performs authenticated-user extraction
 * and the required Idempotency-Key header validation, then delegates to the
 * AiProposalApplicationPort. No state transitions, no Prisma/DB, no Fake
 * Provider, no Domain Service and no business write live here. Accept and
 * final confirmation are deliberately separate controller methods.
 */
@Controller("ai/proposals")
@UseGuards(AccessTokenGuard, UserOnlyGuard)
export class AiProposalController {
  constructor(private readonly applicationPort: AiProposalApplicationPort) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: AiProposalCreateDto,
  ) {
    if (!idempotencyKey) {
      throw new ApiException(
        "VALIDATION_ERROR",
        HttpStatus.BAD_REQUEST,
        "Idempotency-Key header is required",
        [{ field: "Idempotency-Key", message: "缺少幂等键" }],
      );
    }
    return this.applicationPort.create(
      this.userId(request),
      idempotencyKey,
      dto,
    );
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: AiProposalListQueryDto,
  ) {
    return this.applicationPort.list(this.userId(request), query);
  }

  @Get(":proposalId")
  get(
    @Req() request: AuthenticatedRequest,
    @Param("proposalId") proposalId: string,
  ) {
    return this.applicationPort.get(this.userId(request), proposalId);
  }

  @Patch(":proposalId/operations/:operationId")
  editOperation(
    @Req() request: AuthenticatedRequest,
    @Param("proposalId") proposalId: string,
    @Param("operationId") operationId: string,
    @Body() dto: AiOperationEditDto,
  ) {
    return this.applicationPort.editOperation(
      this.userId(request),
      proposalId,
      operationId,
      dto,
    );
  }

  @Post(":proposalId/operations/:operationId/accept")
  acceptOperation(
    @Req() request: AuthenticatedRequest,
    @Param("proposalId") proposalId: string,
    @Param("operationId") operationId: string,
    @Body() dto: AiOperationAcceptDto,
  ) {
    return this.applicationPort.acceptOperation(
      this.userId(request),
      proposalId,
      operationId,
      dto,
    );
  }

  @Post(":proposalId/operations/:operationId/reject")
  rejectOperation(
    @Req() request: AuthenticatedRequest,
    @Param("proposalId") proposalId: string,
    @Param("operationId") operationId: string,
    @Body() dto: AiOperationRejectDto,
  ) {
    return this.applicationPort.rejectOperation(
      this.userId(request),
      proposalId,
      operationId,
      dto,
    );
  }

  @Post(":proposalId/reject")
  rejectProposal(
    @Req() request: AuthenticatedRequest,
    @Param("proposalId") proposalId: string,
    @Body() dto: AiProposalRejectDto,
  ) {
    return this.applicationPort.rejectProposal(
      this.userId(request),
      proposalId,
      dto,
    );
  }

  @Post(":proposalId/final-confirm")
  finalConfirm(
    @Req() request: AuthenticatedRequest,
    @Param("proposalId") proposalId: string,
    @Body() dto: AiFinalConfirmDto,
  ) {
    return this.applicationPort.finalConfirm(
      this.userId(request),
      proposalId,
      dto,
    );
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}
