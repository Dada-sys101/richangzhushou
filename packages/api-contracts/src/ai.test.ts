import { describe, expect, it } from "vitest";

import {
  AI_AUDIT_METADATA_ALLOWED_FIELDS,
  AI_PROVIDER_INPUT_ALLOWED_FIELDS,
} from "./ai.js";
import type {
  AiAuditMetadata,
  AiConfidence,
  AiFinalConfirmRequest,
  AiFinalConfirmResponse,
  AiOperation,
  AiOperationAcceptRequest,
  AiOperationEditRequest,
  AiOperationRejectRequest,
  AiProposalCreateRequest,
  AiProposalCreateResponse,
  AiProposalDetail,
  AiProposalListQuery,
  AiProposalListResponse,
  AiProposalRejectRequest,
  AiProposalSummary,
  AiProviderInput,
  AiRequestSummary,
} from "./ai.js";
import {
  AI_OPERATION_STATUSES,
  AI_OPERATION_TYPES,
  AI_PROPOSAL_STATUSES,
  AI_PROVIDER_ATTEMPT_STATUSES,
  AI_REQUEST_STATUSES,
  API_ERROR_CODES,
} from "./enums.js";

describe("PR5 AI shared contracts", () => {
  it("keeps the exact AI enum values", () => {
    expect(AI_REQUEST_STATUSES).toEqual([
      "CLAIMED",
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "CANCELLED",
    ]);
    expect(AI_PROPOSAL_STATUSES).toEqual([
      "PENDING_REVIEW",
      "PARTIALLY_APPLIED",
      "APPLIED",
      "REJECTED",
      "EXPIRED",
      "FAILED",
      "CANCELLED",
    ]);
    expect(AI_OPERATION_TYPES).toEqual([
      "TRANSACTION",
      "CALENDAR_EVENT",
      "TASK",
      "REMINDER",
      "TRIP",
    ]);
    expect(AI_OPERATION_STATUSES).toEqual([
      "PENDING",
      "ACCEPTED",
      "REJECTED",
      "APPLIED",
      "FAILED",
      "EXPIRED",
    ]);
    expect(AI_PROVIDER_ATTEMPT_STATUSES).toEqual([
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "CANCELLED",
    ]);
  });

  it("locks the exact safe provider input whitelist", () => {
    expect(AI_PROVIDER_INPUT_ALLOWED_FIELDS).toEqual([
      "userInput",
      "requestType",
      "locale",
      "timeZoneId",
      "currentDateTime",
      "currency",
      "allowedCategoryLabels",
      "explicitSelectedContext",
    ]);
    expect(Object.isFrozen(AI_PROVIDER_INPUT_ALLOWED_FIELDS)).toBe(true);
  });

  it("locks the exact safe AI audit metadata field list", () => {
    expect(AI_AUDIT_METADATA_ALLOWED_FIELDS).toEqual([
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
    ]);
    expect(Object.isFrozen(AI_AUDIT_METADATA_ALLOWED_FIELDS)).toBe(true);
  });

  it("locks AiConfidence to a normalized four-decimal string", () => {
    const accepted = [
      "0.0000",
      "0.0001",
      "0.9999",
      "1.0000",
    ] as const satisfies readonly AiConfidence[];

    // Each assignment must remain a compile-time error caused by the
    // AiConfidence format and range constraint.
    // @ts-expect-error negative confidence is outside the normalized range
    const negative: AiConfidence = "-0.0001";
    // @ts-expect-error values above one are outside the normalized range
    const aboveOne: AiConfidence = "1.0001";
    // @ts-expect-error values above one are outside the normalized range
    const nearTwo: AiConfidence = "1.9999";
    // @ts-expect-error values above one are outside the normalized range
    const two: AiConfidence = "2.0000";

    expect(accepted).toEqual(["0.0000", "0.0001", "0.9999", "1.0000"]);
    void [negative, aboveOne, nearTwo, two];
  });

  it("keeps forbidden public data fragments out of every runtime whitelist", () => {
    const forbiddenFragments = [
      "raw",
      "prompt",
      "credential",
      "cookie",
      "token",
      "email",
      "phone",
      "userid",
    ];
    const allowedFields = [
      ...AI_PROVIDER_INPUT_ALLOWED_FIELDS,
      ...AI_AUDIT_METADATA_ALLOWED_FIELDS,
    ];
    const safeTokenCountFields = new Set(["inputtokens", "outputtokens"]);

    for (const field of allowedFields) {
      const normalizedField = field.toLowerCase();
      if (safeTokenCountFields.has(normalizedField)) {
        continue;
      }
      for (const fragment of forbiddenFragments) {
        expect(normalizedField).not.toContain(fragment);
      }
    }
  });

  it("adds provider-neutral AI error codes without replacing existing codes", () => {
    expect(API_ERROR_CODES).toEqual(
      expect.arrayContaining([
        "AI_DISABLED",
        "AI_REQUEST_NOT_FOUND",
        "AI_PROPOSAL_NOT_FOUND",
        "AI_PROPOSAL_INVALID_STATE",
        "AI_OPERATION_INVALID_STATE",
        "AI_INPUT_VALIDATION_ERROR",
        "AI_SCHEMA_VALIDATION_ERROR",
        "AI_DOMAIN_VALIDATION_ERROR",
        "AI_PROVIDER_ERROR",
        "AI_PROVIDER_TIMEOUT",
        "AI_PROVIDER_NETWORK_ERROR",
        "AI_BUDGET_BLOCKED",
        "AI_CIRCUIT_BREAKER_BLOCKED",
        "AI_MALFORMED_OUTPUT",
      ]),
    );
    expect(API_ERROR_CODES).toContain("VALIDATION_ERROR");
    expect(API_ERROR_CODES).toContain("RESOURCE_NOT_FOUND");
  });

  it("consumes the public AI DTO types with typed fixtures", () => {
    expect(requestSummaryFixture.proposalId).toBe("proposal_1");
    expect(proposalDetailFixture.operations[0]?.resultDraftId).toBeNull();
  });

  it("defines the PR18 mutation and unfinished-list contracts", () => {
    expect(createResponseFixture.request.id).toBe("request_1");
    expect(editRequestFixture).toEqual({
      fields: { title: "Updated" },
      version: 2,
    });
    expect(acceptRequestFixture).toEqual({ version: 2 });
    expect(rejectRequestFixture).toEqual({ version: 2 });
    expect(proposalRejectRequestFixture).toEqual({ version: 2 });
    expect(finalConfirmRequestFixture).toEqual({
      operationIds: ["operation_1"],
      version: 2,
    });
    expect(unfinishedQueryFixture.unfinished).toBe(true);
    expect(listResponseFixture.items).toEqual([proposalSummaryFixture]);
    expect(finalConfirmResponseFixture.operations).toEqual([operationFixture]);
  });

  it("keeps client-owned state and result metadata out of mutation requests", () => {
    const invalidEdit: AiOperationEditRequest = {
      fields: {},
      version: 1,
      // @ts-expect-error operation status is server-owned
      status: "ACCEPTED",
    };
    const invalidAccept: AiOperationAcceptRequest = {
      version: 1,
      // @ts-expect-error next status is server-owned
      status: "ACCEPTED",
    };
    const invalidOperationReject: AiOperationRejectRequest = {
      version: 1,
      // @ts-expect-error next status is server-owned
      status: "REJECTED",
    };
    const invalidProposalReject: AiProposalRejectRequest = {
      version: 1,
      // @ts-expect-error next status is server-owned
      status: "REJECTED",
    };
    const emptyFinalConfirm: AiFinalConfirmRequest = {
      // @ts-expect-error final confirmation requires at least one operation ID
      operationIds: [],
      version: 1,
    };

    void [
      invalidEdit,
      invalidAccept,
      invalidOperationReject,
      invalidProposalReject,
      emptyFinalConfirm,
    ];
  });
});

