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
  type CalendarEventSummary,
  type ReminderSummary,
  type TaskSummary,
} from "../api/client";
import * as AppConfirm from "../composables/useAppConfirm";
import CalendarView from "./CalendarView.vue";
import RemindersView from "./RemindersView.vue";
import TasksView from "./TasksView.vue";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";

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

function makeRouter(
  component: NonNullable<RouteRecordRaw["component"]>,
): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component }],
  });
}

async function mountList(
  path: string,
  component: NonNullable<RouteRecordRaw["component"]>,
  setup: (planner: ReturnType<typeof usePlannerStore>) => void,
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.$patch({ accessToken: "token" });
  const planner = usePlannerStore();
  setup(planner);
  const router = makeRouter(component);
  await router.push(path);
  await router.isReady();
  const wrapper = mount(RouterHost, {
    global: { plugins: [pinia, router] },
  });
  await flushPromises();
  return { planner, router, wrapper };
}

function deleteButton(wrapper: ReturnType<typeof mount>) {
  const button = wrapper
    .findAll("button")
    .find((candidate) => candidate.text() === "删除");
  if (!button) {
    throw new Error("delete button not found");
  }
  return button;
}

describe("planner list delete confirmation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("confirms before deleting a task from the task list", async () => {
    const { planner, wrapper } = await mountList(
      "/tasks",
      TasksView,
      (store) => {
        store.tasks = [task()];
        vi.spyOn(store, "loadTasks").mockResolvedValue(undefined);
      },
    );
    const remove = vi.spyOn(planner, "deleteTask");
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValueOnce(false);

    await deleteButton(wrapper).trigger("click");
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "确定删除待办“整理发票”吗？删除后仍可在“显示已删除”中恢复。",
      }),
    );
    expect(remove).not.toHaveBeenCalled();

    confirm.mockResolvedValueOnce(true);
    remove.mockResolvedValue(task({ deletedAt: "2026-08-29T01:00:00.000Z" }));
    await deleteButton(wrapper).trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("task-1");
  });

  it("confirms before deleting a calendar event from the calendar list", async () => {
    const { planner, wrapper } = await mountList(
      "/calendar?date=2026-08-30",
      CalendarView,
      (store) => {
        store.calendarEvents = [calendarEvent()];
        vi.spyOn(store, "loadCalendarEvents").mockResolvedValue(undefined);
      },
    );
    const remove = vi.spyOn(planner, "deleteCalendarEvent");
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValueOnce(false);

    await deleteButton(wrapper).trigger("click");
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "确定删除日程“产品评审”吗？删除后仍可在“显示已删除”中恢复。",
      }),
    );
    expect(remove).not.toHaveBeenCalled();

    confirm.mockResolvedValueOnce(true);
    remove.mockResolvedValue(
      calendarEvent({ deletedAt: "2026-08-29T01:00:00.000Z" }),
    );
    await deleteButton(wrapper).trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("event-1");
  });

  it("confirms before deleting a reminder from the reminder list", async () => {
    const { planner, wrapper } = await mountList(
      "/reminders",
      RemindersView,
      (store) => {
        store.reminders = [reminder()];
        vi.spyOn(store, "loadReminders").mockResolvedValue(undefined);
      },
    );
    const remove = vi.spyOn(planner, "deleteReminder");
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValueOnce(false);

    await deleteButton(wrapper).trigger("click");
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "确定删除提醒“提交报销”吗？删除后仍可在“显示已删除”中恢复。",
      }),
    );
    expect(remove).not.toHaveBeenCalled();

    confirm.mockResolvedValueOnce(true);
    remove.mockResolvedValue(
      reminder({ deletedAt: "2026-08-29T01:00:00.000Z" }),
    );
    await deleteButton(wrapper).trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("reminder-1");
  });
});
