import { Injectable } from "@nestjs/common";

import type { UserSummary } from "@daily-assistant/api-contracts";

import { Prisma, type Session, type User } from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { SecurityService } from "../common/security.service.js";
import { CapacityService } from "../capacity/capacity.service.js";
import { AuditService } from "../audit/audit.service.js";
import { MailAdapter, type RecoveryMailKind } from "../mail/mail.adapter.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { normalizeEmail, toUserSummary } from "../users/user.mapper.js";
import type {
  CloseAccountDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ReopenAccountDto,
  RequestDeletionDto,
  ResetPasswordDto,
} from "./dto/auth.dto.js";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$Ht2PHTnRws3KIfci8tLQIg$dOOYvHS0kYHUhgaEeHnBpV6xdQYNQP45uAvz/QM4mOc";
const RECOVERY_TTL_MS = 30 * 60 * 1000;

export interface AuthSessionResult {
  accessToken: string;
  expiresIn: number;
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
    private readonly mailAdapter: MailAdapter,
  ) {
    this.refreshTtlMs =
      Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 60 * 60) * 1000;
  }

  async register(dto: RegisterDto): Promise<AuthSessionResult> {
    const passwordHash = await this.securityService.hashPassword(dto.password);
    const refreshToken = this.securityService.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    const normalizedEmail = normalizeEmail(dto.email);

    return this.capacityService.withCapacityRetry(async (tx) => {
      const settings = await tx.systemSetting.findUniqueOrThrow({
        where: { id: "singleton" },
      });
      if (!settings.registrationEnabled) {
        throw new ApiException(
          "REGISTRATION_DISABLED",
          403,
          "Registration is currently disabled",
        );
      }

      let invite: {
        id: string;
        maxUses: number;
        usedCount: number;
      } | null = null;
      if (settings.inviteRequired) {
        if (!dto.inviteCode) {
          throw new ApiException(
            "INVITE_INVALID",
            400,
            "Invite code is required",
          );
        }
        const code = dto.inviteCode.trim().toUpperCase();
        const codeHash = this.securityService.sha256(code);
        await this.capacityService.lockInviteCode(tx, codeHash);
        const storedInvite = await tx.inviteCode.findUnique({
          where: { codeHash },
        });
        if (!storedInvite) {
          throw new ApiException(
            "INVITE_INVALID",
            400,
            "Invite code is invalid",
          );
        }
        if (
          storedInvite.status !== "ACTIVE" ||
          storedInvite.usedCount >= storedInvite.maxUses
        ) {
          throw new ApiException(
            "INVITE_EXHAUSTED",
            409,
            "Invite code has no remaining uses",
          );
        }
        if (storedInvite.expiresAt && storedInvite.expiresAt <= new Date()) {
          throw new ApiException(
            "INVITE_EXPIRED",
            410,
            "Invite code has expired",
          );
        }
        invite = {
          id: storedInvite.id,
          maxUses: storedInvite.maxUses,
          usedCount: storedInvite.usedCount,
        };
      }

      const existing = await tx.user.findUnique({
        where: { normalizedEmail },
      });
      if (existing) {
        throw new ApiException(
          "EMAIL_ALREADY_REGISTERED",
          409,
          "An account with this email already exists",
        );
      }

      const occupied = await this.capacityService.countOccupied(tx);
      if (occupied >= settings.maxActiveUsers) {
        throw new ApiException(
          "CAPACITY_REACHED",
          409,
          "The experience is currently full",
        );
      }

      const user = await tx.user.create({
        data: {
          displayName: dto.displayName.trim(),
          email: dto.email.trim(),
          normalizedEmail,
          passwordHash,
          role: "USER",
          status: "ACTIVE",
        },
      });

      if (invite) {
        const nextCount = invite.usedCount + 1;
        await tx.inviteCode.update({
          where: { id: invite.id },
          data: {
            status: nextCount >= invite.maxUses ? "EXHAUSTED" : "ACTIVE",
            usedCount: nextCount,
          },
        });
        await tx.inviteRedemption.create({
          data: { inviteId: invite.id, userId: user.id },
        });
      }

      return this.createSessionInTx(tx, user, refreshToken, refreshExpiresAt);
    });
  }

  async login(dto: LoginDto): Promise<AuthSessionResult> {
    const normalizedEmail = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
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
        "Email or password is incorrect",
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

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const normalizedEmail = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
    if (
      !user ||
      user.status === "DELETION_PENDING" ||
      user.status === "DELETED"
    ) {
      return;
    }

    const kind: RecoveryMailKind =
      user.status === "CLOSED" ? "REOPEN" : "PASSWORD_RESET";
    const token = this.securityService.generateRecoveryToken();
    const expiresAt = new Date(Date.now() + RECOVERY_TTL_MS);
    await this.prisma.recoveryCode.create({
      data: {
        expiresAt,
        kind,
        tokenHash: this.securityService.sha256(token),
        userId: user.id,
      },
    });
    await this.mailAdapter.sendRecovery({
      email: user.email,
      expiresAt,
      kind,
      token,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.securityService.sha256(dto.recoveryToken);
    const passwordHash = await this.securityService.hashPassword(
      dto.newPassword,
    );
    await this.prisma.$transaction(async (tx) => {
      const code = await tx.recoveryCode.findUnique({
        where: { tokenHash },
      });
      if (!code || code.kind !== "PASSWORD_RESET") {
        throw new ApiException(
          "RECOVERY_TOKEN_INVALID",
          400,
          "Recovery token is invalid",
        );
      }
      if (code.usedAt) {
        throw new ApiException(
          "RECOVERY_TOKEN_USED",
          409,
          "Recovery token has already been used",
        );
      }
      if (code.expiresAt <= new Date()) {
        throw new ApiException(
          "RECOVERY_TOKEN_EXPIRED",
          410,
          "Recovery token has expired",
        );
      }
      const consumed = await tx.recoveryCode.updateMany({
        where: { id: code.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count === 0) {
        throw new ApiException(
          "RECOVERY_TOKEN_USED",
          409,
          "Recovery token has already been used",
        );
      }
      await tx.user.update({
        where: { id: code.userId },
        data: { passwordHash },
      });
      await tx.session.updateMany({
        where: { revokedAt: null, userId: code.userId },
        data: { revokedAt: new Date() },
      });
    });
  }

  async reopenAccount(
    dto: ReopenAccountDto,
    requestId: string,
  ): Promise<AuthSessionResult> {
    const tokenHash = this.securityService.sha256(dto.recoveryToken);
    const passwordHash = await this.securityService.hashPassword(
      dto.newPassword,
    );
    const refreshToken = this.securityService.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);

    return this.capacityService.withCapacityRetry(async (tx) => {
      const code = await tx.recoveryCode.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!code || code.kind !== "REOPEN") {
        throw new ApiException(
          "RECOVERY_TOKEN_INVALID",
          400,
          "Recovery token is invalid",
        );
      }
      if (code.usedAt) {
        throw new ApiException(
          "RECOVERY_TOKEN_USED",
          409,
          "Recovery token has already been used",
        );
      }
      if (code.expiresAt <= new Date()) {
        throw new ApiException(
          "RECOVERY_TOKEN_EXPIRED",
          410,
          "Recovery token has expired",
        );
      }
      if (code.user.status !== "CLOSED") {
        throw new ApiException(
          "REOPEN_NOT_ALLOWED",
          400,
          "This recovery credential cannot reopen an active account",
        );
      }

      const settings = await tx.systemSetting.findUniqueOrThrow({
        where: { id: "singleton" },
      });
      const occupied = await this.capacityService.countOccupied(tx);
      if (occupied >= settings.maxActiveUsers) {
        throw new ApiException(
          "REOPEN_CAPACITY_REACHED",
          409,
          "The experience is currently full",
        );
      }

      await tx.recoveryCode.update({
        where: { id: code.id },
        data: { usedAt: new Date() },
      });
      const user = await tx.user.update({
        where: { id: code.userId },
        data: {
          closedAt: null,
          deletionRequestedAt: null,
          passwordHash,
          status: "ACTIVE",
        },
      });
      await this.auditService.recordInTx(tx, {
        action: "USER_REOPEN",
        actorId: user.id,
        after: { status: user.status },
        before: { status: "CLOSED" },
        reason: "Account reopened via recovery credential",
        requestId,
        targetId: user.id,
        targetType: "User",
      });
      await tx.session.updateMany({
        where: { revokedAt: null, userId: user.id },
        data: { revokedAt: new Date() },
      });
      return this.createSessionInTx(tx, user, refreshToken, refreshExpiresAt);
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
      const updated = await tx.user.updateMany({
        where: { id: userId, status: "ACTIVE" },
        data: {
          deletionRequestedAt: new Date(),
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
          deletionRequestedAt: new Date().toISOString(),
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
      refreshExpiresAt,
      refreshToken,
      user: toUserSummary(user),
    };
  }
}
