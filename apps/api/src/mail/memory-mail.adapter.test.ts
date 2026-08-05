import { describe, expect, it, vi } from "vitest";

import { MemoryMailAdapter } from "./memory-mail.adapter.js";

describe("MemoryMailAdapter", () => {
  it("never writes the recovery token to logs or stdout", async () => {
    const adapter = new MemoryMailAdapter();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await adapter.sendRecovery({
      email: "user@example.com",
      expiresAt: new Date(),
      kind: "PASSWORD_RESET",
      token: "top-secret-recovery-token",
    });

    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("top-secret-recovery-token"),
    );
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("top-secret-recovery-token"),
    );
    expect(adapter.getLatestToken("user@example.com", "PASSWORD_RESET")).toBe(
      "top-secret-recovery-token",
    );
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
