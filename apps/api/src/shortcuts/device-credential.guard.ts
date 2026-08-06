import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { ApiException } from "../common/api-error.js";
import { RateLimiterService } from "../common/rate-limiter.service.js";
import { SecurityService } from "../common/security.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SHORTCUT_SCOPE_KEY } from "./shortcut-scope.decorator.js";

@Injectable()
export class DeviceCredentialGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly rateLimiter: RateLimiterService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requiredScope = this.reflector.getAllAndOverride<string>(
      SHORTCUT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredScope) {
      throw new UnauthorizedException("Shortcut route is missing a scope");
    }

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new ApiException(
        "CREDENTIAL_INVALID",
        401,
        "Device credential is required",
      );
    }
    const token = authorization.slice("Bearer ".length);
    const tokenHash = this.securityService.sha256(token);
    const credential = await this.prisma.deviceCredential.findUnique({
      include: { user: true },
      where: { tokenHash },
    });
    if (!credential) {
      throw new ApiException(
        "CREDENTIAL_INVALID",
        401,
        "Device credential is invalid",
      );
    }
    if (credential.revokedAt) {
      throw new ApiException(
        "CREDENTIAL_REVOKED",
        401,
        "Device credential has been revoked",
      );
    }
    if (credential.user.status !== "ACTIVE") {
      throw new ApiException(
        "ACCOUNT_NOT_ACTIVE",
        403,
        "Account is not active",
      );
    }
    const scopes = Array.isArray(credential.scopes)
      ? (credential.scopes as string[])
      : [];
    if (!scopes.includes(requiredScope)) {
      throw new ApiException(
        "FORBIDDEN",
        403,
        "Device credential lacks the required scope",
      );
    }

    const rateLimit = Number(process.env.SHORTCUT_RATE_LIMIT ?? 30);
    this.rateLimiter.consume(`shortcut:${credential.id}`, rateLimit, 60_000);
    await this.prisma.deviceCredential.update({
      data: { lastUsedAt: new Date() },
      where: { id: credential.id },
    });

    request.deviceCredential = {
      id: credential.id,
      name: credential.name,
      scopes,
      userId: credential.userId,
    };
    request.user = {
      mustChangePassword: credential.user.mustChangePassword,
      role: "USER",
      sessionId: "",
      status: "ACTIVE",
      userId: credential.userId,
      username: credential.user.username,
    };
    return true;
  }
}
