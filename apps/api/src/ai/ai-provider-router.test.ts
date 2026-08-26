import { describe, expect, it, vi } from "vitest";

import { AiFakeProviderFactory } from "./ai-fake-provider.factory.js";
import { FakeAiProviderAdapter } from "./fake-provider/fake-ai-provider.adapter.js";
import {
  AiProviderRouter,
  AiRouterSelectionError,
} from "./ai-provider-router.js";

describe("PR19 deterministic provider selection boundary", () => {
  it.each([
    "TRANSACTION",
    "CALENDAR_EVENT",
    "TASK",
    "REMINDER",
    "TRIP",
  ] as const)(
    "selects only the explicit fake adapter for %s",
    (requestType) => {
      const adapter = new AiProviderRouter(
        new FakeAiProviderAdapter(new AiFakeProviderFactory()),
      ).select("fake", requestType);
      expect(adapter.providerId()).toBe("fake-provider");
      expect(adapter.modelId()).toBe("fake-model");
    },
  );

  it.each(["openai", "deepseek"] as const)(
    "rejects unsupported provider %s without fake fallback",
    (selectedProvider) => {
      const execute = vi.fn();
      const router = new AiProviderRouter({
        execute,
        modelId: () => "fake-model",
        providerId: () => "fake-provider",
      });
      expect(() => router.select(selectedProvider, "TASK")).toThrowError(
        expect.objectContaining<Partial<AiRouterSelectionError>>({
          category: "UNSUPPORTED_PROVIDER",
        }),
      );
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it("fails closed for an unavailable or invalid fake adapter", () => {
    expect(() =>
      new AiProviderRouter({
        execute: vi.fn(),
        modelId: () => "fake-model",
        providerId: () => {
          throw new Error("unavailable");
        },
      }).select("fake", "TASK"),
    ).toThrowError(
      expect.objectContaining({ category: "PROVIDER_UNAVAILABLE" }),
    );

    expect(() =>
      new AiProviderRouter({
        execute: vi.fn(),
        modelId: () => "unexpected-model",
        providerId: () => "live-provider",
      }).select("fake", "TASK"),
    ).toThrowError(
      expect.objectContaining({ category: "INVALID_PROVIDER_CONFIG" }),
    );
  });
});