const requestSummaryFixture = {
  id: "request_1",
  requestId: "request_1",
  locale: "zh-CN",
  timeZoneId: "Asia/Shanghai",
  status: "SUCCEEDED",
  proposalId: "proposal_1",
  failureCategory: null,
  failureCode: null,
  startedAt: "2026-08-13T00:00:00.000Z",
  completedAt: "2026-08-13T00:00:01.000Z",
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:01.000Z",
} satisfies AiRequestSummary;

const proposalSummaryFixture = {
  id: "proposal_1",
  providerId: "fake-provider",
  modelId: "fake-model",
  status: "PENDING_REVIEW",
  schemaVersion: 1,
  version: 1,
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:01.000Z",
  reviewedAt: null,
  completedAt: null,
  expiresAt: null,
} satisfies AiProposalSummary;

const operationFixture = {
  id: "operation_1",
  ordinal: 1,
  operationType: "TRANSACTION",
  status: "PENDING",
  confidence: "0.9500",
  fields: {},
  clarification: null,
  resultEntityType: null,
  resultEntityId: null,
  resultDraftId: null,
  errorCode: null,
  errorMessage: null,
  acceptedAt: null,
  rejectedAt: null,
  appliedAt: null,
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:01.000Z",
} satisfies AiOperation;

const proposalDetailFixture = {
  ...proposalSummaryFixture,
  operations: [operationFixture],
} satisfies AiProposalDetail;

