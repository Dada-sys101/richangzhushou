// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  type CategorySummary,
  type DraftSummary,
  type FinancialAccountSummary,
} from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import * as AppConfirm from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";
import { useDraftsStore } from "../stores/drafts";
import { useFinanceStore } from "../stores/finance";
import DraftsView from "./DraftsView.vue";

const RouterHost = defineComponent({ template: "<router-view />" });

function draft(
  id: string,
  status: DraftSummary["status"] = "PENDING",
): DraftSummary {
  return {
    attachmentId: null,
    clientMutationId: null,
    confidence: { amount: 0.9 },
    confirmedAt: status === "CONFIRMED" ? "2026-08-06T01:00:00.000Z" : null,
    createdAt: "2026-08-06T00:00:00.000Z",
    discardedAt: status === "DISCARDED" ? "2026-08-06T01:00:00.000Z" : null,
    failureReason: status === "FAILED" ? "来源不可用" : null,
    id,
    payload: {
      accountId: "account-1",
      amount: id === "draft-2" ? "20.00" : "88.00",
      categoryId: "category-1",
      currency: "CNY",
      merchant: id === "draft-2" ? "第二条草稿" : "第一条草稿",
      note: "保留输入上下文",
      occurredAt: "2026-08-06T00:00:00.000Z",
      type: "EXPENSE",
    },
    resultId: status === "CONFIRMED" ? `${id}-transaction` : null,
    source: id === "draft-2" ? "SHORTCUT" : "TEXT",
    status,
    targetType: "TRANSACTION",
    updatedAt: "2026-08-06T00:00:00.000Z",
    version: 1,
  };
}

function category(id: string, name: string): CategorySummary {
  return {
    color: "#7c5cfa",
    createdAt: "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    id,
    isArchived: false,
    kind: "EXPENSE",
    name,
    updatedAt: "2026-08-01T00:00:00.000Z",
    version: 1,
  };
}

function account(id: string, name: string): FinancialAccountSummary {
  return {
    createdAt: "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    id,
    isArchived: false,
    kind: "CASH",
    name,
    updatedAt: "2026-08-01T00:00:00.000Z",
    version: 1,
  };
}

type MountOptions = {
  drafts?: DraftSummary[];
  load?: (
    store: ReturnType<typeof useDraftsStore>,
    status?: DraftSummary["status"],
  ) => Promise<void>;
  settle?: boolean;
};

const mountedWrappers: Array<{ unmount: () => void }> = [];

async function mountDrafts(options: MountOptions = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "access-token" });

  const finance = useFinanceStore();
  finance.$patch({
    accounts: [account("account-1", "现金")],
    categories: [category("category-1", "餐饮")],
  });
  const financeCategories = vi
    .spyOn(finance, "loadCategories")
    .mockResolvedValue(undefined);
  const financeAccounts = vi
    .spyOn(finance, "loadAccounts")
    .mockResolvedValue(undefined);

  const draftsStore = useDraftsStore();
  const initialDrafts = options.drafts ?? [draft("draft-1"), draft("draft-2")];
  const defaultLoad = async (
    store: ReturnType<typeof useDraftsStore>,
    status?: DraftSummary["status"],
  ) => {
    store.loading = true;
    await Promise.resolve();
    store.lastStatus = status;
    store.drafts = status
      ? initialDrafts.filter((item) => item.status === status)
      : initialDrafts;
    store.errorMessage = null;
    store.loading = false;
  };
  const load = vi
    .spyOn(draftsStore, "loadDrafts")
    .mockImplementation((status) =>
      (options.load ?? defaultLoad)(draftsStore, status),
    );

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/drafts", component: DraftsView },
      { path: "/other", component: RouterHost },
    ],
  });
  await router.push("/drafts");
  await router.isReady();
  const appWrapper = mount(RouterHost, {
    global: { plugins: [pinia, router] },
  });
  const wrapper = appWrapper.findComponent(DraftsView);
  mountedWrappers.push(appWrapper);
  if (options.settle !== false) {
    await flushPromises();
  }
  return {
    draftsStore,
    finance,
    financeAccounts,
    financeCategories,
    load,
    router,
    wrapper,
  };
}

