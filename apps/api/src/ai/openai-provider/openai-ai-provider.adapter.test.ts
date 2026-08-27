import { describe, expect, it, vi } from "vitest";

import type { AiProviderRequest } from "../ai-provider-router.js";
import { RealAiProviderError } from "../deepseek-provider/deepseek-ai-provider.adapter.js";
import {
  createOpenAiProviderAdapter,
  OPENAI_PROPOSAL_RESULT_SCHEMA,
  OPENAI_RESPONSES_URL,
  type OpenAiTransport,
} from "./openai-ai-provider.adapter.js";

const request: AiProviderRequest = {
  input: {
    allowedCategoryLabels: [],
    currency: "CNY",
    currentDateTime: "2026-08-26T00:00:00.000Z",
    explicitSelectedContext: [],
    locale: "zh-CN",
    requestType: "TASK",
    timeZoneId: "Asia/Shanghai",
    userInput: "提醒我开会",
  },
  messages: [{ content: "提醒我开会", role: "user" }],
  model: "ignored",
  requestId: "request-1",
};

function successContent() {
  return {
    clarification: null,
    missingFields: [],
    modelId: "openai-test",
    operations: [
      {
        clarification: null,
        confidence: "0.9000",
        fields: { dueAt: null, priority: null, title: "会议" },
        operationType: "TASK",
        status: "PENDING",
      },
    ],
    providerId: "openai",
    resultType: "SUCCESS",
  };
}

function successPayload() {
  return {
    output: [
      {
        content: [
          { text: JSON.stringify(successContent()), type: "output_text" },
        ],
        type: "message",
      },
    ],
    status: "completed",
    usage: { input_tokens: 7, output_tokens: 5 },
  };
}

function transport(
  status = 200,
  payload: unknown = successPayload(),
): OpenAiTransport {
  return { post: vi.fn(async () => ({ json: async () => payload, status })) };
}

