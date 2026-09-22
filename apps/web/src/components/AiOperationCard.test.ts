// @vitest-environment jsdom

import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import type {
  AiOperation,
  AiOperationStatus,
  AiOperationType,
} from "../api/client";
import AiOperationCard from "./AiOperationCard.vue";

const DateTimeFieldStub = {
  inheritAttrs: false,
  props: ["modelValue", "disabled"],
  template:
    '<button v-bind="$attrs" class="date-time-field-stub" type="button" :disabled="disabled">{{ modelValue || "请选择时间" }}</button>',
};

const DateFieldStub = {
  inheritAttrs: false,
  props: ["modelValue", "disabled"],
  template:
    '<button v-bind="$attrs" class="date-field-stub" type="button" :disabled="disabled">{{ modelValue || "请选择日期" }}</button>',
};

const mountedWrappers = new Set<VueWrapper>();

function operation(
  operationType: AiOperationType = "TASK",
  status: AiOperationStatus = "PENDING",
  overrides: Partial<AiOperation> = {},
): AiOperation {
  const fields: Record<AiOperationType, Record<string, unknown>> = {
    TRANSACTION: {
      type: "EXPENSE",
      amount: "12.30",
      currency: "CNY",
      occurredAt: "2026-08-18T01:00:00.000Z",
      merchant: "示例商户",
      note: "午餐",
      categoryId: "category-1",
      accountId: "account-1",
      source: "TEXT",
      isUnlinkedRefund: false,
    },
    CALENDAR_EVENT: {
      title: "项目评审",
      startsAt: "2026-08-18T01:00:00.000Z",
      endsAt: "2026-08-18T02:00:00.000Z",
      allDay: false,
    },
    TASK: {
      title: "整理材料",
      priority: "MEDIUM",
      dueAt: "2026-08-18T01:00:00.000Z",
    },
    REMINDER: {
      title: "喝水",
      note: "记得补水",
      scheduleType: "DAILY",
      startsAt: "2026-08-18T01:00:00.000Z",
      targetType: "STANDALONE",
      recurrence: { interval: 1 },
    },
    TRIP: {
      title: "出差",
      destination: "上海",
      startDate: "2026-08-08",
      endDate: "2026-08-10",
      budgetAmount: "100.00",
    },
  };

  return {
    acceptedAt: status === "ACCEPTED" ? "2026-08-18T02:00:00.000Z" : null,
    appliedAt: status === "APPLIED" ? "2026-08-18T03:00:00.000Z" : null,
    clarification: null,
    confidence: "0.9000",
    createdAt: "2026-08-18T00:00:00.000Z",
    errorCode: null,
    errorMessage: null,
    fields: fields[operationType],
    id: `${operationType.toLowerCase()}-operation-1`,
    operationType,
    ordinal: 1,
    rejectedAt: status === "REJECTED" ? "2026-08-18T02:00:00.000Z" : null,
    resultDraftId: null,
    resultEntityId: status === "APPLIED" ? "entity-1" : null,
    resultEntityType: status === "APPLIED" ? operationType : null,
    status,
    updatedAt: "2026-08-18T00:00:00.000Z",
    ...overrides,
  };
}

function mountCard(
  value: AiOperation,
  props: { mutationLocked?: boolean; saving?: boolean } = {},
) {
  const wrapper = mount(AiOperationCard, {
    global: {
      stubs: {
        DateField: DateFieldStub,
        DateTimeField: DateTimeFieldStub,
      },
    },
    props: {
      mutationLocked: false,
      operation: value,
      proposalVersion: 1,
      saving: false,
      ...props,
    },
  });
  mountedWrappers.add(wrapper);
  return wrapper;
}

afterEach(() => {
  for (const wrapper of mountedWrappers) {
    wrapper.unmount();
  }
  mountedWrappers.clear();
});

