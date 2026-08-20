import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service.js";
import { runAiOriginalInputPurge } from "../cli/ai-original-input-purge.runner.js";
import { AiOriginalInputRetentionService } from "./ai-original-input-retention.service.js";

describe("PR19 original-input retention", () => {
  it("purges only expired non-null original input with an injected clock", async () => {
    const now = new Date("2026-09-19T00:00:00.000Z");
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const service = new AiOriginalInputRetentionService(
      { aiRequest: { updateMany } } as unknown as PrismaService,
      { now: () => now },
    );

    await expect(service.purgeExpired()).resolves.toEqual({ purged: 2 });
    expect(updateMany).toHaveBeenCalledWith({
      data: {
        originalInputExpiresAt: null,
        originalUserInput: null,
      },
      where: {
        originalInputExpiresAt: { lte: now },
        originalUserInput: { not: null },
      },
    });
  });

  it("is idempotent when no eligible rows remain", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const service = new AiOriginalInputRetentionService({
      aiRequest: { updateMany },
    } as unknown as PrismaService);
    await expect(service.purgeExpired()).resolves.toEqual({ purged: 0 });
    await expect(service.purgeExpired()).resolves.toEqual({ purged: 0 });
  });

  it("CLI reports count only and always disconnects on success", async () => {
    const status = vi.fn();
    const error = vi.fn();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exitCode = await runAiOriginalInputPurge(
      {
        $disconnect: disconnect,
        aiRequest: {
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        } as never,
      },
      status,
      error,
    );
    expect(exitCode).toBe(0);
    expect(status).toHaveBeenCalledWith(
      "AI original-input purge completed: purged=3",
    );
    expect(error).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("CLI returns non-zero, sanitizes failure output and disconnects", async () => {
    const credential = "provider-secret-must-not-leak";
    const status = vi.fn();
    const error = vi.fn();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exitCode = await runAiOriginalInputPurge(
      {
        $disconnect: disconnect,
        aiRequest: {
          updateMany: vi.fn().mockRejectedValue(new Error(credential)),
        } as never,
      },
      status,
      error,
    );
    expect(exitCode).toBe(1);
    expect(status).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("AI original-input purge failed");
    expect(JSON.stringify(error.mock.calls)).not.toContain(credential);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
