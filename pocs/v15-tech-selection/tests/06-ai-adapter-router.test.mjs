import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  AI_FAILURE_CATEGORIES,
  AI_LIMITS,
  AI_RESULT_STATES,
  AiAdapterError,
  AiRouter,
  CircuitBreakerRegistry,
} from "../lib/ai-adapter-core.mjs";

mkdirSync("results", { recursive: true });
const result = {};

function response(provider) {
  return {
    schemaVersion: 1,
    provider,
    operations: [
      {
        type: "TASK",
        confidence: 0.91,
        fields: { title: "买牛奶" },
        clarification: null,
      },
    ],
  };
}

function provider(id, behavior = {}) {
  const calls = { list: 0, captures: 0 };
  return {
    id,
    calls,
    async listModels() {
      calls.list += 1;
      return [{ id: `${id}-runtime`, status: "available" }];
    },
    async probeCapabilities() {
      return {
        structuredOutput: true,
        toolCalling: false,
        maxOutputTokens: 8192,
      };
    },
    async capture(input) {
      calls.captures += 1;
      return behavior.capture
        ? behavior.capture(input)
        : {
            response: response(`${id}:${input.modelId}`),
            usage: { inputTokens: 10, outputTokens: 20 },
          };
    },
  };
}

function repository({ claimed = true, existingResult = null } = {}) {
  const calls = { claims: [], attempts: [], results: [] };
  return {
    calls,
    value: {
      async claimAiRequest(input) {
        calls.claims.push(input);
        return claimed ? { claimed: true } : { claimed: false, existingResult };
      },
      async recordAiAttempt(input) {
        calls.attempts.push(input);
      },
      async recordAiResult(input) {
        calls.results.push(input);
      },
    },
  };
}

function request(requestId) {
  return {
    requestId,
    text: "明天下午三点提醒我买牛奶",
    locale: "zh-CN",
    timeZone: "Asia/Shanghai",
    context: { source: "quick-capture" },
  };
}

test("router falls back from transient primary failure and audits provider, model and usage", async () => {
  const primary = provider("primary", {
    capture: async () => {
      const error = new Error("service unavailable");
      error.statusCode = 503;
      throw error;
    },
  });
  const fallback = provider("fallback");
  const audit = repository();
  let nowMs = 10_000;
  const router = new AiRouter({
    providers: [primary, fallback],
    repository: audit.value,
    clock: () => nowMs++,
  });
  const output = await router.capture(request("fallback-request"));
  assert.equal(output.state, AI_RESULT_STATES.proposed);
  assert.equal(output.requiresConfirmation, true);
  assert.equal(output.selectedProvider.providerId, "fallback");
  assert.equal(
    output.attempts[0].failure.category,
    AI_FAILURE_CATEGORIES.transient,
  );
  assert.deepEqual(output.attempts[1].usage, {
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
  });
  assert.equal(audit.calls.results.at(-1).state, AI_RESULT_STATES.proposed);
  result.failover = {
    status: "PASS",
    selectedProvider: output.selectedProvider,
  };
});

test("invalid response is isolated and valid fallback may still produce a proposal", async () => {
  const invalid = provider("invalid", {
    capture: async () => ({
      response: {
        schemaVersion: 1,
        provider: "invalid",
        operations: [{ type: "SQL", confidence: 2, fields: {} }],
      },
    }),
  });
  const fallback = provider("valid-fallback");
  const audit = repository();
  const output = await new AiRouter({
    providers: [invalid, fallback],
    repository: audit.value,
  }).capture(request("invalid-response"));
  assert.equal(output.selectedProvider.providerId, "valid-fallback");
  assert.equal(
    output.attempts[0].failure.category,
    AI_FAILURE_CATEGORIES.invalidResponse,
  );
  result.schemaIsolation = { status: "PASS" };
});

