import type { AiProviderInput } from "@daily-assistant/api-contracts";

import { AiFakeProviderFactory } from "./ai-fake-provider.factory.js";
import type { FakeAiProviderResult } from "./fake-provider/fake-ai-provider.types.js";

export interface AiProviderAdapter {
  readonly modelId: string;
  readonly providerId: string;
  generate(
    input: AiProviderInput,
  ): FakeAiProviderResult | Promise<FakeAiProviderResult>;
}

export class AiRouterSelectionError extends Error {
  constructor(
    readonly category:
      | "INVALID_PROVIDER_CONFIG"
      | "PROVIDER_UNAVAILABLE"
      | "UNSUPPORTED_PROVIDER",
  ) {
    super("The configured AI provider is unavailable");
    this.name = "AiRouterSelectionError";
  }
}

/**
 * PR19 has one explicitly authorized route: fake. It never falls back to a
 * live or second provider, and provider selection is not part of ProviderInput.
 */
export class AiProviderRouter {
  constructor(
    private readonly fakeProviderFactory: AiFakeProviderFactory,
    private readonly selectedProvider: string = "fake",
  ) {}

  select(requestType: string): AiProviderAdapter {
    if (this.selectedProvider !== "fake") {
      throw new AiRouterSelectionError("UNSUPPORTED_PROVIDER");
    }
    let adapter: AiProviderAdapter;
    try {
      adapter = this.fakeProviderFactory.create(requestType);
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        throw error;
      }
      throw new AiRouterSelectionError("PROVIDER_UNAVAILABLE");
    }
    if (
      !adapter ||
      adapter.providerId !== "fake-provider" ||
      typeof adapter.modelId !== "string" ||
      adapter.modelId.length === 0 ||
      typeof adapter.generate !== "function"
    ) {
      throw new AiRouterSelectionError("INVALID_PROVIDER_CONFIG");
    }
    return adapter;
  }
}
