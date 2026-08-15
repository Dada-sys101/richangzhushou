import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";
import type { AiProposalCreateRequest } from "@daily-assistant/api-contracts";

import type { PrismaService } from "../prisma/prisma.service.js";
import {
  AiFakeProviderFactory,
  operationTypeForRequestType,
} from "./ai-fake-provider.factory.js";
import { sha256Fingerprint } from "./ai-proposal.fingerprint.js";
import { toAiProposalDetail } from "./ai-proposal.mapper.js";
import { AiProposalReviewService } from "./ai-proposal.review-service.js";
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
});

function createService(
  prisma: PrismaService,
  factory: AiFakeProviderFactory = new AiFakeProviderFactory(),
): AiProposalReviewService {
  const Constructor = AiProposalReviewService as unknown as new (
    prisma: PrismaService,
    factory: AiFakeProviderFactory,
  ) => AiProposalReviewService;
  return new Constructor(prisma, factory);
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
        Object.assign(attempt, data);
        return attempt;
      }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(attempt, data);
        return { count: 1 };
      }),
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
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { attempt, prisma, proposalCreate, request };
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
