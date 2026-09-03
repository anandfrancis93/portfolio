// Full-page screenshots of the home page at the seven widths of spec section 4 in both themes,
// and of the 404 page at the smallest and largest, attached to the report as artifacts for the
// reviewer to compare with the Figma frames (spec section 10, gate 10). No pixel baselines:
// the comparison is a human one.
import { test } from "@playwright/test";
import { revealAll } from "../helpers/page.ts";

const widths = [320, 390, 600, 768, 1024, 1280, 1440];
const themes = ["light", "dark"] as const;

for (const width of widths) {
  for (const theme of themes) {
    test(`home at ${width}px, ${theme}`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      await page.goto("/");
      await revealAll(page);
      const png = await page.screenshot({ fullPage: true });
      await testInfo.attach(`home-${width}-${theme}`, { body: png, contentType: "image/png" });
      await context.close();
    });
  }
}

for (const width of [390, 1440]) {
  test(`404 at ${width}px, light`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: "light",
    });
    const page = await context.newPage();
    await page.goto("/nope");
    const png = await page.screenshot({ fullPage: true });
    await testInfo.attach(`404-${width}-light`, { body: png, contentType: "image/png" });
    await context.close();
  });
}
