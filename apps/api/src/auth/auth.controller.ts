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
import { LoginDto } from "./dto/auth.dto.js";
import { RefreshTokenGuard } from "./refresh-token.guard.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { AuthService, type AuthSessionResult } from "./auth.service.js";
import { toAuthResponse } from "./session-response.js";

const REFRESH_COOKIE_NAME = "da_refresh";

@Controller("auth")
export class AuthController {
  private readonly loginLimit: number;
  private readonly loginWindowMs: number;

  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    const parsedLimit = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10);
    const parsedWindow = Number(
      process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000,
    );
    this.loginLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.floor(parsedLimit)
        : 10;
    this.loginWindowMs =
      Number.isFinite(parsedWindow) && parsedWindow > 0
        ? Math.floor(parsedWindow)
        : 15 * 60 * 1000;
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.rateLimiter.consume(
      `login:${request.ip ?? "unknown"}:${dto.username.toLowerCase()}`,
      this.loginLimit,
      this.loginWindowMs,
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

  private writeSession(response: Response, result: AuthSessionResult): void {
    this.cookieService.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );
  }
}
