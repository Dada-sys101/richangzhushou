import {
  Body,
  Controller,
  Get,
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
import { DraftsService } from "./drafts.service.js";
import {
  BatchDiscardConfirmDto,
  BatchDiscardDto,
  ListDraftsQueryDto,
  OcrDraftDto,
  ParseTextDto,
  UpdateDraftDto,
} from "./dto/drafts.dto.js";

@Controller()
@UseGuards(AccessTokenGuard, UserOnlyGuard)
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Post("drafts/parse-text")
  @HttpCode(HttpStatus.CREATED)
  parseText(@Req() request: AuthenticatedRequest, @Body() dto: ParseTextDto) {
    return this.draftsService.createTextDraft(this.userId(request), dto);
  }

  @Post("drafts/ocr")
  @HttpCode(HttpStatus.CREATED)
  createOcrDraft(
    @Req() request: AuthenticatedRequest,
    @Body() dto: OcrDraftDto,
  ) {
    return this.draftsService.createOcrDraft(this.userId(request), dto);
  }

  @Get("drafts")
  listDrafts(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListDraftsQueryDto,
  ) {
    return this.draftsService.listDrafts(this.userId(request), query);
  }

  @Post("drafts/batch-discard")
  @HttpCode(HttpStatus.OK)
  createBatchDiscard(
    @Req() request: AuthenticatedRequest,
    @Body() dto: BatchDiscardDto,
  ) {
    return this.draftsService.createBatchDiscardIntent(
      this.userId(request),
      dto,
    );
  }

  @Post("drafts/batch-discard/confirm")
  @HttpCode(HttpStatus.OK)
  confirmBatchDiscard(
    @Req() request: AuthenticatedRequest,
    @Body() dto: BatchDiscardConfirmDto,
  ) {
    return this.draftsService.confirmBatchDiscard(
      this.userId(request),
      dto,
      request.requestId ?? "req_missing",
    );
  }

  @Get("drafts/:id")
  getDraft(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.draftsService.getDraft(this.userId(request), id);
  }

  @Patch("drafts/:id")
  updateDraft(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.draftsService.updateDraft(this.userId(request), id, dto);
  }

  @Post("drafts/:id/confirm")
  @HttpCode(HttpStatus.CREATED)
  confirmDraft(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.draftsService.confirmDraft(this.userId(request), id);
  }

  @Post("drafts/:id/discard")
  @HttpCode(HttpStatus.NO_CONTENT)
  async discardDraft(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.draftsService.discardDraft(this.userId(request), id);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}
