import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function chooseDateTime(
  page: Page,
  form: Locator,
  label: string,
  date: string,
  hour: string,
  minute: string,
) {
  await form.getByRole("button", { name: new RegExp(label) }).click();
  const dialog = page.getByRole("dialog", { name: "选择日期和时间" });
  await expect(dialog).toBeVisible();
  const [targetYear, targetMonth, targetDay] = date.split("-").map(Number);
  const heading = dialog.locator(".temporal-picker-heading strong");
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const current = (await heading.innerText()).match(/(\d+)年(\d+)月/);
    if (!current) throw new Error("日期时间选择器未显示当前月份");
    const currentMonth = Number(current[1]) * 12 + Number(current[2]);
    const targetMonthIndex = targetYear! * 12 + targetMonth!;
    if (currentMonth === targetMonthIndex) break;
    await dialog
      .getByRole("button", {
        name: currentMonth < targetMonthIndex ? "下个月" : "上个月",
      })
      .click();
  }
  await expect(heading).toHaveText(`${targetYear}年${targetMonth}月`);
  await dialog
    .locator(".calendar-grid:not(.calendar-weekdays) button")
    .filter({ hasText: new RegExp(`^${targetDay}$`) })
    .click();
  await dialog.getByLabel("小时").selectOption(hour);
  await dialog.getByLabel("分钟").selectOption(minute);
  await dialog.getByRole("button", { name: "确定", exact: true }).click();
  await expect(dialog).toHaveCount(0);
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

test("切换行程详情时隐藏旧数据并在服务失败后恢复", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_trip_detail");
  const titleA = `${"旧行程长标题".repeat(8)} ${uniqueName("a")}`;
  const titleB = `${"新行程长标题".repeat(8)} ${uniqueName("b")}`;
  const destinationB = `${"杭州西湖周边目的地".repeat(8)}`;
  const packingText = `${"长内容行李说明需要自然换行。".repeat(6)}`;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const httpFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (requestEvent) => {
    failedRequests.push(new URL(requestEvent.url()).pathname);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      httpFailures.push(
        `${response.status()} ${new URL(response.url()).pathname}`,
      );
    }
  });

  await createActiveUserViaApi(request, username);
  const login = await request.post("/api/v1/auth/login", {
    data: { password: E2E_ACTIVE_PASSWORD, username },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await login.json()).accessToken as string;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const firstResponse = await request.post("/api/v1/trips", {
    data: {
      budgetAmount: "100.00",
      destination: "上海",
      endDate: "2026-10-03",
      startDate: "2026-10-01",
      title: titleA,
    },
    headers,
  });
  expect(firstResponse.status()).toBe(201);
  const secondResponse = await request.post("/api/v1/trips", {
    data: {
      budgetAmount: "500.00",
      destination: destinationB,
      endDate: "2026-10-05",
      startDate: "2026-10-01",
      title: titleB,
    },
    headers,
  });
  expect(secondResponse.status()).toBe(201);
  const secondTrip = (await secondResponse.json()) as { id: string };
  const packingResponse = await request.post(
    `/api/v1/trips/${secondTrip.id}/packing-items`,
    { data: { text: packingText }, headers },
  );
  expect(packingResponse.status()).toBe(201);

  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await page.goto("/trips");
  const firstTripLink = page.getByRole("link").filter({ hasText: titleA });
  await expect(firstTripLink).toBeVisible();
  await firstTripLink.click();
  await expect(page.getByRole("heading", { name: titleA })).toBeVisible();
  await page.getByRole("button", { name: "返回行程" }).click();
  await expect(page).toHaveURL(/\/trips$/);

  let releaseFailure!: () => void;
  let signalRequest!: () => void;
  const requestArrived = new Promise<void>((resolve) => {
    signalRequest = resolve;
  });
  const holdFailure = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  let failFirstRequest = true;
  const secondDetailPath = `/api/v1/trips/${secondTrip.id}`;
  await page.route(
    (url) => url.pathname === secondDetailPath,
    async (route) => {
      if (failFirstRequest) {
        failFirstRequest = false;
        signalRequest();
        await holdFailure;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "暂时不可用" }),
        });
        return;
      }
      await route.continue();
    },
  );
  await page.getByRole("link").filter({ hasText: titleB }).click();
  await requestArrived;
  try {
    await expect(
      page.getByRole("heading", { name: "正在加载行程" }),
    ).toBeVisible();
    await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "编辑行程" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
  } finally {
    releaseFailure();
  }

  await expect(
    page.getByRole("heading", { name: "行程暂时无法加载" }),
  ).toBeVisible();
  await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByRole("heading", { name: titleB })).toBeVisible();
  await expect(page.getByText(destinationB)).toBeVisible();
  await expect(page.getByText(packingText)).toBeVisible();
  await expect(page.getByText("¥500.00")).toBeVisible();
  await expect(page.getByText("¥0.00")).toBeVisible();

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const scaledOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(scaledOverflow.scrollWidth).toBeLessThanOrEqual(
    scaledOverflow.clientWidth,
  );

  await page.goBack();
  await expect(page).toHaveURL(/\/trips$/);
  await expect(page.getByRole("heading", { name: "我的行程" })).toBeVisible();
  const browserObservation = {
    consoleErrorSummaries: consoleErrors.map((message) =>
      message.replace(/https?:\/\/\S+/g, "<url>").slice(0, 240),
    ),
    failedRequestPaths: failedRequests,
    httpFailures,
    pageErrorNames: pageErrors.map((error) => error.split(":", 1)[0]),
  };
  console.log(`[trip-detail-browser] ${JSON.stringify(browserObservation)}`);
  await test.info().attach("trip-detail-browser-observations.json", {
    body: JSON.stringify(browserObservation),
    contentType: "application/json",
  });
});

