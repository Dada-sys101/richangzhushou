// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  api,
  type ReminderScheduleType,
  type ReminderStatus,
  type ReminderSummary,
} from "../api/client";
import * as AppConfirm from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import RemindersView from "./RemindersView.vue";

const RouterHost = { template: "<RouterView />" };
const Placeholder = { template: "<div>其他页面</div>" };
const PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa40HI0rUFap9pTj-uLS5ZwV-lpWQ";

interface ReminderFormModel {
  dayOfMonth: string;
  interval: string;
  note: string;
  scheduleType: ReminderScheduleType;
  startsAt: string;
  title: string;
  until: string;
  weekdays: number[];
}

interface ReminderViewModel {
  editForm: ReminderFormModel & { version: number };
  editingId: string;
  form: ReminderFormModel;
  handleIncludeDeletedChange: (event: Event) => Promise<void>;
  handleStatusChange: (event: Event) => Promise<void>;
  includeDeleted: boolean;
  reload: () => Promise<boolean>;
  saveEdit: (item: ReminderSummary) => Promise<void>;
  setStatus: (
    item: ReminderSummary,
    status: "CANCELLED" | "SCHEDULED",
  ) => Promise<void>;
  startEdit: (item: ReminderSummary) => Promise<void>;
  statusFilter: ReminderStatus | "";
  submit: () => Promise<void>;
}

type ReminderParams = {
  includeDeleted?: boolean;
  status?: ReminderStatus;
};

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
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/reminders",
        component: RemindersView,
        meta: {
          page: {
            parent: { path: "/plans", title: "计划" },
            title: "提醒事项",
          },
        },
      },
      { path: "/reminders/:id", component: Placeholder },
      { path: "/other", component: Placeholder },
      { path: "/plans", component: Placeholder },
    ],
  });
}

const mountedWrappers: Array<ReturnType<typeof mount>> = [];
const pushRestorers: Array<() => void> = [];

async function mountReminders(
  path = "/reminders",
  options: {
    load?: (
      planner: ReturnType<typeof usePlannerStore>,
      params: ReminderParams,
    ) => Promise<void>;
    reminders?: ReminderSummary[];
  } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "test-access-token" });
  const planner = usePlannerStore();
  const reminders = options.reminders ?? [reminder()];
  planner.reminders = [...reminders];
  planner.errorMessage = null;
  planner.errorKind = null;
  const load = vi
    .spyOn(planner, "loadReminders")
    .mockImplementation(async (params = {}) => {
      if (options.load) {
        await options.load(planner, params);
        return;
      }
      planner.reminders = [...reminders];
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

function viewModel(wrapper: ReturnType<typeof mount>): ReminderViewModel {
  return wrapper.findComponent(RemindersView)
    .vm as unknown as ReminderViewModel;
}

function row(wrapper: ReturnType<typeof mount>, title: string) {
  const result = wrapper
    .findAll("li.reminder-row")
    .find(
      (candidate) =>
        candidate.text().includes(title) ||
        candidate
          .findAll("input, textarea")
          .some(
            (input) =>
              (input.element as HTMLInputElement | HTMLTextAreaElement)
                .value === title,
          ),
    );
  if (!result) throw new Error(`reminder row not found: ${title}`);
  return result;
}

function rowButton(
  wrapper: ReturnType<typeof mount>,
  title: string,
  label: string,
) {
  const result = row(wrapper, title)
    .findAll("button")
    .find((candidate) => candidate.text().trim() === label);
  if (!result) throw new Error(`reminder button not found: ${title}/${label}`);
  return result;
}

function listText(wrapper: ReturnType<typeof mount>): string {
  return wrapper
    .findAll("li.reminder-row")
    .map((candidate) => candidate.text())
    .join(" ");
}

function filterSelectEvent(value: string): Event {
  return { currentTarget: { value } } as unknown as Event;
}

function deletedFilterEvent(checked: boolean): Event {
  return { currentTarget: { checked } } as unknown as Event;
}

function installPushEnvironment(
  options: {
    permission?: NotificationPermission;
    subscription?: boolean;
  } = {},
) {
  const originalPushManager = Object.getOwnPropertyDescriptor(
    window,
    "PushManager",
  );
  const originalNotification = Object.getOwnPropertyDescriptor(
    window,
    "Notification",
  );
  const originalServiceWorker = Object.getOwnPropertyDescriptor(
    navigator,
    "serviceWorker",
  );
  let subscribed = options.subscription ?? false;
  const notification = {
    permission: options.permission ?? "default",
    requestPermission: vi
      .fn<() => Promise<NotificationPermission>>()
      .mockResolvedValue(
        options.permission === "denied" ? "denied" : "granted",
      ),
  };
  const subscription = {
    endpoint: "https://push.example.test/subscriptions/unit",
    toJSON: () => ({
      endpoint: "https://push.example.test/subscriptions/unit",
      keys: { auth: "auth-unit", p256dh: "p256dh-unit" },
    }),
    unsubscribe: vi.fn(async () => {
      subscribed = false;
      return true;
    }),
  } as unknown as PushSubscription;
  const pushManager = {
    getSubscription: vi.fn(async () => (subscribed ? subscription : null)),
    subscribe: vi.fn(async () => {
      subscribed = true;
      return subscription;
    }),
  };

  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: class {},
  });
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: notification,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  });

  pushRestorers.push(() => {
    if (originalPushManager) {
      Object.defineProperty(window, "PushManager", originalPushManager);
    } else {
      delete (window as unknown as Record<string, unknown>).PushManager;
    }
    if (originalNotification) {
      Object.defineProperty(window, "Notification", originalNotification);
    } else {
      delete (window as unknown as Record<string, unknown>).Notification;
    }
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    }
  });

  return { notification, pushManager, subscription };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(true);
});

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount();
  for (const restore of pushRestorers.splice(0).reverse()) restore();
  document.body.innerHTML = "";
});

