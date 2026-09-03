// The home page's JavaScript budget (web-quality: under 30 KB compressed): the gzip size of
// every script in dist/_astro plus the inline bootstrap in dist/index.html. Runs at the end
// of the build and fails it when the budget is exceeded.
//   node scripts/check-budget.mjs
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const LIMIT = 30 * 1024;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const assets = resolve(dist, "_astro");

const gzip = (buffer) => gzipSync(buffer, { level: 9 }).length;
const rows = [];

for (const file of readdirSync(assets)
  .filter((f) => f.endsWith(".js"))
  .sort()) {
  rows.push([`_astro/${file}`, gzip(readFileSync(join(assets, file)))]);
}
const html = readFileSync(resolve(dist, "index.html"), "utf8");
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!/\bsrc\s*=/.test(m[1]))
    rows.push(["index.html inline script", gzip(Buffer.from(m[2], "utf8"))]);
}

const total = rows.reduce((sum, [, size]) => sum + size, 0);
for (const [name, size] of rows) console.log(`  ${String(size).padStart(6)} B gzip  ${name}`);
if (total > LIMIT) {
  console.error(`JavaScript budget exceeded: ${total} B gzip against ${LIMIT} B.`);
  process.exit(1);
}
console.log(`JavaScript budget: ${total} B gzip of ${LIMIT} B.`);
