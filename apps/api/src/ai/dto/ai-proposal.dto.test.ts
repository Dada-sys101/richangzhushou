import { plainToInstance } from "class-transformer";
import { validate, type ValidationError } from "class-validator";
import { describe, expect, it } from "vitest";

import {
  AI_PROVIDER_INPUT_ALLOWED_FIELDS,
  type AiProviderInput,
} from "@daily-assistant/api-contracts";

import {
  AiFinalConfirmDto,
  AiOperationAcceptDto,
  AiOperationEditDto,
  AiOperationRejectDto,
  AiProposalCreateDto,
  AiProposalListQueryDto,
  AiProposalRejectDto,
} from "./ai-proposal.dto.js";

async function validateAsHttpBody(
  dtoClass: new () => object,
  raw: Record<string, unknown>,
): Promise<ValidationError[]> {
  // Mirrors the app-wide ValidationPipe in main.ts:
  // whitelist: true, forbidNonWhitelisted: true, transform: true.
  const instance = plainToInstance(dtoClass, raw);
  return validate(instance, {
    forbidNonWhitelisted: true,
    whitelist: true,
  });
}

const VALID_CREATE_BODY = {
  userInput: "明天下午三点和产品团队开会",
  requestType: "CALENDAR_EVENT",
  locale: "zh-CN",
  timeZoneId: "Asia/Shanghai",
  currentDateTime: "2026-08-14T00:00:00.000Z",
  currency: "CNY",
  allowedCategoryLabels: ["工作"],
  explicitSelectedContext: [],
} satisfies AiProviderInput;

describe("PR18 AI Proposal runtime DTOs", () => {
  it("DTO-01: accepts a valid eight-field create body", async () => {
    const errors = await validateAsHttpBody(AiProposalCreateDto, {
      ...VALID_CREATE_BODY,
    });
    expect(errors).toEqual([]);
  });

  it("DTO-02: rejects a create body with a ninth field", async () => {
    const errors = await validateAsHttpBody(AiProposalCreateDto, {
      ...VALID_CREATE_BODY,
      history: ["previous turn"],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("DTO-03: rejects idempotencyKey inside the create body", async () => {
    const errors = await validateAsHttpBody(AiProposalCreateDto, {
      ...VALID_CREATE_BODY,
      idempotencyKey: "req-key-1234567890",
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("DTO-04: keeps the provider whitelist at exactly eight fields", () => {
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
    expect(AI_PROVIDER_INPUT_ALLOWED_FIELDS).toHaveLength(8);

    // The create DTO exposes exactly the whitelist keys after transform.
    const instance = plainToInstance(AiProposalCreateDto, {
      ...VALID_CREATE_BODY,
    });
    expect(Object.keys(instance).sort()).toEqual(
      [...AI_PROVIDER_INPUT_ALLOWED_FIELDS].sort(),
    );
  });

  it("DTO-05: operation edit accepts only version and fields", async () => {
    const errors = await validateAsHttpBody(AiOperationEditDto, {
      version: 2,
      fields: { title: "Updated" },
    });
    expect(errors).toEqual([]);
  });

  it("DTO-06: operation edit rejects injected status / appliedAt", async () => {
    const errors = await validateAsHttpBody(AiOperationEditDto, {
      version: 2,
      fields: { title: "Updated" },
      status: "APPLIED",
      appliedAt: "2026-08-14T01:00:00.000Z",
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("DTO-07: accept request allows only version", async () => {
    const ok = await validateAsHttpBody(AiOperationAcceptDto, { version: 2 });
    expect(ok).toEqual([]);
    const bad = await validateAsHttpBody(AiOperationAcceptDto, {
      version: 2,
      status: "ACCEPTED",
    });
    expect(bad.length).toBeGreaterThan(0);
  });

  it("DTO-08: operation reject allows only version", async () => {
    const ok = await validateAsHttpBody(AiOperationRejectDto, { version: 2 });
    expect(ok).toEqual([]);
    const bad = await validateAsHttpBody(AiOperationRejectDto, {
      version: 2,
      rejectedAt: "2026-08-14T01:00:00.000Z",
    });
    expect(bad.length).toBeGreaterThan(0);
  });

  it("DTO-09: proposal reject allows only version", async () => {
    const ok = await validateAsHttpBody(AiProposalRejectDto, { version: 2 });
    expect(ok).toEqual([]);
    const bad = await validateAsHttpBody(AiProposalRejectDto, {
      version: 2,
      status: "REJECTED",
    });
    expect(bad.length).toBeGreaterThan(0);
  });

  it("DTO-10: final confirm rejects an empty operationIds array", async () => {
    const errors = await validateAsHttpBody(AiFinalConfirmDto, {
      version: 2,
      operationIds: [],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("DTO-11: final confirm rejects duplicate operationIds", async () => {
    const errors = await validateAsHttpBody(AiFinalConfirmDto, {
      version: 2,
      operationIds: ["operation_1", "operation_1"],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("DTO-12: final confirm accepts non-empty unique identifiers", async () => {
    const errors = await validateAsHttpBody(AiFinalConfirmDto, {
      version: 2,
      operationIds: ["operation_1", "operation_2"],
    });
    expect(errors).toEqual([]);
  });

  it("DTO-13: final confirm rejects injected result / status fields", async () => {
    const errors = await validateAsHttpBody(AiFinalConfirmDto, {
      version: 2,
      operationIds: ["operation_1"],
      status: "APPLIED",
      resultEntityId: "transaction_1",
      resultEntityType: "TRANSACTION",
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("DTO-14: list query accepts unfinished=true", async () => {
    const errors = await validateAsHttpBody(AiProposalListQueryDto, {
      unfinished: "true",
    });
    expect(errors).toEqual([]);
  });

  it("DTO-15: list query rejects a missing unfinished", async () => {
    const errors = await validateAsHttpBody(AiProposalListQueryDto, {});
    expect(errors.length).toBeGreaterThan(0);
  });

  it("DTO-16: list query rejects unfinished=false", async () => {
    const errors = await validateAsHttpBody(AiProposalListQueryDto, {
      unfinished: "false",
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("DTO-17: list query limit boundary matches OpenAPI (1..100)", async () => {
    expect(
      await validateAsHttpBody(AiProposalListQueryDto, {
        unfinished: "true",
        limit: 1,
      }),
    ).toEqual([]);
    expect(
      await validateAsHttpBody(AiProposalListQueryDto, {
        unfinished: "true",
        limit: 100,
      }),
    ).toEqual([]);
    expect(
      (
        await validateAsHttpBody(AiProposalListQueryDto, {
          unfinished: "true",
          limit: 0,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validateAsHttpBody(AiProposalListQueryDto, {
          unfinished: "true",
          limit: 101,
        })
      ).length,
    ).toBeGreaterThan(0);
  });

  it("DTO-18: validates nested explicitSelectedContext", async () => {
    const bad = await validateAsHttpBody(AiProposalCreateDto, {
      ...VALID_CREATE_BODY,
      explicitSelectedContext: [{ id: "", entityType: "", summary: "" }],
    });
    expect(bad.length).toBeGreaterThan(0);

    const good = await validateAsHttpBody(AiProposalCreateDto, {
      ...VALID_CREATE_BODY,
      explicitSelectedContext: [
        {
          id: "transaction_1",
          entityType: "TRANSACTION",
          summary: "选中一笔餐饮支出",
        },
      ],
    });
    expect(good).toEqual([]);
  });
});
