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
    if (message.type() === "error") {
      blocking.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    blocking.push(String(error));
  });
  page.on("request", (requestEvent) => {
    const pathname = new URL(requestEvent.url()).pathname;
    if (
      requestEvent.method() === "POST" &&
      pathname.endsWith("/api/v1/drafts/parse-text")
    ) {
      parseRequests += 1;
    }
    if (
      requestEvent.method() === "PATCH" &&
      pathname.includes("/api/v1/drafts/")
    ) {
      updateRequests += 1;
    }
    if (
      requestEvent.method() === "POST" &&
      pathname.includes("/api/v1/drafts/") &&
      pathname.endsWith("/confirm")
    ) {
      confirmRequests += 1;
    }
  });

  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");

  expect(await matchingTransactions(request, username, marker)).toHaveLength(0);

  await page.goto("/capture");
  await expect(
    page.getByRole("heading", { name: "记录此刻的想法" }),
  ).toBeVisible();
  await page.getByLabel("内容").fill(input);

  const parseResponse = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/v1/drafts/parse-text") &&
      response.ok()
    );
  });
  await Promise.all([
    parseResponse,
    page.getByRole("button", { name: "生成待确认草稿" }).click(),
  ]);
  const parsed = (await parseResponse).json() as Promise<{
    draft: { id: string };
  }>;
  const draftId = (await parsed).draft.id;
  expect(draftId).toBeTruthy();

  await expect(page.getByText("草稿已生成", { exact: true })).toBeVisible();
  await expect(
    page.getByText("已生成待确认财务草稿，请到草稿中心核对后确认入账。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "去确认", exact: true }),
  ).toBeVisible();
  expect(await matchingTransactions(request, username, marker)).toHaveLength(0);

  await page.getByRole("link", { name: "去确认", exact: true }).click();
  await page.waitForURL("**/drafts");
  await expect(page.getByRole("heading", { name: "草稿中心" })).toBeVisible();

  const draftCard = page.locator("article.draft-card").filter({
    hasText: "文本解析",
  });
  await expect(draftCard).toHaveCount(1);
  await expect(draftCard.getByText("待确认", { exact: true })).toBeVisible();
  await expect(draftCard.getByLabel("金额")).toHaveValue("38.50");
  await expect(draftCard.getByLabel("商户")).toHaveValue(marker);

  const noteField = draftCard.getByLabel("备注");
  await noteField.fill(note);
  const updateResponse = page.waitForResponse((response) => {
    return (
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === "/api/v1/drafts/" + draftId &&
      response.ok()
    );
  });
  await Promise.all([
    updateResponse,
    draftCard.getByRole("button", { name: "保存修改", exact: true }).click(),
  ]);
  await expect(noteField).toHaveValue(note);

  await page.reload();
  const reloadedDraftCard = page.locator("article.draft-card").filter({
    hasText: "文本解析",
  });
  await expect(reloadedDraftCard).toHaveCount(1);
  await expect(
    reloadedDraftCard.getByText("待确认", { exact: true }),
  ).toBeVisible();
  await expect(reloadedDraftCard.getByLabel("金额")).toHaveValue("38.50");
  await expect(reloadedDraftCard.getByLabel("商户")).toHaveValue(marker);
  await expect(reloadedDraftCard.getByLabel("备注")).toHaveValue(note);
  expect(await matchingTransactions(request, username, marker)).toHaveLength(0);

  const confirmResponse = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        "/api/v1/drafts/" + draftId + "/confirm" &&
      response.ok()
    );
  });
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
  await expect(page.getByRole("heading", { name: "账单" })).toBeVisible();
  const transactionRow = page.locator("li").filter({ hasText: marker });
  await expect(transactionRow).toHaveCount(1);
  await expect(
    transactionRow.getByText("-¥38.50", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "账单" })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: marker })).toHaveCount(1);
  await expect(
    page.locator("li").filter({ hasText: marker }).getByText("-¥38.50", {
      exact: true,
    }),
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
