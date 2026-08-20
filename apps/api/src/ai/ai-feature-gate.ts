import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  resolveFeatureFlag,
  type DatabaseFeatureFlags,
  type EnvironmentVariables,
} from "@daily-assistant/config";

import { ApiException } from "../common/api-error.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { loadDatabaseFeatureFlags } from "./ai-feature-flag-loader.js";

export const AI_FEATURE_GATE_SNAPSHOT = Symbol("AI_FEATURE_GATE_SNAPSHOT");
export const AI_FEATURE_GATE_DATABASE_FLAGS = Symbol(
  "AI_FEATURE_GATE_DATABASE_FLAGS",
);

export interface AiFeatureFlagSnapshot {
  businessWrite: boolean;
  fakeProvider: boolean;
  liveProvider: boolean;
  proposal: boolean;
}

type TestFeatureFlagSnapshot = Partial<AiFeatureFlagSnapshot>;

/**
 * Centralizes the server-side AI gates. Production reads the shared resolver
 * with the DB snapshot loaded by AiModule; missing, malformed, or unavailable
 * snapshots fail closed. Tests may inject an explicit in-memory snapshot.
 */
@Injectable()
export class AiFeatureGate {
  private readonly flags: AiFeatureFlagSnapshot;
  private readonly testSnapshot: TestFeatureFlagSnapshot | undefined;

  constructor(
    @Optional()
    @Inject(AI_FEATURE_GATE_SNAPSHOT)
    testSnapshot?: TestFeatureFlagSnapshot,
    @Optional()
    @Inject(AI_FEATURE_GATE_DATABASE_FLAGS)
    databaseFlags?: DatabaseFeatureFlags,
  ) {
    this.testSnapshot = testSnapshot;
    this.flags = testSnapshot
      ? {
          businessWrite: testSnapshot.businessWrite ?? false,
          fakeProvider: testSnapshot.fakeProvider ?? false,
          liveProvider: testSnapshot.liveProvider ?? false,
          proposal: testSnapshot.proposal ?? false,
        }
      : resolveProductionFlags(databaseFlags ?? {});
  }

  static forTesting(snapshot: TestFeatureFlagSnapshot): AiFeatureGate {
    return new AiFeatureGate(snapshot);
  }

  static forProduction(databaseFlags: DatabaseFeatureFlags): AiFeatureGate {
    return new AiFeatureGate(undefined, databaseFlags);
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

  /**
   * New logical creates must reload DB flags at request time. Replays never
   * call this method. The sole authorized fake route is proposal=true,
   * fakeProvider=true and liveProvider=false.
   */
  async requireFakeProviderForCreate(prisma: PrismaService): Promise<void> {
    const flags = this.testSnapshot
      ? this.flags
      : resolveProductionFlags(await loadDatabaseFeatureFlags(prisma));
    if (!flags.proposal || !flags.fakeProvider || flags.liveProvider) {
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

function resolveProductionFlags(
  databaseFlags: DatabaseFeatureFlags,
): AiFeatureFlagSnapshot {
  const environment = process.env as EnvironmentVariables;
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
