import { Inject, Injectable } from "@nestjs/common";
import type {
  DraftBatchDiscardIntentResponse,
  DraftBatchDiscardResult,
  DraftConfirmResponse,
  DraftCreatedResponse,
  DraftListResponse,
  DraftSummary,
  RecordSource,
  ShortcutTransactionDraftRequest,
  TransactionDraftPayload,
} from "@daily-assistant/api-contracts";

import { Prisma, type DraftRecord } from "../generated/prisma/client.js";
import { AuditService } from "../audit/audit.service.js";
import { ApiException } from "../common/api-error.js";
import { SecurityService } from "../common/security.service.js";
import { FinanceService } from "../finance/finance.service.js";
import { toDecimal } from "../finance/money.util.js";
import {
  OCR_ADAPTER,
  OcrUnavailableError,
  STORAGE_ADAPTER,
  type OcrAdapter,
  type StorageAdapter,
} from "../integrations/integrations.types.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateTransactionDto } from "../finance/dto/finance.dto.js";
import {
  type BatchDiscardConfirmDto,
  type BatchDiscardDto,
  type ListDraftsQueryDto,
  type OcrDraftDto,
  type ParseTextDto,
  type UpdateDraftDto,
} from "./dto/drafts.dto.js";
import { toDraftSummary } from "./drafts.mapper.js";
import { parseTransactionText } from "./rule-parser.js";

const DRAFT_TARGET_TYPE = "TRANSACTION" as const;

interface CreateDraftInput {
  attachmentId?: string | null;
  clientMutationId?: string | null;
  confidence?: Record<string, number> | null;
  payload: TransactionDraftPayload;
  source: RecordSource;
}

