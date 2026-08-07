import { expect, test } from "@playwright/test";

import {
  adminLoginViaUi,
  createUserViaApi,
  E2E_USER_PASSWORD,
  loginViaUi,
  uniqueName,
} from "./helpers/e2e";

test.describe("管理端", () => {
  test("管理员登录并创建普通用户", async ({ page }) => {
    const username = uniqueName("qa_admcreate");
    await adminLoginViaUi(page);
    await page.getByRole("link", { name: "用户" }).click();
    await page.waitForURL("**/users");
    await page.getByLabel("账号（3-32 位小写字母/数字/下划线）").fill(username);
    await page.getByLabel("昵称").fill("E2E 用户");
    await page
      .getByLabel("初始密码（至少 12 位，首次登录需修改）")
      .fill(E2E_USER_PASSWORD);
    await page.getByLabel("创建原因（必填，将写入审计）").fill("e2e 创建");
    await page.getByRole("button", { name: "创建账号" }).click();
    await expect(page.getByText(`已创建账号 ${username}`)).toBeVisible();
    await expect(page.locator("tr", { hasText: username })).toBeVisible();
  });

  test("重复用户名返回友好提示", async ({ page, request }) => {
    const username = uniqueName("qa_dup");
    await createUserViaApi(request, username);
    await adminLoginViaUi(page);
    await page.getByRole("link", { name: "用户" }).click();
    await page.waitForURL("**/users");
    await page.getByLabel("账号（3-32 位小写字母/数字/下划线）").fill(username);
    await page.getByLabel("昵称").fill("E2E 重复");
    await page
      .getByLabel("初始密码（至少 12 位，首次登录需修改）")
      .fill(E2E_USER_PASSWORD);
    await page.getByLabel("创建原因（必填，将写入审计）").fill("e2e 重复");
    await page.getByRole("button", { name: "创建账号" }).click();
    const error = page.locator(".admin-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(/already exists|已存在/);
    await expect(error).not.toContainText("Access token");
  });

  test("重置密码后用户首次登录必须改密", async ({ page, request }) => {
    const username = uniqueName("qa_reset");
    await createUserViaApi(request, username);
    await adminLoginViaUi(page);
    await page.getByRole("link", { name: "用户" }).click();
    await page.waitForURL("**/users");
    const row = page.locator("tr", { hasText: username });
    await row.getByRole("button", { name: "重置密码" }).click();
    await page.getByLabel("新密码（至少 12 位）").fill("ResetPassword123!");
    await page.getByLabel("原因（必填）").fill("e2e 重置");
    await page.getByRole("button", { name: "提交" }).click();
    await expect(page.getByText(`已重置 ${username} 的密码`)).toBeVisible();

    await loginViaUi(page, username, "ResetPassword123!");
    await page.waitForURL("**/change-password");
    await expect(page.getByRole("heading", { name: "修改密码" })).toBeVisible();
  });
});
