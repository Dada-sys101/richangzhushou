import { Injectable } from "@nestjs/common";
import type {
  AiFinalConfirmRequest,
  AiFinalConfirmResponse,
  AiOperationType,
  AiProposalDetail,
  Identifier,
} from "@daily-assistant/api-contracts";

import { Prisma } from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AiFakeProviderFactory } from "./ai-fake-provider.factory.js";
import { AiFeatureGate } from "./ai-feature-gate.js";
import {
  AiFormalWriteOrchestrator,
  type FormalWriteResult,
  type PreparedFormalWrite,
} from "./ai-formal-write.orchestrator.js";
import { sha256Fingerprint } from "./ai-proposal.fingerprint.js";
import { toAiProposalDetail } from "./ai-proposal.mapper.js";
import { AiProposalReviewService } from "./ai-proposal.review-service.js";

const REVIEWABLE_PROPOSAL_STATUSES = [
  "PENDING_REVIEW",
  "PARTIALLY_APPLIED",
] as const;

const TERMINAL_PROPOSAL_STATUSES = [
  "REJECTED",
  "EXPIRED",
  "FAILED",
  "CANCELLED",
] as const;

const REPLAYABLE_OPERATION_STATUS = "APPLIED" as const;
const CONFIRMABLE_OPERATION_STATUS = "ACCEPTED" as const;

type ProposalWithOperations = Prisma.AiProposalGetPayload<{
  include: { operations: { orderBy: { ordinal: "asc" } } };
}>;

interface PreparedFinalWrite {
  fieldsFingerprint: string;
  write: PreparedFormalWrite;
}

/** Stable, server-owned mutation key used by every formal Domain Service. */
export function buildAiFinalClientMutationId(
  proposalId: Identifier,
  operationId: Identifier,
): string {
  const direct = `ai-final:${proposalId}:${operationId}`;
  if (direct.length >= 16 && direct.length <= 128) {
    return direct;
  }
  return `ai-final:${sha256Fingerprint({ operationId, proposalId })}`;
}

/**
 * H04 concrete application service. H03's review implementation remains the
 * owner of create/list/get/edit/accept/reject; only finalConfirm is added here.
 */
@Injectable()
export class AiProposalService extends AiProposalReviewService {
  constructor(
    prisma: PrismaService,
    fakeProviderFactory: AiFakeProviderFactory,
    private readonly formalWriteOrchestrator: AiFormalWriteOrchestrator,
    featureGate: AiFeatureGate = new AiFeatureGate(),
  ) {
    super(prisma, fakeProviderFactory, featureGate);
  }

  override async finalConfirm(
    userId: string,
    proposalId: Identifier,
    request: AiFinalConfirmRequest,
  ): Promise<AiFinalConfirmResponse> {
    this.featureGate.requireProposal();
    const proposal = await this.loadProposal(userId, proposalId);
    const requested = this.requestedOperations(proposal, request.operationIds);

    if (TERMINAL_PROPOSAL_STATUSES.includes(proposal.status as never)) {
      throw proposalInvalidState();
    }

    const allRequestedApplied = requested.every(
      (operation) => operation.status === REPLAYABLE_OPERATION_STATUS,
    );
    if (proposal.status === "APPLIED") {
      if (!allRequestedApplied) {
        throw proposalInvalidState();
      }
      return toAiProposalDetail(proposal);
    }

    if (!REVIEWABLE_PROPOSAL_STATUSES.includes(proposal.status as never)) {
      throw proposalInvalidState();
    }
    if (allRequestedApplied) {
      // A response-loss retry may carry the pre-confirm version. Replaying
      // APPLIED operations is intentionally independent of that stale value.
      return toAiProposalDetail(proposal);
    }

    for (const operation of requested) {
      if (
        operation.status !== CONFIRMABLE_OPERATION_STATUS &&
        operation.status !== REPLAYABLE_OPERATION_STATUS
      ) {
        throw operationInvalidState();
      }
    }
    if (!Number.isInteger(request.version) || request.version < 1) {
      throw validationError("Final confirmation version is invalid");
    }
    if (proposal.version !== request.version) {
      throw versionConflict();
    }

    this.featureGate.requireBusinessWrite();

    // Validate every accepted operation before claiming the version or
    // invoking any formal Domain Service. This guarantees an invalid later
    // operation cannot follow an earlier business write.
    const prepared = new Map<string, PreparedFinalWrite>();
    for (const operation of requested) {
      if (operation.status !== CONFIRMABLE_OPERATION_STATUS) {
        continue;
      }
      const fields = toFields(operation.fieldsJson);
      const preparedWrite = await this.formalWriteOrchestrator.prepare(
        operation.operationType as AiOperationType,
        fields,
        buildAiFinalClientMutationId(proposalId, operation.id),
      );
      prepared.set(operation.id, {
        fieldsFingerprint: sha256Fingerprint(fields),
        write: preparedWrite,
      });
    }

    let expectedVersion = request.version;
    let claimVersion = true;
    for (const operation of requested) {
      if (operation.status !== CONFIRMABLE_OPERATION_STATUS) {
        continue;
      }
      const preparedWrite = prepared.get(operation.id);
      if (!preparedWrite) {
        throw operationInvalidState();
      }
      await this.applyPreparedOperation(
        userId,
        proposalId,
        operation.id,
        operation.operationType as AiOperationType,
        preparedWrite,
        expectedVersion,
        claimVersion,
      );
      if (claimVersion) {
        expectedVersion += 1;
        claimVersion = false;
      }
    }

    return this.loadFinalDetail(userId, proposalId);
  }

