import { Injectable } from "@nestjs/common";

import type { UserStatus } from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { SecurityService } from "../common/security.service.js";
import { AuditService } from "../audit/audit.service.js";
import { CapacityService } from "../capacity/capacity.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { normalizeUsername } from "../users/user.mapper.js";
import type {
  AdminCreateUserDto,
  AdminReasonDto,
  AdminResetPasswordDto,
  UpdateSystemSettingsDto,
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
    dto: UpdateSystemSettingsDto,
    requestId: string,
  ) {
    return this.capacityService.updateSettings(
      actorId,
      { maxActiveUsers: dto.maxActiveUsers },
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
        displayName: true,
        id: true,
        mustChangePassword: true,
        role: true,
        status: true,
        username: true,
      },
      take: 500,
    });
    return users.map((user) => ({
      closedAt: user.closedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
      displayName: user.displayName,
      id: user.id,
      mustChangePassword: user.mustChangePassword,
      role: user.role,
      status: user.status,
      username: user.username,
    }));
  }

  async createUser(
    actorId: string,
    dto: AdminCreateUserDto,
    requestId: string,
  ) {
    const normalizedUsername = normalizeUsername(dto.username);
    const passwordHash = await this.securityService.hashPassword(
      dto.initialPassword,
    );
    return this.capacityService.withCapacityRetry(async (tx) => {
      const settings = await tx.systemSetting.findUniqueOrThrow({
        where: { id: "singleton" },
      });
      const occupied = await this.capacityService.countOccupied(tx);
      if (occupied >= settings.maxActiveUsers) {
        throw new ApiException(
          "CAPACITY_REACHED",
          409,
          "The experience is currently full",
        );
      }
      const existing = await tx.user.findUnique({
        where: { normalizedUsername },
      });
      if (existing) {
        throw new ApiException(
          "DUPLICATE_RESOURCE",
          409,
          "An account with this username already exists",
        );
      }
      const user = await tx.user.create({
        data: {
          displayName: dto.displayName.trim(),
          mustChangePassword: true,
          normalizedUsername,
          passwordHash,
          role: "USER",
          status: "ACTIVE",
          username: normalizedUsername,
        },
      });
      await this.auditService.recordInTx(tx, {
        action: "USER_CREATE",
        actorId,
        after: {
          displayName: user.displayName,
          mustChangePassword: user.mustChangePassword,
          role: user.role,
          status: user.status,
          username: user.username,
        },
        reason: dto.reason,
        requestId,
        targetId: user.id,
        targetType: "User",
      });
      return {
        closedAt: null,
        createdAt: user.createdAt.toISOString(),
        deletionRequestedAt: null,
        displayName: user.displayName,
        id: user.id,
        mustChangePassword: user.mustChangePassword,
        role: user.role,
        status: user.status,
        username: user.username,
      };
    });
  }

  async resetUserPassword(
    actorId: string,
    userId: string,
    dto: AdminResetPasswordDto,
    requestId: string,
  ): Promise<void> {
    const passwordHash = await this.securityService.hashPassword(
      dto.newPassword,
    );
    await this.capacityService.withCapacityRetry(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: userId } });
      if (!before) {
        throw new ApiException("RESOURCE_NOT_FOUND", 404, "User not found");
      }
      const after = await tx.user.update({
        data: {
          mustChangePassword: true,
          passwordHash,
        },
        where: { id: userId },
      });
      await tx.session.updateMany({
        data: { revokedAt: new Date() },
        where: { revokedAt: null, userId },
      });
      await this.auditService.recordInTx(tx, {
        action: "USER_PASSWORD_RESET",
        actorId,
        after: { mustChangePassword: after.mustChangePassword },
        before: { mustChangePassword: before.mustChangePassword },
        reason: dto.reason,
        requestId,
        targetId: userId,
        targetType: "User",
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
          "CAPACITY_REACHED",
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
