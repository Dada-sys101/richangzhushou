// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Priority, TaskStatus, TaskSummary } from "../api/client";
import * as AppConfirm from "../composables/useAppConfirm";
import { useAuthStore } from "../stores/auth";
import { usePlannerStore } from "../stores/planner";
import TasksView from "./TasksView.vue";

const RouterHost = { template: "<RouterView />" };
const Placeholder = { template: "<div>其他页面</div>" };

interface TasksViewModel {
  editForm: {
    dueAt: string;
    priority: Priority;
    title: string;
    version: number;
  };
  editingId: string;
  form: {
    dueAt: string;
    priority: Priority;
    title: string;
  };
  handleIncludeDeletedChange: (event: Event) => Promise<void>;
  handleStatusChange: (event: Event) => Promise<void>;
  includeDeleted: boolean;
  reload: () => Promise<boolean>;
  statusFilter: TaskStatus | "";
  submit: () => Promise<void>;
}

type TaskParams = {
  includeDeleted?: boolean;
  status?: TaskStatus;
};

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

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/tasks",
        component: TasksView,
        meta: {
          page: {
            parent: { path: "/plans", title: "计划" },
            title: "待办事项",
          },
        },
      },
      { path: "/tasks/:id", component: Placeholder },
      { path: "/other", component: Placeholder },
      { path: "/plans", component: Placeholder },
    ],
  });
}

const mountedWrappers: Array<ReturnType<typeof mount>> = [];

async function mountTasks(
  path = "/tasks",
  options: {
    load?: (
      planner: ReturnType<typeof usePlannerStore>,
      params: TaskParams,
    ) => Promise<void>;
    tasks?: TaskSummary[];
  } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().$patch({ accessToken: "test-access-token" });
  const planner = usePlannerStore();
  const tasks = options.tasks ?? [task()];
  planner.tasks = [...tasks];
  planner.errorMessage = null;
  planner.errorKind = null;
  const load = vi
    .spyOn(planner, "loadTasks")
    .mockImplementation(async (params = {}) => {
      if (options.load) {
        await options.load(planner, params);
        return;
      }
      planner.tasks = [...tasks];
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

function viewModel(wrapper: ReturnType<typeof mount>): TasksViewModel {
  return wrapper.findComponent(TasksView).vm as unknown as TasksViewModel;
}

function row(wrapper: ReturnType<typeof mount>, title: string) {
  const result = wrapper
    .findAll("li.task-row")
    .find(
      (candidate) =>
        candidate.text().includes(title) ||
        candidate
          .findAll("input")
          .some((input) => input.element.value === title),
    );
  if (!result) {
    throw new Error(`task row not found: ${title}`);
  }
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
  if (!result) {
    throw new Error(`task button not found: ${title}/${label}`);
  }
  return result;
}

function listText(wrapper: ReturnType<typeof mount>): string {
  return wrapper
    .findAll("li.task-row")
    .map((candidate) => candidate.text())
    .join(" ");
}

function filterSelectEvent(value: string): Event {
  return { currentTarget: { value } } as unknown as Event;
}

function deletedFilterEvent(checked: boolean): Event {
  return { currentTarget: { checked } } as unknown as Event;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AppConfirm, "requestAppConfirm").mockResolvedValue(true);
});

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount();
  }
  document.body.innerHTML = "";
});

