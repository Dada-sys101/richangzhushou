import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { AI_PROVIDER_INPUT_ALLOWED_FIELDS } from "../src/ai.js";
import {
  AI_OPERATION_STATUSES,
  AI_OPERATION_TYPES,
  AI_PROPOSAL_STATUSES,
  AI_REQUEST_STATUSES,
} from "../src/enums.js";

interface SchemaNode {
  $ref?: string;
  type?: string;
  const?: unknown;
  enum?: string[];
  required?: string[];
  additionalProperties?: boolean | Record<string, unknown>;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  minItems?: number;
  uniqueItems?: boolean;
}

interface MediaTypeNode {
  schema?: SchemaNode;
}

interface OperationNode {
  operationId?: string;
  parameters?: Array<SchemaNode | { name?: string; schema?: SchemaNode }>;
  requestBody?: {
    content?: Record<string, MediaTypeNode>;
  };
  responses?: Record<
    string,
    { content?: Record<string, MediaTypeNode>; $ref?: string }
  >;
}

interface OpenApiDocument {
  components: {
    parameters: Record<
      string,
      SchemaNode & { name?: string; required?: boolean }
    >;
    schemas: Record<string, SchemaNode>;
  };
  paths: Record<string, Record<string, OperationNode>>;
}

const openApiPath = new URL("../openapi/openapi.yaml", import.meta.url);
const document = parse(await readFile(openApiPath, "utf8")) as OpenApiDocument;

const expectedPaths = [
  "/ai/proposals",
  "/ai/proposals/{proposalId}",
  "/ai/proposals/{proposalId}/operations/{operationId}",
  "/ai/proposals/{proposalId}/operations/{operationId}/accept",
  "/ai/proposals/{proposalId}/operations/{operationId}/reject",
  "/ai/proposals/{proposalId}/reject",
  "/ai/proposals/{proposalId}/final-confirm",
] as const;

function requestSchema(path: string, method: string): SchemaNode | undefined {
  return document.paths[path]?.[method]?.requestBody?.content?.[
    "application/json"
  ]?.schema;
}

function responseSchema(
  path: string,
  method: string,
  status: string,
): SchemaNode | undefined {
  return document.paths[path]?.[method]?.responses?.[status]?.content?.[
    "application/json"
  ]?.schema;
}

