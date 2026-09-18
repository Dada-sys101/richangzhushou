// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, type CategorySummary } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useFinanceStore } from "../stores/finance";
import CategoriesView from "./CategoriesView.vue";

function category(
  id: string,
  kind: CategorySummary["kind"],
  name: string,
  isArchived = false,
): CategorySummary {
  return {
    color: "#7c5cfa",
    createdAt: "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    id,
    isArchived,
    kind,
    name,
    updatedAt: "2026-08-01T00:00:00.000Z",
    version: 2,
  };
}

async function mountCategories(
  categories: CategorySummary[] = [
    category("expense-1", "EXPENSE", "餐饮"),
    category("income-1", "INCOME", "工资"),
    category("archived-1", "EXPENSE", "旧分类", true),
  ],
  options: { loadError?: string } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "access-token" });
  const finance = useFinanceStore();
  finance.$patch({ categories });
  const loadCategories = vi
    .spyOn(finance, "loadCategories")
    .mockResolvedValue(undefined);
  if (options.loadError) {
    let firstLoad = true;
    loadCategories.mockImplementation(async () => {
      if (firstLoad) {
        finance.errorMessage = options.loadError ?? null;
        firstLoad = false;
      }
    });
  }
  const createCategory = vi
    .spyOn(finance, "createCategory")
    .mockResolvedValue(undefined);
  const updateCategory = vi
    .spyOn(finance, "updateCategory")
    .mockResolvedValue(undefined);
  const wrapper = mount(CategoriesView, {
    global: { plugins: [pinia] },
  });
  await flushPromises();
  return { createCategory, finance, loadCategories, updateCategory, wrapper };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CategoriesView", () => {
  it("keeps the required page order and renders both kinds with consistent actions", async () => {
    const { wrapper } = await mountCategories();

    expect(wrapper.get("#categories-title").text()).toBe("分类管理");
    expect(
      wrapper.findAll(".section-card-header h2").map((item) => item.text()),
    ).toEqual(["新增分类", "支出分类", "收入分类", "已归档分类"]);
    expect(wrapper.text()).toContain("支出");
    expect(wrapper.text()).toContain("收入");
    expect(wrapper.text()).toContain("餐饮");
    expect(wrapper.text()).toContain("工资");
    expect(
      wrapper.find('button[aria-label="编辑收入分类：工资"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('button[aria-label="归档收入分类：工资"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('button[aria-label="恢复支出分类：旧分类"]').exists(),
    ).toBe(true);
  });

  it("preserves the new name and shows an action failure", async () => {
    const { createCategory, wrapper } = await mountCategories([]);
    createCategory.mockRejectedValue(
      new ApiClientError(400, "CATEGORY_EXISTS", "分类名称已存在"),
    );

    const input = wrapper.get('input[aria-label="分类名称"]');
    await input.setValue("餐饮");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain("分类名称已存在");
    expect((input.element as HTMLInputElement).value).toBe("餐饮");
  });

  it("clears a successful create before surfacing its refresh failure", async () => {
    const { createCategory, finance, loadCategories, wrapper } =
      await mountCategories([]);
    createCategory.mockImplementation(async () => {
      finance.errorMessage = "分类刷新失败";
    });

    const input = wrapper.get('input[aria-label="分类名称"]');
    await input.setValue("交通");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect((input.element as HTMLInputElement).value).toBe("");
    expect(wrapper.get('[role="alert"]').text()).toContain("分类刷新失败");
    expect(wrapper.find('[role="alert"] button').exists()).toBe(true);
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(loadCategories).toHaveBeenCalledTimes(2);
  });

  it("keeps cached row actions locked after a rename refresh failure", async () => {
    const { finance, loadCategories, updateCategory, wrapper } =
      await mountCategories();
    updateCategory.mockImplementation(async () => {
      finance.errorMessage = "分类刷新失败";
    });

    await wrapper
      .get('button[aria-label="编辑收入分类：工资"]')
      .trigger("click");
    await wrapper
      .get('input[aria-label="编辑收入分类名称"]')
      .setValue("工资收入");
    const saveButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "保存");
    await saveButton?.trigger("click");
    await flushPromises();

    expect(wrapper.find('[role="alert"] button').exists()).toBe(true);
    expect(
      wrapper
        .get('button[aria-label="编辑收入分类：工资"]')
        .attributes("disabled"),
    ).toBe("");
    expect(
      wrapper
        .get('button[aria-label="归档收入分类：工资"]')
        .attributes("disabled"),
    ).toBe("");

    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(loadCategories).toHaveBeenCalledTimes(2);
    expect(
      wrapper
        .get('button[aria-label="编辑收入分类：工资"]')
        .attributes("disabled"),
    ).toBeUndefined();
  });

  it("allows income editing and preserves edit input after a versioned failure", async () => {
    const { updateCategory, wrapper } = await mountCategories();

    await wrapper
      .get('button[aria-label="编辑收入分类：工资"]')
      .trigger("click");
    const editInput = wrapper.get('input[aria-label="编辑收入分类名称"]');
    await editInput.setValue("工资收入");
    updateCategory.mockRejectedValue(
      new ApiClientError(409, "VERSION_CONFLICT", "分类已被更新，请刷新后重试"),
    );
    const saveButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "保存");
    await saveButton?.trigger("click");
    await flushPromises();

    expect(updateCategory).toHaveBeenCalledWith("income-1", {
      name: "工资收入",
      version: 2,
    });
    expect(wrapper.get('[role="alert"]').text()).toContain("分类已被更新");
    expect((editInput.element as HTMLInputElement).value).toBe("工资收入");
    expect(
      wrapper.find('button[aria-label="编辑收入分类：工资"]').exists(),
    ).toBe(false);
  });

  it("shows empty, loading failure, and a direct retry without hiding the form", async () => {
    const { loadCategories, wrapper } = await mountCategories([], {
      loadError: "分类服务暂时不可用",
    });
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();

    expect(loadCategories).toHaveBeenCalledTimes(2);
    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.text()).toContain("还没有支出分类");
    expect(wrapper.text()).toContain("还没有收入分类");
    expect(wrapper.text()).toContain("还没有已归档分类");
  });

  it("keeps cached categories visible beside a retryable load error", async () => {
    const { wrapper } = await mountCategories(
      [category("expense-1", "EXPENSE", "餐饮")],
      { loadError: "分类服务暂时不可用" },
    );

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "分类服务暂时不可用",
    );
    expect(wrapper.find('[role="alert"] button').exists()).toBe(true);
    expect(wrapper.text()).toContain("餐饮");
    expect(wrapper.text()).not.toContain("还没有支出分类");
  });

  it("keeps a no-cache load error visible when an API write is rejected", async () => {
    const { createCategory, wrapper } = await mountCategories([], {
      loadError: "分类服务暂时不可用",
    });
    createCategory.mockRejectedValue(new Error("internal category failure"));

    const input = wrapper.get('input[aria-label="分类名称"]');
    await input.setValue("交通");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect((input.element as HTMLInputElement).value).toBe("交通");
    expect(wrapper.text()).toContain("操作失败，请稍后重试");
    expect(wrapper.text()).toContain("分类服务暂时不可用");
    expect(wrapper.text()).not.toContain("internal category failure");
    expect(wrapper.find('[role="alert"] button').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("还没有支出分类");
  });
});
