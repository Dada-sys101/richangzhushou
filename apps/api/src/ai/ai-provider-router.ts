import type { AiProviderInput } from "@daily-assistant/api-contracts";

import type { FakeAiProviderResult } from "./fake-provider/fake-ai-provider.types.js";

export interface AiProviderMessage {
  content: string;
  role: "user";
}

export interface AiProviderRequest {
  input: AiProviderInput;
  messages: readonly AiProviderMessage[];
  model: string;
  requestId: string;
}

export interface AiProviderUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiProviderResponse {
  content: FakeAiProviderResult;
  latencyMs: number;
  model: string;
  providerName: string;
  requestId: string;
  usage: AiProviderUsage;
}

export interface AiProviderAdapter {
  modelId(): string;
  providerId(): string;
  execute(request: AiProviderRequest): Promise<AiProviderResponse>;
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
    private readonly fakeAdapter: AiProviderAdapter,
    private readonly selectedProvider: string = "fake",
  ) {}

  select(requestType: string): AiProviderAdapter {
    // Kept for the PR19 call signature; scenario selection belongs to the
    // Fake adapter after the unified request envelope is constructed.
    void requestType;
    if (this.selectedProvider !== "fake") {
      throw new AiRouterSelectionError("UNSUPPORTED_PROVIDER");
    }
    const adapter = this.fakeAdapter;
    let providerId: string;
    let modelId: string;
    try {
      providerId = adapter.providerId();
      modelId = adapter.modelId();
    } catch {
      throw new AiRouterSelectionError("PROVIDER_UNAVAILABLE");
    }
    if (
      !adapter ||
      providerId !== "fake-provider" ||
      typeof modelId !== "string" ||
      modelId.length === 0 ||
      typeof adapter.execute !== "function"
    ) {
      throw new AiRouterSelectionError("INVALID_PROVIDER_CONFIG");
    }
    return adapter;
  }
}
