import { expect, test } from "@playwright/test";

// All content is synthetic, but keep conflict bodies out of browser artifacts.
test.use({ screenshot: "off", trace: "off", video: "off" });

test("UIR-10C2: compare synthetic conflicts, confirm choices and keep layout readable", async ({
  page,
}) => {
  let mutations = 0;
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const unexpectedNetwork: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (!request.failure()?.errorText?.includes("ERR_ABORTED")) {
      unexpectedNetwork.push(
        `${request.method()} ${new URL(request.url()).pathname}`,
      );
    }
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/v1/auth/refresh") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "synthetic-session-only",
          expiresIn: 3600,
          mustChangePassword: false,
          user: {
            id: "synthetic-user",
            username: "synthetic_user",
            displayName: "合成测试用户",
            role: "USER",
            status: "ACTIVE",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            closedAt: null,
            deletionRequestedAt: null,
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
    if (pathname === "/api/v1/sync/mutations") {
      mutations += 1;
      const body = request.postDataJSON() as {
        mutations: Array<{ clientMutationId: string }>;
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: body.mutations.map((item) => ({
            clientMutationId: item.clientMutationId,
            status: "CONFLICT",
            error: {
              code: "VERSION_CONFLICT",
              message: "synthetic version conflict",
              current: {
                entityType: "TASK",
                entityId: "synthetic-task",
                data: { title: "服务端合成内容", version: 4 },
              },
            },
          })),
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "我的", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("daily-assistant-sync", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const pending = database
      .transaction("pending", "readwrite")
      .objectStore("pending");
    const base = {
      userId: "synthetic-user",
      entityType: "TASK",
      action: "UPDATE",
      entityId: "synthetic-task",
      localId: null,
      payload: { title: "本地合成内容".repeat(30) },
      version: 2,
      status: "CONFLICT",
      errorMessage: "synthetic conflict",
      current: {
        entityType: "TASK",
        entityId: "synthetic-task",
        data: { title: "服务端合成内容".repeat(30), version: 3 },
      },
      createdAt: 1,
    };
    pending.put({
      ...base,
      id: "synthetic-normal",
      errorCode: "VERSION_CONFLICT",
    });
    pending.put({
      ...base,
      id: "synthetic-idempotency",
      entityId: "synthetic-other",
      errorCode: "IDEMPOTENCY_CONFLICT",
      createdAt: 2,
    });
    await new Promise<void>((resolve, reject) => {
      pending.transaction.oncomplete = () => resolve();
      pending.transaction.onerror = () => reject(pending.transaction.error);
    });
    database.close();
  });
  await page.goto("/sync/conflicts");
  await expect(page.getByText("待处理 2 项")).toBeVisible();
  await expect(
    page.getByText("本地合成内容".repeat(30), { exact: false }).first(),
  ).toBeVisible();
  const idempotencyCard = page
    .locator(".conflict-card")
    .filter({ hasText: "无法通过此冲突保留本地修改" });
  await expect(
    idempotencyCard.getByRole("button", { name: "重新提交本地内容" }),
  ).toHaveCount(0);
  await expect(
    idempotencyCard.getByRole("button", { name: "使用服务端内容" }),
  ).toBeVisible();

  const regularCard = page
    .locator(".conflict-card")
    .filter({ hasText: "本地修改与服务端版本冲突" });
  await regularCard.getByRole("button", { name: "重新提交本地内容" }).focus();
  await expect(
    regularCard.getByRole("button", { name: "重新提交本地内容" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const localDialog = page.getByRole("dialog", { name: "重新提交本地内容？" });
  await expect(localDialog).toBeVisible();
  await localDialog.getByRole("button", { name: "取消" }).click();
  expect(mutations).toBe(0);
  await regularCard.getByRole("button", { name: "重新提交本地内容" }).click();
  await page
    .getByRole("dialog", { name: "重新提交本地内容？" })
    .getByRole("button", { name: "确认重新提交" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "同步尚未完成" }),
  ).toBeVisible();
  expect(mutations).toBe(1);

  await idempotencyCard.getByRole("button", { name: "使用服务端内容" }).click();
  const serverDialog = page.getByRole("dialog", { name: "使用服务端内容？" });
  await serverDialog.getByRole("button", { name: "取消" }).click();
  await expect(idempotencyCard).toBeVisible();
  await idempotencyCard.getByRole("button", { name: "使用服务端内容" }).click();
  await page
    .getByRole("dialog", { name: "使用服务端内容？" })
    .getByRole("button", { name: "确认使用服务端" })
    .click();
  await expect(idempotencyCard).toHaveCount(0);

  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(
    page.getByText("可以查看已加载的冲突；请联网后再选择并重试同步。"),
  ).toBeVisible();
  await expect(
    regularCard.getByRole("button", { name: "重新提交本地内容" }),
  ).toBeDisabled();
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    regularCard.getByRole("button", { name: "重新提交本地内容" }),
  ).toBeEnabled();

  for (const zoom of [false, true]) {
    await page.evaluate((large) => {
      document.documentElement.style.fontSize = large ? "200%" : "";
    }, zoom);
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  }
  await page.getByRole("button", { name: "返回我的" }).click();
  await expect(page).toHaveURL(/\/account$/);
  expect(pageErrors).toEqual([]);
  expect(unexpectedNetwork).toEqual([]);
  expect(
    consoleErrors.filter(
      (message) => !message.includes("unsupported MIME type ('text/html')"),
    ),
  ).toEqual([]);
});
