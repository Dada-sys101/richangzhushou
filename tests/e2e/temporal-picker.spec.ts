import { expect, test } from "@playwright/test";

import {
  createActiveUserViaApi,
  E2E_ACTIVE_PASSWORD,
  loginViaUi,
  uniqueName,
} from "./helpers/e2e";

test("必填提醒时间默认选中今天且可确认", async ({ page, request }) => {
  const username = uniqueName("qa_temporal_picker");
  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await page.goto("/reminders");

  await page.getByLabel("首次时间").click();
  const dialog = page.getByRole("dialog", { name: "选择日期和时间" });
  const today = dialog.locator(".calendar-grid button.today");
  const confirm = dialog.getByRole("button", { name: "确定", exact: true });

  await expect(today).toHaveClass(/selected/);
  await expect(confirm).toBeEnabled();
  for (const width of [375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ height: 900, width });
    await expect(today).toBeVisible();
    await expect(confirm).toBeEnabled();
  }
});
