import { describe, expect, it } from "vitest";

import { StorageKeyService } from "./storage-key.service.js";

describe("StorageKeyService", () => {
  const service = new StorageKeyService();

  it("generates canonical attachment keys", () => {
    const key = service.generateAttachmentKey("user-123", "a1b2c3.png");
    expect(key).toBe("users/user-123/attachments/a1b2c3.png");
  });

  it("rejects unsafe key segments", () => {
    expect(() => service.generateAttachmentKey("", "a.png")).toThrow(
      "Unsafe storage key segment: userId",
    );
    expect(() => service.generateAttachmentKey("..", "a.png")).toThrow(
      "Unsafe storage key segment: userId",
    );
    expect(() => service.generateAttachmentKey("a/b", "a.png")).toThrow(
      "Unsafe storage key segment: userId",
    );
    expect(() =>
      service.generateAttachmentKey("user-1", "../escape.png"),
    ).toThrow("Unsafe storage key segment: fileId");
  });

  it("detects legacy attachment keys", () => {
    expect(service.isLegacyAttachmentKey("attachments/user-1/a.png")).toBe(
      true,
    );
    expect(
      service.isLegacyAttachmentKey("users/user-1/attachments/a.png"),
    ).toBe(false);
  });
});
