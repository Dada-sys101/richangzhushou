// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import {
  createMemoryHistory,
  createRouter,
  type Router,
  type RouteRecordRaw,
} from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  api,
  type CalendarEventSummary,
  type ReminderSummary,
  type TaskSummary,
} from "../api/client";
import * as AppConfirm from "../composables/useAppConfirm";
import DateField from "../components/DateField.vue";
import DateTimeField from "../components/DateTimeField.vue";
import FormActions from "../components/FormActions.vue";
import { usePlannerStore } from "../stores/planner";
import PlannerDetailView from "./PlannerDetailView.vue";

const Placeholder = { template: "<div />" };
const RouterHost = { template: "<RouterView />" };

function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    cancelledAt: null,
    completedAt: null,
    createdAt: "2026-08-29T00:00:00.000Z",
    deletedAt: null,
    dueAt: "2026-08-30T02:00:00.000Z",
    id: "task-1",
    overdue: false,
    priority: "MEDIUM",
    status: "OPEN",
    title: "整理发票",
    updatedAt: "2026-08-29T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function calendarEvent(
  overrides: Partial<CalendarEventSummary> = {},
): CalendarEventSummary {
  return {
    allDay: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    deletedAt: null,
    endsAt: "2026-08-30T03:00:00.000Z",
    id: "event-1",
    startsAt: "2026-08-30T02:00:00.000Z",
    status: "SCHEDULED",
    title: "产品评审",
    updatedAt: "2026-08-29T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function reminder(overrides: Partial<ReminderSummary> = {}): ReminderSummary {
  return {
    attemptCount: 0,
    createdAt: "2026-08-29T00:00:00.000Z",
    deletedAt: null,
    failureReason: null,
    id: "reminder-1",
    note: "",
    recurrence: null,
    scheduleType: "ONCE",
    scheduledAt: "2026-08-30T02:00:00.000Z",
    sentAt: null,
    status: "SCHEDULED",
    suppressedAt: null,
    targetId: null,
    targetType: "STANDALONE",
    title: "提交报销",
    updatedAt: "2026-08-29T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function makeRouter(): Router {
  const parent = { path: "/plan", title: "计划" };
  const routes: RouteRecordRaw[] = [
    {
      path: "/plan",
      component: Placeholder,
      meta: { page: { title: "计划" } },
    },
    {
      path: "/tasks",
      component: Placeholder,
      meta: { page: { title: "待办" } },
    },
    {
      path: "/calendar",
      component: Placeholder,
      meta: { page: { title: "日程" } },
    },
    {
      path: "/reminders",
      component: Placeholder,
      meta: { page: { title: "提醒" } },
    },
    {
      path: "/missing-planner-detail/:id?",
      component: PlannerDetailView,
      meta: { page: { title: "详情", parent }, plannerEntity: "task" },
    },
    {
      path: "/tasks/:id",
      component: PlannerDetailView,
      meta: { page: { title: "待办详情", parent }, plannerEntity: "task" },
    },
    {
      path: "/calendar/:id",
      component: PlannerDetailView,
      meta: {
        page: { title: "日程详情", parent },
        plannerEntity: "calendar-event",
      },
    },
    {
      path: "/reminders/:id",
      component: PlannerDetailView,
      meta: { page: { title: "提醒详情", parent }, plannerEntity: "reminder" },
    },
  ];
  return createRouter({ history: createMemoryHistory(), routes });
}

async function mountDetail(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = makeRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(RouterHost, {
    global: { plugins: [pinia, router] },
  });
  await flushPromises();
  return { planner: usePlannerStore(), router, wrapper };
}

function findButton(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper
    .findAll("button")
    .find((candidate) => candidate.text() === label);
  if (!button) {
    throw new Error(`button not found: ${label}`);
  }
  return button;
}

function findLabel(wrapper: ReturnType<typeof mount>, label: string) {
  const field = wrapper
    .findAll("label")
    .find((candidate) => candidate.text().includes(label));
  if (!field) {
    throw new Error(`label not found: ${label}`);
  }
  return field;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("PlannerDetailView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the list-specific return label and edits a task", async () => {
    const initial = task();
    const updated = task({ title: "整理已归档发票", version: 2 });
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const { planner, router, wrapper } = await mountDetail(
      "/tasks/task-1?returnTo=%2Ftasks",
    );
    const update = vi.spyOn(planner, "updateTask").mockResolvedValue(updated);

    expect(wrapper.find(".page-header-back").text()).toContain("返回待办");
    await findButton(wrapper, "编辑").trigger("click");
    await wrapper.find("input[required]").setValue("整理已归档发票");
    await wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();

    expect(update).toHaveBeenCalledWith("task-1", {
      dueAt: "2026-08-30T02:00:00.000Z",
      priority: "MEDIUM",
      title: "整理已归档发票",
      version: 1,
    });
    expect(wrapper.text()).toContain("整理已归档发票");
    expect(wrapper.find(".planner-detail-form").exists()).toBe(false);

    await wrapper.find(".page-header-back").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/tasks");
  });

  it("executes task completion, deletion and restore against the current object", async () => {
    const initial = task();
    const completed = task({
      completedAt: "2026-08-29T01:00:00.000Z",
      status: "COMPLETED",
      version: 2,
    });
    const deleted = task({
      deletedAt: "2026-08-29T01:02:03.000Z",
      updatedAt: "2026-08-29T01:02:03.000Z",
      version: 3,
    });
    const restored = task({ version: 4 });
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const { planner, wrapper } = await mountDetail("/tasks/task-1");
    planner.tasks = [initial];
    const complete = vi
      .spyOn(planner, "completeTask")
      .mockResolvedValue({ task: completed });
    const remove = vi.spyOn(planner, "deleteTask").mockResolvedValue(deleted);
    const restore = vi
      .spyOn(planner, "restoreTask")
      .mockResolvedValue(restored);

    await findButton(wrapper, "完成").trigger("click");
    await flushPromises();
    expect(complete).toHaveBeenCalledWith("task-1");
    expect(wrapper.text()).toContain("已完成");

    await findButton(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("task-1");
    expect(wrapper.text()).toContain("已删除，可恢复");
    expect(planner.tasks[0]).toEqual(deleted);

    await findButton(wrapper, "恢复").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledWith("task-1");
    expect(wrapper.text()).not.toContain("已删除，可恢复");
  });

  it("requires delete confirmation and uses the server tombstone in the shared store", async () => {
    const initial = task();
    const deleted = task({
      deletedAt: "2026-08-29T04:05:06.000Z",
      updatedAt: "2026-08-29T04:05:06.000Z",
      version: 8,
    });
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const { planner, wrapper } = await mountDetail("/tasks/task-1");
    planner.tasks = [initial];
    const remove = vi.spyOn(planner, "deleteTask").mockResolvedValue(deleted);
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValueOnce(false);

    await findButton(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "确定删除待办“整理发票”吗？删除后仍可恢复。",
      }),
    );
    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("已删除，可恢复");

    confirm.mockResolvedValueOnce(true);
    await findButton(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("task-1");
    expect(planner.tasks[0]).toEqual(deleted);
    expect(wrapper.text()).toContain("已删除，可恢复");
  });

  it("cancels a task against the current object", async () => {
    const initial = task();
    const cancelled = task({ status: "CANCELLED", version: 2 });
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const { planner, wrapper } = await mountDetail("/tasks/task-1");
    const cancel = vi.spyOn(planner, "updateTask").mockResolvedValue(cancelled);

    await findButton(wrapper, "取消待办").trigger("click");
    await flushPromises();

    expect(cancel).toHaveBeenCalledWith("task-1", {
      status: "CANCELLED",
      version: 1,
    });
    expect(wrapper.text()).toContain("已取消");
  });

  it("supports calendar cancellation and reminder rescheduling", async () => {
    const event = calendarEvent();
    const cancelledEvent = calendarEvent({ status: "CANCELLED", version: 2 });
    vi.spyOn(api, "getCalendarEvent").mockResolvedValue(event);
    const calendar = await mountDetail(
      "/calendar/event-1?returnTo=%2Fcalendar",
    );
    const cancelEvent = vi
      .spyOn(calendar.planner, "updateCalendarEvent")
      .mockResolvedValue({ calendarEvent: cancelledEvent });
    expect(calendar.wrapper.find(".page-header-back").text()).toContain(
      "返回日程",
    );
    await findButton(calendar.wrapper, "取消日程").trigger("click");
    await flushPromises();
    expect(cancelEvent).toHaveBeenCalledWith("event-1", {
      status: "CANCELLED",
      version: 1,
    });

    vi.restoreAllMocks();
    const scheduled = reminder();
    const cancelled = reminder({ status: "CANCELLED", version: 2 });
    vi.spyOn(api, "getReminder").mockResolvedValue(cancelled);
    const reminderContext = await mountDetail(
      "/reminders/reminder-1?returnTo=%2Freminders",
    );
    const reschedule = vi
      .spyOn(reminderContext.planner, "updateReminder")
      .mockResolvedValue(scheduled);
    expect(reminderContext.wrapper.find(".page-header-back").text()).toContain(
      "返回提醒",
    );
    await findButton(reminderContext.wrapper, "重新安排").trigger("click");
    await flushPromises();
    expect(reschedule).toHaveBeenCalledWith("reminder-1", {
      status: "SCHEDULED",
      version: 2,
    });
  });

  it("edits, deletes and restores a calendar event with server data", async () => {
    const initial = calendarEvent();
    const updated = calendarEvent({ title: "更新后的评审", version: 2 });
    const deleted = calendarEvent({
      deletedAt: "2026-08-29T05:06:07.000Z",
      updatedAt: "2026-08-29T05:06:07.000Z",
      version: 3,
    });
    const restored = calendarEvent({ version: 4 });
    vi.spyOn(api, "getCalendarEvent").mockResolvedValue(initial);
    const { planner, wrapper } = await mountDetail("/calendar/event-1");
    planner.calendarEvents = [initial];
    const update = vi
      .spyOn(planner, "updateCalendarEvent")
      .mockResolvedValue({ calendarEvent: updated });
    const remove = vi
      .spyOn(planner, "deleteCalendarEvent")
      .mockResolvedValue(deleted);
    const restore = vi
      .spyOn(planner, "restoreCalendarEvent")
      .mockResolvedValue(restored);

    await findButton(wrapper, "编辑").trigger("click");
    await wrapper.find("input[required]").setValue("更新后的评审");
    await wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();
    expect(update).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ title: "更新后的评审", version: 1 }),
    );
    expect(planner.calendarEvents[0]).toEqual(updated);

    await findButton(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("event-1");
    expect(planner.calendarEvents[0]).toEqual(deleted);
    expect(wrapper.text()).toContain("已删除，可恢复");

    await findButton(wrapper, "恢复").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledWith("event-1");
    expect(planner.calendarEvents[0]).toEqual(restored);
    expect(wrapper.text()).not.toContain("已删除，可恢复");
  });

  it("retries a failed calendar edit and updates the shared store", async () => {
    const initial = calendarEvent();
    const updated = calendarEvent({ title: "重试后的日程", version: 2 });
    vi.spyOn(api, "getCalendarEvent").mockResolvedValue(initial);
    const { planner, wrapper } = await mountDetail("/calendar/event-1");
    planner.calendarEvents = [initial];
    const update = vi
      .spyOn(planner, "updateCalendarEvent")
      .mockRejectedValueOnce(new Error("日程保存失败"))
      .mockResolvedValue({ calendarEvent: updated });

    await findButton(wrapper, "编辑").trigger("click");
    await wrapper.find("input[required]").setValue("重试后的日程");
    await wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("操作失败，请稍后重试");
    expect(wrapper.text()).toContain("重试");

    await findButton(wrapper, "重试").trigger("click");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(2);
    expect(planner.calendarEvents[0]).toEqual(updated);
    expect(wrapper.text()).toContain("重试后的日程");
  });

  it("edits, deletes and restores a reminder with server data", async () => {
    const initial = reminder();
    const updated = reminder({ title: "更新后的提醒", version: 2 });
    const deleted = reminder({
      deletedAt: "2026-08-29T06:07:08.000Z",
      updatedAt: "2026-08-29T06:07:08.000Z",
      version: 3,
    });
    const restored = reminder({ version: 4 });
    vi.spyOn(api, "getReminder").mockResolvedValue(initial);
    const { planner, wrapper } = await mountDetail("/reminders/reminder-1");
    planner.reminders = [initial];
    const update = vi
      .spyOn(planner, "updateReminder")
      .mockResolvedValue(updated);
    const remove = vi
      .spyOn(planner, "deleteReminder")
      .mockResolvedValue(deleted);
    const restore = vi
      .spyOn(planner, "restoreReminder")
      .mockResolvedValue(restored);

    await findButton(wrapper, "编辑").trigger("click");
    await wrapper.find("input[required]").setValue("更新后的提醒");
    await wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();
    expect(update).toHaveBeenCalledWith(
      "reminder-1",
      expect.objectContaining({ title: "更新后的提醒", version: 1 }),
    );
    expect(planner.reminders[0]).toEqual(updated);

    await findButton(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("reminder-1");
    expect(planner.reminders[0]).toEqual(deleted);
    expect(wrapper.text()).toContain("已删除，可恢复");

    await findButton(wrapper, "恢复").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledWith("reminder-1");
    expect(planner.reminders[0]).toEqual(restored);
    expect(wrapper.text()).not.toContain("已删除，可恢复");
  });

  it("retries a failed reminder edit and updates the shared store", async () => {
    const initial = reminder();
    const updated = reminder({ title: "重试后的提醒", version: 2 });
    vi.spyOn(api, "getReminder").mockResolvedValue(initial);
    const { planner, wrapper } = await mountDetail("/reminders/reminder-1");
    planner.reminders = [initial];
    const update = vi
      .spyOn(planner, "updateReminder")
      .mockRejectedValueOnce(new Error("提醒保存失败"))
      .mockResolvedValue(updated);

    await findButton(wrapper, "编辑").trigger("click");
    await wrapper.find("input[required]").setValue("重试后的提醒");
    await wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("操作失败，请稍后重试");
    expect(wrapper.text()).toContain("重试");

    await findButton(wrapper, "重试").trigger("click");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(2);
    expect(planner.reminders[0]).toEqual(updated);
    expect(wrapper.text()).toContain("重试后的提醒");
  });

  it("does not prompt when edit fields are unchanged, but blocks a dirty return", async () => {
    const initial = task();
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const first = await mountDetail("/tasks/task-1");
    await findButton(first.wrapper, "编辑").trigger("click");
    const confirm = vi.mocked(AppConfirm.requestAppConfirm);
    await first.router.push("/plan");
    expect(confirm).not.toHaveBeenCalled();
    expect(first.router.currentRoute.value.fullPath).toBe("/plan");

    vi.restoreAllMocks();
    vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(false);
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const second = await mountDetail("/tasks/task-1");
    await findButton(second.wrapper, "编辑").trigger("click");
    await second.wrapper.find("input[required]").setValue("已修改");
    await second.router.push("/plan");
    expect(AppConfirm.requestAppConfirm).toHaveBeenCalledOnce();
    expect(second.router.currentRoute.value.fullPath).toBe("/tasks/task-1");
    vi.mocked(AppConfirm.requestAppConfirm).mockResolvedValueOnce(true);
    await second.router.push("/plan");
    expect(second.router.currentRoute.value.fullPath).toBe("/plan");
  });

  it("shows a retry entry for a failed detail load", async () => {
    const getTask = vi
      .spyOn(api, "getTask")
      .mockRejectedValueOnce(new Error("暂时无法加载"))
      .mockResolvedValue(task());
    const { wrapper } = await mountDetail("/tasks/task-1");
    expect(wrapper.text()).toContain("暂时无法加载");
    expect(wrapper.text()).toContain("重新加载");
    await findButton(wrapper, "重新加载").trigger("click");
    await flushPromises();
    expect(getTask).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("整理发票");
  });

  it("shows a retry entry for a failed mutation and retries it", async () => {
    const initial = task();
    const updated = task({ title: "已重试保存", version: 2 });
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const { planner, wrapper } = await mountDetail("/tasks/task-1");
    const update = vi
      .spyOn(planner, "updateTask")
      .mockRejectedValueOnce(new Error("保存失败"))
      .mockResolvedValue(updated);

    await findButton(wrapper, "编辑").trigger("click");
    await wrapper.find("input[required]").setValue("已重试保存");
    await wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("操作失败，请稍后重试");
    expect(wrapper.text()).toContain("重试");

    await findButton(wrapper, "重试").trigger("click");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("已重试保存");
  });

  it("uses shared loading and error states without sending a request for a missing id", async () => {
    const getTask = vi.spyOn(api, "getTask");
    const context = await mountDetail("/missing-planner-detail");

    expect(getTask).not.toHaveBeenCalled();
    expect(context.wrapper.findComponent({ name: "ErrorState" }).exists()).toBe(
      true,
    );
    expect(context.wrapper.text()).toContain("缺少记录标识");
    expect(context.wrapper.text()).not.toContain("HIGH");
  });

  it("renders LoadingState while the current detail request is pending", async () => {
    const request = deferred<TaskSummary>();
    vi.spyOn(api, "getTask").mockReturnValue(request.promise);
    const context = await mountDetail("/tasks/task-1");

    expect(
      context.wrapper.findComponent({ name: "LoadingState" }).exists(),
    ).toBe(true);
    expect(context.wrapper.find(".planner-detail-card").exists()).toBe(false);

    request.resolve(task());
    await flushPromises();
    expect(context.wrapper.text()).toContain("整理发票");
  });

  it.each([
    [404, "记录不存在", "找不到这条记录"],
    [503, "详情暂时无法加载", "详情暂时无法加载"],
  ])(
    "uses a safe ErrorState message for API status %s",
    async (status, title, description) => {
      const getTask = vi
        .spyOn(api, "getTask")
        .mockRejectedValueOnce(
          new ApiClientError(status, "SERVER_DETAIL", "internal secret"),
        )
        .mockResolvedValue(task());
      const context = await mountDetail("/tasks/task-1");

      expect(context.wrapper.text()).toContain(title);
      expect(context.wrapper.text()).toContain(description);
      expect(context.wrapper.text()).not.toContain("internal secret");
      await findButton(context.wrapper, "重新加载").trigger("click");
      await flushPromises();
      expect(getTask).toHaveBeenCalledTimes(2);
      expect(context.wrapper.text()).toContain("整理发票");
    },
  );

  it("rejects invalid detail data instead of rendering a partial card", async () => {
    vi.spyOn(api, "getTask").mockResolvedValue({
      id: "task-1",
      title: "只有标题",
    } as TaskSummary);
    const context = await mountDetail("/tasks/task-1");

    expect(context.wrapper.text()).toContain("详情数据无效");
    expect(context.wrapper.find(".planner-detail-card").exists()).toBe(false);
  });

  it("does not let an older id request overwrite the current detail", async () => {
    const first = deferred<TaskSummary>();
    const getTask = vi
      .spyOn(api, "getTask")
      .mockImplementation((requestedId) =>
        requestedId === "task-1"
          ? first.promise
          : Promise.resolve(task({ id: requestedId, title: "第二条待办" })),
      );
    const context = await mountDetail("/tasks/task-1");

    await context.router.push("/tasks/task-2");
    await flushPromises();
    expect(context.wrapper.text()).toContain("第二条待办");

    first.resolve(task({ title: "过期的第一条待办" }));
    await flushPromises();
    expect(context.wrapper.text()).toContain("第二条待办");
    expect(context.wrapper.text()).not.toContain("过期的第一条待办");
    expect(getTask).toHaveBeenCalledWith("task-1");
    expect(getTask).toHaveBeenCalledWith("task-2");
  });

  it("reloads the correct entity when the route entity changes", async () => {
    const taskRequest = deferred<TaskSummary>();
    vi.spyOn(api, "getTask").mockReturnValue(taskRequest.promise);
    vi.spyOn(api, "getCalendarEvent").mockResolvedValue(
      calendarEvent({ title: "切换后的日程" }),
    );
    const context = await mountDetail("/tasks/task-1");

    await context.router.push("/calendar/event-1");
    await flushPromises();
    expect(context.wrapper.text()).toContain("切换后的日程");
    taskRequest.resolve(task({ title: "过期的待办" }));
    await flushPromises();
    expect(context.wrapper.text()).not.toContain("过期的待办");
  });

  it("shows translated task details, no due date, and overdue state", async () => {
    vi.spyOn(api, "getTask").mockResolvedValue(
      task({ dueAt: null, overdue: true, priority: "HIGH" }),
    );
    const context = await mountDetail("/tasks/task-1");

    expect(context.wrapper.text()).toContain("高");
    expect(context.wrapper.text()).toContain("未设置截止时间");
    expect(context.wrapper.text()).toContain("已逾期");
    expect(context.wrapper.text()).not.toContain("HIGH");
  });

  it("shows an all-day calendar date and translated cancelled status", async () => {
    vi.spyOn(api, "getCalendarEvent").mockResolvedValue(
      calendarEvent({
        allDay: true,
        endsAt: "2026-08-31T16:00:00.000Z",
        startsAt: "2026-08-30T16:00:00.000Z",
        status: "CANCELLED",
      }),
    );
    const context = await mountDetail("/calendar/event-1");

    expect(context.wrapper.text()).toContain("全天 · 2026-08-31");
    expect(context.wrapper.text()).toContain("已取消");
    expect(context.wrapper.text()).not.toContain("CANCELLED");
  });

  it("shows reminder recurrence, attempts, failure reason, and translated status", async () => {
    vi.spyOn(api, "getReminder").mockResolvedValue(
      reminder({
        attemptCount: 3,
        failureReason: "通知服务暂时不可用",
        recurrence: { interval: 2, weekdays: [1, 3] },
        scheduleType: "WEEKLY",
        status: "FAILED",
      }),
    );
    const context = await mountDetail("/reminders/reminder-1");

    expect(context.wrapper.text()).toContain("每 2 周（周一、周三）");
    expect(context.wrapper.text()).toContain("3 次");
    expect(context.wrapper.text()).toContain("通知服务暂时不可用");
    expect(context.wrapper.text()).toContain("发送失败");
    expect(context.wrapper.text()).not.toContain("WEEKLY");
  });

  it("keeps return navigation safe when returnTo is external", async () => {
    vi.spyOn(api, "getTask").mockResolvedValue(task());
    const context = await mountDetail(
      "/tasks/task-1?returnTo=https%3A%2F%2Fevil.example%2Faccount",
    );

    expect(context.wrapper.find(".page-header-back").text()).toContain(
      "返回计划",
    );
    await context.wrapper.find(".page-header-back").trigger("click");
    await flushPromises();
    expect(context.router.currentRoute.value.fullPath).toBe("/plan");
  });

  it("prevents duplicate task completion while the action is pending", async () => {
    const initial = task();
    const completed = task({ status: "COMPLETED", version: 2 });
    const completion = deferred<{ task: TaskSummary }>();
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const context = await mountDetail("/tasks/task-1");
    const complete = vi
      .spyOn(context.planner, "completeTask")
      .mockReturnValue(completion.promise);
    const button = findButton(context.wrapper, "完成");

    await button.trigger("click");
    await button.trigger("click");
    expect(complete).toHaveBeenCalledTimes(1);
    expect(button.attributes("disabled")).toBeDefined();

    completion.resolve({ task: completed });
    await flushPromises();
    expect(context.wrapper.text()).toContain("已完成");
  });

  it("cancels edit without changing the displayed entity", async () => {
    const initial = calendarEvent();
    vi.spyOn(api, "getCalendarEvent").mockResolvedValue(initial);
    const context = await mountDetail("/calendar/event-1");

    await findButton(context.wrapper, "编辑").trigger("click");
    await context.wrapper.find("input[required]").setValue("未保存的标题");
    await findButton(context.wrapper, "取消编辑").trigger("click");

    expect(context.wrapper.find(".planner-detail-form").exists()).toBe(false);
    expect(context.wrapper.text()).toContain("产品评审");
    expect(context.wrapper.text()).not.toContain("未保存的标题");
  });

  it.each([
    ["task", "/tasks/task-1", "getTask", task()],
    [
      "calendar-event",
      "/calendar/event-1",
      "getCalendarEvent",
      calendarEvent(),
    ],
    ["reminder", "/reminders/reminder-1", "getReminder", reminder()],
  ] as const)(
    "uses the shared editor skeleton and focuses the title for %s",
    async (_entity, path, getter, detail) => {
      vi.spyOn(api, getter).mockResolvedValue(detail as never);
      const context = await mountDetail(path);
      const focus = vi.spyOn(HTMLInputElement.prototype, "focus");

      await findButton(context.wrapper, "编辑").trigger("click");
      await flushPromises();

      const form = context.wrapper.find("#planner-detail-edit-form");
      const title = form.find<HTMLInputElement>("input[required]");
      expect(form.exists()).toBe(true);
      expect(title.exists()).toBe(true);
      expect(context.wrapper.findAll("fieldset")).toHaveLength(2);
      expect(context.wrapper.findComponent(FormActions).exists()).toBe(true);
      expect(
        context.wrapper
          .find('.planner-detail-actions[aria-label="事项操作"]')
          .exists(),
      ).toBe(false);
      expect(focus).toHaveBeenCalled();
      expect(findButton(context.wrapper, "保存").attributes("form")).toBe(
        "planner-detail-edit-form",
      );
    },
  );

  it("does not offer editing for a deleted entity", async () => {
    vi.spyOn(api, "getTask").mockResolvedValue(
      task({ deletedAt: "2026-08-30T03:00:00.000Z" }),
    );
    const context = await mountDetail("/tasks/task-1");

    expect(
      context.wrapper
        .findAll("button")
        .some((button) => button.text() === "编辑"),
    ).toBe(false);
    expect(context.wrapper.text()).toContain("已删除，可恢复");
  });

  it("submits task priority and a null due date with the current version", async () => {
    const initial = task({ dueAt: null, priority: "LOW", version: 7 });
    const updated = task({ dueAt: null, priority: "HIGH", version: 8 });
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const context = await mountDetail("/tasks/task-1");
    const update = vi
      .spyOn(context.planner, "updateTask")
      .mockResolvedValue(updated);

    await findButton(context.wrapper, "编辑").trigger("click");
    await findLabel(context.wrapper, "优先级").find("select").setValue("HIGH");
    await context.wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();

    expect(update).toHaveBeenCalledWith("task-1", {
      dueAt: null,
      priority: "HIGH",
      title: "整理发票",
      version: 7,
    });
  });

  it("prevents duplicate saves while preserving the submitted task values", async () => {
    const save = deferred<TaskSummary>();
    vi.spyOn(api, "getTask").mockResolvedValue(task());
    const context = await mountDetail("/tasks/task-1");
    const update = vi
      .spyOn(context.planner, "updateTask")
      .mockReturnValue(save.promise);

    await findButton(context.wrapper, "编辑").trigger("click");
    await findLabel(context.wrapper, "标题")
      .find("input")
      .setValue("保存中的待办");
    const form = context.wrapper.find(".planner-detail-form");
    await form.trigger("submit");
    await form.trigger("submit");

    expect(update).toHaveBeenCalledTimes(1);
    expect(findButton(context.wrapper, "保存中…").attributes("disabled")).toBe(
      "",
    );
    expect(findLabel(context.wrapper, "标题").find("input").element.value).toBe(
      "保存中的待办",
    );

    save.resolve(task({ title: "保存中的待办", version: 2 }));
    await flushPromises();
    expect(context.wrapper.find(".planner-detail-form").exists()).toBe(false);
  });

  it("submits an all-day calendar boundary without hidden timed values", async () => {
    const initial = calendarEvent({
      allDay: true,
      endsAt: "2026-08-31T16:00:00.000Z",
      startsAt: "2026-08-30T16:00:00.000Z",
      version: 4,
    });
    const updated = calendarEvent({ ...initial, version: 5 });
    vi.spyOn(api, "getCalendarEvent").mockResolvedValue(initial);
    const context = await mountDetail("/calendar/event-1");
    const update = vi
      .spyOn(context.planner, "updateCalendarEvent")
      .mockResolvedValue({ calendarEvent: updated });

    await findButton(context.wrapper, "编辑").trigger("click");
    const dateField = context.wrapper.findComponent(DateField);
    dateField.vm.$emit("update:modelValue", "2026-09-03");
    await flushPromises();
    await context.wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();

    expect(update).toHaveBeenCalledWith("event-1", {
      allDay: true,
      endsAt: "2026-09-03T16:00:00.000Z",
      startsAt: "2026-09-02T16:00:00.000Z",
      status: "SCHEDULED",
      title: "产品评审",
      version: 4,
    });
  });

  it("switches calendar time fields consistently and reports overlap as a status", async () => {
    const initial = calendarEvent();
    const updated = calendarEvent({ version: 2 });
    vi.spyOn(api, "getCalendarEvent").mockResolvedValue(initial);
    const context = await mountDetail("/calendar/event-1");
    vi.spyOn(context.planner, "updateCalendarEvent").mockResolvedValue({
      calendarEvent: updated,
      overlapWarning: {
        code: "OVERLAP_WARNING",
        conflictingEventId: "event-2",
        message: "与产品同步会重叠",
      },
    });

    await findButton(context.wrapper, "编辑").trigger("click");
    expect(context.wrapper.findAllComponents(DateTimeField)).toHaveLength(2);
    await findLabel(context.wrapper, "全天日程")
      .find('input[type="checkbox"]')
      .setValue(true);
    expect(context.wrapper.findComponent(DateField).exists()).toBe(true);
    expect(context.wrapper.findAllComponents(DateTimeField)).toHaveLength(0);
    await findLabel(context.wrapper, "全天日程")
      .find('input[type="checkbox"]')
      .setValue(false);
    expect(context.wrapper.findAllComponents(DateTimeField)).toHaveLength(2);

    await context.wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();
    expect(context.wrapper.text()).toContain("日程已更新");
    expect(context.wrapper.text()).toContain("与产品同步会重叠");
    expect(
      context.wrapper
        .find(".planner-detail-overlap-warning")
        .attributes("role"),
    ).toBe("status");
  });

  it("submits sorted weekly recurrence and keeps its current version", async () => {
    const initial = reminder({
      recurrence: {
        interval: 2,
        until: "2026-09-05T02:00:00.000Z",
        weekdays: [5, 2],
      },
      scheduleType: "WEEKLY",
      version: 9,
    });
    const updated = reminder({ ...initial, version: 10 });
    vi.spyOn(api, "getReminder").mockResolvedValue(initial);
    const context = await mountDetail("/reminders/reminder-1");
    const update = vi
      .spyOn(context.planner, "updateReminder")
      .mockResolvedValue(updated);

    await findButton(context.wrapper, "编辑").trigger("click");
    await context.wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();

    expect(update).toHaveBeenCalledWith("reminder-1", {
      note: null,
      recurrence: {
        interval: 2,
        until: "2026-09-05T02:00:00.000Z",
        weekdays: [2, 5],
      },
      scheduleType: "WEEKLY",
      startsAt: "2026-08-30T02:00:00.000Z",
      title: "提交报销",
      version: 9,
    });
  });

  it.each([
    [
      "DAILY",
      { interval: 4, until: "2026-09-05T02:00:00.000Z" },
      { interval: 4, until: "2026-09-05T02:00:00.000Z" },
    ],
    [
      "MONTHLY",
      { dayOfMonth: 18, interval: 2 },
      { dayOfMonth: 18, interval: 2 },
    ],
  ] as const)(
    "submits only the active %s recurrence fields",
    async (scheduleType, sourceRecurrence, expectedRecurrence) => {
      const initial = reminder({
        recurrence: sourceRecurrence,
        scheduleType,
        version: 6,
      });
      vi.spyOn(api, "getReminder").mockResolvedValue(initial);
      const context = await mountDetail("/reminders/reminder-1");
      const update = vi
        .spyOn(context.planner, "updateReminder")
        .mockResolvedValue(reminder({ ...initial, version: 7 }));

      await findButton(context.wrapper, "编辑").trigger("click");
      await context.wrapper.find(".planner-detail-form").trigger("submit");
      await flushPromises();

      expect(update).toHaveBeenCalledWith(
        "reminder-1",
        expect.objectContaining({
          recurrence: expectedRecurrence,
          scheduleType,
          version: 6,
        }),
      );
    },
  );

  it("keeps conditional reminder drafts but excludes hidden rules from ONCE", async () => {
    const initial = reminder({
      recurrence: { dayOfMonth: 18, interval: 3 },
      scheduleType: "MONTHLY",
    });
    vi.spyOn(api, "getReminder").mockResolvedValue(initial);
    const context = await mountDetail("/reminders/reminder-1");
    const update = vi
      .spyOn(context.planner, "updateReminder")
      .mockResolvedValue(reminder({ version: 2 }));

    await findButton(context.wrapper, "编辑").trigger("click");
    const schedule = findLabel(context.wrapper, "重复方式").find("select");
    expect(context.wrapper.text()).toContain("每月日期");
    await schedule.setValue("DAILY");
    expect(context.wrapper.text()).not.toContain("每月日期（必填）");
    expect(
      findLabel(context.wrapper, "重复间隔").find("input").element.value,
    ).toBe("3");
    await schedule.setValue("WEEKLY");
    expect(context.wrapper.text()).toContain("每周星期");
    await schedule.setValue("MONTHLY");
    expect(
      findLabel(context.wrapper, "每月日期").find("input").element.value,
    ).toBe("18");
    await schedule.setValue("ONCE");
    expect(context.wrapper.text()).not.toContain("重复间隔（必填）");
    await context.wrapper.find(".planner-detail-form").trigger("submit");
    await flushPromises();

    expect(update).toHaveBeenCalledWith(
      "reminder-1",
      expect.objectContaining({ recurrence: null, scheduleType: "ONCE" }),
    );
  });

  it.each([
    [400, "提交内容有误，请检查表单后重试"],
    [409, "记录已被更新，请返回详情刷新后再试"],
    [503, "操作失败，请稍后重试"],
    [0, "当前离线，请恢复网络后重试"],
  ])(
    "keeps current editor values after save status %s and retries them",
    async (status, message) => {
      const initial = task();
      const updated = task({ title: `状态${status}后重试`, version: 2 });
      vi.spyOn(api, "getTask").mockResolvedValue(initial);
      const context = await mountDetail("/tasks/task-1");
      const update = vi
        .spyOn(context.planner, "updateTask")
        .mockRejectedValueOnce(
          new ApiClientError(status, "SERVER_DETAIL", "internal secret"),
        )
        .mockResolvedValue(updated);

      await findButton(context.wrapper, "编辑").trigger("click");
      await findLabel(context.wrapper, "标题")
        .find("input")
        .setValue(`状态${status}后重试`);
      await context.wrapper.find(".planner-detail-form").trigger("submit");
      await flushPromises();

      expect(context.wrapper.find(".planner-detail-form").exists()).toBe(true);
      expect(context.wrapper.text()).toContain(message);
      expect(context.wrapper.text()).not.toContain("internal secret");
      expect(
        findLabel(context.wrapper, "标题").find("input").element.value,
      ).toBe(`状态${status}后重试`);

      await findButton(context.wrapper, "重试").trigger("click");
      await flushPromises();
      expect(update).toHaveBeenLastCalledWith(
        "task-1",
        expect.objectContaining({ title: `状态${status}后重试` }),
      );
      expect(context.wrapper.text()).not.toContain(message);
      expect(context.wrapper.find(".planner-detail-form").exists()).toBe(false);
    },
  );

  it("confirms dirty cancellation, preserves rejected input, and restores focus", async () => {
    vi.spyOn(api, "getTask").mockResolvedValue(task());
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const context = await mountDetail("/tasks/task-1");

    await findButton(context.wrapper, "编辑").trigger("click");
    await findLabel(context.wrapper, "标题")
      .find("input")
      .setValue("尚未保存的待办");
    await findButton(context.wrapper, "取消编辑").trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "放弃未保存的编辑？" }),
    );
    expect(context.wrapper.find(".planner-detail-form").exists()).toBe(true);
    expect(findLabel(context.wrapper, "标题").find("input").element.value).toBe(
      "尚未保存的待办",
    );

    const focus = vi.spyOn(HTMLButtonElement.prototype, "focus");
    await findButton(context.wrapper, "取消编辑").trigger("click");
    await flushPromises();
    expect(context.wrapper.find(".planner-detail-form").exists()).toBe(false);
    expect(context.wrapper.text()).toContain("整理发票");
    expect(focus).toHaveBeenCalled();
  });

  it("leaves an unchanged editor without confirmation", async () => {
    vi.spyOn(api, "getTask").mockResolvedValue(task());
    const context = await mountDetail("/tasks/task-1");

    await findButton(context.wrapper, "编辑").trigger("click");
    await findButton(context.wrapper, "取消编辑").trigger("click");
    await flushPromises();

    expect(AppConfirm.requestAppConfirm).not.toHaveBeenCalled();
    expect(context.wrapper.find(".planner-detail-form").exists()).toBe(false);
  });

  it("guards route id updates and does not load the target until accepted", async () => {
    vi.spyOn(api, "getTask").mockImplementation((requestedId) =>
      Promise.resolve(task({ id: requestedId, title: `待办 ${requestedId}` })),
    );
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const context = await mountDetail("/tasks/task-1");

    await findButton(context.wrapper, "编辑").trigger("click");
    await findLabel(context.wrapper, "标题")
      .find("input")
      .setValue("保留当前输入");
    await context.router.push("/tasks/task-2");
    await flushPromises();
    expect(context.router.currentRoute.value.fullPath).toBe("/tasks/task-1");
    expect(findLabel(context.wrapper, "标题").find("input").element.value).toBe(
      "保留当前输入",
    );

    await context.router.push("/tasks/task-2");
    await flushPromises();
    expect(context.router.currentRoute.value.fullPath).toBe("/tasks/task-2");
    expect(context.wrapper.text()).toContain("待办 task-2");
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
