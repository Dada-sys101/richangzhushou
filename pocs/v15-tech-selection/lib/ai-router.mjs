import {
  AI_FAILURE_CATEGORIES,
  AI_LIMITS,
  AI_RESULT_STATES,
  AiAdapterError,
  aiError,
  classifyProviderFailure,
  nonEmpty,
  validateCaptureRequest,
  validateCaptureResponse,
} from "./ai-adapter-schema.mjs";
import {
  CapabilityRegistry,
  CircuitBreakerRegistry,
} from "./ai-capability.mjs";

function withTimeout(task, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      const error = new Error("AI_PROVIDER_TIMEOUT");
      error.name = "TimeoutError";
      error.code = "ETIMEDOUT";
      reject(error);
    }, timeoutMs);
    Promise.resolve()
      .then(() => task(controller.signal))
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = Number(usage.inputTokens ?? usage.promptTokens ?? 0);
  const outputTokens = Number(usage.outputTokens ?? usage.completionTokens ?? 0);
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0
  ) {
    return null;
  }
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

function normalizeProviderResult(value) {
  if (value && typeof value === "object" && "response" in value) {
    return { response: value.response, usage: normalizeUsage(value.usage) };
  }
  return { response: value, usage: null };
}

function requireRepository(repository) {
  for (const method of ["claimAiRequest", "recordAiAttempt", "recordAiResult"]) {
    if (typeof repository?.[method] !== "function") {
      throw aiError("AI_REPOSITORY_METHOD_MISSING", { method });
    }
  }
}

export class AiRouter {
  #breakers;
  #capabilities;
  #clock;
  #providers;
  #repository;
  #timeoutMs;

  constructor({
    providers,
    repository,
    capabilityRegistry = new CapabilityRegistry(),
    circuitBreakers = new CircuitBreakerRegistry(),
    timeoutMs = AI_LIMITS.providerTimeoutMs,
    clock = () => Date.now(),
  }) {
    if (!Array.isArray(providers) || providers.length === 0) {
      throw aiError("AI_PROVIDERS_REQUIRED");
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
      throw aiError("AI_PROVIDER_TIMEOUT_INVALID", { timeoutMs });
    }
    requireRepository(repository);
    this.#providers = providers;
    this.#repository = repository;
    this.#capabilities = capabilityRegistry;
    this.#breakers = circuitBreakers;
    this.#timeoutMs = timeoutMs;
    this.#clock = clock;
  }

  async capture(rawRequest) {
    const request = validateCaptureRequest(rawRequest);
    const claim = await this.#repository.claimAiRequest({
      requestId: request.requestId,
      operation: "CAPTURE",
    });
    if (claim === false || claim?.claimed === false) {
      const result = {
        state: AI_RESULT_STATES.duplicate,
        requestId: request.requestId,
        requiresConfirmation: true,
        proposal: claim?.existingResult ?? null,
        attempts: [],
      };
      await this.#repository.recordAiResult(result);
      return result;
    }

    const attempts = [];
    for (const provider of this.#providers.slice(0, AI_LIMITS.maxProviderAttempts)) {
      const providerId = nonEmpty("provider.id", provider?.id);
      const circuit = this.#breakers.state(providerId);
      if (circuit.isOpen) {
        attempts.push({
          providerId,
          state: "SKIPPED",
          failure: {
            code: "AI_PROVIDER_CIRCUIT_OPEN",
            category: AI_FAILURE_CATEGORIES.circuitOpen,
            retryable: true,
          },
          openUntilMs: circuit.openUntilMs,
        });
        continue;
      }

      const startedAtMs = this.#clock();
      let capability;
      try {
        capability = await this.#capabilities.discover(provider);
        await this.#repository.recordAiAttempt({
          requestId: request.requestId,
          providerId,
          modelId: capability.modelId,
          state: "STARTED",
          startedAtMs,
        });
        if (typeof provider.capture !== "function") {
          throw aiError("AI_PROVIDER_CAPTURE_INTERFACE_INVALID", {
            category: AI_FAILURE_CATEGORIES.unsupported,
            providerId,
          });
        }
        const raw = await withTimeout(
          (signal) =>
            provider.capture({
              request,
              modelId: capability.modelId,
              capabilities: capability,
              signal,
            }),
          this.#timeoutMs,
        );
        const normalized = normalizeProviderResult(raw);
        const validated = validateCaptureResponse(normalized.response);
        const completedAtMs = this.#clock();
        const attempt = {
          providerId,
          modelId: capability.modelId,
          state: "SUCCEEDED",
          latencyMs: Math.max(0, completedAtMs - startedAtMs),
          usage: normalized.usage,
          outputBytes: validated.outputBytes,
        };
        attempts.push(attempt);
        await this.#repository.recordAiAttempt({
          requestId: request.requestId,
          ...attempt,
          completedAtMs,
        });
        this.#breakers.recordSuccess(providerId);
        const result = {
          state: AI_RESULT_STATES.proposed,
          requestId: request.requestId,
          requiresConfirmation: true,
          selectedProvider: { providerId, modelId: capability.modelId },
          proposal: validated.response,
          attempts,
        };
        await this.#repository.recordAiResult(result);
        return result;
      } catch (error) {
        const classification = classifyProviderFailure(error);
        const completedAtMs = this.#clock();
        const attempt = {
          providerId,
          modelId: capability?.modelId ?? null,
          state: "FAILED",
          latencyMs: Math.max(0, completedAtMs - startedAtMs),
          failure: classification,
        };
        attempts.push(attempt);
        await this.#repository.recordAiAttempt({
          requestId: request.requestId,
          ...attempt,
          completedAtMs,
        });
        this.#breakers.recordFailure(providerId, classification);
      }
    }

    const retryable = attempts.some((attempt) => attempt.failure?.retryable);
    const lastCategory =
      attempts.at(-1)?.failure?.category ?? AI_FAILURE_CATEGORIES.unknown;
    const result = {
      state: AI_RESULT_STATES.rejected,
      requestId: request.requestId,
      requiresConfirmation: true,
      proposal: null,
      attempts,
      failure: { code: "AI_ALL_PROVIDERS_FAILED", retryable },
    };
    await this.#repository.recordAiResult(result);
    throw new AiAdapterError("AI_ALL_PROVIDERS_FAILED", {
      category: retryable ? AI_FAILURE_CATEGORIES.transient : lastCategory,
      retryable,
      attempts,
    });
  }
}
