// After the renders: writes _redirects for the résumé route, fills the size sentinel in every
// page with the PDF's real size, removes the two build-only pages and the stylesheets only they
// used, and fails if anything is left behind. Runs before build-headers so the hash and the
// inline-style assertions see the final files. Once per build: it consumes the sentinel, so a
// second run needs `astro build` first.
//   node scripts/finalize-dist.mjs   (after build-pdf and build-og)
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProfile } from "../src/content/profile.ts";

const SENTINEL = "__RESUME_SIZE__";
const BUILD_ONLY_PAGES = ["resume-print", "og-card"];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const profile = loadProfile(readFileSync(resolve(root, "src/content/profile.yaml"), "utf8"));
const problems = [];

const pdf = resolve(dist, profile.resume.filename);
if (!existsSync(pdf)) problems.push(`dist/${profile.resume.filename} is missing.`);
if (!existsSync(resolve(dist, "og.png"))) problems.push("dist/og.png is missing.");
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const htmlFiles = () =>
  readdirSync(dist, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(dist, f));
const stylesheetsOf = (html) =>
  [...html.matchAll(/<link[^>]+href="(\/_astro\/[^"]+\.css)"/g)].map((m) => m[1]);

// 1. The build-only pages leave dist, with any stylesheet that no remaining page uses.
const buildOnlyStyles = new Set();
for (const page of BUILD_ONLY_PAGES) {
  const file = resolve(dist, page, "index.html");
  if (existsSync(file))
    for (const css of stylesheetsOf(readFileSync(file, "utf8"))) buildOnlyStyles.add(css);
  rmSync(resolve(dist, page), { recursive: true, force: true });
}
const pages = htmlFiles();
const stillUsed = new Set(pages.flatMap((file) => stylesheetsOf(readFileSync(file, "utf8"))));
let removedStyles = 0;
for (const css of buildOnlyStyles) {
  if (stillUsed.has(css)) continue;
  rmSync(join(dist, css), { force: true });
  removedStyles += 1;
}

// 2. The résumé route: a 200 rewrite to the file, as the spike confirmed Workers serves.
writeFileSync(
  resolve(dist, "_redirects"),
  `${profile.contact.resume.href} /${profile.resume.filename} 200\n`,
  "utf8",
);

// 3. The size sentinel becomes the real size, in every page that carries it.
const size = `${Math.round(statSync(pdf).size / 1024)} KB`;
let replaced = 0;
for (const file of pages) {
  const html = readFileSync(file, "utf8");
  if (!html.includes(SENTINEL)) continue;
  writeFileSync(file, html.replaceAll(SENTINEL, size), "utf8");
  replaced += 1;
}
if (replaced === 0) {
  problems.push(
    `No page carried ${SENTINEL}: either astro build did not run or dist was finalized already.`,
  );
}

// 4. Nothing is left behind.
for (const file of pages) {
  if (readFileSync(file, "utf8").includes(SENTINEL))
    problems.push(`${file} still has ${SENTINEL}.`);
}
for (const page of BUILD_ONLY_PAGES) {
  if (existsSync(resolve(dist, page))) problems.push(`dist/${page} was not removed.`);
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `Finalized dist: résumé size ${size} in ${replaced} page(s), _redirects written, ${BUILD_ONLY_PAGES.join(" and ")} removed with ${removedStyles} stylesheet(s) of their own.`,
);
