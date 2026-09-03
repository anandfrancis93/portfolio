// Keyboard helpers: what has focus, and whether it shows the design system's ring (a 2px solid
// outline in the focus colour, offset 2px, under :focus-visible) clear of the sticky header.
import { expect, type Page } from "@playwright/test";

export interface Stop {
  tag: string;
  id: string;
  text: string;
  outlineWidth: number;
  outlineStyle: string;
  outlineOffset: number;
  outlineColor: string;
  focusVisible: boolean;
  /** True when the element sits inside the header, or below the header's bottom edge. */
  clearOfHeader: boolean;
}

/** The focused element, or null when focus is on the body (the walk has wrapped). */
export async function activeStop(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    const header = document.querySelector("[data-site-header]");
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    const inHeader = header?.contains(el) ?? false;
    const skipLink = el.classList.contains("skip-link");
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id,
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
      outlineOffset: Number.parseFloat(style.outlineOffset),
      outlineColor: style.outlineColor,
      focusVisible: el.matches(":focus-visible"),
      clearOfHeader: inHeader || skipLink || el.getBoundingClientRect().top >= headerBottom,
    };
  });
}

/** Presses Tab until focus returns to the body, collecting every stop. */
export async function tabWalk(page: Page, limit = 60): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press("Tab");
    const stop = await activeStop(page);
    if (!stop) break;
    stops.push(stop);
  }
  return stops;
}

/** The ring as the design system defines it; `color` is the focus token in the active theme. */
export function expectRing(stop: Stop, color?: string): void {
  const label = `${stop.tag}#${stop.id || stop.text}`;
  expect(stop.focusVisible, `${label} is focus-visible`).toBe(true);
  expect(stop.outlineStyle, `${label} outline style`).toBe("solid");
  expect(stop.outlineWidth, `${label} outline width`).toBeGreaterThanOrEqual(2);
  expect(stop.outlineOffset, `${label} outline offset`).toBeGreaterThanOrEqual(2);
  if (color) expect(stop.outlineColor, `${label} outline colour`).toBe(color);
  expect(stop.clearOfHeader, `${label} is not under the sticky header`).toBe(true);
}
