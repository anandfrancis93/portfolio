// axe-core over the built pages in both themes (the project sets the scheme): the home page at
// rest and with every entry open, the menu open on the small viewport, and the 404 page. The
// target-size rule, off by default in axe, is on: the design system asks for 24px targets.
// Spec section 10, gate 2.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openAllEntries, profile, revealAll } from "../helpers/page.ts";

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .options({ rules: { "target-size": { enabled: true } } })
    .analyze();
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

for (const width of [1440, 390]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("the home page has no violations at rest or with every entry open", async ({ page }) => {
      await page.goto("/");
      await revealAll(page);
      expect(await violations(page)).toEqual([]);
      await openAllEntries(page);
      expect(await violations(page)).toEqual([]);
    });

    test("the 404 page has no violations", async ({ page }) => {
      const response = await page.goto("/nope");
      expect(response?.status()).toBe(404);
      expect(await violations(page)).toEqual([]);
    });

    if (width < 768) {
      test("the open menu has no violations", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: profile.ui.menu.open }).click();
        await expect(page.getByRole("dialog", { name: profile.ui.menu.label })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });
    }
  });
}
