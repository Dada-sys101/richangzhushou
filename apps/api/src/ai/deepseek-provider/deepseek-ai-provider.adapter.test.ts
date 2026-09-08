import { describe, expect, it, vi } from "vitest";

import type { AiProviderRequest } from "../ai-provider-router.js";
import {
  createDeepSeekAiProviderAdapter,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  RealAiProviderError,
  type DeepSeekTransport,
} from "./deepseek-ai-provider.adapter.js";

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

function transport(
  status = 200,
  payload: unknown = successPayload(),
): DeepSeekTransport {
  return { post: vi.fn(async () => ({ json: async () => payload, status })) };
}

function successPayload() {
  return {
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: JSON.stringify({
            modelId: "deepseek-test",
            operations: [
              {
                clarification: null,
                confidence: "0.9000",
                fields: { title: "会议" },
                operationType: "TASK",
                status: "PENDING",
              },
            ],
            providerId: "deepseek",
            resultType: "SUCCESS",
          }),
          reasoning_content: "never exposed",
        },
      },
    ],
    usage: { completion_tokens: 5, prompt_tokens: 7, total_tokens: 12 },
  };
}

describe("DeepSeekAiProviderAdapter", () => {
  it("maps only a fixed JSON-mode, thinking-disabled request and normalized usage", async () => {
    const mock = transport();
    const response = await createDeepSeekAiProviderAdapter(
      { DEEPSEEK_API_KEY: "test-secret", DEEPSEEK_MODEL: "deepseek-test" },
      mock,
    ).execute(request);
    expect(mock.post).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: undefined,
        url: DEEPSEEK_CHAT_COMPLETIONS_URL,
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret",
          "Content-Type": "application/json",
        }),
      }),
    );
    const sent = (mock.post as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(sent).toBeDefined();
    const body = JSON.parse(sent!.body);
    expect(body).toMatchObject({
      model: "deepseek-test",
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    });
    expect(body.messages[0].content).toContain("resultType");
    expect(body.messages[0].content).toContain("providerId");
    expect(body.messages[0].content).toContain("dueAt");
    expect(body.messages[0].content).toContain(
      'modelId is exactly "deepseek-test"',
    );
    expect(body.messages[0].content).toContain('status="PENDING"');
    expect(body.messages[0].content).toContain("confidence 0.0000");
    expect(body.messages[0].content).toContain("placeholder titles");
    expect(body.messages[0].content).toContain("买东西");
    expect(body.messages[0].content).toContain("TASK 示例 fields");
    expect(JSON.stringify(response)).not.toContain("test-secret");
    expect(response.usage).toEqual({ inputTokens: 7, outputTokens: 5 });
    expect(response.content.providerId).toBe("deepseek");
  });

  it.each([
    [401, "AUTH_ERROR", false],
    [403, "AUTH_ERROR", false],
    [429, "RATE_LIMIT", true],
    [503, "PROVIDER_5XX", true],
  ])("maps HTTP %i", async (status, category, retryable) => {
    await expect(
      createDeepSeekAiProviderAdapter(
        { DEEPSEEK_API_KEY: "test", DEEPSEEK_MODEL: "model" },
        transport(status),
      ).execute(request),
    ).rejects.toMatchObject({ category, retryable });
  });

  it("rejects invalid JSON, invalid finish reason, and aborted transport without network access", async () => {
    await expect(
      createDeepSeekAiProviderAdapter(
        { DEEPSEEK_API_KEY: "test", DEEPSEEK_MODEL: "model" },
        transport(200, {
          choices: [{ finish_reason: "length", message: { content: "{}" } }],
        }),
      ).execute(request),
    ).rejects.toBeInstanceOf(RealAiProviderError);
    const controller = new AbortController();
    controller.abort();
    const failing: DeepSeekTransport = {
      post: vi.fn(async () => {
        throw new Error("transport");
      }),
    };
    await expect(
      createDeepSeekAiProviderAdapter(
        { DEEPSEEK_API_KEY: "test", DEEPSEEK_MODEL: "model" },
        failing,
      ).execute(request, { signal: controller.signal }),
    ).rejects.toMatchObject({ category: "TIMEOUT", retryable: true });
  });
});
