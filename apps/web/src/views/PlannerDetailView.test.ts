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
  api,
  type CalendarEventSummary,
  type ReminderSummary,
  type TaskSummary,
} from "../api/client";
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

describe("PlannerDetailView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
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
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);

    await findButton(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(
      "确定删除待办“整理发票”吗？删除后仍可恢复。",
    );
    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("已删除，可恢复");

    confirm.mockReturnValue(true);
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
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

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
    expect(wrapper.text()).toContain("日程保存失败");
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
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

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
    expect(wrapper.text()).toContain("提醒保存失败");
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
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    await first.router.push("/plan");
    expect(confirm).not.toHaveBeenCalled();
    expect(first.router.currentRoute.value.fullPath).toBe("/plan");

    vi.restoreAllMocks();
    vi.stubGlobal("confirm", confirm);
    vi.spyOn(api, "getTask").mockResolvedValue(initial);
    const second = await mountDetail("/tasks/task-1");
    await findButton(second.wrapper, "编辑").trigger("click");
    await second.wrapper.find("input[required]").setValue("已修改");
    await second.router.push("/plan");
    expect(confirm).toHaveBeenCalledOnce();
    expect(second.router.currentRoute.value.fullPath).toBe("/tasks/task-1");
    confirm.mockReturnValue(true);
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

    expect(wrapper.text()).toContain("保存失败");
    expect(wrapper.text()).toContain("重试");

    await findButton(wrapper, "重试").trigger("click");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("已重试保存");
  });
});
