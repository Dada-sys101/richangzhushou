import { describe, expect, it } from "vitest";

import {
  AliyunOssStorageAdapter,
  StorageOperationError,
  type OssClient,
} from "./aliyun-oss-storage.adapter.js";

class FakeOssClient implements OssClient {
  readonly deletes: string[] = [];
  readonly gets: string[] = [];
  readonly puts: Array<{
    file: Buffer;
    name: string;
    options?: { mime?: string };
  }> = [];
  getContent: Buffer | string = Buffer.from("file-content");
  nextDeleteError: unknown = null;
  nextGetError: unknown = null;

  async delete(name: string): Promise<void> {
    this.deletes.push(name);
    if (this.nextDeleteError) {
      const error = this.nextDeleteError;
      this.nextDeleteError = null;
      throw error;
    }
  }

  async get(name: string): Promise<{ content: Buffer | string }> {
    this.gets.push(name);
    if (this.nextGetError) {
      throw this.nextGetError;
    }
    return { content: this.getContent };
  }

  async put(
    name: string,
    file: Buffer,
    options?: { mime?: string },
  ): Promise<void> {
    this.puts.push({ file, name, options });
  }
}

function createHarness(): {
  adapter: AliyunOssStorageAdapter;
  client: FakeOssClient;
} {
  const client = new FakeOssClient();
  return { adapter: new AliyunOssStorageAdapter(client), client };
}

describe("AliyunOssStorageAdapter", () => {
  it("uploads binary content with the mime type", async () => {
    const { adapter, client } = createHarness();
    const data = Buffer.from([1, 2, 3]);
    await adapter.put("users/u1/attachments/a.png", data, "image/png");
    expect(client.puts[0]).toEqual({
      file: data,
      name: "users/u1/attachments/a.png",
      options: { mime: "image/png" },
    });
  });

  it("returns content as a Buffer", async () => {
    const { adapter, client } = createHarness();
    client.getContent = Buffer.from("abc");
    await expect(adapter.get("users/u1/attachments/a.png")).resolves.toEqual(
      Buffer.from("abc"),
    );
    client.getContent = "def";
    await expect(adapter.get("users/u1/attachments/a.png")).resolves.toEqual(
      Buffer.from("def"),
    );
    expect(client.gets).toEqual([
      "users/u1/attachments/a.png",
      "users/u1/attachments/a.png",
    ]);
  });

  it("deletes an object", async () => {
    const { adapter, client } = createHarness();
    await adapter.delete("users/u1/attachments/a.png");
    expect(client.deletes).toEqual(["users/u1/attachments/a.png"]);
  });

  it("treats a missing object as idempotent delete success", async () => {
    const { adapter, client } = createHarness();
    client.nextDeleteError = Object.assign(new Error("no such key"), {
      code: "NoSuchKey",
    });
    await expect(adapter.delete("missing.png")).resolves.toBeUndefined();
    client.nextDeleteError = Object.assign(new Error("not found"), {
      status: 404,
    });
    await expect(adapter.delete("missing-2.png")).resolves.toBeUndefined();
    expect(client.deletes).toEqual(["missing.png", "missing-2.png"]);
  });

  it("wraps network delete errors without leaking credentials or content", async () => {
    const { adapter, client } = createHarness();
    const leak = Object.assign(new Error("AKIAIOSFODNN7EXAMPLE secret body"), {
      code: "NetworkError",
      status: 500,
    });
    client.nextDeleteError = leak;
    let caught: unknown;
    try {
      await adapter.delete("users/u1/attachments/a.png");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StorageOperationError);
    const operationError = caught as StorageOperationError;
    expect(operationError.code).toBe("NetworkError");
    expect(operationError.status).toBe(500);
    expect(operationError.message).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(operationError.message).not.toContain("secret");
    expect(operationError.message).not.toContain("body");
  });

  it("wraps get errors with a diagnosable code", async () => {
    const { adapter, client } = createHarness();
    client.nextGetError = Object.assign(new Error("missing"), {
      code: "NoSuchKey",
    });
    await expect(adapter.get("missing.png")).rejects.toMatchObject({
      code: "NoSuchKey",
      name: "StorageOperationError",
    });
  });
});
