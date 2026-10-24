# Move prettier-plugin-astro to 1.1.1

Date: 2026-10-23. PR: #28. Tier: T3.

## Intent

Dependabot's #19 moves prettier-plugin-astro from 0.14.1 to 1.1.1. Version 1 parses `.astro`
files with a new compiler, `@astrojs/compiler-rs`. On #19, `pnpm lint` fails: Prettier would
rewrite 16 `.astro` files
([job 120703928253](https://github.com/anandfrancis93/portfolio/actions/runs/40038561318/job/120703928253)).

Version 1 adds the option `astroCompressHTML`. Its README says it tells the formatter which
whitespace the compiler collapses, "so that reformatting a file never changes what it renders".
Its default is `'jsx'`, Astro 7's default. This site sets `compressHTML: true` in
`astro.config.ts`, which the plugin calls `'html'`. Under the default, `pnpm format` moves text
onto its own line inside elements such as the badge. The build then renders
`<span class="badge badge--success-subtle"> Open to internships </span>`. The home page, the 404
page and the résumé page all change.

Constraints:

- A reformat changes no rendered text. A space after a block element's opening tag or before its
  closing tag is allowed, since the browser does not render it.

Done when: `adlc / checks` passes here, and the built pages differ from `main`'s only as the
constraint allows.

## Tests to add

`tests/config/prettier-astro.test.mjs`: the `astroCompressHTML` option for `.astro` files names
the same mode as `compressHTML` in `astro.config.ts`. It fails on `main` and on #19's head,
where the option is unset.

## Files in scope

- `package.json` and `pnpm-lock.yaml`: prettier-plugin-astro 1.1.1, the update #19 proposes, made
  again on `main` with `pnpm add`. `legacy-javascript` stays at the locked 0.0.3, as on `main`.
- `.prettierrc.json`: `astroCompressHTML: "html"` for `.astro` files.
- The 12 `.astro` files that `pnpm format` then rewrites. Formatting only.
- The test above and this spec.

## Out of scope

- `compressHTML` itself.
- The Prettier version.
- prettier-plugin-astro 1.1.2, published on 23 October 2026. It can follow as its own update.

## Decision

- Choice: take 1.1.1, set `astroCompressHTML` to `"html"`, and commit what `pnpm format` writes.
- Alternatives:
  1. Take 1.1.1 with the default `'jsx'`.
  2. Set `compressHTML` to `'jsx'` to match the formatter's default.
  3. Stay on 0.14.1 and tell Dependabot to ignore version 1.
- Why: the option is the plugin's own way to keep a reformat from changing the page. With it, the
  built 404 and résumé pages are byte-identical to `main`'s. The home page differs only in the
  three About paragraphs: each `<p>` gains a space after its opening tag and before its closing
  tag. Option 1 puts spaces inside the text of inline elements on three pages. Option 2 changes
  how every page renders; the config's comment says `'jsx'` strips whitespace between inline
  elements in prose. Option 3 only moves the same reformat to a later change.
- Known limit: version 1 writes a `.map()` that returns markup on fewer lines, with the closing
  tag and `)}` together. It reads worse than 0.14.1's layout. That is the plugin's style, and this
  change keeps it.