@Injectable()
export class DraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly securityService: SecurityService,
    private readonly auditService: AuditService,
    @Inject(OCR_ADAPTER) private readonly ocrAdapter: OcrAdapter,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  async createTextDraft(
    userId: string,
    dto: ParseTextDto,
  ): Promise<DraftCreatedResponse> {
    const parsed = parseTransactionText(dto.text);
    return this.createDraftRecord(userId, {
      clientMutationId: null,
      confidence: parsed.confidence,
      payload: payloadFromParsed(parsed),
      source: "TEXT",
    });
  }

  async createOcrDraft(
    userId: string,
    dto: OcrDraftDto,
  ): Promise<DraftCreatedResponse> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { deletedAt: null, id: dto.attachmentId, userId },
    });
    if (!attachment) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Attachment not found");
    }
    if (
      attachment.scanStatus !== "SCANNED" ||
      !attachment.contentStoredAt ||
      !attachment.objectKey
    ) {
      throw new ApiException(
        "ATTACHMENT_NOT_READY",
        409,
        "Attachment must be uploaded and scanned before OCR",
      );
    }

    let text: string;
    try {
      const data = await this.storageAdapter.get(attachment.objectKey);
      const result = await this.ocrAdapter.recognize(data, attachment.mimeType);
      text = result.text;
    } catch (error) {
      if (error instanceof OcrUnavailableError) {
        throw new ApiException(
          "OCR_UNAVAILABLE",
          503,
          "OCR is temporarily unavailable",
        );
      }
      throw error;
    }

    const parsed = parseTransactionText(text);
    return this.createDraftRecord(userId, {
      attachmentId: attachment.id,
      clientMutationId: dto.clientMutationId ?? null,
      confidence: { ...parsed.confidence, provider: 1 },
      payload: payloadFromParsed(parsed),
      source: "OCR",
    });
  }

  async createShortcutDraft(
    userId: string,
    dto: ShortcutTransactionDraftRequest,
    idempotencyKey: string,
  ): Promise<DraftCreatedResponse> {
    toDecimal(dto.amount);
    return this.createDraftRecord(userId, {
      clientMutationId: idempotencyKey,
      confidence: null,
      payload: {
        accountId: dto.accountId ?? null,
        amount: dto.amount,
        categoryId: dto.categoryId ?? null,
        currency: dto.currency ?? "CNY",
        isUnlinkedRefund: dto.isUnlinkedRefund ?? false,
        merchant: dto.merchant ?? null,
        note: dto.note ?? null,
        occurredAt: dto.occurredAt,
        originalTransactionId: dto.originalTransactionId ?? null,
        type: dto.type,
      },
      source: "SHORTCUT",
    });
  }

  async listDrafts(
    userId: string,
    query: ListDraftsQueryDto,
  ): Promise<DraftListResponse> {
    const limit = Number(query.limit ?? 50);
    const rows = await this.prisma.draftRecord.findMany({
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: query.cursor ? 1 : 0,
      take: limit + 1,
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
      },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toDraftSummary);
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async getDraft(userId: string, id: string): Promise<DraftSummary> {
    const row = await this.prisma.draftRecord.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Draft not found");
    }
    return toDraftSummary(row);
  }

  async updateDraft(
    userId: string,
    id: string,
    dto: UpdateDraftDto,
  ): Promise<DraftSummary> {
    const current = await this.prisma.draftRecord.findFirst({
      where: { id, userId },
    });
    if (!current) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Draft not found");
    }
    if (current.status !== "PENDING") {
      throw new ApiException(
        "DRAFT_NOT_EDITABLE",
        409,
        "Only pending drafts can be edited",
      );
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Draft was modified elsewhere",
      );
    }
    const payload = {
      ...dto.payload,
      currency: dto.payload.currency ?? "CNY",
      isUnlinkedRefund: dto.payload.isUnlinkedRefund ?? false,
      merchant: dto.payload.merchant ?? null,
      note: dto.payload.note ?? null,
    } satisfies TransactionDraftPayload;
    toDecimal(payload.amount);

    const updated = await this.prisma.draftRecord.updateMany({
      data: {
        confidenceJson: Prisma.DbNull,
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
      where: { id, userId, version: current.version },
    });
    if (updated.count === 0) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Draft was modified elsewhere",
      );
    }
    return toDraftSummary(
      await this.prisma.draftRecord.findFirstOrThrow({
        where: { id, userId },
      }),
    );
  }

  async confirmDraft(
    userId: string,
    id: string,
  ): Promise<DraftConfirmResponse> {
    const draft = await this.prisma.draftRecord.findFirst({
      where: { id, userId },
    });
    if (!draft) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Draft not found");
    }
    if (draft.status === "CONFIRMED") {
      if (!draft.resultId) {
        throw new ApiException(
          "INVALID_STATE",
          409,
          "Confirmed draft is missing its result",
        );
      }
      const transaction = await this.financeService.getTransaction(
        userId,
        draft.resultId,
      );
      return { draft: toDraftSummary(draft), transaction };
    }
    if (draft.status !== "PENDING") {
      throw new ApiException(
        "INVALID_STATE",
        409,
        "Only pending drafts can be confirmed",
      );
    }

    const payload = draft.payloadJson as unknown as TransactionDraftPayload;
    const dto: CreateTransactionDto = {
      accountId: payload.accountId ?? null,
      amount: payload.amount,
      categoryId: payload.categoryId ?? null,
      clientMutationId: draft.clientMutationId ?? null,
      currency: payload.currency,
      isUnlinkedRefund: payload.isUnlinkedRefund ?? false,
      merchant: payload.merchant ?? null,
      note: payload.note ?? null,
      occurredAt: payload.occurredAt,
      originalTransactionId: payload.originalTransactionId ?? null,
      source: draft.source,
      type: payload.type,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await this.financeService.createTransaction(
        userId,
        dto,
        tx,
      );
      const updated = await tx.draftRecord.update({
        data: {
          confirmedAt: new Date(),
          resultId: created.transaction.id,
          status: "CONFIRMED",
          version: { increment: 1 },
        },
        where: { id },
      });
      return { created, updated };
    });
    return {
      draft: toDraftSummary(result.updated),
      transaction: result.created.transaction,
    };
  }

  async discardDraft(userId: string, id: string): Promise<void> {
    const result = await this.prisma.draftRecord.updateMany({
      data: {
        discardedAt: new Date(),
        status: "DISCARDED",
        version: { increment: 1 },
      },
      where: { id, status: "PENDING", userId },
    });
    if (result.count === 0) {
      const existing = await this.prisma.draftRecord.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        throw new ApiException("RESOURCE_NOT_FOUND", 404, "Draft not found");
      }
      throw new ApiException(
        "INVALID_STATE",
        409,
        "Only pending drafts can be discarded",
      );
    }
  }

  async createBatchDiscardIntent(
    userId: string,
    dto: BatchDiscardDto,
  ): Promise<DraftBatchDiscardIntentResponse> {
    const drafts = await this.prisma.draftRecord.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      where: {
        userId,
        status: "PENDING",
        ...(dto.ids ? { id: { in: dto.ids } } : {}),
      },
    });
    if (drafts.length === 0) {
      throw new ApiException("VALIDATION_ERROR", 400, "没有可丢弃的待确认草稿");
    }
    const draftIds = drafts.map((draft) => draft.id);
    const { expiresAt, token } = this.securityService.signConfirmationToken({
      draftIds,
      reason: dto.reason,
      userId,
    });
    return {
      affectedDraftIds: draftIds,
      confirmationToken: token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirmBatchDiscard(
    userId: string,
    dto: BatchDiscardConfirmDto,
    requestId: string,
  ): Promise<DraftBatchDiscardResult> {
    const token = this.securityService.verifyConfirmationToken(
      dto.confirmationToken,
    );
    if (token.userId !== userId) {
      throw new ApiException(
        "CONFIRMATION_TOKEN_INVALID",
        400,
        "Confirmation token is invalid",
      );
    }
    const draftIds = token.draftIds;
    const before = await this.prisma.draftRecord.count({
      where: { id: { in: draftIds }, status: "PENDING", userId },
    });
    const result = await this.prisma.draftRecord.updateMany({
      data: {
        discardedAt: new Date(),
        status: "DISCARDED",
        version: { increment: 1 },
      },
      where: { id: { in: draftIds }, status: "PENDING", userId },
    });
    await this.auditService.record({
      action: "DRAFT_BATCH_DISCARD",
      actorId: userId,
      after: { discardedCount: result.count },
      before: { draftIds, pendingCount: before },
      reason: token.reason,
      requestId,
      targetId: null,
      targetType: "DRAFT",
    });
    return { discardedCount: result.count };
  }

  private async createDraftRecord(
    userId: string,
    input: CreateDraftInput,
  ): Promise<DraftCreatedResponse> {
    const { clientMutationId } = input;
    if (clientMutationId) {
      const existing = await this.prisma.draftRecord.findFirst({
        where: { clientMutationId, userId },
      });
      if (existing) {
        this.assertSamePayload(existing, input.payload);
        return { draft: toDraftSummary(existing) };
      }
    }
    try {
      const row = await this.prisma.draftRecord.create({
        data: {
          attachmentId: input.attachmentId ?? undefined,
          clientMutationId: clientMutationId ?? undefined,
          confidenceJson: (input.confidence ?? Prisma.DbNull) as
            Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
          payloadJson: input.payload as unknown as Prisma.InputJsonValue,
          source: input.source,
          status: "PENDING",
          targetType: DRAFT_TARGET_TYPE,
          userId,
          version: 1,
        },
      });
      return { draft: toDraftSummary(row) };
    } catch (error) {
      if (this.isUniqueViolation(error) && clientMutationId) {
        const global = await this.prisma.draftRecord.findUnique({
          where: { clientMutationId },
        });
        if (global) {
          if (global.userId !== userId) {
            throw new ApiException(
              "IDEMPOTENCY_CONFLICT",
              409,
              "clientMutationId was already used",
            );
          }
          this.assertSamePayload(global, input.payload);
          return { draft: toDraftSummary(global) };
        }
      }
      throw error;
    }
  }

  private assertSamePayload(
    existing: DraftRecord,
    payload: TransactionDraftPayload,
  ): void {
    const stored = existing.payloadJson as unknown as TransactionDraftPayload;
    const same =
      stored.type === payload.type &&
      stored.amount === payload.amount &&
      (stored.currency ?? "CNY") === (payload.currency ?? "CNY") &&
      (stored.categoryId ?? null) === (payload.categoryId ?? null) &&
      (stored.accountId ?? null) === (payload.accountId ?? null) &&
      (stored.merchant ?? null) === (payload.merchant ?? null) &&
      (stored.note ?? null) === (payload.note ?? null) &&
      (stored.occurredAt ?? null) === (payload.occurredAt ?? null) &&
      (stored.originalTransactionId ?? null) ===
        (payload.originalTransactionId ?? null) &&
      (stored.isUnlinkedRefund ?? false) ===
        (payload.isUnlinkedRefund ?? false);
    if (!same) {
      throw new ApiException(
        "IDEMPOTENCY_CONFLICT",
        409,
        "clientMutationId was already used with different content",
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}

function payloadFromParsed(parsed: {
  amount: string;
  currency: string;
  merchant: string | null;
  note: string;
  occurredAt: string;
  type: TransactionDraftPayload["type"];
}): TransactionDraftPayload {
  return {
    accountId: null,
    amount: parsed.amount,
    categoryId: null,
    currency: parsed.currency,
    isUnlinkedRefund: false,
    merchant: parsed.merchant,
    note: parsed.note,
    occurredAt: parsed.occurredAt,
    originalTransactionId: null,
    type: parsed.type,
  };
}
