// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";

import { ApiClientError, api, type AiProposalDetail } from "../api/client";
import { useAiStore } from "../stores/ai";
import ProposalReviewView from "./ProposalReviewView.vue";

const pushMock = vi.fn();
const routeMock = reactive({ params: { proposalId: "proposal_1" } });

vi.mock("vue-router", () => ({
  RouterLink: RouterLinkStub,
  useRoute: () => routeMock,
  useRouter: () => ({ push: pushMock }),
}));

function operation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    acceptedAt: null,
    appliedAt: null,
    clarification: null,
    confidence: "0.9000",
    createdAt: "2026-08-15T00:00:00.000Z",
    errorCode: null,
    errorMessage: null,
    fields: {
      title: "task",
      priority: "MEDIUM",
      dueAt: "2026-08-18T00:00:00.000Z",
    },
    id: "operation_1",
    operationType: "TASK",
    ordinal: 1,
    rejectedAt: null,
    resultDraftId: null,
    resultEntityId: null,
    resultEntityType: null,
    status: "PENDING",
    updatedAt: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

function proposal(
  overrides: Partial<Record<string, unknown>> = {},
): AiProposalDetail {
  return {
    completedAt: null,
    createdAt: "2026-08-15T00:00:00.000Z",
    expiresAt: null,
    id: "proposal_1",
    modelId: "fake-model",
    operations: [operation()],
    providerId: "fake-provider",
    reviewedAt: null,
    schemaVersion: 1,
    status: "PENDING_REVIEW",
    updatedAt: "2026-08-15T00:00:00.000Z",
    version: 1,
    ...overrides,
  } as AiProposalDetail;
}

function createContext() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

const mountedWrappers: Array<ReturnType<typeof mount>> = [];

