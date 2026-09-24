import { expect, test } from "@playwright/test";

const fakeSessionToken = "e2e-only-session-value";
const fakeCreatedToken = "e2e-only-shortcut-value-not-a-credential";

// Prevent one-time token material from being copied into Playwright artifacts.
test.use({ screenshot: "off", trace: "off", video: "off" });

test("UIR-10C1: shortcut credential safety, retries, revoke confirmation and responsive layout", async ({
  page,
}) => {
  const credential = {
    createdAt: "2026-09-24T02:00:00.000Z",
    id: "e2e-shortcut-credential",
    lastUsedAt: null as string | null,
    name: "快捷设备".repeat(12),
    revokedAt: null as string | null,
    scopes: ["transaction:draft:create"],
    tokenPrefix: "e2e_prefix",
  };
  let getCount = 0;
  let createCount = 0;
  let revokeCount = 0;
  let releaseCreate!: () => void;
  let credentials: Array<typeof credential> = [];
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  const injectedHttpFailures: string[] = [];
  const deleteResponseStatuses: number[] = [];
  const failedRequests: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const createPayloads: unknown[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  page.on("response", (response) => {
    if (response.request().method() === "DELETE") {
      deleteResponseStatuses.push(response.status());
    }
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();

    if (pathname === "/api/v1/auth/refresh") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: fakeSessionToken,
          expiresIn: 3600,
          mustChangePassword: false,
          user: {
            closedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            deletionRequestedAt: null,
            displayName: "快捷指令 E2E",
            id: "e2e-shortcuts-user",
            role: "USER",
            status: "ACTIVE",
            updatedAt: "2026-01-01T00:00:00.000Z",
            username: "shortcuts_e2e",
          },
        }),
      });
      return;
    }
    if (pathname === "/api/v1/sync/changes") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ changes: [], nextCursor: null }),
      });
      return;
    }
    if (pathname === "/api/v1/sync/status") {
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
    if (pathname === "/api/v1/shortcut-credentials" && method === "GET") {
      getCount += 1;
      if (getCount === 1) {
        injectedHttpFailures.push("GET credentials: 503");
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "INTERNAL_ERROR",
            message: "temporary test failure",
            requestId: "e2e-shortcuts",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: credentials }),
      });
      return;
    }
    if (pathname === "/api/v1/shortcut-credentials" && method === "POST") {
      createCount += 1;
      createPayloads.push(request.postDataJSON());
      if (createCount === 1) {
        injectedHttpFailures.push("POST credential: 503");
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "INTERNAL_ERROR",
            message: "temporary test failure",
            requestId: "e2e-shortcuts",
          }),
        });
        return;
      }
      await createGate;
      credentials = [credential];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          credential,
          plaintextToken: fakeCreatedToken,
        }),
      });
      return;
    }
    if (
      pathname === `/api/v1/shortcut-credentials/${credential.id}` &&
      method === "DELETE"
    ) {
      revokeCount += 1;
      if (revokeCount === 1) {
        injectedHttpFailures.push("DELETE credential: 503");
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "INTERNAL_ERROR",
            message: "temporary test failure",
            requestId: "e2e-shortcuts",
          }),
        });
        return;
      }
      credential.revokedAt = "2026-09-24T03:00:00.000Z";
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fulfill({
      ...(method === "DELETE"
        ? { status: 204 }
        : { status: 200, contentType: "application/json", body: "{}" }),
    });
  });

  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "我的", exact: true }),
  ).toBeVisible();
  await page.goto("/shortcuts");
  await expect(page).toHaveURL(/\/shortcuts$/);
  await expect(
    page.getByRole("heading", { name: "快捷指令", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "凭证列表暂时无法加载" }),
  ).toBeVisible();
  await expect(page.getByText("还没有设备凭证")).toHaveCount(0);
  await page.getByRole("button", { name: "重试加载" }).click();
  await expect(page.getByText("还没有设备凭证")).toBeVisible();

  await page.getByRole("button", { name: "创建凭证" }).click();
  await expect(page.getByText("请填写设备凭证名称。")).toBeVisible();
  await expect(page.getByLabel("凭证名称")).toBeFocused();
  expect(createCount).toBe(0);

  await page.getByLabel("凭证名称").fill(credential.name);
  await page.getByRole("button", { name: "创建凭证" }).click();
  await expect(page.getByText("请至少选择一个权限范围。")).toBeVisible();
  await expect(page.locator(".scope-fieldset")).toBeFocused();
  const draftScope = page.getByRole("checkbox", { name: /创建记账草稿/ });
  await page.keyboard.press("Tab");
  await expect(draftScope).toBeFocused();
  await page.keyboard.press("Space");
  await expect(draftScope).toBeChecked();
  await page.getByRole("button", { name: "创建凭证" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "服务器暂时不可用" }),
  ).toBeVisible();
  await expect(page.getByLabel("凭证名称")).toHaveValue(credential.name);
  await expect(draftScope).toBeChecked();

  await page.getByRole("button", { name: "创建凭证" }).click();
  const busyCreateButton = page.getByRole("button", { name: "正在创建…" });
  await expect(busyCreateButton).toBeDisabled();
  await page.locator(".shortcuts-create-form").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect.poll(() => createCount).toBe(2);
  releaseCreate();
  await expect(page.getByRole("button", { name: "创建凭证" })).toBeEnabled();

  const tokenResult = page.locator(".token-code");
  await expect(tokenResult).toBeVisible();
  const tokenMatchesCreationResponse = await tokenResult.evaluate(
    (element, expected) => element.textContent === expected,
    fakeCreatedToken,
  );
  expect(tokenMatchesCreationResponse).toBe(true);
  await expect(
    page.getByRole("heading", { name: "令牌仅显示这一次" }),
  ).toBeVisible();
  await expect(page.getByText(credential.name, { exact: true })).toBeVisible();
  expect(createPayloads).toEqual([
    { name: credential.name, scopes: ["transaction:draft:create"] },
    { name: credential.name, scopes: ["transaction:draft:create"] },
  ]);
  const persistentValues = await page.evaluate(() =>
    [localStorage, sessionStorage]
      .flatMap((storage) =>
        Object.keys(storage).map((key) => storage.getItem(key) ?? ""),
      )
      .join("\n"),
  );
  const tokenWasPersisted = persistentValues.includes(fakeCreatedToken);
  expect(tokenWasPersisted).toBe(false);

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.resolve(),
      },
    });
  });
  await page.getByRole("button", { name: "复制令牌" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "令牌已复制" }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("clipboard blocked")),
      },
    });
  });
  await page.getByRole("button", { name: "复制令牌" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "复制失败" }),
  ).toBeVisible();

  const revokeButton = page.getByRole("button", { name: "撤销凭证" });
  await revokeButton.click();
  const confirmDialog = page.getByRole("dialog", { name: "撤销设备凭证？" });
  await expect(confirmDialog).toBeVisible();
  await expect(
    confirmDialog.getByRole("button", { name: "取消" }),
  ).toBeFocused();
  await confirmDialog.getByRole("button", { name: "取消" }).click();
  expect(revokeCount).toBe(0);
  await expect(page.getByText("有效", { exact: true })).toBeVisible();

  await revokeButton.click();
  await page
    .getByRole("dialog", { name: "撤销设备凭证？" })
    .getByRole("button", { name: "确认撤销" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "服务器暂时不可用" }),
  ).toBeVisible();
  await expect(page.getByText("有效", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "撤销凭证" })).toBeEnabled();

  await page.getByRole("button", { name: "撤销凭证" }).click();
  const successfulDeleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" && response.status() === 204,
  );
  const refreshedCredentialList = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/v1/shortcut-credentials",
  );
  await page
    .getByRole("dialog", { name: "撤销设备凭证？" })
    .getByRole("button", { name: "确认撤销" })
    .click();
  const deleteResponse = await successfulDeleteResponse;
  await refreshedCredentialList;
  expect(deleteResponse.status()).toBe(204);
  const defaultTextDimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(defaultTextDimensions.scroll).toBeLessThanOrEqual(
    defaultTextDimensions.client + 1,
  );
  await expect(page.getByText("已撤销", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "撤销凭证" })).toHaveCount(0);
  expect(revokeCount).toBe(2);
  expect(deleteResponseStatuses).toEqual([503, 204]);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.locator(".token-code").count()).toBe(1);

  await page.goBack();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator(".token-code")).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/\/shortcuts(?:\?|$)/);
  await expect(page.locator(".token-code")).toHaveCount(0);
  await page.getByRole("button", { name: "返回我的" }).click();
  await expect(page).toHaveURL(/\/account$/);

  expect(createCount).toBe(2);
  expect(injectedHttpFailures).toEqual([
    "GET credentials: 503",
    "POST credential: 503",
    "DELETE credential: 503",
  ]);
  expect(failedRequests.length).toBeLessThanOrEqual(1);
  expect(
    failedRequests.every(
      (failure) =>
        failure ===
        `DELETE /api/v1/shortcut-credentials/${credential.id}: net::ERR_ABORTED`,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
  const unexpectedConsoleErrors = consoleErrors.filter(
    (message) =>
      !message.includes("unsupported MIME type ('text/html')") &&
      !message.includes("status of 503 (Service Unavailable)"),
  );
  expect(unexpectedConsoleErrors).toEqual([]);
  expect(
    consoleErrors.filter((message) =>
      message.includes("status of 503 (Service Unavailable)"),
    ),
  ).toHaveLength(3);
});