test("行程详情本体编辑、删除确认、恢复和浏览器返回", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_trip_actions");
  const originalTitle = uniqueName("trip_action");
  const updatedTitle = `行程编辑长标题${"与响应式换行".repeat(10)} ${uniqueName("edited")}`;
  const longDestination = `杭州目的地${"西湖周边道路与景点".repeat(8)}`;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: Array<{
    error: string | null;
    method: string;
    path: string;
  }> = [];
  const failedDeleteRequests: Array<{
    error: string | null;
    phase: string | null;
  }> = [];
  const httpFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (requestEvent) => {
    failedRequests.push({
      error: requestEvent.failure()?.errorText ?? null,
      method: requestEvent.method(),
      path: new URL(requestEvent.url()).pathname,
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      httpFailures.push(
        `${response.status()} ${new URL(response.url()).pathname}`,
      );
    }
  });

  await createActiveUserViaApi(request, username);
  const login = await request.post("/api/v1/auth/login", {
    data: { password: E2E_ACTIVE_PASSWORD, username },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await login.json()).accessToken as string;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const created = await request.post("/api/v1/trips", {
    data: {
      budgetAmount: "7654321.09",
      destination: "杭州",
      endDate: "2026-10-03",
      startDate: "2026-10-01",
      title: originalTitle,
    },
    headers,
  });
  expect(created.status()).toBe(201);
  const trip = (await created.json()) as { id: string };
  const detailPath = `/api/v1/trips/${trip.id}`;

  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await page.goto("/trips");
  await page.getByRole("link").filter({ hasText: originalTitle }).click();
  await expect(
    page.getByRole("heading", { name: originalTitle }),
  ).toBeVisible();

  await page.getByRole("button", { name: "编辑行程" }).click();
  await page.getByLabel("标题").fill(updatedTitle);
  await page.getByLabel("目的地").fill(longDestination);
  await page.getByLabel("预算（元，可选）").fill("123456.70");

  let failPatchOnce = true;
  const detailRoute = `**${detailPath}`;
  await page.route(detailRoute, async (route) => {
    if (failPatchOnce && route.request().method() === "PATCH") {
      failPatchOnce = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SERVICE_UNAVAILABLE",
          message: "行程保存暂时失败",
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("行程保存暂时失败");
  await expect(page.getByLabel("标题")).toHaveValue(updatedTitle);
  await expect(page.getByLabel("目的地")).toHaveValue(longDestination);
  await page.unroute(detailRoute);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".planner-feedback-success")).toContainText(
    "行程已更新",
  );
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await expect(
    page.getByText("¥123456.70", { exact: true }).first(),
  ).toBeVisible();

  for (const rootFontSize of [16, 32]) {
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`;
    }, rootFontSize);
    const overflow = await page.evaluate(
      () =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) > window.innerWidth,
    );
    expect(overflow).toBe(false);
  }

  let deleteRequests = 0;
  let deletePhase = "confirm-cancel";
  const deleteRequestPhases = new WeakMap<object, string>();
  const deleteResponseStatuses: number[] = [];
  page.on("request", (requestEvent) => {
    if (
      requestEvent.method() === "DELETE" &&
      new URL(requestEvent.url()).pathname === detailPath
    ) {
      deleteRequests += 1;
      deleteRequestPhases.set(requestEvent, deletePhase);
    }
  });
  page.on("requestfailed", (requestEvent) => {
    if (
      requestEvent.method() === "DELETE" &&
      new URL(requestEvent.url()).pathname === detailPath
    ) {
      failedDeleteRequests.push({
        error: requestEvent.failure()?.errorText ?? null,
        phase: deleteRequestPhases.get(requestEvent) ?? null,
      });
    }
  });
  page.on("response", (response) => {
    if (
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === detailPath
    ) {
      deleteResponseStatuses.push(response.status());
    }
  });
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "确认删除这段行程？" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "确认删除这段行程？" })
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(deleteRequests).toBe(0);
  await expect(
    page.getByRole("button", { name: "删除", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "删除", exact: true }).click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === detailPath,
  );
  deletePhase = "confirm-accept";
  await page
    .getByRole("dialog", { name: "确认删除这段行程？" })
    .getByRole("button", { name: "删除行程", exact: true })
    .click();
  expect((await deleteResponse).status()).toBe(204);
  expect(deleteRequests).toBe(1);
  expect(deleteResponseStatuses).toEqual([204]);
  deletePhase = "after-delete-response";
  await expect(
    page.getByText("这段行程已删除，正式数据保留且可以恢复。"),
  ).toBeVisible();
  await expect(page.locator(".planner-feedback-success")).toContainText(
    "行程已删除",
  );
  await expect(page.getByRole("button", { name: "编辑行程" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "删除", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "恢复", exact: true }),
  ).toBeVisible();

  const restorePath = `${detailPath}/restore`;
  let failRestoreOnce = true;
  await page.route(`**${restorePath}`, async (route) => {
    if (failRestoreOnce && route.request().method() === "POST") {
      failRestoreOnce = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SERVICE_UNAVAILABLE",
          message: "恢复暂时失败",
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("恢复暂时失败");
  await expect(page.locator(".trip-detail-deleted-state")).toBeVisible();
  await expect(page.locator(".planner-feedback-success")).toHaveCount(0);
  await page.unroute(`**${restorePath}`);
  const restoreResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === restorePath,
  );
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  expect((await restoreResponse).status()).toBe(200);
  await expect(page.locator(".planner-feedback-success")).toContainText(
    "行程已恢复",
  );
  await expect(page.getByRole("button", { name: "编辑行程" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "删除", exact: true }),
  ).toBeVisible();

  const scaledOverflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) > window.innerWidth,
  );
  expect(scaledOverflow).toBe(false);
  await page.getByRole("button", { name: "编辑行程" }).click();
  const unsavedTitle = `${updatedTitle} 未保存`;
  await page
    .getByRole("textbox", { name: "标题", exact: true })
    .fill(unsavedTitle);
  const editingOverflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) > window.innerWidth,
  );
  expect(editingOverflow).toBe(false);
  await page.goBack();
  const leaveDialog = page.getByRole("dialog", {
    name: "放弃未保存的内容？",
  });
  await expect(leaveDialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/trips/${trip.id}(?:\\?.*)?$`));
  await leaveDialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(leaveDialog).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "标题", exact: true }),
  ).toHaveValue(unsavedTitle);
  await page.goBack();
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "离开", exact: true }).click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "16px";
  });
  await expect(page).toHaveURL(/\/trips$/);
  await expect(page.getByRole("heading", { name: "我的行程" })).toBeVisible();
  expect(pageErrors).toEqual([]);

  const browserObservation = {
    consoleErrorSummaries: consoleErrors.map((message) =>
      message.replace(/https?:\/\/\S+/g, "<url>").slice(0, 240),
    ),
    failedRequestPaths: failedRequests,
    failedDeleteRequests,
    httpFailures,
    pageErrorNames: pageErrors.map((error) => error.split(":", 1)[0]),
  };
  console.log(
    `[trip-detail-actions-browser] ${JSON.stringify(browserObservation)}`,
  );
  await test.info().attach("trip-detail-actions-browser-observations.json", {
    body: JSON.stringify(browserObservation),
    contentType: "application/json",
  });
});

