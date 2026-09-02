// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { router } from "../router";
import {
  appendReturnTo,
  clearScrollPosition,
  readScrollPosition,
  safeReturnTo,
  saveScrollPosition,
} from "./navigation";

describe("navigation context", () => {
  it("accepts only same-origin application paths for returnTo", () => {
    expect(safeReturnTo({ returnTo: "/records?tab=pending" }, "/")).toBe(
      "/records?tab=pending",
    );
    expect(safeReturnTo({ returnTo: "https://example.com" }, "/records")).toBe(
      "/records",
    );
    expect(safeReturnTo({ returnTo: "//example.com/path" }, "/records")).toBe(
      "/records",
    );
    expect(safeReturnTo({ returnTo: "/\\example.com" }, "/records")).toBe(
      "/records",
    );
  });

  it("preserves an existing target query while adding the source", () => {
    expect(
      appendReturnTo("/tasks/task-1?mode=detail", "/plan?range=week"),
    ).toBe("/tasks/task-1?mode=detail&returnTo=%2Fplan%3Frange%3Dweek");
  });

  it("keeps root routes without a parent and maps child routes to their parent", () => {
    for (const path of ["/", "/records", "/plan", "/account"]) {
      expect(router.resolve(path).meta.page?.parent).toBeUndefined();
    }

    const parents = [
      ["/transactions", "/records", "记录"],
      ["/transactions/new", "/records", "记录"],
      ["/transactions/tx-1/edit", "/records", "记录"],
      ["/drafts", "/records", "记录"],
      ["/calendar", "/plan", "计划"],
      ["/tasks", "/plan", "计划"],
      ["/reminders", "/plan", "计划"],
      ["/sync/conflicts", "/account", "我的"],
      ["/finance/categories", "/account", "我的"],
      ["/finance/accounts", "/account", "我的"],
      ["/finance/budgets", "/account", "我的"],
      ["/change-password", "/account", "我的"],
    ] as const;
    for (const [path, parentPath, title] of parents) {
      expect(router.resolve(path).meta.page?.parent).toEqual({
        path: parentPath,
        title,
      });
    }

    expect(router.resolve("/calendar/event-1").meta.plannerEntity).toBe(
      "calendar-event",
    );
    expect(router.resolve("/reminders/reminder-1").meta.plannerEntity).toBe(
      "reminder",
    );
  });

  it("scrolls new navigations to top and accepts saved history positions", () => {
    const scrollBehavior = router.options.scrollBehavior;
    const current = router.currentRoute.value;
    expect(scrollBehavior).toBeDefined();
    expect(scrollBehavior?.(current, current, null)).toEqual({
      left: 0,
      top: 0,
    });
    expect(scrollBehavior?.(current, current, { left: 0, top: 246 })).toEqual({
      left: 0,
      top: 246,
    });
  });

  it("stores and reads scroll positions for source pages", () => {
    const path = "/records?tab=pending";
    clearScrollPosition(path);
    saveScrollPosition(path, 318.4);
    expect(readScrollPosition(path)).toBe(318);
    clearScrollPosition(path);
    expect(readScrollPosition(path)).toBeNull();
  });
});
