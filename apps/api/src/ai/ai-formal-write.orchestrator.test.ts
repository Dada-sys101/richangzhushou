import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { AiFormalWriteOrchestrator } from "./ai-formal-write.orchestrator.js";

function createOrchestrator() {
  const financeService = {
    createTransaction: vi.fn().mockResolvedValue({
      transaction: { id: "transaction_1" },
    }),
  };
  const calendarService = {
    create: vi.fn().mockResolvedValue({
      calendarEvent: { id: "calendar_1" },
    }),
  };
  const tasksService = {
    create: vi.fn().mockResolvedValue({ id: "task_1" }),
  };
  const remindersService = {
    create: vi.fn().mockResolvedValue({ id: "reminder_1" }),
  };
  const tripsService = {
    create: vi.fn().mockResolvedValue({ id: "trip_1" }),
  };
  const orchestrator = new AiFormalWriteOrchestrator(
    financeService as never,
    calendarService as never,
    tasksService as never,
    remindersService as never,
    tripsService as never,
  );
  return {
    calendarService,
    financeService,
    orchestrator,
    remindersService,
    tasksService,
    tripsService,
  };
}

describe("PR18 H04 formal write orchestrator", () => {
  it("H04-U01: uses a deterministic server mutation key", async () => {
    const { financeService, orchestrator } = createOrchestrator();
    await orchestrator.apply(
      "user_1",
      "TRANSACTION",
      { amount: "38.50", type: "EXPENSE" },
      "ai-final:proposal_1:operation_1",
    );
    expect(financeService.createTransaction).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        clientMutationId: "ai-final:proposal_1:operation_1",
        source: "TEXT",
      }),
    );
  });

  it("H04-U02/U03d: rejects provider-owned mutation and fingerprint fields", async () => {
    const { financeService, orchestrator } = createOrchestrator();
    await expect(
      orchestrator.apply(
        "user_1",
        "TASK",
        { clientMutationId: "provider-key", title: "task" },
        "ai-final:proposal_1:operation_1",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    await expect(
      orchestrator.apply(
        "user_1",
        "TRANSACTION",
        {
          amount: "38.50",
          sourceFingerprint: "fingerprint",
          type: "EXPENSE",
        },
        "ai-final:proposal_1:operation_2",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    expect(financeService.createTransaction).not.toHaveBeenCalled();
  });

  it("H04-U03a/U03b/U03c/U03e: treats TEXT as server-owned source", async () => {
    const { financeService, orchestrator } = createOrchestrator();
    await orchestrator.apply(
      "user_1",
      "TRANSACTION",
      { amount: "38.50", source: "TEXT", type: "EXPENSE" },
      "ai-final:proposal_1:operation_1",
    );
    await orchestrator.apply(
      "user_1",
      "TRANSACTION",
      { amount: "39.50", type: "EXPENSE" },
      "ai-final:proposal_1:operation_2",
    );
    expect(financeService.createTransaction).toHaveBeenNthCalledWith(
      1,
      "user_1",
      expect.objectContaining({ source: "TEXT" }),
    );
    expect(financeService.createTransaction).toHaveBeenNthCalledWith(
      2,
      "user_1",
      expect.objectContaining({ source: "TEXT" }),
    );
    await expect(
      orchestrator.apply(
        "user_1",
        "TRANSACTION",
        { amount: "40.50", source: "MANUAL", type: "EXPENSE" },
        "ai-final:proposal_1:operation_3",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    expect(financeService.createTransaction).toHaveBeenCalledTimes(2);
  });

  it("H04-U04/U07: maps every operation type and normalizes result IDs", async () => {
    const harness = createOrchestrator();
    const cases = [
      ["TRANSACTION", { amount: "1.00", type: "EXPENSE" }, "transaction_1"],
      [
        "CALENDAR_EVENT",
        {
          endsAt: "2026-08-16T01:00:00.000Z",
          startsAt: "2026-08-16T00:00:00.000Z",
          title: "event",
        },
        "calendar_1",
      ],
      ["TASK", { title: "task" }, "task_1"],
      [
        "REMINDER",
        {
          scheduleType: "ONCE",
          startsAt: "2099-08-16T00:00:00.000Z",
          title: "reminder",
        },
        "reminder_1",
      ],
      [
        "TRIP",
        {
          destination: "Shanghai",
          endDate: "2099-08-18",
          startDate: "2099-08-16",
          title: "trip",
        },
        "trip_1",
      ],
    ] as const;
    for (const [operationType, fields, resultEntityId] of cases) {
      await expect(
        harness.orchestrator.apply(
          "user_1",
          operationType,
          fields,
          `ai-final:proposal_1:${operationType.toLowerCase()}`,
        ),
      ).resolves.toMatchObject({
        resultEntityId,
        resultEntityType: operationType,
      });
    }
    expect(harness.financeService.createTransaction).toHaveBeenCalledTimes(1);
    expect(harness.calendarService.create).toHaveBeenCalledTimes(1);
    expect(harness.tasksService.create).toHaveBeenCalledTimes(1);
    expect(harness.remindersService.create).toHaveBeenCalledTimes(1);
    expect(harness.tripsService.create).toHaveBeenCalledTimes(1);
  });

  it("H04-R04: propagates one TransactionClient to every formal create path", async () => {
    const harness = createOrchestrator();
    const tx = { marker: "same-transaction" };
    await harness.orchestrator.applyPrepared(
      "user_1",
      {
        dto: { amount: "1.00", type: "EXPENSE" },
        operationType: "TRANSACTION",
      } as never,
      tx as never,
    );
    await harness.orchestrator.applyPrepared(
      "user_1",
      {
        dto: {
          endsAt: "2026-08-16T01:00:00.000Z",
          startsAt: "2026-08-16T00:00:00.000Z",
          title: "event",
        },
        operationType: "CALENDAR_EVENT",
      } as never,
      tx as never,
    );
    await harness.orchestrator.applyPrepared(
      "user_1",
      { dto: { title: "task" }, operationType: "TASK" } as never,
      tx as never,
    );
    await harness.orchestrator.applyPrepared(
      "user_1",
      {
        dto: {
          scheduleType: "ONCE",
          startsAt: "2099-08-16T00:00:00.000Z",
          title: "reminder",
        },
        operationType: "REMINDER",
      } as never,
      tx as never,
    );
    await harness.orchestrator.applyPrepared(
      "user_1",
      {
        dto: {
          destination: "Shanghai",
          endDate: "2099-08-18",
          startDate: "2099-08-16",
          title: "trip",
        },
        operationType: "TRIP",
      } as never,
      tx as never,
    );

    expect(harness.financeService.createTransaction).toHaveBeenCalledWith(
      "user_1",
      expect.anything(),
      tx,
    );
    expect(harness.calendarService.create).toHaveBeenCalledWith(
      "user_1",
      expect.anything(),
      tx,
    );
    expect(harness.tasksService.create).toHaveBeenCalledWith(
      "user_1",
      expect.anything(),
      tx,
    );
    expect(harness.remindersService.create).toHaveBeenCalledWith(
      "user_1",
      expect.anything(),
      tx,
    );
    expect(harness.tripsService.create).toHaveBeenCalledWith(
      "user_1",
      expect.anything(),
      tx,
    );
  });

  it("H04-U05/U06: validates existing DTOs before invoking a Domain Service", async () => {
    const { tasksService, orchestrator } = createOrchestrator();
    await expect(
      orchestrator.apply(
        "user_1",
        "TASK",
        { title: "valid", unknownField: true },
        "ai-final:proposal_1:operation_1",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    await expect(
      orchestrator.apply(
        "user_1",
        "TASK",
        { title: "" },
        "ai-final:proposal_1:operation_2",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    expect(tasksService.create).not.toHaveBeenCalled();
  });
});