const createRequestFixture = {
  userInput: "明天下午三点开会",
  requestType: "CALENDAR_EVENT",
  locale: "zh-CN",
  timeZoneId: "Asia/Shanghai",
  currentDateTime: "2026-08-14T00:00:00.000Z",
  currency: "CNY",
  allowedCategoryLabels: [],
  explicitSelectedContext: [],
} satisfies AiProposalCreateRequest;

const createResponseFixture = {
  request: requestSummaryFixture,
  proposal: proposalDetailFixture,
} satisfies AiProposalCreateResponse;

const editRequestFixture = {
  fields: { title: "Updated" },
  version: 2,
} satisfies AiOperationEditRequest;

const acceptRequestFixture = { version: 2 } satisfies AiOperationAcceptRequest;
const rejectRequestFixture = { version: 2 } satisfies AiOperationRejectRequest;
const proposalRejectRequestFixture = {
  version: 2,
} satisfies AiProposalRejectRequest;

const finalConfirmRequestFixture = {
  operationIds: ["operation_1"],
  version: 2,
} satisfies AiFinalConfirmRequest;

const finalConfirmResponseFixture =
  proposalDetailFixture satisfies AiFinalConfirmResponse;

const unfinishedQueryFixture = {
  unfinished: true,
  cursor: "proposal_0",
  limit: 20,
} satisfies AiProposalListQuery;

const listResponseFixture = {
  items: [proposalSummaryFixture],
  nextCursor: null,
} satisfies AiProposalListResponse;

void createRequestFixture;

type BaseForbiddenPublicKey =
  | "userId"
  | "idempotencyKey"
  | "inputFingerprint"
  | "rawInput"
  | "rawPrompt"
  | "prompt";

type IsForbiddenAbsent<T, K extends string> =
  Extract<K, keyof T> extends never ? true : false;

type AssertTrue<T extends true> = T;

type ProviderForbiddenKeys =
  | BaseForbiddenPublicKey
  | "email"
  | "phone"
  | "token"
  | "cookies"
  | "cookie"
  | "credential"
  | "apiKey"
  | "secret"
  | "deviceId"
  | "prompt"
  | "rawRequest"
  | "rawResponse"
  | "history";

type ProviderExtraKeys = Exclude<
  keyof AiProviderInput,
  (typeof AI_PROVIDER_INPUT_ALLOWED_FIELDS)[number]
>;
type _ProviderInputKeysLocked = AssertTrue<
  [ProviderExtraKeys] extends [never] ? true : false
>;
type _ProviderForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiProviderInput, ProviderForbiddenKeys>
>;

export type ProviderForbiddenKeysAbsent = _ProviderInputKeysLocked &
  _ProviderForbiddenKeysAbsent;

