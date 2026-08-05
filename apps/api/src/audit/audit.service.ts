import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { maskEmail } from "../users/user.mapper.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface AuditChange {
  action: string;
  actorId: string;
  after?: Record<string, unknown>;
  before?: Record<string, unknown>;
  reason: string;
  requestId: string;
  targetId?: string | null;
  targetType: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(change: AuditChange): Promise<void> {
    await this.prisma.adminAudit.create({
      data: this.toData(change),
    });
  }

  async recordInTx(
    tx: Prisma.TransactionClient,
    change: AuditChange,
  ): Promise<void> {
    await tx.adminAudit.create({
      data: this.toData(change),
    });
  }

  async list() {
    const items = await this.prisma.adminAudit.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return items.map((item) => ({
      action: item.action,
      actorEmail: item.actor ? maskEmail(item.actor.email) : null,
      changes: (item.afterJson ?? item.beforeJson ?? {}) as Record<
        string,
        unknown
      >,
      createdAt: item.createdAt.toISOString(),
      id: item.id,
      reason: item.reason,
      requestId: item.requestId,
      targetId: item.targetId,
      targetType: item.targetType,
    }));
  }

  private toData(change: AuditChange) {
    return {
      action: change.action,
      actorId: change.actorId,
      afterJson: change.after as Prisma.InputJsonValue,
      beforeJson: change.before as Prisma.InputJsonValue,
      reason: change.reason,
      requestId: change.requestId,
      targetId: change.targetId ?? null,
      targetType: change.targetType,
    };
  }
}
