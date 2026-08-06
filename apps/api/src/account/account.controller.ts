import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { CookieService } from "../auth/cookie.service.js";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { AuthService } from "../auth/auth.service.js";
import { toAuthResponse } from "../auth/session-response.js";
import {
  CloseAccountDto,
  ReopenAccountDto,
  RequestDeletionDto,
} from "../auth/dto/auth.dto.js";

@Controller()
export class AccountController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) {}

  @Get("me")
  @UseGuards(AccessTokenGuard)
  async getMe(@Req() request: AuthenticatedRequest) {
    if (!request.user) {
      return null;
    }
    return this.authService.getCurrentUser(request.user.userId);
  }

  @Post("me/close")
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async closeMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CloseAccountDto,
  ): Promise<void> {
    if (!request.user) {
      return;
    }
    await this.authService.closeAccount(
      request.user.userId,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Post("me/reopen")
  @HttpCode(HttpStatus.OK)
  async reopen(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReopenAccountDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.reopenAccount(
      dto,
      request.requestId ?? "unknown",
    );
    this.cookieService.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );
    return toAuthResponse(result);
  }

  @Post("me/request-deletion")
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async requestDeletion(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestDeletionDto,
  ): Promise<void> {
    if (!request.user) {
      return;
    }
    await this.authService.requestDeletion(
      request.user.userId,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Delete("me/sessions")
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAllSessions(@Req() request: AuthenticatedRequest): Promise<void> {
    if (!request.user) {
      return;
    }
    await this.authService.revokeAllSessions(request.user.userId);
  }

  @Delete("me/sessions/:sessionId")
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param("sessionId") sessionId: string,
  ): Promise<void> {
    if (!request.user) {
      return;
    }
    await this.authService.revokeSession(request.user.userId, sessionId);
  }
}
