import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  AI_FAILURE_CATEGORIES,
  AI_LIMITS,
  AiAdapterError,
  CAPTURE_RESPONSE_SCHEMA,
  CapabilityRegistry,
  CircuitBreakerRegistry,
  classifyProviderFailure,
  validateCaptureRequest,
  validateCaptureResponse,
} from "../lib/ai-adapter-core.mjs";

mkdirSync("results", { recursive: true });
const result = {};

function isAiError(error, code) {
  return error instanceof AiAdapterError && error.code === code;
}

function response(overrides = {}) {
  return {
    schemaVersion: 1,
    provider: "provider:model",
    operations: [
      {
        type: "TASK",
        confidence: 0.91,
        fields: { title: "买牛奶" },
        clarification: null,
      },
    ],
    ...overrides,
  };
}

function provider(id, behavior = {}) {
  const calls = { list: 0, probes: [] };
  return {
    id,
    calls,
    async listModels() {
      calls.list += 1;
      return behavior.models ?? [
        { id: `${id}-a`, status: "available" },
        { id: `${id}-b`, status: "available" },
      ];
    },
    async probeCapabilities(modelId) {
      calls.probes.push(modelId);
      return behavior.probe?.(modelId) ?? {
        structuredOutput: true,
        toolCalling: false,
        maxOutputTokens: 8192,
      };
    },
  };
}

test("request and response gates reject invalid size, timezone, context and unsafe output", () => {
  const request = validateCaptureRequest({
    requestId: "request-1",
    text: "明天下午三点提醒我买牛奶",
    locale: "zh-CN",
    timeZone: "Asia/Shanghai",
    context: { source: "quick-capture" },
  });
  assert.equal(request.locale, "zh-CN");
  assert.throws(
    () =>
      validateCaptureRequest({
        ...request,
        text: "x".repeat(AI_LIMITS.maxInputCharacters + 1),
      }),
    (error) => isAiError(error, "AI_INPUT_TOO_LARGE"),
  );
  assert.throws(
    () => validateCaptureRequest({ ...request, timeZone: "Mars/Olympus" }),
    (error) => isAiError(error, "AI_TIME_ZONE_INVALID"),
  );
  assert.throws(
    () =>
      validateCaptureRequest({
        ...request,
        context: { value: "x".repeat(AI_LIMITS.maxContextBytes + 1) },
      }),
    (error) =>
      isAiError(error, "AI_RESPONSE_FIELD_TOO_LARGE") ||
      isAiError(error, "AI_CONTEXT_TOO_LARGE"),
  );

  assert.ok(validateCaptureResponse(response()).outputBytes > 0);
  assert.throws(
    () =>
      validateCaptureResponse({
        ...response(),
        operations: [{ type: "SQL", confidence: 2, fields: {} }],
      }),
    (error) => isAiError(error, "AI_RESPONSE_SCHEMA_INVALID"),
  );
  assert.throws(
    () =>
      validateCaptureResponse({
        ...response(),
        operations: [
          {
            type: "TASK",
            confidence: 0.2,
            fields: { title: "不明确" },
            clarification: null,
          },
        ],
      }),
    (error) => isAiError(error, "AI_RESPONSE_CLARIFICATION_REQUIRED"),
  );
  const unsafe = JSON.parse('{"__proto__":{"admin":true}}');
  assert.throws(
    () =>
      validateCaptureResponse({
        ...response(),
        operations: [
          {
            type: "TASK",
            confidence: 0.9,
            fields: unsafe,
            clarification: null,
          },
        ],
      }),
    (error) => isAiError(error, "AI_RESPONSE_FIELD_KEY_UNSAFE"),
  );
  result.validation = { status: "PASS" };
});

test("capability discovery probes runtime models, caches, expires and invalidates", async () => {
  let nowMs = 1000;
  const mock = provider("dynamic", {
    probe: (modelId) => ({
      structuredOutput: modelId === "dynamic-b",
      toolCalling: modelId === "dynamic-b",
      maxOutputTokens: 4096,
    }),
  });
  const registry = new CapabilityRegistry({ ttlMs: 100, clock: () => nowMs });
  const first = await registry.discover(mock);
  assert.equal(first.modelId, "dynamic-b");
  assert.deepEqual(mock.calls.probes, ["dynamic-a", "dynamic-b"]);
  assert.equal((await registry.discover(mock)).cacheHit, true);
  assert.equal(mock.calls.list, 1);
  nowMs += 101;
  assert.equal((await registry.discover(mock)).cacheHit, false);
  assert.equal(mock.calls.list, 2);
  registry.invalidate("dynamic");
  await registry.discover(mock);
  assert.equal(mock.calls.list, 3);
  result.discovery = { status: "PASS", selectedModel: first.modelId };
});

test("provider failures are classified into authentication, quota, rate and transient categories", () => {
  const auth = new Error("invalid api key");
  auth.statusCode = 401;
  assert.deepEqual(
    classifyProviderFailure(auth).category,
    AI_FAILURE_CATEGORIES.authentication,
  );

  const quota = new Error("insufficient_quota");
  quota.statusCode = 429;
  quota.code = "insufficient_quota";
  const quotaResult = classifyProviderFailure(quota);
  assert.equal(quotaResult.category, AI_FAILURE_CATEGORIES.quota);
  assert.equal(quotaResult.retryable, false);

  const rate = new Error("rate limited");
  rate.statusCode = 429;
  assert.equal(classifyProviderFailure(rate).retryable, true);

  const transient = new Error("service unavailable");
  transient.statusCode = 503;
  assert.equal(
    classifyProviderFailure(transient).category,
    AI_FAILURE_CATEGORIES.transient,
  );
  result.classification = { status: "PASS" };
});

test("circuit breaker opens after bounded transient failures and recovers after cooldown", () => {
  let nowMs = 1000;
  const breakers = new CircuitBreakerRegistry({
    failureThreshold: 3,
    cooldownMs: 100,
    clock: () => nowMs,
  });
  const failure = {
    category: AI_FAILURE_CATEGORIES.transient,
    retryable: true,
  };
  breakers.recordFailure("primary", failure);
  breakers.recordFailure("primary", failure);
  assert.equal(breakers.state("primary").isOpen, false);
  breakers.recordFailure("primary", failure);
  assert.equal(breakers.state("primary").isOpen, true);
  nowMs += 101;
  assert.equal(breakers.state("primary").isOpen, false);
  result.circuitBreaker = { status: "PASS" };
});

test.after(() => {
  writeFileSync(
    "results/06-ai-adapter-core.json",
    JSON.stringify({ schema: CAPTURE_RESPONSE_SCHEMA, ...result }, null, 2),
  );
});
