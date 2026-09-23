import { expect, test, type Page } from "@playwright/test";
import {
  createActiveUserViaApi,
  E2E_ACTIVE_PASSWORD,
  loginViaUi,
  uniqueName,
} from "./helpers/e2e";

async function chooseDay(page: Page, label: string, day: number) {
  await page.getByLabel(label).click();
  const dialog = page.getByRole("dialog", { name: "选择日期" });
  await expect(dialog).toBeVisible();
  await dialog
    .locator(".calendar-grid:not(.calendar-weekdays) button")
    .filter({ hasText: new RegExp(`^${day}$`) })
    .click();
  await dialog.getByRole("button", { name: "确定", exact: true }).click();
}

test("行程列表、新建、筛选、详情和返回", async ({ page, request }) => {
  const username = uniqueName("qa_trip_list");
  const title = uniqueName("qa_trip");
  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await page.goto("/trips");
  await expect(page.getByRole("heading", { name: "我的行程" })).toBeVisible();
  await expect(page.getByText("还没有行程")).toBeVisible();
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("目的地").fill("杭州");
  await chooseDay(page, "开始日期", 10);
  await chooseDay(page, "结束日期", 11);
  await page.getByLabel("预算（元，可选）").fill("50.00");
  await page.getByRole("button", { name: "新建行程", exact: true }).click();
  await expect(page.getByText("行程已创建")).toBeVisible();
  await expect(page.getByText("预算 ¥50.00")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
  const userLogin = await request.post("/api/v1/auth/login", {
    data: { password: E2E_ACTIVE_PASSWORD, username },
  });
  const accessToken = (await userLogin.json()).accessToken as string;
  const userResponse = await request.get("/api/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userId = (await userResponse.json()).id as string;
  const tripsResponse = await request.get("/api/v1/trips", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const cachedTrip = (
    (await tripsResponse.json()) as { items: Array<Record<string, unknown>> }
  ).items.find((item) => item.title === title);
  expect(cachedTrip).toBeDefined();
  await page.evaluate(
    async ({ cacheUserId, trip }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open("daily-assistant-sync", 1);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("entities", "readwrite");
        transaction.objectStore("entities").put({
          data: trip,
          entityType: "TRIP",
          id: String(trip.id),
          pending: false,
          updatedAt: String(trip.updatedAt),
          userId: cacheUserId,
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    { cacheUserId: userId, trip: cachedTrip! },
  );
  await page.getByRole("link", { name: "查看" }).click();
  await expect(page).toHaveURL(/\/trips\/[^/]+/);
  const backListResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname.endsWith("/api/v1/trips") &&
      !url.searchParams.has("includeDeleted")
    );
  });
  await page.goBack();
  await expect(page).toHaveURL(/\/trips$/);
  await backListResponse;
  await expect(page.getByText(title)).toBeVisible();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes("/api/v1/trips/"),
  );
  let deleteSucceeded = false;
  let resolvePostDeleteList!: (
    response: import("@playwright/test").Response,
  ) => void;
  const postDeleteListResponse = new Promise<
    import("@playwright/test").Response
  >((resolve) => {
    resolvePostDeleteList = resolve;
  });
  const trackDeleteAndListResponses = (
    response: import("@playwright/test").Response,
  ) => {
    const url = new URL(response.url());
    if (
      response.request().method() === "DELETE" &&
      url.pathname.startsWith("/api/v1/trips/") &&
      response.status() === 204
    ) {
      deleteSucceeded = true;
    } else if (
      deleteSucceeded &&
      response.request().method() === "GET" &&
      url.pathname.endsWith("/api/v1/trips") &&
      !url.searchParams.has("includeDeleted")
    ) {
      resolvePostDeleteList(response);
    }
  };
  page.on("response", trackDeleteAndListResponses);
  await page.getByRole("button", { name: "删除" }).click();
  const deletedResponse = await deleteResponse;
  const activeResponse = await postDeleteListResponse;
  page.off("response", trackDeleteAndListResponses);
  const activeResponseUrl = new URL(activeResponse.url());
  expect(activeResponseUrl.pathname).toBe("/api/v1/trips");
  expect(activeResponseUrl.searchParams.has("includeDeleted")).toBe(false);
  expect(deletedResponse.status()).toBe(204);
  const activeList = (await activeResponse.json()) as {
    items: Array<Record<string, unknown>>;
  };
  expect(activeList.items.some((item) => item.id === cachedTrip!.id)).toBe(
    false,
  );
  await expect(page.getByText(title)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(title)).toHaveCount(0);
  const includeDeletedResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname.endsWith("/api/v1/trips") &&
      url.searchParams.get("includeDeleted") === "true"
    );
  });
  await page.getByLabel("显示已删除").check();
  const deletedList = (await includeDeletedResponse.then((response) =>
    response.json(),
  )) as {
    items: Array<Record<string, unknown>>;
  };
  expect(deletedList.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: cachedTrip!.id,
        deletedAt: expect.any(String),
      }),
    ]),
  );
  await expect(page.getByText("已删除", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "恢复" }).click();
  await expect(page.getByText("行程已恢复")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
  let failOnce = true;
  await page.route("**/api/v1/trips**", async (route) => {
    if (failOnce && route.request().method() === "GET") {
      failOnce = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "暂时不可用" }),
      });
    } else {
      await route.continue();
    }
  });
  await page.getByLabel("显示已删除").uncheck();
  await expect(
    page.getByRole("heading", { name: "行程暂时无法加载" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByText(title)).toBeVisible();
  await page.unrouteAll();
  await page.getByLabel("标题").fill("未保存行程");
  await page.goBack();
  await expect(
    page.getByRole("dialog", { name: "放弃未保存的内容？" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByLabel("标题")).toHaveValue("未保存行程");
  await expect(page).toHaveURL(/\/trips$/);
  for (const size of [16, 32]) {
    await page.evaluate((fontSize) => {
      document.documentElement.style.fontSize = `${fontSize}px`;
    }, size);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  }
});