  private async applyPreparedOperation(
    userId: string,
    proposalId: string,
    operationId: string,
    operationType: AiOperationType,
    prepared: PreparedFinalWrite,
    expectedVersion: number,
    claimVersion: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { operation, proposal } = await this.loadOperationForMutation(
        tx,
        userId,
        proposalId,
        operationId,
        expectedVersion,
      );
      if (operation.status !== CONFIRMABLE_OPERATION_STATUS) {
        throw operationInvalidState();
      }
      if (
        operation.operationType !== operationType ||
        operation.fieldsFingerprint !== prepared.fieldsFingerprint
      ) {
        throw operationInvalidState();
      }
      if (claimVersion) {
        await this.claimProposalVersion(tx, proposal, expectedVersion);
      }
      const result = await this.formalWriteOrchestrator.applyPrepared(
        userId,
        prepared.write,
        tx,
      );
      await this.persistAppliedInTx(
        tx,
        userId,
        proposalId,
        operationId,
        operationType,
        result,
      );
    });
  }

  private async loadProposal(
    userId: string,
    proposalId: string,
  ): Promise<ProposalWithOperations> {
    const proposal = await this.prisma.aiProposal.findFirst({
      include: { operations: { orderBy: { ordinal: "asc" } } },
      where: { id: proposalId, userId },
    });
    if (!proposal) {
      throw proposalNotFound();
    }
    return proposal;
  }

  private requestedOperations(
    proposal: ProposalWithOperations,
    operationIds: readonly string[],
  ): ProposalWithOperations["operations"] {
    if (
      !Array.isArray(operationIds) ||
      operationIds.length === 0 ||
      new Set(operationIds).size !== operationIds.length
    ) {
      throw validationError("At least one unique operation is required");
    }
    const requested = operationIds.map((operationId) =>
      proposal.operations.find((operation) => operation.id === operationId),
    );
    if (requested.some((operation) => !operation)) {
      // Do not reveal whether a foreign operation ID exists elsewhere.
      throw proposalNotFound();
    }
    return requested
      .filter(
        (
          operation,
        ): operation is ProposalWithOperations["operations"][number] =>
          Boolean(operation),
      )
      .sort((left, right) => left.ordinal - right.ordinal);
  }

  private async persistAppliedInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    proposalId: string,
    operationId: string,
    operationType: AiOperationType,
    result: FormalWriteResult,
  ): Promise<void> {
    const now = new Date();
    const updated = await tx.aiOperation.updateMany({
      data: {
        appliedAt: now,
        errorCode: null,
        errorMessage: null,
        resultDraftId: null,
        resultEntityId: result.resultEntityId,
        resultEntityType: operationType,
        status: "APPLIED",
      },
      where: {
        id: operationId,
        proposalId,
        status: "ACCEPTED",
      },
    });
    if (updated.count !== 1) {
      throw operationInvalidState();
    }

    const operations = await tx.aiOperation.findMany({
      orderBy: { ordinal: "asc" },
      select: { status: true },
      where: { proposalId },
    });
    const hasApplied = operations.some(
      (operation) => operation.status === "APPLIED",
    );
    if (!hasApplied) {
      return;
    }
    const settled = operations.every(
      (operation) =>
        operation.status === "APPLIED" || operation.status === "REJECTED",
    );
    const proposalUpdate = await tx.aiProposal.updateMany({
      data: settled
        ? { completedAt: now, status: "APPLIED" }
        : { completedAt: null, status: "PARTIALLY_APPLIED" },
      where: { id: proposalId, userId },
    });
    if (proposalUpdate.count !== 1) {
      throw proposalNotFound();
    }
  }

  private async loadFinalDetail(
    userId: string,
    proposalId: string,
  ): Promise<AiProposalDetail> {
    const proposal = await this.prisma.aiProposal.findFirst({
      include: { operations: { orderBy: { ordinal: "asc" } } },
      where: { id: proposalId, userId },
    });
    if (!proposal) {
      throw proposalNotFound();
    }
    return toAiProposalDetail(proposal);
  }
}

function toFields(value: unknown): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw validationError("AI operation fields must be an object");
  }
  return value as Record<string, unknown>;
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
    "AI proposal cannot be confirmed in its current state",
  );
}

function operationInvalidState(): ApiException {
  return new ApiException(
    "AI_OPERATION_INVALID_STATE",
    409,
    "AI operation cannot be confirmed in its current state",
  );
}

function versionConflict(): ApiException {
  return new ApiException(
    "VERSION_CONFLICT",
    409,
    "AI proposal was modified elsewhere",
  );
}

function validationError(message: string): ApiException {
  return new ApiException("VALIDATION_ERROR", 400, message);
}
