import { describe, expect, it, vi } from "vitest";

import {
  loadDatabaseFeatureFlags,
  parseDatabaseFeatureFlags,
  type SystemSettingFeatureFlagReader,
} from "./ai-feature-flag-loader.js";

describe("AI database feature-flag loader", () => {
  it("loads only recognized boolean flags from the singleton SystemSetting", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      featureFlags: {
        "v15.ai.fakeProvider": true,
        "v15.ai.proposal": false,
        unknown: true,
      },
    });

    const flags = await loadDatabaseFeatureFlags({
      systemSetting: { findUnique },
    } as unknown as SystemSettingFeatureFlagReader);

    expect(flags).toEqual({
      "v15.ai.fakeProvider": true,
      "v15.ai.proposal": false,
    });
    expect(findUnique).toHaveBeenCalledWith({
      select: { featureFlags: true },
      where: { id: "singleton" },
    });
  });

  it("fails closed for missing, non-object, invalid, and unrecognized data", () => {
    expect(parseDatabaseFeatureFlags(null)).toEqual({});
    expect(parseDatabaseFeatureFlags(["v15.ai.proposal"])).toEqual({});
    expect(parseDatabaseFeatureFlags("true")).toEqual({});
    expect(
      parseDatabaseFeatureFlags({
        "v15.ai.businessWrite": "true",
        "v15.ai.fakeProvider": 1,
        "v15.ai.proposal": true,
        "v15.ai.unknown": true,
      }),
    ).toEqual({ "v15.ai.proposal": true });
  });

  it("fails closed when the database snapshot cannot be read", async () => {
    const findUnique = vi
      .fn()
      .mockRejectedValue(new Error("database unavailable"));

    await expect(
      loadDatabaseFeatureFlags({
        systemSetting: { findUnique },
      } as unknown as SystemSettingFeatureFlagReader),
    ).resolves.toEqual({});
  });
});
