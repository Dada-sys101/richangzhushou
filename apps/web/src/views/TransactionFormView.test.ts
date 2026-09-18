// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import {
  createMemoryHistory,
  createWebHistory,
  createRouter,
  RouterView,
  type Router,
} from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  type CategorySummary,
  type FinancialAccountSummary,
  type TransactionSummary,
  type TripSummary,
} from "../api/client";
import AppDialogHost from "../components/AppDialogHost.vue";
import * as AppConfirm from "../composables/useAppConfirm";
import { hasUnsavedChanges } from "../composables/useUnsavedChanges";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import { useTripsStore } from "../stores/trips";
import { toLocalDateTimeInput, toShanghaiIso } from "../utils/time";
import TransactionFormView from "./TransactionFormView.vue";

const DateTimeFieldStub = {
  props: ["modelValue", "required"],
  emits: ["update:modelValue", "change"],
  template:
    '<input class="date-time-field-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};

const RouterHost = {
  components: { AppDialogHost, RouterView },
  template: "<RouterView /><AppDialogHost />",
};

interface MountOptions {
  edit?: boolean;
  failCategories?: boolean;
  failEditLoad?: boolean;
  history?: "memory" | "web";
  seedBackHistory?: boolean;
  transaction?: TransactionSummary;
}

const mounted = new Set<{
  router: Router;
  wrapper: VueWrapper;
  webHistory: boolean;
}>();

function timestamp(): string {
  return "2026-09-15T04:34:00.000Z";
}

function transaction(
  type: TransactionSummary["type"] = "EXPENSE",
  overrides: Partial<TransactionSummary> = {},
): TransactionSummary {
  return {
    accountId: "account-active",
    amount: "12.3400",
    categoryId: "category-expense",
    createdAt: timestamp(),
    currency: "CNY",
    deletedAt: null,
    id: "transaction-1",
    isUnlinkedRefund: type === "REFUND",
    merchant: "示例商户",
    note: "示例备注",
    occurredAt: timestamp(),
    originalTransactionId: type === "REFUND" ? "expense-original" : null,
    source: "WEB",
    sourceFingerprint: null,
    status: "CONFIRMED",
    tripId: "trip-active",
    type,
    updatedAt: timestamp(),
    version: 7,
    ...overrides,
  };
}

function category(
  id: string,
  kind: CategorySummary["kind"],
  overrides: Partial<CategorySummary> = {},
): CategorySummary {
  return {
    color: "#7c5cfa",
    createdAt: timestamp(),
    deletedAt: null,
    id,
    isArchived: false,
    kind,
    name: id,
    updatedAt: timestamp(),
    version: 1,
    ...overrides,
  };
}

function account(
  id: string,
  overrides: Partial<FinancialAccountSummary> = {},
): FinancialAccountSummary {
  return {
    createdAt: timestamp(),
    deletedAt: null,
    id,
    isArchived: false,
    kind: "CASH",
    name: id,
    updatedAt: timestamp(),
    version: 1,
    ...overrides,
  };
}

function trip(id: string, overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    budgetAmount: null,
    createdAt: timestamp(),
    deletedAt: null,
    destination: "上海",
    endDate: "2026-09-20",
    id,
    startDate: "2026-09-15",
    title: id,
    updatedAt: timestamp(),
    version: 1,
    ...overrides,
  };
}

function makeRouter(history: "memory" | "web" = "memory"): Router {
  return createRouter({
    history: history === "web" ? createWebHistory() : createMemoryHistory(),
    routes: [
      {
        path: "/records",
        component: { template: '<div data-testid="records-page">记录</div>' },
        meta: { page: { title: "记录" } },
        name: "records",
      },
      {
        path: "/transactions/new",
        component: TransactionFormView,
        meta: {
          page: {
            parent: { path: "/records", title: "记录" },
            title: "新增记账",
          },
        },
        name: "transaction-new",
      },
      {
        path: "/transactions/:id/edit",
        component: TransactionFormView,
        meta: {
          page: {
            parent: { path: "/records", title: "记录" },
            title: "编辑记账",
          },
        },
        name: "transaction-edit",
      },
    ],
  });
}

