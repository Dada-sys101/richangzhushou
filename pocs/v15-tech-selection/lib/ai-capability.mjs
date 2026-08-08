import {
  AI_FAILURE_CATEGORIES,
  AI_LIMITS,
  aiError,
  nonEmpty,
} from "./ai-adapter-schema.mjs";

function validateCapabilities(providerId, modelId, capabilities) {
  const maxOutputTokens = Number(capabilities?.maxOutputTokens);
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1) {
    throw aiError("AI_CAPABILITY_PROBE_INVALID", {
      category: AI_FAILURE_CATEGORIES.unsupported,
      providerId,
      modelId,
    });
  }
  return {
    modelId,
    structuredOutput: capabilities.structuredOutput === true,
    toolCalling: capabilities.toolCalling === true,
    maxOutputTokens,
  };
}

export class CapabilityRegistry {
  #cache = new Map();
  #clock;
  #ttlMs;

  constructor({ ttlMs = AI_LIMITS.capabilityTtlMs, clock = () => Date.now() } = {}) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
      throw aiError("AI_CAPABILITY_TTL_INVALID", { ttlMs });
    }
    this.#ttlMs = ttlMs;
    this.#clock = clock;
  }

  invalidate(providerId) {
    if (providerId) this.#cache.delete(providerId);
    else this.#cache.clear();
  }

  peek(providerId) {
    const entry = this.#cache.get(providerId);
    return entry ? structuredClone(entry) : null;
  }

  async discover(provider, { force = false } = {}) {
    const providerId = nonEmpty("provider.id", provider?.id);
    const nowMs = this.#clock();
    const cached = this.#cache.get(providerId);
    if (!force && cached && cached.expiresAtMs > nowMs) {
      return { ...structuredClone(cached.capabilities), cacheHit: true };
    }
    if (
      typeof provider.listModels !== "function" ||
      typeof provider.probeCapabilities !== "function"
    ) {
      throw aiError("AI_PROVIDER_DISCOVERY_INTERFACE_INVALID", {
        category: AI_FAILURE_CATEGORIES.unsupported,
        providerId,
      });
    }
    const models = await provider.listModels();
    const candidates = Array.isArray(models)
      ? models.filter(
          (model) =>
            model &&
            typeof model.id === "string" &&
            model.id.length > 0 &&
            model.status === "available",
        )
      : [];
    if (candidates.length === 0) {
      throw aiError("AI_PROVIDER_NO_AVAILABLE_MODEL", {
        category: AI_FAILURE_CATEGORIES.unsupported,
        providerId,
      });
    }

    const probes = [];
    for (const candidate of candidates) {
      try {
        const capabilities = validateCapabilities(
          providerId,
          candidate.id,
          await provider.probeCapabilities(candidate.id),
        );
        probes.push(capabilities);
        if (capabilities.structuredOutput) {
          const selected = {
            providerId,
            ...capabilities,
            discoveredAtMs: nowMs,
          };
          this.#cache.set(providerId, {
            capabilities: selected,
            expiresAtMs: nowMs + this.#ttlMs,
          });
          return { ...structuredClone(selected), cacheHit: false };
        }
      } catch (error) {
        probes.push({ modelId: candidate.id, error: error.message });
      }
    }
    throw aiError("AI_PROVIDER_STRUCTURED_OUTPUT_UNAVAILABLE", {
      category: AI_FAILURE_CATEGORIES.unsupported,
      providerId,
      probes,
    });
  }
}

export class CircuitBreakerRegistry {
  #clock;
  #entries = new Map();
  #failureThreshold;
  #cooldownMs;

  constructor({
    failureThreshold = AI_LIMITS.circuitFailureThreshold,
    cooldownMs = AI_LIMITS.circuitCooldownMs,
    clock = () => Date.now(),
  } = {}) {
    if (!Number.isSafeInteger(failureThreshold) || failureThreshold < 1) {
      throw aiError("AI_CIRCUIT_THRESHOLD_INVALID", { failureThreshold });
    }
    if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 1) {
      throw aiError("AI_CIRCUIT_COOLDOWN_INVALID", { cooldownMs });
    }
    this.#failureThreshold = failureThreshold;
    this.#cooldownMs = cooldownMs;
    this.#clock = clock;
  }

  state(providerId) {
    const entry = this.#entries.get(providerId) ?? {
      failures: 0,
      openUntilMs: 0,
    };
    return { ...entry, isOpen: entry.openUntilMs > this.#clock() };
  }

  recordSuccess(providerId) {
    this.#entries.set(providerId, { failures: 0, openUntilMs: 0 });
  }

  recordFailure(providerId, classification) {
    if (
      ![
        AI_FAILURE_CATEGORIES.timeout,
        AI_FAILURE_CATEGORIES.transient,
        AI_FAILURE_CATEGORIES.rateLimit,
      ].includes(classification.category)
    ) {
      return this.state(providerId);
    }
    const current = this.state(providerId);
    const failures = current.failures + 1;
    const openUntilMs =
      failures >= this.#failureThreshold
        ? this.#clock() + this.#cooldownMs
        : 0;
    this.#entries.set(providerId, { failures, openUntilMs });
    return this.state(providerId);
  }
}
