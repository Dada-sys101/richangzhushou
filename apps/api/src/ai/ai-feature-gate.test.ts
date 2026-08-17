import "reflect-metadata";

import { describe, expect, it } from "vitest";

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
});
