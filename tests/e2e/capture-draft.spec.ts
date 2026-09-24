import { expect, test, type APIRequestContext } from "@playwright/test";

import {
  createActiveUserViaApi,
  E2E_ACTIVE_PASSWORD,
  loginViaUi,
  uniqueName,
} from "./helpers/e2e";

interface E2eTransaction {
  amount: string;
  merchant: string | null;
  type: "EXPENSE" | "INCOME" | "REFUND";
}

test("V2 Capture 真实财务草稿确认入账且不重复", async ({ page, request }) => {
  const username = uniqueName("qa_capture");
  const marker = ("CaptureQA" + uniqueName("M").replace(/[^a-z]/gi, "")).slice(
    0,
    40,
  );
  const input = "今天 " + marker + " 38.50元";
  const note = "V2 Capture real integration";
  const blocking: string[] = [];
  let parseRequests = 0;
  let updateRequests = 0;
  let confirmRequests = 0;

  page.on("console", (message) => {
    if (message.type() === "error") blocking.push(message.text());
  });
  page.on("pageerror", (error) => blocking.push(String(error)));
  page.on("request", (requestEvent) => {
    const pathname = new URL(requestEvent.url()).pathname;
    if (
      requestEvent.method() === "POST" &&
      pathname.endsWith("/api/v1/drafts/parse-text")
    )
      parseRequests += 1;
    if (
      requestEvent.method() === "PATCH" &&
      pathname.includes("/api/v1/drafts/")
    )
      updateRequests += 1;
    if (
      requestEvent.method() === "POST" &&
      pathname.includes("/api/v1/drafts/") &&
      pathname.endsWith("/confirm")
    )
      confirmRequests += 1;
  });

  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  expect(await matchingTransactions(request, username, marker)).toHaveLength(0);

  await page.goto("/capture");
  await expect(page.getByRole("heading", { name: "快速记录" })).toBeVisible();
  await page.getByLabel("记录内容").fill(input);
  const parseResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/v1/drafts/parse-text") &&
      response.ok(),
  );
  await Promise.all([
    parseResponse,
    page.getByRole("button", { name: "生成待确认草稿" }).click(),
  ]);
  const parsed = (await parseResponse).json() as Promise<{
    draft: { id: string };
  }>;
  const draftId = (await parsed).draft.id;
  expect(draftId).toBeTruthy();
  await expect(
    page.getByText("草稿已生成，尚未入账。请到草稿中心核对并确认。"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "去草稿中心核对" }),
  ).toBeVisible();
  expect(await matchingTransactions(request, username, marker)).toHaveLength(0);

  await page.getByRole("link", { name: "去草稿中心核对" }).click();
  await page.waitForURL(/\/drafts(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "草稿中心" })).toBeVisible();
  const draftCard = page
    .locator("article.draft-card")
    .filter({ hasText: "文本解析" });
  await expect(draftCard).toHaveCount(1);
  await expect(draftCard.getByText("待确认", { exact: true })).toBeVisible();
  await expect(draftCard.getByLabel("金额")).toHaveValue("38.50");
  await expect(draftCard.getByLabel("商户")).toHaveValue(marker);

  const noteField = draftCard.getByLabel("备注");
  await noteField.fill(note);
  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === "/api/v1/drafts/" + draftId &&
      response.ok(),
  );
  await Promise.all([
    updateResponse,
    draftCard.getByRole("button", { name: "保存修改", exact: true }).click(),
  ]);
  await expect(noteField).toHaveValue(note);

  await page.reload();
  const reloadedDraftCard = page
    .locator("article.draft-card")
    .filter({ hasText: "文本解析" });
  await expect(reloadedDraftCard).toHaveCount(1);
  await expect(
    reloadedDraftCard.getByText("待确认", { exact: true }),
  ).toBeVisible();
  await expect(reloadedDraftCard.getByLabel("金额")).toHaveValue("38.50");
  await expect(reloadedDraftCard.getByLabel("商户")).toHaveValue(marker);
  await expect(reloadedDraftCard.getByLabel("备注")).toHaveValue(note);
  expect(await matchingTransactions(request, username, marker)).toHaveLength(0);

  const confirmResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        "/api/v1/drafts/" + draftId + "/confirm" &&
      response.ok(),
  );
  await Promise.all([
    confirmResponse,
    reloadedDraftCard
      .getByRole("button", { name: "确认入账", exact: true })
      .click(),
  ]);
  expect((await confirmResponse).status()).toBe(201);
  await expect(page.locator("article.draft-card")).toHaveCount(0);
  const confirmedTransactions = await matchingTransactions(
    request,
    username,
    marker,
  );
  expect(confirmedTransactions).toHaveLength(1);
  expect(confirmedTransactions[0]).toMatchObject({
    amount: "38.50",
    merchant: marker,
    type: "EXPENSE",
  });
  expect(parseRequests).toBe(1);
  expect(updateRequests).toBe(1);
  expect(confirmRequests).toBe(1);

  await page.goto("/transactions");
  await expect(
    page.getByRole("heading", { exact: true, name: "账单明细" }),
  ).toBeVisible();
  const transactionRow = page.locator("li").filter({ hasText: marker });
  await expect(transactionRow).toHaveCount(1);
  await expect(
    transactionRow.getByText("-¥38.50", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { exact: true, name: "账单明细" }),
  ).toBeVisible();
  await expect(page.locator("li").filter({ hasText: marker })).toHaveCount(1);
  await expect(
    page
      .locator("li")
      .filter({ hasText: marker })
      .getByText("-¥38.50", { exact: true }),
  ).toBeVisible();
  const afterReload = await matchingTransactions(request, username, marker);
  expect(afterReload).toHaveLength(1);
  expect(afterReload[0]).toMatchObject({
    amount: "38.50",
    merchant: marker,
    type: "EXPENSE",
  });
  const unexpected = blocking.filter((text) =>
    /Access token is required|401|CORS|NetworkError|Failed to fetch/i.test(
      text,
    ),
  );
  expect(unexpected).toEqual([]);
});

