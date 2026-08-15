import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  AiOperationType,
  AiProposalCreateRequest,
} from "@daily-assistant/api-contracts";

import { AiFakeProviderFactory } from "../ai/ai-fake-provider.factory.js";
import { AiFormalWriteOrchestrator } from "../ai/ai-formal-write.orchestrator.js";
import { AiProposalService } from "../ai/ai-proposal.service.js";
import { sha256Fingerprint } from "../ai/ai-proposal.fingerprint.js";
import { CalendarService } from "../calendar/calendar.service.js";
import { FinanceService } from "../finance/finance.service.js";
import { RemindersService } from "../reminders/reminders.service.js";
import { TasksService } from "../tasks/tasks.service.js";
import { TripsService } from "../trips/trips.service.js";
import { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDb = testDatabaseUrl ? describe : describe.skip;

describeWithDb("PR18 H04 final confirmation and formal writes", () => {
  let prisma: PrismaClient;
  let service: AiProposalService;
  let userA: { id: string };
  let userB: { id: string };
  let sequence = 0;

  beforeAll(() => {
    if (!testDatabaseUrl) return;
    prisma = new PrismaClient({ adapter: new PrismaMariaDb(testDatabaseUrl) });
    const db = prisma as unknown as PrismaService;
    const orchestrator = new AiFormalWriteOrchestrator(
      new FinanceService(db),
      new CalendarService(db),
      new TasksService(db),
      new RemindersService(db),
      new TripsService(db),
    );
    service = new AiProposalService(
      db,
      new AiFakeProviderFactory(),
      orchestrator,
    );
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { username: { startsWith: "pr18_h04_" } },
    });
    userA = await createUser("a");
    userB = await createUser("b");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({
      where: { username: { startsWith: "pr18_h04_" } },
    });
    await prisma.$disconnect();
  });

  it("H04-I01..I08/I22: final-confirm writes exactly one record for all five Domain Services", async () => {
    const before = await formalCounts(userA.id);
    const results = [];
    for (const operationType of [
      "TRANSACTION",
      "CALENDAR_EVENT",
      "TASK",
      "REMINDER",
      "TRIP",
    ] as const) {
      const accepted = await createAccepted(userA.id, operationType);
      const result = await service.finalConfirm(userA.id, accepted.proposalId, {
        operationIds: [accepted.operationId],
        version: accepted.version,
      });
      results.push(result.operations[0]);
      expect(result.status).toBe("APPLIED");
      expect(result.operations[0]).toMatchObject({
        operationType,
        status: "APPLIED",
      });
      expect(result.operations[0]?.resultEntityId).toBeTruthy();
    }
    const after = await formalCounts(userA.id);
    expect(after.transactions - before.transactions).toBe(1);
    expect(after.calendarEvents - before.calendarEvents).toBe(1);
    expect(after.tasks - before.tasks).toBe(1);
    expect(after.reminders - before.reminders).toBe(1);
    expect(after.trips - before.trips).toBe(1);
    expect(results).toHaveLength(5);
    expect(
      await prisma.transaction.count({
        where: { userId: userA.id, source: "TEXT" },
      }),
    ).toBe(1);
  });

  it("H04-I06: resultEntityId resolves to the actual formal record owned by the same user", async () => {
    const resolved: Array<{
      entityId: string;
      operationType: AiOperationType;
    }> = [];
    for (const operationType of [
      "TRANSACTION",
      "CALENDAR_EVENT",
      "TASK",
      "REMINDER",
      "TRIP",
    ] as const) {
      const accepted = await createAccepted(userA.id, operationType);
      const result = await service.finalConfirm(userA.id, accepted.proposalId, {
        operationIds: [accepted.operationId],
        version: accepted.version,
      });
      const operation = result.operations[0]!;
      expect(
        operation.resultEntityId,
        `${operationType} resultEntityId`,
      ).toBeTruthy();
      resolved.push({
        entityId: operation.resultEntityId!,
        operationType,
      });
    }

    for (const { entityId, operationType } of resolved) {
      const row = await resolveFormalRow(operationType, entityId);
      expect(row, `${operationType} formal record must exist`).not.toBeNull();
      expect(row?.userId, `${operationType} must belong to the test user`).toBe(
        userA.id,
      );
    }
  });

  it("H04-I09/I10/I16/I18: applies only the requested subset and replays it idempotently", async () => {
    const created = await service.create(userA.id, key(), input("TASK"));
    const first = created.proposal.operations[0]!;
    const second = await addOperation(created.proposal.id, 2, "TASK", {
      title: "second task",
    });
    const acceptedFirst = await service.acceptOperation(
      userA.id,
      created.proposal.id,
      first.id,
      { version: 1 },
    );
    const acceptedSecond = await service.acceptOperation(
      userA.id,
      created.proposal.id,
      second.id,
      { version: acceptedFirst.version },
    );
    const applied = await service.finalConfirm(userA.id, created.proposal.id, {
      operationIds: [first.id],
      version: acceptedSecond.version,
    });
    expect(applied.status).toBe("PARTIALLY_APPLIED");
    expect(applied.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, status: "APPLIED" }),
        expect.objectContaining({ id: second.id, status: "ACCEPTED" }),
      ]),
    );
    expect(await prisma.task.count({ where: { userId: userA.id } })).toBe(1);

    const firstResultEntityId = applied.operations.find(
      (operation) => operation.id === first.id,
    )?.resultEntityId;
    expect(firstResultEntityId).toBeTruthy();

    const replay = await service.finalConfirm(userA.id, created.proposal.id, {
      operationIds: [first.id],
      version: 1,
    });
    const replayResultEntityId = replay.operations.find(
      (operation) => operation.id === first.id,
    )?.resultEntityId;
    expect(
      replay.operations.find((operation) => operation.id === first.id),
    ).toMatchObject({
      status: "APPLIED",
    });
    // H04-I18: the replay returns the original resultEntityId without a
    // second Domain Service side effect.
    expect(replayResultEntityId).toBe(firstResultEntityId);
    expect(await prisma.task.count({ where: { userId: userA.id } })).toBe(1);
  });

  it("H04-I11/I12/I13/I14/I15: rejects pending, rejected, foreign and stale confirmations without formal writes", async () => {
    const pending = await service.create(userA.id, key(), input("TASK"));
    const before = await formalCounts(userA.id);
    await expect(
      service.finalConfirm(userA.id, pending.proposal.id, {
        operationIds: [pending.proposal.operations[0]!.id],
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "AI_OPERATION_INVALID_STATE" });
    await service.rejectProposal(userA.id, pending.proposal.id, { version: 1 });
    await expect(
      service.finalConfirm(userA.id, pending.proposal.id, {
        operationIds: [pending.proposal.operations[0]!.id],
        version: 2,
      }),
    ).rejects.toMatchObject({ code: "AI_PROPOSAL_INVALID_STATE" });

    const foreign = await createAccepted(userB.id, "TASK");
    await expect(
      service.finalConfirm(userA.id, foreign.proposalId, {
        operationIds: [foreign.operationId],
        version: foreign.version,
      }),
    ).rejects.toMatchObject({ code: "AI_PROPOSAL_NOT_FOUND" });

    const stale = await createAccepted(userA.id, "TASK");
    await expect(
      service.finalConfirm(userA.id, stale.proposalId, {
        operationIds: [stale.operationId],
        version: stale.version - 1,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(await formalCounts(userA.id)).toEqual(before);
  });

  it("H04-I14: same-user foreign proposal operation cannot be final-confirmed", async () => {
    // The same user owns Proposal A (Operation A) and Proposal B
    // (Operation B). Final-confirming Proposal A with Operation B's ID must
    // fail at the non-leaking Proposal-operation boundary and must not create
    // any formal business record. This proves ownership is scoped by Proposal,
    // not merely by userId.
    const proposalA = await createAccepted(userA.id, "TASK");
    const proposalB = await createAccepted(userA.id, "TASK");
    const before = await formalCounts(userA.id);

    await expect(
      service.finalConfirm(userA.id, proposalA.proposalId, {
        operationIds: [proposalB.operationId],
        version: proposalA.version,
      }),
    ).rejects.toMatchObject({ code: "AI_PROPOSAL_NOT_FOUND", statusCode: 404 });

    expect(await formalCounts(userA.id)).toEqual(before);
  });

  it("H04-I17: concurrent same-version confirmations allow at most one formal write", async () => {
    const accepted = await createAccepted(userA.id, "TASK");
    const results = await Promise.allSettled([
      service.finalConfirm(userA.id, accepted.proposalId, {
        operationIds: [accepted.operationId],
        version: accepted.version,
      }),
      service.finalConfirm(userA.id, accepted.proposalId, {
        operationIds: [accepted.operationId],
        version: accepted.version,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(await prisma.task.count({ where: { userId: userA.id } })).toBe(1);
  });

  it("H04-I19: invalid DTO preflight creates no formal record", async () => {
    const created = await service.create(userA.id, key(), input("TASK"));
    const operation = created.proposal.operations[0]!;
    const edited = await service.editOperation(
      userA.id,
      created.proposal.id,
      operation.id,
      { fields: { title: "valid", unknownField: true }, version: 1 },
    );
    const accepted = await service.acceptOperation(
      userA.id,
      created.proposal.id,
      operation.id,
      { version: edited.version },
    );
    const before = await prisma.task.count({ where: { userId: userA.id } });
    await expect(
      service.finalConfirm(userA.id, created.proposal.id, {
        operationIds: [operation.id],
        version: accepted.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await prisma.task.count({ where: { userId: userA.id } })).toBe(
      before,
    );
  });

  it("H04-I20/I21: a Domain Service failure preserves earlier APPLIED work and leaves the failed operation ACCEPTED", async () => {
    const created = await service.create(userA.id, key(), input("TASK"));
    const first = created.proposal.operations[0]!;
    const second = await addOperation(created.proposal.id, 2, "TRANSACTION", {
      amount: "7.00",
      categoryId: "category_that_does_not_exist",
      currency: "CNY",
      type: "EXPENSE",
    });
    const acceptedFirst = await service.acceptOperation(
      userA.id,
      created.proposal.id,
      first.id,
      { version: 1 },
    );
    const acceptedSecond = await service.acceptOperation(
      userA.id,
      created.proposal.id,
      second.id,
      { version: acceptedFirst.version },
    );
    await expect(
      service.finalConfirm(userA.id, created.proposal.id, {
        operationIds: [first.id, second.id],
        version: acceptedSecond.version,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    const detail = await service.get(userA.id, created.proposal.id);
    expect(detail.status).toBe("PARTIALLY_APPLIED");
    expect(detail.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, status: "APPLIED" }),
        expect.objectContaining({ id: second.id, status: "ACCEPTED" }),
      ]),
    );
    expect(await prisma.task.count({ where: { userId: userA.id } })).toBe(1);
    expect(
      await prisma.transaction.count({ where: { userId: userA.id } }),
    ).toBe(0);
  });

  async function createUser(suffix: string) {
    sequence += 1;
    const username = `pr18_h04_${suffix}_${sequence}`;
    return prisma.user.create({
      data: {
        displayName: `PR18 H04 ${suffix}`,
        normalizedUsername: username,
        passwordHash: "test-only-not-a-real-password-hash",
        role: "USER",
        status: "ACTIVE",
        username,
      },
    });
  }

  async function createAccepted(
    userId: string,
    operationType: AiOperationType,
  ) {
    const created = await service.create(userId, key(), input(operationType));
    const operation = created.proposal.operations[0]!;
    const accepted = await service.acceptOperation(
      userId,
      created.proposal.id,
      operation.id,
      { version: created.proposal.version },
    );
    return {
      operationId: operation.id,
      proposalId: created.proposal.id,
      version: accepted.version,
    };
  }

  async function addOperation(
    proposalId: string,
    ordinal: number,
    operationType: AiOperationType,
    fields: Record<string, unknown>,
  ) {
    return prisma.aiOperation.create({
      data: {
        confidence: "0.9000",
        fieldsFingerprint: sha256Fingerprint(fields),
        fieldsJson: fields as Prisma.InputJsonObject,
        operationType,
        ordinal,
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

  async function resolveFormalRow(
    operationType: AiOperationType,
    entityId: string,
  ): Promise<{ userId: string } | null> {
    switch (operationType) {
      case "TRANSACTION":
        return prisma.transaction.findUnique({ where: { id: entityId } });
      case "CALENDAR_EVENT":
        return prisma.calendarEvent.findUnique({ where: { id: entityId } });
      case "TASK":
        return prisma.task.findUnique({ where: { id: entityId } });
      case "REMINDER":
        return prisma.reminder.findUnique({ where: { id: entityId } });
      case "TRIP":
        return prisma.trip.findUnique({ where: { id: entityId } });
      default:
        return null;
    }
  }

  function input(requestType: AiOperationType): AiProposalCreateRequest {
    return {
      allowedCategoryLabels: [],
      currency: "CNY",
      currentDateTime: "2099-01-01T00:00:00.000Z",
      explicitSelectedContext: [],
      locale: "zh-CN",
      requestType,
      timeZoneId: "Asia/Shanghai",
      userInput: `H04 ${requestType}`,
    };
  }

  function key(): string {
    sequence += 1;
    return `pr18-h04-key-${sequence.toString().padStart(8, "0")}`;
  }
});
