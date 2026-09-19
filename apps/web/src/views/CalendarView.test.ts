// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarEventSummary } from "../api/client";
import * as AppConfirm from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import { todayInShanghai } from "../utils/time";
import CalendarView from "./CalendarView.vue";

const RouterHost = { template: "<RouterView />" };
const Placeholder = { template: "<div>其他页面</div>" };

type CalendarParams = {
  date?: string;
  includeDeleted?: boolean;
};

interface CalendarViewModel {
  allDayStart: string;
  date: string;
  editAllDayStart: string;
  editForm: {
    allDay: boolean;
    endsAt: string;
    startsAt: string;
    status: "SCHEDULED" | "CANCELLED";
    title: string;
    version: number;
  };
  editingId: string;
  form: {
    allDay: boolean;
    endsAt: string;
    startsAt: string;
    title: string;
  };
  handleDateChange: (value: string) => Promise<void>;
  includeDeleted: boolean;
  reload: () => Promise<boolean>;
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

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/calendar", component: CalendarView },
      { path: "/calendar/:id", component: Placeholder },
      { path: "/other", component: Placeholder },
    ],
  });
}

const mountedWrappers: Array<ReturnType<typeof mount>> = [];

async function mountCalendar(
  path = "/calendar?date=2026-08-30",
  options: {
    events?: CalendarEventSummary[];
    load?: (
      planner: ReturnType<typeof usePlannerStore>,
      params: CalendarParams,
    ) => Promise<void>;
  } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "access-token" });
  const planner = usePlannerStore();
  const events = options.events ?? [calendarEvent()];
  planner.calendarEvents = [...events];
  const load = vi
    .spyOn(planner, "loadCalendarEvents")
    .mockImplementation(async (params = {}) => {
      if (options.load) {
        await options.load(planner, params);
        return;
      }
      planner.calendarEvents = [...events];
    });
  const router = makeRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(RouterHost, {
    global: { plugins: [pinia, router] },
  });
  mountedWrappers.push(wrapper);
  await flushPromises();
  return { load, planner, router, wrapper };
}

function viewModel(wrapper: ReturnType<typeof mount>): CalendarViewModel {
  return wrapper.findComponent(CalendarView).vm as unknown as CalendarViewModel;
}