test("行程节点新增、编辑、范围确认、删除恢复和未保存返回", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_trip_nodes");
  const title = uniqueName("trip_nodes");
  const location = `杭州交通枢纽与详细地点${"·西湖周边步行路线".repeat(5)}`;
  const updatedLocation = `${location} · 已编辑`;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const mutationRequests: Array<{ method: string; path: string }> = [];
  const mutationResponses: Array<{
    method: string;
    path: string;
    status: number;
  }> = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (requestEvent) => {
    failedRequests.push(
      `${requestEvent.method()} ${new URL(requestEvent.url()).pathname} ${requestEvent.failure()?.errorText ?? ""}`,
    );
  });
  page.on("request", (requestEvent) => {
    const path = new URL(requestEvent.url()).pathname;
    if (
      ["POST", "PATCH", "DELETE"].includes(requestEvent.method()) &&
      (path.includes("/trip-items") || /\/trips\/[^/]+\/items$/.test(path))
    ) {
      mutationRequests.push({ method: requestEvent.method(), path });
    }
  });
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (
      ["POST", "PATCH", "DELETE"].includes(response.request().method()) &&
      (path.includes("/trip-items") || /\/trips\/[^/]+\/items$/.test(path))
    ) {
      mutationResponses.push({
        method: response.request().method(),
        path,
        status: response.status(),
      });
    }
  });

  await createActiveUserViaApi(request, username);
  const login = await request.post("/api/v1/auth/login", {
    data: { password: E2E_ACTIVE_PASSWORD, username },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await login.json()).accessToken as string;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const createdTrip = await request.post("/api/v1/trips", {
    data: {
      destination: "杭州",
      endDate: "2026-10-03",
      startDate: "2026-10-01",
      title,
    },
    headers,
  });
  expect(createdTrip.status()).toBe(201);
  const tripId = (await createdTrip.json()).id as string;
  const itemCollectionPath = `/api/v1/trips/${tripId}/items`;

  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await page.goto("/trips");
  await page.getByRole("link").filter({ hasText: title }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "新增节点" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "已有节点" })).toBeVisible();
  await expect(
    page.getByText("还没有行程节点。", { exact: true }),
  ).toBeVisible();

  let failCreateOnce = true;
  await page.route(`**${itemCollectionPath}`, async (route) => {
    if (failCreateOnce && route.request().method() === "POST") {
      failCreateOnce = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SERVICE_UNAVAILABLE",
          message: "节点新增暂时失败",
        }),
      });
      return;
    }
    await route.continue();
  });
  const createForm = page.locator(
    'form[aria-labelledby="trip-node-create-title"]',
  );
  await createForm.getByLabel("类型").selectOption("TRANSPORT");
  await chooseDateTime(page, createForm, "开始时间", "2026-10-02", "10", "30");
  await chooseDateTime(page, createForm, "结束时间", "2026-10-02", "11", "30");
  await createForm.getByLabel("地点（可选）").fill(location);
  await createForm.getByRole("button", { name: "添加节点" }).click();
  await expect(page.getByRole("alert")).toContainText("节点新增暂时失败");
  await expect(createForm.getByLabel("地点（可选）")).toHaveValue(location);
  await expect(createForm.getByLabel("类型")).toHaveValue("TRANSPORT");
  await page.unroute(`**${itemCollectionPath}`);
  const firstCreateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === itemCollectionPath,
  );
  await createForm.getByRole("button", { name: "添加节点" }).click();
  const firstCreate = await firstCreateResponse;
  expect(firstCreate.status()).toBe(201);
  const firstItemId = (
    (await firstCreate.json()) as { tripItem: { id: string } }
  ).tripItem.id;
  const firstCard = page.locator(`[data-node-id="${firstItemId}"]`);
  await expect(firstCard).toContainText("交通");
  await expect(firstCard).toContainText(location);
  await expect(firstCard).toContainText("10/02 10:30");
  await expect(firstCard).toContainText("10/02 11:30");

  let failUpdateOnce = true;
  const itemPath = `/api/v1/trip-items/${firstItemId}`;
  await page.route(`**${itemPath}`, async (route) => {
    if (failUpdateOnce && route.request().method() === "PATCH") {
      failUpdateOnce = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SERVICE_UNAVAILABLE",
          message: "节点编辑暂时失败",
        }),
      });
      return;
    }
    await route.continue();
  });
  await firstCard.getByRole("button", { name: "编辑节点" }).click();
  const editForm = firstCard.locator("form.trip-node-form");
  await editForm.getByLabel("地点").fill(updatedLocation);
  await editForm.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("节点编辑暂时失败");
  await expect(editForm.getByLabel("地点")).toHaveValue(updatedLocation);
  await page.unroute(`**${itemPath}`);
  const editResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === itemPath,
  );
  await editForm.getByRole("button", { name: "保存", exact: true }).click();
  expect((await editResponse).status()).toBe(200);
  await expect(firstCard).toContainText(updatedLocation);
  await expect(
    firstCard.getByRole("button", { name: "编辑节点" }),
  ).toBeVisible();

  const outOfRangeLocation = "确认后保存的超范围节点";
  await createForm.getByLabel("类型").selectOption("OTHER");
  await chooseDateTime(page, createForm, "开始时间", "2026-10-04", "10", "00");
  await chooseDateTime(page, createForm, "结束时间", "2026-10-04", "11", "00");
  await createForm.getByLabel("地点（可选）").fill(outOfRangeLocation);
  const outOfRangeAttempt = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === itemCollectionPath,
  );
  await createForm.getByRole("button", { name: "添加节点" }).click();
  expect((await outOfRangeAttempt).status()).toBe(400);
  await expect(page.getByRole("alert")).toContainText(
    "节点时间超出行程日期范围",
  );
  await page
    .locator(".trip-node-section .warning-banner")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(page.locator(".trip-node-section .warning-banner")).toHaveCount(
    0,
  );
  await expect(createForm.getByLabel("地点（可选）")).toHaveValue(
    outOfRangeLocation,
  );
  expect(
    mutationRequests.filter(
      ({ method, path }) => method === "POST" && path === itemCollectionPath,
    ),
  ).toHaveLength(3);

  const secondOutOfRangeAttempt = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === itemCollectionPath,
  );
  await createForm.getByRole("button", { name: "添加节点" }).click();
  expect((await secondOutOfRangeAttempt).status()).toBe(400);
  const confirmedCreateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === itemCollectionPath &&
      response.request().postDataJSON()?.confirmOutOfRange === true,
  );
  await page
    .locator(".trip-node-section .warning-banner")
    .getByRole("button", { name: "仍要保存", exact: true })
    .click();
  const confirmedCreate = await confirmedCreateResponse;
  expect(confirmedCreate.status()).toBe(201);
  const outOfRangeItemId = (
    (await confirmedCreate.json()) as { tripItem: { id: string } }
  ).tripItem.id;
  await expect(
    page.locator(`[data-node-id="${outOfRangeItemId}"]`),
  ).toContainText(outOfRangeLocation);

  const deletePath = itemPath;
  const deleteResponsePath = (response: import("@playwright/test").Response) =>
    response.request().method() === "DELETE" &&
    new URL(response.url()).pathname === deletePath;
  await firstCard.getByRole("button", { name: "删除节点" }).click();
  const deleteDialog = page.getByRole("dialog", {
    name: "确认删除这个行程节点？",
  });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toContainText("刷新或重新进入行程后仍可恢复");
  await deleteDialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(deleteDialog).toHaveCount(0);
  expect(
    mutationRequests.filter(({ method }) => method === "DELETE"),
  ).toHaveLength(0);
  await expect(
    firstCard.getByRole("button", { name: "删除节点" }),
  ).toBeVisible();

  const deleteResponse = page.waitForResponse(deleteResponsePath);
  await firstCard.getByRole("button", { name: "删除节点" }).click();
  await page
    .getByRole("dialog", { name: "确认删除这个行程节点？" })
    .getByRole("button", { name: "删除节点", exact: true })
    .click();
  expect((await deleteResponse).status()).toBe(204);
  await expect(firstCard).toContainText("已删除");
  await expect(firstCard.getByRole("button", { name: "编辑节点" })).toHaveCount(
    0,
  );
  await expect(firstCard.getByRole("button", { name: "删除节点" })).toHaveCount(
    0,
  );

  let failRestoreOnce = true;
  const restorePath = `${itemPath}/restore`;
  await page.route(`**${restorePath}`, async (route) => {
    if (failRestoreOnce && route.request().method() === "POST") {
      failRestoreOnce = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SERVICE_UNAVAILABLE",
          message: "节点恢复暂时失败",
        }),
      });
      return;
    }
    await route.continue();
  });
  await firstCard.getByRole("button", { name: "恢复节点" }).click();
  await expect(page.getByRole("alert")).toContainText("节点恢复暂时失败");
  await expect(firstCard).toContainText("已删除");
  await page.unroute(`**${restorePath}`);
  const restoreResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === restorePath,
  );
  await firstCard.getByRole("button", { name: "恢复节点" }).click();
  expect((await restoreResponse).status()).toBe(200);
  await expect(
    firstCard.getByRole("button", { name: "编辑节点" }),
  ).toBeVisible();
  await expect(page.locator(".trip-node-section [role=status]")).toContainText(
    "节点已恢复",
  );

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const overflowAt200Percent = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) > window.innerWidth,
  );
  expect(overflowAt200Percent).toBe(false);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "16px";
  });

  await createForm.getByLabel("地点（可选）").fill("未保存的节点草稿");
  await page.goBack();
  const leaveDialog = page.getByRole("dialog", {
    name: "放弃未保存的内容？",
  });
  await expect(leaveDialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}(?:\\?.*)?$`));
  await leaveDialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(createForm.getByLabel("地点（可选）")).toHaveValue(
    "未保存的节点草稿",
  );
  await page.goBack();
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "离开", exact: true }).click();
  await expect(page).toHaveURL(/\/trips$/);

  expect(pageErrors).toEqual([]);
  const browserObservation = {
    consoleErrors: consoleErrors.map((message) =>
      message.replace(/https?:\/\/\S+/g, "<url>").slice(0, 240),
    ),
    failedRequests,
    mutationRequests,
    mutationResponses,
    pageErrors: pageErrors.map((error) => error.split(":", 1)[0]),
    viewport: await page.evaluate(() => ({
      height: window.innerHeight,
      width: window.innerWidth,
    })),
  };
  console.log(`[trip-nodes-browser] ${JSON.stringify(browserObservation)}`);
  await test.info().attach("trip-nodes-browser-observations.json", {
    body: JSON.stringify(browserObservation),
    contentType: "application/json",
  });
});

test("行李清单新增、编辑、勾选、删除确认、恢复与返回保护", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_trip_packing");
  const title = uniqueName("trip_packing");
  const longText = `防水外套与备用电池${"·轻装行程所需物品备注".repeat(7)}`;
  const editedText = `${longText}·已复核`;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const mutationRequests: Array<{
    method: string;
    path: string;
    payload?: unknown;
  }> = [];
  const mutationResponses: Array<{
    method: string;
    path: string;
    status: number;
  }> = [];
  const httpFailures: Array<{ method: string; path: string; status: number }> =
    [];
  const focusedFailureViewport = [390, 1440].includes(
    page.viewportSize()?.width ?? 0,
  );

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (requestEvent) => {
    failedRequests.push(
      `${requestEvent.method()} ${new URL(requestEvent.url()).pathname} ${requestEvent.failure()?.errorText ?? ""}`,
    );
  });
  page.on("request", (requestEvent) => {
    const path = new URL(requestEvent.url()).pathname;
    if (
      path.includes("/packing-items") &&
      ["POST", "PATCH", "DELETE"].includes(requestEvent.method())
    ) {
      let payload: unknown;
      try {
        payload = requestEvent.postDataJSON();
      } catch {
        payload = undefined;
      }
      mutationRequests.push({
        method: requestEvent.method(),
        path,
        payload,
      });
    }
  });
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    const method = response.request().method();
    if (
      path.includes("/packing-items") &&
      ["POST", "PATCH", "DELETE"].includes(method)
    ) {
      mutationResponses.push({ method, path, status: response.status() });
    }
    if (response.status() >= 400) {
      httpFailures.push({ method, path, status: response.status() });
    }
  });

  await createActiveUserViaApi(request, username);
  const login = await request.post("/api/v1/auth/login", {
    data: { password: E2E_ACTIVE_PASSWORD, username },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await login.json()).accessToken as string;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const tripResponse = await request.post("/api/v1/trips", {
    data: {
      destination: "杭州",
      endDate: "2026-10-03",
      startDate: "2026-10-01",
      title,
    },
    headers,
  });
  expect(tripResponse.status()).toBe(201);
  const tripId = (await tripResponse.json()).id as string;
  const collectionPath = `/api/v1/trips/${tripId}/packing-items`;

  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await page.goto("/trips");
  await expect(page.getByRole("heading", { name: "我的行程" })).toBeVisible();
  await page.getByRole("link").filter({ hasText: title }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "新增行李项" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "清单项目" })).toBeVisible();

  let failCreateOnce = focusedFailureViewport;
  if (failCreateOnce) {
    await page.route(`**${collectionPath}`, async (route) => {
      if (route.request().method() === "POST" && failCreateOnce) {
        failCreateOnce = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "SERVICE_UNAVAILABLE",
            message: "行李项新增暂时失败",
          }),
        });
        return;
      }
      await route.continue();
    });
  }
  const createForm = page.locator(
    'form[aria-labelledby="trip-packing-create-title"]',
  );
  const createInput = createForm.getByRole("textbox", {
    name: "物品名称或备注",
  });
  await createInput.fill(longText);
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === collectionPath,
  );
  await createForm.getByRole("button", { name: "添加行李项" }).click();
  const firstCreateResponse = await createResponsePromise;
  if (focusedFailureViewport) {
    expect(firstCreateResponse.status()).toBe(503);
    await expect(
      page.locator(".trip-packing-section").getByRole("alert"),
    ).toContainText("行李项新增暂时失败");
    await expect(createInput).toHaveValue(longText);
    await page.unroute(`**${collectionPath}`);
    const retryCreateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === collectionPath,
    );
    await createForm.getByRole("button", { name: "添加行李项" }).click();
    expect((await retryCreateResponsePromise).status()).toBe(201);
  } else {
    expect(firstCreateResponse.status()).toBe(201);
  }

  let card = page.locator(".trip-packing-list > li").first();
  await expect(card).toContainText(longText);
  await expect(card.getByRole("checkbox")).toBeVisible();
  await expect(card.locator(".trip-packing-state")).toHaveText("待整理");
  const createPayload = mutationRequests.find(
    ({ method, path }) => method === "POST" && path === collectionPath,
  )?.payload as { text?: string } | undefined;
  expect(createPayload?.text).toBe(longText);

  const itemCollectionAfterCreate = await request.get(
    `/api/v1/trips/${tripId}`,
    { headers },
  );
  expect(itemCollectionAfterCreate.ok()).toBeTruthy();
  const packingId = (await itemCollectionAfterCreate.json()).packingItems[0]
    .id as string;
  const itemPath = `/api/v1/packing-items/${packingId}`;

  let failEditOnce = focusedFailureViewport;
  if (failEditOnce) {
    await page.route(`**${itemPath}`, async (route) => {
      if (route.request().method() === "PATCH" && failEditOnce) {
        failEditOnce = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "SERVICE_UNAVAILABLE",
            message: "行李项编辑暂时失败",
          }),
        });
        return;
      }
      await route.continue();
    });
  }
  await card.getByRole("button", { name: "编辑行李项" }).click();
  const editForm = card.locator("form.trip-packing-edit-form");
  const editInput = editForm.getByRole("textbox", { name: "物品名称或备注" });
  await editInput.fill(editedText);
  const editResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === itemPath,
  );
  await editForm.getByRole("button", { name: "保存", exact: true }).click();
  const firstEditResponse = await editResponsePromise;
  if (focusedFailureViewport) {
    expect(firstEditResponse.status()).toBe(503);
    await expect(
      page.locator(".trip-packing-section").getByRole("alert"),
    ).toContainText("行李项编辑暂时失败");
    await expect(editInput).toHaveValue(editedText);
    await page.unroute(`**${itemPath}`);
    const retryEditResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === itemPath,
    );
    await editForm.getByRole("button", { name: "保存", exact: true }).click();
    expect((await retryEditResponsePromise).status()).toBe(200);
  } else {
    expect(firstEditResponse.status()).toBe(200);
  }
  card = page.locator(`[data-packing-id="${packingId}"]`);
  await expect(card).toContainText(editedText);
  const editPayload = mutationRequests.find(
    ({ method, path, payload }) =>
      method === "PATCH" &&
      path === itemPath &&
      (payload as { text?: string } | undefined)?.text === editedText,
  )?.payload as { text?: string; version?: number } | undefined;
  expect(editPayload).toMatchObject({ text: editedText, version: 1 });

  let failCheckOnce = focusedFailureViewport;
  if (failCheckOnce) {
    await page.route(`**${itemPath}`, async (route) => {
      if (route.request().method() === "PATCH" && failCheckOnce) {
        failCheckOnce = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "SERVICE_UNAVAILABLE",
            message: "行李项状态更新暂时失败",
          }),
        });
        return;
      }
      await route.continue();
    });
  }
  const checkbox = card.getByRole("checkbox");
  const checkResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === itemPath,
  );
  await checkbox.click();
  const firstCheckResponse = await checkResponsePromise;
  if (focusedFailureViewport) {
    expect(firstCheckResponse.status()).toBe(503);
    await expect(
      page.locator(".trip-packing-section").getByRole("alert"),
    ).toContainText("行李项状态更新暂时失败");
    await expect(checkbox).not.toBeChecked();
    await page.unroute(`**${itemPath}`);
    const retryCheckResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === itemPath,
    );
    await checkbox.click();
    expect((await retryCheckResponsePromise).status()).toBe(200);
  } else {
    expect(firstCheckResponse.status()).toBe(200);
  }
  await expect(card.getByRole("checkbox")).toBeChecked();
  await expect(card.locator(".trip-packing-state")).toHaveText("已收纳");
  const checkPayload = mutationRequests.find(
    ({ method, path, payload }) =>
      method === "PATCH" &&
      path === itemPath &&
      (payload as { checked?: boolean } | undefined)?.checked === true,
  )?.payload as { checked?: boolean; version?: number } | undefined;
  expect(checkPayload).toMatchObject({ checked: true, version: 2 });

  let failDeleteOnce = focusedFailureViewport;
  if (failDeleteOnce) {
    await page.route(`**${itemPath}`, async (route) => {
      if (route.request().method() === "DELETE" && failDeleteOnce) {
        failDeleteOnce = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "SERVICE_UNAVAILABLE",
            message: "行李项删除暂时失败",
          }),
        });
        return;
      }
      await route.continue();
    });
  }
  const deleteCountBeforeCancel = mutationRequests.filter(
    ({ method, path }) => method === "DELETE" && path === itemPath,
  ).length;
  await card.getByRole("button", { name: "删除行李项" }).click();
  const deleteDialog = page.getByRole("dialog", {
    name: "确认删除这个行李项？",
  });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toContainText("刷新或重新进入行程后仍可恢复");
  await deleteDialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(deleteDialog).toHaveCount(0);
  expect(
    mutationRequests.filter(
      ({ method, path }) => method === "DELETE" && path === itemPath,
    ),
  ).toHaveLength(deleteCountBeforeCancel);
  await expect(card.getByRole("button", { name: "删除行李项" })).toBeVisible();

  const deleteResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === itemPath,
  );
  await card.getByRole("button", { name: "删除行李项" }).click();
  await page
    .getByRole("dialog", { name: "确认删除这个行李项？" })
    .getByRole("button", { name: "删除行李项", exact: true })
    .click();
  const firstDeleteResponse = await deleteResponsePromise;
  if (focusedFailureViewport) {
    expect(firstDeleteResponse.status()).toBe(503);
    await expect(
      page.locator(".trip-packing-section").getByRole("alert"),
    ).toContainText("行李项删除暂时失败");
    await expect(
      card.getByRole("button", { name: "删除行李项" }),
    ).toBeVisible();
    await page.unroute(`**${itemPath}`);
    const retryDeleteResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname === itemPath,
    );
    await card.getByRole("button", { name: "删除行李项" }).click();
    await page
      .getByRole("dialog", { name: "确认删除这个行李项？" })
      .getByRole("button", { name: "删除行李项", exact: true })
      .click();
    expect((await retryDeleteResponsePromise).status()).toBe(204);
  } else {
    expect(firstDeleteResponse.status()).toBe(204);
  }
  card = page.locator(`[data-packing-id="${packingId}"]`);
  await expect(card).toContainText("已删除 · 可恢复");
  await expect(card.getByRole("button", { name: "编辑行李项" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "删除行李项" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "恢复行李项" })).toBeVisible();
  await expect(page.locator(".trip-packing-recovery-note")).toContainText(
    "刷新或重新进入行程后继续恢复",
  );

  const restorePath = `${itemPath}/restore`;
  let failRestoreOnce = focusedFailureViewport;
  if (failRestoreOnce) {
    await page.route(`**${restorePath}`, async (route) => {
      if (route.request().method() === "POST" && failRestoreOnce) {
        failRestoreOnce = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "SERVICE_UNAVAILABLE",
            message: "行李项恢复暂时失败",
          }),
        });
        return;
      }
      await route.continue();
    });
  }
  const restoreResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === restorePath,
  );
  await card.getByRole("button", { name: "恢复行李项" }).click();
  const firstRestoreResponse = await restoreResponsePromise;
  if (focusedFailureViewport) {
    expect(firstRestoreResponse.status()).toBe(503);
    await expect(
      page.locator(".trip-packing-section").getByRole("alert"),
    ).toContainText("行李项恢复暂时失败");
    await expect(card).toContainText("已删除 · 可恢复");
    await page.unroute(`**${restorePath}`);
    const retryRestoreResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === restorePath,
    );
    await card.getByRole("button", { name: "恢复行李项" }).click();
    expect((await retryRestoreResponsePromise).status()).toBe(200);
  } else {
    expect(firstRestoreResponse.status()).toBe(200);
  }
  card = page.locator(`[data-packing-id="${packingId}"]`);
  await expect(card.getByRole("checkbox")).toBeChecked();
  await expect(card.getByRole("button", { name: "编辑行李项" })).toBeVisible();
  await expect(card.getByRole("button", { name: "恢复行李项" })).toHaveCount(0);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const overflowAt200Percent = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) > window.innerWidth,
  );
  expect(overflowAt200Percent).toBe(false);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "16px";
  });
  await page
    .getByRole("textbox", { name: "物品名称或备注" })
    .fill("离开保护草稿");
  await page.goBack();
  const leaveDialog = page.getByRole("dialog", { name: "放弃未保存的内容？" });
  await expect(leaveDialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}(?:\\?.*)?$`));
  await leaveDialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(leaveDialog).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "物品名称或备注" }),
  ).toHaveValue("离开保护草稿");
  await page.goBack();
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "离开", exact: true }).click();
  await expect(page).toHaveURL(/\/trips$/);

  const browserObservation = {
    consoleErrors: consoleErrors.map((message) =>
      message.replace(/https?:\/\/\S+/g, "<url>").slice(0, 240),
    ),
    failedRequests,
    httpFailures,
    mutationRequests,
    mutationResponses,
    pageErrors: pageErrors.map((error) => error.split(":", 1)[0]),
    viewport: page.viewportSize(),
  };
  console.log(`[trip-packing-browser] ${JSON.stringify(browserObservation)}`);
  await test.info().attach("trip-packing-browser-observations.json", {
    body: JSON.stringify(browserObservation),
    contentType: "application/json",
  });
  expect(pageErrors).toEqual([]);
});

