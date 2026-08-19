// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  api,
  type AiProposalCreateRequest,
} from "../api/client";
import { useAiStore } from "../stores/ai";
import AiView from "./AiView.vue";

const pushMock = vi.fn();
let originalWindowCrypto: Crypto;
const cryptoState = vi.hoisted(() => {
  let uuidCounter = 0;
  const cryptoStub = {
    randomUUID: () =>
      `00000000-0000-4000-8000-${String(uuidCounter++).padStart(12, "0")}`,
  };
  const originalGlobalCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: cryptoStub,
  });
  return {
    cryptoStub,
    originalGlobalCrypto,
    reset: () => {
      uuidCounter = 0;
    },
  };
});

vi.mock("vue-router", () => ({
  RouterLink: RouterLinkStub,
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: pushMock }),
}));

function createContext() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

function mountAi(pinia: ReturnType<typeof createPinia>) {
  return mount(AiView, {
    global: {
      plugins: [pinia],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

function response(proposalId = "proposal_1") {
  return {
    proposal: {
      completedAt: null,
      createdAt: "2026-08-15T00:00:00.000Z",
      expiresAt: null,
      id: proposalId,
      modelId: "fake-model",
      operations: [
        {
          acceptedAt: null,
          appliedAt: null,
          clarification: null,
          confidence: "0.9000",
          createdAt: "2026-08-15T00:00:00.000Z",
          errorCode: null,
          errorMessage: null,
          fields: { title: "task" },
          id: "operation_1",
          operationType: "TASK",
          ordinal: 1,
          rejectedAt: null,
          resultDraftId: null,
          resultEntityId: null,
          resultEntityType: null,
          status: "PENDING",
          updatedAt: "2026-08-15T00:00:00.000Z",
        },
      ],
      providerId: "fake-provider",
      reviewedAt: null,
      schemaVersion: 1,
      status: "PENDING_REVIEW",
      updatedAt: "2026-08-15T00:00:00.000Z",
      version: 1,
    },
    request: {
      completedAt: null,
      createdAt: "2026-08-15T00:00:00.000Z",
      failureCategory: null,
      failureCode: null,
      id: "request_1",
      locale: "zh-CN",
      proposalId,
      requestId: "request_1",
      startedAt: null,
      status: "SUCCEEDED",
      timeZoneId: "Asia/Shanghai",
      updatedAt: "2026-08-15T00:00:00.000Z",
    },
  };
}

describe("AiView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cryptoState.reset();
    originalWindowCrypto = window.crypto;
    vi.stubGlobal("crypto", cryptoState.cryptoStub);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: cryptoState.cryptoStub,
    });
    Object.defineProperty(window, "crypto", {
      configurable: true,
      value: cryptoState.cryptoStub,
    });
    pushMock.mockReset();
    vi.spyOn(api, "createAiProposal");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: cryptoState.originalGlobalCrypto,
    });
    Object.defineProperty(window, "crypto", {
      configurable: true,
      value: originalWindowCrypto,
    });
  });

  it("H05-U13: create sends Idempotency-Key header and exactly eight fields", async () => {
    const pinia = createContext();
    vi.mocked(api.createAiProposal).mockResolvedValue(response() as never);
    const wrapper = mountAi(pinia);
    const store = useAiStore();
    void store;

    await wrapper.find("textarea").setValue("明天下午三点开会");
    await wrapper.find("select").setValue("CALENDAR_EVENT");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(api.createAiProposal).toHaveBeenCalledTimes(1);
    const [body, idempotencyKey] = vi.mocked(api.createAiProposal).mock
      .calls[0]!;
    expect(idempotencyKey).toBeTruthy();
    expect(typeof idempotencyKey).toBe("string");
    expect(idempotencyKey.length).toBeGreaterThanOrEqual(16);

    const keys = Object.keys(body).sort();
    expect(keys).toEqual([
      "allowedCategoryLabels",
      "currency",
      "currentDateTime",
      "explicitSelectedContext",
      "locale",
      "requestType",
      "timeZoneId",
      "userInput",
    ]);
    expect(body.requestType).toBe("CALENDAR_EVENT");
    expect(body.userInput).toBe("明天下午三点开会");
    expect(body.currency).toBe("CNY");
    expect(body.allowedCategoryLabels).toEqual([]);
    expect(body.explicitSelectedContext).toEqual([]);
  });

  it("H05-U14-create: double click / in-flight protection sends one POST", async () => {
    const pinia = createContext();
    let resolveCreate: (value: unknown) => void = () => {};
    vi.mocked(api.createAiProposal).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }) as never,
    );
    const wrapper = mountAi(pinia);

    await wrapper.find("textarea").setValue("买咖啡花了38元");
    await wrapper.find("form").trigger("submit");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(api.createAiProposal).toHaveBeenCalledTimes(1);
    resolveCreate(response());
    await flushPromises();
  });

  it("H05-U12: AI_PROVIDER_ERROR preserves input and clears the key; next attempt uses a NEW key", async () => {
    const pinia = createContext();
    vi.mocked(api.createAiProposal).mockRejectedValue(
      new ApiClientError(502, "AI_PROVIDER_ERROR", "provider failed"),
    );
    const wrapper = mountAi(pinia);

    await wrapper.find("textarea").setValue("明天提醒我交房租");
    await wrapper.find("select").setValue("REMINDER");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("provider failed");
    expect(wrapper.find("textarea").element.value).toBe("明天提醒我交房租");
    expect(wrapper.find("select").element.value).toBe("REMINDER");

    const firstKey = vi.mocked(api.createAiProposal).mock.calls[0]?.[1];

    // A second provider error must generate a fresh key.
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    const secondKey = vi.mocked(api.createAiProposal).mock.calls[1]?.[1];
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });

  it("NETWORK_ERROR: explicit retry with unchanged input reuses the same key", async () => {
    const pinia = createContext();
    vi.mocked(api.createAiProposal).mockRejectedValueOnce(
      new ApiClientError(0, "NETWORK_ERROR", "offline"),
    );
    const wrapper = mountAi(pinia);

    await wrapper.find("textarea").setValue("周五前完成周报");
    await wrapper.find("select").setValue("TASK");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("网络异常");
    const firstKey = vi.mocked(api.createAiProposal).mock.calls[0]?.[1];

    vi.mocked(api.createAiProposal).mockResolvedValueOnce(response() as never);
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(api.createAiProposal).toHaveBeenCalledTimes(2);
    const secondKey = vi.mocked(api.createAiProposal).mock.calls[1]?.[1];
    expect(secondKey).toBe(firstKey);
  });
});

// Compile-time guard: the create request exposes exactly the frozen fields.
type AssertTrue<T extends true> = T;
type ExtraCreateKeys = Exclude<
  keyof AiProposalCreateRequest,
  | "allowedCategoryLabels"
  | "currency"
  | "currentDateTime"
  | "explicitSelectedContext"
  | "locale"
  | "requestType"
  | "timeZoneId"
  | "userInput"
>;
type _AiCreateKeysLocked = AssertTrue<
  [ExtraCreateKeys] extends [never] ? true : false
>;
void (null as unknown as _AiCreateKeysLocked);