async function mountView(options: MountOptions = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.$patch({ accessToken: "access-token" });
  const finance = useFinanceStore();
  const trips = useTripsStore();
  finance.$patch({
    categories: [
      category("expense-visible", "EXPENSE", { name: "餐饮" }),
      category("expense-archived", "EXPENSE", {
        isArchived: true,
        name: "已归档支出",
      }),
      category("income-visible", "INCOME", { name: "工资" }),
      category("income-archived", "INCOME", {
        isArchived: true,
        name: "已归档收入",
      }),
    ],
    accounts: [
      account("account-active", { name: "现金" }),
      account("account-archived", { isArchived: true, name: "旧账户" }),
    ],
    transactions: [
      transaction("EXPENSE", {
        id: "expense-original",
        merchant: "原支出",
      }),
      transaction("INCOME", { id: "income-original", merchant: "收入" }),
      transaction("REFUND", { id: "refund-original", merchant: "退款" }),
    ],
  });
  trips.$patch({
    trips: [
      trip("trip-active", { title: "上海出差" }),
      trip("trip-deleted", { deletedAt: timestamp(), title: "已删除行程" }),
    ],
  });

  let failCategories = options.failCategories ?? false;
  let failEditLoad = options.failEditLoad ?? false;
  const loadCategories = vi
    .spyOn(finance, "loadCategories")
    .mockImplementation(async () => {
      if (failCategories) {
        failCategories = false;
        finance.errorMessage = "分类加载失败";
      }
    });
  const loadAccounts = vi
    .spyOn(finance, "loadAccounts")
    .mockResolvedValue(undefined);
  const loadTransactions = vi
    .spyOn(finance, "loadTransactions")
    .mockResolvedValue(undefined);
  const loadTrips = vi.spyOn(trips, "loadTrips").mockResolvedValue(undefined);
  const getTransaction = vi
    .spyOn(finance, "getTransaction")
    .mockImplementation(async () => {
      if (failEditLoad) {
        failEditLoad = false;
        throw new Error("账单加载失败");
      }
      return options.transaction ?? transaction("REFUND");
    });

  const history = options.history ?? "memory";
  if (history === "web") {
    window.history.replaceState(null, "", "/");
  }
  const router = makeRouter(history);
  if (options.seedBackHistory) {
    await router.push({ name: "records" });
  }
  await router.push({
    name: options.edit ? "transaction-edit" : "transaction-new",
    ...(options.edit ? { params: { id: "transaction-1" } } : {}),
    query: { returnTo: "/records?source=transactions" },
  });
  await router.isReady();
  const wrapper = mount(RouterHost, {
    attachTo: history === "web" ? document.body : undefined,
    global: {
      plugins: [pinia, router],
      stubs: { AppIcon: true, DateTimeField: DateTimeFieldStub },
    },
  });
  mounted.add({ router, webHistory: history === "web", wrapper });
  await flushPromises();
  return {
    auth,
    finance,
    getTransaction,
    loadAccounts,
    loadCategories,
    loadTransactions,
    loadTrips,
    router,
    trips,
    wrapper,
  };
}

async function submit(wrapper: VueWrapper) {
  await wrapper.get("form#transaction-form").trigger("submit");
  await flushPromises();
}

function inputValue(wrapper: VueWrapper, selector: string): string {
  return (wrapper.get(selector).element as HTMLInputElement).value;
}

async function settleBrowserHistory() {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  await flushPromises();
}

afterEach(() => {
  for (const resource of mounted) {
    resource.wrapper.unmount();
    if (resource.webHistory) {
      resource.router.options.history.destroy();
    }
  }
  mounted.clear();
  hasUnsavedChanges.value = false;
  AppConfirm.resolveAppConfirm(false);
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(false);
});

