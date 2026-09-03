# Plan: anandfrancis.com version one (from spec.md, 2 September 2026)

Status: accepted by the engineer and product owner on 2 September 2026, in plan mode, before
any code was written. Derived from `spec.md` (accepted the same day) under the three skills.
Departures during implementation are written back into this file in the same PR.

## Context

Stage 3 of the AI-native SDLC. The intent (ca08c2c) and spec (839726f) are accepted; the
three skills constrain the work. The repository holds only docs, so this plan covers the
scaffold, the process files the playbook puts at the start of Build (CLAUDE.md, hooks,
verifier subagent, REVIEW.md), the GitHub and Cloudflare plumbing needed before the first
merge, and the whole version-one site. On acceptance this text is committed as
`docs/sdlc/001-portfolio-v1/plan.md` before any code is written, and PR review checks each
diff against it.

Verified against current docs on 2 September 2026: Astro 7.2 (static output, no adapter,
Node 22.12+, strict Rust compiler, `compressHTML` defaults to `'jsx'`, `src/fetch.ts`
reserved), wrangler 4.128 (`assets.directory` + `not_found_handling: "404-page"`, no
Worker script needed, `_headers` and `_redirects` shipped in the assets directory, 200
"proxy" rules for relative URLs, `wrangler rollback` over the last 100 versions),
Playwright 1.62 (`page.pdf({ tagged: true, outline: true, format: 'Letter' })`; `tagged`
defaults to false so it must be explicit). Local machine: Node 22.21, pnpm 9.15, git
`core.autocrlf=true`.

## Decisions taken in this plan (the spec is not reopened)

- Astro 7.2.10, `output: 'static'`, TypeScript, no client framework, no adapter, no
  Tailwind. `compressHTML: true` (not `'jsx'`, which strips inter-element whitespace in
  prose), `build.inlineStylesheets: 'never'` and `vite.build.assetsInlineLimit: 0` so the
  CSP can be `style-src 'self'` with no inline styles or data URIs.
- Copy lives in `src/content/profile.yaml`, parsed with `yaml` and validated by a Zod
  schema in `src/content/schema.ts`. The same schema is imported by the Astro pages and by
  the Node build scripts (QR, PDF checks), which a content collection could not offer.
- Fonts: the Latin WOFF2 files for IBM Plex Sans 400/500/600/700 and Mono 400 are copied
  once from the Fontsource packages into `src/assets/fonts/` so Vite fingerprints them,
  preload hrefs come from `?url` imports, and `_headers` marks them immutable. A
  metric-matched "IBM Plex Sans Fallback" face is generated from the font files with
  Capsize into a committed CSS file, checked in CI.
- `/resume`: primary route is `public/_redirects` with `/resume /anand-francis-resume.pdf 200`
  (documented proxying). Two things the docs do not settle are spiked in phase A on the
  preview Worker: whether `_headers` decorates a proxied response, and whether `wrangler dev`
  applies `_redirects` locally. Fallback if the spike fails: a 25-line `src/worker/index.ts`
  with `assets.run_worker_first: ["/resume"]` that fetches the PDF from the assets binding
  and returns it with `Content-Type: application/pdf`, `Content-Disposition: inline` and the
  security headers imported from the same module that generates `_headers`.
- PDF: Playwright renders the built `/resume-print` page to `dist/anand-francis-resume.pdf`
  with `tagged: true, outline: true, format: 'Letter', printBackground: true,
  preferCSSPageSize: true`. Link text carries the sentinel `__RESUME_SIZE__`, which a
  finalise step replaces with the real size after the PDF exists, and fails if any sentinel
  remains. The print page and OG card page are deleted from `dist` after use.
- CSP hash: the inline theme bootstrap is the only inline script; its hash is computed from
  the built HTML (so `compressHTML` cannot break it) and written into `dist/_headers` by a
  build step. CSP is detached on the PDF routes so browser PDF viewers are unaffected.
- All tooling is Node ESM (`scripts/*.mjs`), so every command runs the same in PowerShell,
  Git Bash and CI. `.gitattributes` forces LF; a renormalise commit lands in phase A.
- Wrangler environments: `preview` (workers.dev, `X-Robots-Tag: noindex`) and `production`
  (custom domain `anandfrancis.com`, workers.dev off). Every PR uploads to preview;
  production deploys only through the release gate.

## Repository layout

