import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  AI_PROVIDER_INPUT_ALLOWED_FIELDS,
  AI_AUDIT_METADATA_ALLOWED_FIELDS,
} from "../src/ai.js";
import {
  AI_OPERATION_STATUSES,
  AI_OPERATION_TYPES,
  AI_PROPOSAL_STATUSES,
  AI_PROVIDER_ATTEMPT_STATUSES,
  AI_REQUEST_STATUSES,
  API_ERROR_CODES,
} from "../src/enums.js";

interface SchemaNode {
  $ref?: string;
  type?: string;
  enum?: string[];
  required?: string[];
  additionalProperties?: boolean | Record<string, unknown>;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  allOf?: SchemaNode[];
  pattern?: string;
}

interface OpenApiDocument {
  components: {
    schemas: Record<string, SchemaNode>;
  };
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
}

const openApiPath = new URL("../openapi/openapi.yaml", import.meta.url);
const document = parse(await readFile(openApiPath, "utf8")) as OpenApiDocument;

function anyOfIncludesNull(node: SchemaNode | undefined): boolean {
  const anyOf = (node as { anyOf?: SchemaNode[] } | undefined)?.anyOf;
  return anyOf?.some((candidate) => candidate.type === "null") ?? false;
}

describe("PR5 OpenAPI AI contracts", () => {
  it.each([
    ["AiRequestStatus", AI_REQUEST_STATUSES],
    ["AiProposalStatus", AI_PROPOSAL_STATUSES],
    ["AiOperationType", AI_OPERATION_TYPES],
    ["AiOperationStatus", AI_OPERATION_STATUSES],
    ["AiProviderAttemptStatus", AI_PROVIDER_ATTEMPT_STATUSES],
  ] as const)("keeps %s aligned with shared TypeScript", (name, values) => {
    expect(document.components.schemas[name]?.enum).toEqual([...values]);
  });

  it("defines the safe AI provider input with the locked whitelist", () => {
    const schema = document.components.schemas.AiProviderInput;
    expect(schema).toBeDefined();
    expect(schema?.additionalProperties).toBe(false);
    expect(schema?.required).toEqual([...AI_PROVIDER_INPUT_ALLOWED_FIELDS]);
    expect(Object.keys(schema?.properties ?? {})).toEqual([
      ...AI_PROVIDER_INPUT_ALLOWED_FIELDS,
    ]);
    expect(schema?.properties?.explicitSelectedContext?.items).toMatchObject({
      $ref: "#/components/schemas/AiSelectedContext",
    });
  });

  it("defines the safe AI audit metadata with the locked field list", () => {
    const schema = document.components.schemas.AiAuditMetadata;
    expect(schema).toBeDefined();
    expect(schema?.additionalProperties).toBe(false);
    expect(schema?.required).toEqual(["requestId", "retryCount"]);
    expect(Object.keys(schema?.properties ?? {})).toEqual([
      ...AI_AUDIT_METADATA_ALLOWED_FIELDS,
    ]);
  });

  it("defines every public AI DTO and the boundary metadata schemas", () => {
    for (const name of [
      "AiRequestSummary",
      "AiProposalSummary",
      "AiProposalDetail",
      "AiOperation",
      "AiSelectedContext",
      "AiConfidence",
      "AiAuditCostMetadata",
      "AiAuditMetadata",
      "AiSchemaValidationStatus",
      "AiCircuitBreakerState",
    ]) {
      expect(document.components.schemas[name]).toBeDefined();
    }
    const confidencePattern = document.components.schemas.AiConfidence?.pattern;
    expect(confidencePattern).toBe("^(?:0\\.\\d{4}|1\\.0000)$");

    const confidence = new RegExp(confidencePattern ?? "");
    for (const accepted of ["0.0000", "0.0001", "0.9999", "1.0000"]) {
      expect(confidence.test(accepted), accepted).toBe(true);
    }
    for (const rejected of [
      "-0.0001",
      "0",
      "0.000",
      "0.00000",
      "1.0001",
      "1.9999",
      "2.0000",
    ]) {
      expect(confidence.test(rejected), rejected).toBe(false);
    }
  });

  it("keeps required/nullability/additionalProperties aligned with TS", () => {
    const schemas = document.components.schemas;

    expect(schemas.AiRequestSummary?.additionalProperties).toBe(false);
    expect(schemas.AiRequestSummary?.required).toEqual([
      "id",
      "requestId",
      "locale",
      "timeZoneId",
      "status",
      "proposalId",
      "failureCategory",
      "failureCode",
      "createdAt",
      "startedAt",
      "completedAt",
      "updatedAt",
    ]);
    expect(
      anyOfIncludesNull(schemas.AiRequestSummary?.properties?.proposalId),
    ).toBe(true);
    expect(
      anyOfIncludesNull(schemas.AiRequestSummary?.properties?.failureCategory),
    ).toBe(true);
    expect(
      anyOfIncludesNull(schemas.AiRequestSummary?.properties?.failureCode),
    ).toBe(true);

    expect(schemas.AiProposalSummary?.additionalProperties).toBe(false);
    expect(schemas.AiProposalSummary?.required).toEqual([
      "id",
      "providerId",
      "modelId",
      "status",
      "schemaVersion",
      "version",
      "createdAt",
      "updatedAt",
      "reviewedAt",
      "completedAt",
      "expiresAt",
    ]);
    expect(schemas.AiProposalSummary?.properties?.aiRequestId).toBeUndefined();
    expect(
      schemas.AiProposalSummary?.properties?.sourceDraftId,
    ).toBeUndefined();

    expect(schemas.AiOperation?.additionalProperties).toBe(false);
    expect(schemas.AiOperation?.required).toEqual(
      expect.arrayContaining([
        "id",
        "ordinal",
        "operationType",
        "status",
        "confidence",
        "fields",
        "clarification",
        "resultEntityType",
        "resultEntityId",
        "resultDraftId",
        "errorCode",
        "errorMessage",
        "acceptedAt",
        "rejectedAt",
        "appliedAt",
        "createdAt",
        "updatedAt",
      ]),
    );
    expect(schemas.AiOperation?.properties?.proposalId).toBeUndefined();
    expect(
      anyOfIncludesNull(schemas.AiOperation?.properties?.resultEntityId),
    ).toBe(true);
    expect(anyOfIncludesNull(schemas.AiOperation?.properties?.errorCode)).toBe(
      true,
    );

    expect(schemas.AiAuditMetadata?.additionalProperties).toBe(false);
    expect(schemas.AiAuditMetadata?.required).toEqual([
      "requestId",
      "retryCount",
    ]);
    expect(
      anyOfIncludesNull(schemas.AiAuditMetadata?.properties?.costMetadata),
    ).toBe(true);
    expect(schemas.AiAuditMetadata?.properties?.cost).toBeUndefined();

    expect(schemas.AiProposalDetail?.allOf).toBeUndefined();
    expect(schemas.AiProposalDetail?.type).toBe("object");
    expect(schemas.AiProposalDetail?.additionalProperties).toBe(false);
    expect(schemas.AiProposalDetail?.required).toEqual([
      "id",
      "providerId",
      "modelId",
      "status",
      "schemaVersion",
      "version",
      "createdAt",
      "updatedAt",
      "reviewedAt",
      "completedAt",
      "expiresAt",
      "operations",
    ]);
    expect(Object.keys(schemas.AiProposalDetail?.properties ?? {})).toEqual([
      "id",
      "providerId",
      "modelId",
      "status",
      "schemaVersion",
      "version",
      "createdAt",
      "updatedAt",
      "reviewedAt",
      "completedAt",
      "expiresAt",
      "operations",
    ]);
  });

  it("extends ApiErrorCode with provider-neutral AI codes", () => {
    const openApiCodes = document.components.schemas.ApiErrorCode?.enum ?? [];
    expect(openApiCodes).toEqual([...API_ERROR_CODES]);
    expect(openApiCodes).toEqual(
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
  });
});
