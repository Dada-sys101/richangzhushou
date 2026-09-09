import { expect, test } from "@playwright/test";

import {
  createActiveUserViaApi,
  E2E_ACTIVE_PASSWORD,
  loginViaUi,
  uniqueName,
} from "./helpers/e2e";

const TEST_PUBLIC_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa40HI0rUFap9pTj-uLS5ZwV-lpWQ";

test.describe("Web Push 权限与订阅界面", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/push/**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            enabled: true,
            publicKey: TEST_PUBLIC_KEY,
            subscribed: false,
            subscriptions: 0,
          },
        });
        return;
      }
      if (route.request().method() === "DELETE") {
        await route.fulfill({ status: 204 });
        return;
      }
      await route.fulfill({ json: {}, status: 201 });
    });
  });

  test("订阅、刷新恢复、退订和五档宽度", async ({ page, request }) => {
    await installPushMock(page, "granted");
    const username = uniqueName("qa_push");
    await createActiveUserViaApi(request, username);
    await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
    await page.waitForURL("**/account");
    await page.goto("/reminders");

    const toggle = page.getByRole("button", { name: "开启应用外提醒" });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByText("应用外提醒已开启")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "关闭应用外提醒" }),
    ).toBeVisible();

    await page.reload();
    const disable = page.getByRole("button", { name: "关闭应用外提醒" });
    await expect(disable).toBeVisible();
    for (const width of [375, 390, 430, 768, 1440]) {
      await page.setViewportSize({ height: 900, width });
      await expect(disable).toBeVisible();
    }
    await disable.click();
    await expect(page.getByText("应用外提醒已关闭")).toBeVisible();
  });

  test("权限拒绝时不创建订阅并显示说明", async ({ page, request }) => {
    await installPushMock(page, "denied");
    const username = uniqueName("qa_push_deny");
    await createActiveUserViaApi(request, username);
    await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
    await page.waitForURL("**/account");
    await page.goto("/reminders");
    await page.getByRole("button", { name: "开启应用外提醒" }).click();
    await expect(page.getByRole("alert")).toContainText("需要允许系统通知");
    await expect(
      page.getByRole("button", { name: "开启应用外提醒" }),
    ).toBeVisible();
  });
});

async function installPushMock(
  page: import("@playwright/test").Page,
  permission: "denied" | "granted",
) {
  await page.addInitScript((mockPermission) => {
    const subscription = {
      endpoint: "https://push.example.test/subscriptions/browser-e2e",
      toJSON: () => ({
        endpoint: "https://push.example.test/subscriptions/browser-e2e",
        keys: { auth: "auth-e2e", p256dh: "p256dh-e2e" },
      }),
      unsubscribe: async () => {
        localStorage.removeItem("e2e-push-subscribed");
        return true;
      },
    };
    const pushManager = {
      getSubscription: async () =>
        localStorage.getItem("e2e-push-subscribed") ? subscription : null,
      subscribe: async () => {
        localStorage.setItem("e2e-push-subscribed", "true");
        return subscription;
      },
    };
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager }) },
    });
    Object.defineProperty(window.Notification, "requestPermission", {
      configurable: true,
      value: async () => mockPermission,
    });
  }, permission);
}
