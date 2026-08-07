import { randomUUID } from "node:crypto";

export interface AccountDeletionConfig {
  batchSize: number;
  leaseMs: number;
  maxAttempts: number;
  retentionDays: number;
}

export function loadAccountDeletionConfig(
  env: NodeJS.ProcessEnv = process.env,
): AccountDeletionConfig {
  return {
    batchSize: positiveInt(env.ACCOUNT_DELETION_BATCH_SIZE, 20),
    leaseMs: positiveInt(env.ACCOUNT_DELETION_LEASE_SECONDS, 600) * 1000,
    maxAttempts: positiveInt(env.ACCOUNT_DELETION_MAX_ATTEMPTS, 5),
    retentionDays: positiveInt(env.ACCOUNT_DELETION_RETENTION_DAYS, 30),
  };
}

export function deletionScheduledAt(
  now = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): Date {
  const retentionDays = loadAccountDeletionConfig(env).retentionDays;
  return new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export function anonymousUsername(): string {
  return `deleted_${randomUUID().replaceAll("-", "")}`;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
