import type {
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
  Router,
} from "vue-router";

import { sanitizeInternalPath } from "./utils/navigation";

export type NavigationKind =
  "ROOT_TAB" | "STACK_PAGE" | "DETAIL_PAGE" | "FLOW_PAGE";

declare module "vue-router" {
  interface RouteMeta {
    navigationKind?: NavigationKind;
  }
}

export type BackAction =
  { type: "history" } | { type: "replace"; target: string };

const navigationEntries = new Set([
  "/",
  "/records",
  "/plan",
  "/account",
  "/capture",
]);

export function resolveNavigationSection(
  router: Router,
  route: Pick<RouteLocationNormalizedLoaded, "path" | "meta">,
): string | null {
  let current = route;
  const visited = new Set<string>();
  // Section ownership follows route metadata, not the page's returnTo source.
  while (!visited.has(current.path) && !current.meta?.public) {
    if (navigationEntries.has(current.path)) return current.path;
    visited.add(current.path);
    const parent = sanitizeInternalPath(current.meta?.page?.parent?.path);
    if (!parent) return null;
    current = router.resolve(parent);
  }
  return null;
}

export function classifyRoute(
  route: Pick<RouteLocationNormalizedLoaded, "meta">,
): NavigationKind {
  return route.meta.navigationKind ?? "STACK_PAGE";
}

export async function navigate(
  router: Router,
  target: RouteLocationRaw,
): Promise<void> {
  const destination = router.resolve(target);
  if (classifyRoute(destination) === "ROOT_TAB") {
    await router.replace(target);
    return;
  }
  await router.push(target);
}

export function sanitizeReturnTo(
  route: Pick<RouteLocationNormalizedLoaded, "fullPath" | "query">,
): string | null {
  const target = sanitizeInternalPath(route.query.returnTo);
  if (!target || target === route.fullPath) {
    return null;
  }
  return target;
}

export function resolveBackTarget(
  route: Pick<RouteLocationNormalizedLoaded, "fullPath" | "query">,
  fallback: string,
  browserBack: unknown = readBrowserBack(),
): BackAction {
  const directReturn = sanitizeReturnTo(route);
  const safeFallback = sanitizeInternalPath(fallback) ?? "/";
  const safeBrowserBack = sanitizeInternalPath(browserBack);

  if (directReturn) {
    return { type: "replace", target: directReturn };
  }
  if (safeBrowserBack) {
    return { type: "history" };
  }
  return { type: "replace", target: safeFallback };
}

export async function navigateBack(
  router: Router,
  fallback: string,
): Promise<void> {
  const action = resolveBackTarget(router.currentRoute.value, fallback);
  if (action.type === "history") {
    router.back();
    return;
  }
  await router.replace(action.target);
}

export function ensureDirectEntryFallback(
  route: RouteLocationNormalizedLoaded,
): boolean {
  if (
    typeof window === "undefined" ||
    !route.meta.page?.parent ||
    classifyRoute(route) === "ROOT_TAB"
  ) {
    return false;
  }

  const currentState = asHistoryState(window.history.state);
  if (sanitizeInternalPath(currentState.back)) {
    return false;
  }

  const fallback =
    sanitizeReturnTo(route) ??
    sanitizeInternalPath(route.meta.page.parent.path) ??
    "/";
  if (fallback === route.fullPath) {
    return false;
  }

  const position =
    typeof currentState.position === "number"
      ? currentState.position
      : Math.max(0, window.history.length - 1);
  window.history.replaceState(
    {
      ...currentState,
      back: null,
      current: fallback,
      forward: route.fullPath,
      position,
      replaced: true,
      scroll: null,
    },
    "",
    fallback,
  );
  window.history.pushState(
    {
      ...currentState,
      back: fallback,
      current: route.fullPath,
      forward: null,
      position: position + 1,
      replaced: false,
      scroll: null,
    },
    "",
    route.fullPath,
  );
  return true;
}

function readBrowserBack(): unknown {
  return typeof window === "undefined" ? null : window.history.state?.back;
}

function asHistoryState(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
