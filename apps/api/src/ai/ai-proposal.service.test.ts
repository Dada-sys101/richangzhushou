import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { AiOperationType } from "@daily-assistant/api-contracts";

import { AiFakeProviderFactory } from "./ai-fake-provider.factory.js";
import { AiFeatureGate } from "./ai-feature-gate.js";
import { sha256Fingerprint } from "./ai-proposal.fingerprint.js";
import { AiProposalService } from "./ai-proposal.service.js";

describe("PR18 H04 proposal final confirmation", () => {
  it("H04-U08: replays an APPLIED operation without a write or version increment", async () => {
    const harness = buildHarness({
      proposalStatus: "APPLIED",
      operationStatus: "APPLIED",
    });
    const result = await harness.service.finalConfirm("user_1", "proposal_1", {
      operationIds: ["operation_1"],
      version: 1,
    });
    expect(result.status).toBe("APPLIED");
    expect(harness.orchestrator.applyPrepared).not.toHaveBeenCalled();
    expect(harness.prisma.aiProposal.updateMany).not.toHaveBeenCalled();
  });

  it("H04-F04: APPLIED replay remains readable when businessWrite is disabled", async () => {
    const harness = buildHarness({
      featureFlags: {
        businessWrite: false,
        fakeProvider: false,
        proposal: true,
      },
      operationStatus: "APPLIED",
      proposalStatus: "APPLIED",
    });
    await expect(
      harness.service.finalConfirm("user_1", "proposal_1", {
        operationIds: ["operation_1"],
        version: 1,
      }),
    ).resolves.toMatchObject({ status: "APPLIED" });
    expect(harness.orchestrator.applyPrepared).not.toHaveBeenCalled();
  });

  it("H04-F03: a new formal write is blocked when businessWrite is disabled", async () => {
    const harness = buildHarness({
      featureFlags: {
        businessWrite: false,
        fakeProvider: true,
        proposal: true,
      },
      operationStatus: "ACCEPTED",
    });
    await expect(
      harness.service.finalConfirm("user_1", "proposal_1", {
        operationIds: ["operation_1"],
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "AI_DISABLED", statusCode: 403 });
    expect(harness.orchestrator.applyPrepared).not.toHaveBeenCalled();
  });

  it("H04-F01: FinalConfirm is blocked before Proposal lookup when proposal is disabled", async () => {
    const harness = buildHarness({
      featureFlags: {
        businessWrite: true,
        fakeProvider: true,
        proposal: false,
      },
      operationStatus: "ACCEPTED",
    });
    await expect(
      harness.service.finalConfirm("user_1", "proposal_1", {
        operationIds: ["operation_1"],
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "AI_DISABLED", statusCode: 403 });
    expect(harness.prisma.aiProposal.findFirst).not.toHaveBeenCalled();
  });

  it("H04-U09/U10: rejects PENDING and REJECTED operations before a write", async () => {
    for (const operationStatus of ["PENDING", "REJECTED"] as const) {
      const harness = buildHarness({ operationStatus });
      await expect(
        harness.service.finalConfirm("user_1", "proposal_1", {
          operationIds: ["operation_1"],
          version: 1,
        }),
      ).rejects.toMatchObject({ code: "AI_OPERATION_INVALID_STATE" });
      expect(harness.orchestrator.applyPrepared).not.toHaveBeenCalled();
    }
  });

  it("H04-U11: hides a foreign operation ID behind the proposal not-found boundary", async () => {
    const harness = buildHarness({ operationStatus: "ACCEPTED" });
    await expect(
      harness.service.finalConfirm("user_1", "proposal_1", {
        operationIds: ["operation_from_elsewhere"],
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "AI_PROPOSAL_NOT_FOUND", statusCode: 404 });
    expect(harness.orchestrator.applyPrepared).not.toHaveBeenCalled();
  });

  it("H04-U12: rejects a stale version before claiming or writing", async () => {
    const harness = buildHarness({ operationStatus: "ACCEPTED", version: 2 });
    await expect(
      harness.service.finalConfirm("user_1", "proposal_1", {
        operationIds: ["operation_1"],
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(harness.orchestrator.applyPrepared).not.toHaveBeenCalled();
    expect(harness.prisma.aiProposal.updateMany).not.toHaveBeenCalled();
  });

  it("H04-U13/U16: applies an accepted scope and settles the Proposal", async () => {
    const harness = buildHarness({ operationStatus: "ACCEPTED" });
    const result = await harness.service.finalConfirm("user_1", "proposal_1", {
      operationIds: ["operation_1"],
      version: 1,
    });
    expect(result).toMatchObject({ status: "APPLIED", version: 2 });
    expect(harness.operation).toMatchObject({
      resultEntityId: "task_1",
      resultEntityType: "TASK",
      status: "APPLIED",
    });
    expect(harness.orchestrator.prepare).toHaveBeenCalledWith(
      "TASK",
      { title: "task" },
      "ai-final:proposal_1:operation_1",
    );
    expect(harness.orchestrator.applyPrepared).toHaveBeenCalledTimes(1);
  });

  it("H04-U14/U15/U17: preserves earlier APPLIED work and leaves a failed operation ACCEPTED", async () => {
    const harness = buildHarness({
      operationStatus: "ACCEPTED",
      secondOperation: { operationType: "TRANSACTION", status: "ACCEPTED" },
    });
    harness.orchestrator.applyPrepared
      .mockResolvedValueOnce({
        resultEntityId: "task_1",
        resultEntityType: "TASK",
      })
      .mockRejectedValueOnce(new Error("domain failure"));

    await expect(
      harness.service.finalConfirm("user_1", "proposal_1", {
        operationIds: ["operation_1", "operation_2"],
        version: 1,
      }),
    ).rejects.toThrow("domain failure");
    expect(harness.operations).toMatchObject([
      { status: "APPLIED" },
      { status: "ACCEPTED" },
    ]);
    expect(harness.proposal.status).toBe("PARTIALLY_APPLIED");
  });

  it("H04-U05/H04-U18: validates the entire scope before the first formal call", async () => {
    const harness = buildHarness({
      operationStatus: "ACCEPTED",
      secondOperation: { operationType: "TASK", status: "ACCEPTED" },
    });
    harness.orchestrator.prepare.mockResolvedValueOnce({
      dto: {},
      operationType: "TASK",
    });
    harness.orchestrator.prepare.mockRejectedValueOnce(
      Object.assign(new Error("invalid DTO"), { code: "VALIDATION_ERROR" }),
    );
    await expect(
      harness.service.finalConfirm("user_1", "proposal_1", {
        operationIds: ["operation_1", "operation_2"],
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(harness.orchestrator.applyPrepared).not.toHaveBeenCalled();
    expect(harness.prisma.aiProposal.updateMany).not.toHaveBeenCalled();
  });

  it("H04-U18: FinalConfirm is separate from Accept and never calls review mutations", async () => {
    const harness = buildHarness({ operationStatus: "ACCEPTED" });
    await harness.service.finalConfirm("user_1", "proposal_1", {
      operationIds: ["operation_1"],
      version: 1,
    });
    expect(harness.orchestrator.applyPrepared).toHaveBeenCalledTimes(1);
  });

  it("H04-U16: mixed APPLIED + REJECTED settles the Proposal as APPLIED", async () => {
    // Operation A is ACCEPTED and gets confirmed now; Operation B was already
    // REJECTED. After applying A the Proposal contains exactly APPLIED and
    // REJECTED operations, so reconciliation settles it to APPLIED with a
    // non-null completedAt and performs no new Domain Service write for the
    // already-applied scope.
    const harness = buildHarness({
      operationStatus: "ACCEPTED",
      secondOperation: { operationType: "TRANSACTION", status: "REJECTED" },
    });

    const result = await harness.service.finalConfirm("user_1", "proposal_1", {
      operationIds: ["operation_1"],
      version: 1,
    });

    expect(result.status).toBe("APPLIED");
    expect(result.completedAt).not.toBeNull();
    expect(harness.proposal.status).toBe("APPLIED");
    expect(harness.proposal.completedAt).not.toBeNull();
    expect(harness.operations).toMatchObject([
      { id: "operation_1", status: "APPLIED" },
      { id: "operation_2", status: "REJECTED" },
    ]);
    // Only Operation A (ACCEPTED) crossed the formal boundary; the already
    // applied/rejected scope must not trigger another Domain Service write.
    expect(harness.orchestrator.applyPrepared).toHaveBeenCalledTimes(1);
    expect(harness.orchestrator.prepare).toHaveBeenCalledTimes(1);
  });
});

type OperationStatus = "ACCEPTED" | "APPLIED" | "PENDING" | "REJECTED";

interface HarnessOptions {
  featureFlags?: {
    businessWrite: boolean;
    fakeProvider: boolean;
    proposal: boolean;
  };
  operationStatus: OperationStatus;
  proposalStatus?: "PENDING_REVIEW" | "PARTIALLY_APPLIED" | "APPLIED";
  secondOperation?: { operationType: AiOperationType; status: OperationStatus };
  version?: number;
}

function buildHarness(options: HarnessOptions) {
  const now = new Date("2026-08-15T01:00:00.000Z");
  const operations = [
    buildOperation("operation_1", 1, "TASK", options.operationStatus, now),
  ];
  if (options.secondOperation) {
    operations.push(
      buildOperation(
        "operation_2",
        2,
        options.secondOperation.operationType,
        options.secondOperation.status,
        now,
      ),
    );
  }
  const proposal = {
    aiRequestId: "request_1",
    completedAt: null,
    createdAt: now,
    expiresAt: null,
    id: "proposal_1",
    modelId: "fake-model",
    operations,
    providerId: "fake-provider",
    reviewedAt: null,
    schemaVersion: 1,
    status: options.proposalStatus ?? "PENDING_REVIEW",
    updatedAt: now,
    userId: "user_1",
    version: options.version ?? 1,
  } as Record<string, unknown> & {
    operations: Array<
      Record<string, unknown> & { id: string; ordinal: number; status: string }
    >;
    status: string;
    version: number;
  };
  const orchestrator = {
    applyPrepared: vi.fn().mockResolvedValue({
      resultEntityId: "task_1",
      resultEntityType: "TASK",
    }),
    prepare: vi.fn().mockResolvedValue({
      dto: { title: "task" },
      operationType: "TASK",
    }),
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    ),
    $queryRaw: vi.fn(async () => [{ id: "locked" }]),
    aiOperation: {
      findMany: vi.fn(async () =>
        proposal.operations.map((operation) => ({ status: operation.status })),
      ),
      updateMany: vi.fn(
        async ({
          data,
          where,
        }: {
          data: Record<string, unknown>;
          where: Record<string, unknown>;
        }) => {
          const operation = proposal.operations.find(
            (candidate) => candidate.id === where.id,
          );
          if (!operation || operation.status !== where.status) {
            return { count: 0 };
          }
          Object.assign(operation, data);
          return { count: 1 };
        },
      ),
    },
    aiProposal: {
      findFirst: vi.fn(
        async (args: {
          include?: { operations?: { where?: { id?: string } } };
        }) => {
          const operationId = args.include?.operations?.where?.id;
          return operationId
            ? {
                ...proposal,
                operations: proposal.operations.filter(
                  (operation) => operation.id === operationId,
                ),
              }
            : proposal;
        },
      ),
      updateMany: vi.fn(
        async ({
          data,
          where,
        }: {
          data: Record<string, unknown>;
          where: Record<string, unknown>;
        }) => {
          if (
            where.version !== undefined &&
            where.version !== proposal.version
          ) {
            return { count: 0 };
          }
          if (
            where.status &&
            typeof where.status === "object" &&
            "in" in where.status &&
            !(where.status.in as string[]).includes(proposal.status)
          ) {
            return { count: 0 };
          }
          if (data.version && typeof data.version === "object") {
            proposal.version += Number(
              (data.version as { increment?: number }).increment ?? 0,
            );
          }
          Object.entries(data).forEach(([key, value]) => {
            if (key !== "version") proposal[key] = value;
          });
          return { count: 1 };
        },
      ),
    },
  };
  const service = new AiProposalService(
    prisma as never,
    {} as AiFakeProviderFactory,
    orchestrator as never,
    AiFeatureGate.forTesting(
      options.featureFlags ?? {
        businessWrite: true,
        fakeProvider: true,
        proposal: true,
      },
    ),
  );
  return {
    operation: operations[0]!,
    operations,
    orchestrator,
    prisma,
    proposal,
    service,
  };
}

function buildOperation(
  id: string,
  ordinal: number,
  operationType: AiOperationType,
  status: OperationStatus,
  now: Date,
) {
  return {
    acceptedAt: status === "ACCEPTED" ? now : null,
    appliedAt: status === "APPLIED" ? now : null,
    clarification: null,
    confidence: "0.9000",
    createdAt: now,
    errorCode: null,
    errorMessage: null,
    fieldsJson:
      operationType === "TRANSACTION"
        ? { amount: "1.00", type: "EXPENSE" }
        : { title: "task" },
    fieldsFingerprint: sha256Fingerprint(
      operationType === "TRANSACTION"
        ? { amount: "1.00", type: "EXPENSE" }
        : { title: "task" },
    ),
    id,
    operationType,
    ordinal,
    rejectedAt: status === "REJECTED" ? now : null,
    resultDraftId: null,
    resultEntityId: status === "APPLIED" ? "task_1" : null,
    resultEntityType: status === "APPLIED" ? operationType : null,
    status,
    updatedAt: now,
  };
}
