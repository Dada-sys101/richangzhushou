import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  AiOperationType,
  AiProposalCreateRequest,
} from "@daily-assistant/api-contracts";

import { AiFakeProviderFactory } from "../ai/ai-fake-provider.factory.js";
import { AiFeatureGate } from "../ai/ai-feature-gate.js";
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
      AiFeatureGate.forTesting({
        businessWrite: true,
        fakeProvider: true,
        proposal: true,
      }),
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

  it("H04-V01: one multi-operation FinalConfirm claims Proposal version exactly once", async () => {
    const created = await service.create(userA.id, key(), input("TASK"));
    const first = created.proposal.operations[0]!;
    const second = await addOperation(created.proposal.id, 2, "TASK", {
      title: "second task",
    });
    const acceptedFirst = await service.acceptOperation(
      userA.id,
      created.proposal.id,
      first.id,
      { version: created.proposal.version },
    );
    const acceptedSecond = await service.acceptOperation(
      userA.id,
      created.proposal.id,
      second.id,
      { version: acceptedFirst.version },
    );
    const initialVersion = acceptedSecond.version;

    const final = await service.finalConfirm(userA.id, created.proposal.id, {
      operationIds: [first.id, second.id],
      version: initialVersion,
    });

    expect(final.version).toBe(initialVersion + 1);
    expect(final.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, status: "APPLIED" }),
        expect.objectContaining({ id: second.id, status: "APPLIED" }),
      ]),
    );
    expect(
      (
        await prisma.aiProposal.findUniqueOrThrow({
          where: { id: created.proposal.id },
        })
      ).version,
    ).toBe(initialVersion + 1);
    expect(await prisma.task.count({ where: { userId: userA.id } })).toBe(2);
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

  it("H04-R02/I17: deterministic same-version confirmations allow one formal write", async () => {
    const accepted = await createAccepted(userA.id, "TASK");
    const db = prisma as unknown as PrismaService;
    const bothProposalLocks = deferred<void>();
    let proposalLockAttempts = 0;
    const observedDb = observeProposalLockPhase(db, () => {
      proposalLockAttempts += 1;
      if (proposalLockAttempts === 2) {
        bothProposalLocks.resolve();
      }
    });
    const raceService = createAiService(observedDb);
    const before = await formalCounts(userA.id);
    const lockHolder = await startProposalLockHolder(
      prisma,
      userA.id,
      accepted.proposalId,
    );

    try {
      const first = raceService.finalConfirm(userA.id, accepted.proposalId, {
        operationIds: [accepted.operationId],
        version: accepted.version,
      });
      const second = raceService.finalConfirm(userA.id, accepted.proposalId, {
        operationIds: [accepted.operationId],
        version: accepted.version,
      });
      await bothProposalLocks.promise;
      expect(proposalLockAttempts).toBe(2);
      lockHolder.release();

      const results = await Promise.allSettled([first, second]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      const winner = results.find((result) => result.status === "fulfilled");
      const loser = results.find((result) => result.status === "rejected");
      if (
        !winner ||
        winner.status !== "fulfilled" ||
        !loser ||
        loser.status !== "rejected"
      ) {
        throw new Error(
          "same-version race did not produce one winner and loser",
        );
      }
      expect(winner.value).toEqual(
        expect.objectContaining({
          operations: expect.arrayContaining([
            expect.objectContaining({
              id: accepted.operationId,
              resultEntityId: expect.any(String),
              status: "APPLIED",
            }),
          ]),
        }),
      );
      expect(allowedConcurrencyErrorCodes).toContain(errorCodeOf(loser.reason));

      const after = await formalCounts(userA.id);
      expect(after).toEqual({ ...before, tasks: before.tasks + 1 });
      const operation = await prisma.aiOperation.findUniqueOrThrow({
        where: { id: accepted.operationId },
      });
      expect(operation.status).toBe("APPLIED");
      expect(operation.resultEntityId).toBeTruthy();
    } finally {
      lockHolder.release();
      await lockHolder.transaction;
    }
  });

  it("H04-R01/V03-A: FinalConfirm wins against rejectOperation", async () => {
    const accepted = await createAccepted(userA.id, "TASK");
    const db = prisma as unknown as PrismaService;
    const finalProposalLock = deferred<void>();
    const rejectProposalLock = deferred<void>();
    let proposalLockAttempts = 0;
    const observedDb = observeProposalLockPhase(db, () => {
      proposalLockAttempts += 1;
      if (proposalLockAttempts === 1) {
        finalProposalLock.resolve();
      } else if (proposalLockAttempts === 2) {
        rejectProposalLock.resolve();
      }
    });
    const orchestrator = new AiFormalWriteOrchestrator(
      new FinanceService(observedDb),
      new CalendarService(observedDb),
      new TasksService(observedDb),
      new RemindersService(observedDb),
      new TripsService(observedDb),
    );
    const entered = deferred<void>();
    const release = deferred<void>();
    const originalApplyPrepared = orchestrator.applyPrepared.bind(orchestrator);
    orchestrator.applyPrepared = async (userId, prepared, tx) => {
      const result = await originalApplyPrepared(userId, prepared, tx);
      entered.resolve();
      await release.promise;
      return result;
    };
    const raceService = createAiService(observedDb, orchestrator);
    const rejectService = createAiService(observedDb);
    const before = await formalCounts(userA.id);
    const finalPromise = raceService.finalConfirm(
      userA.id,
      accepted.proposalId,
      { operationIds: [accepted.operationId], version: accepted.version },
    );
    await finalProposalLock.promise;
    await entered.promise;
    const rejectPromise = rejectService.rejectOperation(
      userA.id,
      accepted.proposalId,
      accepted.operationId,
      { version: accepted.version },
    );
    await rejectProposalLock.promise;
    expect(proposalLockAttempts).toBe(2);
    release.resolve();
    const [finalResult, rejectResult] = await Promise.allSettled([
      finalPromise,
      rejectPromise,
    ]);
    expect(finalResult.status).toBe("fulfilled");
    expect(rejectResult.status).toBe("rejected");
    if (rejectResult.status !== "rejected") {
      throw new Error("rejectOperation unexpectedly won the locked race");
    }
    expect(rejectResult.reason).toMatchObject({
      code: "AI_PROPOSAL_INVALID_STATE",
    });

    const operation = await prisma.aiOperation.findUniqueOrThrow({
      where: { id: accepted.operationId },
    });
    const proposal = await prisma.aiProposal.findUniqueOrThrow({
      where: { id: accepted.proposalId },
    });
    const after = await formalCounts(userA.id);
    expect(proposal.status).toBe("APPLIED");
    expect(operation.status).toBe("APPLIED");
    expect(operation.resultEntityId).toBeTruthy();
    expect(after).toEqual({ ...before, tasks: before.tasks + 1 });
  });

  it("H04-V02-TX-ROLLBACK: rollback after each real Domain Service write leaves no formal row", async () => {
    for (const operationType of [
      "TRANSACTION",
      "CALENDAR_EVENT",
      "TASK",
      "REMINDER",
      "TRIP",
    ] as const) {
      const accepted = await createAccepted(userA.id, operationType);
      const before = await formalCounts(userA.id);
      const failingService = createFailureAfterFormalService(
        prisma as unknown as PrismaService,
      );

      await expect(
        failingService.finalConfirm(userA.id, accepted.proposalId, {
          operationIds: [accepted.operationId],
          version: accepted.version,
        }),
      ).rejects.toThrow("failure after formal write");

      const after = await formalCounts(userA.id);
      const operation = await prisma.aiOperation.findUniqueOrThrow({
        where: { id: accepted.operationId },
      });
      expect(after, `${operationType} formal rows must roll back`).toEqual(
        before,
      );
      expect(operation).toMatchObject({
        resultEntityId: null,
        status: "ACCEPTED",
      });
    }
  });

  it("H04-V02-HELPER-FINANCE: Finance helper reads see uncommitted tx fixtures", async () => {
    const db = prisma as unknown as PrismaService;
    const finance = new FinanceService(db);
    const categoryMutationId = key();
    const accountMutationId = key();
    const tripMutationId = key();
    const transactionMutationId = key();

    await runRollbackProbe(prisma, async (tx) => {
      const category = await tx.category.create({
        data: {
          clientMutationId: categoryMutationId,
          kind: "EXPENSE",
          name: `H04 helper category ${sequence}`,
          userId: userA.id,
        },
      });
      const account = await tx.financialAccount.create({
        data: {
          clientMutationId: accountMutationId,
          kind: "CASH",
          name: `H04 helper account ${sequence}`,
          userId: userA.id,
        },
      });
      const trip = await tx.trip.create({
        data: {
          clientMutationId: tripMutationId,
          destination: "H04 helper destination",
          endDate: new Date("2099-01-02T00:00:00.000Z"),
          startDate: new Date("2099-01-01T00:00:00.000Z"),
          title: "H04 helper trip",
          userId: userA.id,
        },
      });
      const result = await finance.createTransaction(
        userA.id,
        {
          accountId: account.id,
          amount: "12.34",
          categoryId: category.id,
          clientMutationId: transactionMutationId,
          currency: "CNY",
          merchant: "H04 helper merchant",
          occurredAt: "2099-01-01T01:00:00.000Z",
          source: "TEXT",
          tripId: trip.id,
          type: "EXPENSE",
        },
        tx,
      );

      expect(result.transaction).toMatchObject({
        accountId: account.id,
        categoryId: category.id,
        tripId: trip.id,
      });
    });

    expect(
      await prisma.transaction.findUnique({
        where: { clientMutationId: transactionMutationId },
      }),
    ).toBeNull();
    expect(
      await prisma.category.findUnique({
        where: { clientMutationId: categoryMutationId },
      }),
    ).toBeNull();
    expect(
      await prisma.financialAccount.findUnique({
        where: { clientMutationId: accountMutationId },
      }),
    ).toBeNull();
    expect(
      await prisma.trip.findUnique({
        where: { clientMutationId: tripMutationId },
      }),
    ).toBeNull();
  });

  it("H04-V02-HELPER-FINANCE-IDEMPOTENCY: Finance replays an uncommitted transaction", async () => {
    const db = prisma as unknown as PrismaService;
    const finance = new FinanceService(db);
    const mutationId = key();
    const occurredAt = new Date("2099-01-03T01:00:00.000Z");
    const sourceFingerprint = "h04-finance-idempotency";

    await runRollbackProbe(prisma, async (tx) => {
      const fixture = await tx.transaction.create({
        data: {
          amount: "23.45",
          clientMutationId: mutationId,
          currency: "CNY",
          isUnlinkedRefund: false,
          merchant: "H04 finance replay",
          note: null,
          occurredAt,
          source: "TEXT",
          sourceFingerprint,
          type: "EXPENSE",
          userId: userA.id,
        },
      });
      const replay = await finance.createTransaction(
        userA.id,
        {
          amount: "23.45",
          clientMutationId: mutationId,
          currency: "CNY",
          merchant: "H04 finance replay",
          note: null,
          occurredAt: occurredAt.toISOString(),
          source: "TEXT",
          sourceFingerprint,
          type: "EXPENSE",
        },
        tx,
      );

      expect(replay.transaction.id).toBe(fixture.id);
    });

    expect(
      await prisma.transaction.findUnique({
        where: { clientMutationId: mutationId },
      }),
    ).toBeNull();
  });

  it("H04-V02-HELPER-CALENDAR: Calendar overlap helper sees an uncommitted event", async () => {
    const db = prisma as unknown as PrismaService;
    const calendar = new CalendarService(db);
    const overlapMutationId = key();
    const createdMutationId = key();
    const startsAt = new Date("2099-02-01T10:00:00.000Z");
    const endsAt = new Date("2099-02-01T11:00:00.000Z");

    await runRollbackProbe(prisma, async (tx) => {
      const overlap = await tx.calendarEvent.create({
        data: {
          clientMutationId: overlapMutationId,
          endsAt,
          startsAt,
          title: "H04 overlap fixture",
          userId: userA.id,
        },
      });
      const result = await calendar.create(
        userA.id,
        {
          clientMutationId: createdMutationId,
          endsAt: endsAt.toISOString(),
          startsAt: startsAt.toISOString(),
          title: "H04 overlapping event",
        },
        tx,
      );

      expect(result.overlapWarning).toMatchObject({
        code: "OVERLAP_WARNING",
        conflictingEventId: overlap.id,
      });
    });

    expect(
      await prisma.calendarEvent.findUnique({
        where: { clientMutationId: overlapMutationId },
      }),
    ).toBeNull();
    expect(
      await prisma.calendarEvent.findUnique({
        where: { clientMutationId: createdMutationId },
      }),
    ).toBeNull();
  });

  it("H04-V02-HELPER-CALENDAR-IDEMPOTENCY: Calendar replays an uncommitted event", async () => {
    const db = prisma as unknown as PrismaService;
    const calendar = new CalendarService(db);
    const mutationId = key();
    const startsAt = new Date("2099-02-02T10:00:00.000Z");
    const endsAt = new Date("2099-02-02T11:00:00.000Z");

    await runRollbackProbe(prisma, async (tx) => {
      const fixture = await tx.calendarEvent.create({
        data: {
          allDay: false,
          clientMutationId: mutationId,
          endsAt,
          startsAt,
          title: "H04 calendar replay",
          userId: userA.id,
        },
      });
      const replay = await calendar.create(
        userA.id,
        {
          allDay: false,
          clientMutationId: mutationId,
          endsAt: endsAt.toISOString(),
          startsAt: startsAt.toISOString(),
          title: "H04 calendar replay",
        },
        tx,
      );

      expect(replay.calendarEvent.id).toBe(fixture.id);
    });

    expect(
      await prisma.calendarEvent.findUnique({
        where: { clientMutationId: mutationId },
      }),
    ).toBeNull();
  });

  it("H04-V02-HELPER-TASKS: Tasks idempotency helper replays an uncommitted task", async () => {
    const db = prisma as unknown as PrismaService;
    const tasks = new TasksService(db);
    const mutationId = key();

    await runRollbackProbe(prisma, async (tx) => {
      const fixture = await tx.task.create({
        data: {
          clientMutationId: mutationId,
          title: "H04 task replay fixture",
          userId: userA.id,
        },
      });
      const replay = await tasks.create(
        userA.id,
        { clientMutationId: mutationId, title: fixture.title },
        tx,
      );

      expect(replay.id).toBe(fixture.id);
      expect(replay.title).toBe(fixture.title);
    });

    expect(
      await prisma.task.findUnique({ where: { clientMutationId: mutationId } }),
    ).toBeNull();
  });

  it("H04-V02-HELPER-REMINDERS: Reminder target validation sees an uncommitted task", async () => {
    const db = prisma as unknown as PrismaService;
    const reminders = new RemindersService(db);
    const targetMutationId = key();
    const reminderMutationId = key();

    await runRollbackProbe(prisma, async (tx) => {
      const target = await tx.task.create({
        data: {
          clientMutationId: targetMutationId,
          title: "H04 reminder target",
          userId: userA.id,
        },
      });
      const reminder = await reminders.create(
        userA.id,
        {
          clientMutationId: reminderMutationId,
          scheduleType: "ONCE",
          startsAt: "2099-03-01T10:00:00.000Z",
          targetId: target.id,
          targetType: "TASK",
          title: "H04 target reminder",
        },
        tx,
      );

      expect(reminder.targetId).toBe(target.id);
    });

    expect(
      await prisma.task.findUnique({
        where: { clientMutationId: targetMutationId },
      }),
    ).toBeNull();
    expect(
      await prisma.reminder.findUnique({
        where: { clientMutationId: reminderMutationId },
      }),
    ).toBeNull();
  });

  it("H04-V02-HELPER-REMINDERS-IDEMPOTENCY: Reminders replay an uncommitted reminder", async () => {
    const db = prisma as unknown as PrismaService;
    const reminders = new RemindersService(db);
    const mutationId = key();
    const startsAt = new Date("2099-03-02T10:00:00.000Z");

    await runRollbackProbe(prisma, async (tx) => {
      const fixture = await tx.reminder.create({
        data: {
          clientMutationId: mutationId,
          note: null,
          recurrenceJson: Prisma.DbNull,
          scheduleType: "ONCE",
          scheduledAt: startsAt,
          startsAt,
          targetId: null,
          targetType: "STANDALONE",
          title: "H04 reminder replay",
          userId: userA.id,
        },
      });
      const replay = await reminders.create(
        userA.id,
        {
          clientMutationId: mutationId,
          scheduleType: "ONCE",
          startsAt: startsAt.toISOString(),
          title: "H04 reminder replay",
        },
        tx,
      );

      expect(replay.id).toBe(fixture.id);
    });

    expect(
      await prisma.reminder.findUnique({
        where: { clientMutationId: mutationId },
      }),
    ).toBeNull();
  });

  it("H04-V02-HELPER-TRIPS: Trips idempotency helper replays an uncommitted trip", async () => {
    const db = prisma as unknown as PrismaService;
    const trips = new TripsService(db);
    const mutationId = key();

    await runRollbackProbe(prisma, async (tx) => {
      const fixture = await tx.trip.create({
        data: {
          clientMutationId: mutationId,
          destination: "H04 trip replay destination",
          endDate: new Date("2099-04-02T00:00:00.000Z"),
          startDate: new Date("2099-04-01T00:00:00.000Z"),
          title: "H04 trip replay fixture",
          userId: userA.id,
        },
      });
      const replay = await trips.create(
        userA.id,
        {
          clientMutationId: mutationId,
          destination: fixture.destination,
          endDate: "2099-04-02",
          startDate: "2099-04-01",
          title: fixture.title,
        },
        tx,
      );

      expect(replay.id).toBe(fixture.id);
      expect(replay.title).toBe(fixture.title);
    });

    expect(
      await prisma.trip.findUnique({ where: { clientMutationId: mutationId } }),
    ).toBeNull();
  });

  it("H04-V03-B: rejectOperation wins when FinalConfirm is held in Phase A", async () => {
    const accepted = await createAccepted(userA.id, "TASK");
    const db = prisma as unknown as PrismaService;
    const orchestrator = new AiFormalWriteOrchestrator(
      new FinanceService(db),
      new CalendarService(db),
      new TasksService(db),
      new RemindersService(db),
      new TripsService(db),
    );
    const entered = deferred<void>();
    const release = deferred<void>();
    const originalPrepare = orchestrator.prepare.bind(orchestrator);
    orchestrator.prepare = async (operationType, fields, clientMutationId) => {
      entered.resolve();
      await release.promise;
      return originalPrepare(operationType, fields, clientMutationId);
    };
    const finalService = new AiProposalService(
      db,
      new AiFakeProviderFactory(),
      orchestrator,
      AiFeatureGate.forTesting({
        businessWrite: true,
        fakeProvider: true,
        proposal: true,
      }),
    );
    const before = await formalCounts(userA.id);
    const finalPromise = finalService.finalConfirm(
      userA.id,
      accepted.proposalId,
      { operationIds: [accepted.operationId], version: accepted.version },
    );
    await entered.promise;

    let rejected;
    try {
      rejected = await service.rejectOperation(
        userA.id,
        accepted.proposalId,
        accepted.operationId,
        { version: accepted.version },
      );
    } finally {
      release.resolve();
    }
    const finalResult = await Promise.allSettled([finalPromise]);

    expect(rejected.status).toBe("REJECTED");
    expect(finalResult[0]?.status).toBe("rejected");
    if (finalResult[0]?.status !== "rejected") {
      throw new Error("FinalConfirm unexpectedly won the reject-wins race");
    }
    expect(finalResult[0].reason).toMatchObject({
      code: "AI_PROPOSAL_INVALID_STATE",
    });
    expect(await formalCounts(userA.id)).toEqual(before);
    expect(
      await prisma.aiOperation.findUniqueOrThrow({
        where: { id: accepted.operationId },
      }),
    ).toMatchObject({ resultEntityId: null, status: "REJECTED" });
  });

  it("H04-V03-C: FinalConfirm wins against rejectProposal", async () => {
    const accepted = await createAccepted(userA.id, "TASK");
    const db = prisma as unknown as PrismaService;
    const finalProposalLock = deferred<void>();
    const rejectProposalLock = deferred<void>();
    let proposalLockAttempts = 0;
    const observedDb = observeProposalLockPhase(db, () => {
      proposalLockAttempts += 1;
      if (proposalLockAttempts === 1) {
        finalProposalLock.resolve();
      } else if (proposalLockAttempts === 2) {
        rejectProposalLock.resolve();
      }
    });
    const orchestrator = new AiFormalWriteOrchestrator(
      new FinanceService(observedDb),
      new CalendarService(observedDb),
      new TasksService(observedDb),
      new RemindersService(observedDb),
      new TripsService(observedDb),
    );
    const entered = deferred<void>();
    const release = deferred<void>();
    const originalApplyPrepared = orchestrator.applyPrepared.bind(orchestrator);
    orchestrator.applyPrepared = async (userId, prepared, tx) => {
      const result = await originalApplyPrepared(userId, prepared, tx);
      entered.resolve();
      await release.promise;
      return result;
    };
    const finalService = createAiService(observedDb, orchestrator);
    const rejectService = createAiService(observedDb);
    const before = await formalCounts(userA.id);
    const finalPromise = finalService.finalConfirm(
      userA.id,
      accepted.proposalId,
      { operationIds: [accepted.operationId], version: accepted.version },
    );
    await finalProposalLock.promise;
    await entered.promise;
    const rejectPromise = rejectService.rejectProposal(
      userA.id,
      accepted.proposalId,
      { version: accepted.version },
    );
    await rejectProposalLock.promise;
    expect(proposalLockAttempts).toBe(2);
    release.resolve();
    const [finalResult, rejectResult] = await Promise.allSettled([
      finalPromise,
      rejectPromise,
    ]);

    expect(finalResult.status).toBe("fulfilled");
    expect(rejectResult.status).toBe("rejected");
    if (rejectResult.status !== "rejected") {
      throw new Error("rejectProposal unexpectedly won the locked race");
    }
    expect(rejectResult.reason).toMatchObject({
      code: "AI_PROPOSAL_INVALID_STATE",
    });
    const proposal = await prisma.aiProposal.findUniqueOrThrow({
      where: { id: accepted.proposalId },
    });
    const operation = await prisma.aiOperation.findUniqueOrThrow({
      where: { id: accepted.operationId },
    });
    expect(proposal.status).toBe("APPLIED");
    expect(operation.status).toBe("APPLIED");
    expect(operation.resultEntityId).toBeTruthy();
    expect(await formalCounts(userA.id)).toEqual({
      ...before,
      tasks: before.tasks + 1,
    });
  });

  it("H04-V03-D: rejectProposal wins when FinalConfirm is held in Phase A", async () => {
    const accepted = await createAccepted(userA.id, "TASK");
    const db = prisma as unknown as PrismaService;
    const orchestrator = new AiFormalWriteOrchestrator(
      new FinanceService(db),
      new CalendarService(db),
      new TasksService(db),
      new RemindersService(db),
      new TripsService(db),
    );
    const entered = deferred<void>();
    const release = deferred<void>();
    const originalPrepare = orchestrator.prepare.bind(orchestrator);
    orchestrator.prepare = async (operationType, fields, clientMutationId) => {
      entered.resolve();
      await release.promise;
      return originalPrepare(operationType, fields, clientMutationId);
    };
    const finalService = new AiProposalService(
      db,
      new AiFakeProviderFactory(),
      orchestrator,
      AiFeatureGate.forTesting({
        businessWrite: true,
        fakeProvider: true,
        proposal: true,
      }),
    );
    const before = await formalCounts(userA.id);
    const finalPromise = finalService.finalConfirm(
      userA.id,
      accepted.proposalId,
      { operationIds: [accepted.operationId], version: accepted.version },
    );
    await entered.promise;
    const rejected = await service.rejectProposal(
      userA.id,
      accepted.proposalId,
      { version: accepted.version },
    );
    release.resolve();
    const finalResult = await Promise.allSettled([finalPromise]);

    expect(rejected.status).toBe("REJECTED");
    expect(finalResult[0]?.status).toBe("rejected");
    if (finalResult[0]?.status !== "rejected") {
      throw new Error("FinalConfirm unexpectedly won the rejectProposal race");
    }
    expect(finalResult[0].reason).toMatchObject({
      code: "AI_PROPOSAL_INVALID_STATE",
    });
    expect(await formalCounts(userA.id)).toEqual(before);
    expect(
      await prisma.aiProposal.findUniqueOrThrow({
        where: { id: accepted.proposalId },
      }),
    ).toMatchObject({ status: "REJECTED" });
    expect(
      await prisma.aiOperation.findUniqueOrThrow({
        where: { id: accepted.operationId },
      }),
    ).toMatchObject({ resultEntityId: null, status: "REJECTED" });
  });

  it("H04-state-regression: editOperation remains invalid for an accepted operation", async () => {
    const accepted = await createAccepted(userA.id, "TASK");
    const before = await service.get(userA.id, accepted.proposalId);
    const originalFields = before.operations[0]!.fields;
    const db = prisma as unknown as PrismaService;
    const orchestrator = new AiFormalWriteOrchestrator(
      new FinanceService(db),
      new CalendarService(db),
      new TasksService(db),
      new RemindersService(db),
      new TripsService(db),
    );
    const entered = deferred<void>();
    const release = deferred<void>();
    const originalApplyPrepared = orchestrator.applyPrepared.bind(orchestrator);
    orchestrator.applyPrepared = async (userId, prepared, tx) => {
      const result = await originalApplyPrepared(userId, prepared, tx);
      entered.resolve();
      await release.promise;
      return result;
    };
    const finalService = new AiProposalService(
      db,
      new AiFakeProviderFactory(),
      orchestrator,
      AiFeatureGate.forTesting({
        businessWrite: true,
        fakeProvider: true,
        proposal: true,
      }),
    );
    const finalPromise = finalService.finalConfirm(
      userA.id,
      accepted.proposalId,
      { operationIds: [accepted.operationId], version: accepted.version },
    );
    await entered.promise;
    const editPromise = service.editOperation(
      userA.id,
      accepted.proposalId,
      accepted.operationId,
      { fields: { title: "stale edit" }, version: accepted.version },
    );
    release.resolve();
    const [finalResult, editResult] = await Promise.allSettled([
      finalPromise,
      editPromise,
    ]);

    expect(finalResult.status).toBe("fulfilled");
    expect(editResult.status).toBe("rejected");
    if (editResult.status !== "rejected") {
      throw new Error("editOperation unexpectedly won the locked race");
    }
    expect(editResult.reason).toMatchObject({
      code: "AI_PROPOSAL_INVALID_STATE",
    });
    const detail = await service.get(userA.id, accepted.proposalId);
    expect(detail.operations[0]).toMatchObject({ status: "APPLIED" });
    expect(detail.operations[0]?.fields).toEqual(originalFields);
    expect(await prisma.task.count({ where: { userId: userA.id } })).toBe(1);
  });

  it("H04-state-regression: FinalConfirm cannot confirm a pending operation", async () => {
    const created = await service.create(userA.id, key(), input("TASK"));
    const operation = created.proposal.operations[0]!;
    const start = deferred<void>();
    const finalPromise = (async () => {
      await start.promise;
      return service.finalConfirm(userA.id, created.proposal.id, {
        operationIds: [operation.id],
        version: created.proposal.version,
      });
    })();
    const acceptPromise = (async () => {
      await start.promise;
      return service.acceptOperation(
        userA.id,
        created.proposal.id,
        operation.id,
        { version: created.proposal.version },
      );
    })();
    start.resolve();
    const [finalResult, acceptResult] = await Promise.allSettled([
      finalPromise,
      acceptPromise,
    ]);

    expect(acceptResult.status).toBe("fulfilled");
    const detail = await service.get(userA.id, created.proposal.id);
    const finalOperation = detail.operations[0]!;
    const formalCount = await prisma.task.count({
      where: { userId: userA.id },
    });
    expect(["ACCEPTED", "APPLIED"]).toContain(finalOperation.status);
    if (finalOperation.status === "APPLIED") {
      expect(formalCount).toBe(1);
      expect(finalResult.status).toBe("fulfilled");
    } else {
      expect(formalCount).toBe(0);
      expect(finalResult.status).toBe("rejected");
    }
  });

  it("H04-R03: failure after the formal call rolls back the formal row and AI state", async () => {
    const accepted = await createAccepted(userA.id, "TASK");
    const db = prisma as unknown as PrismaService;
    const failureService = createFailureAfterFormalService(db);
    const before = await prisma.task.count({ where: { userId: userA.id } });
    await expect(
      failureService.finalConfirm(userA.id, accepted.proposalId, {
        operationIds: [accepted.operationId],
        version: accepted.version,
      }),
    ).rejects.toThrow("failure after formal write");
    const operation = await prisma.aiOperation.findUniqueOrThrow({
      where: { id: accepted.operationId },
    });
    const proposal = await prisma.aiProposal.findUniqueOrThrow({
      where: { id: accepted.proposalId },
    });
    const after = await prisma.task.count({ where: { userId: userA.id } });
    expect(after).toBe(before);
    expect(operation.status).toBe("ACCEPTED");
    expect(operation.resultEntityId).toBeNull();
    expect(proposal.status).toBe("PENDING_REVIEW");
    expect(proposal.version).toBe(2);
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

const allowedConcurrencyErrorCodes = [
  "VERSION_CONFLICT",
  "AI_OPERATION_INVALID_STATE",
  "AI_PROPOSAL_INVALID_STATE",
] as const;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function runRollbackProbe(
  prisma: PrismaClient,
  probe: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  await expect(
    prisma.$transaction(async (tx) => {
      await probe(tx);
      throw new Error("H04 helper visibility rollback");
    }),
  ).rejects.toThrow("H04 helper visibility rollback");
}

function createAiOrchestrator(db: PrismaService): AiFormalWriteOrchestrator {
  return new AiFormalWriteOrchestrator(
    new FinanceService(db),
    new CalendarService(db),
    new TasksService(db),
    new RemindersService(db),
    new TripsService(db),
  );
}

function createAiService(
  db: PrismaService,
  orchestrator = createAiOrchestrator(db),
): AiProposalService {
  return new AiProposalService(
    db,
    new AiFakeProviderFactory(),
    orchestrator,
    AiFeatureGate.forTesting({
      businessWrite: true,
      fakeProvider: true,
      proposal: true,
    }),
  );
}

async function startProposalLockHolder(
  prisma: PrismaClient,
  userId: string,
  proposalId: string,
): Promise<{
  release: ReturnType<typeof deferred<void>>["resolve"];
  transaction: Promise<void>;
}> {
  const acquired = deferred<void>();
  const release = deferred<void>();
  const transaction = prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT \`id\`
      FROM \`ai_proposals\`
      WHERE \`id\` = ${proposalId} AND \`user_id\` = ${userId}
      FOR UPDATE
    `;
    expect(rows).toHaveLength(1);
    acquired.resolve();
    await release.promise;
  });
  await acquired.promise;
  return { release: release.resolve, transaction };
}

function observeProposalLockPhase(
  db: PrismaService,
  onProposalLockAttempt: () => void,
): PrismaService {
  const target = db as unknown as object;
  return new Proxy(target, {
    get(rawTarget, property) {
      if (property !== "$transaction") {
        return Reflect.get(rawTarget, property, rawTarget);
      }
      const transaction = Reflect.get(rawTarget, property, rawTarget) as (
        ...args: unknown[]
      ) => unknown;
      return (callbackOrBatch: unknown, ...rest: unknown[]) => {
        if (typeof callbackOrBatch !== "function") {
          return transaction.apply(rawTarget, [callbackOrBatch, ...rest]);
        }
        const callback = callbackOrBatch as (
          tx: Prisma.TransactionClient,
        ) => Promise<unknown>;
        return transaction.apply(rawTarget, [
          (tx: Prisma.TransactionClient) =>
            callback(observeTransactionClient(tx, onProposalLockAttempt)),
          ...rest,
        ]);
      };
    },
  }) as unknown as PrismaService;
}

function observeTransactionClient(
  tx: Prisma.TransactionClient,
  onProposalLockAttempt: () => void,
): Prisma.TransactionClient {
  const target = tx as unknown as object;
  return new Proxy(target, {
    get(rawTarget, property) {
      if (property !== "$queryRaw") {
        return Reflect.get(rawTarget, property, rawTarget);
      }
      const queryRaw = Reflect.get(rawTarget, property, rawTarget) as (
        ...args: unknown[]
      ) => unknown;
      return (...args: unknown[]) => {
        if (isProposalLockQuery(args[0])) {
          onProposalLockAttempt();
        }
        return queryRaw.apply(rawTarget, args);
      };
    },
  }) as unknown as Prisma.TransactionClient;
}

function isProposalLockQuery(template: unknown): boolean {
  if (!Array.isArray(template)) {
    return false;
  }
  const sql = template.join(" ").replace(/\s+/g, " ").toLowerCase();
  return sql.includes("ai_proposals") && sql.includes("for update");
}

function errorCodeOf(reason: unknown): string | null {
  if (typeof reason !== "object" || reason === null) {
    return null;
  }
  const code = (reason as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function createFailureAfterFormalService(db: PrismaService): AiProposalService {
  const orchestrator = new AiFormalWriteOrchestrator(
    new FinanceService(db),
    new CalendarService(db),
    new TasksService(db),
    new RemindersService(db),
    new TripsService(db),
  );
  const originalApplyPrepared = orchestrator.applyPrepared.bind(orchestrator);
  orchestrator.applyPrepared = async (userId, prepared, tx) => {
    await originalApplyPrepared(userId, prepared, tx);
    throw new Error("failure after formal write");
  };
  return new AiProposalService(
    db,
    new AiFakeProviderFactory(),
    orchestrator,
    AiFeatureGate.forTesting({
      businessWrite: true,
      fakeProvider: true,
      proposal: true,
    }),
  );
}
