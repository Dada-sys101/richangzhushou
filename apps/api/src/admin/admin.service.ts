import { Injectable } from "@nestjs/common";

import type { UserStatus } from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { SecurityService } from "../common/security.service.js";
import { AuditService } from "../audit/audit.service.js";
import { CapacityService } from "../capacity/capacity.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { maskEmail } from "../users/user.mapper.js";
import type {
  AdminReasonDto,
  InviteCreateDto,
  UpdateRegistrationSettingsDto,
} from "../auth/dto/auth.dto.js";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacityService: CapacityService,
    private readonly auditService: AuditService,
    private readonly securityService: SecurityService,
  ) {}

  async getDashboard() {
    return this.capacityService.getDashboard();
  }

  async getSettings() {
    return this.capacityService.getSettings();
  }

  async updateSettings(
    actorId: string,
    dto: UpdateRegistrationSettingsDto,
    requestId: string,
  ) {
    return this.capacityService.updateSettings(
      actorId,
      {
        inviteRequired: dto.inviteRequired,
        maxActiveUsers: dto.maxActiveUsers,
        registrationEnabled: dto.registrationEnabled,
      },
      dto.reason,
      requestId,
    );
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        closedAt: true,
        createdAt: true,
        deletionRequestedAt: true,
        email: true,
        id: true,
        role: true,
        status: true,
      },
      take: 500,
    });
    return users.map((user) => ({
      closedAt: user.closedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
      id: user.id,
      maskedEmail: maskEmail(user.email),
      role: user.role,
      status: user.status,
    }));
  }

  async listInvites() {
    const invites = await this.prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return invites.map((invite) => ({
      codePrefix: invite.codePrefix,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      id: invite.id,
      maxUses: invite.maxUses,
      revokedAt: invite.revokedAt?.toISOString() ?? null,
      status: invite.status,
      usedCount: invite.usedCount,
    }));
  }

  async createInvite(actorId: string, dto: InviteCreateDto, requestId: string) {
    const plaintextCode = this.securityService.generateInviteCode();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    const invite = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inviteCode.create({
        data: {
          codeHash: this.securityService.sha256(plaintextCode),
          codePrefix: plaintextCode.slice(0, 4),
          createdById: actorId,
          expiresAt,
          maxUses: dto.maxUses,
        },
      });
      await this.auditService.recordInTx(tx, {
        action: "INVITE_CREATE",
        actorId,
        after: {
          codePrefix: created.codePrefix,
          expiresAt: created.expiresAt?.toISOString() ?? null,
          maxUses: created.maxUses,
        },
        reason: dto.reason,
        requestId,
        targetId: created.id,
        targetType: "InviteCode",
      });
      return created;
    });
    return {
      invite: {
        codePrefix: invite.codePrefix,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt?.toISOString() ?? null,
        id: invite.id,
        maxUses: invite.maxUses,
        revokedAt: null,
        status: invite.status,
        usedCount: invite.usedCount,
      },
      plaintextCode,
    };
  }

  async revokeInvite(
    actorId: string,
    inviteId: string,
    dto: AdminReasonDto,
    requestId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.inviteCode.findUnique({
        where: { id: inviteId },
      });
      if (!before) {
        throw new ApiException("RESOURCE_NOT_FOUND", 404, "Invite not found");
      }
      const after = await tx.inviteCode.update({
        where: { id: inviteId },
        data: {
          revokedAt: new Date(),
          revokedById: actorId,
          status: "REVOKED",
        },
      });
      await this.auditService.recordInTx(tx, {
        action: "INVITE_REVOKE",
        actorId,
        after: { status: after.status },
        before: { status: before.status },
        reason: dto.reason,
        requestId,
        targetId: after.id,
        targetType: "InviteCode",
      });
    });
  }

  async suspendUser(
    actorId: string,
    userId: string,
    dto: AdminReasonDto,
    requestId: string,
  ): Promise<void> {
    await this.changeUserStatus(
      actorId,
      userId,
      "SUSPENDED",
      ["ACTIVE"],
      dto.reason,
      requestId,
      "USER_SUSPEND",
    );
  }

  async closeUser(
    actorId: string,
    userId: string,
    dto: AdminReasonDto,
    requestId: string,
  ): Promise<void> {
    await this.changeUserStatus(
      actorId,
      userId,
      "CLOSED",
      ["ACTIVE", "SUSPENDED"],
      dto.reason,
      requestId,
      "USER_CLOSE",
    );
  }

  async reopenUser(
    actorId: string,
    userId: string,
    dto: AdminReasonDto,
    requestId: string,
  ): Promise<void> {
    await this.capacityService.withCapacityRetry(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: userId } });
      if (!before) {
        throw new ApiException("RESOURCE_NOT_FOUND", 404, "User not found");
      }
      if (before.status === "ACTIVE") {
        return;
      }
      if (before.status !== "SUSPENDED" && before.status !== "CLOSED") {
        throw new ApiException(
          "INVALID_STATE",
          409,
          "This account cannot be reopened",
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
      const after = await tx.user.update({
        where: { id: userId },
        data: { closedAt: null, status: "ACTIVE" },
      });
      await this.auditService.recordInTx(tx, {
        action: "USER_REOPEN",
        actorId,
        after: { status: after.status },
        before: { status: before.status },
        reason: dto.reason,
        requestId,
        targetId: userId,
        targetType: "User",
      });
    });
  }

  async listAudits() {
    return this.auditService.list();
  }

  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: "ok", status: "ok" };
    } catch {
      return { database: "unavailable", status: "degraded" };
    }
  }

  private async changeUserStatus(
    actorId: string,
    userId: string,
    target: Extract<UserStatus, "SUSPENDED" | "CLOSED">,
    allowedFrom: UserStatus[],
    reason: string,
    requestId: string,
    action: "USER_SUSPEND" | "USER_CLOSE",
  ): Promise<void> {
    await this.capacityService.withCapacityRetry(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: userId } });
      if (!before) {
        throw new ApiException("RESOURCE_NOT_FOUND", 404, "User not found");
      }
      if (before.status === target) {
        return;
      }
      if (!allowedFrom.includes(before.status)) {
        throw new ApiException(
          "INVALID_STATE",
          409,
          "This account cannot transition to the requested state",
        );
      }
      const after = await tx.user.update({
        where: { id: userId },
        data:
          target === "CLOSED"
            ? { closedAt: new Date(), status: "CLOSED" }
            : { status: "SUSPENDED" },
      });
      await tx.session.updateMany({
        where: { revokedAt: null, userId },
        data: { revokedAt: new Date() },
      });
      await this.auditService.recordInTx(tx, {
        action,
        actorId,
        after: { status: after.status },
        before: { status: before.status },
        reason,
        requestId,
        targetId: userId,
        targetType: "User",
      });
    });
  }
}
