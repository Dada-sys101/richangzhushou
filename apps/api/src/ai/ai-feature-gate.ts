import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  resolveFeatureFlag,
  type DatabaseFeatureFlags,
  type EnvironmentVariables,
} from "@daily-assistant/config";

import { ApiException } from "../common/api-error.js";

export const AI_FEATURE_GATE_SNAPSHOT = Symbol("AI_FEATURE_GATE_SNAPSHOT");

export interface AiFeatureFlagSnapshot {
  businessWrite: boolean;
  fakeProvider: boolean;
  liveProvider: boolean;
  proposal: boolean;
}

type TestFeatureFlagSnapshot = Partial<AiFeatureFlagSnapshot>;

/**
 * Centralizes the server-side AI gates. Production reads the shared resolver
 * with an intentionally empty DB snapshot until the SystemSetting foundation
 * exists; tests may inject an explicit in-memory snapshot through DI.
 */
@Injectable()
export class AiFeatureGate {
  private readonly flags: AiFeatureFlagSnapshot;

  constructor(
    @Optional()
    @Inject(AI_FEATURE_GATE_SNAPSHOT)
    testSnapshot?: TestFeatureFlagSnapshot,
  ) {
    this.flags = testSnapshot
      ? {
          businessWrite: testSnapshot.businessWrite ?? false,
          fakeProvider: testSnapshot.fakeProvider ?? false,
          liveProvider: testSnapshot.liveProvider ?? false,
          proposal: testSnapshot.proposal ?? false,
        }
      : resolveProductionFlags();
  }

  static forTesting(snapshot: TestFeatureFlagSnapshot): AiFeatureGate {
    return new AiFeatureGate(snapshot);
  }

  isProposalEnabled(): boolean {
    return this.flags.proposal;
  }

  isFakeProviderEnabled(): boolean {
    return this.flags.fakeProvider;
  }

  isLiveProviderEnabled(): boolean {
    return this.flags.liveProvider;
  }

  isBusinessWriteEnabled(): boolean {
    return this.flags.businessWrite;
  }

  requireProposal(): void {
    if (!this.flags.proposal) {
      throw aiDisabled();
    }
  }

  requireFakeProvider(): void {
    this.requireProposal();
    if (!this.flags.fakeProvider) {
      throw aiDisabled();
    }
  }

  requireBusinessWrite(): void {
    this.requireProposal();
    if (!this.flags.businessWrite) {
      throw aiDisabled();
    }
  }
}

function resolveProductionFlags(): AiFeatureFlagSnapshot {
  const environment = process.env as EnvironmentVariables;
  const databaseFlags: DatabaseFeatureFlags = {};
  return {
    businessWrite: resolveFeatureFlag(
      "v15.ai.businessWrite",
      environment,
      databaseFlags,
    ),
    fakeProvider: resolveFeatureFlag(
      "v15.ai.fakeProvider",
      environment,
      databaseFlags,
    ),
    liveProvider: resolveFeatureFlag(
      "v15.ai.liveProvider",
      environment,
      databaseFlags,
    ),
    proposal: resolveFeatureFlag("v15.ai.proposal", environment, databaseFlags),
  };
}

function aiDisabled(): ApiException {
  return new ApiException("AI_DISABLED", 403, "AI features are disabled");
}