function button(wrapper: ReturnType<typeof mount>, label: string) {
  const candidate = wrapper
    .findAll("button")
    .find((item) => item.text().trim() === label);
  if (!candidate) {
    throw new Error(`button not found: ${label}`);
  }
  return candidate;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(true);
});

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount();
  }
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("CalendarView", () => {
  it("uses the Shanghai date by default and restores a valid date query", async () => {
    const defaultContext = await mountCalendar("/calendar");
    expect(defaultContext.load).toHaveBeenCalledWith({
      date: todayInShanghai(),
      includeDeleted: undefined,
    });

    const queryContext = await mountCalendar("/calendar?date=2026-08-30");
    expect(queryContext.load).toHaveBeenCalledWith({
      date: "2026-08-30",
      includeDeleted: undefined,
    });
    expect(viewModel(queryContext.wrapper).date).toBe("2026-08-30");
  });

  it("shows loading, all-day Shanghai date text, statuses, and long titles", async () => {
    let resolveLoad!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const longTitle = "这是一个应该在移动端换行而不是被截断的日程标题";
    const context = await mountCalendar("/calendar?date=2026-08-30", {
      events: [],
      load: async (planner) => {
        await pending;
        planner.calendarEvents = [
          calendarEvent({
            allDay: true,
            endsAt: "2026-08-30T16:00:00.000Z",
            startsAt: "2026-08-29T16:00:00.000Z",
            title: longTitle,
          }),
          calendarEvent({
            id: "cancelled-1",
            status: "CANCELLED",
            title: "已取消会议",
          }),
        ];
      },
    });

    expect(context.wrapper.text()).toContain("正在加载日程");
    resolveLoad();
    await flushPromises();
    expect(context.wrapper.text()).toContain(longTitle);
    expect(context.wrapper.text()).toContain("全天 · 2026-08-30");
    expect(context.wrapper.text()).toContain("已安排");
    expect(context.wrapper.text()).toContain("已取消");
    expect(context.wrapper.find(".empty-state").exists()).toBe(false);
  });

  it("renders an honest empty state and retries an initial load failure", async () => {
    let attempts = 0;
    const context = await mountCalendar(undefined, {
      events: [],
      load: async (planner) => {
        attempts += 1;
        if (attempts === 1) {
          planner.errorMessage = "日程服务暂时不可用";
          return;
        }
        planner.errorMessage = null;
        planner.calendarEvents = [];
      },
    });

    expect(context.wrapper.find(".empty-state").exists()).toBe(false);
    expect(context.wrapper.find('[role="alert"]').text()).toContain(
      "日程服务暂时不可用",
    );
    await context.wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(attempts).toBe(2);
    expect(context.wrapper.text()).toContain("当天没有日程");
  });

  it("keeps a cached current list visible when refreshing fails", async () => {
    let attempts = 0;
    const context = await mountCalendar(undefined, {
      load: async (planner) => {
        attempts += 1;
        if (attempts > 1) {
          planner.errorMessage = "刷新失败";
          return;
        }
        planner.calendarEvents = [calendarEvent()];
      },
    });

    await viewModel(context.wrapper).reload();
    await flushPromises();
    expect(context.wrapper.text()).toContain("刷新失败");
    expect(context.wrapper.text()).toContain("产品评审");
    expect(context.wrapper.text()).toContain("上次成功加载的日程");
    expect(context.wrapper.find(".feedback-error-state").exists()).toBe(false);
  });

  it("reloads date and deleted filters, syncs them to the route, and rejects dirty switches", async () => {
    const context = await mountCalendar();
    const vm = viewModel(context.wrapper);
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValue(false);

    vm.form.title = "尚未保存的安排";
    await context.wrapper.vm.$nextTick();
    await vm.handleDateChange("2026-09-01");
    await flushPromises();
    expect(confirm).toHaveBeenCalledOnce();
    expect(vm.date).toBe("2026-08-30");
    expect(vm.form.title).toBe("尚未保存的安排");
    expect(context.load).toHaveBeenCalledTimes(1);

    confirm.mockResolvedValue(true);
    await vm.handleDateChange("2026-09-01");
    await context.wrapper.vm.$nextTick();
    await flushPromises();
    expect(vm.date).toBe("2026-09-01");
    expect(vm.form.title).toBe("");
    expect(context.load).toHaveBeenLastCalledWith({
      date: "2026-09-01",
      includeDeleted: undefined,
    });
    expect(context.router.currentRoute.value.query.date).toBe("2026-09-01");

    await context.wrapper.get('input[aria-label="显示已删除"]').setValue(true);
    await flushPromises();
    expect(context.load).toHaveBeenLastCalledWith({
      date: "2026-09-01",
      includeDeleted: true,
    });
    expect(context.router.currentRoute.value.query.includeDeleted).toBe("true");
  });

  it("does not allow an older date response to replace the current list", async () => {
    let resolveOld!: () => void;
    let resolveNew!: () => void;
    const oldResponse = new Promise<void>((resolve) => {
      resolveOld = resolve;
    });
    const newResponse = new Promise<void>((resolve) => {
      resolveNew = resolve;
    });
    const context = await mountCalendar("/calendar?date=2026-08-30", {
      events: [],
      load: async (planner, params) => {
        if (params.date === "2026-08-30") {
          await oldResponse;
          planner.calendarEvents = [calendarEvent({ title: "旧日期日程" })];
          return;
        }
        await newResponse;
        planner.calendarEvents = [calendarEvent({ title: "新日期日程" })];
      },
    });
    const vm = viewModel(context.wrapper);

    await vm.handleDateChange("2026-09-01");
    await context.wrapper.vm.$nextTick();
    resolveNew();
    await flushPromises();
    expect(context.wrapper.text()).toContain("新日期日程");
    resolveOld();
    await flushPromises();
    expect(context.wrapper.text()).toContain("新日期日程");
    expect(context.wrapper.text()).not.toContain("旧日期日程");
  });

  it("creates all-day events with Shanghai day boundaries and shows overlap warnings", async () => {
    const context = await mountCalendar();
    const vm = viewModel(context.wrapper);
    vm.form.title = "全天评审";
    vm.form.allDay = true;
    vm.allDayStart = "2026-08-30";
    const create = vi
      .spyOn(context.planner, "createCalendarEvent")
      .mockResolvedValue({
        calendarEvent: calendarEvent({ allDay: true }),
        overlapWarning: {
          code: "OVERLAP_WARNING",
          conflictingEventId: "event-2",
          message: "与产品评审重叠",
        },
      });

    await context.wrapper.get("form.planner-create").trigger("submit");
    await flushPromises();
    expect(create).toHaveBeenCalledWith({
      allDay: true,
      endsAt: "2026-08-30T16:00:00.000Z",
      startsAt: "2026-08-29T16:00:00.000Z",
      title: "全天评审",
    });
    expect(vm.form.title).toBe("");
    expect(context.wrapper.text()).toContain("日程已创建");
    expect(context.wrapper.text()).toContain("与产品评审重叠");
  });

  it("creates non-all-day events, blocks duplicate submit, and retains failed input", async () => {
    const context = await mountCalendar();
    const vm = viewModel(context.wrapper);
    vm.form.title = "非全天会议";
    vm.form.startsAt = "2026-08-30T09:00";
    vm.form.endsAt = "2026-08-30T10:00";
    let resolveCreate!: (value: {
      calendarEvent: CalendarEventSummary;
    }) => void;
    const create = vi
      .spyOn(context.planner, "createCalendarEvent")
      .mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      );

    const form = context.wrapper.get("form.planner-create");
    await form.trigger("submit");
    await context.wrapper.vm.$nextTick();
    expect(create).toHaveBeenCalledTimes(1);
    expect(
      (form.get("button.primary-button").element as HTMLButtonElement).disabled,
    ).toBe(true);
    await form.trigger("submit");
    expect(create).toHaveBeenCalledTimes(1);

    resolveCreate({ calendarEvent: calendarEvent() });
    await flushPromises();
    expect(create).toHaveBeenCalledWith({
      allDay: false,
      endsAt: "2026-08-30T02:00:00.000Z",
      startsAt: "2026-08-30T01:00:00.000Z",
      title: "非全天会议",
    });

    const failedContext = await mountCalendar();
    const failedVm = viewModel(failedContext.wrapper);
    failedVm.form.title = "保存失败后仍保留";
    failedVm.form.startsAt = "2026-08-30T09:00";
    failedVm.form.endsAt = "2026-08-30T10:00";
    vi.spyOn(failedContext.planner, "createCalendarEvent").mockRejectedValue(
      new Error("创建失败"),
    );
    await failedContext.wrapper.get("form.planner-create").trigger("submit");
    await flushPromises();
    expect(failedContext.wrapper.get('[role="alert"]').text()).toContain(
      "创建失败",
    );
    expect(failedVm.form.title).toBe("保存失败后仍保留");
  });

  it("edits non-all-day events with version, status, and overlap warning", async () => {
    const context = await mountCalendar();
    const edit = vi
      .spyOn(context.planner, "updateCalendarEvent")
      .mockResolvedValue({
        calendarEvent: calendarEvent({ status: "CANCELLED", version: 3 }),
        overlapWarning: {
          code: "OVERLAP_WARNING",
          conflictingEventId: "event-2",
          message: "更新后与另一个日程重叠",
        },
      });
    await button(context.wrapper, "编辑").trigger("click");
    const vm = viewModel(context.wrapper);
    vm.editForm.title = "更新后的评审";
    vm.editForm.status = "CANCELLED";
    vm.editForm.startsAt = "2026-08-30T10:00";
    vm.editForm.endsAt = "2026-08-30T11:00";
    await context.wrapper.get("form.calendar-edit-form").trigger("submit");
    await flushPromises();

    expect(edit).toHaveBeenCalledWith("event-1", {
      allDay: false,
      endsAt: "2026-08-30T03:00:00.000Z",
      startsAt: "2026-08-30T02:00:00.000Z",
      status: "CANCELLED",
      title: "更新后的评审",
      version: 1,
    });
    expect(context.wrapper.text()).toContain("更新后与另一个日程重叠");
    expect(viewModel(context.wrapper).editingId).toBe("");
  });

  it("edits all-day events with the next Shanghai day as the end boundary", async () => {
    const event = calendarEvent({
      allDay: true,
      endsAt: "2026-08-31T16:00:00.000Z",
      startsAt: "2026-08-30T16:00:00.000Z",
      version: 7,
    });
    const context = await mountCalendar("/calendar?date=2026-08-31", {
      events: [event],
    });
    const edit = vi
      .spyOn(context.planner, "updateCalendarEvent")
      .mockResolvedValue({ calendarEvent: event });
    await button(context.wrapper, "编辑").trigger("click");
    const vm = viewModel(context.wrapper);
    vm.editAllDayStart = "2026-08-31";
    await context.wrapper.get("form.calendar-edit-form").trigger("submit");
    await flushPromises();

    expect(edit).toHaveBeenCalledWith("event-1", {
      allDay: true,
      endsAt: "2026-08-31T16:00:00.000Z",
      startsAt: "2026-08-30T16:00:00.000Z",
      status: "SCHEDULED",
      title: "产品评审",
      version: 7,
    });
  });

  it("keeps failed edit input, allows cancel without saving, and guards edit switching", async () => {
    const second = calendarEvent({ id: "event-2", title: "第二条日程" });
    const context = await mountCalendar(undefined, {
      events: [calendarEvent(), second],
    });
    const update = vi
      .spyOn(context.planner, "updateCalendarEvent")
      .mockRejectedValue(new Error("保存失败"));
    await button(context.wrapper, "编辑").trigger("click");
    const vm = viewModel(context.wrapper);
    vm.editForm.title = "未保存修改";
    await context.wrapper.vm.$nextTick();

    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValue(false);
    await button(context.wrapper, "编辑").trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: "切换编辑" }),
    );
    expect(vm.editingId).toBe("event-1");

    await context.wrapper.get("form.calendar-edit-form").trigger("submit");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(1);
    expect(context.wrapper.text()).toContain("保存失败");
    expect(vm.editForm.title).toBe("未保存修改");

    await button(context.wrapper, "取消编辑").trigger("click");
    expect(update).toHaveBeenCalledTimes(1);
    expect(vm.editingId).toBe("");

    confirm.mockResolvedValue(true);
    await button(context.wrapper, "编辑").trigger("click");
    await button(context.wrapper, "编辑").trigger("click");
    await flushPromises();
    expect(vm.editingId).toBe("event-2");
  });

  it("confirms delete, retains failed rows, and restricts deleted actions to view and restore", async () => {
    const deleted = calendarEvent({
      deletedAt: "2026-08-29T01:00:00.000Z",
      id: "deleted-1",
      title: "已删除日程",
    });
    const context = await mountCalendar(
      "/calendar?date=2026-08-30&includeDeleted=true",
      { events: [calendarEvent(), deleted] },
    );
    expect(context.wrapper.text()).toContain("已删除");
    expect(
      context.wrapper.findAll("button").some((item) => item.text() === "编辑"),
    ).toBe(true);
    const deletedRow = context.wrapper.findAll("li.calendar-event-row")[1]!;
    expect(
      deletedRow.findAll("button").some((item) => item.text() === "编辑"),
    ).toBe(false);
    expect(
      deletedRow.findAll("button").some((item) => item.text() === "删除"),
    ).toBe(false);
    expect(deletedRow.text()).toContain("查看");
    expect(deletedRow.text()).toContain("恢复");

    const remove = vi
      .spyOn(context.planner, "deleteCalendarEvent")
      .mockResolvedValue(deleted);
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await button(context.wrapper, "删除").trigger("click");
    await flushPromises();
    expect(remove).not.toHaveBeenCalled();
    await button(context.wrapper, "删除").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("event-1");
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: "删除" }),
    );

    const failedContext = await mountCalendar(undefined, {
      events: [calendarEvent()],
    });
    vi.spyOn(failedContext.planner, "deleteCalendarEvent").mockRejectedValue(
      new Error("删除失败"),
    );
    vi.mocked(AppConfirm.requestAppConfirm).mockResolvedValue(true);
    await button(failedContext.wrapper, "删除").trigger("click");
    await flushPromises();
    expect(failedContext.wrapper.text()).toContain("产品评审");
    expect(failedContext.wrapper.get('[role="alert"]').text()).toContain(
      "删除失败",
    );
  });

  it("restores successfully or reports a restore failure without hiding the deleted row", async () => {
    const deleted = calendarEvent({
      deletedAt: "2026-08-29T01:00:00.000Z",
      id: "deleted-1",
      title: "已删除日程",
    });
    const context = await mountCalendar(
      "/calendar?date=2026-08-30&includeDeleted=true",
      { events: [deleted] },
    );
    const restore = vi
      .spyOn(context.planner, "restoreCalendarEvent")
      .mockResolvedValue(calendarEvent({ id: "deleted-1" }));
    await button(context.wrapper, "恢复").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledWith("deleted-1");
    expect(context.wrapper.text()).toContain("日程已恢复");

    const failedContext = await mountCalendar(
      "/calendar?date=2026-08-30&includeDeleted=true",
      { events: [deleted] },
    );
    vi.spyOn(failedContext.planner, "restoreCalendarEvent").mockRejectedValue(
      new Error("恢复失败"),
    );
    await button(failedContext.wrapper, "恢复").trigger("click");
    await flushPromises();
    expect(failedContext.wrapper.text()).toContain("已删除日程");
    expect(failedContext.wrapper.get('[role="alert"]').text()).toContain(
      "恢复失败",
    );
  });

  it("keeps date and filter state in the detail returnTo link and protects browser back", async () => {
    const context = await mountCalendar(
      "/calendar?date=2026-08-30&includeDeleted=true",
    );
    const detailLink = context.wrapper
      .findAll("a")
      .find((item) => item.text() === "查看");
    expect(detailLink).toBeDefined();
    expect(detailLink?.attributes("href")).toContain(
      "returnTo=%2Fcalendar%3Fdate%3D2026-08-30%26includeDeleted%3Dtrue",
    );

    const vm = viewModel(context.wrapper);
    vm.form.title = "返回前未保存";
    await context.wrapper.vm.$nextTick();
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValue(false);
    await context.router.push("/other");
    await flushPromises();
    expect(confirm).toHaveBeenCalled();
    expect(context.router.currentRoute.value.path).toBe("/calendar");
    expect(vm.form.title).toBe("返回前未保存");

    confirm.mockResolvedValue(true);
    await context.router.push("/other");
    await flushPromises();
    expect(context.router.currentRoute.value.path).toBe("/other");
  });
});
