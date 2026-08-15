import http from "node:http";
import https from "node:https";

import { describe, expect, it, vi } from "vitest";

import {
  AI_PROVIDER_INPUT_ALLOWED_FIELDS,
  type AiProviderInput,
  type AiOperationType,
} from "@daily-assistant/api-contracts";

import {
  FakeAiProvider,
  FakeAiProviderError,
} from "./fake-ai-provider.js";
import {
  FAKE_AI_MODEL_ID,
  FAKE_AI_PROVIDER_ID,
  type FakeAiProviderScenario,
} from "./fake-ai-provider.types.js";

const SUCCESS_SCENARIOS = [
  "TRANSACTION_SUCCESS",
  "CALENDAR_EVENT_SUCCESS",
  "TASK_SUCCESS",
  "REMINDER_SUCCESS",
  "TRIP_SUCCESS",
] as const satisfies readonly FakeAiProviderScenario[];

const ALL_SCENARIOS = [
  ...SUCCESS_SCENARIOS,
  "UNCERTAIN",
  "CONTROLLED_FAILURE",
] as const satisfies readonly FakeAiProviderScenario[];

function createInput(
  overrides: Partial<AiProviderInput> = {},
): AiProviderInput {
  return {
    userInput: "明天下午三点和产品团队开会",
    requestType: "CALENDAR_EVENT",
    locale: "zh-CN",
    timeZoneId: "Asia/Shanghai",
    currentDateTime: "2026-08-14T00:00:00.000Z",
    currency: "CNY",
    allowedCategoryLabels: [],
    explicitSelectedContext: [],
    ...overrides,
  };
}

