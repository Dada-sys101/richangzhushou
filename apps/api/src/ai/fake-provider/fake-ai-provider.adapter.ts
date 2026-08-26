import { AiFakeProviderFactory } from "../ai-fake-provider.factory.js";
import type {
  AiProviderAdapter,
  AiProviderRequest,
  AiProviderResponse,
} from "../ai-provider-router.js";
import {
  FAKE_AI_MODEL_ID,
  FAKE_AI_PROVIDER_ID,
} from "./fake-ai-provider.types.js";

/**
 * PR20 protocol adapter for the existing deterministic FakeAiProvider.
 * It translates the shared adapter envelope only; scenarios and Fake Provider
 * behavior remain owned by the existing factory and provider implementation.
 */
export class FakeAiProviderAdapter implements AiProviderAdapter {
  constructor(private readonly fakeProviderFactory: AiFakeProviderFactory) {}

  modelId(): string {
    return FAKE_AI_MODEL_ID;
  }

  providerId(): string {
    return FAKE_AI_PROVIDER_ID;
  }

  async execute(request: AiProviderRequest): Promise<AiProviderResponse> {
    const provider = this.fakeProviderFactory.create(request.input.requestType);
    return {
      content: await provider.generate(request.input),
      latencyMs: 0,
      model: provider.modelId,
      providerName: provider.providerId,
      requestId: request.requestId,
      usage: { inputTokens: null, outputTokens: null },
    };
  }
}