describe("AiOperationCard", () => {
  it("renders the five operation kinds with localized headings", () => {
    const kinds: Array<[AiOperationType, string]> = [
      ["TRANSACTION", "账单"],
      ["CALENDAR_EVENT", "日程"],
      ["TASK", "待办"],
      ["REMINDER", "提醒"],
      ["TRIP", "行程"],
    ];

    for (const [kind, label] of kinds) {
      const wrapper = mountCard(operation(kind));
      expect(wrapper.get('[data-testid="operation-kind"]').text()).toBe(label);
      wrapper.unmount();
      mountedWrappers.delete(wrapper);
    }
  });

  it("uses localized labels and accessible ids for transaction fields", () => {
    const wrapper = mountCard(operation("TRANSACTION"));
    const labels = wrapper
      .findAll(".draft-field-label")
      .map((item) => item.text());

    expect(labels).toEqual([
      "收支类型",
      "金额",
      "币种",
      "发生时间",
      "商户",
      "备注",
    ]);
    const amount = wrapper.find('input[id$="-amount"]');
    expect(amount.attributes("aria-labelledby")).toContain(
      amount.attributes("id") + "-label",
    );
  });

  it("keeps calendar all-day and date field semantics visible", () => {
    const wrapper = mountCard(operation("CALENDAR_EVENT"));

    expect(wrapper.text()).toContain("开始时间");
    expect(wrapper.text()).toContain("结束时间");
    expect(wrapper.text()).toContain("全天");
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);
    expect(wrapper.find(".date-time-field-stub").exists()).toBe(true);
  });

  it("renders task priority as a localized select without changing its enum values", () => {
    const wrapper = mountCard(operation("TASK"));
    const priority = wrapper.find('select[id$="-priority"]');

    expect(priority.findAll("option").map((option) => option.text())).toEqual([
      "低",
      "中",
      "高",
    ]);
    expect(priority.find('option[value="MEDIUM"]').exists()).toBe(true);
  });

  it("renders reminder recurrence and target labels", () => {
    const wrapper = mountCard(operation("REMINDER"));

    expect(wrapper.text()).toContain("重复方式");
    expect(wrapper.text()).toContain("首次提醒时间");
    expect(wrapper.text()).toContain("关联类型");
    expect(wrapper.text()).toContain("单次");
    expect(wrapper.text()).toContain("每天");
  });

  it("renders trip date and budget fields with the original editable keys", () => {
    const wrapper = mountCard(operation("TRIP"));

    expect(wrapper.text()).toContain("开始日期");
    expect(wrapper.text()).toContain("结束日期");
    expect(wrapper.text()).toContain("预算金额");
    expect(wrapper.findAll(".date-field-stub")).toHaveLength(2);
    expect(wrapper.find('input[id$="-budgetAmount"]').exists()).toBe(true);
  });

  it("does not turn structured read-only values into object strings", () => {
    const wrapper = mountCard(
      operation("REMINDER", "ACCEPTED", {
        fields: {
          title: "每周复盘",
          scheduleType: "WEEKLY",
          startsAt: "2026-08-18T01:00:00.000Z",
          recurrence: { interval: 1, weekdays: [1, 3, 5] },
          unknownPayload: { source: "test", value: 2 },
        },
      }),
    );

    expect(wrapper.text()).toContain('"interval":1');
    expect(wrapper.text()).toContain("unknownPayload");
    expect(wrapper.text()).not.toContain("[object Object]");
    expect(wrapper.find(".is-structured").exists()).toBe(true);
  });

  it("uses a safe technical-key fallback for unknown fields", () => {
    const wrapper = mountCard(
      operation("TASK", "ACCEPTED", {
        fields: { title: "任务", mysteryField: "保留" },
      }),
    );

    expect(wrapper.text()).toContain("mysteryField");
    expect(wrapper.text()).toContain("保留");
  });

  it("renders empty values as an em dash and booleans as explicit Chinese text", () => {
    const wrapper = mountCard(
      operation("TRANSACTION", "ACCEPTED", {
        fields: {
          type: "EXPENSE",
          amount: "12.30",
          merchant: "",
          isUnlinkedRefund: false,
        },
      }),
    );

    expect(wrapper.text()).toContain("—");
    expect(wrapper.text()).toContain("否");
  });

  it("formats read-only date-time values in Asia/Shanghai", () => {
    const wrapper = mountCard(
      operation("TASK", "ACCEPTED", {
        fields: {
          title: "任务",
          dueAt: "2026-08-18T01:00:00.000Z",
        },
      }),
    );

    expect(wrapper.text()).toContain("2026-08-18 09:00");
  });

  it("shows status descriptions that do not depend on badge color", () => {
    const statuses: Array<[AiOperationStatus, string]> = [
      ["PENDING", "请核对字段"],
      ["ACCEPTED", "当前操作已由用户确认"],
      ["APPLIED", "正式数据写入已完成"],
      ["EXPIRED", "已超过有效期"],
      ["FAILED", "正式写入未完成"],
      ["REJECTED", "不会写入正式数据"],
    ];

    for (const [status, description] of statuses) {
      const wrapper = mountCard(operation("TASK", status));
      expect(wrapper.find('[role="status"]').text()).toContain(description);
      wrapper.unmount();
      mountedWrappers.delete(wrapper);
    }
  });

  it("shows the failure reason as an accessible alert", () => {
    const wrapper = mountCard(
      operation("TASK", "FAILED", { errorMessage: "服务暂时不可用" }),
    );

    expect(wrapper.find('[role="alert"]').text()).toContain("服务暂时不可用");
  });

  it("keeps applied results read-only and identifies the result entity", () => {
    const wrapper = mountCard(operation("TASK", "APPLIED"));

    expect(wrapper.find(".draft-readonly").exists()).toBe(true);
    expect(wrapper.find(".primary-button").exists()).toBe(false);
    expect(wrapper.text()).toContain("待办");
    expect(wrapper.text()).toContain("entity-1");
  });

  it("allows a pending operation to be accepted without changing its payload", async () => {
    const value = operation("TASK");
    const wrapper = mountCard(value);

    await wrapper.get(".primary-button").trigger("click");

    expect(wrapper.emitted("accept")).toEqual([[value.id]]);
    expect(wrapper.emitted("save")).toBeUndefined();
  });

  it("emits the original operation id and editable fields on save", async () => {
    const value = operation("TASK");
    const wrapper = mountCard(value);

    await wrapper.find('input[id$="-title"]').setValue("更新后的任务");
    await wrapper.get(".secondary-button").trigger("click");

    expect(wrapper.emitted("save")).toEqual([
      [
        value.id,
        expect.objectContaining({
          title: "更新后的任务",
          priority: "MEDIUM",
          dueAt: "2026-08-18T01:00:00.000Z",
        }),
      ],
    ]);
  });

  it("blocks accept until a dirty edit has been saved", async () => {
    const wrapper = mountCard(operation("TASK"));
    const acceptButton = wrapper.get(".primary-button");

    await wrapper.find('input[id$="-title"]').setValue("尚未保存");

    expect(acceptButton.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("已修改字段，请先保存后再接受");
    expect(wrapper.emitted("accept")).toBeUndefined();
  });

  it("blocks accept when required fields are missing", () => {
    const wrapper = mountCard(
      operation("TASK", "PENDING", {
        fields: { title: "", priority: "MEDIUM", dueAt: null },
      }),
    );

    expect(wrapper.get(".primary-button").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("请核对并补充必填字段");
  });

  it("preserves formal-write safety checks for forbidden fields", () => {
    const wrapper = mountCard(
      operation("TASK", "PENDING", {
        fields: {
          title: "任务",
          clientMutationId: "should-not-write",
        },
      }),
    );

    expect(wrapper.text()).toContain("正式写入禁止字段");
    expect(wrapper.get(".primary-button").attributes("disabled")).toBeDefined();
  });

  it("keeps accepted operations read-only while allowing rejection", async () => {
    const value = operation("TASK", "ACCEPTED");
    const wrapper = mountCard(value);

    expect(wrapper.find(".draft-readonly").exists()).toBe(true);
    expect(wrapper.find('input[id$="-title"]').exists()).toBe(false);
    await wrapper.get(".danger-button").trigger("click");

    expect(wrapper.emitted("reject")).toEqual([[value.id]]);
  });

  it("does not render mutation actions for rejected or expired operations", () => {
    for (const status of ["REJECTED", "EXPIRED", "FAILED"] as const) {
      const wrapper = mountCard(operation("TASK", status));
      expect(wrapper.find(".primary-button").exists()).toBe(false);
      expect(wrapper.find(".danger-button").exists()).toBe(false);
      wrapper.unmount();
      mountedWrappers.delete(wrapper);
    }
  });

  it("locks all mutation controls while saving", async () => {
    const wrapper = mountCard(operation("TASK"), { saving: true });

    expect(
      wrapper
        .findAll("button")
        .every((button) => button.attributes("disabled") !== undefined),
    ).toBe(true);
    expect(
      wrapper
        .findAll("input")
        .every((input) => input.attributes("disabled") !== undefined),
    ).toBe(true);
    await wrapper.get(".primary-button").trigger("click");
    expect(wrapper.emitted("accept")).toBeUndefined();
  });

  it("locks mutation controls when authoritative mutation locking is active", () => {
    const wrapper = mountCard(operation("TASK"), { mutationLocked: true });

    expect(wrapper.get(".primary-button").attributes("disabled")).toBeDefined();
    expect(wrapper.get(".danger-button").attributes("disabled")).toBeDefined();
  });

  it("renders clarification as a live status message", () => {
    const wrapper = mountCard(
      operation("TASK", "PENDING", { clarification: "请补充截止时间" }),
    );

    const statusMessages = wrapper.findAll('[role="status"]');
    expect(
      statusMessages.some((item) => item.text().includes("请补充截止时间")),
    ).toBe(true);
  });

  it("does not expose editable controls for terminal applied data", () => {
    const wrapper = mountCard(
      operation("TRANSACTION", "APPLIED", {
        fields: {
          type: "REFUND",
          amount: "10.00",
          originalTransactionId: "transaction-1",
          isUnlinkedRefund: false,
        },
      }),
    );

    expect(wrapper.find(".draft-form").exists()).toBe(false);
    expect(wrapper.find(".draft-readonly").exists()).toBe(true);
    expect(wrapper.text()).toContain("退款");
    expect(wrapper.text()).toContain("原账单");
  });
});
