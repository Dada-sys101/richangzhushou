import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service.js";
import { AiFeatureGate } from "./ai-feature-gate.js";

describe("PR18 H04 AI feature gates", () => {
  it("H04-F01: production default is fail-closed even when the environment gate is on", () => {
    const previous = process.env.V15_AI_ALLOWED;
    process.env.V15_AI_ALLOWED = "true";
    try {
      const gate = new AiFeatureGate();
      expect(gate.isProposalEnabled()).toBe(false);
      expect(gate.isFakeProviderEnabled()).toBe(false);
      expect(gate.isLiveProviderEnabled()).toBe(false);
      expect(gate.isBusinessWriteEnabled()).toBe(false);
      expect(() => gate.requireProposal()).toThrowError(
        expect.objectContaining({ code: "AI_DISABLED" }),
      );
    } finally {
      if (previous === undefined) {
        delete process.env.V15_AI_ALLOWED;
      } else {
        process.env.V15_AI_ALLOWED = previous;
      }
    }
  });

  it("keeps a DB-enabled flag disabled when the environment gate is false", () => {
    const previous = process.env.V15_AI_ALLOWED;
    process.env.V15_AI_ALLOWED = "false";
    try {
      const gate = AiFeatureGate.forProduction({
        "v15.ai.proposal": true,
      });
      expect(gate.isProposalEnabled()).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.V15_AI_ALLOWED;
      } else {
        process.env.V15_AI_ALLOWED = previous;
      }
    }
  });

  it("keeps an environment-enabled flag disabled when the DB flag is false or missing", () => {
    const previous = process.env.V15_AI_ALLOWED;
    process.env.V15_AI_ALLOWED = "true";
    try {
      expect(
        AiFeatureGate.forProduction({
          "v15.ai.proposal": false,
        }).isProposalEnabled(),
      ).toBe(false);
      expect(AiFeatureGate.forProduction({}).isProposalEnabled()).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.V15_AI_ALLOWED;
      } else {
        process.env.V15_AI_ALLOWED = previous;
      }
    }
  });

  it("enables only the DB-backed non-live AI gates when both gates are on", () => {
    const previousAi = process.env.V15_AI_ALLOWED;
    const previousLiveAi = process.env.V15_LIVE_AI_ALLOWED;
    process.env.V15_AI_ALLOWED = "true";
    delete process.env.V15_LIVE_AI_ALLOWED;
    try {
      const gate = AiFeatureGate.forProduction({
        "v15.ai.businessWrite": true,
        "v15.ai.fakeProvider": true,
        "v15.ai.liveProvider": true,
        "v15.ai.proposal": true,
      });
      expect(gate.isProposalEnabled()).toBe(true);
      expect(gate.isFakeProviderEnabled()).toBe(true);
      expect(gate.isBusinessWriteEnabled()).toBe(true);
      expect(gate.isLiveProviderEnabled()).toBe(false);
    } finally {
      if (previousAi === undefined) {
        delete process.env.V15_AI_ALLOWED;
      } else {
        process.env.V15_AI_ALLOWED = previousAi;
      }
      if (previousLiveAi === undefined) {
        delete process.env.V15_LIVE_AI_ALLOWED;
      } else {
        process.env.V15_LIVE_AI_ALLOWED = previousLiveAi;
      }
    }
  });

  it("H04-F02: proposal review and Fake Provider gates are independent", () => {
    const proposalOnly = AiFeatureGate.forTesting({
      businessWrite: false,
      fakeProvider: false,
      proposal: true,
    });
    expect(() => proposalOnly.requireProposal()).not.toThrow();
    expect(() => proposalOnly.requireFakeProvider()).toThrowError(
      expect.objectContaining({ code: "AI_DISABLED" }),
    );

    const fakeProviderEnabled = AiFeatureGate.forTesting({
      businessWrite: false,
      fakeProvider: true,
      proposal: true,
    });
    expect(() => fakeProviderEnabled.requireFakeProvider()).not.toThrow();
  });

  it("H04-F03: business writes require proposal and businessWrite together", () => {
    const reviewOnly = AiFeatureGate.forTesting({
      businessWrite: false,
      fakeProvider: true,
      proposal: true,
    });
    expect(() => reviewOnly.requireProposal()).not.toThrow();
    expect(() => reviewOnly.requireBusinessWrite()).toThrowError(
      expect.objectContaining({ code: "AI_DISABLED" }),
    );

    const writeEnabled = AiFeatureGate.forTesting({
      businessWrite: true,
      fakeProvider: true,
      proposal: true,
    });
    expect(() => writeEnabled.requireBusinessWrite()).not.toThrow();
  });

  it("PR19 reloads DB flags for every new logical create", async () => {
    const previous = process.env.V15_AI_ALLOWED;
    process.env.V15_AI_ALLOWED = "true";
    try {
      const findUnique = vi
        .fn()
        .mockResolvedValueOnce({
          featureFlags: {
            "v15.ai.fakeProvider": true,
            "v15.ai.liveProvider": false,
            "v15.ai.proposal": true,
          },
        })
        .mockResolvedValueOnce({
          featureFlags: {
            "v15.ai.fakeProvider": false,
            "v15.ai.liveProvider": false,
            "v15.ai.proposal": true,
          },
        });
      const prisma = {
        systemSetting: { findUnique },
      } as unknown as PrismaService;
      const gate = new AiFeatureGate();
      await expect(
        gate.requireFakeProviderForCreate(prisma),
      ).resolves.toBeUndefined();
      await expect(
        gate.requireFakeProviderForCreate(prisma),
      ).rejects.toMatchObject({ code: "AI_DISABLED" });
      expect(findUnique).toHaveBeenCalledTimes(2);
    } finally {
      if (previous === undefined) delete process.env.V15_AI_ALLOWED;
      else process.env.V15_AI_ALLOWED = previous;
    }
  });

  it.each(["missing environment", "malformed DB", "DB unavailable"])(
    "PR19 fails closed for %s",
    async (cause) => {
      const previous = process.env.V15_AI_ALLOWED;
      if (cause === "missing environment") delete process.env.V15_AI_ALLOWED;
      else process.env.V15_AI_ALLOWED = "true";
      try {
        const findUnique =
          cause === "DB unavailable"
            ? vi.fn().mockRejectedValue(new Error("database unavailable"))
            : vi.fn().mockResolvedValue({
                featureFlags:
                  cause === "malformed DB"
                    ? { "v15.ai.fakeProvider": "yes" }
                    : {
                        "v15.ai.fakeProvider": true,
                        "v15.ai.liveProvider": false,
                        "v15.ai.proposal": true,
                      },
              });
        const prisma = {
          systemSetting: { findUnique },
        } as unknown as PrismaService;
        await expect(
          new AiFeatureGate().requireFakeProviderForCreate(prisma),
        ).rejects.toMatchObject({ code: "AI_DISABLED", statusCode: 403 });
      } finally {
        if (previous === undefined) delete process.env.V15_AI_ALLOWED;
        else process.env.V15_AI_ALLOWED = previous;
      }
    },
  );

  it("PR19 refuses fake execution whenever the live-provider gate resolves true", async () => {
    const previousAi = process.env.V15_AI_ALLOWED;
    const previousLive = process.env.V15_LIVE_AI_ALLOWED;
    process.env.V15_AI_ALLOWED = "true";
    process.env.V15_LIVE_AI_ALLOWED = "true";
    try {
      const prisma = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({
            featureFlags: {
              "v15.ai.fakeProvider": true,
              "v15.ai.liveProvider": true,
              "v15.ai.proposal": true,
            },
          }),
        },
      } as unknown as PrismaService;
      await expect(
        new AiFeatureGate().requireFakeProviderForCreate(prisma),
      ).rejects.toMatchObject({ code: "AI_DISABLED" });
    } finally {
      if (previousAi === undefined) delete process.env.V15_AI_ALLOWED;
      else process.env.V15_AI_ALLOWED = previousAi;
      if (previousLive === undefined) delete process.env.V15_LIVE_AI_ALLOWED;
      else process.env.V15_LIVE_AI_ALLOWED = previousLive;
    }
  });
});
