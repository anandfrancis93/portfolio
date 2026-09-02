// Verified, not assumed: computes the WCAG contrast ratio of every pairing in
// src/config/pairings.mjs against the token sheet, in both themes, and exits 1 on any miss.
//   node scripts/check-contrast.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pairings } from "../src/config/pairings.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "src/styles/tokens.css"), "utf8").replace(/\r\n/g, "\n");

// Strip @media blocks (the prefers-color-scheme block duplicates the dark theme) and comments.
const withoutMedia = css
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");

const blocks = new Map();
for (const m of withoutMedia.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].replace(/\s+/g, " ").trim();
  const decls = {};
  for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls[d[1]] = d[2].trim();
  blocks.set(selector, { ...(blocks.get(selector) ?? {}), ...decls });
}

const base = blocks.get(":root") ?? {};
const light = { ...base, ...(blocks.get(':root, [data-theme="light"]') ?? {}) };
const dark = { ...base, ...(blocks.get('[data-theme="dark"]') ?? {}) };
if (Object.keys(light).length === 0 || Object.keys(dark).length === 0) {
  console.error("Could not find the light and dark blocks in src/styles/tokens.css");
  process.exit(1);
}

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};
const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a, b) => {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

let failures = 0;
let checked = 0;
for (const [theme, tokens] of [
  ["light", light],
  ["dark", dark],
]) {
  for (const p of pairings) {
    const fg = tokens[p.fg];
    const bg = tokens[p.bg];
    if (!fg || !bg) {
      console.error(`${theme}: unknown token in pairing ${p.fg} on ${p.bg}`);
      failures += 1;
      continue;
    }
    const r = ratio(fg, bg);
    checked += 1;
    if (r + 1e-9 < p.min) {
      failures += 1;
      console.error(
        `${theme}: ${p.fg} (${fg}) on ${p.bg} (${bg}) is ${r.toFixed(2)}:1, needs ${p.min}:1 — ${p.note}`,
      );
    }
  }
}

if (failures > 0) {
  console.error(`Contrast check failed: ${failures} of ${checked} pairings.`);
  process.exit(1);
}
console.log(`Contrast check passed: ${checked} pairings across light and dark.`);
