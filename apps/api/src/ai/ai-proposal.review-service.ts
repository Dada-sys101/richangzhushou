import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type {
  AiFinalConfirmRequest,
  AiFinalConfirmResponse,
  AiOperationAcceptRequest,
  AiOperationEditRequest,
  AiOperationRejectRequest,
  AiOperationType,
  AiProposalCreateRequest,
  AiProposalCreateResponse,
  AiProposalDetail,
  AiProposalListQuery,
  AiProposalListResponse,
  AiProposalRejectRequest,
  ApiErrorCode,
  Identifier,
} from "@daily-assistant/api-contracts";

import { Prisma } from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  AiFakeProviderFactory,
  operationTypeForRequestType,
} from "./ai-fake-provider.factory.js";
import { AiFeatureGate } from "./ai-feature-gate.js";
import { AiProposalApplicationPort } from "./ai-proposal.application-port.js";
import { sha256Fingerprint } from "./ai-proposal.fingerprint.js";
import {
  toAiProposalDetail,
  toAiProposalSummary,
  toAiRequestSummary,
} from "./ai-proposal.mapper.js";
import { FakeAiProviderError } from "./fake-provider/fake-ai-provider.js";
import type {
  FakeAiOperationCandidate,
  FakeAiProviderResult,
} from "./fake-provider/fake-ai-provider.types.js";

const REVIEWABLE_PROPOSAL_STATUSES = [
  "PENDING_REVIEW",
  "PARTIALLY_APPLIED",
] as const;

const TERMINAL_PROPOSAL_STATUSES = [
  "APPLIED",
  "REJECTED",
  "EXPIRED",
  "FAILED",
  "CANCELLED",
] as const;

interface NormalizedOperation {
  clarification: string | null;
  confidence: string;
  fields: Record<string, unknown>;
  operationType: AiOperationType;
  status: "PENDING";
}

interface NormalizedProviderResult {
  modelId: string;
  operations: NormalizedOperation[];
  providerId: string;
  responseFingerprint: string;
}