describe("RemindersView", () => {
  it("loads SCHEDULED by default and supports all statuses and deleted rows", async () => {
    const sent = reminder({ id: "sent", status: "SENT", title: "已发送" });
    const failed = reminder({
      failureReason: "Push 服务拒绝",
      id: "failed",
      status: "FAILED",
      title: "发送失败",
    });
    const suppressed = reminder({
      id: "suppressed",
      status: "SUPPRESSED",
      title: "已抑制",
    });
    const cancelled = reminder({
      id: "cancelled",
      status: "CANCELLED",
      title: "已取消",
    });
    const deleted = reminder({
      deletedAt: "2026-08-29T01:00:00.000Z",
      id: "deleted",
      title: "已删除",
    });
    const context = await mountReminders("/reminders", {
      reminders: [reminder(), sent, failed, suppressed, cancelled, deleted],
    });
    const vm = viewModel(context.wrapper);

    expect(listText(context.wrapper)).toContain("提交报销");
    expect(listText(context.wrapper)).not.toContain("已发送");
    expect(context.load).toHaveBeenCalledWith({
      includeDeleted: undefined,
      status: "SCHEDULED",
    });

    for (const [status, title] of [
      ["SENT", "已发送"],
      ["FAILED", "发送失败"],
      ["SUPPRESSED", "已抑制"],
      ["CANCELLED", "已取消"],
    ] as const) {
      await vm.handleStatusChange(filterSelectEvent(status));
      expect(listText(context.wrapper)).toContain(title);
      expect(vm.statusFilter).toBe(status);
    }

    await vm.handleStatusChange(filterSelectEvent(""));
    expect(listText(context.wrapper)).toContain("提交报销");
    expect(listText(context.wrapper)).toContain("已发送");
    expect(listText(context.wrapper)).toContain("已抑制");
    expect(listText(context.wrapper)).not.toContain("已删除");
    await vm.handleIncludeDeletedChange(deletedFilterEvent(true));
    expect(listText(context.wrapper)).toContain("已删除");
    expect(context.wrapper.text()).toContain("全部状态");
    expect(context.wrapper.text()).toContain("包含已删除");
  });

  it("shows loading, empty copy, status, recurrence and failure details", async () => {
    let resolveLoad!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const context = await mountReminders("/reminders", {
      reminders: [],
      load: async (planner) => {
        await pending;
        planner.reminders = [
          reminder({
            attemptCount: 3,
            failureReason: "服务端暂时不可用",
            note: "记得带上发票原件",
            scheduleType: "WEEKLY",
            title: "这是一个需要在移动端换行的很长提醒标题",
            recurrence: { interval: 2, weekdays: [1, 4, 7] },
          }),
        ];
      },
    });

    expect(context.wrapper.text()).toContain("正在加载提醒");
    resolveLoad();
    await flushPromises();
    expect(context.wrapper.text()).toContain("每 2 周（一、四、日）");
    expect(context.wrapper.text()).toContain("尝试 3 次");
    expect(context.wrapper.text()).toContain("服务端暂时不可用");
    expect(context.wrapper.text()).toContain("记得带上发票原件");

    const emptyContext = await mountReminders("/reminders", {
      reminders: [],
    });
    expect(emptyContext.wrapper.text()).toContain("当前筛选没有提醒");
    expect(emptyContext.wrapper.text()).toContain("当前没有待发送提醒");
  });

  it("shows initial failure and keeps cached rows during refresh failure", async () => {
    let attempts = 0;
    const context = await mountReminders("/reminders", {
      load: async (planner) => {
        attempts += 1;
        if (attempts === 1) {
          planner.errorMessage = "提醒服务暂时不可用";
          return;
        }
        planner.errorMessage = null;
        planner.reminders = [];
      },
    });

    expect(context.wrapper.get('[role="alert"]').text()).toContain(
      "提醒服务暂时不可用",
    );
    await context.wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(context.wrapper.text()).toContain("当前筛选没有提醒");

    let cachedAttempts = 0;
    const cached = await mountReminders("/reminders", {
      load: async (planner) => {
        cachedAttempts += 1;
        if (cachedAttempts > 1) {
          planner.errorMessage = "刷新失败";
          return;
        }
        planner.reminders = [reminder()];
      },
    });
    const vm = viewModel(cached.wrapper);
    await vm.reload();
    await flushPromises();
    expect(cached.wrapper.text()).toContain("提交报销");
    expect(cached.wrapper.text()).toContain("上次成功加载的提醒");
    expect(cached.wrapper.find(".feedback-error-state").exists()).toBe(false);
  });

  it("does not let an older filter response replace the current list", async () => {
    let resolveOld!: () => void;
    let resolveNew!: () => void;
    const oldResponse = new Promise<void>((resolve) => {
      resolveOld = resolve;
    });
    const newResponse = new Promise<void>((resolve) => {
      resolveNew = resolve;
    });
    const context = await mountReminders("/reminders", {
      reminders: [],
      load: async (planner, params) => {
        if (params.status === "SCHEDULED") {
          await oldResponse;
          planner.reminders = [reminder({ title: "旧筛选结果" })];
          return;
        }
        await newResponse;
        planner.reminders = [
          reminder({ status: "FAILED", title: "新筛选结果" }),
        ];
      },
    });
    const vm = viewModel(context.wrapper);

    const change = vm.handleStatusChange(filterSelectEvent("FAILED"));
    resolveNew();
    await change;
    await flushPromises();
    expect(context.wrapper.text()).toContain("新筛选结果");
    resolveOld();
    await flushPromises();
    expect(context.wrapper.text()).toContain("新筛选结果");
    expect(context.wrapper.text()).not.toContain("旧筛选结果");
  });

  it("creates once, daily, weekly and monthly reminders with compatible recurrence payloads", async () => {
    const context = await mountReminders();
    const vm = viewModel(context.wrapper);
    const create = vi
      .spyOn(context.planner, "createReminder")
      .mockResolvedValue(reminder());

    vm.form.title = "一次性提醒";
    vm.form.startsAt = "2026-08-30T10:00";
    await vm.submit();
    expect(create).toHaveBeenCalledWith({
      note: null,
      recurrence: null,
      scheduleType: "ONCE",
      startsAt: "2026-08-30T02:00:00.000Z",
      title: "一次性提醒",
    });

    vm.form.title = "每天提醒";
    vm.form.startsAt = "2026-08-30T10:00";
    vm.form.scheduleType = "DAILY";
    vm.form.interval = "2";
    vm.form.until = "2026-09-10T10:00";
    await vm.submit();
    expect(create).toHaveBeenLastCalledWith({
      note: null,
      recurrence: {
        interval: 2,
        until: "2026-09-10T02:00:00.000Z",
      },
      scheduleType: "DAILY",
      startsAt: "2026-08-30T02:00:00.000Z",
      title: "每天提醒",
    });

    vm.form.title = "每周提醒";
    vm.form.startsAt = "2026-08-30T10:00";
    vm.form.scheduleType = "WEEKLY";
    vm.form.interval = "1";
    vm.form.weekdays = [7, 1, 4];
    vm.form.until = "";
    await vm.submit();
    expect(create).toHaveBeenLastCalledWith({
      note: null,
      recurrence: { weekdays: [1, 4, 7] },
      scheduleType: "WEEKLY",
      startsAt: "2026-08-30T02:00:00.000Z",
      title: "每周提醒",
    });

    vm.form.title = "每月提醒";
    vm.form.startsAt = "2026-08-30T10:00";
    vm.form.scheduleType = "MONTHLY";
    vm.form.interval = "3";
    vm.form.dayOfMonth = "31";
    await vm.submit();
    expect(create).toHaveBeenLastCalledWith({
      note: null,
      recurrence: { dayOfMonth: 31, interval: 3 },
      scheduleType: "MONTHLY",
      startsAt: "2026-08-30T02:00:00.000Z",
      title: "每月提醒",
    });
    expect(vm.form).toEqual({
      dayOfMonth: "",
      interval: "1",
      note: "",
      scheduleType: "ONCE",
      startsAt: "",
      title: "",
      until: "",
      weekdays: [],
    });
  });

  it("validates required and recurrence fields and keeps failed input", async () => {
    const context = await mountReminders();
    const vm = viewModel(context.wrapper);
    const create = vi.spyOn(context.planner, "createReminder");

    await vm.submit();
    expect(create).not.toHaveBeenCalled();
    expect(context.wrapper.get('[role="alert"]').text()).toContain(
      "请输入提醒标题",
    );

    vm.form.title = "截止时间错误";
    vm.form.startsAt = "2026-08-30T10:00";
    vm.form.scheduleType = "DAILY";
    vm.form.interval = "0";
    await vm.submit();
    expect(context.wrapper.get('[role="alert"]').text()).toContain(
      "间隔必须是 1 到 366",
    );

    vm.form.interval = "1";
    vm.form.until = "2026-08-29T10:00";
    await vm.submit();
    expect(context.wrapper.get('[role="alert"]').text()).toContain(
      "截止时间不能早于首次时间",
    );

    vm.form.until = "2026-09-01T10:00";
    create.mockRejectedValue(new Error("创建失败"));
    await vm.submit();
    expect(vm.form.title).toBe("截止时间错误");
    expect(vm.form.until).toBe("2026-09-01T10:00");
    expect(context.wrapper.get('[role="alert"]').text()).toContain("创建失败");
  });

  it("prevents duplicate creation and reports when the current filter hides a new scheduled reminder", async () => {
    const context = await mountReminders();
    const vm = viewModel(context.wrapper);
    let resolveCreate!: (value: ReminderSummary) => void;
    const create = vi.spyOn(context.planner, "createReminder").mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    vm.form.title = "正在创建的提醒";
    vm.form.startsAt = "2026-08-30T10:00";
    const first = vm.submit();
    await context.wrapper.vm.$nextTick();
    await vm.submit();
    expect(create).toHaveBeenCalledTimes(1);
    resolveCreate(reminder());
    await first;
    await flushPromises();

    await vm.handleStatusChange(filterSelectEvent("FAILED"));
    vm.form.title = "当前筛选看不到";
    vm.form.startsAt = "2026-08-30T10:00";
    create.mockResolvedValue(reminder());
    await vm.submit();
    expect(context.wrapper.text()).toContain("当前筛选不会显示这条待发送提醒");
  });

  it("edits recurrence fields with Shanghai conversion and version", async () => {
    const item = reminder({
      note: "原备注",
      recurrence: {
        interval: 2,
        until: "2026-09-10T02:00:00.000Z",
        weekdays: [1, 4],
      },
      scheduleType: "WEEKLY",
      scheduledAt: "2026-08-30T02:00:00.000Z",
      version: 7,
    });
    const context = await mountReminders("/reminders", { reminders: [item] });
    const vm = viewModel(context.wrapper);
    await vm.startEdit(item);
    expect(vm.editingId).toBe(item.id);
    expect(vm.editForm.startsAt).toBe("2026-08-30T10:00");
    expect(vm.editForm.until).toBe("2026-09-10T10:00");
    vm.editForm.title = "更新后的提醒";
    vm.editForm.note = "更新备注";
    vm.editForm.weekdays = [7, 2];
    vm.editForm.until = "2026-09-12T11:00";
    const update = vi
      .spyOn(context.planner, "updateReminder")
      .mockResolvedValue(reminder({ title: "更新后的提醒", version: 8 }));

    await vm.saveEdit(item);
    expect(update).toHaveBeenCalledWith(item.id, {
      note: "更新备注",
      recurrence: {
        interval: 2,
        until: "2026-09-12T03:00:00.000Z",
        weekdays: [2, 7],
      },
      scheduleType: "WEEKLY",
      startsAt: "2026-08-30T02:00:00.000Z",
      title: "更新后的提醒",
      version: 7,
    });
    expect(vm.editingId).toBe("");
    expect(context.wrapper.text()).toContain("提醒已更新");
  });

  it("keeps failed edits, cancels without a request, and protects editor switching", async () => {
    const second = reminder({ id: "reminder-2", title: "第二条提醒" });
    const context = await mountReminders("/reminders", {
      reminders: [reminder(), second],
    });
    const vm = viewModel(context.wrapper);
    await vm.startEdit(reminder());
    vm.editForm.title = "未保存的修改";
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValue(false);
    await vm.startEdit(second);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: "切换编辑" }),
    );
    expect(vm.editingId).toBe("reminder-1");

    const update = vi
      .spyOn(context.planner, "updateReminder")
      .mockRejectedValue(new Error("保存失败"));
    await vm.saveEdit(reminder());
    expect(update).toHaveBeenCalledTimes(1);
    expect(vm.editForm.title).toBe("未保存的修改");
    expect(context.wrapper.text()).toContain("保存失败");
    await rowButton(context.wrapper, "未保存的修改", "取消编辑").trigger(
      "click",
    );
    expect(update).toHaveBeenCalledTimes(1);

    confirm.mockResolvedValue(true);
    await vm.startEdit(reminder());
    await vm.startEdit(second);
    expect(vm.editingId).toBe("reminder-2");
  });

  it("handles cancellation, re-enable and status restrictions", async () => {
    const scheduled = reminder();
    const cancelled = reminder({
      id: "cancelled",
      status: "CANCELLED",
      title: "已取消提醒",
    });
    const sent = reminder({ id: "sent", status: "SENT", title: "已发送提醒" });
    const context = await mountReminders("/reminders", {
      reminders: [scheduled, cancelled, sent],
    });
    const vm = viewModel(context.wrapper);
    await vm.handleStatusChange(filterSelectEvent(""));
    const update = vi
      .spyOn(context.planner, "updateReminder")
      .mockResolvedValue(reminder({ status: "CANCELLED" }));
    await rowButton(context.wrapper, "提交报销", "取消").trigger("click");
    await flushPromises();
    expect(update).toHaveBeenCalledWith("reminder-1", {
      status: "CANCELLED",
      version: 1,
    });
    expect(context.wrapper.text()).toContain("提醒已取消");

    update.mockResolvedValue(reminder({ status: "SCHEDULED" }));
    await rowButton(context.wrapper, "已取消提醒", "重新启用").trigger("click");
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith("cancelled", {
      status: "SCHEDULED",
      version: 1,
    });
    expect(context.wrapper.text()).toContain("提醒已重新启用");

    const sentRow = row(context.wrapper, "已发送提醒");
    expect(sentRow.text()).not.toContain("编辑");
    expect(sentRow.text()).not.toContain("取消");
    expect(sentRow.text()).toContain("删除");

    update.mockRejectedValue(new Error("取消失败"));
    await rowButton(context.wrapper, "提交报销", "取消").trigger("click");
    await flushPromises();
    expect(context.wrapper.text()).toContain("提交报销");
    expect(context.wrapper.get('[role="alert"]').text()).toContain("取消失败");
  });

  it("confirms delete, preserves failed rows, and restores deleted reminders", async () => {
    const deleted = reminder({
      deletedAt: "2026-08-29T01:00:00.000Z",
      id: "deleted",
      title: "已删除提醒",
    });
    const context = await mountReminders("/reminders", {
      reminders: [reminder(), deleted],
    });
    const vm = viewModel(context.wrapper);
    await vm.handleStatusChange(filterSelectEvent(""));
    await vm.handleIncludeDeletedChange(deletedFilterEvent(true));
    await flushPromises();
    expect(row(context.wrapper, "已删除提醒").text()).toContain("恢复");
    expect(row(context.wrapper, "已删除提醒").text()).not.toContain("编辑");

    const remove = vi
      .spyOn(context.planner, "deleteReminder")
      .mockResolvedValue(reminder({ deletedAt: "2026-08-29T01:00:00.000Z" }));
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await rowButton(context.wrapper, "提交报销", "删除").trigger("click");
    expect(remove).not.toHaveBeenCalled();
    await rowButton(context.wrapper, "提交报销", "删除").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("reminder-1");
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: "删除" }),
    );

    const restore = vi
      .spyOn(context.planner, "restoreReminder")
      .mockResolvedValue(reminder({ id: "deleted" }));
    await rowButton(context.wrapper, "已删除提醒", "恢复").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledWith("deleted");
    expect(context.wrapper.text()).toContain("提醒已恢复");

    const failedContext = await mountReminders("/reminders", {
      reminders: [reminder()],
    });
    vi.mocked(AppConfirm.requestAppConfirm).mockResolvedValue(true);
    vi.spyOn(failedContext.planner, "deleteReminder").mockRejectedValue(
      new Error("删除失败"),
    );
    await rowButton(failedContext.wrapper, "提交报销", "删除").trigger("click");
    await flushPromises();
    expect(failedContext.wrapper.text()).toContain("提交报销");
    expect(failedContext.wrapper.get('[role="alert"]').text()).toContain(
      "删除失败",
    );
  });

  it("clears old operation errors and preserves returnTo", async () => {
    const context = await mountReminders("/reminders?status=FAILED&from=plan");
    const vm = viewModel(context.wrapper);
    const create = vi
      .spyOn(context.planner, "createReminder")
      .mockRejectedValueOnce(new Error("第一次失败"))
      .mockResolvedValueOnce(reminder());
    vm.form.title = "第一次尝试";
    vm.form.startsAt = "2026-08-30T10:00";
    await vm.submit();
    expect(context.wrapper.get('[role="alert"]').text()).toContain(
      "第一次失败",
    );

    vm.form.title = "第二次尝试";
    await vm.submit();
    expect(create).toHaveBeenCalledTimes(2);
    expect(context.wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(context.wrapper.text()).toContain("提醒已创建");

    const detailLink = context.wrapper
      .findAll("a")
      .find((link) => link.text() === "查看");
    expect(detailLink?.attributes("href")).toContain(
      "returnTo=%2Freminders%3Fstatus%3DFAILED%26from%3Dplan",
    );
  });

  it("protects filter changes and navigation when forms are dirty", async () => {
    const context = await mountReminders("/reminders");
    const vm = viewModel(context.wrapper);
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValue(false);
    const initialLoads = context.load.mock.calls.length;
    vm.form.title = "返回前未保存";
    await context.wrapper.vm.$nextTick();

    await vm.handleStatusChange(filterSelectEvent("FAILED"));
    expect(vm.statusFilter).toBe("SCHEDULED");
    expect(vm.form.title).toBe("返回前未保存");
    expect(context.load).toHaveBeenCalledTimes(initialLoads);
    expect(confirm).toHaveBeenCalled();

    confirm.mockResolvedValue(true);
    await vm.handleStatusChange(filterSelectEvent("FAILED"));
    expect(vm.statusFilter).toBe("FAILED");
    expect(vm.form.title).toBe("");

    vm.form.title = "再次未保存";
    await context.wrapper.vm.$nextTick();
    confirm.mockResolvedValue(false);
    await context.router.push("/other");
    await flushPromises();
    expect(context.router.currentRoute.value.path).toBe("/reminders");
    expect(vm.form.title).toBe("再次未保存");

    confirm.mockResolvedValue(true);
    await context.router.push("/other");
    await flushPromises();
    expect(context.router.currentRoute.value.path).toBe("/other");
  });

  it("distinguishes Push unsupported, unconfigured, enabled, denied and failure states", async () => {
    const unsupported = await mountReminders();
    expect(unsupported.wrapper.text()).toContain("浏览器不支持");

    const env = installPushEnvironment();
    vi.spyOn(api, "getPushStatus").mockResolvedValue({
      enabled: false,
      publicKey: null,
      subscribed: false,
      subscriptions: 0,
    });
    const unconfigured = await mountReminders();
    expect(unconfigured.wrapper.text()).toContain("服务端未配置");
    expect(
      unconfigured.wrapper
        .findAll("button")
        .some((button) => button.text().includes("开启应用外提醒")),
    ).toBe(false);

    vi.mocked(api.getPushStatus).mockRejectedValue(new Error("网络失败"));
    const failed = await mountReminders();
    expect(failed.wrapper.text()).toContain("应用外提醒状态加载失败");
    expect(failed.wrapper.text()).not.toContain("浏览器不支持");

    env.notification.permission = "denied";
    vi.mocked(api.getPushStatus).mockResolvedValue({
      enabled: true,
      publicKey: PUBLIC_KEY,
      subscribed: false,
      subscriptions: 0,
    });
    const denied = await mountReminders();
    env.notification.requestPermission.mockResolvedValue("denied");
    expect(denied.wrapper.text()).toContain("权限被拒绝");
    await denied.wrapper
      .get(".reminder-push-card button:not([disabled])")
      .trigger("click");
    await flushPromises();
    expect(denied.wrapper.get('[role="alert"]').text()).toContain(
      "需要允许系统通知",
    );
  });

  it("enables and disables Push without blocking reminder CRUD", async () => {
    const env = installPushEnvironment({ permission: "default" });
    vi.spyOn(api, "getPushStatus").mockResolvedValue({
      enabled: true,
      publicKey: PUBLIC_KEY,
      subscribed: false,
      subscriptions: 0,
    });
    const save = vi.spyOn(api, "savePushSubscription").mockResolvedValue({
      enabled: true,
      publicKey: PUBLIC_KEY,
      subscribed: true,
      subscriptions: 1,
    });
    const remove = vi
      .spyOn(api, "deletePushSubscription")
      .mockResolvedValue(undefined);
    const context = await mountReminders();
    const enable = context.wrapper.get(
      ".reminder-push-card button:not([disabled])",
    );
    expect(enable.text()).toContain("开启应用外提醒");
    await enable.trigger("click");
    await flushPromises();
    expect(save).toHaveBeenCalledWith({
      endpoint: "https://push.example.test/subscriptions/unit",
      keys: { auth: "auth-unit", p256dh: "p256dh-unit" },
    });
    expect(context.wrapper.text()).toContain("应用外提醒已开启");
    expect(context.wrapper.find(".reminder-push-card button").text()).toContain(
      "关闭应用外提醒",
    );

    await context.wrapper
      .get(".reminder-push-card button:not([disabled])")
      .trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith(
      "https://push.example.test/subscriptions/unit",
    );
    expect(env.subscription.unsubscribe).toHaveBeenCalled();
    expect(context.wrapper.text()).toContain("应用外提醒已关闭");
    expect(listText(context.wrapper)).toContain("提交报销");
  });

  it("does not show Push success when saving the subscription fails", async () => {
    installPushEnvironment();
    vi.spyOn(api, "getPushStatus").mockResolvedValue({
      enabled: true,
      publicKey: PUBLIC_KEY,
      subscribed: false,
      subscriptions: 0,
    });
    vi.spyOn(api, "savePushSubscription").mockRejectedValue(
      new Error("保存订阅失败"),
    );
    const context = await mountReminders();
    await context.wrapper
      .get(".reminder-push-card button:not([disabled])")
      .trigger("click");
    await flushPromises();
    expect(context.wrapper.text()).toContain("应用外提醒操作失败");
    expect(context.wrapper.text()).not.toContain("应用外提醒已开启");
    expect(listText(context.wrapper)).toContain("提交报销");
  });
});