type AuditForbiddenKeys =
  | "body"
  | "content"
  | "credential"
  | "token"
  | "cookie"
  | "cookies"
  | "email"
  | "phone"
  | "userId";

type AuditExtraKeys = Exclude<
  keyof AiAuditMetadata,
  (typeof AI_AUDIT_METADATA_ALLOWED_FIELDS)[number]
>;
type _AuditMetadataKeysLocked = AssertTrue<
  [AuditExtraKeys] extends [never] ? true : false
>;
type _AuditForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiAuditMetadata, AuditForbiddenKeys>
>;

export type AuditForbiddenKeysAbsent = _AuditMetadataKeysLocked &
  _AuditForbiddenKeysAbsent;

type RequestSummaryForbiddenKeys =
  BaseForbiddenPublicKey | "providerId" | "modelId" | "schemaVersion";

type _RequestSummaryForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiRequestSummary, RequestSummaryForbiddenKeys>
>;
export type RequestSummaryForbiddenKeysAbsent =
  _RequestSummaryForbiddenKeysAbsent;

type ProposalSummaryForbiddenKeys =
  BaseForbiddenPublicKey | "aiRequestId" | "sourceDraftId";

type _ProposalSummaryForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiProposalSummary, ProposalSummaryForbiddenKeys>
>;
export type ProposalSummaryForbiddenKeysAbsent =
  _ProposalSummaryForbiddenKeysAbsent;

type OperationForbiddenKeys = BaseForbiddenPublicKey | "proposalId";

type _OperationForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiOperation, OperationForbiddenKeys>
>;
export type OperationForbiddenKeysAbsent = _OperationForbiddenKeysAbsent;

type _ProposalDetailForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiProposalDetail, ProposalSummaryForbiddenKeys>
>;
export type ProposalDetailForbiddenKeysAbsent =
  _ProposalDetailForbiddenKeysAbsent;

type MutationForbiddenKeys =
  | BaseForbiddenPublicKey
  | "providerId"
  | "modelId"
  | "credential"
  | "rawProviderBody"
  | "status";

type _CreateRequestKeysMatchProviderInput = AssertTrue<
  [Exclude<keyof AiProposalCreateRequest, keyof AiProviderInput>] extends [
    never,
  ]
    ? [Exclude<keyof AiProviderInput, keyof AiProposalCreateRequest>] extends [
        never,
      ]
      ? true
      : false
    : false
>;
type _CreateRequestForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiProposalCreateRequest, MutationForbiddenKeys>
>;
type _EditRequestForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiOperationEditRequest, MutationForbiddenKeys>
>;
type _AcceptRequestForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiOperationAcceptRequest, MutationForbiddenKeys>
>;
type _OperationRejectRequestForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiOperationRejectRequest, MutationForbiddenKeys>
>;
type _ProposalRejectRequestForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiProposalRejectRequest, MutationForbiddenKeys>
>;
type _FinalConfirmRequestForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiFinalConfirmRequest, MutationForbiddenKeys>
>;
type _CreateResponseForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiProposalCreateResponse, BaseForbiddenPublicKey>
>;
type _FinalConfirmResponseForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiFinalConfirmResponse, BaseForbiddenPublicKey>
>;
type _ListResponseForbiddenKeysAbsent = AssertTrue<
  IsForbiddenAbsent<AiProposalListResponse, BaseForbiddenPublicKey>
>;

export type Pr18MutationBoundaryAssertions =
  _CreateRequestKeysMatchProviderInput &
    _CreateRequestForbiddenKeysAbsent &
    _EditRequestForbiddenKeysAbsent &
    _AcceptRequestForbiddenKeysAbsent &
    _OperationRejectRequestForbiddenKeysAbsent &
    _ProposalRejectRequestForbiddenKeysAbsent &
    _FinalConfirmRequestForbiddenKeysAbsent &
    _CreateResponseForbiddenKeysAbsent &
    _FinalConfirmResponseForbiddenKeysAbsent &
    _ListResponseForbiddenKeysAbsent;
