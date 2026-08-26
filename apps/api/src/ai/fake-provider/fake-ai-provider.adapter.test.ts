import { describe, expect, it, vi } from "vitest";

import { AiFakeProviderFactory } from "../ai-fake-provider.factory.js";
import type {
  AiProviderRequest,
  AiProviderResponse,
} from "../ai-provider-router.js";
import { FakeAiProvider } from "./fake-ai-provider.js";
import { FakeAiProviderAdapter } from "./fake-ai-provider.adapter.js";

const INPUT: AiProviderRequest["input"] = {
  allowedCategoryLabels: [],
  currency: "CNY",
  currentDateTime: "2026-08-14T00:00:00.000Z",
  explicitSelectedContext: [],
  locale: "zh-CN",
  requestType: "TASK",
  timeZoneId: "Asia/Shanghai",
  userInput: "明天提醒我完成周报",
};

function createRequest(): AiProviderRequest {
  return {
    input: { ...INPUT, allowedCategoryLabels: [], explicitSelectedContext: [] },
    messages: [{ content: INPUT.userInput, role: "user" }],
    model: "fake-model",
    requestId: "provider-request-1",
  };
}

describe("PR20 FakeAiProviderAdapter", () => {
  it("returns the required adapter envelope while preserving Fake success content", async () => {
    const request = createRequest();
    const factory = new AiFakeProviderFactory();
    const create = vi.spyOn(factory, "create");
    const response: AiProviderResponse = await new FakeAiProviderAdapter(
      factory,
    ).execute(request);

    expect(request).toEqual({
      input: INPUT,
      messages: [{ content: INPUT.userInput, role: "user" }],
      model: "fake-model",
      requestId: "provider-request-1",
    });
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith("TASK");

    expect(response).toEqual({
      content: new FakeAiProvider({ scenario: "TASK_SUCCESS" }).generate(
        request.input,
      ),
      latencyMs: 0,
      model: "fake-model",
      providerName: "fake-provider",
      requestId: request.requestId,
      usage: { inputTokens: null, outputTokens: null },
    });
  });

  it("preserves the existing UNCERTAIN and controlled error behavior", async () => {
    const uncertainAdapter = new FakeAiProviderAdapter({
      create: () => new FakeAiProvider({ scenario: "UNCERTAIN" }),
    } as AiFakeProviderFactory);
    await expect(
      uncertainAdapter.execute(createRequest()),
    ).resolves.toMatchObject({
      content: new FakeAiProvider({ scenario: "UNCERTAIN" }).generate(
        createRequest().input,
      ),
    });

    const failingAdapter = new FakeAiProviderAdapter({
      create: () => new FakeAiProvider({ scenario: "CONTROLLED_FAILURE" }),
    } as AiFakeProviderFactory);
    await expect(failingAdapter.execute(createRequest())).rejects.toMatchObject(
      {
        errorCode: "AI_PROVIDER_ERROR",
        errorCategory: "SAFETY_FAILURE",
      },
    );
  });
});
