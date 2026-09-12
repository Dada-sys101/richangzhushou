import { expect, test } from "@playwright/test";

import {
  createActiveUserViaApi,
  E2E_ACTIVE_PASSWORD,
  loginViaUi,
  shanghaiLocalInput,
  uniqueName,
} from "./helpers/e2e";

test("MOBILE-A root tabs do not accumulate history before list and detail navigation", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_mobile_nav");
  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");

  const rootTargets = ["/", "/records", "/plan", "/account", "/"];
  const rootNavigation = page.locator(
    (await page.locator(".bottom-nav").isVisible())
      ? ".bottom-nav"
      : ".site-nav",
  );
  for (let cycle = 0; cycle < 20; cycle += 1) {
    for (const target of rootTargets) {
      await rootNavigation.locator(`a[href="${target}"]`).click();
      await expect(page).toHaveURL(
        new RegExp(`${target === "/" ? "/$" : `${target}$`}`),
      );
    }
  }

  await rootNavigation.locator('a[href="/plan"]').click();
  const taskTitle = uniqueName("qa_mobile_history");
  await page.goto("/tasks");
  await page.getByLabel("标题").fill(taskTitle);
  await page.getByRole("button", { name: "新建待办" }).click();
  await page.getByRole("link", { name: "查看", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/[^/]+\?returnTo=%2Ftasks/);

  await page.getByRole("button", { name: "返回待办" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
});

test("MOBILE-A direct detail entry seeds the same fallback for app and browser back", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_mobile_deep");
  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");

  const taskTitle = uniqueName("qa_mobile_deep_task");
  await page.goto("/tasks");
  await page.getByLabel("标题").fill(taskTitle);
  await page.getByRole("button", { name: "新建待办" }).click();
  await page.getByRole("link", { name: "查看", exact: true }).click();
  const detailUrl = page.url().replace(/\?returnTo=.*$/, "");

  await page.goto(detailUrl);
  await page.getByRole("button", { name: "返回计划" }).click();
  await expect(page).toHaveURL(/\/plan$/);

  await page.goto(detailUrl);
  await page.goBack();
  await expect(page).toHaveURL(/\/plan$/);
});

test("统一页面壳保留来源、拦截未保存离开并支持刷新", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_shell_login");
  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");

  await page.goto("/records");
  await expect(page.getByRole("heading", { name: "记录中心" })).toBeVisible();
  await expect(page.getByRole("button", { name: /返回/ })).toHaveCount(0);

  const merchant = uniqueName("qa_shell_tx");
  const transactionTime = shanghaiLocalInput(new Date());
  await page.goto("/transactions/new?returnTo=%2Frecords");
  await page.getByLabel("金额（元）").fill("3.00");
  await page.getByLabel("时间").fill(transactionTime);
  await page.getByLabel("商户/说明").fill(merchant);
  await page.getByRole("button", { name: "保存" }).click();
  await page.waitForURL("**/records");
  await expect(page.getByText(merchant)).toBeVisible();
  await page
    .getByRole("link", { name: new RegExp(merchant) })
    .first()
    .click();
  await page.waitForURL(/\/transactions\/[^/]+\/edit\?returnTo=/);
  await expect(page.getByRole("button", { name: "返回记录" })).toBeVisible();
  await page.getByRole("button", { name: "返回记录" }).click();
  await expect(page).toHaveURL(/\/records$/);

  await page.goto("/transactions/new?returnTo=%2Frecords%3Ftab%3Dpending");
  await page.getByRole("link", { name: "取消" }).click();
  await expect(page).toHaveURL(/\/records\?tab=pending/);

  await page.goto("/transactions/new?returnTo=%2Frecords%3Ftab%3Dpending");
  await expect(page.getByRole("button", { name: "返回记录" })).toBeVisible();
  await page.getByLabel("金额（元）").fill("1.00");
  await page.getByRole("button", { name: "返回记录" }).click();
  await expect(
    page.getByRole("dialog", { name: "放弃未保存的内容？" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions\/new\?returnTo=/);

  await page.getByRole("button", { name: "返回记录" }).click();
  await page.getByRole("button", { name: "离开", exact: true }).click();
  await expect(page).toHaveURL(/\/records\?tab=pending/);

  await page.goto(
    "/tasks/missing-task?returnTo=https%3A%2F%2Fevil.example%2Fleave",
  );
  await expect(page.getByRole("button", { name: "返回计划" })).toBeVisible();
  await page.getByRole("button", { name: "返回计划" }).click();
  await expect(page).toHaveURL(/\/plan$/);

  const taskTitle = uniqueName("qa_shell_task");
  await page.goto("/tasks");
  await page.getByLabel("标题").fill(taskTitle);
  await page.getByRole("button", { name: "新建待办" }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();
  await page.getByRole("link", { name: "查看", exact: true }).click();
  await page.waitForURL(/\/tasks\/[^/]+\?returnTo=%2Ftasks/);
  await expect(page.getByRole("button", { name: "返回待办" })).toBeVisible();
  await page.getByRole("button", { name: "返回待办" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await page.goto("/plan?range=month");
  await page
    .getByRole("link", { name: new RegExp(taskTitle) })
    .first()
    .click();
  await page.waitForURL(/\/tasks\/[^/]+\?returnTo=/);
  await expect(page.getByRole("button", { name: "返回计划" })).toBeVisible();
  await page.getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("标题").fill(`${taskTitle}_edited`);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText(`${taskTitle}_edited`)).toBeVisible();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await expect(page.getByText("已完成", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
  await expect(page.getByText("已删除，可恢复")).toBeVisible();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(page.getByText("已完成", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回计划" }).click();
  await expect(page).toHaveURL(/\/plan\?range=month/);

  const eventTitle = uniqueName("qa_shell_event");
  const eventStart = shanghaiLocalInput(new Date(Date.now() + 3_600_000));
  const eventEnd = shanghaiLocalInput(new Date(Date.now() + 7_200_000));
  await page.goto("/calendar");
  await page.getByLabel("标题").fill(eventTitle);
  await page.getByLabel("开始").fill(eventStart);
  await page.getByLabel("结束").fill(eventEnd);
  await page.getByRole("button", { name: "新建日程" }).click();
  await expect(page.getByText(eventTitle)).toBeVisible();
  await page.getByRole("link", { name: "查看", exact: true }).click();
  await page.waitForURL(/\/calendar\/[^/]+\?returnTo=%2Fcalendar/);
  await expect(page.getByRole("button", { name: "返回日程" })).toBeVisible();
  await page.getByRole("button", { name: "返回日程" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await page.goto("/plan?range=month");
  await page
    .getByRole("link", { name: new RegExp(eventTitle) })
    .first()
    .click();
  await page.waitForURL(/\/calendar\/[^/]+\?returnTo=/);
  await expect(page.getByRole("button", { name: "返回计划" })).toBeVisible();
  await page.getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("标题").fill(`${eventTitle}_edited`);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText(`${eventTitle}_edited`)).toBeVisible();
  await page.getByRole("button", { name: "取消日程" }).click();
  await expect(page.getByText("已取消", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
  await expect(page.getByText("已删除，可恢复")).toBeVisible();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await page.getByRole("button", { name: "返回计划" }).click();
  await expect(page).toHaveURL(/\/plan\?range=month/);

  const reminderTitle = uniqueName("qa_shell_reminder");
  const reminderTime = shanghaiLocalInput(new Date(Date.now() + 10_800_000));
  await page.goto("/reminders");
  await page.getByLabel("标题").fill(reminderTitle);
  await page.getByLabel("首次时间").fill(reminderTime);
  await page.getByRole("button", { name: "新建提醒" }).click();
  await expect(page.getByText(reminderTitle)).toBeVisible();
  await page.getByRole("link", { name: "查看", exact: true }).click();
  await page.waitForURL(/\/reminders\/[^/]+\?returnTo=%2Freminders/);
  await expect(page.getByRole("button", { name: "返回提醒" })).toBeVisible();
  await page.getByRole("button", { name: "返回提醒" }).click();
  await expect(page).toHaveURL(/\/reminders$/);
  await page.goto("/plan?range=month");
  await page
    .getByRole("link", { name: new RegExp(reminderTitle) })
    .first()
    .click();
  await page.waitForURL(/\/reminders\/[^/]+\?returnTo=/);
  await expect(page.getByRole("button", { name: "返回计划" })).toBeVisible();
  await page.getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("标题").fill(`${reminderTitle}_edited`);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText(`${reminderTitle}_edited`)).toBeVisible();
  await page.getByRole("button", { name: "取消提醒" }).click();
  await expect(page.getByText("已取消", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "重新安排" }).click();
  await expect(page.getByText("待发送")).toBeVisible();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
  await expect(page.getByText("已删除，可恢复")).toBeVisible();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await page.getByRole("button", { name: "返回计划" }).click();
  await expect(page).toHaveURL(/\/plan\?range=month/);

  await page.goto("/plan?range=week");
  await page.goto("/calendar/missing-event?returnTo=%2Fplan%3Frange%3Dweek");
  await page.reload();
  await expect(page.getByRole("button", { name: "返回计划" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/plan\?range=week/);
});
