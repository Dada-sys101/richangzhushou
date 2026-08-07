import { randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { AuditService } from "../audit/audit.service.js";
import { SecurityService } from "../common/security.service.js";
import {
  STORAGE_ADAPTER,
  type StorageAdapter,
} from "../integrations/integrations.types.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  anonymousUsername,
  loadAccountDeletionConfig,
  type AccountDeletionConfig,
} from "./account-deletion.config.js";

export interface AccountDeletionRunResult {
  claimed: number;
  completed: number;
  failed: number;
}

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly auditService: AuditService,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  async runCleanup(): Promise<AccountDeletionRunResult> {
    const config = loadAccountDeletionConfig();
    const now = new Date();
    const candidates = await this.prisma.user.findMany({
      orderBy: { deletionScheduledAt: "asc" },
      select: { id: true },
      take: config.batchSize,
      where: {
        deletionAttemptCount: { lt: config.maxAttempts },
        OR: [
          {
            deletionScheduledAt: { lte: now },
            status: "DELETION_PENDING",
          },
          {
            deletionLeaseExpiresAt: { lte: now },
            status: "DELETION_PROCESSING",
          },
        ],
      },
    });

    let claimed = 0;
    let completed = 0;
    let failed = 0;
    for (const candidate of candidates) {
      const leaseExpiresAt = new Date(now.getTime() + config.leaseMs);
      const claim = await this.prisma.user.updateMany({
        data: {
          deletionAttemptCount: { increment: 1 },
          deletionLastError: null,
          deletionLeaseExpiresAt: leaseExpiresAt,
          deletionStartedAt: now,
          status: "DELETION_PROCESSING",
        },
        where: {
          deletionAttemptCount: { lt: config.maxAttempts },
          id: candidate.id,
          OR: [
            {
              deletionScheduledAt: { lte: now },
              status: "DELETION_PENDING",
            },
            {
              deletionLeaseExpiresAt: { lte: now },
              status: "DELETION_PROCESSING",
            },
          ],
        },
      });
      if (claim.count === 0) {
        continue;
      }
      claimed += 1;
      try {
        await this.cleanupUser(candidate.id, now);
        completed += 1;
      } catch (error) {
        await this.markFailed(candidate.id, now, error, config);
        failed += 1;
      }
    }
    return { claimed, completed, failed };
  }

  private async cleanupUser(userId: string, now: Date): Promise<void> {
    const attachments = await this.prisma.attachment.findMany({
      select: { objectKey: true },
      where: { userId },
    });
    for (const attachment of attachments) {
      await this.storageAdapter.delete(attachment.objectKey);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.syncMutation.deleteMany({ where: { userId } });
      await tx.reminder.deleteMany({ where: { userId } });
      await tx.task.deleteMany({ where: { userId } });
      await tx.calendarEvent.deleteMany({ where: { userId } });
      await tx.draftRecord.deleteMany({ where: { userId } });
      await tx.attachment.deleteMany({ where: { userId } });
      await tx.budget.deleteMany({ where: { userId } });
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.financialAccount.deleteMany({ where: { userId } });
      await tx.category.deleteMany({ where: { userId } });
      await tx.trip.deleteMany({ where: { userId } });
      await tx.deviceCredential.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.adminAudit.updateMany({
        data: {
          afterJson: Prisma.DbNull,
          beforeJson: Prisma.DbNull,
          reason: "ACCOUNT_DELETION_CLEANUP_ANONYMIZED",
        },
        where: {
          OR: [{ actorId: userId }, { targetId: userId, targetType: "User" }],
        },
      });

      const username = await this.nextAnonymousUsername(tx);
      const passwordHash = await this.securityService.hashPassword(
        randomBytes(32).toString("base64url"),
      );
      const tombstone = await tx.user.update({
        data: {
          deletionCompletedAt: now,
          deletionLastError: null,
          deletionLeaseExpiresAt: null,
          displayName: "",
          mustChangePassword: false,
          normalizedUsername: username,
          passwordHash,
          role: "USER",
          status: "DELETED",
          username,
        },
        where: { id: userId },
      });
      await this.auditService.recordInTx(tx, {
        action: "USER_DELETION_COMPLETED",
        actorId: null,
        after: {
          deletionCompletedAt:
            tombstone.deletionCompletedAt?.toISOString() ?? null,
          status: tombstone.status,
        },
        before: { status: "DELETION_PROCESSING" },
        reason: "SCHEDULED_ACCOUNT_DELETION_COMPLETED",
        requestId: `account-deletion-${userId}`,
        targetId: userId,
        targetType: "User",
      });
    });
  }

  private async markFailed(
    userId: string,
    now: Date,
    error: unknown,
    config: AccountDeletionConfig,
  ): Promise<void> {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown account deletion failure";
    await this.prisma.user.update({
      data: {
        deletionLastError: message.replace(/\s+/g, " ").trim().slice(0, 500),
        deletionLeaseExpiresAt: new Date(now.getTime() + config.leaseMs),
      },
      where: { id: userId },
    });
  }

  private async nextAnonymousUsername(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const username = anonymousUsername();
      const existing = await tx.user.findUnique({
        select: { id: true },
        where: { normalizedUsername: username },
      });
      if (!existing) {
        return username;
      }
    }
    throw new Error("Unable to allocate an anonymous username");
  }
}
