import { describe, expect, it } from "vitest";

import {
  API_BASE_PATH,
  BUSINESS_TIME_ZONE,
  DEFAULT_CURRENCY,
  ENVIRONMENT_GATE_KEYS,
  FEATURE_FLAG_ENVIRONMENT_GATE_MAP,
  FEATURE_FLAG_GROUPS,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  isTruthyEnvironmentValue,
  resolveEnvironmentGate,
  resolveFeatureFlag,
  resolveFeatureFlags,
} from "./index";

describe("shared configuration", () => {
  it("keeps stable public defaults", () => {
    expect(API_BASE_PATH).toBe("/api/v1");
    expect(BUSINESS_TIME_ZONE).toBe("Asia/Shanghai");
    expect(DEFAULT_CURRENCY).toBe("CNY");
  });

  it("freezes the exact 21 feature flags with false defaults", () => {
    expect(Object.isFrozen(FEATURE_FLAGS)).toBe(true);
    expect(FEATURE_FLAG_KEYS).toHaveLength(21);
    expect(FEATURE_FLAG_KEYS).toEqual([
      "v15.rrule.write",
      "v15.rrule.dualRead",
      "v15.rrule.primaryRead",
      "v15.rrule.scheduler",
      "v15.indexeddb.v2Schema",
      "v15.indexeddb.migration",
      "v15.indexeddb.v2Primary",
      "v15.indexeddb.dualWrite",
      "v15.indexeddb.cleanup",
      "v15.import.upload",
      "v15.import.dryRun",
      "v15.import.write",
      "v15.import.userVisible",
      "v15.push.subscription",
      "v15.push.serviceWorker",
      "v15.push.enqueue",
      "v15.push.send",
      "v15.ai.proposal",
      "v15.ai.fakeProvider",
      "v15.ai.liveProvider",
      "v15.ai.businessWrite",
    ]);
    expect(Object.values(FEATURE_FLAGS)).toEqual(Array(21).fill(false));
    expect(FEATURE_FLAGS["v15.ai.liveProvider"]).toBe(false);
    expect(FEATURE_FLAGS["v15.ai.businessWrite"]).toBe(false);
  });

  it("freezes the exact environment gate registry", () => {
    expect(ENVIRONMENT_GATE_KEYS).toEqual([
      "V15_RRULE_ALLOWED",
      "V15_INDEXEDDB_V2_ALLOWED",
      "V15_IMPORT_ALLOWED",
      "V15_WEB_PUSH_ALLOWED",
      "V15_AI_ALLOWED",
      "V15_LIVE_PUSH_ALLOWED",
      "V15_LIVE_AI_ALLOWED",
      "V15_INDEXEDDB_CLEANUP_ALLOWED",
    ]);
  });

  it("maps every flag to its correct environment gate", () => {
    expect(FEATURE_FLAG_ENVIRONMENT_GATE_MAP).toEqual({
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
    });
  });

  it("keeps the expected flag groups without overlaps", () => {
    expect(FEATURE_FLAG_GROUPS).toEqual({
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
    });

    const grouped = Object.values(FEATURE_FLAG_GROUPS).flat();
    expect(new Set(grouped)).toEqual(new Set(FEATURE_FLAG_KEYS));
  });

  it("parses only trimmed case-insensitive true as enabled", () => {
    expect(isTruthyEnvironmentValue("true")).toBe(true);
    expect(isTruthyEnvironmentValue(" true ")).toBe(true);
    expect(isTruthyEnvironmentValue("TRUE")).toBe(true);
    expect(isTruthyEnvironmentValue("TrUe")).toBe(true);
    expect(isTruthyEnvironmentValue("false")).toBe(false);
    expect(isTruthyEnvironmentValue("1")).toBe(false);
    expect(isTruthyEnvironmentValue("")).toBe(false);
    expect(isTruthyEnvironmentValue(undefined)).toBe(false);
  });

  it("enables a flag only when environment and database are both true", () => {
    const flag = "v15.ai.proposal";
    const envOn = { V15_AI_ALLOWED: "true" };
    const envOff = { V15_AI_ALLOWED: "false" };

    expect(resolveEnvironmentGate(envOn, "V15_AI_ALLOWED")).toBe(true);
    expect(resolveEnvironmentGate(envOff, "V15_AI_ALLOWED")).toBe(false);
    expect(resolveFeatureFlag(flag, envOn, { [flag]: true })).toBe(true);
    expect(resolveFeatureFlag(flag, envOn, { [flag]: false })).toBe(false);
    expect(resolveFeatureFlag(flag, envOn, {})).toBe(false);
    expect(resolveFeatureFlag(flag, envOn)).toBe(false);
    expect(resolveFeatureFlag(flag, envOff, { [flag]: true })).toBe(false);
  });

  it("resolves the full flag set with the AND truth table", () => {
    const databaseFlags = {
      "v15.ai.proposal": true,
      "v15.ai.liveProvider": true,
      "v15.ai.businessWrite": false,
    };
    const resolved = resolveFeatureFlags(
      {
        V15_AI_ALLOWED: "true",
        V15_LIVE_AI_ALLOWED: "TRUE",
        V15_RRULE_ALLOWED: "invalid",
      },
      databaseFlags,
    );

    expect(resolved["v15.ai.proposal"]).toBe(true);
    expect(resolved["v15.ai.liveProvider"]).toBe(true);
    expect(resolved["v15.ai.businessWrite"]).toBe(false);
    expect(resolved["v15.rrule.write"]).toBe(false);
    expect(resolved["v15.indexeddb.cleanup"]).toBe(false);
    expect(Object.isFrozen(resolved)).toBe(true);
  });
});
