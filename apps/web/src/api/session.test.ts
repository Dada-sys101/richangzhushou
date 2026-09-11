// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("refresh session failure classification", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("treats an HTTP 401 as an authentication failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const session = await import("./session");

    await expect(session.refreshSessionOnce()).resolves.toBeNull();
    expect(session.getLastRefreshFailure()).toBe("HTTP");
  });

  it("only classifies an unreachable request as a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const session = await import("./session");

    await expect(session.refreshSessionOnce()).resolves.toBeNull();
    expect(session.getLastRefreshFailure()).toBe("NETWORK");
  });
});
