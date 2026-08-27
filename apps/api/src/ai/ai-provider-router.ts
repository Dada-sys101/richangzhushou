import type { AiProviderInput } from "@daily-assistant/api-contracts";

import type { AiConfiguredProvider } from "./ai-provider-config.js";
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

export interface AiProviderExecutionContext {
  signal?: AbortSignal;
}

export interface AiProviderAdapter {
  modelId(): string;
  providerId(): string;
  execute(
    request: AiProviderRequest,
    context?: AiProviderExecutionContext,
  ): Promise<AiProviderResponse>;
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
    private readonly deepSeekAdapterFactory?: () => AiProviderAdapter,
    private readonly openAiAdapterFactory?: () => AiProviderAdapter,
  ) {}

  select(
    selectedProvider: AiConfiguredProvider,
    requestType: string,
  ): AiProviderAdapter {
    // Scenario selection belongs to the Fake adapter after the unified request
    // envelope is constructed.
    void requestType;
    const adapter =
      selectedProvider === "fake"
        ? this.fakeAdapter
        : selectedProvider === "deepseek"
          ? this.deepSeekAdapterFactory?.()
          : selectedProvider === "openai"
            ? this.openAiAdapterFactory?.()
            : undefined;
    if (!adapter) {
      throw new AiRouterSelectionError(
        selectedProvider === "openai"
          ? "UNSUPPORTED_PROVIDER"
          : "PROVIDER_UNAVAILABLE",
      );
    }
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
      providerId !==
        (selectedProvider === "fake" ? "fake-provider" : selectedProvider) ||
      typeof modelId !== "string" ||
      modelId.length === 0 ||
      typeof adapter.execute !== "function"
    ) {
      throw new AiRouterSelectionError("INVALID_PROVIDER_CONFIG");
    }
    return adapter;
  }
}
