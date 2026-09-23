// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../stores/auth";
import { useTripsStore } from "../stores/trips";
import TripsView from "./TripsView.vue";

const unsavedMock = vi.hoisted(() => vi.fn());
vi.mock("../composables/useUnsavedChanges", () => ({
  useUnsavedChanges: unsavedMock,
}));

const active = {
  id: "trip-1",
  title: "上海行程",
  destination: "上海",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  budgetAmount: "1200.00",
  deletedAt: null,
  version: 1,
};
const deleted = {
  ...active,
  id: "trip-2",
  title: "旧行程",
  deletedAt: "2026-09-01T00:00:00Z",
};

function setup() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.$patch({ accessToken: "test", user: { id: "user-1" } as never });
  const store = useTripsStore();
  const loadTrips = vi
    .spyOn(store, "loadTrips")
    .mockImplementation(async (params = {}) => {
      store.errorMessage = null;
      store.errorKind = null;
      store.trips = params.includeDeleted
        ? ([active, deleted] as never)
        : ([active] as never);
    });
  const wrapper = mount(TripsView, {
    global: {
      plugins: [pinia],
      stubs: {
        DateField: { template: '<input class="date-stub" />' },
        RouterLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
      },
    },
  });
  return { wrapper, store, loadTrips };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TripsView", () => {
  it("shows a genuine empty list after loading completes", async () => {
    const { wrapper, store, loadTrips } = setup();
    await flushPromises();
    loadTrips.mockImplementationOnce(async () => {
      store.trips = [];
    });
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await flushPromises();
    expect(wrapper.text()).toContain("当前筛选没有行程");
    expect(wrapper.text()).not.toContain("行程暂时无法加载");
  });

  it("shows the list, dates, budget string and detail entry", async () => {
    const { wrapper } = setup();
    await flushPromises();
    expect(wrapper.text()).toContain("上海行程");
    expect(wrapper.text()).toContain("预算 ¥1200.00");
    expect(wrapper.find('a[href="/trips/trip-1"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("旧行程");
  });

  it("switches the deleted filter without leaking deleted rows to the default list", async () => {
    const { wrapper, loadTrips } = setup();
    await flushPromises();
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await flushPromises();
    expect(loadTrips).toHaveBeenLastCalledWith({ includeDeleted: true });
    expect(wrapper.text()).toContain("旧行程");
    await wrapper.find('input[type="checkbox"]').setValue(false);
    await flushPromises();
    expect(wrapper.text()).not.toContain("旧行程");
  });

  it("distinguishes load failure from an empty list and retries", async () => {
    const { wrapper, store, loadTrips } = setup();
    await flushPromises();
    loadTrips.mockImplementationOnce(async () => {
      store.errorMessage = "暂时不可用";
    });
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await flushPromises();
    expect(wrapper.text()).toContain("行程暂时无法加载");
    expect(wrapper.text()).not.toContain("还没有行程");
    await wrapper.find("button.feedback-state-action").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("旧行程");
  });

  it("creates a trip with string budget and clears the form", async () => {
    const { wrapper, store } = setup();
    await flushPromises();
    const create = vi
      .spyOn(store, "createTrip")
      .mockResolvedValue(active as never);
    await wrapper.findAll(".trip-field input")[0]!.setValue("新行程");
    await wrapper.findAll(".trip-field input")[1]!.setValue("杭州");
    await wrapper.findAll(".trip-field input")[4]!.setValue("50.00");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ budgetAmount: "50.00", title: "新行程" }),
    );
    expect(
      (wrapper.findAll(".trip-field input")[0]!.element as HTMLInputElement)
        .value,
    ).toBe("");
  });

  it("retains input on create failure", async () => {
    const { wrapper, store } = setup();
    await flushPromises();
    vi.spyOn(store, "createTrip").mockRejectedValue(new Error("创建失败"));
    await wrapper.findAll(".trip-field input")[0]!.setValue("新行程");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("创建失败");
    expect(
      (wrapper.findAll(".trip-field input")[0]!.element as HTMLInputElement)
        .value,
    ).toBe("新行程");
  });

  it("locks duplicate creation while a request is pending", async () => {
    const { wrapper, store } = setup();
    await flushPromises();
    let resolveCreate!: (value: never) => void;
    const create = vi
      .spyOn(store, "createTrip")
      .mockImplementation(
        () => new Promise((resolve) => (resolveCreate = resolve)),
      );
    await wrapper.find("form").trigger("submit");
    await wrapper.find("form").trigger("submit");
    expect(create).toHaveBeenCalledTimes(1);
    expect(
      wrapper.find('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    resolveCreate(active as never);
    await flushPromises();
  });

  it("deletes and restores through the existing store actions", async () => {
    const { wrapper, store } = setup();
    await flushPromises();
    const remove = vi.spyOn(store, "deleteTrip").mockResolvedValue(undefined);
    const restore = vi.spyOn(store, "restoreTrip").mockResolvedValue(undefined);
    await wrapper.find(".row-actions button").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith("trip-1");
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await flushPromises();
    await wrapper.findAll(".row-actions button")[1]!.trigger("click");
    await flushPromises();
    expect(restore).toHaveBeenCalledWith("trip-2");
    expect(unsavedMock).toHaveBeenCalled();
  });
});
