import {
  FEATURE_FLAG_KEYS,
  type DatabaseFeatureFlags,
  type FeatureFlagKey,
} from "@daily-assistant/config";

import type { PrismaService } from "../prisma/prisma.service.js";

export type SystemSettingFeatureFlagReader = Pick<
  PrismaService,
  "systemSetting"
>;

export function parseDatabaseFeatureFlags(
  value: unknown,
): DatabaseFeatureFlags {
  if (!isRecord(value)) {
    return {};
  }

  const parsed: Partial<Record<FeatureFlagKey, boolean>> = {};
  for (const flag of FEATURE_FLAG_KEYS) {
    const flagValue = value[flag];
    if (flagValue === true || flagValue === false) {
      parsed[flag] = flagValue;
    }
  }
  return Object.freeze(parsed);
}

export async function loadDatabaseFeatureFlags(
  prisma: SystemSettingFeatureFlagReader,
): Promise<DatabaseFeatureFlags> {
  try {
    const settings = await prisma.systemSetting.findUnique({
      select: { featureFlags: true },
      where: { id: "singleton" },
    });
    return parseDatabaseFeatureFlags(settings?.featureFlags);
  } catch {
    // Database failure must never turn into an AI enablement signal.
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
