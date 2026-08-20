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
import {
  AiCircuitBreaker,
  type AiBreakerPermit,
  type AiBreakerSample,
} from "./ai-circuit-breaker.js";
import { AllowFakeAiBudgetGate, type AiBudgetGate } from "./ai-budget-gate.js";
import { AiFeatureGate } from "./ai-feature-gate.js";
import { validateAiOperationFields } from "./ai-formal-write.orchestrator.js";
import {
  AiProviderRouter,
  AiRouterSelectionError,
  type AiProviderAdapter,
} from "./ai-provider-router.js";
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

const ORIGINAL_INPUT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const STALE_REQUEST_MS = 60_000;
const PROVIDER_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 100;

export interface AiProposalRuntimeOptions {
  breaker?: AiCircuitBreaker;
  budgetGate?: AiBudgetGate;
  clock?: { now(): Date };
  providerRouter?: AiProviderRouter;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
}

interface ClassifiedProviderFailure {
  breakerSample: AiBreakerSample;
  category: string;
  code: ApiErrorCode;
  httpStatus?: number;
  retryable: boolean;
}

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
  private readonly breaker: AiCircuitBreaker;
  private readonly budgetGate: AiBudgetGate;
  private readonly clock: { now(): Date };
  private readonly providerRouter: AiProviderRouter;
  private readonly retryDelayMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly timeoutMs: number;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly fakeProviderFactory: AiFakeProviderFactory,
    protected readonly featureGate: AiFeatureGate = new AiFeatureGate(),
    runtime: AiProposalRuntimeOptions = {},
  ) {
    super();
    this.breaker = runtime.breaker ?? new AiCircuitBreaker();
    this.budgetGate = runtime.budgetGate ?? new AllowFakeAiBudgetGate();
    this.clock = runtime.clock ?? { now: () => new Date() };
    this.providerRouter =
      runtime.providerRouter ?? new AiProviderRouter(fakeProviderFactory);
    this.retryDelayMs = runtime.retryDelayMs ?? RETRY_DELAY_MS;
    this.sleep =
      runtime.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.timeoutMs = runtime.timeoutMs ?? PROVIDER_TIMEOUT_MS;
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
    operationTypeForRequestType(request.requestType);
    const inputFingerprint = sha256Fingerprint(request);
    const logicalNow = this.clock.now();
    const existing = await this.prisma.aiRequest.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return this.resolveExistingCreate(
        existing,
        userId,
        inputFingerprint,
        logicalNow,
      );
    }

    let claimed;
    try {
      claimed = await this.prisma.aiRequest.create({
        data: {
          createdAt: logicalNow,
          idempotencyKey,
          inputFingerprint,
          locale: request.locale,
          originalInputExpiresAt: new Date(
            logicalNow.getTime() + ORIGINAL_INPUT_RETENTION_MS,
          ),
          originalUserInput: request.userInput,
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
      return this.resolveExistingCreate(
        raced,
        userId,
        inputFingerprint,
        logicalNow,
      );
    }

    try {
      await this.featureGate.requireFakeProviderForCreate(this.prisma);
    } catch (error) {
      if (error instanceof ApiException && error.code !== "AI_DISABLED") {
        throw error;
      }
      return this.failClaimedAndThrow(
        claimed,
        userId,
        inputFingerprint,
        "FEATURE_DISABLED",
        "AI_DISABLED",
      );
    }

    let budgetDecision;
    try {
      budgetDecision = await this.budgetGate.evaluate();
    } catch {
      budgetDecision = "BUDGET_BLOCKED" as const;
    }
    if (budgetDecision !== "ALLOW") {
      return this.failClaimedAndThrow(
        claimed,
        userId,
        inputFingerprint,
        "BUDGET_BLOCKED",
        "AI_BUDGET_BLOCKED",
      );
    }

    let provider: AiProviderAdapter;
    try {
      provider = this.providerRouter.select(request.requestType);
    } catch (error) {
      if (
        error instanceof ApiException &&
        error.code === "AI_INPUT_VALIDATION_ERROR"
      ) {
        throw error;
      }
      return this.failClaimedAndThrow(
        claimed,
        userId,
        inputFingerprint,
        error instanceof AiRouterSelectionError
          ? error.category
          : "PROVIDER_UNAVAILABLE",
        "AI_PROVIDER_ERROR",
      );
    }

    const breakerResult = this.breaker.acquire(this.clock.now());
    if (!breakerResult.allowed) {
      return this.failClaimedAndThrow(
        claimed,
        userId,
        inputFingerprint,
        "CIRCUIT_OPEN",
        "AI_CIRCUIT_BREAKER_BLOCKED",
      );
    }

    const firstStartedAt = this.clock.now();
    const entered = await this.beginAttempt(
      claimed.id,
      userId,
      provider,
      1,
      firstStartedAt,
      true,
    );
    if (!entered) {
      this.breaker.abandon(breakerResult.permit, this.clock.now());
      const current = await this.prisma.aiRequest.findUniqueOrThrow({
        where: { id: claimed.id },
      });
      return this.resolveExistingCreate(
        current,
        userId,
        inputFingerprint,
        this.clock.now(),
      );
    }

    return this.executeProvider(
      claimed.id,
      userId,
      inputFingerprint,
      request,
      provider,
      breakerResult.permit,
      firstStartedAt,
    );
  }

  private async executeProvider(
    aiRequestId: string,
    userId: string,
    inputFingerprint: string,
    request: AiProposalCreateRequest,
    provider: AiProviderAdapter,
    breakerPermit: AiBreakerPermit,
    firstStartedAt: Date,
  ): Promise<AiProposalCreateResponse> {
    let attemptNo = 1;
    let attemptStartedAt = firstStartedAt;

    for (;;) {
      let normalized: NormalizedProviderResult;
      try {
        const result = await this.invokeProvider(provider, request);
        normalized = this.normalizeProviderResult(request, result);
        if (
          normalized.providerId !== provider.providerId ||
          normalized.modelId !== provider.modelId
        ) {
          throw malformedOutputError();
        }
        await this.validateProviderDomain(
          normalized,
          request,
          inputFingerprint,
        );
      } catch (error) {
        const failure = classifyProviderFailure(error);
        const completedAt = this.clock.now();
        if (failure.retryable && attemptNo === 1) {
          const terminalized = await this.terminalizeAttempt(
            aiRequestId,
            attemptNo,
            attemptStartedAt,
            completedAt,
            failure,
          );
          if (!terminalized) {
            this.breaker.abandon(breakerPermit, this.clock.now());
            return this.resolveCurrentCreate(
              aiRequestId,
              userId,
              inputFingerprint,
            );
          }
          await this.sleep(this.retryDelayMs);
          attemptNo = 2;
          attemptStartedAt = this.clock.now();
          const retryStarted = await this.beginAttempt(
            aiRequestId,
            userId,
            provider,
            attemptNo,
            attemptStartedAt,
            false,
          );
          if (!retryStarted) {
            this.breaker.abandon(breakerPermit, this.clock.now());
            return this.resolveCurrentCreate(
              aiRequestId,
              userId,
              inputFingerprint,
            );
          }
          continue;
        }

        await this.persistRunningFailure(
          aiRequestId,
          userId,
          attemptNo,
          attemptStartedAt,
          completedAt,
          failure,
        );
        this.breaker.record(breakerPermit, failure.breakerSample, completedAt);
        throw persistedFailureException(failure.code);
      }

      const completedAt = this.clock.now();
      const persisted = await this.persistSuccess(
        aiRequestId,
        userId,
        attemptNo,
        attemptStartedAt,
        completedAt,
        normalized,
      );
      this.breaker.record(breakerPermit, "SUCCESS", completedAt);
      return {
        request: toAiRequestSummary(persisted.request),
        proposal: toAiProposalDetail(persisted.proposal),
      };
    }
  }

  private async invokeProvider(
    provider: AiProviderAdapter,
    request: AiProposalCreateRequest,
  ): Promise<FakeAiProviderResult> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new ProviderTimeoutError());
      }, this.timeoutMs);

      Promise.resolve()
        .then(() => provider.generate(request))
        .then(
          (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(result);
          },
          (error: unknown) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
          },
        );
    });
  }

  private async validateProviderDomain(
    normalized: NormalizedProviderResult,
    request: AiProposalCreateRequest,
    inputFingerprint: string,
  ): Promise<void> {
    for (const operation of normalized.operations) {
      if (operation.operationType !== request.requestType) {
        throw domainValidationError();
      }
      if (
        operation.confidence === "0.0000" &&
        operation.clarification !== null
      ) {
        continue;
      }
      try {
        await validateAiOperationFields(
          operation.operationType,
          operation.fields,
          `ai-validation:${inputFingerprint}`,
        );
      } catch {
        throw domainValidationError();
      }
    }
  }

  private async beginAttempt(
    aiRequestId: string,
    userId: string,
    provider: AiProviderAdapter,
    attemptNo: number,
    startedAt: Date,
    firstAttempt: boolean,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const transitioned = await tx.aiRequest.updateMany({
        data: firstAttempt
          ? { startedAt, status: "RUNNING" }
          : { status: "RUNNING" },
        where: {
          id: aiRequestId,
          status: firstAttempt ? "CLAIMED" : "RUNNING",
          userId,
        },
      });
      if (transitioned.count !== 1) {
        return false;
      }
      await tx.aiProviderAttempt.create({
        data: {
          aiRequestId,
          attemptNo,
          modelId: provider.modelId,
          providerId: provider.providerId,
          startedAt,
          status: "RUNNING",
        },
      });
      return true;
    });
  }

  private async terminalizeAttempt(
    aiRequestId: string,
    attemptNo: number,
    startedAt: Date,
    completedAt: Date,
    failure: ClassifiedProviderFailure,
  ): Promise<boolean> {
    const updated = await this.prisma.aiProviderAttempt.updateMany({
      data: {
        completedAt,
        failureCategory: failure.category,
        httpStatus: failure.httpStatus,
        latencyMs: elapsedMilliseconds(startedAt, completedAt),
        status: "FAILED",
      },
      where: { aiRequestId, attemptNo, status: "RUNNING" },
    });
    return updated.count === 1;
  }

  private async persistRunningFailure(
    aiRequestId: string,
    userId: string,
    attemptNo: number,
    startedAt: Date,
    completedAt: Date,
    failure: ClassifiedProviderFailure,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.aiProviderAttempt.updateMany({
        data: {
          completedAt,
          failureCategory: failure.category,
          httpStatus: failure.httpStatus,
          latencyMs: elapsedMilliseconds(startedAt, completedAt),
          status: "FAILED",
        },
        where: { aiRequestId, attemptNo, status: "RUNNING" },
      });
      const requestUpdate = await tx.aiRequest.updateMany({
        data: {
          completedAt,
          failureCategory: failure.category,
          failureCode: failure.code,
          status: "FAILED",
        },
        where: { id: aiRequestId, status: "RUNNING", userId },
      });
      if (attempt.count !== 1 || requestUpdate.count !== 1) {
        throw idempotencyConflict();
      }
    });
  }

  private async persistSuccess(
    aiRequestId: string,
    userId: string,
    attemptNo: number,
    startedAt: Date,
    completedAt: Date,
    normalized: NormalizedProviderResult,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.aiProposal.create({
        data: {
          aiRequestId,
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
        data: {
          completedAt,
          latencyMs: elapsedMilliseconds(startedAt, completedAt),
          status: "SUCCEEDED",
        },
        where: { aiRequestId, attemptNo, status: "RUNNING" },
      });
      const requestUpdate = await tx.aiRequest.updateMany({
        data: {
          completedAt,
          originalInputExpiresAt: null,
          originalUserInput: null,
          proposalId: proposal.id,
          status: "SUCCEEDED",
        },
        where: { id: aiRequestId, status: "RUNNING", userId },
      });
      if (attempt.count !== 1 || requestUpdate.count !== 1) {
        throw idempotencyConflict();
      }
      const requestRow = await tx.aiRequest.findUniqueOrThrow({
        where: { id: aiRequestId },
      });
      return { proposal, request: requestRow };
    });
  }

  private async failClaimedAndThrow(
    claimed: { id: string },
    userId: string,
    inputFingerprint: string,
    failureCategory: string,
    failureCode: ApiErrorCode,
  ): Promise<AiProposalCreateResponse> {
    const completedAt = this.clock.now();
    const updated = await this.prisma.aiRequest.updateMany({
      data: {
        completedAt,
        failureCategory,
        failureCode,
        status: "FAILED",
      },
      where: { id: claimed.id, status: "CLAIMED", userId },
    });
    if (updated.count !== 1) {
      return this.resolveCurrentCreate(claimed.id, userId, inputFingerprint);
    }
    throw persistedFailureException(failureCode);
  }

  private async resolveCurrentCreate(
    aiRequestId: string,
    userId: string,
    inputFingerprint: string,
  ): Promise<AiProposalCreateResponse> {
    const current = await this.prisma.aiRequest.findUniqueOrThrow({
      where: { id: aiRequestId },
    });
    return this.resolveExistingCreate(
      current,
      userId,
      inputFingerprint,
      this.clock.now(),
    );
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
      throw malformedOutputError();
    }
    const operations =
      result.resultType === "UNCERTAIN"
        ? [this.syntheticUncertainOperation(request, result)]
        : result.resultType === "SUCCESS"
          ? result.operations.map((operation) =>
              this.validateProviderOperation(operation),
            )
          : (() => {
              throw malformedOutputError();
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
      createdAt: Date;
      failureCode: string | null;
      id: string;
      inputFingerprint: string;
      proposalId: string | null;
      startedAt: Date | null;
      status: string;
      userId: string;
    },
    userId: string,
    inputFingerprint: string,
    now: Date,
  ): Promise<AiProposalCreateResponse> {
    if (
      existing.userId !== userId ||
      existing.inputFingerprint !== inputFingerprint
    ) {
      throw idempotencyConflict();
    }
    if (existing.status === "FAILED") {
      throw persistedFailureException(
        persistedProviderFailureCode(existing.failureCode),
      );
    }
    if (existing.status === "CLAIMED") {
      if (existing.createdAt.getTime() > now.getTime() - STALE_REQUEST_MS) {
        throw idempotencyConflict();
      }
      const recovered = await this.prisma.aiRequest.updateMany({
        data: {
          completedAt: now,
          failureCategory: "STALE_CLAIMED_RECOVERY",
          failureCode: "INTERNAL_ERROR",
          status: "FAILED",
        },
        where: { id: existing.id, status: "CLAIMED", userId },
      });
      if (recovered.count === 1) {
        throw persistedFailureException("INTERNAL_ERROR");
      }
      return this.resolveCurrentCreate(existing.id, userId, inputFingerprint);
    }
    if (existing.status === "RUNNING") {
      if (
        existing.startedAt !== null &&
        existing.startedAt.getTime() > now.getTime() - STALE_REQUEST_MS
      ) {
        throw idempotencyConflict();
      }
      const inconsistent = existing.startedAt === null;
      const failureCategory = inconsistent
        ? "INCONSISTENT_RUNNING_STATE"
        : "STALE_RUNNING_RECOVERY";
      const failureCode: ApiErrorCode = inconsistent
        ? "INTERNAL_ERROR"
        : "AI_PROVIDER_TIMEOUT";
      try {
        await this.prisma.$transaction(async (tx) => {
          const requestUpdate = await tx.aiRequest.updateMany({
            data: {
              completedAt: now,
              failureCategory,
              failureCode,
              status: "FAILED",
            },
            where: {
              id: existing.id,
              startedAt: inconsistent ? null : existing.startedAt,
              status: "RUNNING",
              userId,
            },
          });
          if (requestUpdate.count !== 1) {
            throw new RecoveryRaceLostError();
          }
          await tx.aiProviderAttempt.updateMany({
            data: { completedAt: now, failureCategory, status: "FAILED" },
            where: { aiRequestId: existing.id, status: "RUNNING" },
          });
        });
      } catch (error) {
        if (error instanceof RecoveryRaceLostError) {
          return this.resolveCurrentCreate(
            existing.id,
            userId,
            inputFingerprint,
          );
        }
        throw error;
      }
      throw persistedFailureException(failureCode);
    }
    if (existing.status === "CANCELLED") {
      throw idempotencyConflict();
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

function classifyProviderFailure(error: unknown): ClassifiedProviderFailure {
  if (error instanceof FakeAiProviderError) {
    return {
      breakerSample: error.retryable ? "TECHNICAL_FAILURE" : "NON_TECHNICAL",
      category: error.errorCategory,
      code: error.errorCode,
      httpStatus: error.httpStatus,
      retryable: error.retryable,
    };
  }
  if (error instanceof ProviderTimeoutError) {
    return {
      breakerSample: "TECHNICAL_FAILURE",
      category: "TIMEOUT",
      code: "AI_PROVIDER_TIMEOUT",
      retryable: true,
    };
  }
  if (error instanceof ApiException) {
    if (error.code === "AI_SCHEMA_VALIDATION_ERROR") {
      return {
        breakerSample: "NON_TECHNICAL",
        category: "SCHEMA_INVALID",
        code: error.code,
        retryable: false,
      };
    }
    if (error.code === "AI_DOMAIN_VALIDATION_ERROR") {
      return {
        breakerSample: "NON_TECHNICAL",
        category: "DOMAIN_INVALID",
        code: error.code,
        retryable: false,
      };
    }
    if (error.code === "AI_MALFORMED_OUTPUT") {
      return {
        breakerSample: "NON_TECHNICAL",
        category: "MALFORMED_RESPONSE",
        code: error.code,
        retryable: false,
      };
    }
  }
  return {
    breakerSample: "NON_TECHNICAL",
    category: "INTERNAL_ROUTER_ERROR",
    code: "INTERNAL_ERROR",
    retryable: false,
  };
}

function persistedProviderFailureCode(value: string | null): ApiErrorCode {
  const known = new Set<ApiErrorCode>([
    "AI_DISABLED",
    "AI_BUDGET_BLOCKED",
    "AI_CIRCUIT_BREAKER_BLOCKED",
    "AI_PROVIDER_TIMEOUT",
    "AI_PROVIDER_NETWORK_ERROR",
    "AI_SCHEMA_VALIDATION_ERROR",
    "AI_DOMAIN_VALIDATION_ERROR",
    "AI_MALFORMED_OUTPUT",
    "AI_PROVIDER_ERROR",
    "INTERNAL_ERROR",
  ]);
  return value !== null && known.has(value as ApiErrorCode)
    ? (value as ApiErrorCode)
    : "INTERNAL_ERROR";
}

function persistedFailureException(code: ApiErrorCode): ApiException {
  const statusCode =
    code === "AI_DISABLED"
      ? 403
      : code === "AI_BUDGET_BLOCKED" || code === "AI_CIRCUIT_BREAKER_BLOCKED"
        ? 429
        : code === "AI_PROVIDER_TIMEOUT"
          ? 504
          : code === "INTERNAL_ERROR"
            ? 500
            : 502;
  const message =
    code === "AI_DISABLED"
      ? "AI features are disabled"
      : code === "AI_BUDGET_BLOCKED"
        ? "The AI budget gate blocked this request"
        : code === "AI_CIRCUIT_BREAKER_BLOCKED"
          ? "The AI provider is temporarily unavailable"
          : code === "INTERNAL_ERROR"
            ? "The AI request could not be completed"
            : "The AI provider request failed";
  return new ApiException(code, statusCode, message);
}

function elapsedMilliseconds(startedAt: Date, completedAt: Date): number {
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

class ProviderTimeoutError extends Error {}

class RecoveryRaceLostError extends Error {}

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

function domainValidationError(): ApiException {
  return new ApiException(
    "AI_DOMAIN_VALIDATION_ERROR",
    502,
    "AI provider output failed domain validation",
  );
}

function malformedOutputError(): ApiException {
  return new ApiException(
    "AI_MALFORMED_OUTPUT",
    502,
    "AI provider returned malformed output",
  );
}
