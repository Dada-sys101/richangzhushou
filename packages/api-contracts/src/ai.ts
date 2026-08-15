import type {
  AiOperationStatus,
  AiOperationType,
  AiProposalStatus,
  AiRequestStatus,
  ApiErrorCode,
} from "./enums.js";
import type { Identifier, IsoDateTime, Money } from "./types.js";

export const AI_PROVIDER_INPUT_ALLOWED_FIELDS = Object.freeze([
  "userInput",
  "requestType",
  "locale",
  "timeZoneId",
  "currentDateTime",
  "currency",
  "allowedCategoryLabels",
  "explicitSelectedContext",
] as const);

export type AiProviderInputField =
  (typeof AI_PROVIDER_INPUT_ALLOWED_FIELDS)[number];

/**
 * Actively user-selected context only. Keep this to a safe public reference;
 * never include full history, body content, credentials, or raw prompts.
 */
export interface AiSelectedContext {
  id: Identifier;
  entityType: string;
  summary: string;
}

export interface AiProviderInput {
  userInput: string;
  requestType: string;
  locale: string;
  timeZoneId: string;
  currentDateTime: IsoDateTime;
  currency: string;
  allowedCategoryLabels: string[];
  /**
   * Required even when no context is selected; an empty array means "none".
   * Keeping it required makes the absence of a selection explicit rather than
   * relying on an omitted field.
   */
  explicitSelectedContext: AiSelectedContext[];
}

type _ProviderInputKeysAreLocked =
  keyof AiProviderInput extends AiProviderInputField
    ? AiProviderInputField extends keyof AiProviderInput
      ? true
      : never
    : never;

export type AiProviderInputKeysAreLocked =
  _ProviderInputKeysAreLocked extends true ? true : never;

export const AI_AUDIT_METADATA_ALLOWED_FIELDS = Object.freeze([
  "requestId",
  "providerId",
  "modelId",
  "latencyMs",
  "inputTokens",
  "outputTokens",
  "resultType",
  "schemaValidationStatus",
  "errorCategory",
  "retryCount",
  "circuitBreakerState",
  "costMetadata",
  "pseudonymousIdentifier",
] as const);

export type AiAuditMetadataField =
  (typeof AI_AUDIT_METADATA_ALLOWED_FIELDS)[number];

export type AiSchemaValidationStatus = "VALID" | "INVALID" | "SKIPPED";

export type AiCircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface AiAuditCostMetadata {
  amount: Money;
  currency: string;
}

export interface AiAuditMetadata {
  requestId: string;
  providerId?: string | null;
  modelId?: string | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  resultType?: string | null;
  schemaValidationStatus?: AiSchemaValidationStatus | null;
  errorCategory?: string | null;
  retryCount: number;
  circuitBreakerState?: AiCircuitBreakerState | null;
  costMetadata?: AiAuditCostMetadata | null;
  pseudonymousIdentifier?: string | null;
}

type _AuditMetadataKeysAreLocked =
  keyof AiAuditMetadata extends AiAuditMetadataField
    ? AiAuditMetadataField extends keyof AiAuditMetadata
      ? true
      : never
    : never;

export type AiAuditMetadataKeysAreLocked =
  _AuditMetadataKeysAreLocked extends true ? true : never;

type DecimalDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

/**
 * Normalized fixed-point confidence from PR2 DECIMAL(5,4), represented as a
 * four-decimal string in the inclusive range 0.0000 through 1.0000.
 */
export type AiConfidence =
  `0.${DecimalDigit}${DecimalDigit}${DecimalDigit}${DecimalDigit}` | "1.0000";

/**
 * Public summary of an AiRequest. This intentionally exposes only the safe
 * request/status fields that PR18 needs and never the internal user identity,
 * idempotency key, input fingerprint, or raw/prompt request body.
 */
export interface AiRequestSummary {
  id: Identifier;
  requestId: string;
  locale: string;
  timeZoneId: string;
  status: AiRequestStatus;
  proposalId: Identifier | null;
  failureCategory: string | null;
  failureCode: string | null;
  startedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AiProposalSummary {
  id: Identifier;
  providerId: string;
  modelId: string;
  status: AiProposalStatus;
  schemaVersion: number;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  reviewedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  expiresAt: IsoDateTime | null;
}

export interface AiOperation {
  id: Identifier;
  ordinal: number;
  operationType: AiOperationType;
  status: AiOperationStatus;
  confidence: AiConfidence;
  fields: Record<string, unknown>;
  clarification: string | null;
  resultEntityType: string | null;
  resultEntityId: Identifier | null;
  resultDraftId: Identifier | null;
  errorCode: ApiErrorCode | null;
  errorMessage: string | null;
  acceptedAt: IsoDateTime | null;
  rejectedAt: IsoDateTime | null;
  appliedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AiProposalDetail extends AiProposalSummary {
  operations: AiOperation[];
}

/**
 * The create body is exactly the frozen provider input. HTTP idempotency stays
 * in the Idempotency-Key header and must never be copied into this body.
 */
export type AiProposalCreateRequest = AiProviderInput;

export interface AiProposalCreateResponse {
  request: AiRequestSummary;
  proposal: AiProposalDetail;
}

/**
 * Editing changes only the reviewed operation fields. The server owns the
 * operation type, status, confidence, result metadata, and timestamps.
 */
export interface AiOperationEditRequest {
  version: number;
  fields: Record<string, unknown>;
}

export interface AiOperationAcceptRequest {
  version: number;
}

export interface AiOperationRejectRequest {
  version: number;
}

export interface AiProposalRejectRequest {
  version: number;
}

/**
 * The operation IDs are the exact scope covered by the separate final user
 * confirmation. State validation remains server authoritative.
 */
export interface AiFinalConfirmRequest {
  version: number;
  operationIds: [Identifier, ...Identifier[]];
}

/** The authoritative proposal detail also carries every operation result. */
export type AiFinalConfirmResponse = AiProposalDetail;

export interface AiProposalListQuery {
  unfinished: true;
  cursor?: string;
  limit?: number;
}

export interface AiProposalListResponse {
  items: AiProposalSummary[];
  nextCursor: Identifier | null;
}
