// Verified, not assumed: computes the WCAG contrast ratio of every pairing in
// src/config/pairings.mjs against the token sheet, in both themes, and exits 1 on any miss.
// Also asserts that the prefers-color-scheme block (what an OS-dark visitor renders before the
// toggle is touched) is identical to the [data-theme="dark"] block, and refuses any colour it
// cannot parse rather than letting it pass unchecked.
//   node scripts/check-contrast.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pairings } from "../src/config/pairings.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "src/styles/tokens.css"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

const parseBlocks = (text) => {
  const blocks = new Map();
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].replace(/\s+/g, " ").trim();
    const decls = blocks.get(selector) ?? {};
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls[d[1]] = d[2].trim();
    blocks.set(selector, decls);
  }
  return blocks;
};

// The OS-dark media block, captured before every @media block is stripped.
const mediaDark = /@media \(prefers-color-scheme: dark\)\s*\{([\s\S]*?)\n\}/.exec(css);
const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");

const blocks = parseBlocks(withoutMedia);
const base = blocks.get(":root") ?? {};
const light = { ...base, ...(blocks.get(':root, [data-theme="light"]') ?? {}) };
const darkOverrides = blocks.get('[data-theme="dark"]') ?? {};
const dark = { ...base, ...darkOverrides };

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(msg);
};

if (Object.keys(light).length === 0 || Object.keys(darkOverrides).length === 0) {
  fail("Could not find the light and dark blocks in src/styles/tokens.css");
}

// 1. The media block must be an exact copy of the dark block.
if (!mediaDark) {
  fail("No @media (prefers-color-scheme: dark) block found in src/styles/tokens.css");
} else {
  const inner = parseBlocks(mediaDark[1]);
  const mediaDecls = inner.get(':root:not([data-theme="light"])') ?? {};
  const keys = new Set([...Object.keys(darkOverrides), ...Object.keys(mediaDecls)]);
  for (const k of keys) {
    if (k === "color-scheme") continue;
    if (darkOverrides[k] !== mediaDecls[k]) {
      fail(
        `OS-dark block differs from [data-theme="dark"] for ${k}: ${mediaDecls[k] ?? "missing"} vs ${darkOverrides[k] ?? "missing"}`,
      );
    }
  }
}

// 2. Colours must be 3- or 6-digit hex; anything else is a gap in the checker, not a pass.
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const hexToRgb = (hex) => {
  const h = hex.slice(1);
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

// 3. Every pairing, both themes.
let checked = 0;
const seen = new Set();
for (const p of pairings) {
  const key = `${p.fg}|${p.bg}`;
  if (seen.has(key)) fail(`Duplicate pairing: ${p.fg} on ${p.bg}`);
  seen.add(key);
}
for (const [theme, tokens] of [
  ["light", light],
  ["dark", dark],
]) {
  for (const p of pairings) {
    const fg = tokens[p.fg];
    const bg = tokens[p.bg];
    if (!fg || !bg) {
      fail(`${theme}: unknown token in pairing ${p.fg} on ${p.bg}`);
      continue;
    }
    if (!HEX.test(fg) || !HEX.test(bg)) {
      fail(
        `${theme}: cannot parse ${p.fg}=${fg} or ${p.bg}=${bg}; only 3- or 6-digit hex is supported`,
      );
      continue;
    }
    const r = ratio(fg, bg);
    checked += 1;
    if (r + 1e-9 < p.min) {
      fail(
        `${theme}: ${p.fg} (${fg}) on ${p.bg} (${bg}) is ${r.toFixed(2)}:1, needs ${p.min}:1 — ${p.note}`,
      );
    }
  }
}

if (failures > 0) {
  console.error(`Contrast check failed: ${failures} problem(s) across ${checked} pairings.`);
  process.exit(1);
}
console.log(
  `Contrast check passed: ${checked} pairings (${pairings.length} distinct) across light and dark; OS-dark block matches.`,
);
