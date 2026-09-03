// The mobile menu (spec 3.1): opens with focus on the first link, keeps focus off the page
// behind it, closes on Escape with focus back on the button, and following a link closes it
// and lands on the section.
import { expect, test } from "@playwright/test";
import { profile } from "../helpers/page.ts";

const { ui, nav, identity } = profile;

test.use({ viewport: { width: 390, height: 844 } });

test("opens with focus on the first link, traps focus, and Escape returns it", async ({ page }) => {
  await page.goto("/");
  const open = page.getByRole("button", { name: ui.menu.open });
  await open.click();

  const dialog = page.getByRole("dialog", { name: ui.menu.label });
  await expect(dialog).toBeVisible();
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(dialog.getByRole("link", { name: nav[0].label })).toBeFocused();

  // However far Tab goes, focus is inside the dialog or, at the wrap-around, on the browser
  // itself (the body); it never lands on the inert page behind.
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    const escaped = await page.evaluate(() => {
      const el = document.activeElement;
      return el !== null && el !== document.body && el.closest("dialog") === null;
    });
    expect(escaped, `Tab ${i + 1} left the dialog for the page`).toBe(false);
  }
  await expect(dialog.getByRole("link", { name: identity.email })).toHaveAttribute(
    "href",
    `mailto:${identity.email}`,
  );

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(open).toBeFocused();
});

test("the close button closes it and returns focus", async ({ page }) => {
  await page.goto("/");
  const open = page.getByRole("button", { name: ui.menu.open });
  await open.click();
  const dialog = page.getByRole("dialog", { name: ui.menu.label });
  await dialog.getByRole("button", { name: ui.menu.close }).click();
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test("following a link closes the menu and lands on the section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: ui.menu.open }).click();
  const dialog = page.getByRole("dialog", { name: ui.menu.label });
  const about = nav.find((item) => item.href === "#about") ?? nav[2];
  await dialog.getByRole("link", { name: about.label }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${about.href}$`));
  const box = await page.locator(about.href).boundingBox();
  const header = await page.locator("[data-site-header]").boundingBox();
  expect(box).not.toBeNull();
  expect(header).not.toBeNull();
  // The section's top sits below the sticky header and inside the viewport.
  expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
  expect(box!.y).toBeLessThan(200);
});
