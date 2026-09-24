import { expect, test } from "@playwright/test";

import {
  createActiveUserViaApi,
  createUserViaApi,
  E2E_ACTIVE_PASSWORD,
  E2E_USER_PASSWORD,
  expectNoBlockingErrors,
  loginViaUi,
  navLink,
  uniqueName,
} from "./helpers/e2e";

// Login fixtures contain synthetic passwords; never retain browser media or traces.
test.use({ screenshot: "off", trace: "off", video: "off" });

test("登录表单在窄屏和放大文字下保持可操作，限流后保留输入", async ({
  page,
}) => {
  await page.goto("/login");
  const username = page.getByLabel("账号");
  const password = page.getByLabel("密码");
  const submit = page.getByRole("button", { name: "登录", exact: true });
  await expect(
    page.getByRole("heading", { name: "登录日常助手" }),
  ).toBeVisible();
  await expect(page.getByText("账号由管理员创建")).toBeVisible();
  await submit.click();
  await expect(username).toBeFocused();
  await username.fill("Invalid Name");
  await password.fill("SyntheticPassword123!");
  await submit.click();
  await expect(username).toBeFocused();
  await username.fill("synthetic_user");
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        code: "RATE_LIMITED",
        message: "rate limited",
        requestId: "synthetic",
      }),
    });
  });
  await password.press("Tab");
  await expect(submit).toBeFocused();
  await submit.press("Enter");
  await expect(page.getByRole("alert")).toContainText("操作过于频繁");
  await expect(username).toHaveValue("synthetic_user");
  await expect(password).toHaveValue("SyntheticPassword123!");
  await expect(submit).toBeEnabled();
  for (const size of [16, 32]) {
    await page.evaluate((fontSize) => {
      document.documentElement.style.fontSize = `${fontSize}px`;
    }, size);
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  }
});

test.describe("用户端认证", () => {
  test("未登录访问首页显示友好登录状态且不出现技术错误", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "把今天过得更轻松" }),
    ).toBeVisible();
    await expect(page.getByText("请登录后查看今日安排")).toBeVisible();
    await expect(page.getByRole("link", { name: "登录" })).toBeVisible();
    await expect(page.getByText("Access token is required")).toHaveCount(0);
    await expect(page.getByText("401", { exact: true })).toHaveCount(0);
  });

  test("错误密码显示友好错误", async ({ page, request }) => {
    const username = uniqueName("qa_errpwd");
    await createUserViaApi(request, username);
    await page.goto("/login");
    await page.getByLabel("账号").fill(username);
    await page.getByLabel("密码").fill("WrongPassword123!");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText("Access token");
  });

  test("用户名密码登录成功并进入首页", async ({ page, request }) => {
    const username = uniqueName("qa_login");
    await createActiveUserViaApi(request, username);
    await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
    await page.waitForURL("**/account");
    await expect(page.getByRole("heading", { name: "我的" })).toBeVisible();
    await navLink(page, "首页").click();
    await expect(page.locator("#home-title")).toBeVisible();
    await expect(page.getByText("今日时间轴")).toBeVisible();
  });

  test("首次登录被强制修改密码", async ({ page, request }) => {
    const username = uniqueName("qa_forcepwd");
    await createUserViaApi(request, username);
    await loginViaUi(page, username, E2E_USER_PASSWORD);
    await page.waitForURL("**/change-password");
    await expect(
      page.getByText(
        "首次登录或管理员重置密码后，必须先设置新密码才能继续使用。",
      ),
    ).toBeVisible();
    await page.getByLabel("当前密码").fill(E2E_USER_PASSWORD);
    await page
      .getByLabel("新密码", { exact: true })
      .fill("ChangedPassword123!");
    await page.getByLabel("确认新密码").fill("ChangedPassword123!");
    await page.getByRole("button", { name: "确认修改" }).click();
    await page.waitForURL("**/account");
    await navLink(page, "首页").click();
    await expect(page.locator("#home-title")).toBeVisible();
    await expect(page.getByText("今日时间轴")).toBeVisible();
  });

  test("退出登录后受保护页面不可访问", async ({ page, request }) => {
    const username = uniqueName("qa_logout");
    await createActiveUserViaApi(request, username);
    await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
    await page.waitForURL("**/account");
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "待办事项" })).toBeVisible();
    await page.getByRole("button", { name: "返回计划", exact: true }).click();
    await page.waitForURL("**/plan");
    await expect(page.getByRole("heading", { name: "计划中心" })).toBeVisible();
    await navLink(page, "我的").click();
    await page.waitForURL("**/account");
    await page
      .locator("details.account-danger-details")
      .locator("summary")
      .click();
    await page.getByLabel("当前密码").fill(E2E_ACTIVE_PASSWORD);
    await page.getByRole("button", { name: "退出登录" }).click();
    await page.waitForURL("**/login?redirect=/");
    await expect(
      page.getByRole("heading", { name: "登录日常助手" }),
    ).toBeVisible();
    await expect(page.getByLabel("账号")).toBeVisible();
    await expect(page.getByLabel("密码")).toBeVisible();
    await page.getByLabel("账号").fill(username);
    await page.getByLabel("密码").fill(E2E_ACTIVE_PASSWORD);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL(/\/$/);
    await expect(page.locator("#home-title")).toBeVisible();

    await page.goto("/account");
    await page
      .locator("details.account-danger-details")
      .locator("summary")
      .click();
    await page.getByRole("button", { name: "退出登录" }).click();
    await page.waitForURL("**/login?redirect=/");
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login/);
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "登录日常助手" }),
    ).toBeVisible();
    await expect(page.locator(".bottom-nav")).toHaveCount(0);
    await expectNoBlockingErrors(page);
  });
});
