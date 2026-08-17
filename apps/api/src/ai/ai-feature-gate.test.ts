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
