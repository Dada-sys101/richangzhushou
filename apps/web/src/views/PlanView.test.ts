// @vitest-environment jsdom
import { flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CalendarEventSummary,
  ReminderSummary,
  TaskSummary,
} from "../api/client";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import { todayInShanghai } from "../utils/time";
import PlanView from "./PlanView.vue";

function atShanghaiTime(hour: string) {
  return new Date(todayInShanghai() + "T" + hour + ":00+08:00").toISOString();
}

function calendarEvent(
  overrides: Partial<CalendarEventSummary> = {},
): CalendarEventSummary {
  return {
    allDay: false,
    createdAt: atShanghaiTime("08:00"),
    deletedAt: null,
    endsAt: atShanghaiTime("10:00"),
    id: "event-1",
    startsAt: atShanghaiTime("09:00"),
    status: "SCHEDULED",
    title: "客户会议",
    updatedAt: atShanghaiTime("08:00"),
    version: 1,
    ...overrides,
  };
}

function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    cancelledAt: null,
    completedAt: null,
    createdAt: atShanghaiTime("08:00"),
    deletedAt: null,
    dueAt: atShanghaiTime("11:00"),
    id: "task-1",
    overdue: false,
    priority: "MEDIUM",
    status: "OPEN",
    title: "整理会议纪要",
    updatedAt: atShanghaiTime("08:00"),
    version: 1,
    ...overrides,
  };
}

function reminder(overrides: Partial<ReminderSummary> = {}): ReminderSummary {
  return {
    attemptCount: 0,
    createdAt: atShanghaiTime("08:00"),
    deletedAt: null,
    failureReason: null,
    id: "reminder-1",
    note: null,
    recurrence: null,
    scheduleType: "ONCE",
    scheduledAt: atShanghaiTime("15:00"),
    sentAt: null,
    status: "SCHEDULED",
    suppressedAt: null,
    targetId: null,
    targetType: "STANDALONE",
    title: "提交日报提醒",
    updatedAt: atShanghaiTime("08:00"),
    version: 1,
    ...overrides,
  };
}

function mountPlan(pinia: ReturnType<typeof createPinia>) {
  return mount(PlanView, {
    global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
  });
}

function createPlanContext() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.$patch({ accessToken: "token" });
  return { pinia, planner: usePlannerStore() };
}

function resolveAllLoads(planner: ReturnType<typeof usePlannerStore>) {
  vi.spyOn(planner, "loadCalendarEvents").mockResolvedValue(undefined);
  vi.spyOn(planner, "loadTasks").mockResolvedValue(undefined);
  vi.spyOn(planner, "loadReminders").mockResolvedValue(undefined);
}

