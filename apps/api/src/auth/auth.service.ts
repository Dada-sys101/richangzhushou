import { Injectable } from "@nestjs/common";

import type { UserSummary } from "@daily-assistant/api-contracts";

import { Prisma, type Session, type User } from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { SecurityService } from "../common/security.service.js";
import { CapacityService } from "../capacity/capacity.service.js";
import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { normalizeUsername, toUserSummary } from "../users/user.mapper.js";
import { deletionScheduledAt } from "../account-deletion/account-deletion.config.js";
import type {
  ChangePasswordDto,
  CloseAccountDto,
  LoginDto,
  RequestDeletionDto,
} from "./dto/auth.dto.js";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$Ht2PHTnRws3KIfci8tLQIg$dOOYvHS0kYHUhgaEeHnBpV6xdQYNQP45uAvz/QM4mOc";

export interface AuthSessionResult {
  accessToken: string;
  expiresIn: number;
  mustChangePassword: boolean;
  refreshExpiresAt: Date;
  refreshToken: string;
  user: UserSummary;
}

@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly capacityService: CapacityService,
    private readonly auditService: AuditService,
  ) {
    this.refreshTtlMs =
      Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 60 * 60) * 1000;
  }

  async login(dto: LoginDto): Promise<AuthSessionResult> {
    const normalizedUsername = normalizeUsername(dto.username);
    const user = await this.prisma.user.findUnique({
      where: { normalizedUsername },
    });
    const passwordMatches = user
      ? await this.securityService.verifyPassword(
          dto.password,
          user.passwordHash,
        )
      : await this.securityService
          .verifyPassword(dto.password, DUMMY_PASSWORD_HASH)
          .catch(() => false);
    if (!user || !passwordMatches) {
      throw new ApiException(
        "INVALID_CREDENTIALS",
        401,
        "Username or password is incorrect",
      );
    }
    if (user.status !== "ACTIVE") {
      throw new ApiException(
        "ACCOUNT_NOT_ACTIVE",
        403,
        "Account is not active",
      );
    }

    const refreshToken = this.securityService.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    const session = await this.prisma.session.create({
      data: {
        expiresAt: refreshExpiresAt,
        refreshTokenHash: this.securityService.sha256(refreshToken),
        userId: user.id,
      },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const { expiresIn, token } = await this.securityService.signAccessToken(
      user.id,
      user.role,
      session.id,
    );
    return {
      accessToken: token,
      expiresIn,
      mustChangePassword: user.mustChangePassword,
      refreshExpiresAt,
      refreshToken,
      user: toUserSummary(user),
    };
  }

  async refreshSession(
    session: Session & { user: User },
  ): Promise<AuthSessionResult> {
    const refreshToken = this.securityService.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);

    const newSession = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { lastUsedAt: new Date(), revokedAt: new Date() },
      });
      if (revoked.count === 0) {
        throw new ApiException(
          "REFRESH_TOKEN_INVALID",
          401,
          "Refresh token is no longer valid",
        );
      }
      return tx.session.create({
        data: {
          expiresAt: refreshExpiresAt,
          refreshTokenHash: this.securityService.sha256(refreshToken),
          userId: session.userId,
        },
      });
    });

    const { expiresIn, token } = await this.securityService.signAccessToken(
      session.userId,
      session.user.role,
      newSession.id,
    );
    return {
      accessToken: token,
      expiresIn,
      mustChangePassword: session.user.mustChangePassword,
      refreshExpiresAt,
      refreshToken,
      user: toUserSummary(session.user),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        refreshTokenHash: this.securityService.sha256(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const currentMatches = await this.securityService.verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentMatches) {
      throw new ApiException(
        "INVALID_CURRENT_PASSWORD",
        401,
        "Current password is incorrect",
      );
    }
    const passwordHash = await this.securityService.hashPassword(
      dto.newPassword,
    );
    await this.prisma.user.update({
      data: {
        mustChangePassword: false,
        passwordHash,
      },
      where: { id: userId },
    });
  }

  async closeAccount(
    userId: string,
    dto: CloseAccountDto,
    requestId: string,
  ): Promise<void> {
    await this.verifyOwnPassword(userId, dto.password);
    await this.capacityService.withCapacityRetry(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, status: "ACTIVE" },
        data: { closedAt: new Date(), status: "CLOSED" },
      });
      if (updated.count === 0) {
        throw new ApiException(
          "ACCOUNT_NOT_ACTIVE",
          403,
          "Only an active account can be closed",
        );
      }
      await tx.session.updateMany({
        where: { revokedAt: null, userId },
        data: { revokedAt: new Date() },
      });
      await this.auditService.recordInTx(tx, {
        action: "USER_CLOSE",
        actorId: userId,
        after: { status: "CLOSED" },
        before: { status: "ACTIVE" },
        reason: dto.reason,
        requestId,
        targetId: userId,
        targetType: "User",
      });
    });
  }

  async requestDeletion(
    userId: string,
    dto: RequestDeletionDto,
    requestId: string,
  ): Promise<void> {
    await this.verifyOwnPassword(userId, dto.password);
    await this.capacityService.withCapacityRetry(async (tx) => {
      const requestedAt = new Date();
      const scheduledAt = deletionScheduledAt(requestedAt);
      const updated = await tx.user.updateMany({
        where: { id: userId, status: "ACTIVE" },
        data: {
          deletionRequestedAt: requestedAt,
          deletionScheduledAt: scheduledAt,
          status: "DELETION_PENDING",
        },
      });
      if (updated.count === 0) {
        throw new ApiException(
          "ACCOUNT_NOT_ACTIVE",
          403,
          "Only an active account can request deletion",
        );
      }
      await tx.session.updateMany({
        where: { revokedAt: null, userId },
        data: { revokedAt: new Date() },
      });
      await this.auditService.recordInTx(tx, {
        action: "USER_DELETE_REQUEST",
        actorId: userId,
        after: {
          deletionRequestedAt: requestedAt.toISOString(),
          deletionScheduledAt: scheduledAt.toISOString(),
          status: "DELETION_PENDING",
        },
        before: { status: "ACTIVE" },
        reason: dto.reason,
        requestId,
        targetId: userId,
        targetType: "User",
      });
    });
  }

  async getCurrentUser(userId: string): Promise<UserSummary> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return toUserSummary(user);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const updated = await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null, userId },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Session not found");
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { revokedAt: null, userId },
      data: { revokedAt: new Date() },
    });
  }

  private async verifyOwnPassword(
    userId: string,
    password: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const matches = await this.securityService.verifyPassword(
      password,
      user.passwordHash,
    );
    if (!matches) {
      throw new ApiException(
        "INVALID_CREDENTIALS",
        401,
        "Password is incorrect",
      );
    }
  }

  private async createSessionInTx(
    tx: Prisma.TransactionClient,
    user: User,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): Promise<AuthSessionResult> {
    const session = await tx.session.create({
      data: {
        expiresAt: refreshExpiresAt,
        refreshTokenHash: this.securityService.sha256(refreshToken),
        userId: user.id,
      },
    });
    const { expiresIn, token } = await this.securityService.signAccessToken(
      user.id,
      user.role,
      session.id,
    );
    return {
      accessToken: token,
      expiresIn,
      mustChangePassword: user.mustChangePassword,
      refreshExpiresAt,
      refreshToken,
      user: toUserSummary(user),
    };
  }
}
