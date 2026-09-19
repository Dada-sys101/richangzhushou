// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent } from "vue";

import type {
  CategorySummary,
  DraftSummary,
  FinancialAccountSummary,
} from "../api/client";
import DraftReviewCard from "./DraftReviewCard.vue";

const DateTimeStub = defineComponent({
  props: {
    disabled: Boolean,
    modelValue: { default: "", type: String },
  },
  emits: ["change", "update:modelValue"],
  template:
    '<input data-testid="draft-datetime" :disabled="disabled" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\')" />',
});

function draft(
  status: DraftSummary["status"] = "PENDING",
  overrides: Partial<DraftSummary> = {},
): DraftSummary {
  return {
    attachmentId: null,
    clientMutationId: null,
    confidence: { amount: 0.91, merchant: 0.78 },
    confirmedAt: status === "CONFIRMED" ? "2026-08-06T01:00:00.000Z" : null,
    createdAt: "2026-08-06T00:00:00.000Z",
    discardedAt: status === "DISCARDED" ? "2026-08-06T01:00:00.000Z" : null,
    failureReason: status === "FAILED" ? "解析失败" : null,
    id: "draft-1",
    payload: {
      accountId: "account-active",
      amount: "88.00",
      categoryId: "category-active",
      currency: "CNY",
      merchant: "很长很长的商户名称用于换行检查",
      note: "一段很长的备注，必须保持在卡片内并允许换行。",
      occurredAt: "2026-08-06T00:00:00.000Z",
      type: "EXPENSE",
    },
    resultId: status === "CONFIRMED" ? "transaction-1" : null,
    source: "TEXT",
    status,
    targetType: "TRANSACTION",
    updatedAt: "2026-08-06T00:00:00.000Z",
    version: 3,
    ...overrides,
  };
}

function category(
  id: string,
  name: string,
  isArchived = false,
): CategorySummary {
  return {
    color: "#7c5cfa",
    createdAt: "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    id,
    isArchived,
    kind: "EXPENSE",
    name,
    updatedAt: "2026-08-01T00:00:00.000Z",
    version: 1,
  };
}

function account(
  id: string,
  name: string,
  isArchived = false,
): FinancialAccountSummary {
  return {
    createdAt: "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    id,
    isArchived,
    kind: "CASH",
    name,
    updatedAt: "2026-08-01T00:00:00.000Z",
    version: 1,
  };
}

function mountCard(value = draft(), options: { saving?: boolean } = {}) {
  return mount(DraftReviewCard, {
    props: {
      accounts: [
        account("account-active", "现金"),
        account("account-old", "旧账户", true),
      ],
      categories: [
        category("category-active", "餐饮"),
        category("category-old", "旧分类", true),
      ],
      draft: value,
      saving: options.saving,
    },
    global: { stubs: { DateTimeField: DateTimeStub } },
  });
}

describe("DraftReviewCard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders visible status, confidence, and draft-only confirmation boundary", () => {
    const wrapper = mountCard();

    expect(wrapper.get('[role="status"]').text()).toBe("待确认");
    expect(wrapper.get('[role="note"]').text()).toContain("不会写入正式账单");
    expect(wrapper.text()).toContain("识别置信度：金额 91% · 商户 78%");
    expect(wrapper.text()).toContain("文本解析");
  });

  it("filters archived categories and accounts without changing the payload context", () => {
    const wrapper = mountCard();

    expect(wrapper.get('select[aria-label="草稿分类"]').text()).toContain(
      "餐饮",
    );
    expect(wrapper.get('select[aria-label="草稿分类"]').text()).not.toContain(
      "旧分类",
    );
    expect(wrapper.get('select[aria-label="草稿账户"]').text()).toContain(
      "现金",
    );
    expect(wrapper.get('select[aria-label="草稿账户"]').text()).not.toContain(
      "旧账户",
    );
  });

  it("emits only changed payloads with the server version and Shanghai time", async () => {
    const wrapper = mountCard();
    const save = wrapper.get("button").element as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await wrapper.get('input[aria-label="草稿金额"]').setValue("99.50");
    expect((wrapper.get("button").element as HTMLButtonElement).disabled).toBe(
      false,
    );
    await wrapper
      .get('[data-testid="draft-datetime"]')
      .setValue("2026-08-06T08:30");
    await wrapper.get("button").trigger("click");

    const emitted = wrapper.emitted("save");
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual([
      "draft-1",
      expect.objectContaining({
        amount: "99.50",
        occurredAt: "2026-08-06T00:30:00.000Z",
        type: "EXPENSE",
      }),
      3,
    ]);
  });

  it("does not emit when an edit returns to the original value", async () => {
    const wrapper = mountCard();
    const input = wrapper.get('input[aria-label="草稿金额"]');

    await input.setValue("99.00");
    await input.setValue("88.00");
    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("save")).toBeUndefined();
    expect((wrapper.get("button").element as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("requires saving local edits before confirmation", async () => {
    const wrapper = mountCard();
    const confirm = wrapper.get("button.primary-button");

    expect((confirm.element as HTMLButtonElement).disabled).toBe(false);
    await wrapper.get('input[aria-label="草稿金额"]').setValue("99.50");
    expect((confirm.element as HTMLButtonElement).disabled).toBe(true);

    await confirm.trigger("click");
    expect(wrapper.emitted("confirm")).toBeUndefined();
  });

  it("synchronizes local inputs and resets changed state when the server prop changes", async () => {
    const wrapper = mountCard();
    await wrapper.get('input[aria-label="草稿商户"]').setValue("本地编辑");
    expect((wrapper.get("button").element as HTMLButtonElement).disabled).toBe(
      false,
    );

    await wrapper.setProps({
      draft: draft("PENDING", {
        payload: {
          ...draft().payload,
          amount: "101.20",
          merchant: "服务端最新值",
        },
        version: 4,
      }),
    });
    await flushPromises();

    expect(wrapper.get('input[aria-label="草稿金额"]').element).toHaveProperty(
      "value",
      "101.20",
    );
    expect(wrapper.get('input[aria-label="草稿商户"]').element).toHaveProperty(
      "value",
      "服务端最新值",
    );
    expect((wrapper.get("button").element as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("keeps confirmed and discarded drafts read-only", () => {
    for (const status of ["CONFIRMED", "DISCARDED"] as const) {
      const wrapper = mountCard(draft(status));
      expect(wrapper.find('input[aria-label="草稿金额"]').exists()).toBe(false);
      expect(wrapper.find("button").exists()).toBe(false);
      expect(wrapper.text()).toContain(
        status === "CONFIRMED" ? "已确认" : "已丢弃",
      );
      wrapper.unmount();
    }
  });

  it("shows failure context without losing the draft fields", () => {
    const wrapper = mountCard(draft("FAILED"));

    expect(wrapper.text()).toContain("失败原因：解析失败");
    expect(wrapper.get(".draft-readonly").text()).toContain("88.00");
    expect(wrapper.get(".draft-readonly").text()).toContain(
      "很长很长的商户名称",
    );
  });

  it("disables only the card being saved", () => {
    const wrapper = mountCard(draft(), { saving: true });

    expect(
      (wrapper.get('input[aria-label="草稿金额"]').element as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        wrapper.get('select[aria-label="草稿分类"]')
          .element as HTMLSelectElement
      ).disabled,
    ).toBe(true);
    expect((wrapper.get("button").element as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
