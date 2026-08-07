import { describe, expect, it, vi } from "vitest";

import { AccountDeletionService } from "../account-deletion/account-deletion.service.js";
import { AttachmentsService } from "../attachments/attachments.service.js";
import { AuditService } from "../audit/audit.service.js";
import { RateLimiterService } from "../common/rate-limiter.service.js";
import { SecurityService } from "../common/security.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  AliyunOssStorageAdapter,
  type OssClient,
} from "./aliyun-oss-storage.adapter.js";
import { StorageKeyService } from "./storage-key.service.js";

class FakeOssClient implements OssClient {
  readonly deletes: string[] = [];
  readonly puts: Array<{
    file: Buffer;
    name: string;
    options?: { mime?: string };
  }> = [];
  nextDeleteError: unknown = null;

  async delete(name: string): Promise<void> {
    this.deletes.push(name);
    if (this.nextDeleteError) {
      const error = this.nextDeleteError;
      this.nextDeleteError = null;
      throw error;
    }
  }

  async get(): Promise<{ content: Buffer | string }> {
    return { content: Buffer.alloc(0) };
  }

  async put(
    name: string,
    file: Buffer,
    options?: { mime?: string },
  ): Promise<void> {
    this.puts.push({ file, name, options });
  }
}

interface AttachmentRow {
  contentStoredAt: Date | null;
  id: string;
  mimeType: string;
  objectKey: string;
  ownerType: string;
  sha256: string | null;
  size: number;
  uploadIntentExpiresAt: Date | null;
  uploadTokenHash: string | null;
  userId: string;
}

function createAttachmentsHarness(): {
  client: FakeOssClient;
  getCreatedRow: () => AttachmentRow | null;
  service: AttachmentsService;
} {
  const client = new FakeOssClient();
  const adapter = new AliyunOssStorageAdapter(client);
  let createdRow: AttachmentRow | null = null;
  const prisma = {
    attachment: {
      create: vi.fn(async (args: { data: Partial<AttachmentRow> }) => {
        createdRow = {
          contentStoredAt: null,
          id: "att-1",
          mimeType: args.data.mimeType ?? "image/png",
          objectKey: args.data.objectKey ?? "",
          ownerType: args.data.ownerType ?? "TRANSACTION_DRAFT",
          sha256: null,
          size: args.data.size ?? 0,
          uploadIntentExpiresAt: args.data.uploadIntentExpiresAt ?? null,
          uploadTokenHash: args.data.uploadTokenHash ?? null,
          userId: args.data.userId ?? "",
        };
        return createdRow;
      }),
      findUnique: vi.fn(async () => createdRow),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const security = {
    generateUploadToken: vi.fn(() => "upload-token"),
    sha256: vi.fn((value: string) => `hash:${value}`),
    sha256Buffer: vi.fn((data: Buffer) => `buffer-hash:${data.length}`),
  };
  const rateLimiter = { consume: vi.fn() };
  const service = new AttachmentsService(
    prisma as unknown as PrismaService,
    security as unknown as SecurityService,
    rateLimiter as unknown as RateLimiterService,
    adapter,
    new StorageKeyService(),
  );
  return { client, getCreatedRow: () => createdRow, service };
}

function createDeletionHarness(): {
  client: FakeOssClient;
  prisma: {
    user: {
      update: ReturnType<typeof vi.fn>;
    };
  };
  service: AccountDeletionService;
} {
  const client = new FakeOssClient();
  const adapter = new AliyunOssStorageAdapter(client);
  const handlers: Record<string, unknown> = {};
  const nestedMethods = new Proxy<Record<string, ReturnType<typeof vi.fn>>>(
    {},
    {
      get(target, prop) {
        const key = String(prop);
        if (!(key in target)) {
          target[key] = vi.fn(async () => ({}));
        }
        return target[key];
      },
    },
  );
  const tx = new Proxy(handlers, {
    get(target, prop) {
      const key = String(prop);
      if (!(key in target)) {
        target[key] = nestedMethods;
      }
      return target[key];
    },
  });
  handlers.user = {
    findUnique: vi.fn(async () => null),
    update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
      ...args.data,
      id: "user-1",
      status: "DELETED",
    })),
  };
  const prisma = {
    $transaction: vi.fn(
      async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx),
    ),
    attachment: {
      findMany: vi.fn(async () => [
        { objectKey: "users/user-1/attachments/a.png" },
        { objectKey: "users/user-1/attachments/missing.png" },
      ]),
    },
    user: {
      findMany: vi.fn(async () => [{ id: "user-1" }]),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        ...args.data,
        id: "user-1",
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const security = { hashPassword: vi.fn(async () => "hash") };
  const audit = { recordInTx: vi.fn(async () => undefined) };
  const service = new AccountDeletionService(
    prisma as unknown as PrismaService,
    security as unknown as SecurityService,
    audit as unknown as AuditService,
    adapter,
  );
  return {
    client,
    prisma: { user: { update: prisma.user.update } },
    service,
  };
}

describe("Business services through the OSS storage abstraction", () => {
  it("AttachmentsService stores content via the OSS adapter with canonical keys", async () => {
    const { client, getCreatedRow, service } = createAttachmentsHarness();
    const intent = await service.createUploadIntent("user-1", {
      mimeType: "image/png",
      ownerType: "TRANSACTION_DRAFT",
      size: 11,
    });
    expect(intent.uploadMethod).toBe("PUT");

    const created = getCreatedRow();
    expect(created?.objectKey).toMatch(
      /^users\/user-1\/attachments\/[0-9a-f-]+\.png$/,
    );

    const data = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
    ]);
    await service.storeContent("att-1", "upload-token", data);

    expect(client.puts[0]).toEqual({
      file: data,
      name: created?.objectKey,
      options: { mime: "image/png" },
    });
  });

  it("AccountDeletionService deletes attachment objects via the OSS adapter", async () => {
    const { client, service } = createDeletionHarness();
    const result = await service.runCleanup();
    expect(result).toEqual({ claimed: 1, completed: 1, failed: 0 });
    expect(client.deletes).toEqual([
      "users/user-1/attachments/a.png",
      "users/user-1/attachments/missing.png",
    ]);
  });

  it("AccountDeletionService records a sanitized failure for OSS network errors", async () => {
    const { client, prisma, service } = createDeletionHarness();
    client.nextDeleteError = Object.assign(
      new Error("AKIAIOSFODNN7EXAMPLE network failure"),
      { code: "NetworkError", status: 500 },
    );
    const result = await service.runCleanup();
    expect(result).toEqual({ claimed: 1, completed: 0, failed: 1 });

    const calls = prisma.user.update.mock.calls;
    const lastArgs = calls[calls.length - 1]?.[0] as
      { data?: { deletionLastError?: string } } | undefined;
    expect(lastArgs?.data?.deletionLastError).toContain("OSS delete failed");
    expect(lastArgs?.data?.deletionLastError).not.toContain(
      "AKIAIOSFODNN7EXAMPLE",
    );
  });
});