```
.claude/settings.json  .claude/hooks/{guard-deploy,guard-tests,format-on-edit}.mjs  .claude/agents/verifier.md
.github/workflows/ci.yml  .github/workflows/deploy.yml  .github/pull_request_template.md
.editorconfig  .gitattributes  .gitignore  .node-version  .npmrc  .prettierrc.json  .prettierignore
package.json  pnpm-lock.yaml  astro.config.ts  tsconfig.json  stylelint.config.js  .htmlvalidate.json
playwright.config.ts  lighthouserc.cjs  lighthouserc.desktop.cjs  wrangler.jsonc
CLAUDE.md  REVIEW.md  README.md
public/robots.txt  public/favicon.svg  public/_redirects
src/
  content/profile.yaml  content/schema.ts  content/profile.ts
  config/headers.mjs (one source for _headers and the fallback Worker)  config/pairings.mjs (contrast pairs)
  layouts/Base.astro  layouts/Print.astro
  pages/index.astro  pages/404.astro  pages/resume-print.astro  pages/og-card.astro
  components/{SkipLink,Header,MobileMenu,ThemeToggle,Footer,Icon,Button,Badge,Section}.astro
  components/sections/{Hero,Experience,ExperienceEntry,Projects,About,Skills,Recommendations,Contact}.astro
  components/print/Resume.astro
  icons/*.svg (Figma export: chevron-down, chevron-up, sun, moon, mail, download, external-link, arrow-right, menu, close)
  assets/fonts/*.woff2  assets/qr-resume.svg (generated, committed)
  styles/tokens.css (byte copy of the skill's sheet, checked)  styles/tokens.site.css (site-level gaps, named tokens)
  styles/fonts.css  styles/fonts.fallback.css (generated)  styles/base.css  styles/components/*.css  styles/sections/*.css  styles/print.css
  scripts/theme-init.js (inline)  scripts/{theme-toggle,mobile-menu,disclosure,reveal,scroll-spy}.ts
  worker/index.ts (only if the phase A spike chooses the fallback)
scripts/
  sync-tokens.mjs  font-fallback.mjs  build-qr.mjs  build-pdf.mjs  build-og.mjs  build-headers.mjs
  finalize-dist.mjs  postbuild.mjs  lib/serve-dist.mjs
  check-content.mjs  check-voice.mjs  check-contrast.mjs  check-budget.mjs  check-eol.mjs  deploy.mjs
tests/e2e/{a11y,keyboard,theme,disclosure,mobile-menu,reduced-motion,reflow,content,network,screenshots,headers}.spec.ts
tests/pdf.spec.ts  tests/helpers/{themes,focus}.ts
```

## npm scripts

| Script | Runs |
| --- | --- |
| `dev` | `astro dev` |
| `build` | `node scripts/sync-tokens.mjs --check && node scripts/build-qr.mjs --check && astro build && node scripts/postbuild.mjs` (pdf, og, headers, finalise, budget) |
| `preview` | `wrangler dev --port 8788` (serves `dist` with `_headers` and `_redirects` if the spike confirms; else `astro preview`) |
| `check` | `astro check && node scripts/check-content.mjs && node scripts/check-voice.mjs && node scripts/check-eol.mjs && node scripts/font-fallback.mjs --check` |
| `lint` / `format` | `prettier --check . && stylelint "src/**/*.css" && node scripts/check-contrast.mjs` / `prettier --write .` |
| `test` | `playwright test` (projects a11y, behaviour, screens, headers; needs `dist`) |
| `test:a11y`, `test:pdf`, `test:screens`, `test:headers` | the matching Playwright project or file |
| `html` | `html-validate "dist/**/*.html"` |
| `lighthouse` | `lhci autorun --config=lighthouserc.cjs && lhci autorun --config=lighthouserc.desktop.cjs` |
| `audit` | `pnpm audit --audit-level high` |
| `verify` | `check && lint && build && html && test && lighthouse && audit` (the definition of done) |
| `deploy` | `node scripts/deploy.mjs --env preview` |
| `deploy:production` | `node scripts/deploy.mjs --env production` (exits 1 unless `RELEASE_APPROVAL` is set) |

## Order of work

Each phase is one PR (E is several) reviewed under `REVIEW.md`; the branch for each is cut
from `main`. A is sequential and first; B, C, D follow in order; E1 to E8, F and G can run
in parallel worktrees once D has merged, because D pre-creates every section stub and CSS
import so later branches touch only their own files.

### A. Scaffold, process files, repository, plumbing
- Files: all root config files; `package.json` with `packageManager: pnpm@9.15.0`,
  `engines.node >=22.18`, exact-pinned dependencies (astro 7.2.10, typescript 7.0.2,
  @astrojs/check, yaml, zod, @fontsource/ibm-plex-sans 5.3.0, @fontsource/ibm-plex-mono
  5.3.0; dev: @playwright/test 1.62.1, @axe-core/playwright 4.13.0, @lhci/cli 0.15.1,
  html-validate 11.12.0, stylelint 17.14.1 + stylelint-config-standard +
  stylelint-declaration-strict-value, prettier + prettier-plugin-astro, qrcode 1.5.4,
  pdfjs-dist, @capsizecss/core + @capsizecss/unpack, wrangler 4.128.0); `.npmrc` with
  `save-exact=true` and `engine-strict=true`; `.gitattributes` (`* text=auto eol=lf`,
  binaries marked) and a renormalise commit; `.editorconfig`; `.prettierrc.json`
  (`endOfLine: lf`, astro plugin); `stylelint.config.js` with declaration-strict-value on
  colour, background, border, fill, stroke, box-shadow, outline, spacing and size
  properties, font-size, line-height, letter-spacing, border-radius, transition and
  animation properties, exempting only the token and font files; `astro.config.ts`;
  `tsconfig.json` (strict); `src/pages/index.astro` placeholder; `public/robots.txt`.