test("删除的行程节点和行李项跨刷新仍可恢复", async ({ page, request }) => {
  const username = uniqueName("qa_trip_child_restore");
  const title = uniqueName("子项恢复行程");
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: Array<{
    error: string | null;
    method: string;
    path: string;
  }> = [];
  const detailQueries: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (requestEvent) => {
    failedRequests.push({
      error: requestEvent.failure()?.errorText ?? null,
      method: requestEvent.method(),
      path: new URL(requestEvent.url()).pathname,
    });
  });

  await createActiveUserViaApi(request, username);
  const login = await request.post("/api/v1/auth/login", {
    data: { password: E2E_ACTIVE_PASSWORD, username },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await login.json()).accessToken as string;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const tripResponse = await request.post("/api/v1/trips", {
    data: {
      destination: "杭州",
      endDate: "2026-10-03",
      startDate: "2026-10-01",
      title,
    },
    headers,
  });
  expect(tripResponse.status()).toBe(201);
  const tripId = (await tripResponse.json()).id as string;
  const nodeResponse = await request.post(`/api/v1/trips/${tripId}/items`, {
    data: {
      endsAt: "2026-10-01T03:00:00.000Z",
      location: "湖滨步行街",
      startsAt: "2026-10-01T02:00:00.000Z",
      type: "ACTIVITY",
    },
    headers,
  });
  expect(nodeResponse.status()).toBe(201);
  const nodeId = (await nodeResponse.json()).tripItem.id as string;
  const packingResponse = await request.post(
    `/api/v1/trips/${tripId}/packing-items`,
    { data: { text: "需要跨刷新恢复的行李" }, headers },
  );
  expect(packingResponse.status()).toBe(201);
  const packingId = (await packingResponse.json()).id as string;

  const detailPath = `/api/v1/trips/${tripId}`;
  page.on("request", (requestEvent) => {
    const url = new URL(requestEvent.url());
    if (requestEvent.method() === "GET" && url.pathname === detailPath) {
      detailQueries.push(url.searchParams.get("includeDeletedChildren") ?? "");
    }
  });
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  const initialDetail = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === detailPath,
  );
  await page.goto(`/trips/${tripId}`);
  expect((await initialDetail).status()).toBe(200);
  expect(detailQueries.at(-1)).toBe("true");

  const nodeCard = page.locator(`[data-node-id="${nodeId}"]`);
  await expect(
    nodeCard.getByRole("button", { name: "编辑节点" }),
  ).toBeVisible();
  const deleteNodeResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === `/api/v1/trip-items/${nodeId}`,
  );
  await nodeCard.getByRole("button", { name: "删除节点" }).click();
  const nodeDialog = page.getByRole("dialog", {
    name: "确认删除这个行程节点？",
  });
  await nodeDialog
    .getByRole("button", { name: "删除节点", exact: true })
    .click();
  expect((await deleteNodeResponse).status()).toBe(204);
  await expect(nodeCard).toContainText("已删除");
  await expect(nodeCard.getByRole("button", { name: "编辑节点" })).toHaveCount(
    0,
  );
  await expect(nodeCard.getByRole("button", { name: "删除节点" })).toHaveCount(
    0,
  );
  await expect(
    nodeCard.getByRole("button", { name: "恢复节点" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "返回行程" }).click();
  await expect(page).toHaveURL(/\/trips$/);
  const afterNodeReentry = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === detailPath &&
      new URL(response.url()).searchParams.get("includeDeletedChildren") ===
        "true",
  );
  await page.getByRole("link").filter({ hasText: title }).click();
  expect((await afterNodeReentry).status()).toBe(200);
  expect(detailQueries.at(-1)).toBe("true");
  const reloadedNode = page.locator(`[data-node-id="${nodeId}"]`);
  await expect(reloadedNode).toContainText("已删除");
  await expect(
    reloadedNode.getByRole("button", { name: "编辑节点" }),
  ).toHaveCount(0);
  await expect(
    reloadedNode.getByRole("button", { name: "删除节点" }),
  ).toHaveCount(0);
  const restoreNodeResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/v1/trip-items/${nodeId}/restore`,
  );
  await reloadedNode.getByRole("button", { name: "恢复节点" }).click();
  expect((await restoreNodeResponse).status()).toBe(200);
  await expect(page.locator(`[data-node-id="${nodeId}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-node-id="${nodeId}"]`)).not.toContainText(
    "已删除",
  );
  await expect(
    page.locator(`[data-node-id="${nodeId}"]`).getByRole("button", {
      name: "编辑节点",
    }),
  ).toBeVisible();

  const packingCard = page.locator(`[data-packing-id="${packingId}"]`);
  await expect(packingCard.getByRole("checkbox")).toBeVisible();
  const deletePackingResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === `/api/v1/packing-items/${packingId}`,
  );
  await packingCard.getByRole("button", { name: "删除行李项" }).click();
  const packingDialog = page.getByRole("dialog", {
    name: "确认删除这个行李项？",
  });
  await packingDialog
    .getByRole("button", { name: "删除行李项", exact: true })
    .click();
  expect((await deletePackingResponse).status()).toBe(204);
  await expect(packingCard).toContainText("已删除 · 可恢复");
  await expect(packingCard.getByRole("checkbox")).toHaveCount(0);
  await expect(
    packingCard.getByRole("button", { name: "编辑行李项" }),
  ).toHaveCount(0);
  await expect(
    packingCard.getByRole("button", { name: "删除行李项" }),
  ).toHaveCount(0);

  const afterPackingReload = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === detailPath,
  );
  await page.reload();
  expect((await afterPackingReload).status()).toBe(200);
  expect(detailQueries.at(-1)).toBe("true");
  const reloadedPacking = page.locator(`[data-packing-id="${packingId}"]`);
  await expect(reloadedPacking).toContainText("已删除 · 可恢复");
  await expect(reloadedPacking.getByRole("checkbox")).toHaveCount(0);
  const restorePackingResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/v1/packing-items/${packingId}/restore`,
  );
  await reloadedPacking.getByRole("button", { name: "恢复行李项" }).click();
  expect((await restorePackingResponse).status()).toBe(200);
  await expect(page.locator(`[data-packing-id="${packingId}"]`)).toHaveCount(1);
  await expect(
    page.locator(`[data-packing-id="${packingId}"]`),
  ).not.toContainText("已删除 · 可恢复");
  await expect(
    page.locator(`[data-packing-id="${packingId}"]`).getByRole("checkbox"),
  ).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(pageErrors).toEqual([]);
  console.log(
    `[trip-child-restore-browser] ${JSON.stringify({
      consoleErrors: consoleErrors.map((message) =>
        message.replace(/https?:\/\/\S+/g, "<url>").slice(0, 200),
      ),
      detailQueries,
      failedRequests,
      pageErrors: pageErrors.map((error) => error.split(":", 1)[0]),
      viewport: page.viewportSize(),
    })}`,
  );
});
