import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Observable } from "rxjs";

import { ApiException } from "../common/api-error.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SecurityService } from "../common/security.service.js";
import type { AuthenticatedRequest, AuthUser } from "./auth.types.js";

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly securityService: SecurityService,
    private readonly prisma: PrismaService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return this.validate(context);
  }

  private async validate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new ApiException("UNAUTHORIZED", 401, "Access token is required");
    }

    let payload: { sessionId: string; sub: string; role: string };
    try {
      payload = await this.securityService.verifyAccessToken(
        authorization.slice("Bearer ".length),
      );
    } catch {
      throw new ApiException("UNAUTHORIZED", 401, "Access token is invalid");
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new ApiException("UNAUTHORIZED", 401, "Session is no longer valid");
    }
    if (session.user.status !== "ACTIVE") {
      throw new ApiException(
        "ACCOUNT_NOT_ACTIVE",
        403,
        "Account is not active",
      );
    }

    const user: AuthUser = {
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
      status: session.user.status,
      userId: session.user.id,
    };
    request.user = user;
    return true;
  }
}
