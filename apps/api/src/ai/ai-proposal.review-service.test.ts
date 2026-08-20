import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";
import type { AiProposalCreateRequest } from "@daily-assistant/api-contracts";

import type { PrismaService } from "../prisma/prisma.service.js";
import { AiCircuitBreaker } from "./ai-circuit-breaker.js";
import type { AiBudgetGate } from "./ai-budget-gate.js";
import {
  AiFakeProviderFactory,
  operationTypeForRequestType,
} from "./ai-fake-provider.factory.js";
import { AiFeatureGate } from "./ai-feature-gate.js";
import { sha256Fingerprint } from "./ai-proposal.fingerprint.js";
import { toAiProposalDetail } from "./ai-proposal.mapper.js";
import {
  AiProposalReviewService,
  type AiProposalRuntimeOptions,
} from "./ai-proposal.review-service.js";
import { FakeAiProvider } from "./fake-provider/fake-ai-provider.js";

const INPUT: AiProposalCreateRequest = {
  userInput: "明天下午三点开会",
  requestType: "CALENDAR_EVENT",
  locale: "zh-CN",
  timeZoneId: "Asia/Shanghai",
  currentDateTime: "2026-08-15T00:00:00.000Z",
  currency: "CNY",
  allowedCategoryLabels: [],
  explicitSelectedContext: [],
};

