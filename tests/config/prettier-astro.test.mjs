// The Astro formatter must know which whitespace the build collapses, or a reformat changes the
// rendered page. prettier-plugin-astro reads it from its `astroCompressHTML` option and Astro from
// `compressHTML` in `astro.config.ts`; the two name the same three modes, and each falls back to
// `'jsx'` when unset. Spec: docs/specs/2026-10-23-prettier-plugin-astro-1.md.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astro from "../../astro.config.ts";
import { read } from "./helpers.mjs";

/** Either tool's setting as one of 'html', 'jsx' or 'none'; true and false are aliases. */
const mode = (value) => {
  if (value === undefined) return "jsx";
  if (value === true) return "html";
  if (value === false) return "none";
  return value;
};

describe("Prettier and Astro agree on whitespace", () => {
  it("formats .astro files with the build's compressHTML mode", () => {
    const prettier = JSON.parse(read(".prettierrc.json"));
    const astroFiles = (prettier.overrides ?? []).filter((o) => o.files === "*.astro");
    assert.equal(astroFiles.length, 1, "one Prettier override for *.astro");
    assert.equal(mode(astroFiles[0].options.astroCompressHTML), mode(astro.compressHTML));
  });
});
