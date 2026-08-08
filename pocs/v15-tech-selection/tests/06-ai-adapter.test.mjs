import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import Ajv from "ajv";

mkdirSync("results", { recursive: true });
const ajv = new Ajv({ allErrors: true, strict: true });
const captureResponseSchema = {
  $id: "https://daily-assistant.local/schemas/capture-response-v1.json",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "operations", "provider"],
  properties: {
    schemaVersion: { const: 1 },
    provider: { type: "string", minLength: 1 },
    operations: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "confidence", "fields"],
        properties: {
          type: { enum: ["TRANSACTION", "CALENDAR_EVENT", "TASK", "REMINDER", "TRIP"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          fields: { type: "object" },
          clarification: { type: ["string", "null"] },
        },
      },
    },
  },
};
const validate = ajv.compile(captureResponseSchema);

class ProviderUnavailableError extends Error {}

class MockProvider {
  constructor(id, behavior) {
    this.id = id;
    this.behavior = behavior;
    this.capabilities = null;
  }
  async discoverCapabilities() {
    const models = await this.behavior.listModels();
    const candidate = models.find((model) => model.status === "available");
    if (!candidate) throw new ProviderUnavailableError(`${this.id}: no available model`);
    const probes = await this.behavior.probe(candidate.id);
    this.capabilities = {
      discoveredAt: new Date().toISOString(),
      modelId: candidate.id,
      structuredOutput: probes.structuredOutput,
      toolCalling: probes.toolCalling,
      maxOutputTokens: probes.maxOutputTokens,
    };
    return this.capabilities;
  }
  async capture(request) {
    if (!this.capabilities) await this.discoverCapabilities();
    return this.behavior.capture(request, this.capabilities);
  }
}

class AiRouter {
  constructor(providers) {
    this.providers = providers;
  }
  async capture(request) {
    const failures = [];
    for (const provider of this.providers) {
      try {
        const response = await provider.capture(request);
        if (!validate(response)) {
          throw new Error(`SCHEMA_INVALID: ${ajv.errorsText(validate.errors)}`);
        }
        return { response, failures };
      } catch (error) {
        failures.push({ provider: provider.id, error: error.message });
      }
    }
    throw new AggregateError(failures.map((failure) => new Error(failure.error)), "ALL_PROVIDERS_FAILED");
  }
}

const result = {};

test("capability discovery uses model listing plus live probes, not hard-coded model names", async () => {
  const deepSeek = new MockProvider("deepseek", {
    listModels: async () => [{ id: "server-selected-model-2026-08", status: "available" }],
    probe: async (modelId) => ({ modelId, structuredOutput: true, toolCalling: false, maxOutputTokens: 8192 }),
    capture: async (_request, caps) => ({
      schemaVersion: 1,
      provider: `deepseek:${caps.modelId}`,
      operations: [{ type: "TRANSACTION", confidence: 0.98, fields: { amountMinor: 1280, direction: "EXPENSE" }, clarification: null }],
    }),
  });
  const caps = await deepSeek.discoverCapabilities();
  assert.equal(caps.modelId, "server-selected-model-2026-08");
  assert.equal(caps.structuredOutput, true);
  result.discovery = { status: "PASS", caps };
});

test("router falls back when primary API is unavailable and validates unified schema", async () => {
  const primary = new MockProvider("openai", {
    listModels: async () => [{ id: "primary-current", status: "available" }],
    probe: async () => ({ structuredOutput: true, toolCalling: true, maxOutputTokens: 16384 }),
    capture: async () => { throw new ProviderUnavailableError("HTTP_503"); },
  });
  const fallback = new MockProvider("deepseek", {
    listModels: async () => [{ id: "fallback-current", status: "available" }],
    probe: async () => ({ structuredOutput: true, toolCalling: false, maxOutputTokens: 8192 }),
    capture: async (_request, caps) => ({
      schemaVersion: 1,
      provider: `deepseek:${caps.modelId}`,
      operations: [{ type: "TASK", confidence: 0.91, fields: { title: "买牛奶" }, clarification: null }],
    }),
  });
  const router = new AiRouter([primary, fallback]);
  const output = await router.capture({ text: "买牛奶", locale: "zh-CN", timeZone: "Asia/Shanghai" });
  assert.equal(output.response.operations[0].type, "TASK");
  assert.equal(output.failures[0].provider, "openai");
  result.failover = { status: "PASS", ...output };
});

test("invalid provider response is rejected before business writes", async () => {
  const invalid = new MockProvider("invalid", {
    listModels: async () => [{ id: "invalid-model", status: "available" }],
    probe: async () => ({ structuredOutput: false, toolCalling: false, maxOutputTokens: 1024 }),
    capture: async () => ({ schemaVersion: 1, provider: "invalid", operations: [{ type: "SQL", confidence: 2, fields: {} }] }),
  });
  const router = new AiRouter([invalid]);
  await assert.rejects(() => router.capture({ text: "drop table" }), /ALL_PROVIDERS_FAILED/);
  result.schemaGate = { status: "PASS", rule: "No AI response directly writes business tables" };
});

test.after(() => {
  writeFileSync("results/06-ai-adapter.json", JSON.stringify({ schema: captureResponseSchema, ...result }, null, 2));
});
