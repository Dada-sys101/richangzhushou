import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { ApiException } from "../common/api-error.js";
import { RateLimiterService } from "../common/rate-limiter.service.js";
import { CookieService } from "./cookie.service.js";
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto.js";
import { RefreshTokenGuard } from "./refresh-token.guard.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { AuthService, type AuthSessionResult } from "./auth.service.js";
import { toAuthResponse } from "./session-response.js";

const REFRESH_COOKIE_NAME = "da_refresh";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.rateLimiter.consume(
      `register:${request.ip ?? "unknown"}`,
      10,
      60 * 60 * 1000,
    );
    const result = await this.authService.register(dto);
    this.writeSession(response, result);
    return toAuthResponse(result);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.rateLimiter.consume(
      `login:${request.ip ?? "unknown"}:${dto.email.toLowerCase()}`,
      10,
      15 * 60 * 1000,
    );
    const result = await this.authService.login(dto);
    this.writeSession(response, result);
    return toAuthResponse(result);
  }

  @Post("refresh")
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!request.refreshSession) {
      throw new ApiException(
        "REFRESH_TOKEN_INVALID",
        401,
        "Refresh session is missing",
      );
    }
    const result = await this.authService.refreshSession(
      request.refreshSession,
    );
    this.writeSession(response, result);
    return toAuthResponse(result);
  }

  @Post("logout")
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      await this.authService.logout(token);
    }
    this.cookieService.clearRefreshCookie(response);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    this.rateLimiter.consume(
      `forgot:${request.ip ?? "unknown"}:${dto.email.toLowerCase()}`,
      5,
      60 * 60 * 1000,
    );
    await this.authService.forgotPassword(dto);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    this.rateLimiter.consume(
      `reset:${request.ip ?? "unknown"}`,
      10,
      15 * 60 * 1000,
    );
    await this.authService.resetPassword(dto);
  }

  private writeSession(response: Response, result: AuthSessionResult): void {
    this.cookieService.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );
  }
}
