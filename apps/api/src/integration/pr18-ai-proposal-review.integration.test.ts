import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AiProposalCreateRequest } from "@daily-assistant/api-contracts";

import { AiFakeProviderFactory } from "../ai/ai-fake-provider.factory.js";
import { AiFeatureGate } from "../ai/ai-feature-gate.js";
import { sha256Fingerprint } from "../ai/ai-proposal.fingerprint.js";
import { AiProposalReviewService } from "../ai/ai-proposal.review-service.js";
import { FakeAiProvider } from "../ai/fake-provider/fake-ai-provider.js";
import {
  FAKE_AI_MODEL_ID,
  FAKE_AI_PROVIDER_ID,
} from "../ai/fake-provider/fake-ai-provider.types.js";
import { PrismaClient } from "../generated/prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDb = testDatabaseUrl ? describe : describe.skip;

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

describeWithDb("PR18 H03 AI proposal review persistence", () => {
  let prisma: PrismaClient;
  let service: AiProposalReviewService;
  let userA: { id: string };
  let userB: { id: string };
  let sequence = 0;

  beforeAll(() => {
    if (!testDatabaseUrl) return;
    prisma = new PrismaClient({ adapter: new PrismaMariaDb(testDatabaseUrl) });
    service = createService(prisma);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { username: { startsWith: "pr18_h03_" } },
    });
    userA = await createUser("a");
    userB = await createUser("b");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({
      where: { username: { startsWith: "pr18_h03_" } },
    });
    await prisma.$disconnect();
  });

  it("H03-I01/I02/I03/I24: creates Request, Proposal and ordered Operations with successful lifecycles", async () => {
    const created = await service.create(userA.id, key(), INPUT);
    expect(created.proposal.status).toBe("PENDING_REVIEW");
    expect(created.proposal.operations).toHaveLength(1);
    expect(created.proposal.operations[0]).toMatchObject({
      ordinal: 1,
      status: "PENDING",
    });
    expect(created.request.status).toBe("SUCCEEDED");
    expect(created.request.proposalId).toBe(created.proposal.id);

    const requestRow = await prisma.aiRequest.findUniqueOrThrow({
      where: { id: created.request.id },
    });
    const attempt = await prisma.aiProviderAttempt.findFirstOrThrow({
      where: { aiRequestId: requestRow.id },
    });
    expect(requestRow).toMatchObject({
      originalInputExpiresAt: null,
      originalUserInput: null,
      status: "SUCCEEDED",
      proposalId: created.proposal.id,
    });
    expect(requestRow.completedAt).toBeInstanceOf(Date);
    expect(attempt.status).toBe("SUCCEEDED");
    expect(attempt.completedAt).toBeInstanceOf(Date);

    await addSecondOperation(created.proposal.id);
    const loaded = await service.get(userA.id, created.proposal.id);
    expect(loaded.operations.map((operation) => operation.ordinal)).toEqual([
      1, 2,
    ]);
  });

  it("H03-I04/I05: replays same input and rejects changed input for the same user/key", async () => {
    const idempotencyKey = key();
    const first = await service.create(userA.id, idempotencyKey, INPUT);
    const replay = await service.create(userA.id, idempotencyKey, {
      ...INPUT,
    });
    expect(replay.proposal.id).toBe(first.proposal.id);
    expect(await prisma.aiRequest.count({ where: { idempotencyKey } })).toBe(1);
    await expect(
      service.create(userA.id, idempotencyKey, {
        ...INPUT,
        userInput: "不同请求",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", statusCode: 409 });
  });

  it("H03-I06: global key reuse across users conflicts without returning user B data", async () => {
    const idempotencyKey = key();
    const first = await service.create(userB.id, idempotencyKey, INPUT);
    await expect(
      service.create(userA.id, idempotencyKey, INPUT),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      statusCode: 409,
    });
    const aList = await service.list(userA.id, { unfinished: true });
    expect(aList.items).toEqual([]);
    expect(JSON.stringify(aList)).not.toContain(first.proposal.id);
  });

  it("H03-I07/I08: controlled failure commits FAILED rows and replay never invokes provider twice", async () => {
    const generate = vi.fn((input: AiProposalCreateRequest) =>
      new FakeAiProvider({ scenario: "CONTROLLED_FAILURE" }).generate(input),
    );
    const failureService = createService(
      prisma,
      providerFactoryWithGenerate(generate),
    );
    const idempotencyKey = key();
    await expect(
      failureService.create(userA.id, idempotencyKey, INPUT),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR", statusCode: 502 });

    const requestRow = await prisma.aiRequest.findUniqueOrThrow({
      where: { idempotencyKey },
    });
    const attempt = await prisma.aiProviderAttempt.findFirstOrThrow({
      where: { aiRequestId: requestRow.id },
    });
    expect(requestRow).toMatchObject({
      failureCategory: "SAFETY_FAILURE",
      failureCode: "AI_PROVIDER_ERROR",
      originalUserInput: INPUT.userInput,
      status: "FAILED",
    });
    expect(requestRow.originalInputExpiresAt).toBeInstanceOf(Date);
    expect(attempt).toMatchObject({
      failureCategory: "SAFETY_FAILURE",
      status: "FAILED",
    });
    expect(requestRow.completedAt).toBeInstanceOf(Date);
    expect(attempt.completedAt).toBeInstanceOf(Date);

    await expect(
      failureService.create(userA.id, idempotencyKey, INPUT),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("H03-I09: list returns only current-user unfinished proposals", async () => {
    const aPending = await service.create(userA.id, key(), INPUT);
    const aRejected = await service.create(userA.id, key(), INPUT);
    await service.rejectProposal(userA.id, aRejected.proposal.id, {
      version: 1,
    });
    await service.create(userB.id, key(), INPUT);

    const list = await service.list(userA.id, { unfinished: true, limit: 100 });
    expect(list.items.map((item) => item.id)).toEqual([aPending.proposal.id]);
    expect(list.items.every((item) => item.status === "PENDING_REVIEW")).toBe(
      true,
    );
  });

  it("H03-I10/I11/I12/I13: cross-user read and every review mutation return the same not-found boundary", async () => {
    const b = await service.create(userB.id, key(), INPUT);
    const operationId = b.proposal.operations[0]!.id;
    const calls = [
      () => service.get(userA.id, b.proposal.id),
      () =>
        service.editOperation(userA.id, b.proposal.id, operationId, {
          fields: { title: "x" },
          version: 1,
        }),
      () =>
        service.acceptOperation(userA.id, b.proposal.id, operationId, {
          version: 1,
        }),
      () =>
        service.rejectOperation(userA.id, b.proposal.id, operationId, {
          version: 1,
        }),
      () => service.rejectProposal(userA.id, b.proposal.id, { version: 1 }),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toMatchObject({
        code: "AI_PROPOSAL_NOT_FOUND",
        statusCode: 404,
      });
    }
    expect(
      await prisma.aiProposal.findUniqueOrThrow({
        where: { id: b.proposal.id },
      }),
    ).toMatchObject({ status: "PENDING_REVIEW", version: 1 });
  });

  it("H03-I14: operationId from another Proposal cannot mutate the target Proposal", async () => {
    const first = await service.create(userA.id, key(), INPUT);
    const second = await service.create(userA.id, key(), INPUT);
    await expect(
      service.acceptOperation(
        userA.id,
        first.proposal.id,
        second.proposal.operations[0]!.id,
        { version: 1 },
      ),
    ).rejects.toMatchObject({ code: "AI_PROPOSAL_NOT_FOUND", statusCode: 404 });
    expect((await service.get(userA.id, first.proposal.id)).version).toBe(1);
  });

  it("H03-I15/I16: edit updates fields and version, while a stale version fails", async () => {
    const created = await service.create(userA.id, key(), INPUT);
    const operation = created.proposal.operations[0]!;
    const edited = await service.editOperation(
      userA.id,
      created.proposal.id,
      operation.id,
      { fields: { title: "updated" }, version: 1 },
    );
    expect(edited.version).toBe(2);
    expect(edited.reviewedAt).not.toBeNull();
    expect(edited.operations[0]).toMatchObject({
      confidence: operation.confidence,
      fields: { title: "updated" },
      operationType: operation.operationType,
      status: "PENDING",
    });
    await expect(
      service.acceptOperation(userA.id, created.proposal.id, operation.id, {
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT", statusCode: 409 });
  });

  it("H03-I17/I18: accept then reject never creates a formal record and preserves acceptedAt", async () => {
    const before = await formalCounts(userA.id);
    const created = await service.create(userA.id, key(), INPUT);
    const operationId = created.proposal.operations[0]!.id;
    const accepted = await service.acceptOperation(
      userA.id,
      created.proposal.id,
      operationId,
      { version: 1 },
    );
    expect(accepted.operations[0]).toMatchObject({ status: "ACCEPTED" });
    expect(accepted.operations[0]?.acceptedAt).not.toBeNull();
    expect(accepted.operations[0]?.appliedAt).toBeNull();

    const rejected = await service.rejectOperation(
      userA.id,
      created.proposal.id,
      operationId,
      { version: 2 },
    );
    expect(rejected.operations[0]).toMatchObject({ status: "REJECTED" });
    expect(rejected.operations[0]?.acceptedAt).toBe(
      accepted.operations[0]?.acceptedAt,
    );
    expect(await formalCounts(userA.id)).toEqual(before);
  });

  it("H03-I19: rejecting the last active Operation rejects the Proposal", async () => {
    const created = await service.create(userA.id, key(), INPUT);
    const rejected = await service.rejectOperation(
      userA.id,
      created.proposal.id,
      created.proposal.operations[0]!.id,
      { version: 1 },
    );
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.completedAt).not.toBeNull();
    expect(rejected.version).toBe(2);
  });

  it("H03-I20/I21: proposal rejection rejects PENDING/ACCEPTED operations and is terminal", async () => {
    const created = await service.create(userA.id, key(), INPUT);
    await addSecondOperation(created.proposal.id);
    const accepted = await service.acceptOperation(
      userA.id,
      created.proposal.id,
      created.proposal.operations[0]!.id,
      { version: 1 },
    );
    const rejected = await service.rejectProposal(
      userA.id,
      created.proposal.id,
      {
        version: accepted.version,
      },
    );
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.operations.map((operation) => operation.status)).toEqual([
      "REJECTED",
      "REJECTED",
    ]);
    await expect(
      service.editOperation(
        userA.id,
        created.proposal.id,
        rejected.operations[0]!.id,
        { fields: {}, version: rejected.version },
      ),
    ).rejects.toMatchObject({ code: "AI_PROPOSAL_INVALID_STATE" });
  });

  it("H03-I22: create/edit/accept/reject/rejectProposal leave all formal business tables unchanged", async () => {
    const before = await formalCounts(userA.id);
    const first = await service.create(userA.id, key(), INPUT);
    const firstOperation = first.proposal.operations[0]!.id;
    const edited = await service.editOperation(
      userA.id,
      first.proposal.id,
      firstOperation,
      { fields: { title: "reviewed" }, version: 1 },
    );
    const accepted = await service.acceptOperation(
      userA.id,
      first.proposal.id,
      firstOperation,
      { version: edited.version },
    );
    await service.rejectOperation(userA.id, first.proposal.id, firstOperation, {
      version: accepted.version,
    });
    const second = await service.create(userA.id, key(), INPUT);
    await service.rejectProposal(userA.id, second.proposal.id, { version: 1 });
    expect(await formalCounts(userA.id)).toEqual(before);
  });

  it("H03-I23: two concurrent mutations using one Proposal version allow at most one success", async () => {
    const created = await service.create(userA.id, key(), INPUT);
    const operationId = created.proposal.operations[0]!.id;
    const results = await Promise.allSettled([
      service.acceptOperation(userA.id, created.proposal.id, operationId, {
        version: 1,
      }),
      service.editOperation(userA.id, created.proposal.id, operationId, {
        fields: { title: "concurrent" },
        version: 1,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: "VERSION_CONFLICT" });
    expect((await service.get(userA.id, created.proposal.id)).version).toBe(2);
  });

  async function createUser(suffix: string) {
    sequence += 1;
    const username = `pr18_h03_${suffix}_${sequence}`;
    return prisma.user.create({
      data: {
        displayName: `PR18 H03 ${suffix}`,
        normalizedUsername: username,
        passwordHash: "test-only-not-a-real-password-hash",
        role: "USER",
        status: "ACTIVE",
        username,
      },
    });
  }

  async function addSecondOperation(proposalId: string): Promise<void> {
    await prisma.aiOperation.create({
      data: {
        confidence: "0.5000",
        fieldsFingerprint: sha256Fingerprint({ title: "second" }),
        fieldsJson: { title: "second" },
        operationType: "TASK",
        ordinal: 2,
        proposalId,
        status: "PENDING",
      },
    });
  }

  async function formalCounts(userId: string) {
    const [transactions, calendarEvents, tasks, reminders, trips] =
      await Promise.all([
        prisma.transaction.count({ where: { userId } }),
        prisma.calendarEvent.count({ where: { userId } }),
        prisma.task.count({ where: { userId } }),
        prisma.reminder.count({ where: { userId } }),
        prisma.trip.count({ where: { userId } }),
      ]);
    return { calendarEvents, reminders, tasks, transactions, trips };
  }

  function key(): string {
    sequence += 1;
    return `pr18-h03-key-${sequence.toString().padStart(8, "0")}`;
  }
});

function createService(
  prisma: PrismaClient,
  factory: AiFakeProviderFactory = new AiFakeProviderFactory(),
): AiProposalReviewService {
  const Constructor = AiProposalReviewService as unknown as new (
    prisma: PrismaService,
    factory: AiFakeProviderFactory,
    featureGate: AiFeatureGate,
  ) => AiProposalReviewService;
  return new Constructor(
    prisma as unknown as PrismaService,
    factory,
    AiFeatureGate.forTesting({
      businessWrite: true,
      fakeProvider: true,
      proposal: true,
    }),
  );
}

function providerFactoryWithGenerate(
  generate: (
    input: AiProposalCreateRequest,
  ) => ReturnType<FakeAiProvider["generate"]>,
): AiFakeProviderFactory {
  return {
    create: () =>
      ({
        generate,
        modelId: FAKE_AI_MODEL_ID,
        providerId: FAKE_AI_PROVIDER_ID,
      }) as unknown as FakeAiProvider,
  } as AiFakeProviderFactory;
}
