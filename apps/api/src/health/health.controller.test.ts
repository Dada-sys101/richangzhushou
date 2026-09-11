import { describe, expect, it, vi } from "vitest";

import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("returns a non-sensitive readiness response when the database responds", async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]) };

    await expect(
      new HealthController(prisma as never).getHealth(),
    ).resolves.toEqual({
      service: "daily-assistant-api",
      status: "ok",
    });
  });

  it("fails readiness when the database is unavailable", async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error("down")) };

    await expect(
      new HealthController(prisma as never).getHealth(),
    ).rejects.toMatchObject({ status: 503 });
  });
});
