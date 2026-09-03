// Page helpers shared by the suites: the content file, the token sheet's colours, and the
// reveal state, which must be settled before axe or a screenshot looks at a section.
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { loadProfile } from "../../src/content/profile.ts";

export const profile = loadProfile(
  readFileSync(new URL("../../src/content/profile.yaml", import.meta.url), "utf8"),
);

const tokens = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

/** A colour token's value in one theme, as the browser reports it (rgb(r, g, b)). */
export function tokenColor(name: string, theme: "light" | "dark"): string {
  const hex = tokenHex(name, theme);
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** A colour token's value in one theme, as the token sheet writes it (#rrggbb). */
export function tokenHex(name: string, theme: "light" | "dark"): string {
  const block =
    theme === "light"
      ? /:root,\s*\[data-theme="light"\]\s*\{([^}]*)\}/.exec(tokens)
      : /\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(tokens);
  const hex = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(block?.[1] ?? "")?.[1];
  if (!hex) throw new Error(`${name} is not in the ${theme} block of tokens.css`);
  return hex;
}

/** Marks every section revealed and waits for the fade, so nothing is judged mid-transition. */
export async function revealAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-reveal]")) el.classList.add("is-visible");
  });
  await page.waitForTimeout(400);
}

/** Opens every collapsed experience entry. */
export async function openAllEntries(page: Page): Promise<void> {
  const toggles = page.locator('#experience button[data-disclosure-toggle][aria-expanded="false"]');
  const count = await toggles.count();
  for (let i = 0; i < count; i += 1) await toggles.first().click();
  await page.waitForTimeout(400);
}
