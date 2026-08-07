import { expect, test } from "@playwright/test";

import {
  adminLoginViaUi,
  createActiveUserViaApi,
  E2E_ACTIVE_PASSWORD,
  loginViaUi,
  uniqueName,
} from "./helpers/e2e";

test("用户申请删除后管理端可见 DELETION_PENDING，管理员取消后恢复登录", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_delete");
  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");

  await page.getByRole("button", { name: "选择申请删除" }).click();
  await page.getByLabel("当前密码").fill(E2E_ACTIVE_PASSWORD);
  await page.getByLabel("原因").fill("e2e 删除测试");
  await page.getByRole("button", { name: "确认并提交" }).click();
  await page.waitForURL("**/login");

  await adminLoginViaUi(page);
  await page.getByRole("link", { name: "用户" }).click();
  await page.waitForURL("**/users");
  const row = page.locator("tr", { hasText: username });
  await expect(row).toContainText("DELETION_PENDING");
  await row.getByRole("button", { name: "取消删除" }).click();
  await page.getByLabel("原因（必填）").fill("e2e 取消删除");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(row).toContainText("ACTIVE");
  await expect(row).not.toContainText("DELETION_PENDING");

  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await expect(page.getByRole("heading", { name: "个人设置" })).toBeVisible();
});
