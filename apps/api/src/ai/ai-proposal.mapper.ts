import type {
  AiConfidence,
  AiOperation,
  AiOperationStatus,
  AiOperationType,
  AiProposalDetail,
  AiProposalStatus,
  AiProposalSummary,
  AiRequestStatus,
  AiRequestSummary,
  ApiErrorCode,
} from "@daily-assistant/api-contracts";

interface RequestRow {
  completedAt: Date | null;
  createdAt: Date;
  failureCategory: string | null;
  failureCode: string | null;
  id: string;
  locale: string;
  proposalId: string | null;
  requestId: string;
  startedAt: Date | null;
  status: string;
  timeZoneId: string;
  updatedAt: Date;
}

interface ProposalRow {
  completedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  modelId: string;
  providerId: string;
  reviewedAt: Date | null;
  schemaVersion: number;
  status: string;
  updatedAt: Date;
  version: number;
}

interface OperationRow {
  acceptedAt: Date | null;
  appliedAt: Date | null;
  clarification: string | null;
  confidence: unknown;
  createdAt: Date;
  errorCode: string | null;
  errorMessage: string | null;
  fieldsJson: unknown;
  id: string;
  operationType: string;
  ordinal: number;
  rejectedAt: Date | null;
  resultDraftId: string | null;
  resultEntityId: string | null;
  resultEntityType: string | null;
  status: string;
  updatedAt: Date;
}

export function toAiRequestSummary(row: RequestRow): AiRequestSummary {
  return {
    id: row.id,
    requestId: row.requestId,
    locale: row.locale,
    timeZoneId: row.timeZoneId,
    status: row.status as AiRequestStatus,
    proposalId: row.proposalId,
    failureCategory: row.failureCategory,
    failureCode: row.failureCode,
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAiProposalSummary(row: ProposalRow): AiProposalSummary {
  return {
    id: row.id,
    providerId: row.providerId,
    modelId: row.modelId,
    status: row.status as AiProposalStatus,
    schemaVersion: row.schemaVersion,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: toIso(row.reviewedAt),
    completedAt: toIso(row.completedAt),
    expiresAt: toIso(row.expiresAt),
  };
}

export function toAiProposalDetail(
  row: ProposalRow & { operations: OperationRow[] },
): AiProposalDetail {
  return {
    ...toAiProposalSummary(row),
    operations: [...row.operations]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map(toAiOperation),
  };
}

export function toAiOperation(row: OperationRow): AiOperation {
  return {
    id: row.id,
    ordinal: row.ordinal,
    operationType: row.operationType as AiOperationType,
    status: row.status as AiOperationStatus,
    confidence: normalizeConfidence(row.confidence),
    fields: toRecord(row.fieldsJson),
    clarification: row.clarification,
    resultEntityType: row.resultEntityType,
    resultEntityId: row.resultEntityId,
    resultDraftId: row.resultDraftId,
    errorCode: row.errorCode as ApiErrorCode | null,
    errorMessage: row.errorMessage,
    acceptedAt: toIso(row.acceptedAt),
    rejectedAt: toIso(row.rejectedAt),
    appliedAt: toIso(row.appliedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeConfidence(value: unknown): AiConfidence {
  const rendered =
    typeof value === "object" &&
    value !== null &&
    "toFixed" in value &&
    typeof value.toFixed === "function"
      ? value.toFixed(4)
      : Number(value).toFixed(4);
  const numeric = Number(rendered);
  if (!/^\d\.\d{4}$/.test(rendered) || numeric < 0 || numeric > 1) {
    throw new TypeError("Invalid AI confidence value");
  }
  return rendered as AiConfidence;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError("AI operation fields must be a JSON object");
  }
  return structuredClone(value as Record<string, unknown>);
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}
