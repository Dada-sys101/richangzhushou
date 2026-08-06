import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UserOnlyGuard } from "../auth/user-only.guard.js";
import { RateLimiterService } from "../common/rate-limiter.service.js";
import {
  ListSyncChangesQueryDto,
  SyncMutationBatchRequestDto,
} from "./dto/sync.dto.js";
import { SyncService } from "./sync.service.js";

@Controller()
@UseGuards(AccessTokenGuard, UserOnlyGuard)
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Get("sync/changes")
  listChanges(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListSyncChangesQueryDto,
  ) {
    const userId = this.userId(request);
    this.rateLimiter.consume(`sync:changes:${userId}`, 120, 60_000);
    return this.syncService.listChanges(userId, query);
  }

  @Post("sync/mutations")
  @HttpCode(HttpStatus.OK)
  applyMutations(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SyncMutationBatchRequestDto,
  ) {
    const userId = this.userId(request);
    this.rateLimiter.consume(`sync:mutations:${userId}`, 30, 60_000);
    return this.syncService.applyMutations(userId, dto);
  }

  @Get("sync/status")
  getStatus(@Req() request: AuthenticatedRequest) {
    const userId = this.userId(request);
    this.rateLimiter.consume(`sync:status:${userId}`, 120, 60_000);
    return this.syncService.getStatus(userId);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}
