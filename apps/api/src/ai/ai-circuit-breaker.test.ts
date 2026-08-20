import { describe, expect, it } from "vitest";

import { AiCircuitBreaker } from "./ai-circuit-breaker.js";

describe("PR19 runtime circuit breaker", () => {
  it("opens only at five technical failures and at least a 50% rate", () => {
    const breaker = new AiCircuitBreaker();
    const now = new Date("2026-08-20T00:00:00.000Z");
    for (let index = 0; index < 4; index += 1) {
      const permit = breaker.acquire(now);
      expect(permit.allowed).toBe(true);
      if (permit.allowed)
        breaker.record(permit.permit, "TECHNICAL_FAILURE", now);
    }
    for (let index = 0; index < 5; index += 1) {
      const permit = breaker.acquire(now);
      expect(permit.allowed).toBe(true);
      if (permit.allowed) breaker.record(permit.permit, "SUCCESS", now);
    }
    expect(breaker.snapshot()).toMatchObject({
      sampleCount: 9,
      state: "CLOSED",
      technicalCount: 4,
    });

    const threshold = breaker.acquire(now);
    expect(threshold.allowed).toBe(true);
    if (threshold.allowed) {
      breaker.record(threshold.permit, "TECHNICAL_FAILURE", now);
    }
    expect(breaker.snapshot().state).toBe("OPEN");
    expect(breaker.acquire(new Date(now.getTime() + 59_999))).toEqual({
      allowed: false,
    });
  });

  it("allows exactly one half-open probe and reopens on technical failure", () => {
    const breaker = openedBreaker();
    const probeAt = new Date("2026-08-20T00:01:00.000Z");
    const probe = breaker.acquire(probeAt);
    expect(probe.allowed).toBe(true);
    expect(breaker.snapshot().state).toBe("HALF_OPEN");
    expect(breaker.acquire(probeAt)).toEqual({ allowed: false });
    if (probe.allowed) {
      breaker.record(probe.permit, "TECHNICAL_FAILURE", probeAt);
    }
    expect(breaker.snapshot().state).toBe("OPEN");
    expect(breaker.acquire(new Date(probeAt.getTime() + 59_999))).toEqual({
      allowed: false,
    });
  });

  it.each(["SUCCESS", "NON_TECHNICAL"] as const)(
    "closes and clears old samples after a %s half-open probe",
    (sample) => {
      const breaker = openedBreaker();
      const probeAt = new Date("2026-08-20T00:01:00.000Z");
      const probe = breaker.acquire(probeAt);
      expect(probe.allowed).toBe(true);
      if (probe.allowed) breaker.record(probe.permit, sample, probeAt);
      expect(breaker.snapshot()).toEqual({
        sampleCount: 0,
        state: "CLOSED",
        technicalCount: 0,
      });
    },
  );

  it("ignores a completion fenced by a later OPEN generation", () => {
    const breaker = new AiCircuitBreaker();
    const now = new Date("2026-08-20T00:00:00.000Z");
    const late = breaker.acquire(now);
    expect(late.allowed).toBe(true);
    for (let index = 0; index < 5; index += 1) {
      const permit = breaker.acquire(now);
      expect(permit.allowed).toBe(true);
      if (permit.allowed)
        breaker.record(permit.permit, "TECHNICAL_FAILURE", now);
    }
    expect(breaker.snapshot().state).toBe("OPEN");
    if (late.allowed) breaker.record(late.permit, "SUCCESS", now);
    expect(breaker.snapshot().state).toBe("OPEN");
  });

  it("reopens without a sample when a half-open probe loses its DB boundary", () => {
    const breaker = openedBreaker();
    const probeAt = new Date("2026-08-20T00:01:00.000Z");
    const probe = breaker.acquire(probeAt);
    expect(probe.allowed).toBe(true);
    if (probe.allowed) breaker.abandon(probe.permit, probeAt);
    expect(breaker.snapshot()).toMatchObject({
      sampleCount: 5,
      state: "OPEN",
      technicalCount: 5,
    });
  });
});

function openedBreaker(): AiCircuitBreaker {
  const breaker = new AiCircuitBreaker();
  const now = new Date("2026-08-20T00:00:00.000Z");
  for (let index = 0; index < 5; index += 1) {
    const permit = breaker.acquire(now);
    if (permit.allowed) breaker.record(permit.permit, "TECHNICAL_FAILURE", now);
  }
  expect(breaker.snapshot().state).toBe("OPEN");
  return breaker;
}
