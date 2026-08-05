import { Injectable } from "@nestjs/common";
import type { Response } from "express";

const REFRESH_COOKIE_NAME = "da_refresh";
const DEFAULT_API_BASE_PATH = "/api/v1";

@Injectable()
export class CookieService {
  private readonly cookiePath: string;

  constructor() {
    const basePath = process.env.API_BASE_PATH ?? DEFAULT_API_BASE_PATH;
    this.cookiePath = `${basePath}/auth`;
  }

  setRefreshCookie(
    response: Response,
    refreshToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      expires: expiresAt,
      httpOnly: true,
      path: this.cookiePath,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      path: this.cookiePath,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}
