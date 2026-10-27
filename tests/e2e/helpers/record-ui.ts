import { expect, type Locator, type Page } from "@playwright/test";

/** Follow the visible disclosure path; never force-click a hidden command. */
export async function recordAction(
  scope: Page | Locator,
  name: string,
): Promise<Locator> {
  // `has` is resolved relative to each disclosure, so its locator must not
  // carry a parent card selector from the caller's scope.
  const page = "page" in scope ? scope.page() : scope;
  const command = page.getByRole("button", {
    name,
    exact: true,
    includeHidden: true,
  });
  const disclosure = scope
    .locator("details.record-more")
    .filter({ has: command });
  await expect(disclosure).toHaveCount(1);
  if (!(await disclosure.evaluate((element) => element.hasAttribute("open")))) {
    await disclosure.locator("summary").click();
  }
  const visibleCommand = disclosure.getByRole("button", { name, exact: true });
  await expect(visibleCommand).toBeVisible();
  return visibleCommand;
}