describe("TransactionFormView", () => {
  it("renders a clean new form with Shanghai default time and external actions", async () => {
    const { getTransaction, wrapper } = await mountView();

    expect(wrapper.find(".ui-page-frame--form").exists()).toBe(true);
    expect(wrapper.get("h1#transaction-form-title").text()).toBe("记一笔");
    expect(wrapper.find("form#transaction-form").exists()).toBe(true);
    expect(wrapper.find('button[form="transaction-form"]').exists()).toBe(true);
    expect(wrapper.get("a.secondary-button").attributes("href")).toBe(
      "/records?source=transactions",
    );
    expect(wrapper.get(".date-time-field-stub").attributes("value")).toBe(
      toLocalDateTimeInput(new Date().toISOString()),
    );
    expect(wrapper.get("select").element).toBeTruthy();
    expect(getTransaction).not.toHaveBeenCalled();
  });

  it("hydrates every edit field in Shanghai time and sends the existing version", async () => {
    const current = transaction("REFUND", {
      accountId: "account-active",
      amount: "000000000000000000000000.0100",
      categoryId: "expense-visible",
      isUnlinkedRefund: false,
      merchant: "  编辑商户  ",
      note: "编辑备注",
      originalTransactionId: "expense-original",
      tripId: "trip-active",
      version: 12,
    });
    const { finance, wrapper } = await mountView({
      edit: true,
      transaction: current,
    });

    expect(wrapper.get("h1#transaction-form-title").text()).toBe("编辑账单");
    expect(inputValue(wrapper, ".transaction-amount-field input")).toBe(
      current.amount,
    );
    expect(inputValue(wrapper, ".date-time-field-stub")).toBe(
      toLocalDateTimeInput(current.occurredAt),
    );
    expect(inputValue(wrapper, ".transaction-wide-field input")).toBe(
      current.merchant!,
    );
    expect(wrapper.get("textarea").element).toHaveProperty(
      "value",
      current.note,
    );
    expect(
      (
        wrapper.get(".transaction-form-grid select")
          .element as HTMLSelectElement
      ).value,
    ).toBe("REFUND");
    expect(
      wrapper.get(".transaction-refund-fields select").element,
    ).toHaveProperty("value", "expense-original");

    vi.spyOn(finance, "updateTransaction").mockResolvedValue({
      transaction: current,
    });
    await submit(wrapper);

    expect(finance.updateTransaction).toHaveBeenCalledWith("transaction-1", {
      accountId: "account-active",
      amount: current.amount,
      categoryId: "expense-visible",
      isUnlinkedRefund: false,
      merchant: "编辑商户",
      note: "编辑备注",
      occurredAt: toShanghaiIso(toLocalDateTimeInput(current.occurredAt)),
      originalTransactionId: "expense-original",
      tripId: "trip-active",
      type: "REFUND",
      version: 12,
    });
  });

  it("filters categories, accounts, trips, and refund originals without inference", async () => {
    const { wrapper } = await mountView();
    const selects = wrapper.findAll("select");

    expect(selects[1]!.text()).toContain("餐饮");
    expect(selects[1]!.text()).not.toContain("工资");
    expect(selects[1]!.text()).not.toContain("已归档");
    expect(selects[2]!.text()).toContain("现金");
    expect(selects[2]!.text()).not.toContain("旧账户");
    expect(selects[3]!.text()).toContain("上海出差");
    expect(selects[3]!.text()).not.toContain("已删除行程");

    await selects[0]!.setValue("INCOME");
    expect(wrapper.findAll("select")[1]!.text()).toContain("工资");
    expect(wrapper.findAll("select")[1]!.text()).not.toContain("餐饮");

    await selects[0]!.setValue("REFUND");
    expect(wrapper.find(".transaction-refund-fields").exists()).toBe(true);
    const original = wrapper.get(".transaction-refund-fields select");
    expect(original.text()).toContain("原支出");
    expect(original.text()).not.toContain("收入");
    expect(original.text()).not.toContain("退款");

    await wrapper.get(".transaction-refund-toggle input").setValue(true);
    expect(wrapper.find(".transaction-refund-fields select").exists()).toBe(
      false,
    );
  });

  it("shows initialization failures honestly and retries loading", async () => {
    const { loadCategories, wrapper } = await mountView({
      failCategories: true,
    });

    expect(wrapper.find(".feedback-error-state").text()).toContain(
      "分类加载失败",
    );
    expect(wrapper.find("form#transaction-form").exists()).toBe(false);
    await wrapper.get(".feedback-error-state button").trigger("click");
    await flushPromises();
    expect(loadCategories).toHaveBeenCalledTimes(2);
    expect(wrapper.find("form#transaction-form").exists()).toBe(true);
  });

  it("retries an edit-load failure without showing editable fields first", async () => {
    const current = transaction("EXPENSE");
    const { getTransaction, wrapper } = await mountView({
      edit: true,
      failEditLoad: true,
      transaction: current,
    });

    expect(wrapper.find(".feedback-error-state").text()).toContain(
      "账单加载失败",
    );
    expect(wrapper.find("form#transaction-form").exists()).toBe(false);
    await wrapper.get(".feedback-error-state button").trigger("click");
    await flushPromises();
    expect(getTransaction).toHaveBeenCalledTimes(2);
    expect(wrapper.find("form#transaction-form").exists()).toBe(true);
  });

  it("keeps input after field and network failures, prioritizing field errors", async () => {
    const { finance, wrapper } = await mountView();
    const create = vi.spyOn(finance, "createTransaction");
    create.mockRejectedValueOnce(
      new ApiClientError(422, "VALIDATION_ERROR", "请求失败", [
        { field: "amount", message: "金额格式不正确" },
      ]),
    );
    await wrapper.get(".transaction-amount-field input").setValue("0007.0100");
    await wrapper.get(".transaction-wide-field input").setValue("  保留商户  ");
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toContain("金额格式不正确");
    expect(inputValue(wrapper, ".transaction-amount-field input")).toBe(
      "0007.0100",
    );
    expect(inputValue(wrapper, ".transaction-wide-field input")).toBe(
      "  保留商户  ",
    );

    create.mockRejectedValueOnce(
      new ApiClientError(0, "NETWORK_ERROR", "网络暂时不可用"),
    );
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toContain("网络暂时不可用");
    expect(inputValue(wrapper, ".transaction-amount-field input")).toBe(
      "0007.0100",
    );
  });

  it("keeps exact amount strings, trims optional fields, serializes Shanghai time, and warns on duplicates", async () => {
    const { finance, router, wrapper } = await mountView();
    vi.spyOn(router, "replace").mockResolvedValue(undefined);
    vi.spyOn(finance, "createTransaction").mockResolvedValue({
      duplicateWarning: {
        code: "POSSIBLE_DUPLICATE",
        matchedTransactionId: "expense-original",
        message: "可能与已有账单重复",
      },
      transaction: transaction("EXPENSE"),
    });
    await wrapper.get(".transaction-amount-field input").setValue("0007.0100");
    await wrapper.get(".date-time-field-stub").setValue("2026-09-15T12:34");
    await wrapper.get(".transaction-wide-field input").setValue("  咖啡店  ");
    await wrapper.get("textarea").setValue("  会议  ");
    await submit(wrapper);

    expect(finance.createTransaction).toHaveBeenCalledWith({
      accountId: null,
      amount: "0007.0100",
      categoryId: null,
      isUnlinkedRefund: false,
      merchant: "咖啡店",
      note: "会议",
      occurredAt: toShanghaiIso("2026-09-15T12:34"),
      originalTransactionId: null,
      tripId: null,
      type: "EXPENSE",
    });
    expect(wrapper.get(".warning-banner").text()).toContain(
      "可能与已有账单重复",
    );
    expect(router.replace).toHaveBeenCalledWith("/records?source=transactions");
  });

  it("submits refund associations only for refunds and prevents duplicate saves", async () => {
    const { finance, router, wrapper } = await mountView();
    vi.spyOn(router, "replace").mockResolvedValue(undefined);
    let resolveDeferred: (value: {
      transaction: TransactionSummary;
    }) => void = () => undefined;
    const deferred = new Promise<{ transaction: TransactionSummary }>(
      (resolve) => {
        resolveDeferred = resolve;
      },
    );
    const create = vi
      .spyOn(finance, "createTransaction")
      .mockImplementation(async () => await deferred);

    await wrapper.get(".transaction-amount-field input").setValue("1.00");
    await wrapper.findAll("select")[0]!.setValue("REFUND");
    await wrapper
      .get(".transaction-refund-fields select")
      .setValue("expense-original");
    await wrapper.get("form#transaction-form").trigger("submit");
    await wrapper.vm.$nextTick();
    expect(create).toHaveBeenCalledTimes(1);
    expect(
      wrapper.get('button[form="transaction-form"]').attributes("disabled"),
    ).toBe("");
    expect(wrapper.get('button[form="transaction-form"]').text()).toContain(
      "保存中…",
    );
    await wrapper.get("form#transaction-form").trigger("submit");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "1.00",
        isUnlinkedRefund: false,
        originalTransactionId: "expense-original",
        type: "REFUND",
      }),
    );

    resolveDeferred({ transaction: transaction("REFUND") });
    await flushPromises();

    vi.spyOn(finance, "createTransaction").mockResolvedValue({
      transaction: transaction("EXPENSE"),
    });
    await wrapper.findAll("select")[0]!.setValue("REFUND");
    await wrapper
      .get(".transaction-refund-fields select")
      .setValue("expense-original");
    await wrapper.get(".transaction-refund-toggle input").setValue(true);
    await submit(wrapper);
    expect(finance.createTransaction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isUnlinkedRefund: true,
        originalTransactionId: null,
        type: "REFUND",
      }),
    );

    await wrapper.findAll("select")[0]!.setValue("EXPENSE");
    await submit(wrapper);
    expect(finance.createTransaction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isUnlinkedRefund: false,
        originalTransactionId: null,
        type: "EXPENSE",
      }),
    );
  });

  it("uses replace navigation for a clean cancel", async () => {
    const { router, wrapper } = await mountView();

    await wrapper.get("a.secondary-button").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe(
      "/records?source=transactions",
    );
  });

  it("supports cancel replace and dirty navigation protection, then clears the guard after save", async () => {
    const { finance, router, wrapper } = await mountView();
    expect(hasUnsavedChanges.value).toBe(false);
    await wrapper.get(".transaction-amount-field input").setValue("1.00");
    await wrapper.vm.$nextTick();
    expect(hasUnsavedChanges.value).toBe(true);

    const confirm = vi.mocked(AppConfirm.requestAppConfirm);
    await wrapper.get("a.secondary-button").trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("transaction-new");

    vi.spyOn(finance, "createTransaction").mockResolvedValue({
      transaction: transaction("EXPENSE"),
    });
    vi.spyOn(router, "replace").mockResolvedValue(undefined);
    await submit(wrapper);
    await wrapper.vm.$nextTick();
    expect(hasUnsavedChanges.value).toBe(false);
  });

  it("rejects and accepts dirty Browser Back while keeping the page and return context", async () => {
    const initialConfirm = vi.mocked(AppConfirm.requestAppConfirm);
    initialConfirm.mockRestore();
    const { router, wrapper } = await mountView({
      history: "web",
      seedBackHistory: true,
    });
    await wrapper.get(".transaction-amount-field input").setValue("1.00");
    await router.back();
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    document
      .querySelector<HTMLButtonElement>('[role="dialog"] button.secondary')
      ?.click();
    await settleBrowserHistory();
    expect(router.currentRoute.value.name).toBe("transaction-new");

    await router.back();
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    document
      .querySelector<HTMLButtonElement>('[role="dialog"] button.danger')
      ?.click();
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe("records");
    });
    expect(router.currentRoute.value.name).toBe("records");
  });
});
