// Writes dist/_headers from src/config/headers.mjs with the hash of the one inline script, the
// theme bootstrap, computed from the built HTML so nothing the compiler does to it can drift
// the policy. Asserts every page carries exactly that one inline script, all pages the same
// one, and no inline styles, because the policy allows neither.
//   node scripts/build-headers.mjs   (after finalize-dist)
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHeaders } from "../src/config/headers.mjs";
import { loadProfile } from "../src/content/profile.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const profile = loadProfile(readFileSync(resolve(root, "src/content/profile.yaml"), "utf8"));

const pages = readdirSync(dist, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".html"))
  .map((f) => join(dist, f));
if (pages.length === 0) {
  console.error("dist has no pages: run astro build first.");
  process.exit(1);
}

const problems = [];
const hashes = new Set();
for (const file of pages) {
  const name = relative(root, file).replace(/\\/g, "/");
  const html = readFileSync(file, "utf8");
  const inline = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\bsrc\s*=/.test(m[1])) inline.push(m[2]);
  }
  if (inline.length !== 1)
    problems.push(`${name} has ${inline.length} inline scripts; expected 1.`);
  for (const body of inline) {
    hashes.add(`sha256-${createHash("sha256").update(body, "utf8").digest("base64")}`);
  }
  if (/<style\b/i.test(html)) problems.push(`${name} has a <style> element.`);
  if (/\sstyle\s*=/i.test(html)) problems.push(`${name} has a style attribute.`);
}
if (hashes.size !== 1) {
  problems.push(`The pages carry ${hashes.size} different inline scripts; the policy names one.`);
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const [scriptHash] = hashes;
const text = renderHeaders({
  scriptHash,
  pdfPaths: [profile.contact.resume.href, `/${profile.resume.filename}`],
  filename: profile.resume.filename,
});
writeFileSync(resolve(dist, "_headers"), text, "utf8");
console.log(`Wrote dist/_headers: ${pages.length} page(s) share the inline script ${scriptHash}.`);