describe("PR18 Fake AI Provider", () => {
  it("TEST-01: is deterministic for identical input and configuration", () => {
    for (const scenario of SUCCESS_SCENARIOS) {
      const provider = new FakeAiProvider({ scenario });
      const input = createInput();
      const first = provider.generate(input);
      const second = provider.generate(input);
      expect(second).toEqual(first);
    }
  });

  it("TEST-02: covers all five frozen operation types", () => {
    const expectations: Array<[FakeAiProviderScenario, AiOperationType]> = [
      ["TRANSACTION_SUCCESS", "TRANSACTION"],
      ["CALENDAR_EVENT_SUCCESS", "CALENDAR_EVENT"],
      ["TASK_SUCCESS", "TASK"],
      ["REMINDER_SUCCESS", "REMINDER"],
      ["TRIP_SUCCESS", "TRIP"],
    ];
    for (const [scenario, operationType] of expectations) {
      const result = new FakeAiProvider({ scenario }).generate(createInput());
      expect(result.resultType).toBe("SUCCESS");
      if (result.resultType === "SUCCESS") {
        expect(result.operations).toHaveLength(1);
        expect(result.operations[0]?.operationType).toBe(operationType);
        expect(result.operations[0]?.status).toBe("PENDING");
        expect(result.operations[0]?.confidence).toMatch(/^0\.\d{4}$/);
        expect(result.operations[0]?.fields).toBeTruthy();
      }
    }
  });

  it("TEST-03: exposes a stable uncertain / clarification scenario", () => {
    const input = createInput({ userInput: "明天下午提醒我" });
    const provider = new FakeAiProvider({ scenario: "UNCERTAIN" });

    const first = provider.generate(input);
    const second = provider.generate(input);

    expect(first.resultType).toBe("UNCERTAIN");
    expect(second).toEqual(first);
    if (first.resultType === "UNCERTAIN") {
      expect(first.operations).toEqual([]);
      expect(first.clarification.length).toBeGreaterThan(0);
      expect(first.missingFields).toContain("title");
    }
  });

  it("TEST-04: fails deterministically and reproducibly without a real network", () => {
    const input = createInput();
    const run = (): FakeAiProviderError => {
      try {
        new FakeAiProvider({
          scenario: "CONTROLLED_FAILURE",
        }).generate(input);
      } catch (error) {
        expect(error).toBeInstanceOf(FakeAiProviderError);
        return error as FakeAiProviderError;
      }
      throw new Error("expected CONTROLLED_FAILURE to throw");
    };

    const first = run();
    const second = run();

    expect(first.errorCode).toBe("AI_PROVIDER_ERROR");
    expect(first.errorCategory).toBe("CONTROLLED_FAILURE");
    expect(first.providerId).toBe(FAKE_AI_PROVIDER_ID);
    expect(first.modelId).toBe(FAKE_AI_MODEL_ID);
    expect(first.message.length).toBeGreaterThan(0);
    expect({
      errorCategory: second.errorCategory,
      errorCode: second.errorCode,
      message: second.message,
      providerId: second.providerId,
      modelId: second.modelId,
    }).toEqual({
      errorCategory: first.errorCategory,
      errorCode: first.errorCode,
      message: first.message,
      providerId: first.providerId,
      modelId: first.modelId,
    });
  });

  it("TEST-05: never mutates the AiProviderInput", () => {
    for (const scenario of ALL_SCENARIOS) {
      const provider = new FakeAiProvider({ scenario });
      const input = createInput();
      const snapshot = structuredClone(input);
      try {
        provider.generate(input);
      } catch {
        // CONTROLLED_FAILURE throws by design; input must still be intact.
      }
      expect(input).toEqual(snapshot);
    }
  });

  it("TEST-06: never auto-accepts or auto-applies any operation", () => {
    for (const scenario of SUCCESS_SCENARIOS) {
      const result = new FakeAiProvider({ scenario }).generate(createInput());
      expect(result.resultType).toBe("SUCCESS");
      if (result.resultType === "SUCCESS") {
        for (const operation of result.operations) {
          expect(operation.status).toBe("PENDING");
          expect(operation.status).not.toBe("ACCEPTED");
          expect(operation.status).not.toBe("APPLIED");
        }
      }
    }
  });

  it("TEST-07: performs no network access", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => {
        throw new Error("network access attempted");
      });
    const httpSpy = vi.spyOn(http, "request");
    const httpsSpy = vi.spyOn(https, "request");

    try {
      for (const scenario of ALL_SCENARIOS) {
        const provider = new FakeAiProvider({ scenario });
        try {
          provider.generate(createInput());
        } catch {
          // CONTROLLED_FAILURE throws by design.
        }
      }
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(httpSpy).not.toHaveBeenCalled();
      expect(httpsSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      httpSpy.mockRestore();
      httpsSpy.mockRestore();
    }
  });

  it("TEST-08: preserves the frozen provider input whitelist", () => {
    const accessedKeys = new Set<string>();
    const input = createInput();
    const proxiedInput = new Proxy(input, {
      get(target, property) {
        if (typeof property === "string") {
          accessedKeys.add(property);
        }
        return Reflect.get(target, property);
      },
    });

    for (const scenario of ALL_SCENARIOS) {
      const provider = new FakeAiProvider({ scenario });
      try {
        provider.generate(proxiedInput);
      } catch {
        // CONTROLLED_FAILURE throws by design.
      }
    }

    for (const key of accessedKeys) {
      expect(AI_PROVIDER_INPUT_ALLOWED_FIELDS).toContain(key);
    }
    expect(accessedKeys.size).toBeGreaterThan(0);
  });
});

// Compile-time whitelist lock: AiProviderInput must not gain extra fields.
type ExtraProviderInputKeys = Exclude<
  keyof AiProviderInput,
  (typeof AI_PROVIDER_INPUT_ALLOWED_FIELDS)[number]
>;
type AssertTrue<T extends true> = T;
type _ProviderWhitelistLocked = AssertTrue<
  [ExtraProviderInputKeys] extends [never] ? true : false
>;
void (null as unknown as _ProviderWhitelistLocked);