describe("PlanView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("offers the complete range flow and preserves the mixed timeline", async () => {
    const { pinia, planner } = createPlanContext();
    const calendar = vi
      .spyOn(planner, "loadCalendarEvents")
      .mockImplementation(async () => {
        planner.calendarEvents = [calendarEvent()];
      });
    const tasks = vi
      .spyOn(planner, "loadTasks")
      .mockImplementation(async () => {
        planner.tasks = [task()];
      });
    const reminders = vi
      .spyOn(planner, "loadReminders")
      .mockImplementation(async () => {
        planner.reminders = [reminder()];
      });

    const wrapper = mountPlan(pinia);
    await flushPromises();

    expect(calendar).toHaveBeenCalledWith();
    expect(tasks).toHaveBeenCalledWith({ status: "OPEN" });
    expect(reminders).toHaveBeenCalledWith({ status: "SCHEDULED" });
    expect(wrapper.text()).toContain("客户会议");
    expect(wrapper.text()).toContain("整理会议纪要");
    expect(wrapper.text()).toContain("提交日报提醒");
    expect(wrapper.text()).toContain("日程");
    expect(wrapper.text()).toContain("待办");
    expect(wrapper.text()).toContain("提醒");
    expect(wrapper.findAll(".plan-date-rail button")).toHaveLength(7);
    expect(wrapper.findAll(".range-chips button")).toHaveLength(5);
    expect(
      wrapper.find('.range-chips button[aria-pressed="true"]').text(),
    ).toBe("今天");
    expect(
      wrapper.find('.segmented-control button[aria-pressed="true"]').text(),
    ).toBe("日");
    expect(
      wrapper.find(".page-header-actions .primary-button").text(),
    ).toContain("快速新增");

    await wrapper
      .find('.range-chips button[aria-pressed="false"]')
      .trigger("click");
    expect(
      wrapper.find('.range-chips button[aria-pressed="true"]').text(),
    ).not.toBe("今天");
    await wrapper
      .find('.segmented-control button[aria-pressed="false"]')
      .trigger("click");
    expect(
      wrapper.find('.segmented-control button[aria-pressed="true"]').text(),
    ).not.toBe("日");
  });

  it("renders loading, initial failure, retry, and partial-source states separately", async () => {
    const context = createPlanContext();
    let resolveCalendar: (() => void) | undefined;
    let resolveTasks: (() => void) | undefined;
    let resolveReminders: (() => void) | undefined;
    vi.spyOn(context.planner, "loadCalendarEvents").mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCalendar = resolve;
      }),
    );
    vi.spyOn(context.planner, "loadTasks").mockReturnValue(
      new Promise<void>((resolve) => {
        resolveTasks = resolve;
      }),
    );
    vi.spyOn(context.planner, "loadReminders").mockReturnValue(
      new Promise<void>((resolve) => {
        resolveReminders = resolve;
      }),
    );

    const loadingWrapper = mountPlan(context.pinia);
    await loadingWrapper.vm.$nextTick();
    expect(loadingWrapper.find('[aria-busy="true"]').exists()).toBe(true);
    expect(loadingWrapper.find('[role="status"]').text()).toContain(
      "正在整理计划",
    );
    expect(
      loadingWrapper.find(".page-header-actions .primary-button").exists(),
    ).toBe(true);

    resolveCalendar?.();
    resolveTasks?.();
    resolveReminders?.();
    await flushPromises();
    expect(loadingWrapper.find(".empty-state").exists()).toBe(true);

    const failedContext = createPlanContext();
    const failedCalendar = vi
      .spyOn(failedContext.planner, "loadCalendarEvents")
      .mockRejectedValue(new Error("calendar failed"));
    const failedTasks = vi
      .spyOn(failedContext.planner, "loadTasks")
      .mockRejectedValue(new Error("tasks failed"));
    const failedReminders = vi
      .spyOn(failedContext.planner, "loadReminders")
      .mockRejectedValue(new Error("reminders failed"));
    const failedWrapper = mountPlan(failedContext.pinia);
    await flushPromises();
    expect(failedWrapper.find('[role="alert"]').text()).toContain(
      "暂时无法加载计划",
    );
    expect(failedWrapper.find(".plan-desktop-grid").exists()).toBe(false);
    await failedWrapper.find('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(failedCalendar).toHaveBeenCalledTimes(2);
    expect(failedTasks).toHaveBeenCalledTimes(2);
    expect(failedReminders).toHaveBeenCalledTimes(2);

    const partialContext = createPlanContext();
    partialContext.planner.calendarEvents = [
      calendarEvent({ id: "stale-event", title: "旧缓存日程" }),
    ];
    vi.spyOn(partialContext.planner, "loadCalendarEvents").mockRejectedValue(
      new Error("calendar failed"),
    );
    vi.spyOn(partialContext.planner, "loadTasks").mockImplementation(
      async () => {
        partialContext.planner.tasks = [task({ title: "仍可用的待办" })];
      },
    );
    vi.spyOn(partialContext.planner, "loadReminders").mockResolvedValue(
      undefined,
    );
    const partialWrapper = mountPlan(partialContext.pinia);
    await flushPromises();
    expect(partialWrapper.text()).toContain("仍可用的待办");
    expect(partialWrapper.text()).not.toContain("旧缓存日程");
    expect(partialWrapper.find(".plan-load-warning").exists()).toBe(true);
    expect(partialWrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("shows overdue tasks in the overdue range without duplicating the overdue panel", async () => {
    const { pinia, planner } = createPlanContext();
    resolveAllLoads(planner);
    planner.tasks = [
      task({
        dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        id: "overdue-task",
        overdue: true,
        title: "补交材料",
      }),
    ];
    const wrapper = mountPlan(pinia);
    await flushPromises();

    expect(wrapper.find(".overdue-panel").exists()).toBe(true);
    await wrapper
      .find('.range-chips button[aria-pressed="false"]:last-child')
      .trigger("click");
    expect(wrapper.text()).toContain("补交材料");
    expect(wrapper.find(".plan-timeline").exists()).toBe(true);
    expect(wrapper.find(".overdue-panel").exists()).toBe(false);
    expect(wrapper.text()).toContain("待办");
    expect(wrapper.text()).toContain("已逾期");
  });

  it("keeps action failures separate from the initial load state", async () => {
    const { pinia, planner } = createPlanContext();
    vi.spyOn(planner, "loadCalendarEvents").mockResolvedValue(undefined);
    vi.spyOn(planner, "loadTasks").mockImplementation(async () => {
      planner.tasks = [task()];
    });
    vi.spyOn(planner, "loadReminders").mockResolvedValue(undefined);
    vi.spyOn(planner, "completeTask").mockImplementation(async () => {
      planner.errorMessage = "server-only failure detail";
      throw new Error("failed");
    });

    const wrapper = mountPlan(pinia);
    await flushPromises();
    await wrapper.find(".plan-item-actions button").trigger("click");
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain("暂时无法完成待办");
    expect(wrapper.find('[role="alert"]').text()).not.toContain(
      "server-only failure detail",
    );
    expect(wrapper.find(".plan-desktop-grid").exists()).toBe(true);
  });
});
