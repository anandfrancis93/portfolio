// The keyboard walk of spec section 10, gate 3: every interactive element in the spec's order,
// each with the 2px ring in the theme's focus colour and clear of the sticky header (WCAG
// 2.4.11), in both themes (the project sets the scheme). On the small viewport the header
// offers the menu button instead of the links.
import { expect, test } from "@playwright/test";
import { activeStop, expectRing, tabWalk } from "../helpers/focus.ts";
import { profile, tokenColor } from "../helpers/page.ts";

const { ui, nav, hero, experience, projects, identity, footer, contact } = profile;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const themeToggle = new RegExp(`^(${escape(ui.theme.toDark)}|${escape(ui.theme.toLight)})$`);
const resumeLink = new RegExp(`^${escape(contact.resume.label)} \\(PDF, `);

test.describe("at 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("tabs through the 23 stops in order, each with the ring", async ({ page, colorScheme }) => {
    const ring = tokenColor("--color-border-focus", colorScheme === "dark" ? "dark" : "light");
    await page.goto("/");
    const expected: Array<string | RegExp> = [
      ui.skipLink,
      identity.wordmark,
      ...nav.map((item) => item.label),
      themeToggle,
      ...hero.actions.map((action) => action.label),
      ...experience.roles.map((role) => new RegExp(`^${escape(role.title)}`)),
      projects.empty.action.label,
      identity.email,
      resumeLink,
      ...footer.links.map((link) => link.label),
    ];
    expect(expected).toHaveLength(23);

    for (const name of expected) {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toHaveAccessibleName(name);
      const stop = await activeStop(page);
      expect(stop).not.toBeNull();
      expectRing(stop!, ring);
    }
    // Nothing else is focusable: the next Tab leaves the page.
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveCount(0);
  });
});

test.describe("at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the header offers the skip link, wordmark, toggle and menu button, then the page", async ({
    page,
    colorScheme,
  }) => {
    const ring = tokenColor("--color-border-focus", colorScheme === "dark" ? "dark" : "light");
    await page.goto("/");
    const head = [ui.skipLink, identity.wordmark, themeToggle, ui.menu.open, hero.actions[0].label];
    for (const name of head) {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toHaveAccessibleName(name);
    }
    const stops = await tabWalk(page);
    expect(stops.length).toBeGreaterThan(10);
    for (const stop of stops) expectRing(stop, ring);
  });
});