- Process files: `CLAUDE.md` (stack and versions, commands with healthy output, the three
  skills, conventions: tokens not values, class names mirror Figma variants, semantic
  headings, US spelling, copy only in profile.yaml, never edit generated files, PRs only,
  `pnpm verify` before "done", Windows notes; "Things Claude gets wrong" seeded from these);
  `.claude/settings.json` hooks in the `node "${CLAUDE_PROJECT_DIR}/.claude/hooks/x.mjs"`
  form: PreToolUse Bash → `guard-deploy.mjs` (exit 2 on `wrangler deploy` or
  `versions deploy` without `--env preview` unless `RELEASE_APPROVAL` is set); PreToolUse
  Edit|Write → `guard-tests.mjs` (exit 2 on paths under `tests/` when `CLAUDE_TASK_MODE=fix`);
  PostToolUse Edit|Write → `format-on-edit.mjs` (prettier on the file, stylelint on CSS);
  `.claude/agents/verifier.md` (tools Read, Grep, Glob, Bash; runs `pnpm verify`, maps
  results to spec section 10, reports, never edits); `REVIEW.md` (passes: bugs;
  accessibility, performance and security against web-quality; compliance with spec.md,
  plan.md and the design system; Important vs Nit; five-nit cap; skip dist, lockfile,
  generated files); `.github/pull_request_template.md` (screenshots, keyboard walk,
  Lighthouse numbers, plan section reference).
- Repository: `git branch main` at the current tip (the hook blocks commits on main, not
  creating it); `gh repo create anandfrancis93/portfolio --<visibility> --source . --remote
  origin`; push `main` and the working branch; if public, a ruleset on `main` via `gh api`
  requiring a PR and the `ci` check and blocking force pushes; secrets `CLOUDFLARE_API_TOKEN`
  and `CLOUDFLARE_ACCOUNT_ID` added by Francis when he is ready (phase G needs them).
- CI skeleton: `.github/workflows/ci.yml` running install, `pnpm check`, `pnpm lint`,
  `pnpm build` on every PR and push; extended in G.
- Wrangler: `wrangler.jsonc` with `name: "anandfrancis-com"`, `compatibility_date:
  "2026-09-02"`, top-level `assets: { directory: "./dist", not_found_handling: "404-page",
  html_handling: "auto-trailing-slash" }`, `env.preview` (workers.dev on) and
  `env.production` (custom domain route, workers.dev off).
- Spike (needs the Cloudflare token): deploy a stub `dist` with an index, a dummy PDF,
  `_redirects` and `_headers` to the preview Worker; `curl -I .../resume` and `.../nope`;
  record the verdict in plan.md section "Spike results" and pick the `/resume` route.
- Done: `pnpm check`, `pnpm lint`, `pnpm build` pass on the placeholder; `git ls-files --eol`
  shows no CRLF; each hook exercised once and behaves; CI green on the first PR; spike
  verdict recorded (or deferred to G if the token is not yet available).
- Could go wrong: Rust compiler rejects placeholder markup (fix the markup); corepack pnpm
  mismatch on Windows (pin `packageManager`, do not rely on a global pnpm).

### B. Tokens, base styles, fonts
- Files: `scripts/sync-tokens.mjs` (copies the skill's tokens.css, `--check` compares
  bytes); `src/styles/tokens.site.css` (named site tokens for gaps the system does not
  cover: border-thin, focus-ring, focus-offset, icon-sm, header and footer mobile bars,
  date column, QR size, hero and about heading widths, quote width, skills width, reveal
  rise); `fonts.css`, `fonts.fallback.css` (generated by `font-fallback.mjs` with Capsize
  against Arial, `--check` in CI); `src/assets/fonts/*.woff2`; `base.css` (reset, canvas
  and text-primary on body, focus ring rule, type-ramp classes `.text-display` to
  `.text-code`, `.container`, `[id] { scroll-margin-top }`, theme crossfade class);
  `src/config/pairings.mjs` and `scripts/check-contrast.mjs`.
- Done: contrast script passes every pairing in both themes at 4.5:1 for text and 3:1 for
  large text and control borders; Lighthouse on the placeholder reports CLS 0 with fonts
  swapped; stylelint passes.
- Could go wrong: fallback metrics differ by OS font (pin Arial; CI resolves Liberation
  Sans; verify CLS in CI, not only on Windows).