describe("PR18 H03 proposal review service", () => {
  it("H04-F01: every review operation fails closed before reading Proposal data", async () => {
    const service = createService(
      {} as PrismaService,
      undefined,
      AiFeatureGate.forTesting({
        businessWrite: false,
        fakeProvider: false,
        proposal: false,
      }),
    );
    const calls = [
      () => service.list("user_1", { unfinished: true }),
      () => service.get("user_1", "proposal_1"),
      () =>
        service.editOperation("user_1", "proposal_1", "operation_1", {
          fields: {},
          version: 1,
        }),
      () =>
        service.acceptOperation("user_1", "proposal_1", "operation_1", {
          version: 1,
        }),
      () =>
        service.rejectOperation("user_1", "proposal_1", "operation_1", {
          version: 1,
        }),
      () => service.rejectProposal("user_1", "proposal_1", { version: 1 }),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toMatchObject({
        code: "AI_DISABLED",
        statusCode: 403,
      });
    }
  });

  it("H04-F02: create is blocked when fakeProvider is disabled", async () => {
    const generate = vi.fn((input: AiProposalCreateRequest) =>
      new FakeAiProvider({ scenario: "CALENDAR_EVENT_SUCCESS" }).generate(
        input,
      ),
    );
    const factory = providerFactoryWithGenerate(generate);
    const harness = buildCreateHarness();
    const service = createService(
      harness.prisma,
      factory,
      AiFeatureGate.forTesting({
        businessWrite: false,
        fakeProvider: false,
        proposal: true,
      }),
    );
    await expect(
      service.create("user_1", "k".repeat(16), INPUT),
    ).rejects.toMatchObject({ code: "AI_DISABLED", statusCode: 403 });
    expect(generate).not.toHaveBeenCalled();
    expect(harness.request).toMatchObject({
      failureCategory: "FEATURE_DISABLED",
      failureCode: "AI_DISABLED",
      startedAt: null,
      status: "FAILED",
    });
  });

  it("H03-U01: same create input produces a stable fingerprint", () => {
    expect(sha256Fingerprint(INPUT)).toBe(sha256Fingerprint({ ...INPUT }));
    expect(sha256Fingerprint({ a: 1, b: 2 })).toBe(
      sha256Fingerprint({ b: 2, a: 1 }),
    );
  });

  it("H03-U02: different create input produces a different fingerprint", () => {
    expect(sha256Fingerprint(INPUT)).not.toBe(
      sha256Fingerprint({ ...INPUT, userInput: "不同输入" }),
    );
  });

  it("H03-U03: all five request types select the matching Fake Provider scenario", () => {
    const factory = new AiFakeProviderFactory();
    for (const requestType of [
      "TRANSACTION",
      "CALENDAR_EVENT",
      "TASK",
      "REMINDER",
      "TRIP",
    ] as const) {
      const result = factory
        .create(requestType)
        .generate({ ...INPUT, requestType });
      expect(result.resultType).toBe("SUCCESS");
      expect(result.operations[0]?.operationType).toBe(requestType);
    }
  });

  it("H03-U04: unsupported requestType returns AI_INPUT_VALIDATION_ERROR", () => {
    expect(() => operationTypeForRequestType("UNKNOWN")).toThrowError(
      expect.objectContaining({ code: "AI_INPUT_VALIDATION_ERROR" }),
    );
  });

  it("H03-U05: provider success normalizes only PENDING operations", () => {
    const service = createService({} as PrismaService);
    const result = normalize(
      service,
      INPUT,
      new FakeAiProvider({ scenario: "CALENDAR_EVENT_SUCCESS" }).generate(
        INPUT,
      ),
    );
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]?.status).toBe("PENDING");
  });

  it("H03-U06: uncertain output becomes a synthetic PENDING review operation", () => {
    const service = createService({} as PrismaService);
    const result = normalize(
      service,
      INPUT,
      new FakeAiProvider({ scenario: "UNCERTAIN" }).generate(INPUT),
    );
    expect(result.operations).toEqual([
      expect.objectContaining({
        confidence: "0.0000",
        fields: {},
        operationType: "CALENDAR_EVENT",
        status: "PENDING",
      }),
    ]);
  });

  it("H03-U07: uncertain clarification explicitly includes missing fields", () => {
    const service = createService({} as PrismaService);
    const result = normalize(
      service,
      INPUT,
      new FakeAiProvider({ scenario: "UNCERTAIN" }).generate(INPUT),
    );
    const clarification = result.operations[0]?.clarification ?? "";
    expect(clarification).toContain("title");
    expect(clarification).toContain("content");
    expect(clarification.length).toBeLessThanOrEqual(500);
  });

  it("H03-U08: controlled failure persists FAILED and returns AI_PROVIDER_ERROR", async () => {
    const harness = buildCreateHarness();
    const service = createService(
      harness.prisma,
      scenarioFactory("CONTROLLED_FAILURE"),
    );
    await expect(
      service.create("user_1", "k".repeat(16), INPUT),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR",
      statusCode: 502,
    });
    expect(harness.request.status).toBe("FAILED");
    expect(harness.request.failureCode).toBe("AI_PROVIDER_ERROR");
    expect(harness.attempt.status).toBe("FAILED");
  });

  it("H03-U09: edit changes fields without changing status/type/confidence", async () => {
    const harness = buildMutationHarness("PENDING_REVIEW", "PENDING", 1);
    const service = createService(harness.prisma);
    const before = {
      confidence: harness.operation.confidence,
      operationType: harness.operation.operationType,
      status: harness.operation.status,
    };
    await service.editOperation("user_1", "proposal_1", "operation_1", {
      fields: { title: "updated" },
      version: 1,
    });
    expect(harness.operation).toMatchObject({
      ...before,
      fieldsJson: { title: "updated" },
    });
  });

  it("H03-U10: accept transitions PENDING to ACCEPTED", async () => {
    const harness = buildMutationHarness("PENDING_REVIEW", "PENDING", 1);
    await createService(harness.prisma).acceptOperation(
      "user_1",
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
    expect(harness.operation.status).toBe("ACCEPTED");
    expect(harness.operation.acceptedAt).toBeInstanceOf(Date);
  });

  it("H03-U11: accept never produces APPLIED", async () => {
    const harness = buildMutationHarness("PENDING_REVIEW", "PENDING", 1);
    await createService(harness.prisma).acceptOperation(
      "user_1",
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
    expect(harness.operation.status).not.toBe("APPLIED");
    expect(harness.operation.appliedAt).toBeNull();
  });

  it("H03-U12: reject transitions PENDING to REJECTED", async () => {
    const harness = buildMutationHarness("PENDING_REVIEW", "PENDING", 1);
    await createService(harness.prisma).rejectOperation(
      "user_1",
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
    expect(harness.operation.status).toBe("REJECTED");
  });

  it("H03-U13: reject transitions ACCEPTED to REJECTED without clearing acceptedAt", async () => {
    const harness = buildMutationHarness("PENDING_REVIEW", "ACCEPTED", 1);
    const acceptedAt = harness.operation.acceptedAt;
    await createService(harness.prisma).rejectOperation(
      "user_1",
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
    expect(harness.operation.status).toBe("REJECTED");
    expect(harness.operation.acceptedAt).toBe(acceptedAt);
  });

  it("H03-U14: terminal operation cannot mutate", async () => {
    const harness = buildMutationHarness("PENDING_REVIEW", "REJECTED", 1);
    await expect(
      createService(harness.prisma).rejectOperation(
        "user_1",
        "proposal_1",
        "operation_1",
        { version: 1 },
      ),
    ).rejects.toMatchObject({ code: "AI_OPERATION_INVALID_STATE" });
  });

  it("H03-U15: proposal rejection only changes AI review rows", async () => {
    const harness = buildMutationHarness("PENDING_REVIEW", "ACCEPTED", 1);
    await createService(harness.prisma).rejectProposal("user_1", "proposal_1", {
      version: 1,
    });
    expect(harness.proposal.status).toBe("REJECTED");
    expect(harness.operation.status).toBe("REJECTED");
    expect(Object.keys(harness.prisma)).toEqual([
      "aiProposal",
      "aiOperation",
      "$transaction",
    ]);
  });

  it("H03-U16: stale proposal version returns VERSION_CONFLICT", async () => {
    const harness = buildMutationHarness("PENDING_REVIEW", "PENDING", 2);
    await expect(
      createService(harness.prisma).acceptOperation(
        "user_1",
        "proposal_1",
        "operation_1",
        { version: 1 },
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("H03-U17: persisted operation ordinals start at one", async () => {
    const harness = buildCreateHarness();
    const result = await createService(harness.prisma).create(
      "user_1",
      "k".repeat(16),
      INPUT,
    );
    expect(result.proposal.operations[0]?.ordinal).toBe(1);
    expect(harness.proposalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operations: {
            create: [expect.objectContaining({ ordinal: 1 })],
          },
        }),
      }),
    );
  });

  it("H03-U18: mapper exposes no internal persistence fields", () => {
    const harness = buildMutationHarness("PENDING_REVIEW", "PENDING", 1);
    const mapped = toAiProposalDetail({
      ...harness.proposal,
      operations: [harness.operation],
    } as unknown as Parameters<typeof toAiProposalDetail>[0]);
    expect(mapped).not.toHaveProperty("userId");
    expect(mapped).not.toHaveProperty("aiRequestId");
    expect(mapped.operations[0]).not.toHaveProperty("fieldsFingerprint");
    expect(mapped.operations[0]).not.toHaveProperty("proposalId");
  });

  it("PR19 budget block fails before attempts and retains original input", async () => {
    const harness = buildCreateHarness();
    const budgetGate: AiBudgetGate = { evaluate: () => "BUDGET_BLOCKED" };
    await expect(
      createService(harness.prisma, undefined, undefined, {
        budgetGate,
      }).create("user_1", "k".repeat(16), INPUT),
    ).rejects.toMatchObject({
      code: "AI_BUDGET_BLOCKED",
      statusCode: 429,
    });
    expect(harness.attempts).toHaveLength(0);
    expect(harness.request).toMatchObject({
      failureCategory: "BUDGET_BLOCKED",
      originalUserInput: INPUT.userInput,
      startedAt: null,
      status: "FAILED",
    });
    expect(harness.request.originalInputExpiresAt).toBeInstanceOf(Date);
  });

  it("PR19 retries one technical failure once and keeps request.startedAt stable", async () => {
    const harness = buildCreateHarness();
    const generate = vi
      .fn()
      .mockImplementationOnce((input: AiProposalCreateRequest) =>
        new FakeAiProvider({ scenario: "NETWORK_ERROR" }).generate(input),
      )
      .mockImplementationOnce((input: AiProposalCreateRequest) =>
        new FakeAiProvider({ scenario: "CALENDAR_EVENT_SUCCESS" }).generate(
          input,
        ),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await createService(
      harness.prisma,
      providerFactoryWithGenerate(generate),
      undefined,
      { sleep },
    ).create("user_1", "k".repeat(16), INPUT);
    expect(result.request.status).toBe("SUCCEEDED");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100);
    expect(harness.attempts.map((attempt) => attempt.status)).toEqual([
      "FAILED",
      "SUCCEEDED",
    ]);
    expect(harness.attempts[1]?.startedAt).toBeDefined();
    expect(harness.request.startedAt).toBe(harness.attempts[0]?.startedAt);
    expect(harness.request.originalUserInput).toBeNull();
    expect(harness.request.originalInputExpiresAt).toBeNull();
  });

  it("PR19 timeout settlement fence permits at most two attempts and ignores late results", async () => {
    const harness = buildCreateHarness();
    const resolvers: Array<
      (value: ReturnType<FakeAiProvider["generate"]>) => void
    > = [];
    const generate = vi.fn(
      () =>
        new Promise<ReturnType<FakeAiProvider["generate"]>>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const factory = providerFactoryWithUnknownGenerate(generate);
    await expect(
      createService(harness.prisma, factory, undefined, {
        sleep: async () => undefined,
        timeoutMs: 1,
      }).create("user_1", "k".repeat(16), INPUT),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_TIMEOUT", statusCode: 504 });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(harness.attempts).toHaveLength(2);
    expect(harness.request.status).toBe("FAILED");

    const success = new FakeAiProvider({
      scenario: "CALENDAR_EVENT_SUCCESS",
    }).generate(INPUT);
    for (const resolve of resolvers) resolve(success);
    await Promise.resolve();
    expect(harness.request.status).toBe("FAILED");
    expect(harness.proposalCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["HTTP_4XX", "AI_PROVIDER_ERROR"],
    ["SCHEMA_INVALID", "AI_SCHEMA_VALIDATION_ERROR"],
    ["DOMAIN_INVALID", "AI_DOMAIN_VALIDATION_ERROR"],
    ["MALFORMED_RESPONSE", "AI_MALFORMED_OUTPUT"],
  ] as const)(
    "PR19 %s is non-retryable and safely persisted as %s",
    async (scenario, code) => {
      const harness = buildCreateHarness();
      const generate = vi.fn((input: AiProposalCreateRequest) =>
        new FakeAiProvider({ scenario }).generate(input),
      );
      await expect(
        createService(
          harness.prisma,
          providerFactoryWithGenerate(generate),
        ).create("user_1", "k".repeat(16), INPUT),
      ).rejects.toMatchObject({ code });
      expect(generate).toHaveBeenCalledOnce();
      expect(harness.attempts).toHaveLength(1);
      expect(harness.request.failureCode).toBe(code);
    },
  );

  it("PR19 circuit-open failure creates no attempt or provider call", async () => {
    const harness = buildCreateHarness();
    const breaker = new AiCircuitBreaker();
    const now = new Date("2026-08-20T00:00:00.000Z");
    for (let index = 0; index < 5; index += 1) {
      const permit = breaker.acquire(now);
      if (permit.allowed) {
        breaker.record(permit.permit, "TECHNICAL_FAILURE", now);
      }
    }
    const generate = vi.fn((input: AiProposalCreateRequest) =>
      new FakeAiProvider({ scenario: "CALENDAR_EVENT_SUCCESS" }).generate(
        input,
      ),
    );
    const factory = providerFactoryWithGenerate(generate);
    await expect(
      createService(harness.prisma, factory, undefined, {
        breaker,
        clock: { now: () => now },
      }).create("user_1", "k".repeat(16), INPUT),
    ).rejects.toMatchObject({ code: "AI_CIRCUIT_BREAKER_BLOCKED" });
    expect(generate).not.toHaveBeenCalled();
    expect(harness.attempts).toHaveLength(0);
    expect(harness.request.startedAt).toBeNull();
  });

  it("PR19 rejects unsupported requestType before claim and gate execution", async () => {
    const findUnique = vi.fn();
    await expect(
      createService({
        aiRequest: { findUnique },
      } as unknown as PrismaService).create("user_1", "k".repeat(16), {
        ...INPUT,
        requestType: "UNKNOWN",
      }),
    ).rejects.toMatchObject({ code: "AI_INPUT_VALIDATION_ERROR" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["CLAIMED", null, "INTERNAL_ERROR", "STALE_CLAIMED_RECOVERY"],
    ["RUNNING", null, "INTERNAL_ERROR", "INCONSISTENT_RUNNING_STATE"],
    ["RUNNING", "old", "AI_PROVIDER_TIMEOUT", "STALE_RUNNING_RECOVERY"],
  ] as const)(
    "PR19 recovers stale/inconsistent %s without gates or provider work",
    async (status, startedAtKind, code, category) => {
      const now = new Date("2026-08-20T00:02:00.000Z");
      const harness = buildExistingHarness(
        status,
        startedAtKind === "old" ? new Date("2026-08-20T00:00:00.000Z") : null,
      );
      const factory = { create: vi.fn() } as unknown as AiFakeProviderFactory;
      await expect(
        createService(harness.prisma, factory, AiFeatureGate.forTesting({}), {
          clock: { now: () => now },
        }).create("user_1", "k".repeat(16), INPUT),
      ).rejects.toMatchObject({ code });
      expect(factory.create).not.toHaveBeenCalled();
      expect(harness.request).toMatchObject({
        failureCategory: category,
        failureCode: code,
        status: "FAILED",
      });
      if (status === "RUNNING") {
        expect(harness.attempt.status).toBe("FAILED");
      }
    },
  );

  it("PR19 replays known failure faithfully and fails closed for corrupt code", async () => {
    for (const [failureCode, expected] of [
      ["AI_PROVIDER_NETWORK_ERROR", "AI_PROVIDER_NETWORK_ERROR"],
      ["CORRUPT_CODE", "INTERNAL_ERROR"],
    ] as const) {
      const harness = buildExistingHarness("FAILED", null, failureCode);
      await expect(
        createService(
          harness.prisma,
          { create: vi.fn() } as unknown as AiFakeProviderFactory,
          AiFeatureGate.forTesting({}),
        ).create("user_1", "k".repeat(16), INPUT),
      ).rejects.toMatchObject({ code: expected });
      expect(harness.request.originalInputExpiresAt).toEqual(
        new Date("2026-09-19T00:00:00.000Z"),
      );
    }
  });

  it.each([
    ["CLAIMED", null],
    ["RUNNING", new Date("2026-08-20T00:01:30.001Z")],
  ] as const)(
    "PR19 returns conflict for fresh %s without a second gate or provider call",
    async (status, startedAt) => {
      const now = new Date("2026-08-20T00:02:00.000Z");
      const harness = buildExistingHarness(status, startedAt);
      if (status === "CLAIMED") {
        harness.request.createdAt = new Date("2026-08-20T00:01:30.001Z");
      }
      const factory = { create: vi.fn() } as unknown as AiFakeProviderFactory;
      await expect(
        createService(harness.prisma, factory, AiFeatureGate.forTesting({}), {
          clock: { now: () => now },
        }).create("user_1", "k".repeat(16), INPUT),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      expect(factory.create).not.toHaveBeenCalled();
      expect(harness.request.status).toBe(status);
    },
  );

  it("PR19 sanitizes unexpected router errors and never exposes credentials", async () => {
    const credential = "provider-api-key-must-not-leak";
    const harness = buildCreateHarness();
    let caught: unknown;
    try {
      await createService(
        harness.prisma,
        providerFactoryWithUnknownGenerate(() => {
          throw new Error(credential);
        }),
      ).create("user_1", "k".repeat(16), INPUT);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "INTERNAL_ERROR", statusCode: 500 });
    expect(JSON.stringify(caught)).not.toContain(credential);
    expect(harness.request).toMatchObject({
      failureCategory: "INTERNAL_ROUTER_ERROR",
      failureCode: "INTERNAL_ERROR",
      status: "FAILED",
    });
  });

  it("PR19 never restarts a CANCELLED same-key request", async () => {
    const harness = buildExistingHarness("CANCELLED", null);
    const factory = { create: vi.fn() } as unknown as AiFakeProviderFactory;
    await expect(
      createService(harness.prisma, factory).create(
        "user_1",
        "k".repeat(16),
        INPUT,
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(factory.create).not.toHaveBeenCalled();
  });
});

function createService(
  prisma: PrismaService,
  factory: AiFakeProviderFactory = new AiFakeProviderFactory(),
  featureGate: AiFeatureGate = AiFeatureGate.forTesting({
    businessWrite: true,
    fakeProvider: true,
    proposal: true,
  }),
  runtime?: AiProposalRuntimeOptions,
): AiProposalReviewService {
  const Constructor = AiProposalReviewService as unknown as new (
    prisma: PrismaService,
    factory: AiFakeProviderFactory,
    featureGate: AiFeatureGate,
    runtime?: AiProposalRuntimeOptions,
  ) => AiProposalReviewService;
  return new Constructor(prisma, factory, featureGate, runtime);
}

function normalize(
  service: AiProposalReviewService,
  request: AiProposalCreateRequest,
  result: ReturnType<FakeAiProvider["generate"]>,
) {
  return (
    service as unknown as {
      normalizeProviderResult: (
        request: AiProposalCreateRequest,
        result: ReturnType<FakeAiProvider["generate"]>,
      ) => {
        operations: Array<{
          clarification: string | null;
          confidence: string;
          fields: Record<string, unknown>;
          operationType: string;
          status: string;
        }>;
      };
    }
  ).normalizeProviderResult(request, result);
}

function scenarioFactory(
  scenario: ConstructorParameters<typeof FakeAiProvider>[0]["scenario"],
): AiFakeProviderFactory {
  return {
    create: () => new FakeAiProvider({ scenario }),
  } as AiFakeProviderFactory;
}

interface ProposalCreateArgs {
  data: {
    modelId: unknown;
    operations: { create: Array<Record<string, unknown>> };
    providerId: unknown;
  };
}

interface MutableProposalRow extends Record<string, unknown> {
  id: string;
  reviewedAt: Date | null;
  status: string;
  userId: string;
  version: number;
}

interface MutableOperationRow extends Record<string, unknown> {
  acceptedAt: Date | null;
  appliedAt: Date | null;
  confidence: string;
  fieldsJson: Record<string, unknown>;
  id: string;
  operationType: string;
  proposalId: string;
  status: string;
}

function buildCreateHarness() {
  const now = new Date("2026-08-15T01:00:00.000Z");
  const request: Record<string, unknown> = {
    completedAt: null,
    createdAt: now,
    failureCategory: null,
    failureCode: null,
    id: "request_1",
    idempotencyKey: "k".repeat(16),
    inputFingerprint: "",
    locale: "zh-CN",
    proposalId: null,
    requestId: "public_request_1",
    startedAt: null,
    status: "CLAIMED",
    timeZoneId: "Asia/Shanghai",
    updatedAt: now,
    userId: "user_1",
  };
  const attempt: Record<string, unknown> = { status: null };
  const attempts: Array<Record<string, unknown>> = [];
  const proposalCreate = vi.fn(async ({ data }: ProposalCreateArgs) => ({
    completedAt: null,
    createdAt: now,
    expiresAt: null,
    id: "proposal_1",
    modelId: data.modelId,
    operations: data.operations.create.map(
      (operation: Record<string, unknown>, index: number) => ({
        acceptedAt: null,
        appliedAt: null,
        clarification: operation.clarification,
        confidence: operation.confidence,
        createdAt: now,
        errorCode: null,
        errorMessage: null,
        fieldsJson: operation.fieldsJson,
        id: `operation_${index + 1}`,
        operationType: operation.operationType,
        ordinal: operation.ordinal,
        rejectedAt: null,
        resultDraftId: null,
        resultEntityId: null,
        resultEntityType: null,
        status: operation.status,
        updatedAt: now,
      }),
    ),
    providerId: data.providerId,
    reviewedAt: null,
    schemaVersion: 1,
    status: "PENDING_REVIEW",
    updatedAt: now,
    version: 1,
  }));
  const tx = {
    aiRequest: {
      findUniqueOrThrow: vi.fn(async () => request),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(request, data);
        return { count: 1 };
      }),
    },
    aiProviderAttempt: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created =
          data.attemptNo === 1 ? attempt : ({} as Record<string, unknown>);
        Object.assign(created, data);
        attempts.push(created);
        return created;
      }),
      updateMany: vi.fn(
        async ({
          data,
          where,
        }: {
          data: Record<string, unknown>;
          where: { attemptNo?: number; status?: string };
        }) => {
          const matched = attempts.find(
            (value) =>
              (where.attemptNo === undefined ||
                value.attemptNo === where.attemptNo) &&
              (where.status === undefined || value.status === where.status),
          );
          if (!matched) return { count: 0 };
          Object.assign(matched, data);
          return { count: 1 };
        },
      ),
    },
    aiProposal: { create: proposalCreate },
  };
  const prisma = {
    aiRequest: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(request, data);
        return request;
      }),
      findUnique: vi.fn(async () => null),
      findUniqueOrThrow: tx.aiRequest.findUniqueOrThrow,
      updateMany: tx.aiRequest.updateMany,
    },
    aiProviderAttempt: tx.aiProviderAttempt,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { attempt, attempts, prisma, proposalCreate, request };
}

function providerFactoryWithGenerate(
  generate: (
    input: AiProposalCreateRequest,
  ) => ReturnType<FakeAiProvider["generate"]>,
): AiFakeProviderFactory {
  return providerFactoryWithUnknownGenerate(generate);
}

function providerFactoryWithUnknownGenerate(
  generate: (input: AiProposalCreateRequest) => unknown,
): AiFakeProviderFactory {
  return {
    create: () => ({
      generate,
      modelId: "fake-model",
      providerId: "fake-provider",
    }),
  } as unknown as AiFakeProviderFactory;
}

function buildExistingHarness(
  status: string,
  startedAt: Date | null,
  failureCode: string | null = null,
) {
  const request: Record<string, unknown> = {
    completedAt:
      status === "FAILED" ? new Date("2026-08-20T00:01:00.000Z") : null,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    failureCategory: status === "FAILED" ? "PERSISTED_FAILURE" : null,
    failureCode,
    id: "request_existing",
    idempotencyKey: "k".repeat(16),
    inputFingerprint: sha256Fingerprint(INPUT),
    locale: INPUT.locale,
    originalInputExpiresAt: new Date("2026-09-19T00:00:00.000Z"),
    originalUserInput: INPUT.userInput,
    proposalId: null,
    requestId: "public_existing",
    startedAt,
    status,
    timeZoneId: INPUT.timeZoneId,
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    userId: "user_1",
  };
  const attempt: Record<string, unknown> = {
    aiRequestId: request.id,
    attemptNo: 1,
    completedAt: null,
    failureCategory: null,
    startedAt: startedAt ?? new Date("2026-08-20T00:00:00.000Z"),
    status: status === "RUNNING" ? "RUNNING" : "FAILED",
  };
  const aiRequest = {
    findUnique: vi.fn(async () => request),
    findUniqueOrThrow: vi.fn(async () => request),
    updateMany: vi.fn(
      async ({
        data,
        where,
      }: {
        data: Record<string, unknown>;
        where: { status?: string };
      }) => {
        if (where.status !== undefined && request.status !== where.status) {
          return { count: 0 };
        }
        Object.assign(request, data);
        return { count: 1 };
      },
    ),
  };
  const aiProviderAttempt = {
    updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (attempt.status !== "RUNNING") return { count: 0 };
      Object.assign(attempt, data);
      return { count: 1 };
    }),
  };
  const tx = { aiProviderAttempt, aiRequest };
  const prisma = {
    aiProviderAttempt,
    aiRequest,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { attempt, prisma, request };
}

function buildMutationHarness(
  proposalStatus: string,
  operationStatus: string,
  version: number,
) {
  const now = new Date("2026-08-15T01:00:00.000Z");
  const proposal: MutableProposalRow = {
    aiRequestId: "request_1",
    completedAt: null,
    createdAt: now,
    expiresAt: null,
    id: "proposal_1",
    modelId: "fake-model",
    providerId: "fake-provider",
    reviewedAt: null,
    schemaVersion: 1,
    status: proposalStatus,
    updatedAt: now,
    userId: "user_1",
    version,
  };
  const operation: MutableOperationRow = {
    acceptedAt: operationStatus === "ACCEPTED" ? now : null,
    appliedAt: null,
    clarification: null,
    confidence: "0.9000",
    createdAt: now,
    errorCode: null,
    errorMessage: null,
    fieldsFingerprint: "a".repeat(64),
    fieldsJson: { title: "original" },
    id: "operation_1",
    operationType: "TASK",
    ordinal: 1,
    proposalId: "proposal_1",
    rejectedAt: null,
    resultDraftId: null,
    resultEntityId: null,
    resultEntityType: null,
    status: operationStatus,
    updatedAt: now,
  };
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: "locked" }]),
    aiProposal: {
      findFirst: vi.fn(
        async (args: {
          include?: { operations?: unknown };
          where?: { id?: unknown; userId?: unknown };
        }) => {
          if (
            args.where?.id !== proposal.id ||
            args.where?.userId !== proposal.userId
          ) {
            return null;
          }
          return args.include?.operations
            ? { ...proposal, operations: [operation] }
            : proposal;
        },
      ),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(proposal, data);
        return proposal;
      }),
      updateMany: vi.fn(
        async ({
          data,
          where,
        }: {
          data: Record<string, unknown> & { version?: { increment: number } };
          where: Record<string, unknown> & { version?: number };
        }) => {
          if (
            where.version !== undefined &&
            where.version !== proposal.version
          ) {
            return { count: 0 };
          }
          if (data.version?.increment)
            proposal.version += data.version.increment;
          for (const [key, value] of Object.entries(data)) {
            if (key !== "version") proposal[key] = value;
          }
          return { count: 1 };
        },
      ),
    },
    aiOperation: {
      count: vi.fn(async () => (operation.status === "REJECTED" ? 0 : 1)),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(operation, data);
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    aiProposal: tx.aiProposal,
    aiOperation: tx.aiOperation,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { operation, prisma, proposal };
}
