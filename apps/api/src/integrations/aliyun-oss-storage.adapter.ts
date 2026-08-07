import OSS from "ali-oss";

import type { StorageAdapter } from "./integrations.types.js";
import type { OssStorageConfig } from "./storage.config.js";

export interface OssClient {
  delete(name: string): Promise<unknown>;
  get(name: string): Promise<{ content: Buffer | string }>;
  put(
    name: string,
    file: Buffer,
    options?: { mime?: string },
  ): Promise<unknown>;
}

export class StorageOperationError extends Error {
  constructor(
    readonly operation: "put" | "get" | "delete",
    readonly code?: string,
    readonly status?: number,
  ) {
    const details = [
      code ? `code=${code}` : null,
      status ? `status=${status}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    super(`OSS ${operation} failed${details ? ` (${details})` : ""}`);
    this.name = "StorageOperationError";
  }
}

export function createAliyunOssClient(config: OssStorageConfig): OssClient {
  return new OSS({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    endpoint: config.endpoint,
    region: config.region,
    secure: config.endpoint.startsWith("https://"),
  }) as unknown as OssClient;
}

export class AliyunOssStorageAdapter implements StorageAdapter {
  constructor(private readonly client: OssClient) {}

  async put(key: string, data: Buffer, mimeType: string): Promise<void> {
    try {
      await this.client.put(key, data, { mime: mimeType });
    } catch (error) {
      throw toStorageError("put", error);
    }
  }

  async get(key: string): Promise<Buffer> {
    try {
      const result = await this.client.get(key);
      return Buffer.isBuffer(result.content)
        ? result.content
        : Buffer.from(result.content);
    } catch (error) {
      throw toStorageError("get", error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.delete(key);
    } catch (error) {
      if (isMissingObject(error)) {
        return;
      }
      throw toStorageError("delete", error);
    }
  }
}

function isMissingObject(error: unknown): boolean {
  const candidate = error as {
    code?: unknown;
    name?: unknown;
    status?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code : undefined;
  const name = typeof candidate.name === "string" ? candidate.name : undefined;
  const status = candidate.status;
  return (
    code === "NoSuchKey" ||
    name === "NoSuchKey" ||
    status === 404 ||
    status === "404"
  );
}

function toStorageError(
  operation: "put" | "get" | "delete",
  error: unknown,
): StorageOperationError {
  if (error instanceof StorageOperationError) {
    return error;
  }
  const candidate = error as {
    code?: unknown;
    name?: unknown;
    status?: unknown;
  };
  const code =
    typeof candidate.code === "string"
      ? candidate.code
      : typeof candidate.name === "string"
        ? candidate.name
        : undefined;
  const status =
    typeof candidate.status === "number" ? candidate.status : undefined;
  return new StorageOperationError(operation, code, status);
}
