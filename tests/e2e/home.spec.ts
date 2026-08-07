import { expect, test } from "@playwright/test";

import {
  createActiveUserViaApi,
  E2E_ACTIVE_PASSWORD,
  loginViaUi,
  navLink,
  shanghaiLocalInput,
  uniqueName,
} from "./helpers/e2e";

test("首页与核心业务创建、刷新持久化且无阻塞错误", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_home");
  const taskTitle = `待办-${username}`;
  const eventTitle = `日程-${username}`;
  const merchant = `商户-${username}`;
  const blocking: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      blocking.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    blocking.push(String(error));
  });

  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await navLink(page, "首页").click();
  await expect(page.getByRole("heading", { name: "今日概览" })).toBeVisible();
  await expect(page.getByText("今日安排")).toBeVisible();

  await navLink(page, "待办").click();
  await page.getByLabel("标题").fill(taskTitle);
  await page.getByRole("button", { name: "新建待办" }).click();
  await expect(page.getByText("待办已创建")).toBeVisible();
  await expect(page.getByText(taskTitle)).toBeVisible();

  await navLink(page, "日程").click();
  await page.getByLabel("标题").fill(eventTitle);
  const start = shanghaiLocalInput(new Date(Date.now() + 3_600_000));
  const end = shanghaiLocalInput(new Date(Date.now() + 7_200_000));
  await page.getByLabel("开始").fill(start);
  await page.getByLabel("结束").fill(end);
  await page.getByRole("button", { name: "新建日程" }).click();
  await expect(page.getByText("日程已创建")).toBeVisible();
  await expect(page.getByText(eventTitle)).toBeVisible();

  await navLink(page, "首页").click();
  await page
    .locator(".quick-actions-grid")
    .getByRole("link", { name: /^记一笔/ })
    .click();
  await page.getByLabel("金额（元）").fill("12.34");
  await page.getByLabel("时间").fill(start);
  await page.getByLabel("商户/说明").fill(merchant);
  await page.getByRole("button", { name: "保存" }).click();
  await page.waitForURL("**/transactions");
  await expect(page.getByText(merchant)).toBeVisible();

  await page.reload();
  await expect(page.getByText(merchant)).toBeVisible();
  await navLink(page, "待办").click();
  await expect(page.getByText(taskTitle)).toBeVisible();

  const unexpected = blocking.filter((text) =>
    /Access token is required|401|CORS|NetworkError|Failed to fetch/i.test(
      text,
    ),
  );
  expect(unexpected).toEqual([]);
});