test("provider timeout falls back and late output cannot create an extra proposal", async () => {
  const slow = provider("slow", {
    capture: async () => new Promise(() => {}),
  });
  const fast = provider("fast");
  const audit = repository();
  const output = await new AiRouter({
    providers: [slow, fast],
    repository: audit.value,
    timeoutMs: 10,
  }).capture(request("timeout-request"));
  assert.equal(output.selectedProvider.providerId, "fast");
  assert.equal(
    output.attempts[0].failure.category,
    AI_FAILURE_CATEGORIES.timeout,
  );
  assert.equal(
    audit.calls.results.filter(
      (item) => item.state === AI_RESULT_STATES.proposed,
    ).length,
    1,
  );
  result.timeout = { status: "PASS" };
});

test("open circuit skips provider and duplicate claim skips all providers", async () => {
  let nowMs = 1000;
  const breakers = new CircuitBreakerRegistry({
    failureThreshold: 1,
    cooldownMs: 100,
    clock: () => nowMs,
  });
  breakers.recordFailure("primary", {
    category: AI_FAILURE_CATEGORIES.transient,
    retryable: true,
  });
  const primary = provider("primary");
  const fallback = provider("circuit-fallback");
  const audit = repository();
  const output = await new AiRouter({
    providers: [primary, fallback],
    repository: audit.value,
    circuitBreakers: breakers,
  }).capture(request("circuit-request"));
  assert.equal(output.selectedProvider.providerId, "circuit-fallback");
  assert.equal(
    output.attempts[0].failure.category,
    AI_FAILURE_CATEGORIES.circuitOpen,
  );
  assert.equal(primary.calls.captures, 0);

  const existing = { proposalId: "proposal-1" };
  const duplicateAudit = repository({
    claimed: false,
    existingResult: existing,
  });
  const unused = provider("unused");
  const duplicate = await new AiRouter({
    providers: [unused],
    repository: duplicateAudit.value,
  }).capture(request("duplicate-request"));
  assert.equal(duplicate.state, AI_RESULT_STATES.duplicate);
  assert.deepEqual(duplicate.proposal, existing);
  assert.equal(unused.calls.list, 0);
  result.idempotencyAndCircuit = { status: "PASS" };
});

test("router bounds provider attempts and records rejection before all-provider failure", async () => {
  const providers = Array.from({ length: 4 }, (_, index) =>
    provider(`failure-${index}`, {
      capture: async () => {
        const error = new Error("unavailable");
        error.statusCode = 503;
        throw error;
      },
    }),
  );
  const audit = repository();
  const router = new AiRouter({ providers, repository: audit.value });
  await assert.rejects(
    () => router.capture(request("all-failed")),
    (error) =>
      error instanceof AiAdapterError &&
      error.code === "AI_ALL_PROVIDERS_FAILED" &&
      error.retryable === true &&
      error.details.attempts.length === AI_LIMITS.maxProviderAttempts,
  );
  assert.equal(providers[3].calls.captures, 0);
  assert.equal(audit.calls.results.at(-1).state, AI_RESULT_STATES.rejected);
  result.allFailed = {
    status: "PASS",
    attemptLimit: AI_LIMITS.maxProviderAttempts,
  };
});

test("AI output remains confirmation-required and never calls a business-write method", async () => {
  const audit = repository();
  let businessWrites = 0;
  audit.value.writeBusinessEntity = async () => {
    businessWrites += 1;
  };
  const output = await new AiRouter({
    providers: [provider("proposal-only")],
    repository: audit.value,
  }).capture(request("proposal-boundary"));
  assert.equal(output.state, AI_RESULT_STATES.proposed);
  assert.equal(output.requiresConfirmation, true);
  assert.equal(businessWrites, 0);
  result.writeBoundary = {
    status: "PASS",
    rule: "AI output is a proposal; confirmation is required before business writes",
  };
});

test.after(() => {
  writeFileSync(
    "results/06-ai-adapter-router.json",
    JSON.stringify(result, null, 2),
  );
});