### C. Content file and schema
- Files: `src/content/profile.yaml` (every string from spec sections 3 and 9, US
  spelling, block scalars for anything with dashes or quotes); `schema.ts` (identity, meta,
  hero, experience with `start`, `end` nullable, education, certifications with
  month-year strings, skills groups, recommendations min 1, contact, links, empty state
  and 404 copy, résumé rules such as the two-bullet limit before 2019); `profile.ts`
  (parse once, export typed `profile` and `formatSpan()`); `scripts/check-content.mjs`;
  `scripts/check-voice.mjs` (banned words, exclamation marks, British spellings, fixed
  facts from the voice skill); `tests/e2e/content.spec.ts` written now, run from E.
- Done: a deliberately broken copy (missing recommendation, bad date) fails with a readable
  error; the real file passes content and voice checks.
- Could go wrong: YAML folding alters em dashes or curly quotes (block scalars; the content
  test asserts the quote verbatim).

### D. Layout shell: head, header, footer, theme, mobile menu, 404, section stubs
- Files: `Base.astro` (lang, meta, title and description from YAML, OG tags, two
  `theme-color` values read from tokens at build, font preloads via `?url`, inline
  `theme-init.js` via `?raw` and `is:inline set:html`, SkipLink, Header, `main#main`,
  Footer, module scripts); `Print.astro`; `SkipLink`, `Header` (scroll-spy sets the
  current link to brand-text), `MobileMenu` (`<dialog>` with `showModal()`: native focus
  trap, Escape, inert background, first link focused, focus returns to the menu button),
  `ThemeToggle` (aria-label names the target theme; moon in light, sun in dark;
  crossfade class applied for one `--duration-base` after the first paint only),
  `Footer` (three links, year at build), `Icon`, `Button` (primary, secondary, ghost;
  md, lg; `<a>` or `<button>`), `Badge` (tone, variant), `Section` (eyebrow, h2, lede);
  `pages/404.astro`; all seven section components as stubs with their CSS files imported.
- Done: skip link, wordmark, four links, toggle and, at 390px, the menu button and menu
  tab in order with visible rings in both themes; theme persists without a flash; 404
  renders in the voice; axe clean on the shell.
- Could go wrong: dialog top-layer styling and backdrop tokens; scroll-spy fighting the
  hash on load (observe with root margin equal to the header height).

### E. Sections, in spec order (E1 Hero, E2 Experience, E3 Projects, E4 About, E5 Skills, E6 Recommendations, E7 Contact, E8 Footer polish)
- Each: one component under `components/sections/`, one file under `styles/sections/`,
  one test update. Experience: `h3 > button[aria-expanded][aria-controls]` title row, date
  outside the button, collapsed bullets `hidden`, first entry open, all open without
  JavaScript (the script applies collapsed state after load), open and close animated on
  `grid-template-rows` with opacity only under reduced motion. Skills: `dl`. Recommendations:
  `figure > blockquote[cite] + figcaption`. Contact: inline QR from `qr-resume.svg?raw`
  inside `<a href="/resume">` named "Résumé (PDF, __RESUME_SIZE__)".
- Done per section: content test passes, axe clean, keyboard order per spec 10.3,
  screenshots at 390, 768 and 1440 in both themes compared with Figma frames 589:668,
  589:946 and 589:98, plus 1024 and 1280 checked for the two-column About.
- Could go wrong: About side column too narrow at 1024 (stack below 1280 if so, recorded
  as a spec deviation in the PR).

### F. PDF, OG card, QR, headers, finalise
- Files: `pages/resume-print.astro`, `components/print/Resume.astro`, `styles/print.css`
  (`@page { size: Letter; margin: 0.6in }`, two-bullet rule before 2019, page-break rules,
  same heading order); `pages/og-card.astro` (1200 by 630, canvas colour, name and
  headline); `scripts/build-qr.mjs` (qrcode SVG, error level M, margin 0, deterministic,
  committed, `--check`); `build-pdf.mjs` (serve `dist` on a free port, Chromium
  `page.pdf`, write the file, stop); `build-og.mjs`; `build-headers.mjs` (hash the inline
  script from built HTML, assert exactly one inline script and no inline styles, write
  `dist/_headers` from `src/config/headers.mjs`: CSP, HSTS preload, nosniff, referrer
  policy, permissions policy, frame options, immutable cache for `/_astro/*`, CSP detached
  on the PDF paths, noindex on workers.dev); `finalize-dist.mjs` (replace the size
  sentinel, delete the print and OG pages from `dist`, fail on leftovers);
  `postbuild.mjs`; `tests/pdf.spec.ts` (pdfjs: at most two pages, `MarkInfo.Marked` true,
  title set, every role title present).
- Done: the PDF opens in Edge and Firefox, is tagged, one or two pages; `/resume` serves
  it inline on the preview server; `dist/_headers` carries the script hash; no sentinel
  remains.