describe("PR18 OpenAPI mutation contracts", () => {
  it("adds only the frozen AI Proposal resource paths", () => {
    const aiPaths = Object.keys(document.paths).filter((path) =>
      path.startsWith("/ai/"),
    );
    expect(aiPaths).toEqual([...expectedPaths]);
    expect(document.paths["/ai/proposals"]).toHaveProperty("post");
    expect(document.paths["/ai/proposals"]).toHaveProperty("get");
  });

  it("keeps the provider whitelist and shared enums unchanged", () => {
    const providerInput = document.components.schemas.AiProviderInput;
    expect(providerInput.required).toEqual([
      ...AI_PROVIDER_INPUT_ALLOWED_FIELDS,
    ]);
    expect(Object.keys(providerInput.properties ?? {})).toEqual([
      ...AI_PROVIDER_INPUT_ALLOWED_FIELDS,
    ]);
    expect(document.components.schemas.AiRequestStatus?.enum).toEqual([
      ...AI_REQUEST_STATUSES,
    ]);
    expect(document.components.schemas.AiProposalStatus?.enum).toEqual([
      ...AI_PROPOSAL_STATUSES,
    ]);
    expect(document.components.schemas.AiOperationType?.enum).toEqual([
      ...AI_OPERATION_TYPES,
    ]);
    expect(document.components.schemas.AiOperationStatus?.enum).toEqual([
      ...AI_OPERATION_STATUSES,
    ]);
  });

  it("maps every request body to the matching minimal shared schema", () => {
    expect(document.paths["/ai/proposals"]?.post?.parameters).toContainEqual({
      $ref: "#/components/parameters/IdempotencyKey",
    });
    expect(requestSchema("/ai/proposals", "post")?.$ref).toBe(
      "#/components/schemas/AiProposalCreateRequest",
    );
    expect(
      requestSchema(
        "/ai/proposals/{proposalId}/operations/{operationId}",
        "patch",
      )?.$ref,
    ).toBe("#/components/schemas/AiOperationEditRequest");
    expect(
      requestSchema(
        "/ai/proposals/{proposalId}/operations/{operationId}/accept",
        "post",
      )?.$ref,
    ).toBe("#/components/schemas/AiOperationAcceptRequest");
    expect(
      requestSchema(
        "/ai/proposals/{proposalId}/operations/{operationId}/reject",
        "post",
      )?.$ref,
    ).toBe("#/components/schemas/AiOperationRejectRequest");
    expect(
      requestSchema("/ai/proposals/{proposalId}/reject", "post")?.$ref,
    ).toBe("#/components/schemas/AiProposalRejectRequest");
    expect(
      requestSchema("/ai/proposals/{proposalId}/final-confirm", "post")?.$ref,
    ).toBe("#/components/schemas/AiFinalConfirmRequest");
  });

  it("locks mutation keys and explicit final-confirm scope", () => {
    const schemas = document.components.schemas;
    expect(schemas.AiProposalCreateRequest?.$ref).toBe(
      "#/components/schemas/AiProviderInput",
    );
    expect(schemas.AiOperationEditRequest?.required).toEqual([
      "version",
      "fields",
    ]);
    expect(
      Object.keys(schemas.AiOperationEditRequest?.properties ?? {}),
    ).toEqual(["version", "fields"]);
    for (const name of [
      "AiOperationAcceptRequest",
      "AiOperationRejectRequest",
      "AiProposalRejectRequest",
    ]) {
      expect(schemas[name]?.required).toEqual(["version"]);
      expect(Object.keys(schemas[name]?.properties ?? {})).toEqual(["version"]);
      expect(schemas[name]?.additionalProperties).toBe(false);
    }
    expect(schemas.AiFinalConfirmRequest?.required).toEqual([
      "version",
      "operationIds",
    ]);
    expect(
      schemas.AiFinalConfirmRequest?.properties?.operationIds,
    ).toMatchObject({
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { $ref: "#/components/schemas/Identifier" },
    });
  });

  it("returns authoritative existing Proposal DTOs without public internals", () => {
    expect(responseSchema("/ai/proposals", "post", "201")?.$ref).toBe(
      "#/components/schemas/AiProposalCreateResponse",
    );
    expect(responseSchema("/ai/proposals", "get", "200")?.$ref).toBe(
      "#/components/schemas/AiProposalListResponse",
    );
    expect(
      responseSchema("/ai/proposals/{proposalId}", "get", "200")?.$ref,
    ).toBe("#/components/schemas/AiProposalDetail");
    for (const [path, method] of [
      ["/ai/proposals/{proposalId}/operations/{operationId}", "patch"],
      ["/ai/proposals/{proposalId}/operations/{operationId}/accept", "post"],
      ["/ai/proposals/{proposalId}/operations/{operationId}/reject", "post"],
      ["/ai/proposals/{proposalId}/reject", "post"],
    ] as const) {
      expect(responseSchema(path, method, "200")?.$ref).toBe(
        "#/components/schemas/AiProposalDetail",
      );
    }
    expect(
      responseSchema("/ai/proposals/{proposalId}/final-confirm", "post", "200")
        ?.$ref,
    ).toBe("#/components/schemas/AiFinalConfirmResponse");

    const forbidden = [
      "userId",
      "idempotencyKey",
      "inputFingerprint",
      "rawProviderBody",
      "credential",
    ];
    for (const name of [
      "AiProposalCreateResponse",
      "AiProposalListResponse",
      "AiProposalDetail",
      "AiOperation",
    ]) {
      const keys = Object.keys(
        document.components.schemas[name]?.properties ?? {},
      );
      for (const forbiddenKey of forbidden) {
        expect(keys).not.toContain(forbiddenKey);
      }
    }
    expect(document.components.schemas.AiFinalConfirmResponse?.$ref).toBe(
      "#/components/schemas/AiProposalDetail",
    );
  });

  it("requires the unfinished query and preserves cursor pagination", () => {
    const unfinished = document.components.parameters.AiProposalUnfinished;
    expect(unfinished).toMatchObject({
      name: "unfinished",
      required: true,
      schema: { type: "boolean", const: true },
    });
    const list = document.components.schemas.AiProposalListResponse;
    expect(list.required).toEqual(["items", "nextCursor"]);
    expect(list.properties?.items?.items?.$ref).toBe(
      "#/components/schemas/AiProposalSummary",
    );
  });
});
