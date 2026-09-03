// The résumé PDF the build writes: at most two pages, titled, in English, tagged in the site's
// heading order, every role present with the older ones trimmed to their first bullets, and
// linked from the page with its format and its real size. Reads dist directly; phase G's
// config runs it after the build.
import { readFileSync, statSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadProfile, resumeBullets } from "../src/content/profile.ts";

const profile = loadProfile(
  readFileSync(new URL("../src/content/profile.yaml", import.meta.url), "utf8"),
);
const pdfPath = new URL(`../dist/${profile.resume.filename}`, import.meta.url);
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

interface StructNode {
  role?: string;
  children?: StructNode[];
}

/** Heading roles (H1, H2, H3...) in reading order through a page's structure tree. */
function headingRoles(node: StructNode | null, out: string[]): string[] {
  if (!node) return out;
  if (node.role && /^H[1-6]$/.test(node.role)) out.push(node.role);
  for (const child of node.children ?? []) headingRoles(child, out);
  return out;
}

async function readPdf(): Promise<{
  pages: number;
  text: string;
  title: unknown;
  language: unknown;
  headings: string[];
}> {
  const data = new Uint8Array(readFileSync(pdfPath));
  const task = getDocument({ data, verbosity: 0 });
  const doc = await task.promise;
  const parts: string[] = [];
  const headings: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    parts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    headingRoles((await page.getStructTree()) as StructNode | null, headings);
  }
  const { info } = await doc.getMetadata();
  const result = {
    pages: doc.numPages,
    text: squash(parts.join(" ")),
    title: (info as { Title?: unknown }).Title,
    language: (info as { Language?: unknown }).Language,
    headings,
  };
  await task.destroy();
  return result;
}

test.describe("the résumé PDF", () => {
  test("is at most two pages, titled, in English, and tagged in the heading order", async () => {
    const pdf = await readPdf();
    expect(pdf.pages).toBeLessThanOrEqual(2);
    expect(pdf.title).toBe(profile.resume.title);
    expect(pdf.language).toBe("en");
    // Tagged: a structure tree with one H1 first, the sections as H2, the entries as H3.
    expect(pdf.headings[0]).toBe("H1");
    expect(pdf.headings.filter((h) => h === "H1")).toHaveLength(1);
    expect(pdf.headings.filter((h) => h === "H2")).toHaveLength(5);
    expect(pdf.headings.filter((h) => h === "H3")).toHaveLength(
      profile.experience.roles.length +
        profile.about.education.entries.length +
        profile.about.certifications.entries.length,
    );
    expect(pdf.headings).not.toContain("H4");
  });

  test("carries every role, the older ones trimmed to their first bullets", async () => {
    const { text } = await readPdf();
    expect(text).toContain(profile.identity.name);
    expect(text).toContain(profile.identity.email);
    for (const role of profile.experience.roles) {
      expect(text).toContain(role.title);
      const shown = resumeBullets(role, profile.resume.olderRoles);
      for (const bullet of shown) expect(text).toContain(squash(bullet).slice(0, 30));
      for (const bullet of role.bullets.slice(shown.length)) {
        expect(text).not.toContain(squash(bullet).slice(0, 30));
      }
    }
    for (const entry of profile.about.certifications.entries) expect(text).toContain(entry.title);
  });

  test("embeds IBM Plex Sans in every weight it sets", async () => {
    const bytes = readFileSync(pdfPath).toString("latin1");
    for (const face of ["IBMPlexSans-Regular", "IBMPlexSans-Medium", "IBMPlexSans-SemiBold"]) {
      expect(bytes).toContain(face);
    }
    expect(bytes).toContain("/FontFile2");
  });

  test("is linked from the page with its format and real size", async ({ page }) => {
    const size = `${Math.round(statSync(pdfPath).size / 1024)} KB`;
    await page.goto("/");
    const link = page.locator("#contact").getByRole("link", { name: /^Résumé \(PDF, / });
    await expect(link).toHaveAccessibleName(`${profile.contact.resume.label} (PDF, ${size})`);
    await expect(link).toHaveAttribute("href", profile.contact.resume.href);
  });
});