@Injectable()
export abstract class AiProposalReviewService extends AiProposalApplicationPort {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly fakeProviderFactory: AiFakeProviderFactory,
    protected readonly featureGate: AiFeatureGate = new AiFeatureGate(),
  ) {
    super();
  }

  abstract override finalConfirm(
    userId: string,
    proposalId: Identifier,
    request: AiFinalConfirmRequest,
  ): Promise<AiFinalConfirmResponse>;

  async create(
    userId: string,
    idempotencyKey: string,
    request: AiProposalCreateRequest,
  ): Promise<AiProposalCreateResponse> {
    this.featureGate.requireFakeProvider();
    const inputFingerprint = sha256Fingerprint(request);
    const existing = await this.prisma.aiRequest.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return this.resolveExistingCreate(existing, userId, inputFingerprint);
    }
    const provider = this.fakeProviderFactory.create(request.requestType);

    let claimed;
    try {
      claimed = await this.prisma.aiRequest.create({
        data: {
          idempotencyKey,
          inputFingerprint,
          locale: request.locale,
          requestId: randomUUID(),
          status: "CLAIMED",
          timeZoneId: request.timeZoneId,
          userId,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const raced = await this.prisma.aiRequest.findUnique({
        where: { idempotencyKey },
      });
      if (!raced) {
        throw error;
      }
      return this.resolveExistingCreate(raced, userId, inputFingerprint);
    }

    const startedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const transitioned = await tx.aiRequest.updateMany({
        data: { startedAt, status: "RUNNING" },
        where: { id: claimed.id, status: "CLAIMED", userId },
      });
      if (transitioned.count !== 1) {
        throw idempotencyConflict();
      }
      await tx.aiProviderAttempt.create({
        data: {
          aiRequestId: claimed.id,
          attemptNo: 1,
          modelId: provider.modelId,
          providerId: provider.providerId,
          startedAt,
          status: "RUNNING",
        },
      });
    });

    let normalized: NormalizedProviderResult;
    try {
      normalized = this.normalizeProviderResult(
        request,
        provider.generate(request),
      );
    } catch (error) {
      if (error instanceof FakeAiProviderError) {
        await this.persistFailure(
          claimed.id,
          "CONTROLLED_FAILURE",
          "AI_PROVIDER_ERROR",
        );
        throw new ApiException(
          "AI_PROVIDER_ERROR",
          502,
          "The AI provider could not create a proposal",
        );
      }
      if (
        error instanceof ApiException &&
        error.code === "AI_SCHEMA_VALIDATION_ERROR"
      ) {
        await this.persistFailure(
          claimed.id,
          "SCHEMA_VALIDATION_FAILURE",
          "AI_SCHEMA_VALIDATION_ERROR",
        );
      }
      throw error;
    }

    const completedAt = new Date();
    const persisted = await this.prisma.$transaction(async (tx) => {
      const proposal = await tx.aiProposal.create({
        data: {
          aiRequestId: claimed.id,
          modelId: normalized.modelId,
          operations: {
            create: normalized.operations.map((operation, index) => ({
              clarification: operation.clarification,
              confidence: operation.confidence,
              fieldsFingerprint: sha256Fingerprint(operation.fields),
              fieldsJson: operation.fields as Prisma.InputJsonObject,
              operationType: operation.operationType,
              ordinal: index + 1,
              status: "PENDING",
            })),
          },
          providerId: normalized.providerId,
          responseFingerprint: normalized.responseFingerprint,
          schemaVersion: 1,
          status: "PENDING_REVIEW",
          userId,
        },
        include: { operations: { orderBy: { ordinal: "asc" } } },
      });
      const attempt = await tx.aiProviderAttempt.updateMany({
        data: { completedAt, status: "SUCCEEDED" },
        where: {
          aiRequestId: claimed.id,
          attemptNo: 1,
          status: "RUNNING",
        },
      });
      const requestUpdate = await tx.aiRequest.updateMany({
        data: {
          completedAt,
          proposalId: proposal.id,
          status: "SUCCEEDED",
        },
        where: { id: claimed.id, status: "RUNNING", userId },
      });
      if (attempt.count !== 1 || requestUpdate.count !== 1) {
        throw idempotencyConflict();
      }
      const requestRow = await tx.aiRequest.findUniqueOrThrow({
        where: { id: claimed.id },
      });
      return { proposal, request: requestRow };
    });

    return {
      request: toAiRequestSummary(persisted.request),
      proposal: toAiProposalDetail(persisted.proposal),
    };
  }

  async list(
    userId: string,
    query: AiProposalListQuery,
  ): Promise<AiProposalListResponse> {
    this.featureGate.requireProposal();
    const limit = Number(query.limit ?? 50);
    const rows = await this.prisma.aiProposal.findMany({
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: query.cursor ? 1 : 0,
      take: limit + 1,
      where: {
        status: { in: [...REVIEWABLE_PROPOSAL_STATUSES] },
        userId,
      },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map(toAiProposalSummary);
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, proposalId: Identifier): Promise<AiProposalDetail> {
    this.featureGate.requireProposal();
    return this.loadDetail(this.prisma, userId, proposalId);
  }

  async editOperation(
    userId: string,
    proposalId: Identifier,
    operationId: Identifier,
    request: AiOperationEditRequest,
  ): Promise<AiProposalDetail> {
    this.featureGate.requireProposal();
    const fieldsFingerprint = sha256Fingerprint(request.fields);
    return this.prisma.$transaction(async (tx) => {
      const { operation, proposal } = await this.loadOperationForMutation(
        tx,
        userId,
        proposalId,
        operationId,
        request.version,
      );
      if (operation.status !== "PENDING") {
        throw operationInvalidState();
      }
      await this.claimProposalVersion(tx, proposal, request.version);
      const updated = await tx.aiOperation.updateMany({
        data: {
          fieldsFingerprint,
          fieldsJson: request.fields as Prisma.InputJsonObject,
        },
        where: {
          id: operationId,
          proposalId,
          status: "PENDING",
        },
      });
      if (updated.count !== 1) {
        throw operationInvalidState();
      }
      return this.loadDetail(tx, userId, proposalId);
    });
  }

  async acceptOperation(
    userId: string,
    proposalId: Identifier,
    operationId: Identifier,
    request: AiOperationAcceptRequest,
  ): Promise<AiProposalDetail> {
    this.featureGate.requireProposal();
    return this.prisma.$transaction(async (tx) => {
      const { operation, proposal } = await this.loadOperationForMutation(
        tx,
        userId,
        proposalId,
        operationId,
        request.version,
      );
      if (operation.status !== "PENDING") {
        throw operationInvalidState();
      }
      const now = new Date();
      await this.claimProposalVersion(tx, proposal, request.version, now);
      const updated = await tx.aiOperation.updateMany({
        data: { acceptedAt: now, status: "ACCEPTED" },
        where: {
          id: operationId,
          proposalId,
          status: "PENDING",
        },
      });
      if (updated.count !== 1) {
        throw operationInvalidState();
      }
      return this.loadDetail(tx, userId, proposalId);
    });
  }

  async rejectOperation(
    userId: string,
    proposalId: Identifier,
    operationId: Identifier,
    request: AiOperationRejectRequest,
  ): Promise<AiProposalDetail> {
    this.featureGate.requireProposal();
    return this.prisma.$transaction(async (tx) => {
      const { operation, proposal } = await this.loadOperationForMutation(
        tx,
        userId,
        proposalId,
        operationId,
        request.version,
      );
      if (operation.status !== "PENDING" && operation.status !== "ACCEPTED") {
        throw operationInvalidState();
      }
      const now = new Date();
      await this.claimProposalVersion(tx, proposal, request.version, now);
      const rejected = await tx.aiOperation.updateMany({
        data: { rejectedAt: now, status: "REJECTED" },
        where: {
          id: operationId,
          proposalId,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
      });
      if (rejected.count !== 1) {
        throw operationInvalidState();
      }
      const remaining = await tx.aiOperation.count({
        where: { proposalId, status: { not: "REJECTED" } },
      });
      if (remaining === 0) {
        await tx.aiProposal.update({
          data: { completedAt: now, status: "REJECTED" },
          where: { id: proposalId },
        });
      }
      return this.loadDetail(tx, userId, proposalId);
    });
  }

  async rejectProposal(
    userId: string,
    proposalId: Identifier,
    request: AiProposalRejectRequest,
  ): Promise<AiProposalDetail> {
    this.featureGate.requireProposal();
    return this.prisma.$transaction(async (tx) => {
      await this.lockProposalForUpdate(tx, userId, proposalId);
      await this.lockOperationsForUpdate(tx, proposalId);
      const proposal = await tx.aiProposal.findFirst({
        where: { id: proposalId, userId },
      });
      if (!proposal) {
        throw proposalNotFound();
      }
      if (proposal.status !== "PENDING_REVIEW") {
        throw proposalInvalidState();
      }
      if (proposal.version !== request.version) {
        throw versionConflict();
      }
      const now = new Date();
      const updated = await tx.aiProposal.updateMany({
        data: {
          completedAt: now,
          reviewedAt: proposal.reviewedAt ?? now,
          status: "REJECTED",
          version: { increment: 1 },
        },
        where: {
          id: proposalId,
          status: "PENDING_REVIEW",
          userId,
          version: request.version,
        },
      });
      if (updated.count !== 1) {
        throw versionConflict();
      }
      await tx.aiOperation.updateMany({
        data: { rejectedAt: now, status: "REJECTED" },
        where: {
          proposalId,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
      });
      return this.loadDetail(tx, userId, proposalId);
    });
  }

  protected normalizeProviderResult(
    request: AiProposalCreateRequest,
    result: FakeAiProviderResult,
  ): NormalizedProviderResult {
    if (
      !result ||
      typeof result.providerId !== "string" ||
      typeof result.modelId !== "string" ||
      !Array.isArray(result.operations)
    ) {
      throw schemaValidationError();
    }
    const operations =
      result.resultType === "UNCERTAIN"
        ? [this.syntheticUncertainOperation(request, result)]
        : result.resultType === "SUCCESS"
          ? result.operations.map((operation) =>
              this.validateProviderOperation(operation),
            )
          : (() => {
              throw schemaValidationError();
            })();
    if (operations.length === 0) {
      throw schemaValidationError();
    }
    const normalized = {
      modelId: result.modelId,
      operations,
      providerId: result.providerId,
    };
    return {
      ...normalized,
      responseFingerprint: sha256Fingerprint(normalized),
    };
  }

  private async resolveExistingCreate(
    existing: {
      failureCode: string | null;
      id: string;
      inputFingerprint: string;
      proposalId: string | null;
      status: string;
      userId: string;
    },
    userId: string,
    inputFingerprint: string,
  ): Promise<AiProposalCreateResponse> {
    if (
      existing.userId !== userId ||
      existing.inputFingerprint !== inputFingerprint
    ) {
      throw idempotencyConflict();
    }
    if (existing.status === "FAILED") {
      const code = providerFailureCode(existing.failureCode);
      throw new ApiException(code, 502, "The AI provider request failed");
    }
    if (existing.status !== "SUCCEEDED" || !existing.proposalId) {
      throw idempotencyConflict();
    }
    const [requestRow, proposal] = await Promise.all([
      this.prisma.aiRequest.findUniqueOrThrow({ where: { id: existing.id } }),
      this.prisma.aiProposal.findFirst({
        include: { operations: { orderBy: { ordinal: "asc" } } },
        where: { id: existing.proposalId, userId },
      }),
    ]);
    if (!proposal) {
      throw proposalNotFound();
    }
    return {
      request: toAiRequestSummary(requestRow),
      proposal: toAiProposalDetail(proposal),
    };
  }

  private async persistFailure(
    aiRequestId: string,
    failureCategory: string,
    failureCode: ApiErrorCode,
  ): Promise<void> {
    const completedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.aiProviderAttempt.updateMany({
        data: { completedAt, failureCategory, status: "FAILED" },
        where: { aiRequestId, attemptNo: 1, status: "RUNNING" },
      });
      const request = await tx.aiRequest.updateMany({
        data: {
          completedAt,
          failureCategory,
          failureCode,
          status: "FAILED",
        },
        where: { id: aiRequestId, status: "RUNNING" },
      });
      if (attempt.count !== 1 || request.count !== 1) {
        throw idempotencyConflict();
      }
    });
  }

  protected async loadOperationForMutation(
    tx: Prisma.TransactionClient,
    userId: string,
    proposalId: string,
    operationId: string,
    version: number,
  ) {
    await this.lockProposalForUpdate(tx, userId, proposalId);
    await this.lockOperationForUpdate(tx, proposalId, operationId);
    const proposal = await tx.aiProposal.findFirst({
      include: { operations: { where: { id: operationId } } },
      where: { id: proposalId, userId },
    });
    if (!proposal || proposal.operations.length !== 1) {
      throw proposalNotFound();
    }
    if (
      !REVIEWABLE_PROPOSAL_STATUSES.includes(
        proposal.status as (typeof REVIEWABLE_PROPOSAL_STATUSES)[number],
      ) ||
      TERMINAL_PROPOSAL_STATUSES.includes(
        proposal.status as (typeof TERMINAL_PROPOSAL_STATUSES)[number],
      )
    ) {
      throw proposalInvalidState();
    }
    if (proposal.version !== version) {
      throw versionConflict();
    }
    return { operation: proposal.operations[0]!, proposal };
  }

  protected async lockProposalForUpdate(
    tx: Prisma.TransactionClient,
    userId: string,
    proposalId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT \`id\`
      FROM \`ai_proposals\`
      WHERE \`id\` = ${proposalId} AND \`user_id\` = ${userId}
      FOR UPDATE
    `;
    if (rows.length !== 1) {
      throw proposalNotFound();
    }
  }

  protected async lockOperationForUpdate(
    tx: Prisma.TransactionClient,
    proposalId: string,
    operationId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT \`id\`
      FROM \`ai_operations\`
      WHERE \`id\` = ${operationId} AND \`proposal_id\` = ${proposalId}
      FOR UPDATE
    `;
    if (rows.length !== 1) {
      throw proposalNotFound();
    }
  }

  protected async lockOperationsForUpdate(
    tx: Prisma.TransactionClient,
    proposalId: string,
  ): Promise<void> {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT \`id\`
      FROM \`ai_operations\`
      WHERE \`proposal_id\` = ${proposalId}
      ORDER BY \`ordinal\` ASC, \`id\` ASC
      FOR UPDATE
    `;
  }

  protected async claimProposalVersion(
    tx: Prisma.TransactionClient,
    proposal: {
      id: string;
      reviewedAt: Date | null;
      status: string;
      userId: string;
    },
    expectedVersion: number,
    now = new Date(),
  ): Promise<void> {
    const claimed = await tx.aiProposal.updateMany({
      data: {
        reviewedAt: proposal.reviewedAt ?? now,
        version: { increment: 1 },
      },
      where: {
        id: proposal.id,
        status: proposal.status as "PENDING_REVIEW" | "PARTIALLY_APPLIED",
        userId: proposal.userId,
        version: expectedVersion,
      },
    });
    if (claimed.count !== 1) {
      throw versionConflict();
    }
  }

  private async loadDetail(
    client: Pick<PrismaService, "aiProposal"> | Prisma.TransactionClient,
    userId: string,
    proposalId: string,
  ): Promise<AiProposalDetail> {
    const proposal = await client.aiProposal.findFirst({
      include: { operations: { orderBy: { ordinal: "asc" } } },
      where: { id: proposalId, userId },
    });
    if (!proposal) {
      throw proposalNotFound();
    }
    return toAiProposalDetail(proposal);
  }

  private validateProviderOperation(
    operation: FakeAiOperationCandidate,
  ): NormalizedOperation {
    const validOperationTypes = [
      "TRANSACTION",
      "CALENDAR_EVENT",
      "TASK",
      "REMINDER",
      "TRIP",
    ];
    if (
      !operation ||
      operation.status !== "PENDING" ||
      !validOperationTypes.includes(operation.operationType) ||
      !/^(?:0\.\d{4}|1\.0000)$/.test(operation.confidence) ||
      operation.fields === null ||
      Array.isArray(operation.fields) ||
      typeof operation.fields !== "object" ||
      (operation.clarification !== null &&
        (typeof operation.clarification !== "string" ||
          operation.clarification.length > 500))
    ) {
      throw schemaValidationError();
    }
    return {
      clarification: operation.clarification,
      confidence: operation.confidence,
      fields: structuredClone(operation.fields),
      operationType: operation.operationType,
      status: "PENDING",
    };
  }

  private syntheticUncertainOperation(
    request: AiProposalCreateRequest,
    result: Extract<FakeAiProviderResult, { resultType: "UNCERTAIN" }>,
  ): NormalizedOperation {
    if (
      typeof result.clarification !== "string" ||
      !Array.isArray(result.missingFields) ||
      result.missingFields.some((field) => typeof field !== "string")
    ) {
      throw schemaValidationError();
    }
    const missing = result.missingFields.join(", ");
    const clarification = `${result.clarification} 缺少字段：${missing}`.slice(
      0,
      500,
    );
    return {
      clarification,
      confidence: "0.0000",
      fields: {},
      operationType: operationTypeForRequestType(request.requestType),
      status: "PENDING",
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function providerFailureCode(value: string | null): ApiErrorCode {
  return value === "AI_SCHEMA_VALIDATION_ERROR"
    ? "AI_SCHEMA_VALIDATION_ERROR"
    : "AI_PROVIDER_ERROR";
}

function proposalNotFound(): ApiException {
  return new ApiException(
    "AI_PROPOSAL_NOT_FOUND",
    404,
    "AI proposal not found",
  );
}

function proposalInvalidState(): ApiException {
  return new ApiException(
    "AI_PROPOSAL_INVALID_STATE",
    409,
    "AI proposal cannot be reviewed in its current state",
  );
}

function operationInvalidState(): ApiException {
  return new ApiException(
    "AI_OPERATION_INVALID_STATE",
    409,
    "AI operation cannot be reviewed in its current state",
  );
}

function versionConflict(): ApiException {
  return new ApiException(
    "VERSION_CONFLICT",
    409,
    "AI proposal was modified elsewhere",
  );
}

function idempotencyConflict(): ApiException {
  return new ApiException(
    "IDEMPOTENCY_CONFLICT",
    409,
    "Idempotency-Key was already used",
  );
}

function schemaValidationError(): ApiException {
  return new ApiException(
    "AI_SCHEMA_VALIDATION_ERROR",
    502,
    "AI provider returned an invalid proposal",
  );
}
