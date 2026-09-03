// The experience entries: a real button inside each role heading, the first open and the rest
// collapsed once scripts run, every one open without them, and each toggle moving its own
// panel in and out of the accessibility tree. Written in phase E; phase G wires the config.
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { loadProfile } from "../../src/content/profile.ts";

const profile = loadProfile(
  readFileSync(new URL("../../src/content/profile.yaml", import.meta.url), "utf8"),
);
const roles = profile.experience.roles;

const toggles = (page: Page) => page.locator("#experience h3 > button[aria-expanded]");

async function panelOf(page: Page, toggle: Locator): Promise<Locator> {
  const id = await toggle.getAttribute("aria-controls");
  expect(id).toBeTruthy();
  return page.locator(`#${id}`);
}

test.describe("experience disclosures", () => {
  test("every role has a button in its heading; the first is open, the rest collapsed", async ({
    page,
  }) => {
    await page.goto("/");
    const buttons = toggles(page);
    await expect(buttons).toHaveCount(roles.length);
    for (const [index, role] of roles.entries()) {
      const button = buttons.nth(index);
      await expect(button).toContainText(role.title);
      await expect(button).toHaveAttribute("aria-expanded", index === 0 ? "true" : "false");
      const panel = await panelOf(page, button);
      if (index === 0) {
        await expect(panel).toBeVisible();
      } else {
        // Out of the layout and the accessibility tree, not merely collapsed to no height.
        await expect(panel).toBeHidden();
        await expect(panel).toHaveJSProperty("hidden", true);
      }
    }
    for (const bullet of roles[0].bullets) {
      await expect(page.locator("#experience")).toContainText(bullet);
    }
  });

  test("a toggle opens and closes its own panel with the pointer and the keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    const second = toggles(page).nth(1);
    const panel = await panelOf(page, second);

    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("listitem")).toHaveCount(roles[1].bullets.length);

    await second.focus();
    await page.keyboard.press("Enter");
    await expect(second).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await expect(panel).toHaveJSProperty("hidden", true);

    await page.keyboard.press("Space");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();

    // Entries are independent: opening one does not close another.
    await expect(toggles(page).first()).toHaveAttribute("aria-expanded", "true");
  });

  test("under reduced motion the state still changes", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const third = toggles(page).nth(2);
    const panel = await panelOf(page, third);
    await third.click();
    await expect(panel).toBeVisible();
    await third.click();
    await expect(panel).toBeHidden();
    await expect(panel).toHaveJSProperty("hidden", true);
  });

  test("without JavaScript every entry is expanded", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    const buttons = toggles(page);
    await expect(buttons).toHaveCount(roles.length);
    for (let index = 0; index < roles.length; index += 1) {
      await expect(buttons.nth(index)).toHaveAttribute("aria-expanded", "true");
      await expect(await panelOf(page, buttons.nth(index))).toBeVisible();
    }
    await context.close();
  });
});
