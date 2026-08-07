import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const ADMIN_URL = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:5174";
export const E2E_ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD ?? "E2eAdminPassword123!";
export const E2E_ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "e2eadmin";
export const E2E_USER_PASSWORD =
  process.env.E2E_USER_PASSWORD ?? "E2eUserPassword123!";
export const E2E_ACTIVE_PASSWORD =
  process.env.E2E_ACTIVE_PASSWORD ?? "E2eActivePassword123!";

let cachedAdminToken: string | null = null;
let cachedAdminTokenAt = 0;

export function uniqueName(prefix: string): string {
  const suffix =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `${prefix}_${suffix}`.slice(0, 32);
}

export async function adminAccessToken(
  request: APIRequestContext,
): Promise<string> {
  if (cachedAdminToken && Date.now() - cachedAdminTokenAt < 10 * 60_000) {
    return cachedAdminToken;
  }
  const response = await request.post("/api/v1/auth/login", {
    data: {
      password: E2E_ADMIN_PASSWORD,
      username: E2E_ADMIN_USERNAME,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { accessToken: string };
  cachedAdminToken = body.accessToken;
  cachedAdminTokenAt = Date.now();
  return body.accessToken;
}

export async function createUserViaApi(
  request: APIRequestContext,
  username: string,
  options: { displayName?: string; password?: string } = {},
): Promise<void> {
  const token = await adminAccessToken(request);
  const response = await request.post("/api/v1/admin/users", {
    data: {
      displayName: options.displayName ?? "E2E User",
      initialPassword: options.password ?? E2E_USER_PASSWORD,
      reason: "e2e test setup",
      username,
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(201);
}

export async function createActiveUserViaApi(
  request: APIRequestContext,
  username: string,
): Promise<void> {
  await createUserViaApi(request, username);
  const login = await request.post("/api/v1/auth/login", {
    data: { password: E2E_USER_PASSWORD, username },
  });
  expect(login.ok()).toBeTruthy();
  const body = (await login.json()) as { accessToken: string };
  const changed = await request.post("/api/v1/me/change-password", {
    data: {
      currentPassword: E2E_USER_PASSWORD,
      newPassword: E2E_ACTIVE_PASSWORD,
    },
    headers: { Authorization: `Bearer ${body.accessToken}` },
  });
  expect(changed.ok()).toBeTruthy();
}

export async function loginViaUi(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
}

export function navLink(page: Page, name: string) {
  return page
    .getByRole("link", { name, exact: true })
    .filter({ visible: true });
}

export async function adminLoginViaUi(
  page: Page,
  username = E2E_ADMIN_USERNAME,
  password = E2E_ADMIN_PASSWORD,
): Promise<void> {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL("**/dashboard");
}

export function shanghaiLocalInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(date);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${byType.year}-${byType.month}-${byType.day}T${byType.hour}:${byType.minute}`;
}

export async function expectNoBlockingErrors(page: Page): Promise<void> {
  const blocking: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      blocking.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    blocking.push(String(error));
  });
  await page.waitForTimeout(500);
  const unexpected = blocking.filter((text) =>
    /Access token is required|401|CORS|NetworkError|Failed to fetch/i.test(
      text,
    ),
  );
  expect(unexpected).toEqual([]);
}
