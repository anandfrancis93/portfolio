// Renders the built /resume-print page to the résumé PDF with Chromium: US Letter, tagged, with
// an outline, the site's fonts embedded, the CSS page size respected. Serves dist on a free
// port so the page loads its assets as it will on the Worker. Fails the build if the page is
// missing or the PDF runs past two pages (spec section 7). The size is never committed; the
// finalize step reads it from the file.
//   node scripts/build-pdf.mjs   (after astro build)
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadProfile } from "../src/content/profile.ts";
import { serveDist } from "./lib/serve-dist.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const profile = loadProfile(readFileSync(resolve(root, "src/content/profile.yaml"), "utf8"));
const target = resolve(dist, profile.resume.filename);

if (!existsSync(resolve(dist, "resume-print/index.html"))) {
  console.error("dist/resume-print/index.html is missing: run astro build first.");
  process.exit(1);
}

const server = await serveDist(dist);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${server.url}/resume-print/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: target,
    format: "Letter",
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
    outline: true,
  });
} finally {
  await browser.close();
  await server.close();
}

const bytes = readFileSync(target);
const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
const pages = (await task.promise).numPages;
await task.destroy();
if (pages > 2) {
  console.error(`dist/${profile.resume.filename} runs to ${pages} pages; the spec allows two.`);
  process.exit(1);
}
console.log(
  `Wrote dist/${profile.resume.filename}: ${pages} page(s), ${Math.round(bytes.length / 1024)} KB.`,
);
