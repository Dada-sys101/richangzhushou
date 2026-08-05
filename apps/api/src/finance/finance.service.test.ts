import { describe, expect, it, vi } from "vitest";

import type { Transaction } from "../generated/prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { FinanceService } from "./finance.service.js";
import { toDecimal } from "./money.util.js";

function createService(prisma: unknown): FinanceService {
  return new FinanceService(prisma as PrismaService);
}

function transactionRow(overrides: Partial<Transaction> = {}): Transaction {
  return {
    accountId: null,
    amount: toDecimal("10.00"),
    categoryId: null,
    clientMutationId: null,
    createdAt: new Date("2026-08-05T01:00:00.000Z"),
    currency: "CNY",
    deletedAt: null,
    id: "tx_1",
    isUnlinkedRefund: false,
    merchant: null,
    note: null,
    occurredAt: new Date("2026-08-05T01:00:00.000Z"),
    originalTransactionId: null,
    source: "MANUAL",
    sourceFingerprint: null,
    status: "CONFIRMED",
    type: "EXPENSE",
    updatedAt: new Date("2026-08-05T01:00:00.000Z"),
    userId: "user_1",
    version: 1,
    ...overrides,
  } as Transaction;
}

describe("FinanceService business rules", () => {
  it("QA-FIN-002: rejects a refund without an original or unlinked marker", async () => {
    const prisma = {
      transaction: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(
      service.createTransaction("user_1", {
        amount: "10.00",
        type: "REFUND",
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("rejects a zero amount before any write", async () => {
    const prisma = {
      transaction: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(
      service.createTransaction("user_1", {
        amount: "0.00",
        type: "EXPENSE",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("QA-FIN-004: returns a duplicate warning instead of deleting", async () => {
    const existing = transactionRow({
      id: "tx_previous",
      merchant: "星巴克",
      occurredAt: new Date("2026-08-05T01:00:00.000Z"),
    });
    const created = transactionRow({ id: "tx_new" });
    const prisma = {
      transaction: {
        create: vi.fn().mockResolvedValue(created),
        findFirst: vi.fn().mockResolvedValue(existing),
      },
    };
    const service = createService(prisma);

    const result = await service.createTransaction("user_1", {
      amount: "10.00",
      merchant: "星巴克",
      occurredAt: "2026-08-05T01:05:00.000Z",
      type: "EXPENSE",
    });

    expect(result.duplicateWarning?.code).toBe("POSSIBLE_DUPLICATE");
    expect(result.duplicateWarning?.matchedTransactionId).toBe("tx_previous");
  });

  it("rejects an idempotency replay with different content", async () => {
    const existing = transactionRow({ amount: toDecimal("10.00") });
    const prisma = {
      transaction: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(existing),
      },
    };
    const service = createService(prisma);

    await expect(
      service.createTransaction("user_1", {
        amount: "99.00",
        clientMutationId: "mutation-key-12345678",
        type: "EXPENSE",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("replays an identical idempotent request", async () => {
    const existing = transactionRow({
      amount: toDecimal("10.00"),
      clientMutationId: "mutation-key-12345678",
    });
    const prisma = {
      transaction: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(existing),
      },
    };
    const service = createService(prisma);

    const result = await service.createTransaction("user_1", {
      amount: "10.00",
      clientMutationId: "mutation-key-12345678",
      occurredAt: "2026-08-05T01:00:00.000Z",
      type: "EXPENSE",
    });
    expect(result.transaction.id).toBe("tx_1");
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("returns VERSION_CONFLICT when updating a stale transaction", async () => {
    const current = transactionRow({ id: "tx_1", version: 1 });
    const prisma = {
      transaction: {
        findFirst: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(
      service.updateTransaction("user_1", "tx_1", { version: 2 }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });
});
