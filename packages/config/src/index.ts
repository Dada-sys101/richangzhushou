export const API_BASE_PATH = "/api/v1" as const;
export const BUSINESS_TIME_ZONE = "Asia/Shanghai" as const;
export const DEFAULT_CURRENCY = "CNY" as const;

/** V1 正式产品显示名（OPEN-001/OPEN-011：品牌显示名与技术标识分离）。 */
export const PRODUCT = {
  nameZh: "日常助手",
  nameEn: "Daily Assistant",
  displayName: "日常助手 / Daily Assistant",
  adminNameZh: "日常助手管理端",
  adminNameEn: "Daily Assistant Admin",
} as const;

const FEATURE_FLAG_REGISTRY = {
  "v15.rrule.write": false,
  "v15.rrule.dualRead": false,
  "v15.rrule.primaryRead": false,
  "v15.rrule.scheduler": false,
  "v15.indexeddb.v2Schema": false,
  "v15.indexeddb.migration": false,
  "v15.indexeddb.v2Primary": false,
  "v15.indexeddb.dualWrite": false,
  "v15.indexeddb.cleanup": false,
  "v15.import.upload": false,
  "v15.import.dryRun": false,
  "v15.import.write": false,
  "v15.import.userVisible": false,
  "v15.push.subscription": false,
  "v15.push.serviceWorker": false,
  "v15.push.enqueue": false,
  "v15.push.send": false,
  "v15.ai.proposal": false,
  "v15.ai.fakeProvider": false,
  "v15.ai.liveProvider": false,
  "v15.ai.businessWrite": false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAG_REGISTRY;

export const FEATURE_FLAGS = Object.freeze<Record<FeatureFlagKey, boolean>>({
  ...FEATURE_FLAG_REGISTRY,
});

export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

export const ENVIRONMENT_GATE_KEYS = [
  "V15_RRULE_ALLOWED",
  "V15_INDEXEDDB_V2_ALLOWED",
  "V15_IMPORT_ALLOWED",
  "V15_WEB_PUSH_ALLOWED",
  "V15_AI_ALLOWED",
  "V15_LIVE_PUSH_ALLOWED",
  "V15_LIVE_AI_ALLOWED",
  "V15_INDEXEDDB_CLEANUP_ALLOWED",
] as const;

export type EnvironmentGateKey = (typeof ENVIRONMENT_GATE_KEYS)[number];

export const FEATURE_FLAG_ENVIRONMENT_GATE_MAP = {
  "v15.rrule.write": "V15_RRULE_ALLOWED",
  "v15.rrule.dualRead": "V15_RRULE_ALLOWED",
  "v15.rrule.primaryRead": "V15_RRULE_ALLOWED",
  "v15.rrule.scheduler": "V15_RRULE_ALLOWED",
  "v15.indexeddb.v2Schema": "V15_INDEXEDDB_V2_ALLOWED",
  "v15.indexeddb.migration": "V15_INDEXEDDB_V2_ALLOWED",
  "v15.indexeddb.v2Primary": "V15_INDEXEDDB_V2_ALLOWED",
  "v15.indexeddb.dualWrite": "V15_INDEXEDDB_V2_ALLOWED",
  "v15.indexeddb.cleanup": "V15_INDEXEDDB_CLEANUP_ALLOWED",
  "v15.import.upload": "V15_IMPORT_ALLOWED",
  "v15.import.dryRun": "V15_IMPORT_ALLOWED",
  "v15.import.write": "V15_IMPORT_ALLOWED",
  "v15.import.userVisible": "V15_IMPORT_ALLOWED",
  "v15.push.subscription": "V15_WEB_PUSH_ALLOWED",
  "v15.push.serviceWorker": "V15_WEB_PUSH_ALLOWED",
  "v15.push.enqueue": "V15_WEB_PUSH_ALLOWED",
  "v15.push.send": "V15_LIVE_PUSH_ALLOWED",
  "v15.ai.proposal": "V15_AI_ALLOWED",
  "v15.ai.fakeProvider": "V15_AI_ALLOWED",
  "v15.ai.liveProvider": "V15_LIVE_AI_ALLOWED",
  "v15.ai.businessWrite": "V15_AI_ALLOWED",
} as const satisfies Record<FeatureFlagKey, EnvironmentGateKey>;

export const FEATURE_FLAG_GROUPS = {
  V15_RRULE_ALLOWED: [
    "v15.rrule.write",
    "v15.rrule.dualRead",
    "v15.rrule.primaryRead",
    "v15.rrule.scheduler",
  ],
  V15_INDEXEDDB_V2_ALLOWED: [
    "v15.indexeddb.v2Schema",
    "v15.indexeddb.migration",
    "v15.indexeddb.v2Primary",
    "v15.indexeddb.dualWrite",
  ],
  V15_IMPORT_ALLOWED: [
    "v15.import.upload",
    "v15.import.dryRun",
    "v15.import.write",
    "v15.import.userVisible",
  ],
  V15_WEB_PUSH_ALLOWED: [
    "v15.push.subscription",
    "v15.push.serviceWorker",
    "v15.push.enqueue",
  ],
  V15_LIVE_PUSH_ALLOWED: ["v15.push.send"],
  V15_AI_ALLOWED: [
    "v15.ai.proposal",
    "v15.ai.fakeProvider",
    "v15.ai.businessWrite",
  ],
  V15_LIVE_AI_ALLOWED: ["v15.ai.liveProvider"],
  V15_INDEXEDDB_CLEANUP_ALLOWED: ["v15.indexeddb.cleanup"],
} as const satisfies Record<EnvironmentGateKey, readonly FeatureFlagKey[]>;

export type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

export type DatabaseFeatureFlags = Readonly<
  Partial<Record<FeatureFlagKey, boolean>>
>;

export type ResolvedFeatureFlags = Readonly<Record<FeatureFlagKey, boolean>>;

export function isTruthyEnvironmentValue(value: string | undefined): boolean {
  return value !== undefined && value.trim().toLowerCase() === "true";
}

export function resolveEnvironmentGate(
  environment: EnvironmentVariables,
  gate: EnvironmentGateKey,
): boolean {
  return isTruthyEnvironmentValue(environment[gate]);
}

export function resolveFeatureFlag(
  flag: FeatureFlagKey,
  environment: EnvironmentVariables,
  databaseFlags: DatabaseFeatureFlags = {},
): boolean {
  const gate = FEATURE_FLAG_ENVIRONMENT_GATE_MAP[flag];
  return (
    resolveEnvironmentGate(environment, gate) && databaseFlags[flag] === true
  );
}

export function resolveFeatureFlags(
  environment: EnvironmentVariables,
  databaseFlags: DatabaseFeatureFlags = {},
): ResolvedFeatureFlags {
  const resolved = Object.fromEntries(
    FEATURE_FLAG_KEYS.map((flag) => [
      flag,
      resolveFeatureFlag(flag, environment, databaseFlags),
    ]),
  ) as ResolvedFeatureFlags;

  return Object.freeze(resolved);
}
