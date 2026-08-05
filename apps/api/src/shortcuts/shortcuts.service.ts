import { Injectable } from "@nestjs/common";
import type {
  ShortcutCredentialCreatedResponse,
  ShortcutCredentialListResponse,
  ShortcutTodaySpendResponse,
} from "@daily-assistant/api-contracts";

import { ApiException } from "../common/api-error.js";
import { SecurityService } from "../common/security.service.js";
import { DraftsService } from "../drafts/drafts.service.js";
import { FinanceService } from "../finance/finance.service.js";
import { toZonedDay } from "../finance/time.util.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  CreateShortcutCredentialDto,
  ShortcutTransactionDraftDto,
} from "./dto/shortcuts.dto.js";
import { toShortcutCredentialSummary } from "./shortcuts.mapper.js";

@Injectable()
export class ShortcutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly draftsService: DraftsService,
    private readonly financeService: FinanceService,
  ) {}

  async createCredential(
    userId: string,
    dto: CreateShortcutCredentialDto,
  ): Promise<ShortcutCredentialCreatedResponse> {
    const plaintextToken = `da_sc_${this.securityService.generateDeviceCredentialToken()}`;
    const row = await this.prisma.deviceCredential.create({
      data: {
        name: dto.name.trim(),
        scopes: [...new Set(dto.scopes)],
        tokenHash: this.securityService.sha256(plaintextToken),
        tokenPrefix: plaintextToken.slice(0, 8),
        userId,
      },
    });
    return {
      credential: toShortcutCredentialSummary(row),
      plaintextToken,
    };
  }

  async listCredentials(
    userId: string,
  ): Promise<ShortcutCredentialListResponse> {
    const rows = await this.prisma.deviceCredential.findMany({
      orderBy: { createdAt: "desc" },
      where: { userId },
    });
    return { items: rows.map(toShortcutCredentialSummary) };
  }

  async revokeCredential(userId: string, id: string): Promise<void> {
    const result = await this.prisma.deviceCredential.updateMany({
      data: { revokedAt: new Date() },
      where: { id, revokedAt: null, userId },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Shortcut credential not found",
      );
    }
  }

  async createTransactionDraft(
    userId: string,
    dto: ShortcutTransactionDraftDto,
    idempotencyKey: string,
  ) {
    return this.draftsService.createShortcutDraft(userId, dto, idempotencyKey);
  }

  async todaySpend(userId: string): Promise<ShortcutTodaySpendResponse> {
    const summary = await this.financeService.getSummary(userId, {});
    return {
      currency: summary.currency,
      date: toZonedDay(new Date()),
      todaySpend: summary.todaySpend,
    };
  }
}
