// Under prefers-reduced-motion every duration token is zero and the catch-all leaves 0.01ms:
// reveals show at once with no rise, the disclosures and the theme still change state.
// Spec section 10, gate 6, in both themes (the project sets the scheme).
import { expect, test } from "@playwright/test";
import { profile } from "../helpers/page.ts";

test.use({ contextOptions: { reducedMotion: "reduce" }, viewport: { width: 1440, height: 900 } });

const toMs = (value: string) => {
  const first = value.split(",")[0].trim();
  const n = Number.parseFloat(first);
  return first.endsWith("ms") ? n : n * 1000;
};

test("durations collapse and the state changes remain", async ({ page }) => {
  await page.goto("/");

  const durations = await page.evaluate(() => {
    const of = (selector: string) =>
      getComputedStyle(document.querySelector(selector) as Element).transitionDuration;
    return {
      panel: of("#experience-1-panel"),
      chevron: of("#experience-1-toggle .experience__chevron"),
      // A section below the fold, which reveal.ts has marked to reveal.
      section: of("#contact"),
      button: of(".btn"),
    };
  });
  for (const [what, value] of Object.entries(durations)) {
    expect(toMs(value), `${what} transition duration`).toBeLessThanOrEqual(0.01);
  }

  // Reveals: sections below the fold appear at once, with no rise.
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await expect(page.locator("#contact")).toHaveCSS("opacity", "1");
  await expect(page.locator("#contact")).toHaveCSS("translate", /^(none|0px( 0px)?)$/);

  // Disclosures still open and close.
  const second = page.locator("#experience-2-toggle");
  const panel = page.locator("#experience-2-panel");
  await second.click();
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await second.click();
  await expect(second).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();

  // The theme still switches.
  const toggle = page.getByRole("button", {
    name: new RegExp(`^(${profile.ui.theme.toDark}|${profile.ui.theme.toLight})$`),
  });
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", /^(light|dark)$/);
});
