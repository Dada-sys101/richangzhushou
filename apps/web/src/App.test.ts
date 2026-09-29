// @vitest-environment jsdom
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import type { Router } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ router: undefined as unknown }));

vi.mock("./router", async () => {
  const { createMemoryHistory, createRouter } = await import("vue-router");
  const Placeholder = { render: () => null };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/",
        component: Placeholder,
        meta: { navigationKind: "ROOT_TAB" },
      },
      {
        path: "/records",
        component: Placeholder,
        meta: { navigationKind: "ROOT_TAB" },
      },
      {
        path: "/plan",
        component: Placeholder,
        meta: { navigationKind: "ROOT_TAB" },
      },
      {
        path: "/account",
        component: Placeholder,
        meta: { navigationKind: "ROOT_TAB" },
      },
      {
        path: "/capture",
        component: Placeholder,
        meta: { navigationKind: "FLOW_PAGE" },
      },
      {
        path: "/transactions",
        component: Placeholder,
        meta: { navigationKind: "STACK_PAGE" },
      },
      {
        path: "/calendar/:id",
        component: Placeholder,
        meta: { navigationKind: "DETAIL_PAGE" },
      },
      {
        path: "/transactions/:id/edit",
        component: Placeholder,
        meta: { navigationKind: "FLOW_PAGE" },
      },
      {
        path: "/login",
        component: Placeholder,
        meta: { navigationKind: "FLOW_PAGE", public: true },
      },
    ],
  });
  await router.push("/");
  await router.isReady();
  mocks.router = router;
  return { router };
});

import App from "./App.vue";
import { useAuthStore } from "./stores/auth";
import { useSyncStore } from "./stores/sync";

const appRouter = () => mocks.router as Router;

const stubs = {
  AppDialogHost: { template: '<div data-testid="dialog-host" />' },
  BottomNav: { template: '<nav data-testid="bottom-nav" />' },
  PwaLifecyclePrompt: { template: '<div data-testid="pwa-prompt" />' },
  SiteHeader: { template: '<header data-testid="site-header" />' },
};

let wrapper: VueWrapper | undefined;

function mountApp(authenticated: boolean) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.$patch({ accessToken: authenticated ? "test-token" : null });

  const sync = useSyncStore();
  vi.spyOn(sync, "start").mockResolvedValue(undefined);
  vi.spyOn(sync, "stop").mockImplementation(() => undefined);
  vi.spyOn(sync, "requestSync").mockResolvedValue(undefined);

  wrapper = mount(App, {
    global: {
      plugins: [appRouter()],
      stubs,
    },
  });
  return wrapper;
}

async function visit(path: string) {
  await appRouter().push(path);
  await nextTick();
}

function expectBottomNavigation(
  wrapper: VueWrapper,
  visible: boolean,
  rootSurface: boolean,
) {
  expect(wrapper.find('[data-testid="bottom-nav"]').exists()).toBe(visible);
  expect(
    wrapper.get(".app-shell").classes().includes("root-navigation-surface"),
  ).toBe(rootSurface);
  expect(
    wrapper.get(".app-shell").classes().includes("bottom-nav-visible"),
  ).toBe(visible);
  expect(wrapper.get(".app-main").classes().includes("has-bottom-nav")).toBe(
    visible,
  );
}

describe("App shell bottom navigation visibility", () => {
  beforeEach(async () => {
    await appRouter().push("/");
    await appRouter().isReady();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it.each(["/", "/records", "/plan", "/account"])(
    "shows BottomNav for authenticated root route %s",
    async (path) => {
      const app = mountApp(true);
      await visit(path);

      expectBottomNavigation(app, true, true);
    },
  );

  it.each([
    ["/capture", "flow"],
    ["/transactions", "stack"],
    ["/calendar/event-1", "detail"],
    ["/transactions/entry-1/edit", "edit"],
  ])("shows BottomNav for authenticated %s (%s)", async (path) => {
    const app = mountApp(true);
    await visit(path);

    expectBottomNavigation(app, true, false);
  });

  it("hides BottomNav on the public login route even with an authenticated store", async () => {
    const app = mountApp(true);
    await visit("/login");

    expectBottomNavigation(app, false, false);
  });

  it("hides BottomNav for an unauthenticated root route", () => {
    const app = mountApp(false);

    expectBottomNavigation(app, false, true);
  });

  it("hides BottomNav for an unauthenticated secondary route", async () => {
    const app = mountApp(false);
    await visit("/transactions");

    expectBottomNavigation(app, false, false);
  });

  it("keeps navigation available across root, secondary, detail and edit routes", async () => {
    const app = mountApp(true);
    expectBottomNavigation(app, true, true);

    await visit("/transactions");
    expectBottomNavigation(app, true, false);

    await visit("/calendar/event-1");
    expectBottomNavigation(app, true, false);

    await visit("/transactions/entry-1/edit");
    expectBottomNavigation(app, true, false);

    await visit("/");
    expectBottomNavigation(app, true, true);
  });
});
