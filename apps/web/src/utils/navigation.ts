import {
  useRoute,
  useRouter,
  type LocationQuery,
  type RouteLocationNormalizedLoaded,
  type Router,
} from "vue-router";

export interface PageParent {
  title: string;
  path: string;
}

export interface PageMeta {
  title: string;
  parent?: PageParent;
}

export type PlannerEntity = "task" | "calendar-event" | "reminder";

declare module "vue-router" {
  interface RouteMeta {
    page?: PageMeta;
    plannerEntity?: PlannerEntity;
  }
}

const INTERNAL_ORIGIN = "https://daily-assistant.invalid";
const SCROLL_POSITION_PREFIX = "daily-assistant:scroll:";

export function isInternalPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    hasControlCharacter(value)
  ) {
    return false;
  }

  try {
    return new URL(value, INTERNAL_ORIGIN).origin === INTERNAL_ORIGIN;
  } catch {
    return false;
  }
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function safeReturnTo(
  query: LocationQuery | Record<string, unknown> | undefined,
  fallback: string,
): string {
  const candidate = query?.returnTo;
  return isInternalPath(candidate) ? candidate : fallback;
}

export function resolveReturnTitle(
  router: Router | null,
  target: string,
  fallback: string,
): string {
  if (!router) {
    return fallback;
  }

  try {
    return router.resolve(target).meta.page?.title ?? fallback;
  } catch {
    return fallback;
  }
}

export function appendReturnTo(target: string, source: string): string {
  if (!isInternalPath(target) || !isInternalPath(source)) {
    return target;
  }

  const url = new URL(target, INTERNAL_ORIGIN);
  url.searchParams.set("returnTo", source);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useOptionalRoute(): RouteLocationNormalizedLoaded | null {
  try {
    return useRoute();
  } catch {
    return null;
  }
}

export function useOptionalRouter(): Router | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function saveScrollPosition(path: string, top: number): void {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${SCROLL_POSITION_PREFIX}${path}`,
      String(Math.max(0, Math.round(top))),
    );
  } catch {
    // Storage can be unavailable in privacy mode; navigation still works.
  }
}

export function readScrollPosition(path: string): number | null {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(
      `${SCROLL_POSITION_PREFIX}${path}`,
    );
    if (value === null) {
      return null;
    }
    const top = Number(value);
    return Number.isFinite(top) && top >= 0 ? top : null;
  } catch {
    return null;
  }
}

export function clearScrollPosition(path: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    window.sessionStorage.removeItem(`${SCROLL_POSITION_PREFIX}${path}`);
  } catch {
    // Storage can be unavailable in privacy mode; navigation still works.
  }
}
