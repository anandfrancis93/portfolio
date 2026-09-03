// Reflow (spec section 10, gate 5): no horizontal scrolling at 320px, nothing clipped with the
// page at 200%, and the layout survives forced text spacing (WCAG 1.4.12). Both themes (the
// project sets the scheme). Browser zoom at 200% on a 1440px window lays the page out in a
// 720px viewport at twice the density, so that is how it is emulated. The forced-spacing
// sheet is injected, which the served CSP forbids, so those tests bypass it.
import { expect, test, type Page } from "@playwright/test";
import { openAllEntries, profile, revealAll } from "../helpers/page.ts";

// WCAG 1.4.12: line height 1.5, paragraph spacing 2em, letter spacing 0.12em, word spacing 0.16em.
const forcedSpacing = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p { margin-bottom: 2em !important; }
`;

async function noHorizontalScroll(page: Page) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll, "document scroll width").toBeLessThanOrEqual(widths.client);
}

/** Controls whose text must stay inside their box: overflow would mean clipped words. */
async function nothingClipped(page: Page) {
  const clipped = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        ".btn, .site-nav__link, .badge, .experience__toggle, .skills__label",
      ),
    ]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .map((el) => `${el.className}: ${el.textContent?.trim().slice(0, 30)}`),
  );
  expect(clipped).toEqual([]);
}

test.describe("at 320px", () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test("no horizontal scroll at rest, with every entry open, and with the menu open", async ({
    page,
  }) => {
    await page.goto("/");
    await revealAll(page);
    await noHorizontalScroll(page);
    await openAllEntries(page);
    await noHorizontalScroll(page);
    await page.getByRole("button", { name: profile.ui.menu.open }).click();
    await noHorizontalScroll(page);
  });
});

test.describe("at 1440px zoomed to 200%", () => {
  test.use({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });

  test("nothing is clipped and no horizontal scroll is needed", async ({ page }) => {
    await page.goto("/");
    await revealAll(page);
    await openAllEntries(page);
    await noHorizontalScroll(page);
    await nothingClipped(page);
  });
});

for (const width of [320, 1440]) {
  test.describe(`forced text spacing at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 }, bypassCSP: true });

    test("no horizontal scroll and nothing clipped", async ({ page }) => {
      await page.goto("/");
      await revealAll(page);
      await openAllEntries(page);
      await page.addStyleTag({ content: forcedSpacing });
      await page.waitForTimeout(200);
      await noHorizontalScroll(page);
      await nothingClipped(page);
    });
  });
}