- Could go wrong: headless Chromium cannot navigate to a PDF (test the bytes with pdfjs);
  PDF size varies by Chromium version (size computed each build, never committed).

### G. Quality gates, full CI, deploy workflow, rollback rehearsal
- Files: `playwright.config.ts` (webServer `wrangler dev` or `astro preview` per the
  spike; projects for light and dark via `colorScheme` and viewports 320, 390, 600, 768,
  1024, 1280, 1440); `a11y`, `keyboard` (the 22-stop order from spec 10.3 with computed
  outline width at least 2px), `theme`, `disclosure`, `mobile-menu`, `reduced-motion`,
  `reflow` (320px scroll width, 200% zoom), `network` (every request same-origin),
  `screenshots`, `headers` specs; `.htmlvalidate.json`; `lighthouserc.cjs` and desktop
  variant (three runs, median, assertions performance 0.95 and the other three 1.0);
  `scripts/check-budget.mjs` (gzip of `dist/_astro/*.js` under 30 KB); `check-eol.mjs`;
  `ci.yml` extended to `pnpm verify` with Playwright cached by version, screenshots, PDF
  and Lighthouse reports as artifacts; `deploy.yml` (on PR and on `main`: build, test,
  `deploy --env preview`, comment the preview URL, run the headers spec against it;
  `workflow_dispatch` with a `release_approval` input that exports `RELEASE_APPROVAL` and
  runs `deploy --env production`, then smoke-checks `/`, `/resume` and `/nope`).
- Rollback rehearsal on the preview Worker: deploy twice, `wrangler rollback` to the first,
  confirm the PDF and 404 come back with it; describe in the PR.
- Done: `pnpm verify` green locally and in CI; preview URL serves the site; production
  deploy refused without the variable; rollback rehearsed. Production stays unreleased
  until Stage 5.
- Could go wrong: Lighthouse variance (median of three, one automatic re-run on a
  Performance miss before failing); `wrangler dev` ignoring `_headers` locally (headers
  spec then runs only post-deploy).

## Risks

- Astro 7 differences: strict compiler, `compressHTML`, Vite 8. Pin exactly; upgrade only
  as its own PR under `pnpm verify`.
- Playwright browsers: `playwright install chromium` locally; `--with-deps chromium` in CI
  with the browser cache keyed on the version.
- Font CLS: Latin subsets, swap, two preloads, generated fallback metrics; Lighthouse CLS
  assertion catches drift.
- CSP hash drift: hash computed from built HTML each build; console-error test asserts no
  CSP violation in the browser.
- QR determinism: fixed library, options and URL; committed output with a byte check.
- Tagged PDF: explicit flag plus a pdfjs assertion; manual open in two browsers before launch.
- `/resume` proxy behaviour: spike in A with the Worker fallback fully specified.
- CRLF: gitattributes, editorconfig, prettier, `check-eol.mjs`, and `core.autocrlf false`
  recorded in CLAUDE.md.
- Free plan limits: static asset requests are free and unlimited; the fallback Worker
  would run only on `/resume`. Preview Worker is public on workers.dev, so it carries
  noindex and no analytics.
- GitHub Free and a private repository: no enforced protection; see the decision above.

## Proof (spec section 10, gate by gate)

| Gate | Check | Command |
| --- | --- | --- |
| 1 Lighthouse 95, 100, 100, 100 on mobile and desktop | two lhci configs, assertions as errors | `pnpm lighthouse` |
| 2 axe zero violations both themes; HTML zero errors | a11y spec on `/` and `/404` in both themes; html-validate on `dist` | `pnpm test:a11y`, `pnpm html` |
| 3 Keyboard walk in order with visible rings, both themes | keyboard spec, 22 stops, computed outline width | `pnpm test:a11y` |
| 4 Contrast over every pairing, both themes | `pairings.mjs` against `tokens.css` | `pnpm lint` |
| 5 Reflow at 320px; text at 200% | reflow spec | `pnpm test:a11y` |
| 6 Reduced motion | reduced-motion spec: durations at or under 0.01 ms, reveals instant, disclosures work | `pnpm test:a11y` |
| 7 Security headers A, no `unsafe-inline` | headers spec against preview; securityheaders.com pasted in the launch PR | `pnpm test:headers` |
| 8 No third-party requests; JS under 30 KB | network spec; `check-budget.mjs` | `pnpm test`, `pnpm build` |
| 9 PDF opens, tagged, matches content, link carries format and size | pdf spec; finalise sentinel check | `pnpm test:pdf`, `pnpm build` |
| 10 Screenshots at seven widths in both themes | screenshots spec as CI artifact; reviewer compares 390, 768, 1440 with the Figma frames | `pnpm test:screens` |

Also: rollback rehearsed once on preview and described in the PR; the plan is re-read at
each PR and any departure is written into plan.md in the same PR (a hook for this arrives
with the CLAUDE.md rule "update plan.md when the implementation departs from it").

