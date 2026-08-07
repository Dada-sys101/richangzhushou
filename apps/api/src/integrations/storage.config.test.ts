import { describe, expect, it, vi } from "vitest";

import {
  AliyunOssStorageAdapter,
  type OssClient,
} from "./aliyun-oss-storage.adapter.js";
import { LocalStorageAdapter } from "./local-storage.adapter.js";
import {
  createStorageAdapter,
  loadStorageConfig,
  type OssStorageConfig,
} from "./storage.config.js";

const OSS_ENV = {
  STORAGE_ACCESS_KEY_ID: "ram-access-key-id",
  STORAGE_ACCESS_KEY_SECRET: "ram-access-key-secret",
  STORAGE_BUCKET: "daily-assistant-staging",
  STORAGE_ENDPOINT: "https://oss-cn-beijing-internal.aliyuncs.com",
  STORAGE_PROVIDER: "oss",
  STORAGE_REGION: "cn-beijing",
};

function fakeClientFactory(config: OssStorageConfig): OssClient {
  void config;
  return {
    delete: vi.fn(async () => undefined),
    get: vi.fn(async () => ({ content: Buffer.alloc(0) })),
    put: vi.fn(async () => undefined),
  };
}

describe("loadStorageConfig", () => {
  it("defaults to local outside production", () => {
    expect(loadStorageConfig({ NODE_ENV: "development" })).toEqual({
      provider: "local",
    });
    expect(loadStorageConfig({ NODE_ENV: "test" })).toEqual({
      provider: "local",
    });
    expect(loadStorageConfig({})).toEqual({ provider: "local" });
  });

  it("selects OSS when explicitly configured", () => {
    expect(loadStorageConfig(OSS_ENV)).toEqual({
      accessKeyId: "ram-access-key-id",
      accessKeySecret: "ram-access-key-secret",
      bucket: "daily-assistant-staging",
      endpoint: "https://oss-cn-beijing-internal.aliyuncs.com",
      provider: "oss",
      region: "cn-beijing",
    });
  });

  it("fails when required OSS variables are missing", () => {
    expect(() => loadStorageConfig({ STORAGE_PROVIDER: "oss" })).toThrow(
      /STORAGE_BUCKET/,
    );
    expect(() =>
      loadStorageConfig({
        ...OSS_ENV,
        STORAGE_ACCESS_KEY_ID: "",
        STORAGE_ACCESS_KEY_SECRET: undefined,
      }),
    ).toThrow(/STORAGE_ACCESS_KEY_ID/);
  });

  it("blocks local storage in production", () => {
    expect(() =>
      loadStorageConfig({ NODE_ENV: "production", STORAGE_PROVIDER: "local" }),
    ).toThrow(/not allowed when NODE_ENV=production/);
    expect(() => loadStorageConfig({ NODE_ENV: "production" })).toThrow(
      /must be explicitly set/,
    );
  });

  it("rejects unknown providers", () => {
    expect(() => loadStorageConfig({ STORAGE_PROVIDER: "s3" })).toThrow(
      /Unsupported STORAGE_PROVIDER/,
    );
  });
});

describe("createStorageAdapter", () => {
  it("selects the local adapter for local config", () => {
    const factory = vi.fn(fakeClientFactory);
    const adapter = createStorageAdapter({ provider: "local" }, factory);
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
    expect(factory).not.toHaveBeenCalled();
  });

  it("selects the OSS adapter with the configured bucket and client", () => {
    const factory = vi.fn(fakeClientFactory);
    const config = loadStorageConfig(OSS_ENV) as OssStorageConfig;
    const adapter = createStorageAdapter(config, factory);
    expect(adapter).toBeInstanceOf(AliyunOssStorageAdapter);
    expect(factory).toHaveBeenCalledWith(config);
    expect(factory.mock.results[0]?.value).toBeDefined();
  });
});
