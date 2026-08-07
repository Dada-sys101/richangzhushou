import {
  AliyunOssStorageAdapter,
  createAliyunOssClient,
  type OssClient,
} from "./aliyun-oss-storage.adapter.js";
import type { StorageAdapter } from "./integrations.types.js";
import { LocalStorageAdapter } from "./local-storage.adapter.js";

export type StorageProvider = "local" | "oss";

export interface LocalStorageConfig {
  provider: "local";
}

export interface OssStorageConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint: string;
  provider: "oss";
  region: string;
}

export type StorageConfig = LocalStorageConfig | OssStorageConfig;

const OSS_ENV_VARS = [
  "STORAGE_BUCKET",
  "STORAGE_REGION",
  "STORAGE_ENDPOINT",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_ACCESS_KEY_SECRET",
] as const;

export function loadStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): StorageConfig {
  const provider = env.STORAGE_PROVIDER?.trim();
  const isProduction = env.NODE_ENV === "production";

  if (provider === "oss") {
    const missing = OSS_ENV_VARS.filter((name) => !env[name]?.trim());
    if (missing.length > 0) {
      throw new Error(
        `STORAGE_PROVIDER=oss requires the following environment variables: ${missing.join(", ")}`,
      );
    }
    return {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID!.trim(),
      accessKeySecret: env.STORAGE_ACCESS_KEY_SECRET!.trim(),
      bucket: env.STORAGE_BUCKET!.trim(),
      endpoint: env.STORAGE_ENDPOINT!.trim(),
      provider: "oss",
      region: env.STORAGE_REGION!.trim(),
    };
  }

  if (provider === "local") {
    if (isProduction) {
      throw new Error(
        "STORAGE_PROVIDER=local is not allowed when NODE_ENV=production. Configure STORAGE_PROVIDER=oss for staging/production.",
      );
    }
    return { provider: "local" };
  }

  if (provider === undefined || provider === "") {
    if (isProduction) {
      throw new Error(
        'STORAGE_PROVIDER must be explicitly set to "oss" when NODE_ENV=production.',
      );
    }
    return { provider: "local" };
  }

  throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
}

export function createStorageAdapter(
  config: StorageConfig,
  createClient: (config: OssStorageConfig) => OssClient = createAliyunOssClient,
): StorageAdapter {
  if (config.provider === "local") {
    return new LocalStorageAdapter();
  }
  return new AliyunOssStorageAdapter(createClient(config));
}