## Departures recorded during implementation

- Phase A, 2 September 2026: TypeScript is 6.0.3, not 7.0.2. `@astrojs/check` 0.9.10 declares a
  peer range of TypeScript 5 or 6, and `astro check` is a quality gate, so the peer wins. Revisit
  when `@astrojs/check` supports 7.
- Phase A, 2 September 2026: html-validate is 10.17.0, not 11.12.0. Every 11.x release requires
  Node 22.22 or newer and the machine runs 22.21 with `engine-strict` on. Upgrade both together
  in their own PR.
- Phase A, 2 September 2026: the `lint` script passes `--allow-empty-input` to stylelint because
  no CSS exists until phase B.
- Phase A, 2 September 2026, after PR review: the deploy gate parses each shell segment and
  covers `wrangler deploy`, `versions deploy`, `rollback`, `delete`, `triggers deploy` and `secret`
  commands plus `scripts/deploy.mjs` and the `deploy:production` alias, on both the Bash and
  PowerShell tools; the format hook runs Prettier and stylelint through Node entry points rather
  than a shell and reports failures; fix mode is entered with the marker file `.claude/FIX_TASK`
  and also protects the config files that decide what the gates check; stylelint lints `<style>`
  blocks in `.astro` files through `postcss-html`, ignores the two generated files, and excludes
  `color-scheme` from the tokens-only rule; `public/_headers` ships in phase A with the basic
  security headers and a noindex rule for the preview host; the top-level wrangler config carries
  the production triggers so a bare `wrangler deploy` cannot expose a workers.dev host; CI runs
  with a read-only token and no longer cancels runs on `main`. The phase A spike should expect a
  bodyless 404 for unknown paths until `404.astro` lands in phase D.
- Phase B, 2 September 2026: the contrast script found `text-tertiary` on `bg-subtle` at 4.34:1
  in light, so the footer copyright uses `text-secondary` (spec 3.9 updated). The focus ring is
  checked against the page, not the primary button fill, because the 2px offset shows the page
  through the gap, as the design system's Interactions page states. Three tokens the type ramp
  needs but the Figma sheet did not name were added to the skill's token sheet and synced:
  `--text-display-tracking` (-1.5px), `--text-h3-tracking` (-0.25px), `--text-body-weight` (400).