describe("OpenAiProviderAdapter", () => {
  it("uses the fixed Responses endpoint, strict structured output, store:false, and normalized usage", async () => {
    const mock = transport();
    const response = await createOpenAiProviderAdapter(
      { OPENAI_API_KEY: "test-secret", OPENAI_MODEL: "openai-test" },
      mock,
    ).execute(request);
    expect(mock.post).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: undefined,
        url: OPENAI_RESPONSES_URL,
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret",
          "Content-Type": "application/json",
        }),
      }),
    );
    const sent = (mock.post as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(sent).toBeDefined();
    expect(JSON.parse(sent!.body)).toMatchObject({
      model: "openai-test",
      store: false,
      text: {
        format: {
          name: "ai_proposal_result",
          strict: true,
          type: "json_schema",
        },
      },
    });
    expect(JSON.parse(sent!.body).text.format.schema).toEqual(
      OPENAI_PROPOSAL_RESULT_SCHEMA,
    );
    expect(response.usage).toEqual({ inputTokens: 7, outputTokens: 5 });
    expect(response.content.providerId).toBe("openai");
    expect(JSON.stringify(response)).not.toContain("test-secret");
  });

  it("forwards AbortSignal to the injectable transport", async () => {
    const mock = transport();
    const controller = new AbortController();
    await createOpenAiProviderAdapter(
      { OPENAI_API_KEY: "test", OPENAI_MODEL: "model" },
      mock,
    ).execute(request, { signal: controller.signal });
    expect(mock.post).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("uses a closed strict schema for every object, including operation union branches", () => {
    expectClosedObjects(OPENAI_PROPOSAL_RESULT_SCHEMA);

    const branches = operationBranches(OPENAI_PROPOSAL_RESULT_SCHEMA);
    expect(branches).toHaveLength(5);
    expect(
      Object.fromEntries(
        branches.map((branch) => [
          branch.properties.operationType.const,
          Object.keys(branch.properties.fields.properties).sort(),
        ]),
      ),
    ).toEqual({
      CALENDAR_EVENT: ["allDay", "endsAt", "startsAt", "title"],
      REMINDER: [
        "note",
        "recurrence",
        "scheduleType",
        "startsAt",
        "targetId",
        "targetType",
        "title",
      ],
      TASK: ["dueAt", "priority", "title"],
      TRANSACTION: [
        "accountId",
        "amount",
        "categoryId",
        "currency",
        "isUnlinkedRefund",
        "merchant",
        "note",
        "occurredAt",
        "originalTransactionId",
        "source",
        "tripId",
        "type",
      ],
      TRIP: ["budgetAmount", "destination", "endDate", "startDate", "title"],
    });
  });

  it.each([
    [401, "AUTH_ERROR", false],
    [403, "AUTH_ERROR", false],
    [429, "RATE_LIMIT", true],
    [503, "PROVIDER_5XX", true],
  ])(
    "maps HTTP %i without exposing the provider payload",
    async (status, category, retryable) => {
      await expect(
        createOpenAiProviderAdapter(
          { OPENAI_API_KEY: "test", OPENAI_MODEL: "model" },
          transport(status, { error: { message: "secret provider detail" } }),
        ).execute(request),
      ).rejects.toMatchObject({ category, retryable });
    },
  );

  it("maps network, aborted, invalid, and schema-invalid responses without network access", async () => {
    const network: OpenAiTransport = {
      post: vi.fn(async () => {
        throw new Error("offline");
      }),
    };
    await expect(
      createOpenAiProviderAdapter(
        { OPENAI_API_KEY: "test", OPENAI_MODEL: "model" },
        network,
      ).execute(request),
    ).rejects.toMatchObject({ category: "NETWORK_ERROR", retryable: true });

    const controller = new AbortController();
    controller.abort();
    await expect(
      createOpenAiProviderAdapter(
        { OPENAI_API_KEY: "test", OPENAI_MODEL: "model" },
        network,
      ).execute(request, { signal: controller.signal }),
    ).rejects.toMatchObject({ category: "TIMEOUT", retryable: true });

    await expect(
      createOpenAiProviderAdapter(
        { OPENAI_API_KEY: "test", OPENAI_MODEL: "model" },
        transport(200, { output: [], status: "in_progress" }),
      ).execute(request),
    ).rejects.toBeInstanceOf(RealAiProviderError);

    const invalidSchema = successContent();
    invalidSchema.providerId = "unexpected";
    await expect(
      createOpenAiProviderAdapter(
        { OPENAI_API_KEY: "test", OPENAI_MODEL: "model" },
        transport(200, {
          ...successPayload(),
          output: [
            {
              content: [
                { text: JSON.stringify(invalidSchema), type: "output_text" },
              ],
              type: "message",
            },
          ],
        }),
      ).execute(request),
    ).rejects.toMatchObject({ category: "SCHEMA_INVALID", retryable: false });
  });
});

function operationBranches(schema: unknown): Array<{
  properties: {
    fields: { properties: Record<string, unknown> };
    operationType: { const: string };
  };
}> {
  if (!isRecord(schema)) throw new Error("Expected schema object");
  const operations = schema.properties;
  if (!isRecord(operations) || !isRecord(operations.operations)) {
    throw new Error("Expected operations schema");
  }
  const items = operations.operations.items;
  if (!isRecord(items) || !Array.isArray(items.anyOf)) {
    throw new Error("Expected operation union");
  }
  return items.anyOf as Array<{
    properties: {
      fields: { properties: Record<string, unknown> };
      operationType: { const: string };
    };
  }>;
}

function expectClosedObjects(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectClosedObjects);
    return;
  }
  if (!isRecord(value)) return;
  const type = value.type;
  if (type === "object" || (Array.isArray(type) && type.includes("object"))) {
    expect(value.additionalProperties).toBe(false);
    if (!isRecord(value.properties) || !Array.isArray(value.required)) {
      throw new Error("Expected strict object schema properties and required");
    }
    expect([...value.required].sort()).toEqual(Object.keys(value.properties).sort());
  }
  Object.values(value).forEach(expectClosedObjects);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