test("UIR-10C3: native Browser Back keeps or discards unsaved capture input", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_capture_back");
  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await page.goto("/");
  await page.locator(".home-capture").click();
  await expect(page).toHaveURL(/\/capture\?returnTo=%2F/);
  const input = page.getByRole("textbox", { name: "记录内容" });
  await input.fill("未保存的合成内容 25.00");

  await page.goBack();
  const dialog = page.getByRole("dialog", { name: "放弃未保存的内容？" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/capture\?returnTo=%2F/);
  await expect(input).toHaveValue("未保存的合成内容 25.00");
  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(page).toHaveURL(/\/capture\?returnTo=%2F/);
  await expect(input).toHaveValue("未保存的合成内容 25.00");

  await page.goBack();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "离开" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".home-capture")).toBeVisible();
});

async function matchingTransactions(
  request: APIRequestContext,
  username: string,
  marker: string,
): Promise<E2eTransaction[]> {
  const token = await userAccessToken(request, username);
  const response = await request.get("/api/v1/transactions?limit=100", {
    headers: { Authorization: "Bearer " + token },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: E2eTransaction[] };
  return body.items.filter((item) => item.merchant === marker);
}

async function userAccessToken(
  request: APIRequestContext,
  username: string,
): Promise<string> {
  const login = await request.post("/api/v1/auth/login", {
    data: { password: E2E_ACTIVE_PASSWORD, username },
  });
  expect(login.ok()).toBeTruthy();
  const body = (await login.json()) as { accessToken: string };
  return body.accessToken;
}

test.describe("UIR-10C3 mock browser layout and failure states", () => {
  test("UIR-10C3: capture draft, retry, return and responsive states", async ({
    page,
  }) => {
    let createCount = 0;
    let releaseSuccess!: () => void;
    const successGate = new Promise<void>((resolve) => {
      releaseSuccess = resolve;
    });
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const requestFailures: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      requestFailures.push(
        `${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`,
      );
    });

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/v1/auth/refresh") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            accessToken: "e2e-only-session",
            expiresIn: 3600,
            mustChangePassword: false,
            user: {
              closedAt: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              deletionRequestedAt: null,
              displayName: "快速记录 E2E",
              id: "e2e-capture-user",
              role: "USER",
              status: "ACTIVE",
              updatedAt: "2026-01-01T00:00:00.000Z",
              username: "capture_e2e",
            },
          }),
        });
        return;
      }
      if (path === "/api/v1/sync/changes") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ changes: [], nextCursor: null }),
        });
        return;
      }
      if (path === "/api/v1/sync/status") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            appliedCount: 0,
            conflictCount: 0,
            failedCount: 0,
            lastAppliedAt: null,
          }),
        });
        return;
      }
      if (path === "/api/v1/drafts/parse-text" && request.method() === "POST") {
        createCount += 1;
        expect(request.postDataJSON()).toEqual({ text: "午餐 25.00" });
        if (createCount === 1) {
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              code: "INTERNAL_ERROR",
              message: "暂时不可用",
              requestId: "e2e-capture",
            }),
          });
          return;
        }
        await successGate;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ draft: { id: "e2e-draft" } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await page.goto("/capture?returnTo=%2Frecords");
    await expect(page.getByRole("heading", { name: "快速记录" })).toBeVisible();
    await expect(
      page.getByText("生成草稿不等于正式入账", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "去草稿中心核对" }),
    ).toHaveCount(0);
    const input = page.getByRole("textbox", { name: "记录内容" });
    const submit = page.getByRole("button", { name: "生成待确认草稿" });
    await expect(submit).toBeDisabled();
    await input.fill("午餐 25.00");
    await submit.click();
    await expect(page.getByRole("alert")).toContainText("输入仍在");
    await expect(input).toHaveValue("午餐 25.00");
    await expect(
      page.getByRole("link", { name: "去草稿中心核对" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "重试生成草稿" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "正在整理" }),
    ).toContainText("正在整理");
    await expect(page.getByRole("button", { name: "生成中…" })).toBeDisabled();
    await expect(
      page.getByRole("link", { name: "去草稿中心核对" }),
    ).toHaveCount(0);
    releaseSuccess();
    await expect(
      page.getByText("草稿已生成，尚未入账", { exact: false }),
    ).toBeVisible();
    expect(createCount).toBe(2);
    await expect(input).toHaveValue("");
    const review = page.getByRole("link", { name: "去草稿中心核对" });
    await expect(review).toHaveAttribute("href", /\/drafts\?returnTo=/);
    await expect(page.getByRole("link", { name: "日程" })).toHaveAttribute(
      "href",
      /\/calendar\?returnTo=/,
    );
    expect(pageErrors).toEqual([]);

    await page.goto(`/capture?returnTo=%2Frecords&text=${"x".repeat(2100)}`);
    expect((await input.inputValue()).length).toBe(2000);
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const zoomed = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(zoomed.scroll).toBeLessThanOrEqual(zoomed.client + 1);
    expect(pageErrors).toEqual([]);
    expect(requestFailures).toEqual([]);
    expect(
      consoleErrors.filter(
        (message) =>
          !message.includes("status of 503") &&
          !message.includes("unsupported MIME type"),
      ),
    ).toEqual([]);

    await input.fill("未保存的第二条");
    await page.getByRole("button", { name: /返回记录/ }).click();
    const dialog = page.getByRole("dialog", { name: "放弃未保存的内容？" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(page).toHaveURL(/\/capture\?/);
    await expect(input).toHaveValue("未保存的第二条");
    await page.getByRole("button", { name: /返回记录/ }).click();
    await dialog.getByRole("button", { name: "离开" }).click();
    await expect(page).toHaveURL(/\/records$/);
  });
});
