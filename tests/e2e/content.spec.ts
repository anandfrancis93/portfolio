// The built home page carries the copy from profile.yaml, verbatim. Written in phase C; runs
// from phase E once the sections exist and phase G wires the Playwright config.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { formatSpan, loadProfile } from "../../src/content/profile.ts";

const profile = loadProfile(
  readFileSync(new URL("../../src/content/profile.yaml", import.meta.url), "utf8"),
);

test.describe("content matches profile.yaml", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(profile.hero.heading);
    await expect(page.getByText(profile.hero.badge, { exact: true })).toBeVisible();
    for (const action of profile.hero.actions) {
      await expect(page.getByRole("link", { name: action.label })).toHaveAttribute(
        "href",
        action.href,
      );
    }
  });

  test("experience lists every role with its span", async ({ page }) => {
    const section = page.locator("#experience");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText(profile.experience.heading);
    for (const role of profile.experience.roles) {
      const entry = section.getByRole("listitem").filter({ hasText: role.title });
      await expect(entry.getByRole("heading", { level: 3, name: role.title })).toBeVisible();
      await expect(entry.getByText(formatSpan(role), { exact: true })).toBeVisible();
    }
  });

  test("about carries the paragraphs, education and certifications", async ({ page }) => {
    const section = page.locator("#about");
    for (const paragraph of profile.about.paragraphs) {
      await expect(section.getByText(paragraph, { exact: true })).toBeVisible();
    }
    for (const entry of profile.about.certifications.entries) {
      await expect(section.getByRole("heading", { level: 3, name: entry.title })).toBeVisible();
    }
  });

  test("recommendation is verbatim", async ({ page }) => {
    const entry = profile.recommendations.entries[0];
    await expect(page.locator("#recommendations blockquote")).toContainText(entry.quote);
    await expect(page.locator("#recommendations")).toContainText(entry.name);
  });

  test("contact, résumé link text and footer landmark links", async ({ page }) => {
    await expect(page.getByRole("link", { name: profile.identity.email })).toHaveAttribute(
      "href",
      `mailto:${profile.identity.email}`,
    );
    // The size sentinel must have been replaced by the build.
    await expect(page.locator("body")).not.toContainText("__RESUME_SIZE__");
    const footer = page.getByRole("contentinfo");
    for (const link of profile.footer.links) {
      await expect(footer.getByRole("link", { name: link.label })).toHaveAttribute(
        "href",
        link.href,
      );
    }
  });
});
