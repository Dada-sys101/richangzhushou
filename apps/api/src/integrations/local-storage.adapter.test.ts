import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LocalStorageAdapter } from "./local-storage.adapter.js";

describe("LocalStorageAdapter", () => {
  let baseDir: string;
  let adapter: LocalStorageAdapter;

  beforeAll(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), "daily-assistant-storage-"));
    process.env.LOCAL_STORAGE_DIR = baseDir;
    adapter = new LocalStorageAdapter();
  });

  afterAll(async () => {
    delete process.env.LOCAL_STORAGE_DIR;
    await rm(baseDir, { force: true, recursive: true });
  });

  it("stores, reads, and deletes a file", async () => {
    const key = "attachments/user-1/a.png";
    await adapter.put(key, Buffer.from([1, 2, 3]));
    await expect(adapter.get(key)).resolves.toEqual(Buffer.from([1, 2, 3]));
    await adapter.delete(key);
    await expect(adapter.get(key)).rejects.toThrow();
  });

  it("treats deleting a missing file as idempotent success", async () => {
    await expect(
      adapter.delete("attachments/user-1/missing.png"),
    ).resolves.toBe(undefined);
  });

  it("rejects unsafe object keys", async () => {
    await expect(
      adapter.put("../escape.txt", Buffer.from("x")),
    ).rejects.toThrow("Unsafe object key");
    await expect(adapter.delete("sub/../../escape.txt")).rejects.toThrow(
      "Unsafe object key",
    );
  });
});
