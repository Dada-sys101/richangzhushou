import { expect, test, type Page } from "@playwright/test";
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
  await page.getByRole("link", { name: "查看" }).click();
  await expect(page).toHaveURL(/\/trips\/[^/]+/);
  await page.goBack();
  await expect(page).toHaveURL(/\/trips$/);
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("button", { name: "删除" }).click();
  await expect(page.getByText(title)).toHaveCount(0);
  await page.getByLabel("显示已删除").check();
  await expect(page.getByText("已删除", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "恢复" }).click();
  await expect(page.getByText("行程已恢复")).toBeVisible();
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
