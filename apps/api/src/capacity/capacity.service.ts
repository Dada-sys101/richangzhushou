import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { PrismaService } from "../prisma/prisma.service.js";

export const SYSTEM_SETTING_ID = "singleton";
const MAX_CAPACITY_ATTEMPTS = 3;
const RETRYABLE_CODES = new Set(["P2034", "P2028"]);

@Injectable()
export class CapacityService {
  constructor(private readonly prisma: PrismaService) {}

  async lockSystemSetting(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM \`system_settings\` WHERE \`id\` = ${SYSTEM_SETTING_ID} FOR UPDATE`;
  }

  async lockInviteCode(
    tx: Prisma.TransactionClient,
    codeHash: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM \`invite_codes\` WHERE \`code_hash\` = ${codeHash} FOR UPDATE`;
  }

  async countOccupied(tx: Prisma.TransactionClient): Promise<number> {
    return tx.user.count({
      where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
    });
  }

  async withCapacityRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_CAPACITY_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.lockSystemSetting(tx);
          return operation(tx);
        });
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(error) || attempt === MAX_CAPACITY_ATTEMPTS - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  async getSettings() {
    return this.prisma.systemSetting.findUniqueOrThrow({
      where: { id: SYSTEM_SETTING_ID },
    });
  }

  async getDashboard() {
    return this.withCapacityRetry(async (tx) => {
      const settings = await tx.systemSetting.findUniqueOrThrow({
        where: { id: SYSTEM_SETTING_ID },
      });
      const occupied = await this.countOccupied(tx);
      const active = await tx.user.count({ where: { status: "ACTIVE" } });
      const suspended = occupied - active;
      return {
        activeUsers: active,
        inviteRequired: settings.inviteRequired,
        maxActiveUsers: settings.maxActiveUsers,
        occupiedSlots: occupied,
        registrationEnabled: settings.registrationEnabled,
        remainingSlots: Math.max(settings.maxActiveUsers - occupied, 0),
        suspendedUsers: suspended,
      };
    });
  }

  async updateSettings(
    actorId: string,
    patch: {
      inviteRequired?: boolean;
      maxActiveUsers?: number;
      registrationEnabled?: boolean;
    },
    reason: string,
    requestId: string,
  ) {
    return this.withCapacityRetry(async (tx) => {
      const before = await tx.systemSetting.findUniqueOrThrow({
        where: { id: SYSTEM_SETTING_ID },
      });
      const occupied = await this.countOccupied(tx);
      const nextMaxActiveUsers = patch.maxActiveUsers ?? before.maxActiveUsers;
      if (nextMaxActiveUsers < occupied) {
        throw new ApiException(
          "SETTING_LOWER_THAN_USAGE",
          409,
          "Capacity limit cannot be lower than current occupied slots",
        );
      }
      const after = await tx.systemSetting.update({
        where: { id: SYSTEM_SETTING_ID },
        data: {
          inviteRequired: patch.inviteRequired ?? before.inviteRequired,
          maxActiveUsers: nextMaxActiveUsers,
          registrationEnabled:
            patch.registrationEnabled ?? before.registrationEnabled,
          updatedBy: actorId,
        },
      });
      await tx.adminAudit.create({
        data: {
          action: "SETTINGS_UPDATE",
          actorId,
          afterJson: {
            inviteRequired: after.inviteRequired,
            maxActiveUsers: after.maxActiveUsers,
            registrationEnabled: after.registrationEnabled,
          },
          beforeJson: {
            inviteRequired: before.inviteRequired,
            maxActiveUsers: before.maxActiveUsers,
            registrationEnabled: before.registrationEnabled,
          },
          reason,
          requestId,
          targetId: SYSTEM_SETTING_ID,
          targetType: "SystemSetting",
        },
      });
      return after;
    });
  }

  private isRetryable(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      RETRYABLE_CODES.has(error.code)
    ) {
      return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    return /deadlock|lock wait timeout/i.test(message);
  }
}