describe("DraftsView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("keeps the title, confirmation note, quick add, and complete status filter", async () => {
    const context = await mountDrafts();

    expect(context.wrapper.get("#drafts-title").text()).toBe("草稿中心");
    expect(context.wrapper.text()).toContain("确认入账前不会写入正式账单");
    expect(
      context.wrapper.get('a[href="/capture?returnTo=%2Fdrafts"]').text(),
    ).toContain("快速新增");
    const options = Array.from(
      context.wrapper
        .get('select[aria-label="草稿状态"]')
        .element.querySelectorAll("option"),
    ).map((option) => (option as HTMLOptionElement).value);
    expect(options).toEqual(["PENDING", "CONFIRMED", "DISCARDED", ""]);
    expect(context.load).toHaveBeenCalledWith("PENDING");
  });

  it("shows LoadingState during the initial request", async () => {
    let resolveLoad!: () => void;
    const loadPromise = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const context = await mountDrafts({
      settle: false,
      load: async (store) => {
        store.loading = true;
        await loadPromise;
        store.loading = false;
        store.drafts = [draft("draft-1")];
      },
    });
    await nextTick();
    expect(context.wrapper.text()).toContain("正在加载草稿");

    resolveLoad();
    await flushPromises();
    expect(
      context.wrapper.get('input[aria-label="草稿商户"]').element,
    ).toHaveProperty("value", "第一条草稿");
  });

  it("uses ErrorState retry when the list request fails", async () => {
    let attempts = 0;
    const context = await mountDrafts({
      load: async (store) => {
        attempts += 1;
        store.loading = true;
        await Promise.resolve();
        store.loading = false;
        if (attempts === 1) {
          store.errorMessage = "草稿加载失败";
          return;
        }
        store.errorMessage = null;
        store.drafts = [draft("draft-1")];
      },
    });

    expect(context.wrapper.text()).toContain("草稿暂时无法加载");
    await context.wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(attempts).toBe(2);
    expect(
      context.wrapper.get('input[aria-label="草稿商户"]').element,
    ).toHaveProperty("value", "第一条草稿");
  });

  it("retains cached cards and shows a stale warning when refresh fails", async () => {
    let attempts = 0;
    const context = await mountDrafts({
      load: async (store) => {
        attempts += 1;
        store.loading = true;
        await Promise.resolve();
        store.loading = false;
        if (attempts > 1) {
          store.errorMessage = "刷新失败";
          return;
        }
        store.errorMessage = null;
        store.drafts = [draft("draft-1")];
      },
    });

    await (
      context.wrapper.vm as unknown as { reload: () => Promise<void> }
    ).reload();
    await flushPromises();
    expect(context.wrapper.text()).toContain("刷新失败");
    expect(context.wrapper.text()).toContain("上次成功加载的草稿");
    expect(
      context.wrapper.get('input[aria-label="草稿商户"]').element,
    ).toHaveProperty("value", "第一条草稿");
    expect(context.wrapper.findComponent({ name: "ErrorState" }).exists()).toBe(
      false,
    );
  });

  it("reloads the server status filter and keeps the empty state honest", async () => {
    const confirmed = draft("confirmed-1", "CONFIRMED");
    const context = await mountDrafts({
      drafts: [draft("draft-1"), confirmed],
    });

    await context.wrapper
      .get('select[aria-label="草稿状态"]')
      .setValue("CONFIRMED");
    await flushPromises();
    expect(context.load).toHaveBeenLastCalledWith("CONFIRMED");
    expect(context.wrapper.text()).toContain("已确认");
    expect(context.wrapper.find("button.primary-button").exists()).toBe(false);

    await context.wrapper
      .get('select[aria-label="草稿状态"]')
      .setValue("DISCARDED");
    await flushPromises();
    expect(context.wrapper.text()).toContain("当前没有草稿");
  });

  it("performs the batch discard intent then confirms with the returned token", async () => {
    let discarded = false;
    const context = await mountDrafts({
      load: async (store) => {
        store.loading = true;
        await Promise.resolve();
        store.loading = false;
        store.errorMessage = null;
        store.drafts = discarded ? [] : [draft("draft-1"), draft("draft-2")];
      },
    });
    const createIntent = vi
      .spyOn(context.draftsStore, "createBatchDiscard")
      .mockResolvedValue({
        affectedDraftIds: ["draft-1"],
        confirmationToken: "confirmation-token",
        expiresAt: "2026-08-06T00:05:00.000Z",
      });
    const confirmIntent = vi
      .spyOn(context.draftsStore, "confirmBatchDiscard")
      .mockImplementation(async (token) => {
        expect(token).toBe("confirmation-token");
        discarded = true;
        return { discardedCount: 1 };
      });

    await context.wrapper.get('input[aria-label="全选待确认"]').setValue(true);
    await context.wrapper
      .get('input[aria-label="批量丢弃原因"]')
      .setValue("清理重复草稿");
    const batchButton = context.wrapper
      .findAll("button")
      .find((button) => button.text() === "批量丢弃");
    expect(batchButton).toBeDefined();
    await batchButton!.trigger("click");
    await flushPromises();

    expect(createIntent).toHaveBeenCalledWith(
      ["draft-1", "draft-2"],
      "清理重复草稿",
    );
    expect(context.wrapper.findComponent(ConfirmDialog).props("open")).toBe(
      true,
    );
    const dialog = document.body.querySelector('[role="dialog"]');
    const confirmButton = Array.from(
      dialog?.querySelectorAll("button") ?? [],
    ).find((button) => button.textContent === "确认丢弃");
    expect(confirmButton).toBeDefined();
    confirmButton!.click();
    await flushPromises();

    expect(confirmIntent).toHaveBeenCalledWith("confirmation-token");
    expect(context.wrapper.text()).toContain("已丢弃 1 条草稿");
    expect(context.wrapper.text()).toContain("当前没有草稿");
  });

  it("keeps a failed batch confirmation open with its reason and token retry", async () => {
    let confirmAttempts = 0;
    let discarded = false;
    const context = await mountDrafts({
      load: async (store) => {
        store.loading = true;
        await Promise.resolve();
        store.loading = false;
        store.errorMessage = null;
        store.drafts = discarded ? [] : [draft("draft-1")];
      },
    });
    vi.spyOn(context.draftsStore, "createBatchDiscard").mockResolvedValue({
      affectedDraftIds: ["draft-1"],
      confirmationToken: "confirmation-token",
      expiresAt: "2026-08-06T00:05:00.000Z",
    });
    const confirmIntent = vi
      .spyOn(context.draftsStore, "confirmBatchDiscard")
      .mockImplementation(async (token) => {
        expect(token).toBe("confirmation-token");
        confirmAttempts += 1;
        if (confirmAttempts === 1) {
          throw new ApiClientError(
            503,
            "REQUEST_FAILED",
            "批量丢弃失败，请稍后重试",
          );
        }
        discarded = true;
        return { discardedCount: 1 };
      });

    await context.wrapper
      .get('input[aria-label="批量丢弃原因"]')
      .setValue("清理重复草稿");
    await context.wrapper
      .findAll("button")
      .find((button) => button.text() === "批量丢弃")!
      .trigger("click");
    await flushPromises();

    const confirmButton = () =>
      Array.from(
        document.body
          .querySelector('[role="dialog"]')
          ?.querySelectorAll("button") ?? [],
      ).find(
        (button) => button.textContent === "确认丢弃",
      ) as HTMLButtonElement;
    confirmButton().click();
    await flushPromises();

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(context.wrapper.findComponent(ConfirmDialog).props("open")).toBe(
      true,
    );
    expect(dialog?.textContent).toContain("原因：清理重复草稿");
    expect(dialog?.textContent).toContain("批量丢弃失败，请稍后重试");

    confirmButton().click();
    await flushPromises();
    expect(confirmIntent).toHaveBeenNthCalledWith(1, "confirmation-token");
    expect(confirmIntent).toHaveBeenNthCalledWith(2, "confirmation-token");
    expect(context.wrapper.text()).toContain("已丢弃 1 条草稿");
  });

  it("asks before discarding one draft and retains its context on failure", async () => {
    const context = await mountDrafts();
    const confirm = vi
      .spyOn(AppConfirm, "requestAppConfirm")
      .mockResolvedValue(false);
    const discard = vi
      .spyOn(context.draftsStore, "discardDraft")
      .mockRejectedValue(
        new ApiClientError(503, "REQUEST_FAILED", "丢弃失败，请稍后重试"),
      );
    const card = context.wrapper.findAll(".draft-card")[0]!;
    const discardButton = card.get("button.danger-button");

    await discardButton.trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmLabel: "丢弃草稿",
        destructive: true,
      }),
    );
    expect(discard).not.toHaveBeenCalled();

    confirm.mockResolvedValue(true);
    await discardButton.trigger("click");
    await flushPromises();
    expect(discard).toHaveBeenCalledWith("draft-1");
    expect(card.text()).toContain("丢弃失败，请稍后重试");
    expect(card.get('input[aria-label="草稿商户"]').element).toHaveProperty(
      "value",
      "第一条草稿",
    );
  });

  it("locks the affected card when discard succeeds but refresh fails", async () => {
    let attempts = 0;
    const context = await mountDrafts({
      load: async (store) => {
        attempts += 1;
        store.loading = true;
        await Promise.resolve();
        store.loading = false;
        if (attempts > 1) {
          store.errorMessage = "刷新失败";
          return;
        }
        store.errorMessage = null;
        store.drafts = [draft("draft-1")];
      },
    });
    vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(true);
    const discard = vi
      .spyOn(context.draftsStore, "discardDraft")
      .mockResolvedValue(undefined);
    const card = context.wrapper.findAll(".draft-card")[0]!;

    await card.get("button.danger-button").trigger("click");
    await flushPromises();

    expect(discard).toHaveBeenCalledWith("draft-1");
    expect(context.wrapper.text()).toContain("刷新失败");
    expect(context.wrapper.text()).toContain("上次成功加载的草稿");
    expect(card.find("button").exists()).toBe(false);
    expect(card.find('input[aria-label="草稿金额"]').exists()).toBe(false);
    expect(
      (
        context.wrapper.findAll("input.draft-check")[0]!
          .element as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(card.text()).toContain("操作已成功提交，但列表刷新失败");
  });

  it("preserves another card's unsaved edits across a mutation reload", async () => {
    const context = await mountDrafts({
      load: async (store) => {
        store.loading = true;
        await Promise.resolve();
        store.loading = false;
        store.errorMessage = null;
        store.drafts = [draft("draft-1"), draft("draft-2")];
      },
    });
    vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(true);
    vi.spyOn(context.draftsStore, "discardDraft").mockResolvedValue(undefined);

    const cards = context.wrapper.findAll(".draft-card");
    const dirtyCard = cards[1]!;
    await dirtyCard.get('input[aria-label="草稿金额"]').setValue("21.00");
    expect(
      (dirtyCard.get("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await cards[0]!.get("button.danger-button").trigger("click");
    await flushPromises();

    expect(
      dirtyCard.get('input[aria-label="草稿金额"]').element,
    ).toHaveProperty("value", "21.00");
    expect(
      (dirtyCard.get("button.secondary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (dirtyCard.get("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("rejects leaving a dirty card when the status filter changes", async () => {
    const context = await mountDrafts();
    const confirm = vi
      .spyOn(AppConfirm, "requestAppConfirm")
      .mockResolvedValue(false);
    const card = context.wrapper.findAll(".draft-card")[0]!;
    await card.get('input[aria-label="草稿金额"]').setValue("99.00");

    const select = context.wrapper.get('select[aria-label="草稿状态"]');
    await select.setValue("CONFIRMED");
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmLabel: "切换筛选",
        destructive: true,
      }),
    );
    expect(context.load).toHaveBeenCalledTimes(1);
    expect((select.element as HTMLSelectElement).value).toBe("PENDING");
    expect(card.get('input[aria-label="草稿金额"]').element).toHaveProperty(
      "value",
      "99.00",
    );
  });

  it("treats a batch reason as dirty before allowing a filter change", async () => {
    const context = await mountDrafts();
    const confirm = vi
      .spyOn(AppConfirm, "requestAppConfirm")
      .mockResolvedValue(false);
    const reason = context.wrapper.get('input[aria-label="批量丢弃原因"]');
    await reason.setValue("需要保留的审计原因");

    const select = context.wrapper.get('select[aria-label="草稿状态"]');
    await select.setValue("CONFIRMED");
    await flushPromises();

    expect(confirm).toHaveBeenCalledOnce();
    expect((select.element as HTMLSelectElement).value).toBe("PENDING");
    expect((reason.element as HTMLInputElement).value).toBe(
      "需要保留的审计原因",
    );
    expect(context.load).toHaveBeenCalledTimes(1);
  });

  it("does not let an older filter response replace the current list", async () => {
    let resolvePending!: () => void;
    let resolveConfirmed!: () => void;
    const pendingResponse = new Promise<void>((resolve) => {
      resolvePending = resolve;
    });
    const confirmedResponse = new Promise<void>((resolve) => {
      resolveConfirmed = resolve;
    });
    const context = await mountDrafts({
      settle: false,
      load: async (store, status) => {
        store.loading = true;
        if (status === "CONFIRMED") {
          await confirmedResponse;
          const confirmed = draft("confirmed-1", "CONFIRMED");
          confirmed.payload = {
            ...confirmed.payload,
            merchant: "已确认草稿",
          };
          store.drafts = [confirmed];
        } else {
          await pendingResponse;
          store.drafts = [draft("draft-1")];
        }
        store.lastStatus = status;
        store.errorMessage = null;
        store.loading = false;
      },
    });

    const select = context.wrapper.get('select[aria-label="草稿状态"]');
    await select.setValue("CONFIRMED");
    resolveConfirmed();
    await flushPromises();
    expect(context.wrapper.text()).toContain("已确认");

    resolvePending();
    await flushPromises();

    expect(context.wrapper.text()).toContain("已确认");
    expect(context.wrapper.text()).not.toContain("第一条草稿");
    expect(context.wrapper.findAll(".draft-card")).toHaveLength(1);
  });

  it("serializes filter loads so an older failure cannot overwrite the current result", async () => {
    let resolvePending!: () => void;
    let resolveConfirmed!: () => void;
    const pendingResponse = new Promise<void>((resolve) => {
      resolvePending = resolve;
    });
    const confirmedResponse = new Promise<void>((resolve) => {
      resolveConfirmed = resolve;
    });
    const context = await mountDrafts({
      settle: false,
      load: async (store, status) => {
        store.loading = true;
        if (status === "CONFIRMED") {
          await confirmedResponse;
          store.drafts = [draft("confirmed-1", "CONFIRMED")];
          store.errorMessage = null;
        } else {
          await pendingResponse;
          store.errorMessage = "旧请求失败";
        }
        store.lastStatus = status;
        store.loading = false;
      },
    });

    const select = context.wrapper.get('select[aria-label="草稿状态"]');
    await select.setValue("CONFIRMED");
    expect(context.load).toHaveBeenCalledTimes(1);

    resolvePending();
    await flushPromises();
    expect(context.load).toHaveBeenLastCalledWith("CONFIRMED");

    resolveConfirmed();
    await flushPromises();

    expect(context.wrapper.text()).toContain("已确认");
    expect(context.wrapper.text()).not.toContain("旧请求失败");
  });

  it("asks only once when multiple dirty cards block navigation", async () => {
    const context = await mountDrafts();
    const confirm = vi
      .spyOn(AppConfirm, "requestAppConfirm")
      .mockResolvedValue(false);
    const cards = context.wrapper.findAll(".draft-card");
    await cards[0]!.get('input[aria-label="草稿金额"]').setValue("99.00");
    await cards[1]!.get('input[aria-label="草稿金额"]').setValue("21.00");

    await context.router.push("/other");
    await flushPromises();

    expect(confirm).toHaveBeenCalledOnce();
    expect(context.router.currentRoute.value.fullPath).toBe("/drafts");
  });

  it("isolates card save errors and retains edited input", async () => {
    const context = await mountDrafts();
    vi.spyOn(context.draftsStore, "updateDraft").mockRejectedValue(
      new ApiClientError(503, "REQUEST_FAILED", "保存失败，请稍后重试"),
    );
    const firstCard = context.wrapper.findAll(".draft-card")[0]!;
    const secondCard = context.wrapper.findAll(".draft-card")[1]!;
    await firstCard.get('input[aria-label="草稿金额"]').setValue("99.00");
    await firstCard.get("button.secondary-button").trigger("click");
    await flushPromises();

    expect(firstCard.text()).toContain("保存失败，请稍后重试");
    expect(
      firstCard.get('input[aria-label="草稿金额"]').element,
    ).toHaveProperty("value", "99.00");
    expect(
      (secondCard.get("button").element as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("disables only the confirming card and keeps its context on failure", async () => {
    let rejectConfirm!: (error: unknown) => void;
    const confirmation = new Promise<never>((_, reject) => {
      rejectConfirm = reject;
    });
    const context = await mountDrafts();
    const savedDraft = draft("draft-1");
    savedDraft.payload = { ...savedDraft.payload, amount: "77.00" };
    savedDraft.version = 2;
    vi.spyOn(context.draftsStore, "updateDraft").mockResolvedValue(savedDraft);
    vi.spyOn(context.draftsStore, "confirmDraft").mockImplementation(
      async () => confirmation,
    );
    const cards = context.wrapper.findAll(".draft-card");
    await cards[0]!.get('input[aria-label="草稿金额"]').setValue("77.00");
    await cards[0]!.get("button.secondary-button").trigger("click");
    await flushPromises();
    await cards[0]!.get("button.primary-button").trigger("click");
    await nextTick();

    expect(
      (cards[0]!.get("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (cards[1]!.get("button.primary-button").element as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    rejectConfirm(
      new ApiClientError(409, "CONFLICT", "草稿已发生变化，请刷新后重试"),
    );
    await flushPromises();
    expect(cards[0]!.text()).toContain("草稿已发生变化，请刷新后重试");
    expect(
      cards[0]!.get('input[aria-label="草稿金额"]').element,
    ).toHaveProperty("value", "77.00");
  });

  it("keeps failed drafts read-only while exposing the failure status text", async () => {
    const context = await mountDrafts({
      drafts: [draft("failed-1", "FAILED")],
    });
    await context.wrapper.get('select[aria-label="草稿状态"]').setValue("");
    await flushPromises();

    expect(context.load).toHaveBeenLastCalledWith(undefined);
    expect(context.wrapper.text()).toContain("失败");
    expect(context.wrapper.text()).toContain("失败原因：来源不可用");
    expect(context.wrapper.find('input[aria-label="草稿金额"]').exists()).toBe(
      false,
    );
  });
});