function mountReview(pinia: ReturnType<typeof createPinia>) {
  const wrapper = mount(ProposalReviewView, {
    global: {
      plugins: [pinia],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

afterEach(() => {
  for (const wrapper of mountedWrappers) {
    wrapper.unmount();
  }
  mountedWrappers.length = 0;
});

describe("ProposalReviewView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    routeMock.params.proposalId = "proposal_1";
    vi.spyOn(api, "getAiProposal");
    vi.spyOn(api, "editAiOperation");
    vi.spyOn(api, "acceptAiOperation");
    vi.spyOn(api, "rejectAiOperation");
    vi.spyOn(api, "rejectAiProposal");
    vi.spyOn(api, "finalConfirmAiProposal");
  });

  it("H05-U01: renders the authoritative server detail on mount", async () => {
    const pinia = createContext();
    vi.mocked(api.getAiProposal).mockResolvedValue(proposal() as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    expect(api.getAiProposal).toHaveBeenCalledWith("proposal_1");
    expect(wrapper.text()).toContain("提案核对");
    expect(wrapper.text()).toContain("PENDING_REVIEW");
    expect(api.editAiOperation).not.toHaveBeenCalled();
    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
  });

  it("H05-U02: clarification / uncertain information is visible", async () => {
    const pinia = createContext();
    const detail = proposal({
      operations: [
        operation({
          clarification: "提醒内容不明确，请补充具体事项",
          status: "PENDING",
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(detail as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("需要补充的信息");
    expect(wrapper.text()).toContain("提醒内容不明确");
  });

  it("H05-U03: edit sends PATCH only", async () => {
    const pinia = createContext();
    const detail = proposal();
    vi.mocked(api.getAiProposal).mockResolvedValue(detail as never);
    vi.mocked(api.editAiOperation).mockResolvedValue(detail as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const titleInput = wrapper.find('input[type="text"]');
    await titleInput.setValue("修改后的待办");
    await wrapper.find("button.secondary-button").trigger("click");
    await flushPromises();

    expect(api.editAiOperation).toHaveBeenCalledTimes(1);
    expect(api.editAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      expect.objectContaining({ version: 1 }),
    );
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
  });

  it("H05-U04: Accept calls the accept endpoint only", async () => {
    const pinia = createContext();
    const accepted = proposal({
      operations: [operation({ status: "ACCEPTED" })],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(proposal() as never);
    vi.mocked(api.acceptAiOperation).mockResolvedValue(accepted as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    await wrapper.find("button.primary-button").trigger("click");
    await flushPromises();

    expect(api.acceptAiOperation).toHaveBeenCalledTimes(1);
    expect(api.acceptAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
  });

  it("H05-U05: Accept never calls final-confirm", async () => {
    const pinia = createContext();
    const accepted = proposal({
      operations: [operation({ status: "ACCEPTED" })],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(proposal() as never);
    vi.mocked(api.acceptAiOperation).mockResolvedValue(accepted as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    await wrapper.find("button.primary-button").trigger("click");
    await flushPromises();

    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
    // The final confirm panel appears only after the server returns ACCEPTED.
    expect(wrapper.text()).toContain("最终确认写入");
  });

  it("H05-U06: reject operation calls reject only", async () => {
    const pinia = createContext();
    const rejected = proposal({
      operations: [operation({ status: "REJECTED" })],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(proposal() as never);
    vi.mocked(api.rejectAiOperation).mockResolvedValue(rejected as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    await wrapper.find("button.danger-button").trigger("click");
    await flushPromises();

    expect(api.rejectAiOperation).toHaveBeenCalledTimes(1);
    expect(api.rejectAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
  });

  it("H05-U07: reject proposal produces no final-confirm", async () => {
    const pinia = createContext();
    vi.mocked(api.getAiProposal).mockResolvedValue(proposal() as never);
    vi.mocked(api.rejectAiProposal).mockResolvedValue(
      proposal({ status: "REJECTED" }) as never,
    );
    const wrapper = mountReview(pinia);
    await flushPromises();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await wrapper.find("button.reject-proposal-button").trigger("click");
    await flushPromises();

    expect(api.rejectAiProposal).toHaveBeenCalledWith("proposal_1", {
      version: 1,
    });
    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
  });

  it("H05-U08: Final Confirm uses the authoritative APPLIED response", async () => {
    const pinia = createContext();
    const accepted = proposal({
      operations: [operation({ status: "ACCEPTED" })],
    });
    const applied = proposal({
      completedAt: "2026-08-15T01:00:00.000Z",
      status: "APPLIED",
      operations: [
        operation({
          appliedAt: "2026-08-15T01:00:00.000Z",
          resultEntityId: "task_server",
          resultEntityType: "TASK",
          status: "APPLIED",
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(accepted as never);
    vi.mocked(api.finalConfirmAiProposal).mockResolvedValue(applied as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
    await wrapper.find("button.final-confirm-button").trigger("click");
    await flushPromises();

    expect(api.finalConfirmAiProposal).toHaveBeenCalledTimes(1);
    expect(api.finalConfirmAiProposal).toHaveBeenCalledWith("proposal_1", {
      operationIds: ["operation_1"],
      version: 1,
    });
    expect(wrapper.text()).toContain("APPLIED");
    expect(wrapper.text()).toContain("task_server");
    expect(wrapper.find(".final-confirm-panel").exists()).toBe(false);
  });

  it("H05-U09: mount / reload invokes GET only", async () => {
    const pinia = createContext();
    vi.mocked(api.getAiProposal).mockResolvedValue(proposal() as never);
    const wrapper = mountReview(pinia);
    await flushPromises();
    wrapper.unmount();

    expect(api.getAiProposal).toHaveBeenCalledTimes(1);
    expect(api.editAiOperation).not.toHaveBeenCalled();
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
    expect(api.rejectAiOperation).not.toHaveBeenCalled();
    expect(api.rejectAiProposal).not.toHaveBeenCalled();
    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
  });

  it("H05-U10: navigation / back behavior does not invoke mutation", async () => {
    const pinia = createContext();
    vi.mocked(api.getAiProposal).mockResolvedValue(proposal() as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    // No route watcher or lifecycle triggers mutations; only the GET on mount.
    expect(api.editAiOperation).not.toHaveBeenCalled();
    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("H05-U11: VERSION_CONFLICT does not retry mutation and GETs latest", async () => {
    const pinia = createContext();
    const detail = proposal();
    const refreshed = proposal({
      version: 2,
      operations: [
        operation({
          fields: {
            title: "refreshed task",
            priority: "MEDIUM",
            dueAt: "2026-08-19T00:00:00.000Z",
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal)
      .mockResolvedValueOnce(detail as never)
      .mockResolvedValueOnce(refreshed as never);
    vi.mocked(api.acceptAiOperation).mockRejectedValue(
      new ApiClientError(409, "VERSION_CONFLICT", "conflict"),
    );
    const wrapper = mountReview(pinia);
    await flushPromises();

    const getCallsBefore = vi.mocked(api.getAiProposal).mock.calls.length;
    await wrapper.find("button.primary-button").trigger("click");
    await flushPromises();

    expect(api.acceptAiOperation).toHaveBeenCalledTimes(1);
    expect(api.getAiProposal).toHaveBeenCalledTimes(getCallsBefore + 1);
    expect(wrapper.text()).toContain("Proposal 已发生变化");
    expect(useAiStore().proposal?.version).toBe(2);
    expect(
      (wrapper.find('input[type="text"]').element as HTMLInputElement).value,
    ).toBe("refreshed task");
    // The retry happened via GET, not by resending the mutation.
    expect(api.acceptAiOperation).toHaveBeenCalledTimes(1);
  });

  it("H05-U12: AI_OPERATION_INVALID_STATE refreshes authoritative operation state", async () => {
    const pinia = createContext();
    const detail = proposal();
    const refreshed = proposal({
      version: 2,
      operations: [operation({ status: "REJECTED" })],
    });
    vi.mocked(api.getAiProposal)
      .mockResolvedValueOnce(detail as never)
      .mockResolvedValueOnce(refreshed as never);
    vi.mocked(api.acceptAiOperation).mockRejectedValue(
      new ApiClientError(
        409,
        "AI_OPERATION_INVALID_STATE",
        "operation changed",
      ),
    );
    const wrapper = mountReview(pinia);
    await flushPromises();

    await wrapper.find("button.primary-button").trigger("click");
    await flushPromises();

    expect(api.acceptAiOperation).toHaveBeenCalledTimes(1);
    expect(api.getAiProposal).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("操作状态已发生变化，已刷新最新数据");
    expect(useAiStore().proposal?.version).toBe(2);
    expect(useAiStore().proposal?.operations[0]?.status).toBe("REJECTED");
  });

  it("H05-U13: AI_PROPOSAL_INVALID_STATE refreshes without an APPLIED fallback", async () => {
    const pinia = createContext();
    const accepted = proposal({
      operations: [operation({ status: "ACCEPTED" })],
    });
    const refreshed = proposal({
      version: 2,
      status: "REJECTED",
      operations: [operation({ status: "REJECTED" })],
    });
    vi.mocked(api.getAiProposal)
      .mockResolvedValueOnce(accepted as never)
      .mockResolvedValueOnce(refreshed as never);
    vi.mocked(api.finalConfirmAiProposal).mockRejectedValue(
      new ApiClientError(409, "AI_PROPOSAL_INVALID_STATE", "proposal changed"),
    );
    const wrapper = mountReview(pinia);
    await flushPromises();

    await wrapper.find("button.final-confirm-button").trigger("click");
    await flushPromises();

    expect(api.finalConfirmAiProposal).toHaveBeenCalledTimes(1);
    expect(api.getAiProposal).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("操作状态已发生变化，已刷新最新数据");
    expect(wrapper.text()).toContain("REJECTED");
    expect(wrapper.text()).not.toContain("task_server");
    expect(wrapper.find(".final-confirm-panel").exists()).toBe(false);
    expect(useAiStore().proposal?.status).toBe("REJECTED");
    expect(useAiStore().proposal?.version).toBe(2);
  });

  it("H05-U14: AI_DISABLED fails safely without an alternate write", async () => {
    const pinia = createContext();
    const accepted = proposal({
      operations: [operation({ status: "ACCEPTED" })],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(accepted as never);
    vi.mocked(api.finalConfirmAiProposal).mockRejectedValue(
      new ApiClientError(403, "AI_DISABLED", "AI disabled"),
    );
    const wrapper = mountReview(pinia);
    await flushPromises();

    await wrapper.find("button.final-confirm-button").trigger("click");
    await flushPromises();

    expect(api.finalConfirmAiProposal).toHaveBeenCalledTimes(1);
    expect(api.getAiProposal).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("AI disabled");
    expect(wrapper.text()).not.toContain("已写入");
    expect(useAiStore().proposal?.status).toBe("PENDING_REVIEW");
  });

  it("H05-U15: mutation double-click / in-flight protection", async () => {
    const pinia = createContext();
    const detail = proposal();
    vi.mocked(api.getAiProposal).mockResolvedValue(detail as never);
    let resolveAccept: (value: unknown) => void = () => {};
    vi.mocked(api.acceptAiOperation).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAccept = resolve;
        }) as never,
    );
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    await acceptButton.trigger("click");
    await acceptButton.trigger("click");
    await flushPromises();

    expect(api.acceptAiOperation).toHaveBeenCalledTimes(1);
    resolveAccept(
      proposal({ operations: [operation({ status: "ACCEPTED" })] }),
    );
    await flushPromises();
  });

  it("H05-U16: APPLIED state renders safely", async () => {
    const pinia = createContext();
    const applied = proposal({
      completedAt: "2026-08-15T01:00:00.000Z",
      status: "APPLIED",
      operations: [
        operation({
          appliedAt: "2026-08-15T01:00:00.000Z",
          resultEntityId: "task_1",
          resultEntityType: "TASK",
          status: "APPLIED",
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(applied as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("APPLIED");
    expect(wrapper.text()).toContain("写入结果");
    expect(wrapper.text()).toContain("task_1");
    expect(wrapper.find(".final-confirm-panel").exists()).toBe(false);
    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
  });

  it("dirty edit disables Accept until saved", async () => {
    const pinia = createContext();
    vi.mocked(api.getAiProposal).mockResolvedValue(proposal() as never);
    vi.mocked(api.editAiOperation).mockResolvedValue(proposal() as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(false);

    const titleInput = wrapper.find('input[type="text"]');
    await titleInput.setValue("改过的标题");
    await flushPromises();
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await wrapper.find("button.secondary-button").trigger("click");
    await flushPromises();
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("H05-U17: incomplete editable fields disable Accept", async () => {
    const pinia = createContext();
    const incomplete = proposal({
      operations: [
        operation({
          fields: {
            title: "",
            priority: "MEDIUM",
            dueAt: "2026-08-18T00:00:00.000Z",
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(incomplete as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(true);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
  });

  it("H05-U18: completing fields requires Save before Accept", async () => {
    const pinia = createContext();
    const incomplete = proposal({
      operations: [
        operation({
          fields: {
            title: "",
            priority: "MEDIUM",
            dueAt: "2026-08-18T00:00:00.000Z",
          },
        }),
      ],
    });
    const saved = proposal({
      operations: [
        operation({
          fields: {
            title: "completed task",
            priority: "MEDIUM",
            dueAt: "2026-08-18T00:00:00.000Z",
          },
        }),
      ],
    });
    const accepted = proposal({
      operations: [operation({ status: "ACCEPTED" })],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(incomplete as never);
    vi.mocked(api.editAiOperation).mockResolvedValue(saved as never);
    vi.mocked(api.acceptAiOperation).mockResolvedValue(accepted as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    await wrapper.find('input[type="text"]').setValue("completed task");
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await wrapper.find("button.secondary-button").trigger("click");
    await flushPromises();

    expect(api.editAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      expect.objectContaining({
        fields: expect.objectContaining({ title: "completed task" }),
      }),
    );
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    await wrapper.find("button.primary-button").trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).toHaveBeenCalledTimes(1);
  });

  it("H05-U19: allDay changes mark dirty and serialize true on Save", async () => {
    const pinia = createContext();
    const initial = proposal({
      operations: [
        operation({
          operationType: "CALENDAR_EVENT",
          fields: {
            title: "meeting",
            startsAt: "2026-08-17T16:00:00.000Z",
            endsAt: "2026-08-18T16:00:00.000Z",
            allDay: false,
          },
        }),
      ],
    });
    const saved = proposal({
      operations: [
        operation({
          operationType: "CALENDAR_EVENT",
          fields: {
            title: "meeting",
            startsAt: "2026-08-17T16:00:00.000Z",
            endsAt: "2026-08-18T16:00:00.000Z",
            allDay: true,
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(initial as never);
    vi.mocked(api.editAiOperation).mockResolvedValue(saved as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const checkbox = wrapper.find('input[type="checkbox"]');
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);
    await checkbox.setValue(true);
    await flushPromises();

    expect(
      (wrapper.find("button.secondary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await wrapper.find("button.secondary-button").trigger("click");
    await flushPromises();

    expect(api.editAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      expect.objectContaining({
        fields: expect.objectContaining({ allDay: true }),
      }),
    );
    expect(
      (wrapper.find("button.secondary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("H05-FIX02-P1-ACCEPTED-REJECT-009: ACCEPTED exposes Reject only", async () => {
    const pinia = createContext();
    const accepted = proposal({
      status: "PARTIALLY_APPLIED",
      operations: [operation({ status: "ACCEPTED" })],
    });
    const rejected = proposal({
      status: "REJECTED",
      operations: [operation({ status: "REJECTED" })],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(accepted as never);
    vi.mocked(api.rejectAiOperation).mockResolvedValue(rejected as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const card = wrapper.find(".operation-card");
    expect(card.find(".draft-form").exists()).toBe(false);
    expect(card.find("button.primary-button").exists()).toBe(false);
    const rejectButton = card.find("button.danger-button");
    expect(rejectButton.exists()).toBe(true);
    expect((rejectButton.element as HTMLButtonElement).disabled).toBe(false);

    await rejectButton.trigger("click");
    await flushPromises();

    expect(api.rejectAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
    expect(wrapper.text()).toContain("已拒绝");
    expect(wrapper.find(".final-confirm-panel").exists()).toBe(false);
  });

  it("H05-FIX02-P1-VALIDATION-008: invalid amount stays un-acceptable after Save", async () => {
    const pinia = createContext();
    const invalid = proposal({
      operations: [
        operation({
          operationType: "TRANSACTION",
          fields: {
            type: "EXPENSE",
            amount: "12.3",
            currency: "CNY",
          },
        }),
      ],
    });
    const saved = proposal({
      operations: [
        operation({
          operationType: "TRANSACTION",
          fields: {
            type: "EXPENSE",
            amount: "12.3",
            currency: "CNY",
            merchant: "咖啡店",
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(invalid as never);
    vi.mocked(api.editAiOperation).mockResolvedValue(saved as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const textInputs = wrapper.findAll('input[type="text"]');
    expect(textInputs).toHaveLength(3);
    await textInputs[2]!.setValue("新的商户");
    await wrapper.find("button.secondary-button").trigger("click");
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect(api.editAiOperation).toHaveBeenCalledTimes(1);
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(true);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
  });

  it("H05-FIX02-P1-VALIDATION-008: invalid date blocks Accept before API", async () => {
    const pinia = createContext();
    const invalid = proposal({
      operations: [
        operation({
          operationType: "CALENDAR_EVENT",
          fields: {
            title: "会议",
            startsAt: "not-a-date",
            endsAt: "2026-08-18T10:00:00.000Z",
            allDay: false,
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(invalid as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(true);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
  });

  it("H05-FIX02-P1-VALIDATION-008: omitted optional fields do not block Accept", async () => {
    const pinia = createContext();
    const optionalFieldsOmitted = proposal({
      operations: [operation({ fields: { title: "task" } })],
    });
    const accepted = proposal({
      operations: [operation({ status: "ACCEPTED" })],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(
      optionalFieldsOmitted as never,
    );
    vi.mocked(api.acceptAiOperation).mockResolvedValue(accepted as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(false);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
  });

  it("H05-FIX03-P1-VALIDATION-011: Formal Write forbidden fields block Accept", async () => {
    const pinia = createContext();
    const forbidden = proposal({
      operations: [
        operation({
          operationType: "TRANSACTION",
          fields: {
            amount: "38.50",
            sourceFingerprint: "provider-owned-fingerprint",
            type: "EXPENSE",
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(forbidden as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(true);
    expect(wrapper.text()).toContain("正式写入禁止字段");
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
  });

  it("H05-FIX03-P1-VALIDATION-011: EXPENSE cannot be an unlinked refund", async () => {
    const pinia = createContext();
    const invalid = proposal({
      operations: [
        operation({
          operationType: "TRANSACTION",
          fields: {
            amount: "38.50",
            isUnlinkedRefund: true,
            type: "EXPENSE",
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(invalid as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(true);
    expect(wrapper.text()).toContain("字段组合不符合正式写入规则");
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
  });

  it("H05-FIX03-P1-VALIDATION-011: ONCE reminder with an empty recurrence is invalid", async () => {
    const pinia = createContext();
    const invalid = proposal({
      operations: [
        operation({
          operationType: "REMINDER",
          fields: {
            recurrence: {},
            scheduleType: "ONCE",
            startsAt: "2026-08-16T00:00:00.000Z",
            title: "提醒",
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(invalid as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(true);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
  });

  it("H05-FIX03-P1-VALIDATION-011: past ONCE reminder cannot be accepted", async () => {
    const pinia = createContext();
    const invalid = proposal({
      operations: [
        operation({
          operationType: "REMINDER",
          fields: {
            scheduleType: "ONCE",
            startsAt: "2026-08-14T00:00:00.000Z",
            title: "提醒",
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(invalid as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(true);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
  });

  it("H05-FIX03-P1-VALIDATION-011: valid transaction remains acceptable", async () => {
    const pinia = createContext();
    const valid = proposal({
      operations: [
        operation({
          operationType: "TRANSACTION",
          fields: {
            amount: "38.50",
            currency: "CNY",
            merchant: "咖啡店",
            occurredAt: "2026-08-15T00:00:00.000Z",
            type: "EXPENSE",
          },
        }),
      ],
    });
    const accepted = proposal({
      operations: [
        operation({
          operationType: "TRANSACTION",
          fields: valid.operations[0]?.fields,
          status: "ACCEPTED",
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(valid as never);
    vi.mocked(api.acceptAiOperation).mockResolvedValue(accepted as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(false);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
  });

  it("H05-FIX04-P1-SOURCE-NULL-013: source null blocks Accept and its handler", async () => {
    const pinia = createContext();
    const invalid = proposal({
      operations: [
        operation({
          operationType: "TRANSACTION",
          fields: {
            amount: "38.50",
            source: null,
            type: "EXPENSE",
          },
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(invalid as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(true);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
  });

  it("H05-FIX04-P1-SOURCE-NULL-013: source TEXT remains acceptable", async () => {
    const pinia = createContext();
    const valid = proposal({
      operations: [
        operation({
          operationType: "TRANSACTION",
          fields: {
            amount: "38.50",
            source: "TEXT",
            type: "EXPENSE",
          },
        }),
      ],
    });
    const accepted = proposal({
      operations: [
        operation({
          fields: valid.operations[0]?.fields,
          operationType: "TRANSACTION",
          status: "ACCEPTED",
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(valid as never);
    vi.mocked(api.acceptAiOperation).mockResolvedValue(accepted as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(false);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
  });

  it("H05-FIX04-P1-SOURCE-NULL-013: omitted source remains acceptable", async () => {
    const pinia = createContext();
    const valid = proposal({
      operations: [
        operation({
          operationType: "TRANSACTION",
          fields: {
            amount: "38.50",
            type: "EXPENSE",
          },
        }),
      ],
    });
    const accepted = proposal({
      operations: [
        operation({
          fields: valid.operations[0]?.fields,
          operationType: "TRANSACTION",
          status: "ACCEPTED",
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(valid as never);
    vi.mocked(api.acceptAiOperation).mockResolvedValue(accepted as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(false);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
  });

  it("H05-FIX03-P1-VALIDATION-011: valid ONCE reminder without recurrence remains acceptable", async () => {
    const pinia = createContext();
    const valid = proposal({
      operations: [
        operation({
          operationType: "REMINDER",
          fields: {
            scheduleType: "ONCE",
            startsAt: "2026-08-16T00:00:00.000Z",
            title: "提醒",
          },
        }),
      ],
    });
    const accepted = proposal({
      operations: [
        operation({
          operationType: "REMINDER",
          fields: valid.operations[0]?.fields,
          status: "ACCEPTED",
        }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(valid as never);
    vi.mocked(api.acceptAiOperation).mockResolvedValue(accepted as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const acceptButton = wrapper.find("button.primary-button");
    expect((acceptButton.element as HTMLButtonElement).disabled).toBe(false);
    await acceptButton.trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).toHaveBeenCalledWith(
      "proposal_1",
      "operation_1",
      { version: 1 },
    );
  });

  it("H05-FIX02-P1-STALE-REFRESH-010: pending authoritative refresh locks every mutation", async () => {
    const pinia = createContext();
    const initial = proposal({
      status: "PARTIALLY_APPLIED",
      operations: [
        operation({ id: "operation_1", ordinal: 1, status: "PENDING" }),
        operation({ id: "operation_2", ordinal: 2, status: "ACCEPTED" }),
      ],
    });
    const refreshed = proposal({
      version: 2,
      operations: [operation({ status: "PENDING" })],
    });
    let resolveRefresh!: (value: AiProposalDetail) => void;
    vi.mocked(api.getAiProposal)
      .mockResolvedValueOnce(initial as never)
      .mockImplementationOnce(
        () =>
          new Promise<AiProposalDetail>((resolve) => {
            resolveRefresh = resolve;
          }) as never,
      );
    vi.mocked(api.acceptAiOperation).mockRejectedValue(
      new ApiClientError(409, "VERSION_CONFLICT", "conflict"),
    );
    const wrapper = mountReview(pinia);
    await flushPromises();

    const cards = wrapper.findAll(".operation-card");
    const pendingCard = cards[0]!;
    const acceptedCard = cards[1]!;
    await pendingCard.find("button.primary-button").trigger("click");
    await flushPromises();

    expect(api.getAiProposal).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("正在获取最新状态，当前提案暂时只读。");
    expect(
      pendingCard
        .findAll("input")
        .every((input) => (input.element as HTMLInputElement).disabled),
    ).toBe(true);
    expect(
      pendingCard
        .findAll("button")
        .every((button) => (button.element as HTMLButtonElement).disabled),
    ).toBe(true);
    expect(
      (acceptedCard.find("button.danger-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (wrapper.find("button.final-confirm-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    resolveRefresh(refreshed);
    await flushPromises();

    expect(useAiStore().proposal?.version).toBe(2);
    expect(useAiStore().authoritativeRefreshRequired).toBe(false);
    expect(wrapper.find(".refresh-proposal-button").exists()).toBe(false);
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("H05-FIX02-P1-STALE-REFRESH-010: failed refresh keeps the lock until manual reload succeeds", async () => {
    const pinia = createContext();
    const initial = proposal({
      operations: [
        operation({ id: "operation_1", ordinal: 1, status: "PENDING" }),
        operation({ id: "operation_2", ordinal: 2, status: "ACCEPTED" }),
      ],
    });
    const refreshed = proposal({
      version: 2,
      operations: [operation({ status: "PENDING" })],
    });
    vi.mocked(api.getAiProposal)
      .mockResolvedValueOnce(initial as never)
      .mockRejectedValueOnce(
        new ApiClientError(503, "REQUEST_FAILED", "refresh failed"),
      )
      .mockResolvedValueOnce(refreshed as never);
    vi.mocked(api.acceptAiOperation).mockRejectedValue(
      new ApiClientError(409, "VERSION_CONFLICT", "conflict"),
    );
    const wrapper = mountReview(pinia);
    await flushPromises();

    const cards = wrapper.findAll(".operation-card");
    const pendingCard = cards[0]!;
    const acceptedCard = cards[1]!;
    await pendingCard.find("button.primary-button").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("最新状态获取失败，请重试刷新");
    expect(wrapper.find(".refresh-proposal-button").exists()).toBe(true);
    expect(useAiStore().proposal?.version).toBe(1);
    const mutationCounts = {
      edit: vi.mocked(api.editAiOperation).mock.calls.length,
      accept: vi.mocked(api.acceptAiOperation).mock.calls.length,
      reject: vi.mocked(api.rejectAiOperation).mock.calls.length,
      rejectProposal: vi.mocked(api.rejectAiProposal).mock.calls.length,
      finalConfirm: vi.mocked(api.finalConfirmAiProposal).mock.calls.length,
    };

    await pendingCard.find("button.secondary-button").trigger("click");
    await pendingCard.find("button.primary-button").trigger("click");
    await pendingCard.find("button.danger-button").trigger("click");
    await acceptedCard.find("button.danger-button").trigger("click");
    await wrapper.find("button.final-confirm-button").trigger("click");
    await wrapper.find("button.reject-proposal-button").trigger("click");
    await flushPromises();

    expect(api.editAiOperation).toHaveBeenCalledTimes(mutationCounts.edit);
    expect(api.acceptAiOperation).toHaveBeenCalledTimes(mutationCounts.accept);
    expect(api.rejectAiOperation).toHaveBeenCalledTimes(mutationCounts.reject);
    expect(api.rejectAiProposal).toHaveBeenCalledTimes(
      mutationCounts.rejectProposal,
    );
    expect(api.finalConfirmAiProposal).toHaveBeenCalledTimes(
      mutationCounts.finalConfirm,
    );

    await wrapper.find("button.refresh-proposal-button").trigger("click");
    await flushPromises();

    expect(useAiStore().proposal?.version).toBe(2);
    expect(useAiStore().authoritativeRefreshRequired).toBe(false);
    expect(wrapper.find(".refresh-proposal-button").exists()).toBe(false);
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("H05-FIX03-P1-REQUEST-RACE-012: route transition locks stale P1 controls", async () => {
    const pinia = createContext();
    const p1 = proposal();
    const p2 = proposal({ id: "proposal_2", version: 2 });
    let resolveP2!: (value: AiProposalDetail) => void;
    vi.mocked(api.getAiProposal)
      .mockResolvedValueOnce(p1 as never)
      .mockImplementationOnce(
        () =>
          new Promise<AiProposalDetail>((resolve) => {
            resolveP2 = resolve;
          }) as never,
      );
    const wrapper = mountReview(pinia);
    await flushPromises();

    routeMock.params.proposalId = "proposal_2";
    await flushPromises();

    expect(api.getAiProposal).toHaveBeenLastCalledWith("proposal_2");
    expect(useAiStore().proposal?.id).toBe("proposal_1");
    expect(
      wrapper
        .findAll("input")
        .every((input) => (input.element as HTMLInputElement).disabled),
    ).toBe(true);
    expect(
      wrapper
        .findAll("button")
        .filter((button) => !button.classes("refresh-proposal-button"))
        .every((button) => (button.element as HTMLButtonElement).disabled),
    ).toBe(true);

    resolveP2(p2);
    await flushPromises();

    expect(useAiStore().proposal?.id).toBe("proposal_2");
    expect(useAiStore().proposal?.version).toBe(2);
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("H05-FIX03-P1-REQUEST-RACE-012: late P1 GET cannot overwrite fast P2 GET", async () => {
    const pinia = createContext();
    const p1 = proposal();
    const p2 = proposal({ id: "proposal_2", version: 7 });
    const p2Accepted = proposal({
      id: "proposal_2",
      version: 8,
      operations: [operation({ status: "ACCEPTED" })],
    });
    let resolveP1!: (value: AiProposalDetail) => void;
    vi.mocked(api.getAiProposal)
      .mockImplementationOnce(
        () =>
          new Promise<AiProposalDetail>((resolve) => {
            resolveP1 = resolve;
          }) as never,
      )
      .mockResolvedValueOnce(p2 as never);
    vi.mocked(api.acceptAiOperation).mockResolvedValue(p2Accepted as never);
    const wrapper = mountReview(pinia);

    routeMock.params.proposalId = "proposal_2";
    await flushPromises();
    expect(useAiStore().proposal?.id).toBe("proposal_2");
    expect(useAiStore().proposal?.version).toBe(7);

    resolveP1(p1);
    await flushPromises();

    expect(useAiStore().proposal?.id).toBe("proposal_2");
    expect(useAiStore().proposal?.version).toBe(7);
    await wrapper.find("button.primary-button").trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).toHaveBeenCalledWith(
      "proposal_2",
      "operation_1",
      { version: 7 },
    );
  });

  it("H05-FIX03-P1-REQUEST-RACE-012: recovery A cannot unlock while recovery B is pending", async () => {
    const pinia = createContext();
    const initial = proposal();
    const recoveryA = proposal({ version: 2 });
    const recoveryB = proposal({ version: 3 });
    let resolveRecoveryA!: (value: AiProposalDetail) => void;
    let resolveRecoveryB!: (value: AiProposalDetail) => void;
    vi.mocked(api.getAiProposal)
      .mockResolvedValueOnce(initial as never)
      .mockImplementationOnce(
        () =>
          new Promise<AiProposalDetail>((resolve) => {
            resolveRecoveryA = resolve;
          }) as never,
      )
      .mockImplementationOnce(
        () =>
          new Promise<AiProposalDetail>((resolve) => {
            resolveRecoveryB = resolve;
          }) as never,
      );
    const wrapper = mountReview(pinia);
    await flushPromises();

    const store = useAiStore();
    const recoveryRequestA = store.getProposal(
      "proposal_1",
      "AUTHORITATIVE_RECOVERY",
    );
    await flushPromises();
    const recoveryRequestB = store.getProposal(
      "proposal_1",
      "AUTHORITATIVE_RECOVERY",
    );
    await flushPromises();

    resolveRecoveryA(recoveryA);
    await flushPromises();
    expect(store.proposal?.version).toBe(1);
    expect(store.authoritativeRefreshPending).toBe(true);
    expect(store.authoritativeRefreshRequired).toBe(true);
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    resolveRecoveryB(recoveryB);
    await Promise.all([recoveryRequestA, recoveryRequestB]);
    await flushPromises();
    expect(store.proposal?.version).toBe(3);
    expect(store.authoritativeRefreshPending).toBe(false);
    expect(store.authoritativeRefreshRequired).toBe(false);
  });

  it("H05-FIX03-P1-REQUEST-RACE-012: latest recovery failure keeps an older response locked out", async () => {
    const pinia = createContext();
    const initial = proposal();
    const recoveryA = proposal({ version: 2 });
    vi.mocked(api.getAiProposal)
      .mockResolvedValueOnce(initial as never)
      .mockImplementationOnce(
        () =>
          new Promise<AiProposalDetail>((resolve) => {
            resolveRecoveryA = resolve;
          }) as never,
      )
      .mockRejectedValueOnce(
        new ApiClientError(503, "REQUEST_FAILED", "latest recovery failed"),
      );
    let resolveRecoveryA!: (value: AiProposalDetail) => void;
    const wrapper = mountReview(pinia);
    await flushPromises();

    const store = useAiStore();
    const recoveryRequestA = store.getProposal(
      "proposal_1",
      "AUTHORITATIVE_RECOVERY",
    );
    await flushPromises();
    const recoveryRequestB = store.getProposal(
      "proposal_1",
      "AUTHORITATIVE_RECOVERY",
    );
    await expect(recoveryRequestB).rejects.toThrow("latest recovery failed");

    resolveRecoveryA(recoveryA);
    await recoveryRequestA;
    await flushPromises();
    expect(store.proposal?.version).toBe(1);
    expect(store.authoritativeRefreshPending).toBe(false);
    expect(store.authoritativeRefreshRequired).toBe(true);
    expect(wrapper.find(".refresh-proposal-button").exists()).toBe(true);
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("H05-FIX03-P1-REQUEST-RACE-012: successful manual reload enables mutation with refreshed version", async () => {
    const pinia = createContext();
    const initial = proposal();
    const refreshed = proposal({ version: 2 });
    const accepted = proposal({
      version: 3,
      operations: [operation({ status: "ACCEPTED" })],
    });
    vi.mocked(api.getAiProposal)
      .mockResolvedValueOnce(initial as never)
      .mockRejectedValueOnce(
        new ApiClientError(409, "VERSION_CONFLICT", "conflict"),
      )
      .mockResolvedValueOnce(refreshed as never);
    vi.mocked(api.acceptAiOperation)
      .mockRejectedValueOnce(
        new ApiClientError(409, "VERSION_CONFLICT", "conflict"),
      )
      .mockResolvedValueOnce(accepted as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    await wrapper.find("button.primary-button").trigger("click");
    await flushPromises();
    expect(wrapper.find(".refresh-proposal-button").exists()).toBe(true);

    await wrapper.find(".refresh-proposal-button").trigger("click");
    await flushPromises();
    expect(useAiStore().proposal?.version).toBe(2);
    expect(useAiStore().authoritativeRefreshRequired).toBe(false);

    await wrapper.find("button.primary-button").trigger("click");
    await flushPromises();
    expect(api.acceptAiOperation).toHaveBeenCalledTimes(2);
    expect(api.acceptAiOperation).toHaveBeenLastCalledWith(
      "proposal_1",
      "operation_1",
      { version: 2 },
    );
  });

  it("H05-FIX03-P1-REQUEST-RACE-012: Proposal ID mismatch hard-blocks store and view mutation", async () => {
    const pinia = createContext();
    vi.mocked(api.getAiProposal).mockResolvedValue(proposal() as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    const store = useAiStore();
    store.proposal = proposal({ id: "proposal_2", version: 9 });
    await flushPromises();
    expect(
      (wrapper.find("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await wrapper.find("button.primary-button").trigger("click");
    await store.acceptOperation("proposal_1", "operation_1", 9);
    expect(api.acceptAiOperation).not.toHaveBeenCalled();
  });

  it("PARTIALLY_APPLIED final-confirm scope excludes APPLIED operations", async () => {
    const pinia = createContext();
    const partial = proposal({
      status: "PARTIALLY_APPLIED",
      operations: [
        operation({ id: "operation_1", ordinal: 1, status: "APPLIED" }),
        operation({ id: "operation_2", ordinal: 2, status: "ACCEPTED" }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(partial as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("最终确认写入");
    expect(wrapper.text()).toContain("即将正式写入 1 项");
    await wrapper.find("button.final-confirm-button").trigger("click");
    await flushPromises();

    // APPLIED operation must not be resent; only ACCEPTED is included.
    expect(api.finalConfirmAiProposal).toHaveBeenCalledWith("proposal_1", {
      operationIds: ["operation_2"],
      version: 1,
    });
  });

  it("final-confirm operationIds are ACCEPTED only; PENDING/REJECTED never included", async () => {
    const pinia = createContext();
    const mixed = proposal({
      status: "PARTIALLY_APPLIED",
      operations: [
        operation({ id: "operation_1", ordinal: 1, status: "ACCEPTED" }),
        operation({ id: "operation_2", ordinal: 2, status: "PENDING" }),
        operation({ id: "operation_3", ordinal: 3, status: "REJECTED" }),
      ],
    });
    vi.mocked(api.getAiProposal).mockResolvedValue(mixed as never);
    const wrapper = mountReview(pinia);
    await flushPromises();

    await wrapper.find("button.final-confirm-button").trigger("click");
    await flushPromises();

    expect(api.finalConfirmAiProposal).toHaveBeenCalledWith("proposal_1", {
      operationIds: ["operation_1"],
      version: 1,
    });
  });

  it("terminal proposal has no final-confirm button", async () => {
    const pinia = createContext();
    vi.mocked(api.getAiProposal).mockResolvedValue(
      proposal({ status: "REJECTED" }) as never,
    );
    const wrapper = mountReview(pinia);
    await flushPromises();

    expect(wrapper.find(".final-confirm-panel").exists()).toBe(false);
    expect(api.finalConfirmAiProposal).not.toHaveBeenCalled();
  });
});