- Phase B, 2 September 2026, from the verifier's comparison: `@capsizecss/metrics` was added so the
  fallback is computed against Arial's published metrics rather than a font on the build machine;
  `pnpm check` also runs the token sync `--check` (the plan listed it under build only) and `sync:tokens` and `fonts:fallback` scripts exist; stylelint ignores `.claude/**`
  (the skill's sheet is vendored source) and allows the `solid` keyword; the phase A placeholder
  page imports `base.css` so the fonts and tokens are exercised by the build; `base.css` adds
  `.text-eyebrow`, `.measure-prose`, `.measure-narrow` and `.visually-hidden`, and
  `tokens.site.css` names a few more template widths than the plan listed. The `--allow-empty-input`
  flag was removed from lint now that CSS exists.
- Phase B, 2 September 2026, after the three REVIEW.md passes: line heights use unitless
  `--text-*-leading` tokens instead of `calc(px / px)`, which Firefox does not support; Body/Small
  is 14/22 (the style value; the specimen page shows 14/20); the fallback is generated per weight
  against Arial and, for Android, Roboto, plus a Courier New fallback for Plex Mono, so
  `--font-sans` and `--font-mono` name the extra families; the contrast script refuses non-hex
  values, rejects duplicate pairings and asserts the OS-dark media block matches the dark block;
  pairings gained the focus ring on the footer band, brand text on brand subtle and labels on the
  status solids; `scroll-behavior: smooth` was removed (the spec allows no other motion); jump
  targets use the mobile header height below 768px; `.visually-hidden` unhides on `focus-within`;
  the theme crossfade covers outline, shadow and underline colours; `.text-code` no longer sets
  colour; `text-rendering` was dropped; the thumbnail tokens were removed (no card in version one);
  the placeholder copy is in the first person.
- Phase B, 2 September 2026: the contrast script showed the Badge page's rule that success and
  warning solids take the near-black label no longer holds with the v4.1.0 token values (3.1:1 and
  2.8:1); white clears 4.5:1 on both, so every solid uses `text-on-solid`. Recorded here and in
  `src/config/pairings.mjs`; worth raising in the design system.
- Phase C, 2 September 2026: `pnpm check` also runs `check-content.mjs` and
  `check-voice.mjs`; `profile.ts` exports the formatting helpers (`formatSpan`, `formatMonth`,
  `formatCertificationDates`, `resumeBullets`, `collectStrings`) the page and résumé share; the
  schema caps the meta description at 155 characters, which shortened the approved wording to
  "Experience, skills, contact."; the résumé rules (older-than-2019 roles trimmed to two bullets,
  file name, summary line) live in `profile.yaml` under `resume` rather than in print CSS.
- Phase C, 2 September 2026, after the verifier and the three REVIEW.md passes: the content module
  is split into `profile.ts` (schema, helpers, no file access) and `site.ts` (Astro-only; imports
  the YAML through Vite's `?raw` so the prerender build never resolves a file path from a bundled
  chunk); the schema uses strict objects, https-only external links, exactly four nav links and
  two hero actions (one primary, one secondary), roles newest first, a 154-character description
  and a 60-character title; `profile.yaml` gained a `ui` block (skip link, nav name, theme toggle
  and menu names), `footer.copyright` with a `{year}` template, `meta.ogImageAlt`, and a `ghost`
  style on the empty-state action; the résumé link text is "Résumé (PDF, size)" for the QR link
  and "Résumé (PDF)" in the footer (spec 3.8 and 3.9 amended); the recommendation source is the
  public profile URL; `check-voice.mjs` compares the quote to the LinkedIn text literally and
  matches banned words in any inflection; `check-content.mjs` also proves an unknown key is
  rejected; the content test scopes spans to list items and uses the contentinfo landmark;
  transcribed copy uses typographic apostrophes (U+2019) as the template and LinkedIn do; the
  placeholder page now renders the hero copy from `site.ts`, which exercises the Astro loader in
  the build; the phase C tsconfig change was dropped because Astro's strict preset already sets
  both options and Node's type stripping does not read tsconfig.
- Phase D, 2 September 2026: the Hero is implemented in full rather than stubbed, because the
  page needs its `h1` and the hero is the smallest section; the Button prop is `variant`, not
  `style`, because the Astro style linter (postcss-html) parses a `style` attribute as CSS; the
  Section component takes a named `headingWidth` class instead of an inline style so no page
  carries a style attribute; icons are exported from the Figma Icons page with the Figma
  wrapper attributes stripped and strokes bound to `currentColor`; `src/styles/site.css`
  aggregates base, components and sections in order; `body` carries `id="top"` for the wordmark
  link; the theme toggle and menu button ship hidden and are revealed by their scripts, so
  without JavaScript the OS theme applies and the links are reachable only from the tablet tier
  up (the mobile menu needs a dialog); `public/favicon.svg` is a brand-blue monogram; a
  `.claude/launch.json` starts `astro preview` for the browser feedback loop. Verified in the
  browser at 1440 and 390 in both themes: keyboard order skip link, wordmark, four links, toggle,
  hero buttons, email, footer links, each with the 2px ring; theme persists across reload with no
  flash; menu opens with focus on the first link and closes on link follow; 404 renders. Escape
  closing the dialog could not be verified with synthetic keys and is left to the phase G tests.
- Phase D, 2 September 2026, after the verifier and the three REVIEW.md passes: controls that
  need JavaScript (theme toggle, menu button) reserve their space with `visibility: hidden` and
  appear when the inline bootstrap marks `html.js`, so nothing shifts after first paint and no
  dead control is reachable without scripts; header and menu links are root-relative (`/#about`)
  and the wordmark links to `/#top`, so they work from the 404 page; the full wordmark stays in
  the mobile link's accessible name (visually hidden, not `aria-hidden`); the current nav link
  carries an underline as well as brand ink and uses `aria-current="location"`; the mobile menu
  and its nav are named "Menu" (`ui.menu.label`) so the two navigation landmarks are unique;
  following a menu link no longer pulls focus back to the header; the section body wrapper
  renders only when a section has content; the theme toggle keeps the `theme-color` metas in
  step with a forced theme; the scroll-spy rebuilds its observer at the tablet breakpoint; the
  reveal resets for print; icon sizes are sm 16, md 20 (default, as the template uses), lg 24;
  header and nav links use `min-height` so text zoom and forced spacing survive; the 404 action
  is a medium button; `role="list"` on reset lists stays (Safari) and html-validate's redundant-
  role rule is off. Known until phase F: the footer's "Résumé (PDF)" link has no target yet.
  Recorded as departures: the Contact stub already ships the email button; `reveal.ts` and its
  stylesheet land in D; the nav link gap is the template's 32px, not the Header nav component's
  24px pitch. Screenshots for this phase were viewed in the browser pane, not attached to the PR;
  the 768px width was checked after the review round.
- Phase E, 2 September 2026: E2 to E8 landed in one PR rather than several, because phase D had
  already placed every stub and stylesheet import and the sections share the Section component.
  `scripts/build-qr.mjs` and the committed `src/assets/qr-resume.svg` arrive here rather than in
  F, because the Contact column needs the file; `pnpm build` runs its `--check` and `build:qr`
  writes it. The code carries the standard four-module quiet zone inside the file (the plan said
  margin 0) so it scans on the dark theme too, where no theme-stable white exists for a wrapper;
  the 37-module file renders at exactly 4px per module inside the 148px frame. `Section.astro`
  gained a named `aside` slot (a `section__main` wrapper and a `section__columns` grid): the QR
  column sits beside the head from 768px, as the template draws it, and centred below the button
  on small screens. The QR link shows "Résumé" and is named "Résumé (PDF, size)": the label is the
  visible text and the rest of `linkText` follows in a visually hidden span, so the name contains
  the visible label (WCAG 2.5.3); the schema requires `linkText` to begin with `label`. The size
  sentinel stays in that hidden text until phase F replaces it, so the content test's sentinel
  assertion fails until then (10 of the 11 specs pass now). Experience: the list is a `ul`
  (html-validate maps `role="list"` to `ul`); the whole title row is the button, with an 8px hover
  surface in `bg-hover` and a pressed step to `bg-active`; bullets use a generated glyph in
  `text-tertiary`; the panel's geometry follows the button's `aria-expanded` through `:has()`, and the
  entry's `data-disclosure` with the panel's `hidden` attribute says whether it is in the layout
  and the accessibility tree: the script sets both once the close transition has ended (found
  through `getAnimations()`, with a generation counter so a reopen cancels a pending hide), and
  `html.js [data-disclosure="closed"]` hides closed panels before the script runs so nothing
  shifts after first paint; the plan's "opacity only under reduced motion" is met by the tokens
  zeroing every duration rather than by a separate rule; the bullet glyph carries empty
  alternative text where `content: "•" / ""` is understood; the chevron is `data-js-only`, so
  without scripts the rows show no affordance. Pairings for text on `bg-hover`
  and `bg-active` and brand text on `brand-subtle-hover` were added and pass. `disclosure.spec.ts`
  (listed under G) was written now: first open, the rest collapsed, pointer and keyboard toggling,
  reduced motion, every entry open without JavaScript. About: the columns are
  `minmax(560px, 1fr) minmax(0, 496px)` from 1024px, which gives the template's 640 and 496 at
  1440, 592 and 496 at 1280, and 560 and 272 at 1024 (a literal 640 column would leave 192px);
  the unused `--width-prose-col` token was removed. The template keeps two About columns at 768
  and lays Skills out in columns at 768 and 390, but spec 3.5, 3.6 and 4 say stack and rows, and
  the spec was followed. Projects: the panel pads 24px below 768 (the template's mobile card) and
  32px from it; the ghost button's label aligns with the text through a negative start margin
  equal to its padding. Contact: the email button spans the column below 768 as the template's
  mobile frame draws it; that frame omits the QR, and the spec keeps it below the button. Footer
  (E8): links come first on small screens, centred, then the credit, in the template's 130px;
  every link is a 44px target with 12px side padding, which makes the drawn 24px between links;
  GitHub and LinkedIn carry the external-link icon per the web-quality rule that external links
  are marked. `base.css` adds `.text-label-caps` (the eyebrow's type without its ink) for the
  About group labels and the Skills terms. Verified: `pnpm check`, `pnpm lint`, `pnpm build` and
  html-validate clean; section screenshots at 320, 390, 768, 1024, 1280 and 1440 in both themes
  viewed against the Figma frames (not attached); no horizontal scroll at 320; the keyboard walk
  is the spec's 23 stops (the plan's "22" was a miscount) with a 2px ring at each, both themes;
  the home page script is 1.5 KB gzipped; axe reports zero violations in both themes at 1440
  and 390, at rest and with every entry open; Lighthouse scores 100, 100, 100, 100 on mobile
  (LCP 1.5 s, CLS 0) and on desktop. After the verifier and the three REVIEW.md passes: `:root`
  carries the same `scroll-padding-top` as the `[id]` scroll margin, so a control without an id
  is never scrolled under the header; the email button and the QR caption may wrap under forced
  text spacing at 320px; the QR sits in a 1px `border-subtle` frame with `radius-lg`, as the
  template draws it, and its column is sized by its content; `.text-eyebrow` and
  `.text-label-caps` share one declaration; the skills label and the bullet glyph use
  `--text-body-lg-line`; `profile.ts` gained `formatEducationLine` and `formatCertificationLine`
  so the page and the résumé compose the detail lines the same way; the disclosure spec asserts
  the `hidden` property after each close; the sentinel assertion is its own `test.fixme` until
  phase F; spec 3.4, 3.5, 3.8 and 3.9 were amended to match, as phases B and C did. Astro 7's
  `astro preview` is one daemon per project and a second instance exits with "already
  running", so phase G's Playwright config must set `reuseExistingServer` and the browser pane
  attaches to the running server on 4321.

## Open decision at acceptance

GitHub repository visibility (public recommended; see phase A). Pending Francis's answer;
phase A creates the repository with whichever he chooses and records it here.

## Spike results

To be recorded in phase A: whether `_headers` decorates the `/resume` proxied response and
whether `wrangler dev` applies `_redirects` locally, and the `/resume` route chosen as a result.
