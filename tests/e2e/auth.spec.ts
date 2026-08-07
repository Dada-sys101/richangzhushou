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

test.describe("用户端认证", () => {
  test("未登录访问首页显示友好登录状态且不出现技术错误", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("请登录后查看今日数据")).toBeVisible();
    await expect(page.getByRole("link", { name: "登录" })).toBeVisible();
    await expect(page.getByText("Access token is required")).toHaveCount(0);
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
    await expect(page.getByRole("heading", { name: "个人设置" })).toBeVisible();
    await navLink(page, "首页").click();
    await expect(page.getByRole("heading", { name: "今日概览" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "今日概览" })).toBeVisible();
  });

  test("退出登录后受保护页面不可访问", async ({ page, request }) => {
    const username = uniqueName("qa_logout");
    await createActiveUserViaApi(request, username);
    await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
    await page.waitForURL("**/account");
    await navLink(page, "待办").click();
    await expect(page.getByRole("heading", { name: "待办事项" })).toBeVisible();
    await page.getByRole("button", { name: "更多" }).click();
    await page.getByRole("menuitem", { name: "个人设置" }).click();
    await page.waitForURL("**/account");
    await page.getByRole("button", { name: "退出登录" }).click();
    await page.waitForURL("**/login");
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login/);
    await expectNoBlockingErrors(page);
  });
});
