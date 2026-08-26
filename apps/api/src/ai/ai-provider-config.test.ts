import { describe, expect, it } from "vitest";

import {
  AiProviderConfigurationError,
  resolveAiProviderConfiguration,
} from "./ai-provider-config.js";

describe("PR20 Provider Configuration", () => {
  it.each([
    [{}, "fake"],
    [{ AI_PROVIDER: "fake" }, "fake"],
    [{ AI_PROVIDER: " Fake " }, "fake"],
    [{ AI_PROVIDER: "OPENAI" }, "openai"],
    [{ AI_PROVIDER: " deepseek " }, "deepseek"],
  ] as const)("normalizes %o to %s", (environment, selectedProvider) => {
    expect(resolveAiProviderConfiguration(environment)).toEqual({
      selectedProvider,
    });
  });

  it.each(["", "   ", "unknown"])(
    "rejects explicit invalid provider %j",
    (value) => {
      expect(() =>
        resolveAiProviderConfiguration({ AI_PROVIDER: value }),
      ).toThrowError(
        expect.objectContaining<Partial<AiProviderConfigurationError>>({
          category: "INVALID_PROVIDER_CONFIG",
        }),
      );
    },
  );
});
