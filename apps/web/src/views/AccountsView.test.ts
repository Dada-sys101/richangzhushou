// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, type FinancialAccountSummary } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import AccountsView from "./AccountsView.vue";

function account(
  id: string,
  kind: FinancialAccountSummary["kind"],
  name: string,
  isArchived = false,
): FinancialAccountSummary {
  return {
    createdAt: "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    id,
    isArchived,
    kind,
    name,
    updatedAt: "2026-08-01T00:00:00.000Z",
    version: 3,
  };
}

async function mountAccounts(
  accounts: FinancialAccountSummary[] = [
    account("cash-1", "CASH", "日常现金"),
    account("debit-1", "DEBIT_CARD", "储蓄卡"),
    account("credit-1", "CREDIT_CARD", "信用卡"),
    account("wallet-1", "DIGITAL_WALLET", "电子钱包"),
    account("other-1", "OTHER", "其他账户"),
    account("archived-1", "CASH", "旧钱包", true),
  ],
  options: { loadError?: string } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "access-token" });
  const finance = useFinanceStore();
  finance.$patch({ accounts });
  const loadAccounts = vi
    .spyOn(finance, "loadAccounts")
    .mockResolvedValue(undefined);
  if (options.loadError) {
    let firstLoad = true;
    loadAccounts.mockImplementation(async () => {
      if (firstLoad) {
        finance.errorMessage = options.loadError ?? null;
        firstLoad = false;
      }
    });
  }
  const createAccount = vi
    .spyOn(finance, "createAccount")
    .mockResolvedValue(undefined);
  const updateAccount = vi
    .spyOn(finance, "updateAccount")
    .mockResolvedValue(undefined);
  const wrapper = mount(AccountsView, {
    global: { plugins: [pinia] },
  });
  await flushPromises();
  return { createAccount, finance, loadAccounts, updateAccount, wrapper };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AccountsView", () => {
  it("keeps the required order, account labels, and wrapped archive rows", async () => {
    const { wrapper } = await mountAccounts();

    expect(wrapper.get("#accounts-title").text()).toBe("资金账户");
    expect(
      wrapper.findAll(".section-card-header h2").map((item) => item.text()),
    ).toEqual(["新增账户", "使用中的账户", "已归档账户"]);
    expect(wrapper.text()).toContain("现金");
    expect(wrapper.text()).toContain("储蓄卡");
    expect(wrapper.text()).toContain("信用卡");
    expect(wrapper.text()).toContain("电子钱包");
    expect(wrapper.text()).toContain("其他");
    expect(wrapper.find('button[aria-label="归档账户：储蓄卡"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('button[aria-label="恢复账户：旧钱包"]').exists()).toBe(
      true,
    );
  });

  it("preserves the account name when creation fails", async () => {
    const { createAccount, wrapper } = await mountAccounts([]);
    createAccount.mockRejectedValue(
      new ApiClientError(503, "REQUEST_FAILED", "账户服务暂时不可用"),
    );

    const input = wrapper.get('input[aria-label="账户名称"]');
    await input.setValue("我的钱包");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "账户服务暂时不可用",
    );
    expect((input.element as HTMLInputElement).value).toBe("我的钱包");
  });

  it("clears a successful create before surfacing its refresh failure", async () => {
    const { createAccount, finance, loadAccounts, wrapper } =
      await mountAccounts([]);
    createAccount.mockImplementation(async () => {
      finance.errorMessage = "账户刷新失败";
    });

    const input = wrapper.get('input[aria-label="账户名称"]');
    await input.setValue("新钱包");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect((input.element as HTMLInputElement).value).toBe("");
    expect(wrapper.get('[role="alert"]').text()).toContain("账户刷新失败");
    expect(wrapper.find('[role="alert"] button').exists()).toBe(true);
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(loadAccounts).toHaveBeenCalledTimes(2);
  });

  it("locks cached archive and restore rows after refresh failures", async () => {
    const { finance, loadAccounts, updateAccount, wrapper } =
      await mountAccounts();
    updateAccount.mockImplementation(async () => {
      finance.errorMessage = "账户刷新失败";
    });

    const archiveButton = wrapper.get('button[aria-label="归档账户：储蓄卡"]');
    await archiveButton.trigger("click");
    await flushPromises();

    expect(wrapper.find('[role="alert"] button').exists()).toBe(true);
    expect(archiveButton.attributes("disabled")).toBe("");
    expect(
      wrapper
        .get('button[aria-label="恢复账户：旧钱包"]')
        .attributes("disabled"),
    ).toBe("");

    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(loadAccounts).toHaveBeenCalledTimes(2);
    const restoreButton = wrapper.get('button[aria-label="恢复账户：旧钱包"]');
    expect(restoreButton.attributes("disabled")).toBeUndefined();

    await restoreButton.trigger("click");
    await flushPromises();
    expect(restoreButton.attributes("disabled")).toBe("");
  });

  it("keeps versioned archive and restore actions on the original store API", async () => {
    const { updateAccount, wrapper } = await mountAccounts();

    await wrapper.get('button[aria-label="归档账户：储蓄卡"]').trigger("click");
    expect(updateAccount).toHaveBeenCalledWith("debit-1", {
      isArchived: true,
      version: 3,
    });
    await wrapper.get('button[aria-label="恢复账户：旧钱包"]').trigger("click");
    expect(updateAccount).toHaveBeenCalledWith("archived-1", {
      isArchived: false,
      version: 3,
    });
  });

  it("shows empty states and retries only the original account load", async () => {
    const { loadAccounts, wrapper } = await mountAccounts([], {
      loadError: "账户服务暂时不可用",
    });
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "账户服务暂时不可用",
    );
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();

    expect(loadAccounts).toHaveBeenCalledTimes(2);
    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.text()).toContain("还没有使用中的账户");
    expect(wrapper.text()).toContain("还没有已归档账户");
  });

  it("keeps cached accounts visible beside a retryable load error", async () => {
    const { wrapper } = await mountAccounts(
      [account("cash-1", "CASH", "日常现金")],
      { loadError: "账户服务暂时不可用" },
    );

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "账户服务暂时不可用",
    );
    expect(wrapper.find('[role="alert"] button').exists()).toBe(true);
    expect(wrapper.text()).toContain("日常现金");
    expect(wrapper.text()).not.toContain("还没有使用中的账户");
  });

  it("keeps a cached load error visible when an API write is rejected", async () => {
    const { createAccount, wrapper } = await mountAccounts(
      [account("cash-1", "CASH", "日常现金")],
      { loadError: "账户服务暂时不可用" },
    );
    createAccount.mockRejectedValue(new Error("internal account failure"));

    const input = wrapper.get('input[aria-label="账户名称"]');
    await input.setValue("新钱包");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect((input.element as HTMLInputElement).value).toBe("新钱包");
    expect(wrapper.text()).toContain("操作失败，请稍后重试");
    expect(wrapper.text()).toContain("账户服务暂时不可用");
    expect(wrapper.text()).not.toContain("internal account failure");
    expect(wrapper.find('[role="alert"] button').exists()).toBe(true);
    expect(wrapper.text()).toContain("日常现金");
  });
});
