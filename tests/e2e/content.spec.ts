// The built home page carries the copy from profile.yaml, verbatim. Written in phase C and
// extended in phase E as each section landed; phase G wires the Playwright config that runs it.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  formatCertificationLine,
  formatEducationLine,
  formatSpan,
  loadProfile,
} from "../../src/content/profile.ts";

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

  test("experience lists every role with its span, organization and bullets", async ({ page }) => {
    const section = page.locator("#experience");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText(profile.experience.heading);
    const entries = section.locator("[data-disclosure]");
    await expect(entries).toHaveCount(profile.experience.roles.length);
    for (const [index, role] of profile.experience.roles.entries()) {
      const entry = entries.nth(index);
      await expect(entry.getByRole("heading", { level: 3 })).toContainText(role.title);
      await expect(entry.getByText(formatSpan(role), { exact: true })).toBeVisible();
      await expect(entry.getByText(role.org, { exact: true })).toBeVisible();
      // Collapsed bullets are still in the document, verbatim, even when not exposed.
      for (const bullet of role.bullets) {
        await expect(entry.locator("li", { hasText: bullet })).toHaveCount(1);
      }
    }
  });

  test("projects shows the empty state and its one action", async ({ page }) => {
    const section = page.locator("#projects");
    await expect(section).toContainText(profile.projects.lede);
    await expect(section).toContainText(profile.projects.empty.body);
    await expect(
      section.getByRole("link", { name: profile.projects.empty.action.label }),
    ).toHaveAttribute("href", profile.projects.empty.action.href);
  });

  test("about carries the paragraphs, education and certifications", async ({ page }) => {
    const section = page.locator("#about");
    for (const paragraph of profile.about.paragraphs) {
      await expect(section.getByText(paragraph, { exact: true })).toBeVisible();
    }
    for (const entry of profile.about.education.entries) {
      await expect(section.getByRole("heading", { level: 3, name: entry.title })).toBeVisible();
      await expect(section).toContainText(formatEducationLine(entry));
    }
    for (const entry of profile.about.certifications.entries) {
      await expect(section.getByRole("heading", { level: 3, name: entry.title })).toBeVisible();
      await expect(section).toContainText(formatCertificationLine(entry));
    }
  });

  test("skills is a definition list of every group and its items", async ({ page }) => {
    const rows = page.locator("#skills dl > div");
    await expect(rows).toHaveCount(profile.skills.groups.length);
    for (const [index, group] of profile.skills.groups.entries()) {
      await expect(rows.nth(index).locator("dt")).toHaveText(group.label);
      await expect(rows.nth(index).locator("dd")).toHaveText(group.items.join(" · "));
    }
  });

  test("recommendation is verbatim and attributed", async ({ page }) => {
    const section = page.locator("#recommendations");
    for (const entry of profile.recommendations.entries) {
      const figure = section.locator("figure", { hasText: entry.name });
      await expect(figure.locator("blockquote")).toContainText(entry.quote);
      await expect(figure.locator("blockquote")).toHaveAttribute("cite", entry.source);
      await expect(figure.locator("figcaption")).toContainText(entry.name);
      await expect(figure.locator("figcaption")).toContainText(entry.title);
    }
  });

  test("contact, résumé link and footer landmark links", async ({ page }) => {
    await expect(page.getByRole("link", { name: profile.identity.email })).toHaveAttribute(
      "href",
      `mailto:${profile.identity.email}`,
    );
    const contact = page.locator("#contact");
    // The QR link is named with the format and size; the sentinel must have been replaced.
    await expect(contact.getByRole("link", { name: /^Résumé \(PDF, / })).toHaveAttribute(
      "href",
      profile.contact.resume.href,
    );
    await expect(contact).toContainText(profile.contact.resume.caption);
    const footer = page.getByRole("contentinfo");
    for (const link of profile.footer.links) {
      await expect(footer.getByRole("link", { name: link.label })).toHaveAttribute(
        "href",
        link.href,
      );
    }
  });

  test("the résumé size sentinel is replaced by the build", async ({ page }) => {
    // Phase F's finalize step writes the real size; remove this line when it lands.
    test.fixme(true, "the sentinel is replaced in phase F");
    await expect(page.locator("body")).not.toContainText("__RESUME_SIZE__");
  });
});
