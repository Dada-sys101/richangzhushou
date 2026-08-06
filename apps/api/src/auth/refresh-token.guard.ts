import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Observable } from "rxjs";

import { ApiException } from "../common/api-error.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SecurityService } from "../common/security.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

const REFRESH_COOKIE_NAME = "da_refresh";

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return this.validate(context);
  }

  private async validate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new ApiException(
        "REFRESH_TOKEN_REQUIRED",
        401,
        "Refresh token cookie is required",
      );
    }

    const tokenHash = this.securityService.sha256(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new ApiException(
        "REFRESH_TOKEN_INVALID",
        401,
        "Refresh token is invalid",
      );
    }
    if (session.user.status !== "ACTIVE") {
      throw new ApiException(
        "ACCOUNT_NOT_ACTIVE",
        403,
        "Account is not active",
      );
    }

    request.refreshSession = session;
    request.user = {
      mustChangePassword: session.user.mustChangePassword,
      role: session.user.role,
      sessionId: session.id,
      status: session.user.status,
      userId: session.user.id,
      username: session.user.username,
    };
    return true;
  }
}
