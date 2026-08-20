import { describe, expect, it, vi } from "vitest";

import { AiFakeProviderFactory } from "./ai-fake-provider.factory.js";
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
      const adapter = new AiProviderRouter(new AiFakeProviderFactory()).select(
        requestType,
      );
      expect(adapter).toMatchObject({
        modelId: "fake-model",
        providerId: "fake-provider",
      });
    },
  );

  it("rejects an unsupported configured provider without fake fallback", () => {
    const create = vi.fn();
    const router = new AiProviderRouter(
      { create } as unknown as AiFakeProviderFactory,
      "live-provider",
    );
    expect(() => router.select("TASK")).toThrowError(
      expect.objectContaining<Partial<AiRouterSelectionError>>({
        category: "UNSUPPORTED_PROVIDER",
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("fails closed for an unavailable or invalid fake adapter", () => {
    expect(() =>
      new AiProviderRouter({
        create: () => {
          throw new Error("unavailable");
        },
      } as unknown as AiFakeProviderFactory).select("TASK"),
    ).toThrowError(
      expect.objectContaining({ category: "PROVIDER_UNAVAILABLE" }),
    );

    expect(() =>
      new AiProviderRouter({
        create: () => ({
          generate: vi.fn(),
          modelId: "unexpected-model",
          providerId: "live-provider",
        }),
      } as unknown as AiFakeProviderFactory).select("TASK"),
    ).toThrowError(
      expect.objectContaining({ category: "INVALID_PROVIDER_CONFIG" }),
    );
  });
});