describe("TasksView", () => {
  it("loads OPEN tasks by default and supports all status filters and deleted tasks", async () => {
    const completed = task({
      id: "task-2",
      status: "COMPLETED",
      title: "已完成",
    });
    const cancelled = task({
      id: "task-3",
      status: "CANCELLED",
      title: "已取消",
    });
    const deleted = task({
      deletedAt: "2026-08-29T01:00:00.000Z",
      id: "task-4",
      title: "已删除",
    });
    const context = await mountTasks("/tasks", {
      tasks: [task(), completed, cancelled, deleted],
    });
    const vm = viewModel(context.wrapper);

    expect(listText(context.wrapper)).toContain("整理发票");
    expect(listText(context.wrapper)).not.toContain("已完成");
    expect(listText(context.wrapper)).not.toContain("已取消");
    expect(listText(context.wrapper)).not.toContain("已删除");

    expect(context.load).toHaveBeenCalledWith({
      includeDeleted: undefined,
      status: "OPEN",
    });

    await vm.handleStatusChange(filterSelectEvent("COMPLETED"));
    expect(vm.statusFilter).toBe("COMPLETED");
    expect(listText(context.wrapper)).toContain("已完成");
    expect(listText(context.wrapper)).not.toContain("整理发票");
    expect(context.load).toHaveBeenLastCalledWith({
      includeDeleted: undefined,
      status: "COMPLETED",
    });

    await vm.handleStatusChange(filterSelectEvent("CANCELLED"));
    expect(listText(context.wrapper)).toContain("已取消");
    expect(listText(context.wrapper)).not.toContain("已完成");
    await vm.handleStatusChange(filterSelectEvent(""));
    expect(vm.statusFilter).toBe("");
    expect(listText(context.wrapper)).toContain("整理发票");
    expect(listText(context.wrapper)).toContain("已完成");
    expect(listText(context.wrapper)).toContain("已取消");
    expect(listText(context.wrapper)).not.toContain("已删除");
    expect(context.load).toHaveBeenLastCalledWith({
      includeDeleted: undefined,
      status: undefined,
    });

    await vm.handleIncludeDeletedChange(deletedFilterEvent(true));
    expect(vm.includeDeleted).toBe(true);
    expect(listText(context.wrapper)).toContain("已删除");
    expect(context.load).toHaveBeenLastCalledWith({
      includeDeleted: true,
      status: undefined,
    });
    expect(context.wrapper.text()).toContain("全部状态");
    expect(context.wrapper.text()).toContain("包含已删除");
  });

  it("shows loading, status, priority, overdue, no-due and long-title content", async () => {
    let resolveLoad!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const longTitle = "这是一个在移动端应该换行而不是被截断的待办标题";
    const context = await mountTasks("/tasks", {
      tasks: [],
      load: async (planner) => {
        await pending;
        planner.tasks = [
          task({
            dueAt: null,
            overdue: false,
            priority: "LOW",
            title: "无截止时间",
          }),
          task({
            id: "task-2",
            overdue: true,
            priority: "HIGH",
            title: longTitle,
          }),
          task({
            id: "task-3",
            priority: "MEDIUM",
            status: "COMPLETED",
            title: "已完成待办",
          }),
        ];
      },
    });

    expect(context.wrapper.text()).toContain("正在加载待办");
    resolveLoad();
    await flushPromises();
    await viewModel(context.wrapper).handleStatusChange(filterSelectEvent(""));
    await flushPromises();
    expect(context.wrapper.text()).toContain(longTitle);
    expect(context.wrapper.text()).toContain("无截止时间");
    expect(context.wrapper.text()).toContain("已逾期");
    expect(context.wrapper.text()).toContain("优先级：低");
    expect(context.wrapper.text()).toContain("优先级：中");
    expect(context.wrapper.text()).toContain("优先级：高");
    expect(context.wrapper.text()).toContain("已完成");
  });

  it("shows a filter-specific empty state and retries an initial load failure", async () => {
    let attempts = 0;
    const context = await mountTasks("/tasks", {
      tasks: [],
      load: async (planner) => {
        attempts += 1;
        if (attempts === 1) {
          planner.errorMessage = "待办服务暂时不可用";
          return;
        }
        planner.errorMessage = null;
        planner.tasks = [];
      },
    });

    expect(context.wrapper.find('[role="alert"]').text()).toContain(
      "待办服务暂时不可用",
    );
    await context.wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(attempts).toBe(2);
    expect(context.wrapper.text()).toContain("当前筛选没有待办");
    expect(context.wrapper.text()).toContain("当前没有进行中待办");
  });

  it("keeps a cached list visible when a refresh fails", async () => {
    let attempts = 0;
    const context = await mountTasks("/tasks", {
      load: async (planner) => {
        attempts += 1;
        if (attempts > 1) {
          planner.errorMessage = "刷新失败";
          return;
        }
        planner.tasks = [task()];
      },
    });

    await viewModel(context.wrapper).reload();
    await flushPromises();
    expect(context.wrapper.text()).toContain("刷新失败");
    expect(context.wrapper.text()).toContain("整理发票");
    expect(context.wrapper.text()).toContain("上次成功加载的待办");
    expect(context.wrapper.find(".feedback-error-state").exists()).toBe(false);
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
    const context = await mountTasks("/tasks", {
      tasks: [],
      load: async (planner, params) => {
        if (params.status === "OPEN") {
          await oldResponse;
          planner.tasks = [task({ title: "旧筛选结果" })];
          return;
        }
        await newResponse;
        planner.tasks = [task({ status: "COMPLETED", title: "新筛选结果" })];
      },
    });
    const vm = viewModel(context.wrapper);

    const change = vm.handleStatusChange(filterSelectEvent("COMPLETED"));
    resolveNew();
    await change;
    await flushPromises();
    expect(context.wrapper.text()).toContain("新筛选结果");

    resolveOld();
    await flushPromises();
    expect(context.wrapper.text()).toContain("新筛选结果");
    expect(context.wrapper.text()).not.toContain("旧筛选结果");
  });

  it("creates tasks with and without due times and resets the form after success", async () => {
    const context = await mountTasks();
    const vm = viewModel(context.wrapper);
    const create = vi
      .spyOn(context.planner, "createTask")
      .mockResolvedValue(task());

    vm.form.title = "无截止时间待办";
    vm.form.priority = "HIGH";
    await vm.submit();
    expect(create).toHaveBeenCalledWith({
      dueAt: null,
      priority: "HIGH",
      title: "无截止时间待办",
    });
    expect(vm.form).toEqual({ dueAt: "", priority: "MEDIUM", title: "" });

    vm.form.title = "带截止时间待办";
    vm.form.dueAt = "2026-08-30T10:00";
    await vm.submit();
    expect(create).toHaveBeenLastCalledWith({
      dueAt: "2026-08-30T02:00:00.000Z",
      priority: "MEDIUM",
      title: "带截止时间待办",
    });
    expect(context.wrapper.text()).toContain("待办已创建");
  });

  it("does not submit an empty title, prevents duplicate creation, and retains failed input", async () => {
    const context = await mountTasks();
    const vm = viewModel(context.wrapper);
    const create = vi.spyOn(context.planner, "createTask");
    const form = context.wrapper.get("form.task-create-form");

    await form.trigger("submit");
    expect(create).not.toHaveBeenCalled();

    let resolveCreate!: (value: TaskSummary) => void;
    create.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    vm.form.title = "正在提交的待办";
    const firstSubmit = form.trigger("submit");
    await context.wrapper.vm.$nextTick();
    expect(
      (form.get("button.primary-button").element as HTMLButtonElement).disabled,
    ).toBe(true);
    await form.trigger("submit");
    expect(create).toHaveBeenCalledTimes(1);
    resolveCreate(task());
    await firstSubmit;
    await flushPromises();

    create.mockRejectedValue(new Error("创建失败"));
    vm.form.title = "创建失败后保留";
    vm.form.dueAt = "2026-08-30T11:00";
    await form.trigger("submit");
    expect(create).toHaveBeenCalledTimes(2);
    expect(vm.form.title).toBe("创建失败后保留");
    expect(vm.form.dueAt).toBe("2026-08-30T11:00");
    expect(context.wrapper.get('[role="alert"]').text()).toContain("创建失败");
  });

  it("reports when a non-OPEN filter will not show a newly created OPEN task", async () => {
    const context = await mountTasks();
    const vm = viewModel(context.wrapper);
    await vm.handleStatusChange(filterSelectEvent("COMPLETED"));
    vi.spyOn(context.planner, "createTask").mockResolvedValue(task());

    vm.form.title = "新的进行中待办";
    await vm.submit();
    expect(context.wrapper.text()).toContain(
      "当前筛选不会显示这条进行中的待办",
    );
  });

  it("edits with the current version and Shanghai due-time conversion", async () => {
    const context = await mountTasks("/tasks", {
      tasks: [task({ dueAt: "2026-08-30T02:00:00.000Z", version: 7 })],
    });
    await rowButton(context.wrapper, "整理发票", "编辑").trigger("click");
    const vm = viewModel(context.wrapper);
    expect(vm.editingId).toBe("task-1");
    expect(vm.editForm.dueAt).toBe("2026-08-30T10:00");
    vm.editForm.title = "更新后的待办";
    vm.editForm.priority = "LOW";
    vm.editForm.dueAt = "2026-08-30T11:00";
    const update = vi
      .spyOn(context.planner, "updateTask")
      .mockResolvedValue(task({ title: "更新后的待办", version: 8 }));

    await context.wrapper.get("form.task-edit-form").trigger("submit");
    await flushPromises();
    expect(update).toHaveBeenCalledWith("task-1", {
      dueAt: "2026-08-30T03:00:00.000Z",
      priority: "LOW",
      title: "更新后的待办",
      version: 7,
    });
    expect(vm.editingId).toBe("");
    expect(context.wrapper.text()).toContain("待办已更新");
  });

  it("retains failed edit input, cancels without a request, and guards switching editors", async () => {
    const second = task({ id: "task-2", title: "第二条待办" });
    const context = await mountTasks("/tasks", { tasks: [task(), second] });
    await rowButton(context.wrapper, "整理发票", "编辑").trigger("click");
    const vm = viewModel(context.wrapper);
    vm.editForm.title = "未保存的修改";
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValue(false);

    await rowButton(context.wrapper, "第二条待办", "编辑").trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: "切换编辑" }),
    );
    expect(vm.editingId).toBe("task-1");

    const update = vi
      .spyOn(context.planner, "updateTask")
      .mockRejectedValue(new Error("保存失败"));
    await context.wrapper.get("form.task-edit-form").trigger("submit");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(1);
    expect(vm.editForm.title).toBe("未保存的修改");
    expect(context.wrapper.text()).toContain("保存失败");

    await context.wrapper
      .get("form.task-edit-form button.secondary-button")
      .trigger("click");
    expect(update).toHaveBeenCalledTimes(1);

    confirm.mockResolvedValue(true);
    await rowButton(context.wrapper, "整理发票", "编辑").trigger("click");
    await rowButton(context.wrapper, "第二条待办", "编辑").trigger("click");
    await flushPromises();
    expect(vm.editingId).toBe("task-2");
  });

  it("completes OPEN tasks once and preserves the row on failure", async () => {
    const item = task();
    let loads = 0;
    const context = await mountTasks("/tasks", {
      tasks: [item],
      load: async (planner) => {
        loads += 1;
        planner.tasks = loads === 1 ? [item] : [];
      },
    });
    const complete = vi
      .spyOn(context.planner, "completeTask")
      .mockResolvedValue({ task: task({ status: "COMPLETED" }) });

    const first = rowButton(context.wrapper, "整理发票", "完成").trigger(
      "click",
    );
    await rowButton(context.wrapper, "整理发票", "完成").trigger("click");
    await first;
    await flushPromises();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(context.wrapper.text()).not.toContain("整理发票");
    expect(context.wrapper.text()).toContain("待办已完成");

    const failedContext = await mountTasks();
    vi.spyOn(failedContext.planner, "completeTask").mockRejectedValue(
      new Error("完成失败"),
    );
    await rowButton(failedContext.wrapper, "整理发票", "完成").trigger("click");
    await flushPromises();
    expect(failedContext.wrapper.text()).toContain("整理发票");
    expect(failedContext.wrapper.get('[role="alert"]').text()).toContain(
      "完成失败",
    );
  });

  it("cancels an OPEN task with its version and reports success or failure", async () => {
    const context = await mountTasks();
    const update = vi
      .spyOn(context.planner, "updateTask")
      .mockResolvedValue(task({ status: "CANCELLED" }));
    await rowButton(context.wrapper, "整理发票", "取消").trigger("click");
    await flushPromises();
    expect(update).toHaveBeenCalledWith("task-1", {
      status: "CANCELLED",
      version: 1,
    });
    expect(context.wrapper.text()).toContain("待办已取消");

    const failedContext = await mountTasks();
    vi.spyOn(failedContext.planner, "updateTask").mockRejectedValue(
      new Error("取消失败"),
    );
    await rowButton(failedContext.wrapper, "整理发票", "取消").trigger("click");
    await flushPromises();
    expect(failedContext.wrapper.text()).toContain("整理发票");
    expect(failedContext.wrapper.get('[role="alert"]').text()).toContain(
      "取消失败",
    );
  });

  it("confirms delete, keeps failed rows, and limits deleted rows to view and restore", async () => {
    const deleted = task({
      deletedAt: "2026-08-29T01:00:00.000Z",
      id: "deleted-1",
      title: "已删除待办",
    });
    const context = await mountTasks("/tasks", {
      tasks: [task(), deleted],
    });
    await viewModel(context.wrapper).handleIncludeDeletedChange(
      deletedFilterEvent(true),
    );
    await flushPromises();
    const deletedRow = row(context.wrapper, "已删除待办");
    expect(deletedRow.text()).toContain("查看");
    expect(deletedRow.text()).toContain("恢复");
    expect(deletedRow.findAll("button").map((button) => button.text())).toEqual(
      ["恢复"],
    );

    const remove = vi.spyOn(context.planner, "deleteTask");
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await rowButton(context.wrapper, "整理发票", "删除").trigger("click");
    expect(remove).not.toHaveBeenCalled();
    await rowButton(context.wrapper, "整理发票", "删除").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("task-1");
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: "删除" }),
    );

    const failedContext = await mountTasks();
    vi.mocked(AppConfirm.requestAppConfirm).mockResolvedValue(true);
    vi.spyOn(failedContext.planner, "deleteTask").mockRejectedValue(
      new Error("删除失败"),
    );
    await rowButton(failedContext.wrapper, "整理发票", "删除").trigger("click");
    await flushPromises();
    expect(failedContext.wrapper.text()).toContain("整理发票");
    expect(failedContext.wrapper.get('[role="alert"]').text()).toContain(
      "删除失败",
    );
  });

  it("restores deleted tasks and keeps them visible when restore fails", async () => {
    const deleted = task({
      deletedAt: "2026-08-29T01:00:00.000Z",
      id: "deleted-1",
      title: "已删除待办",
    });
    const context = await mountTasks("/tasks", { tasks: [deleted] });
    await viewModel(context.wrapper).handleIncludeDeletedChange(
      deletedFilterEvent(true),
    );
    await flushPromises();
    const restore = vi
      .spyOn(context.planner, "restoreTask")
      .mockResolvedValue(task({ id: "deleted-1" }));
    await rowButton(context.wrapper, "已删除待办", "恢复").trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledWith("deleted-1");
    expect(context.wrapper.text()).toContain("待办已恢复");

    const failedContext = await mountTasks("/tasks", { tasks: [deleted] });
    await viewModel(failedContext.wrapper).handleIncludeDeletedChange(
      deletedFilterEvent(true),
    );
    await flushPromises();
    vi.spyOn(failedContext.planner, "restoreTask").mockRejectedValue(
      new Error("恢复失败"),
    );
    await rowButton(failedContext.wrapper, "已删除待办", "恢复").trigger(
      "click",
    );
    await flushPromises();
    expect(failedContext.wrapper.text()).toContain("已删除待办");
    expect(failedContext.wrapper.get('[role="alert"]').text()).toContain(
      "恢复失败",
    );
  });

  it("clears an old operation error after a later success", async () => {
    const context = await mountTasks();
    const create = vi
      .spyOn(context.planner, "createTask")
      .mockRejectedValueOnce(new Error("第一次失败"))
      .mockResolvedValueOnce(task());
    const vm = viewModel(context.wrapper);

    vm.form.title = "第一次尝试";
    await vm.submit();
    expect(context.wrapper.get('[role="alert"]').text()).toContain(
      "第一次失败",
    );

    vm.form.title = "第二次尝试";
    await vm.submit();
    expect(create).toHaveBeenCalledTimes(2);
    expect(context.wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(context.wrapper.text()).toContain("待办已创建");
  });

  it("protects filter changes and navigation when create or edit input is dirty", async () => {
    const context = await mountTasks("/tasks?from=plan");
    const vm = viewModel(context.wrapper);
    const confirm = vi
      .mocked(AppConfirm.requestAppConfirm)
      .mockResolvedValue(false);

    vm.form.title = "返回前未保存";
    await context.wrapper.vm.$nextTick();
    await vm.handleStatusChange(filterSelectEvent("COMPLETED"));
    expect(vm.statusFilter).toBe("OPEN");
    expect(vm.form.title).toBe("返回前未保存");
    expect(confirm).toHaveBeenCalled();

    const detailLink = context.wrapper
      .findAll("a")
      .find((link) => link.text() === "查看");
    expect(detailLink?.attributes("href")).toContain(
      "returnTo=%2Ftasks%3Ffrom%3Dplan",
    );

    await context.router.push("/other");
    await flushPromises();
    expect(context.router.currentRoute.value.path).toBe("/tasks");
    expect(vm.form.title).toBe("返回前未保存");

    confirm.mockResolvedValue(true);
    await context.router.push("/other");
    await flushPromises();
    expect(context.router.currentRoute.value.path).toBe("/other");
  });
});
