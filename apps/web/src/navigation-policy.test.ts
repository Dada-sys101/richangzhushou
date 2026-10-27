// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRouter,
  type RouteLocationNormalizedLoaded,
} from "vue-router";
import { describe, expect, it } from "vitest";

import {
  ensureDirectEntryFallback,
  navigate,
  resolveBackTarget,
  resolveNavigationSection,
  sanitizeReturnTo,
} from "./navigation-policy";

const Placeholder = { template: "<div />" };

function makeRouter() {
  return createRouter({
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
        path: "/tasks",
        component: Placeholder,
        meta: { navigationKind: "STACK_PAGE" },
      },
      {
        path: "/tasks/:id",
        component: Placeholder,
        meta: {
          navigationKind: "DETAIL_PAGE",
          page: { title: "待办详情", parent: { title: "计划", path: "/plan" } },
        },
      },
    ],
  });
}

describe("navigation policy", () => {
  it("resolves section ownership independently of returnTo and follows nested parents", () => {
    const router = makeRouter();
    router.addRoute({
      path: "/trips",
      component: Placeholder,
      meta: {
        page: { title: "行程", parent: { title: "我的", path: "/account" } },
      },
    });
    router.addRoute({
      path: "/trips/:id",
      component: Placeholder,
      meta: {
        page: { title: "行程详情", parent: { title: "行程", path: "/trips" } },
      },
    });
    expect(
      resolveNavigationSection(
        router,
        router.resolve("/tasks/one?returnTo=%2F"),
      ),
    ).toBe("/plan");
    expect(resolveNavigationSection(router, router.resolve("/trips/one"))).toBe(
      "/account",
    );
    expect(
      resolveNavigationSection(router, router.resolve("/records?tab=pending")),
    ).toBe("/records");
  });

  it("leaves unknown/public pages unselected and stops invalid or cyclic parent chains", () => {
    const router = makeRouter();
    expect(
      resolveNavigationSection(router, { path: "/missing", meta: {} }),
    ).toBeNull();
    expect(
      resolveNavigationSection(router, { path: "/", meta: { public: true } }),
    ).toBeNull();
    expect(
      resolveNavigationSection(router, { path: "/capture", meta: {} }),
    ).toBe("/capture");
    expect(
      resolveNavigationSection(router, {
        path: "/external",
        meta: {
          page: {
            title: "外部",
            parent: { title: "外部", path: "https://example.com" },
          },
        },
      }),
    ).toBeNull();
    router.addRoute({
      path: "/loop",
      component: Placeholder,
      meta: {
        page: { title: "循环", parent: { title: "循环", path: "/loop" } },
      },
    });
    expect(
      resolveNavigationSection(router, router.resolve("/loop")),
    ).toBeNull();
  });

  it("does not retain 20 root-tab cycles below a business detail", async () => {
    const router = makeRouter();
    await router.push("/");
    await router.isReady();

    for (let index = 0; index < 20; index += 1) {
      await navigate(router, "/records");
      await navigate(router, "/plan");
      await navigate(router, "/account");
      await navigate(router, "/");
    }
    await navigate(router, "/tasks");
    await navigate(router, "/tasks/task-1?returnTo=%2Ftasks");

    router.back();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.currentRoute.value.fullPath).toBe("/tasks");

    router.back();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("keeps only one direct return source and rejects external targets", () => {
    expect(
      sanitizeReturnTo({
        fullPath: "/tasks/task-1?returnTo=x",
        query: { returnTo: "/plan?range=week&returnTo=%2Faccount" },
      }),
    ).toBe("/plan?range=week");
    expect(
      sanitizeReturnTo({
        fullPath: "/tasks/task-1",
        query: { returnTo: "https://evil.example" },
      }),
    ).toBeNull();
  });

  it("prefers direct return, then browser history, then fallback", () => {
    const route = {
      fullPath: "/tasks/task-1?returnTo=%2Ftasks",
      query: { returnTo: "/tasks" },
    };
    expect(resolveBackTarget(route, "/plan", "/tasks")).toEqual({
      type: "replace",
      target: "/tasks",
    });
    expect(resolveBackTarget(route, "/plan", null)).toEqual({
      type: "replace",
      target: "/tasks",
    });
    expect(
      resolveBackTarget(
        { fullPath: "/tasks/task-1", query: {} },
        "/plan",
        "/tasks",
      ),
    ).toEqual({ type: "history" });
    expect(
      resolveBackTarget(
        { fullPath: "/tasks/task-1", query: {} },
        "/plan",
        null,
      ),
    ).toEqual({ type: "replace", target: "/plan" });
  });

  it("seeds a Browser History fallback for a direct detail entry", () => {
    window.history.replaceState(
      {
        back: null,
        current: "/tasks/task-1",
        forward: null,
        position: 0,
        replaced: true,
      },
      "",
      "/tasks/task-1",
    );
    const route = makeRouter().resolve(
      "/tasks/task-1",
    ) as RouteLocationNormalizedLoaded;

    expect(ensureDirectEntryFallback(route)).toBe(true);
    expect(window.location.pathname).toBe("/tasks/task-1");
    expect(window.history.state.back).toBe("/plan");
    expect(ensureDirectEntryFallback(route)).toBe(false);
  });
});
