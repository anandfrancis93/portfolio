// The theme: follows the OS scheme (the project sets it) until the toggle is used, then the
// choice wins, is stored, survives a reload through the inline bootstrap, keeps the browser
// chrome colour in step, and the toggle names the theme it leads to. Spec section 5.
import { expect, test } from "@playwright/test";
import { profile, tokenColor, tokenHex } from "../helpers/page.ts";

const { theme } = profile.ui;
const labelFor = (scheme: "light" | "dark") => (scheme === "dark" ? theme.toLight : theme.toDark);

test("follows the OS scheme, then the toggle wins and persists", async ({ page, colorScheme }) => {
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const next = scheme === "dark" ? "light" : "dark";
  await page.goto("/");

  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", /./);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    tokenColor("--color-bg-canvas", scheme),
  );

  const toggle = page.locator("[data-theme-toggle]");
  await expect(toggle).toHaveAccessibleName(labelFor(scheme));
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", next);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    tokenColor("--color-bg-canvas", next),
  );
  await expect(toggle).toHaveAccessibleName(labelFor(next));
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(next);

  // A forced theme collapses both theme-color metas to that theme's canvas.
  const metas = await page
    .locator('meta[name="theme-color"]')
    .evaluateAll((els) => els.map((el) => [el.getAttribute("media"), el.getAttribute("content")]));
  expect(metas.length).toBeGreaterThan(0);
  for (const [media, content] of metas) {
    expect(media).toBeNull();
    expect(content).toBe(tokenHex("--color-bg-canvas", next));
  }

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", next);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    tokenColor("--color-bg-canvas", next),
  );
});

test("the bootstrap runs before any stylesheet, so a stored theme cannot flash", async ({
  page,
}) => {
  const response = await page.goto("/");
  const html = (await response?.text()) ?? "";
  const script = html.indexOf("<script>");
  const stylesheet = html.search(/<link[^>]+rel="stylesheet"/);
  expect(script).toBeGreaterThan(-1);
  expect(stylesheet).toBeGreaterThan(-1);
  expect(script).toBeLessThan(stylesheet);
});
